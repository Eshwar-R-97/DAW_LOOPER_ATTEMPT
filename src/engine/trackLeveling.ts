import type { AudioTrack } from './AudioTrack'
import { clamp, softLimit } from '../utils/audioHelpers'

/** Target peak for the first recorded track — leaves headroom for overdubs. */
export const RECORDING_TARGET_PEAK = 0.85

export function getBufferPeak(buffer: Float32Array): number {
  let peak = 0
  for (let i = 0; i < buffer.length; i++) {
    peak = Math.max(peak, Math.abs(buffer[i]))
  }
  return peak
}

export function scaleBuffer(buffer: Float32Array, factor: number): Float32Array {
  if (factor === 1) return buffer
  const scaled = new Float32Array(buffer.length)
  for (let i = 0; i < buffer.length; i++) {
    scaled[i] = buffer[i] * factor
  }
  return scaled
}

/** Scale down hot first-track recordings so later layers have headroom. */
export function normalizeRecordingPeak(
  buffer: Float32Array,
  targetPeak = RECORDING_TARGET_PEAK,
): Float32Array {
  const peak = getBufferPeak(buffer)
  if (peak <= targetPeak || peak === 0) return buffer
  return scaleBuffer(buffer, targetPeak / peak)
}

function samplePositions(loopLen: number, maxSamples = 64): number[] {
  if (loopLen <= 0) return []
  const step = Math.max(1, Math.floor(loopLen / maxSamples))
  const positions: number[] = []
  for (let pos = 0; pos < loopLen; pos += step) {
    positions.push(pos)
  }
  return positions
}

/**
 * Peak level of the current backing mix as heard during overdub
 * (per-track volume², master volume, soft limiting).
 */
export function computeMixMonitoringPeak(
  tracks: AudioTrack[],
  loopLen: number,
  masterVolume: number,
): number {
  if (tracks.length === 0 || loopLen === 0) return 0

  let mixPeak = 0
  for (const pos of samplePositions(loopLen)) {
    let sum = 0
    for (const track of tracks) {
      sum += track.getSample(pos)
    }
    mixPeak = Math.max(mixPeak, Math.abs(softLimit(sum * masterVolume)))
  }
  return mixPeak
}

/**
 * Pick a track volume so a new layer's peak output matches the backing mix.
 * AudioTrack applies perceptual gain as volume².
 */
export function overdubVolumeForMixBalance(
  overdubPeak: number,
  mixPeak: number,
  minVolume = 0.1,
  maxVolume = 2.0,
): number {
  if (overdubPeak < 1e-8 || mixPeak < 1e-8) return 1.0

  const ratio = mixPeak / overdubPeak
  const volume = Math.sqrt(ratio)
  return clamp(volume, minVolume, maxVolume)
}
