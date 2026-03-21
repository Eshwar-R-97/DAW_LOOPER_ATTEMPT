import { LooperState, TrackState } from '../types'
import type { AudioEngineConfig, EngineEvent, TrackSnapshot, EngineStateSnapshot } from '../types'
import { AudioRecorder } from './AudioRecorder'
import { AudioTrack } from './AudioTrack'
import { AudioMixer } from './AudioMixer'
import { generateTrackId } from '../utils/audioHelpers'

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
  // User-adjustable latency offset in ms: shifts overdub audio earlier in the loop
  // to compensate for round-trip audio delay (output latency + recording delay).
  // Positive = shift audio earlier, negative = shift later.
  private _latencyOffsetMs = 0

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
    return this._latencyOffsetMs
  }

  // --- Latency ---

  setLatencyOffset(ms: number): void {
    this._latencyOffsetMs = ms
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
    this.outputNode = this.audioContext.createScriptProcessor(2048, 0, 1)
    this.outputNode.onaudioprocess = (event) => {
      const output = event.outputBuffer.getChannelData(0)
      this.processAudioOutput(output)
    }
    this.outputNode.connect(this.audioContext.destination)

    this._state = LooperState.EMPTY
    this.emitSnapshot()
    console.log('[LoopEngine] Initialized successfully. Sample rate:', this.config.sampleRate)
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

    // Save playhead position so overdub can be aligned to the loop
    this.recordStartPosition = this.playheadPosition

    this.recorder!.startCapture()
    this._state = LooperState.RECORDING
    this.emitSnapshot()
  }

  stopRecording(): TrackSnapshot | null {
    if (this._state !== LooperState.RECORDING) {
      this.onEvent({ type: 'error', message: 'Not currently recording' })
      return null
    }

    let buffer = this.recorder!.stopCapture()

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

    const isFirstTrack = this.tracks.length === 0

    if (isFirstTrack) {
      // First track sets the master loop length
      this.masterLoopLength = buffer.length
    } else {
      // Overdub: extract the last complete loop cycle from the recording.
      // Recording started at playhead position `recordStartPosition`.
      // Samples 0...(masterLoopLength - recordStartPosition - 1) cover the remainder of that first loop.
      // After that, each `masterLoopLength` block is a complete loop aligned to position 0.
      // We take the LAST complete loop so the user can practice over multiple loops
      // and only the final one is kept.
      const loopLen = this.masterLoopLength
      const firstBoundary = loopLen - this.recordStartPosition // samples until first loop-0 boundary

      // How many complete loops exist after the first boundary?
      const samplesAfterBoundary = buffer.length > firstBoundary ? buffer.length - firstBoundary : 0
      const completeLoops = Math.floor(samplesAfterBoundary / loopLen)

      let aligned: Float32Array
      if (completeLoops > 0) {
        // Extract the last complete loop (already aligned to position 0)
        const lastLoopStart = firstBoundary + (completeLoops - 1) * loopLen
        aligned = buffer.slice(lastLoopStart, lastLoopStart + loopLen)
      } else {
        // Less than one full loop recorded — place audio where it was recorded
        aligned = new Float32Array(loopLen)
        for (let i = 0; i < buffer.length && i < loopLen; i++) {
          const pos = (this.recordStartPosition + i) % loopLen
          aligned[pos] = buffer[i]
        }
      }

      // Apply user sync offset: shift audio left/right to fine-tune timing.
      // Positive offset = shift right (later in loop).
      // Negative offset = shift left (earlier in loop).
      const offsetSamples = Math.round(this._latencyOffsetMs / 1000 * this.config.sampleRate)
      if (offsetSamples !== 0) {
        const shifted = new Float32Array(loopLen)
        for (let i = 0; i < loopLen; i++) {
          let srcPos = (i - offsetSamples) % loopLen
          if (srcPos < 0) srcPos += loopLen
          shifted[i] = aligned[srcPos]
        }
        aligned = shifted
      }

      console.log('[LoopEngine] Overdub: startPos=' + this.recordStartPosition,
        '| rawLen=' + buffer.length,
        '| completeLoops=' + completeLoops,
        '| offsetMs=' + this._latencyOffsetMs,
        '| offsetSamples=' + offsetSamples)

      buffer = aligned
    }

    const trackId = generateTrackId()
    const trackIndex = this.nextTrackIndex++
    const track = new AudioTrack(trackId, trackIndex, buffer, this.config.sampleRate)

    this.tracks.push(track)

    // Recording a new track clears the redo stack
    this.redoStack = []

    this._state = LooperState.PLAYING
    // Ensure all tracks are in PLAYING state
    this.tracks.forEach((t) => {
      if (t.state !== TrackState.MUTED) {
        t.play()
      }
    })

    const snapshot = track.toSnapshot()
    this.onEvent({ type: 'trackAdded', track: snapshot })
    this.emitSnapshot()

    return snapshot
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
