import { LooperState, TrackState } from '../types'
import type { AudioEngineConfig, EngineEvent, TrackSnapshot, EngineStateSnapshot } from '../types'
import { AudioRecorder } from './AudioRecorder'
import { AudioTrack } from './AudioTrack'
import { AudioMixer } from './AudioMixer'
import { generateTrackId, fitBufferToLength } from '../utils/audioHelpers'
import { estimateRoundTripLatencyMs } from './latencyCompensation'
import {
  computeMixMonitoringPeak,
  getBufferPeak,
  normalizeRecordingPeak,
  overdubVolumeForMixBalance,
} from './trackLeveling'

/** ScriptProcessor output buffer size — must match createScriptProcessor() below. */
const OUTPUT_BUFFER_SIZE = 2048

export class LoopEngine {
  private audioContext: AudioContext | null = null
  private recorder: AudioRecorder | null = null
  private mixer: AudioMixer
  private tracks: AudioTrack[] = []
  private _state: LooperState = LooperState.EMPTY
  private masterLoopLength = 0 // in samples
  private playheadPosition = 0
  private config: AudioEngineConfig
  private onEvent: (event: EngineEvent) => void
  private redoStack: AudioTrack[] = []
  private nextTrackIndex = 0
  private outputNode: ScriptProcessorNode | null = null
  private positionEmitCounter = 0
  private recordStartPosition = 0
  // Real-time overdub capture: one loop-length buffer overwritten each pass.
  private overdubBuffer: Float32Array | null = null
  // Auto-detected round-trip latency plus optional manual fine-tune (ms).
  // Positive total shifts overdub audio earlier in the loop.
  private _autoLatencyOffsetMs = 0
  private _manualLatencyOffsetMs = 0

  constructor(config: AudioEngineConfig, onEvent: (event: EngineEvent) => void) {
    this.config = config
    this.onEvent = onEvent
    this.mixer = new AudioMixer()
  }

  // --- Getters ---

  get state(): LooperState {
    return this._state
  }

  get trackCount(): number {
    return this.tracks.length
  }

  get masterDuration(): number {
    if (this.masterLoopLength === 0) return 0
    return this.masterLoopLength / this.config.sampleRate
  }

  get currentPosition(): number {
    return this.playheadPosition / this.config.sampleRate
  }

  get allTracks(): TrackSnapshot[] {
    return this.tracks.map((t) => t.toSnapshot())
  }

  get masterVolume(): number {
    return this.mixer.getMasterVolume()
  }

  get latencyOffsetMs(): number {
    return this._autoLatencyOffsetMs + this._manualLatencyOffsetMs
  }

  get autoLatencyOffsetMs(): number {
    return this._autoLatencyOffsetMs
  }

  get manualLatencyOffsetMs(): number {
    return this._manualLatencyOffsetMs
  }

  getInputPeakLevel(): number {
    return this.recorder?.getInputPeakLevel() ?? 0
  }

  // --- Latency ---

  /** Fine-tune on top of auto-detected compensation (ms). */
  setLatencyOffset(ms: number): void {
    this._manualLatencyOffsetMs = ms
  }

  // --- Lifecycle ---

  private disposed = false

