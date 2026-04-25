import { AudioRecorder } from './AudioRecorder'
import { DawClip, generateClipId } from './DawClip'
import { clamp } from '../utils/audioHelpers'
import type { AudioEngineConfig, EngineEvent } from '../types'
import type { DawStateSnapshot, DawClipSnapshot, DawPlaybackState } from '../types/daw'

// DawEngine — linear timeline playback (no loop wrapping).
// Playhead advances forward and stops at the end of the last clip.
// Recording drops a clip at the position where REC was pressed.

export class DawEngine {
  private audioContext: AudioContext | null = null
  private recorder: AudioRecorder | null = null
  private outputNode: ScriptProcessorNode | null = null
  private clips: DawClip[] = []
  private _playheadSamples = 0
  private _recordStartSamples = 0
  private _state: DawPlaybackState = 'idle'
  private _masterVolume = 1.0
  private nextClipIndex = 0
  private config: AudioEngineConfig
  private onEvent: (event: EngineEvent) => void
  private positionEmitCounter = 0
  private disposed = false

  constructor(config: AudioEngineConfig, onEvent: (event: EngineEvent) => void) {
    this.config = config
    this.onEvent = onEvent
  }

  // --- Getters ---

  get state(): DawPlaybackState { return this._state }
  get currentPosition(): number { return this._playheadSamples / this.config.sampleRate }
  get masterVolume(): number { return this._masterVolume }

  get timelineLengthSamples(): number {
    if (this.clips.length === 0) return 0
    return Math.max(...this.clips.filter(c => !c.isDeleted).map(c => c.endSample))
  }

  get timelineLength(): number {
    return this.timelineLengthSamples / this.config.sampleRate
  }

  get allClips(): DawClipSnapshot[] {
    return this.clips.filter(c => !c.isDeleted).map(c => c.toSnapshot())
  }

  // --- Lifecycle ---

  async initialize(): Promise<void> {
    this.disposed = false
    this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate })
    this.recorder = new AudioRecorder(this.audioContext)
    await this.recorder.requestMicAccess()

    if (this.disposed || !this.audioContext) return

    this.outputNode = this.audioContext.createScriptProcessor(2048, 0, 1)
    this.outputNode.onaudioprocess = (event) => {
      const output = event.outputBuffer.getChannelData(0)
      this.processAudioOutput(output)
    }
    this.outputNode.connect(this.audioContext.destination)

    this._state = 'idle'
    this.emitSnapshot()
  }

  // --- Transport ---

  play(): void {
    if (this._state === 'recording') return
    if (this.clips.filter(c => !c.isDeleted).length === 0) return
    // If at the end, restart from the beginning
    if (this._playheadSamples >= this.timelineLengthSamples) {
      this._playheadSamples = 0
    }
    this._state = 'playing'
    this.emitSnapshot()
  }

  stop(): void {
    if (this._state === 'recording') {
      this.stopRecording()
      return
    }
    this._state = 'stopped'
    this.emitSnapshot()
  }

  seekTo(seconds: number): void {
    this._playheadSamples = Math.round(Math.max(0, seconds) * this.config.sampleRate)
    this.emitSnapshot()
  }

  async startRecording(): Promise<void> {
    if (this._state === 'recording') return

    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    this._recordStartSamples = this._playheadSamples
    this.recorder!.startCapture(() => {
      // First audio sample callback — recordStart is already captured above
    })
    this._state = 'recording'
    this.emitSnapshot()
  }

  stopRecording(): DawClipSnapshot | null {
    if (this._state !== 'recording') return null

    const buffer = this.recorder!.stopCapture()

    if (buffer.length === 0) {
      this._state = 'idle'
      this.emitSnapshot()
      return null
    }

    const clip = new DawClip(
      generateClipId(),
      this.nextClipIndex++,
      buffer,
      this.config.sampleRate,
      this._recordStartSamples,
    )
    this.clips.push(clip)

    this._state = 'stopped'
    this.emitSnapshot()
    return clip.toSnapshot()
  }

  // --- Clip management ---

  moveClip(clipId: string, startOffsetSamples: number): void {
    const clip = this.getClipById(clipId)
    clip.setStartOffset(startOffsetSamples)
    this.emitSnapshot()
  }

  deleteClip(clipId: string): void {
    const clip = this.getClipById(clipId)
    clip.softDelete()
    this.emitSnapshot()
  }

  setClipVolume(clipId: string, volume: number): void {
    const clip = this.getClipById(clipId)
    clip.setVolume(volume)
    this.emitSnapshot()
  }

  toggleClipMute(clipId: string): void {
    const clip = this.getClipById(clipId)
    clip.toggleMute()
    this.emitSnapshot()
  }

  setClipReverb(clipId: string, amount: number): void {
    const clip = this.getClipById(clipId)
    clip.setReverb(amount)
    this.emitSnapshot()
  }

  setClipPitch(clipId: string, octaves: number): void {
    const clip = this.getClipById(clipId)
    clip.setPitch(octaves)
    this.emitSnapshot()
  }

  setMasterVolume(volume: number): void {
    this._masterVolume = clamp(volume, 0, 2)
    this.emitSnapshot()
  }

  // --- Audio processing ---

  processAudioOutput(outputBuffer: Float32Array): void {
    const isActive = this._state === 'playing' || this._state === 'recording'
    if (!isActive) {
      outputBuffer.fill(0)
      return
    }

    const activeClips = this.clips.filter(c => !c.isDeleted)

    for (let i = 0; i < outputBuffer.length; i++) {
      const absPos = this._playheadSamples + i
      let sum = 0
      for (const clip of activeClips) {
        sum += clip.getSample(absPos)
      }
      outputBuffer[i] = clamp(sum * this._masterVolume, -1, 1)
    }

    this._playheadSamples += outputBuffer.length

    // Stop at the end of the timeline (only during playback, not recording)
    if (this._state === 'playing' && this._playheadSamples >= this.timelineLengthSamples) {
      this._playheadSamples = this.timelineLengthSamples
      this._state = 'stopped'
    }

    // Throttle position updates to ~30fps
    this.positionEmitCounter++
    if (this.positionEmitCounter % 3 === 0) {
      this.onEvent({ type: 'positionUpdate', position: this.currentPosition })
    }

    if (this._state === 'stopped') {
      this.emitSnapshot()
    }
  }

  // --- Cleanup ---

  dispose(): void {
    this.disposed = true
    this._state = 'idle'
    this.clips = []
    this._playheadSamples = 0

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

  private getClipById(id: string): DawClip {
    const clip = this.clips.find(c => c.id === id)
    if (!clip) throw new Error(`Clip not found: ${id}`)
    return clip
  }

  private emitSnapshot(): void {
    const snapshot: DawStateSnapshot = {
      playbackState: this._state,
      clips: this.allClips,
      currentPosition: this.currentPosition,
      timelineLength: this.timelineLength,
    }
    this.onEvent({ type: 'stateChange', snapshot: snapshot as never })
  }
}
