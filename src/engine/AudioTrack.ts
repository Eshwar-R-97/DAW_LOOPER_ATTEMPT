import { TrackState } from '../types'
import type { TrackSnapshot } from '../types'
import { clamp, generateWaveformPeaks } from '../utils/audioHelpers'

const DEFAULT_WAVEFORM_POINTS = 200

export class AudioTrack {
  readonly id: string
  readonly index: number
  private buffer: Float32Array
  private sampleRate: number
  private _state: TrackState
  private _volume: number
  private _isMuted: boolean
  private _isDeleted: boolean
  private _savedVolume: number
  private _waveformData: number[]

  constructor(id: string, index: number, buffer: Float32Array, sampleRate: number) {
    this.id = id
    this.index = index
    this.buffer = buffer
    this.sampleRate = sampleRate
    this._state = TrackState.PLAYING
    this._volume = 1.0
    this._isMuted = false
    this._isDeleted = false
    this._savedVolume = 1.0
    this._waveformData = AudioTrack.generateWaveformData(buffer, DEFAULT_WAVEFORM_POINTS)
  }

  get state(): TrackState {
    return this._state
  }

  get volume(): number {
    return this._volume
  }

  get isMuted(): boolean {
    return this._isMuted
  }

  get isDeleted(): boolean {
    return this._isDeleted
  }

  get duration(): number {
    return this.buffer.length / this.sampleRate
  }

  get waveformData(): number[] {
    return this._waveformData
  }

  get sampleCount(): number {
    return this.buffer.length
  }

  setVolume(value: number): void {
    this._volume = clamp(value, 0.0, 2.0)
  }

  // Perceptual gain: x² curve so the slider feels linear to human hearing.
  // Volume 0–2 maps to gain 0–4 (0² to 2²).
  private get gain(): number {
    return this._volume * this._volume
  }

  softDelete(): void {
    this._savedVolume = this._volume
    this._volume = 0
    this._isDeleted = true
  }

  restore(): void {
    this._volume = this._savedVolume
    this._isDeleted = false
  }

  toggleMute(): void {
    this._isMuted = !this._isMuted
    this._state = this._isMuted ? TrackState.MUTED : TrackState.PLAYING
  }

  play(): void {
    this._state = TrackState.PLAYING
  }

  stop(): void {
    this._state = TrackState.STOPPED
  }

  getSample(position: number): number {
    if (position < 0) return 0
    if (this._isMuted || this._isDeleted) return 0

    const wrappedPosition = position % this.buffer.length
    return this.buffer[wrappedPosition] * this.gain
  }

  getSampleBatch(startPosition: number, length: number): Float32Array {
    const output = new Float32Array(length)

    if (this._isMuted || this._isDeleted) return output

    for (let i = 0; i < length; i++) {
      const position = (startPosition + i) % this.buffer.length
      output[i] = this.buffer[position] * this.gain
    }

    return output
  }

  toSnapshot(): TrackSnapshot {
    return {
      id: this.id,
      index: this.index,
      state: this._state,
      duration: this.duration,
      volume: this._volume,
      isMuted: this._isMuted,
      isDeleted: this._isDeleted,
      waveformData: this._waveformData,
    }
  }

  static generateWaveformData(buffer: Float32Array, numPoints: number): number[] {
    return generateWaveformPeaks(buffer, numPoints)
  }
}