  async initialize(): Promise<void> {
    this.disposed = false
    this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate })
    this.recorder = new AudioRecorder(this.audioContext)
    await this.recorder.requestMicAccess()

    // Guard: if dispose() was called while we were awaiting mic access, bail out
    if (this.disposed || !this.audioContext) return

    // Set up output node for playback
    // Use 0 input channels so onaudioprocess fires without needing an input source
    this.outputNode = this.audioContext.createScriptProcessor(OUTPUT_BUFFER_SIZE, 0, 1)
    this.outputNode.onaudioprocess = (event) => {
      const output = event.outputBuffer.getChannelData(0)
      this.processAudioOutput(output)
    }

    this.outputNode.connect(this.audioContext.destination)

    this.measureAutoLatency()

    this._state = LooperState.EMPTY
    this.emitSnapshot()
    console.log('[LoopEngine] Initialized successfully. Sample rate:', this.config.sampleRate,
      '| Auto latency compensation:', this._autoLatencyOffsetMs, 'ms')
  }

  // --- Recording ---

  async startRecording(): Promise<void> {
    if (this._state === LooperState.RECORDING) {
      this.onEvent({ type: 'error', message: 'Already recording' })
      return
    }

    if (this._state !== LooperState.EMPTY && this._state !== LooperState.PLAYING) {
      this.onEvent({ type: 'error', message: `Cannot start recording in state: ${this._state}` })
      return
    }

    // Resume AudioContext if suspended (browsers require user gesture)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      console.log('[LoopEngine] Resuming suspended AudioContext')
      await this.audioContext.resume()
    }
    console.log('[LoopEngine] AudioContext state:', this.audioContext?.state)

    // Reset recordStartPosition; it will be captured when the first audio sample arrives
    this.recordStartPosition = 0

    const isOverdub = this.tracks.length > 0
    if (isOverdub) {
      this.overdubBuffer = new Float32Array(this.masterLoopLength)
    } else {
      this.overdubBuffer = null
    }

    this.recorder!.startCapture(
      () => {
        this.recordStartPosition = this.playheadPosition
        console.log('[LoopEngine] First audio sample arrived, recordStartPosition =', this.recordStartPosition)
      },
      isOverdub ? (samples) => this.writeOverdubSamples(samples) : undefined,
    )
    this._state = LooperState.RECORDING
    this.emitSnapshot()
  }

  stopRecording(): TrackSnapshot | null {
    if (this._state !== LooperState.RECORDING) {
      this.onEvent({ type: 'error', message: 'Not currently recording' })
      return null
    }

    let buffer = this.recorder!.stopCapture()

    const isFirstTrack = this.tracks.length === 0

    if (!isFirstTrack && this.overdubBuffer) {
      buffer = new Float32Array(this.overdubBuffer)
      this.overdubBuffer = null

      console.log('[LoopEngine] Overdub: real-time buffer used',
        '| startPos=' + this.recordStartPosition,
        '| autoOffsetMs=' + this._autoLatencyOffsetMs,
        '| manualOffsetMs=' + this._manualLatencyOffsetMs,
        '| totalOffsetMs=' + this.latencyOffsetMs)
    } else if (!isFirstTrack) {
      // Fallback if overdub buffer was not allocated (should not happen)
      buffer = fitBufferToLength(buffer, this.masterLoopLength)
    } else {
      let maxAmp = 0
      let nonZero = 0
      for (let i = 0; i < buffer.length; i++) {
        const abs = Math.abs(buffer[i])
        if (abs > maxAmp) maxAmp = abs
        if (buffer[i] !== 0) nonZero++
      }
      console.log('[LoopEngine] Recorded buffer:', buffer.length, 'samples',
        '| Non-zero samples:', nonZero,
        '| Max amplitude:', maxAmp)
    }

    if (isFirstTrack) {
      buffer = normalizeRecordingPeak(buffer)
    }

    return this.addTrackFromBuffer(buffer, { isOverdub: !isFirstTrack })
  }

  addTrackFromBuffer(
    buffer: Float32Array,
    options: { isOverdub?: boolean } = {},
  ): TrackSnapshot {
    const isFirstTrack = this.tracks.length === 0
    if (isFirstTrack) {
      this.masterLoopLength = buffer.length
    } else {
      buffer = fitBufferToLength(buffer, this.masterLoopLength)
    }

    const trackId = generateTrackId()
    const track = new AudioTrack(trackId, this.nextTrackIndex++, buffer, this.config.sampleRate)

    if (options.isOverdub) {
      const mixPeak = computeMixMonitoringPeak(
        this.tracks,
        this.masterLoopLength,
        this.mixer.getMasterVolume(),
      )
      const overdubPeak = getBufferPeak(buffer)
      const matchedVolume = overdubVolumeForMixBalance(overdubPeak, mixPeak)
      track.setVolume(matchedVolume)
      console.log('[LoopEngine] Overdub level match:',
        '| mixPeak=', mixPeak.toFixed(4),
        '| overdubPeak=', overdubPeak.toFixed(4),
        '| volume=', matchedVolume.toFixed(3))
    }

    this.tracks.push(track)
    this.redoStack = []

    this._state = LooperState.PLAYING
    this.tracks.forEach((t) => {
      if (t.state !== TrackState.MUTED) t.play()
    })

    const snapshot = track.toSnapshot()
    this.onEvent({ type: 'trackAdded', track: snapshot })
    this.emitSnapshot()
    return snapshot
  }

  async loadTrackFromUrl(url: string): Promise<TrackSnapshot> {
    if (!this.audioContext) throw new Error('Engine not initialized')
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`)
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)

    let float32: Float32Array
    if (audioBuffer.numberOfChannels === 1) {
      float32 = audioBuffer.getChannelData(0).slice()
    } else {
      float32 = new Float32Array(audioBuffer.length)
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const chData = audioBuffer.getChannelData(ch)
        for (let i = 0; i < audioBuffer.length; i++) float32[i] += chData[i]
      }
      for (let i = 0; i < float32.length; i++) float32[i] /= audioBuffer.numberOfChannels
    }

    if (audioBuffer.sampleRate !== this.config.sampleRate) {
      float32 = await this.resampleBuffer(float32, audioBuffer.sampleRate, audioBuffer.length)
    }

    return this.addTrackFromBuffer(float32)
  }

  // --- Playback ---

  playAll(): void {
    if (this.tracks.length === 0) return

    this._state = LooperState.PLAYING
    this.tracks.forEach((t) => {
      if (t.state !== TrackState.MUTED) {
        t.play()
      }
    })
    this.emitSnapshot()
  }

  stopAll(): void {
    this._state = LooperState.STOPPED
    this.playheadPosition = 0
    this.emitSnapshot()
  }

  // --- Track Controls ---

  toggleTrackMute(trackId: string): void {
    const track = this.getTrackById(trackId)
    track.toggleMute()
    this.emitSnapshot()
  }

  setTrackVolume(trackId: string, volume: number): void {
    const track = this.getTrackById(trackId)
    track.setVolume(volume)
    this.emitSnapshot()
  }

  setMasterVolume(volume: number): void {
    this.mixer.setMasterVolume(volume)
    this.emitSnapshot()
  }

  setTrackReverb(trackId: string, amount: number): void {
    const track = this.getTrackById(trackId)
    track.setReverb(amount)
    this.emitSnapshot()
  }

  setTrackPitch(trackId: string, octaves: number): void {
    const track = this.getTrackById(trackId)
    track.setPitch(octaves)
    this.emitSnapshot()
  }

  deleteTrack(trackId: string): void {
    const track = this.getTrackById(trackId)
    track.softDelete()
    this.emitSnapshot()
  }

  restoreTrack(trackId: string): void {
    const track = this.getTrackById(trackId)
    track.restore()
    this.emitSnapshot()
  }

  // --- Undo/Redo ---

  undoLastTrack(): TrackSnapshot | null {
    if (this.tracks.length === 0) return null

    const removed = this.tracks.pop()!
    this.redoStack.push(removed)

    const snapshot = removed.toSnapshot()
    this.onEvent({ type: 'trackRemoved', trackId: removed.id })

    if (this.tracks.length === 0) {
      this.masterLoopLength = 0
      this.playheadPosition = 0
      this._state = LooperState.EMPTY
    }

    this.emitSnapshot()
    return snapshot
  }

  redoTrack(): TrackSnapshot | null {
    if (this.redoStack.length === 0) return null

    const track = this.redoStack.pop()!
    this.tracks.push(track)

    // Restore master loop length if this was the first track
    if (this.tracks.length === 1) {
      this.masterLoopLength = track.sampleCount
    }

    if (this._state === LooperState.EMPTY) {
      this._state = LooperState.PLAYING
    }

    const snapshot = track.toSnapshot()
    this.onEvent({ type: 'trackAdded', track: snapshot })
    this.emitSnapshot()

    return snapshot
  }

  // --- Audio Processing (called by AudioWorklet/ScriptProcessor) ---

  processAudioOutput(outputBuffer: Float32Array): void {
    if ((this._state !== LooperState.PLAYING && this._state !== LooperState.RECORDING) || this.tracks.length === 0) {
      outputBuffer.fill(0)
      return
    }

    const mixed = this.mixer.mixTracks(this.tracks, this.playheadPosition, outputBuffer.length)
    outputBuffer.set(mixed)

    // Debug: log occasionally to verify playback is working
    if (this.positionEmitCounter === 0) {
      let maxVal = 0
      for (let i = 0; i < mixed.length; i++) {
        const abs = Math.abs(mixed[i])
        if (abs > maxVal) maxVal = abs
      }
      console.log('[LoopEngine] Playing:', this.tracks.length, 'tracks',
        '| Playhead:', this.playheadPosition, '/', this.masterLoopLength,
        '| Max output:', maxVal.toFixed(4))
    }

    this.playheadPosition = (this.playheadPosition + outputBuffer.length) % this.masterLoopLength

    // Throttle position updates to ~30fps to avoid flooding React
    this.positionEmitCounter++
    if (this.positionEmitCounter % 3 === 0) {
      this.onEvent({ type: 'positionUpdate', position: this.currentPosition })
    }
  }

  // --- Cleanup ---

  dispose(): void {
    this.disposed = true
    this._state = LooperState.STOPPED
    this.tracks = []
    this.redoStack = []
    this.playheadPosition = 0
    this.masterLoopLength = 0
    this.overdubBuffer = null

    if (this.outputNode) {
      this.outputNode.onaudioprocess = null
      this.outputNode.disconnect()
      this.outputNode = null
    }

    if (this.recorder) {
      this.recorder.dispose()
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }

  // --- Private ---

  private measureAutoLatency(): void {
    if (!this.audioContext) return

    const inputBufferSize = this.recorder?.usesWorklet ? 128 : 4096
    this._autoLatencyOffsetMs = estimateRoundTripLatencyMs(this.audioContext, {
      outputBufferSize: OUTPUT_BUFFER_SIZE,
      inputBufferSize,
    })
  }

  private getEffectiveLatencyOffsetSamples(): number {
    const totalMs = this.latencyOffsetMs
    return Math.round((totalMs / 1000) * this.config.sampleRate)
  }

  /** Write incoming mic samples into the overdub buffer, compensated for round-trip latency. */
  private writeOverdubSamples(samples: Float32Array): void {
    if (!this.overdubBuffer || this.masterLoopLength === 0) return

    const loopLen = this.masterLoopLength
    const offsetSamples = this.getEffectiveLatencyOffsetSamples()
    let pos = (this.playheadPosition - offsetSamples + loopLen) % loopLen

    for (let i = 0; i < samples.length; i++) {
      this.overdubBuffer[pos] = samples[i]
      pos = (pos + 1) % loopLen
    }
  }

  private async resampleBuffer(input: Float32Array, fromRate: number, inputLength: number): Promise<Float32Array> {
    const targetLength = Math.ceil(inputLength * this.config.sampleRate / fromRate)
    const offlineCtx = new OfflineAudioContext(1, targetLength, this.config.sampleRate)
    const buf = offlineCtx.createBuffer(1, input.length, fromRate)
    buf.copyToChannel(new Float32Array(input), 0)
    const src = offlineCtx.createBufferSource()
    src.buffer = buf
    src.connect(offlineCtx.destination)
    src.start()
    const rendered = await offlineCtx.startRendering()
    return rendered.getChannelData(0)
  }

  private getTrackById(trackId: string): AudioTrack {
    const track = this.tracks.find((t) => t.id === trackId)
    if (!track) {
      throw new Error(`Track not found: ${trackId}`)
    }
    return track
  }

  private emitSnapshot(): void {
    const snapshot: EngineStateSnapshot = {
      looperState: this._state,
      tracks: this.tracks.map((t) => t.toSnapshot()),
      masterLoopLength: this.masterDuration,
      currentPosition: this.currentPosition,
    }
    this.onEvent({ type: 'stateChange', snapshot })
  }
}
