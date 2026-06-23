import { describe, expect, it } from 'vitest'
import { AudioTrack } from './AudioTrack'
import {
  computeMixMonitoringPeak,
  getBufferPeak,
  normalizeRecordingPeak,
  overdubVolumeForMixBalance,
  RECORDING_TARGET_PEAK,
  scaleBuffer,
} from './trackLeveling'

describe('trackLeveling', () => {
  describe('getBufferPeak', () => {
    it('returns max absolute sample', () => {
      expect(getBufferPeak(new Float32Array([0.2, -0.9, 0.1]))).toBeCloseTo(0.9)
    })
  })

  describe('normalizeRecordingPeak', () => {
    it('scales down buffers hotter than the target peak', () => {
      const hot = new Float32Array([1.0, -0.5])
      const normalized = normalizeRecordingPeak(hot)
      expect(getBufferPeak(normalized)).toBeCloseTo(RECORDING_TARGET_PEAK)
    })

    it('leaves quiet buffers unchanged', () => {
      const quiet = new Float32Array([0.2, -0.1])
      expect(normalizeRecordingPeak(quiet)).toBe(quiet)
    })
  })

  describe('scaleBuffer', () => {
    it('multiplies every sample by the factor', () => {
      const scaled = scaleBuffer(new Float32Array([0.5, 1]), 0.5)
      expect(scaled).toEqual(new Float32Array([0.25, 0.5]))
    })
  })

  describe('computeMixMonitoringPeak', () => {
    it('reflects per-track volume² in the heard mix', () => {
      const buffer = new Float32Array(100)
      buffer.fill(1)
      const track = new AudioTrack('t1', 0, buffer, 44100)
      track.setVolume(0.5) // gain 0.25

      const peak = computeMixMonitoringPeak([track], 100, 1)
      expect(peak).toBeCloseTo(0.25)
    })
  })

  describe('overdubVolumeForMixBalance', () => {
    it('lowers volume when overdub peak exceeds mix reference', () => {
      const vol = overdubVolumeForMixBalance(1.0, 0.25)
      expect(vol).toBeCloseTo(0.5)
    })

    it('raises volume when overdub is quieter than the mix', () => {
      const vol = overdubVolumeForMixBalance(0.25, 1.0)
      expect(vol).toBeCloseTo(2.0)
    })

    it('returns 1.0 when either peak is effectively silent', () => {
      expect(overdubVolumeForMixBalance(0, 0.5)).toBe(1)
      expect(overdubVolumeForMixBalance(0.5, 0)).toBe(1)
    })
  })
})
