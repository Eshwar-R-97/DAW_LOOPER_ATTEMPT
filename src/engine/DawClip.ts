import { TrackEffects } from './TrackEffects'
import { olaShift } from './pitchShift'
import { clamp, generateWaveformPeaks } from '../utils/audioHelpers'
import type { DawClipSnapshot } from '../types/daw'

const DEFAULT_WAVEFORM_POINTS = 200

let nextId = 1
export function generateClipId(): string {
  return `clip-${Date.now()}-${nextId++}`
}

export class DawClip {
  readonly id: string
  readonly index: number
  private buffer: Float32Array
  private _processedBuffer: Float32Array
  private sampleRate: number
  private _startOffsetSamples: number
  private _volume: number
  private _isMuted: boolean
  private _isDeleted: boolean
  private _waveformData: number[]
  private effects = new TrackEffects()

  constructor(
    id: string,
    index: number,
    buffer: Float32Array,
    sampleRate: number,
    startOffsetSamples = 0,
  ) {
    this.id = id
    this.index = index
    this.buffer = buffer
    this._processedBuffer = buffer
    this.sampleRate = sampleRate
    this._startOffsetSamples = startOffsetSamples
    this._volume = 1.0
    this._isMuted = false
    this._isDeleted = false
    this._waveformData = generateWaveformPeaks(buffer, DEFAULT_WAVEFORM_POINTS)
  }

  // --- Getters ---

  get startOffsetSamples(): number { return this._startOffsetSamples }
  get startTime(): number { return this._startOffsetSamples / this.sampleRate }
  get sampleCount(): number { return this._processedBuffer.length }
  get duration(): number { return this._processedBuffer.length / this.sampleRate }
  get endSample(): number { return this._startOffsetSamples + this._processedBuffer.length }
  get volume(): number { return this._volume }
  get isMuted(): boolean { return this._isMuted }
  get isDeleted(): boolean { return this._isDeleted }
  get reverbAmount(): number { return this.effects.getReverb() }
  get pitchOctaves(): number { return this.effects.getPitchOctaves() }

  private get gain(): number { return this._volume * this._volume }

  // --- Mutations ---

  setStartOffset(samples: number): void {
    this._startOffsetSamples = Math.max(0, samples)
  }

  setVolume(value: number): void {
    this._volume = clamp(value, 0, 2)
  }

  toggleMute(): void {
    this._isMuted = !this._isMuted
  }

  softDelete(): void { this._isDeleted = true }
  restore(): void { this._isDeleted = false }

  setReverb(amount: number): void { this.effects.setReverb(amount) }

  setPitch(octaves: number): void {
    this.effects.setPitch(octaves)
    this._processedBuffer = olaShift(this.buffer, this.effects.getPitchRatio())
  }

  // --- Audio ---

  // Key difference from AudioTrack: position is ABSOLUTE (timeline position in samples).
  // Returns 0 if the playhead is before this clip starts or after it ends.
  getSample(absolutePosition: number): number {
    if (this._isMuted || this._isDeleted) return 0
    const localPos = absolutePosition - this._startOffsetSamples
    if (localPos < 0 || localPos >= this._processedBuffer.length) return 0
    const dry = this._processedBuffer[Math.floor(localPos)] * this.gain
    return this.effects.process(dry)
  }

  toSnapshot(): DawClipSnapshot {
    return {
      id: this.id,
      index: this.index,
      startTime: this.startTime,
      duration: this.duration,
      volume: this._volume,
      isMuted: this._isMuted,
      isDeleted: this._isDeleted,
      waveformData: this._waveformData,
      reverbAmount: this.effects.getReverb(),
      pitchOctaves: this.effects.getPitchOctaves(),
    }
  }
}
