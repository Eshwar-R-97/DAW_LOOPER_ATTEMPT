import { AudioMixer } from './AudioMixer'
import { AudioTrack } from './AudioTrack'
import { softLimit } from '../utils/audioHelpers'

const SAMPLE_RATE = 44100

// Helper: create a track with a buffer filled with a constant value
function createTrack(id: string, index: number, length: number, value: number): AudioTrack {
  const buffer = new Float32Array(length)
  buffer.fill(value)
  return new AudioTrack(id, index, buffer, SAMPLE_RATE)
}

describe('AudioMixer', () => {
  describe('Constructor', () => {
    it('defaults to master volume 1.0', () => {
      const mixer = new AudioMixer()
      expect(mixer.getMasterVolume()).toBe(1.0)
    })

    it('accepts a custom master volume', () => {
      const mixer = new AudioMixer(0.8)
      expect(mixer.getMasterVolume()).toBe(0.8)
    })
  })

  describe('setMasterVolume()', () => {
    it('updates the master volume', () => {
      const mixer = new AudioMixer()
      mixer.setMasterVolume(0.6)
      expect(mixer.getMasterVolume()).toBe(0.6)
    })

    it('clamps to 0.0 minimum', () => {
      const mixer = new AudioMixer()
      mixer.setMasterVolume(-1)
      expect(mixer.getMasterVolume()).toBe(0.0)
    })

    it('clamps to 2.0 maximum', () => {
      const mixer = new AudioMixer()
      mixer.setMasterVolume(5)
      expect(mixer.getMasterVolume()).toBe(2.0)
    })

    it('accepts values up to 2.0', () => {
      const mixer = new AudioMixer()
      mixer.setMasterVolume(1.5)
      expect(mixer.getMasterVolume()).toBe(1.5)
    })
  })

  describe('mixSample()', () => {
    it('returns 0 when no tracks provided', () => {
      const mixer = new AudioMixer()
      expect(mixer.mixSample([], 0)).toBe(0)
    })

    it('returns the single tracks sample when only one track', () => {
      const mixer = new AudioMixer()
      const track = createTrack('t1', 0, 100, 0.5)
      expect(mixer.mixSample([track], 0)).toBeCloseTo(0.5)
    })

    it('sums samples from multiple tracks', () => {
      const mixer = new AudioMixer()
      const track1 = createTrack('t1', 0, 100, 0.3)
      const track2 = createTrack('t2', 1, 100, 0.2)
      // 0.3 + 0.2 = 0.5
      expect(mixer.mixSample([track1, track2], 0)).toBeCloseTo(0.5)
    })

    it('applies master volume scaling', () => {
      const mixer = new AudioMixer(0.5)
      const track = createTrack('t1', 0, 100, 0.8)
      // 0.8 * 0.5 master = 0.4
      expect(mixer.mixSample([track], 0)).toBeCloseTo(0.4)
    })

    it('skips muted tracks', () => {
      const mixer = new AudioMixer()
      const track1 = createTrack('t1', 0, 100, 0.5)
      const track2 = createTrack('t2', 1, 100, 0.3)
      track2.toggleMute()
      // Only track1 contributes: 0.5
      expect(mixer.mixSample([track1, track2], 0)).toBeCloseTo(0.5)
    })

    it('soft-limits output above 1.0 instead of hard clipping', () => {
      const mixer = new AudioMixer()
      const track1 = createTrack('t1', 0, 100, 0.8)
      const track2 = createTrack('t2', 1, 100, 0.7)
      expect(mixer.mixSample([track1, track2], 0)).toBeCloseTo(softLimit(1.5))
    })

    it('soft-limits negative overflow', () => {
      const mixer = new AudioMixer()
      const buffer1 = new Float32Array(100)
      buffer1.fill(-0.8)
      const track1 = new AudioTrack('t1', 0, buffer1, SAMPLE_RATE)
      const buffer2 = new Float32Array(100)
      buffer2.fill(-0.7)
      const track2 = new AudioTrack('t2', 1, buffer2, SAMPLE_RATE)
      expect(mixer.mixSample([track1, track2], 0)).toBeCloseTo(softLimit(-1.5))
    })
  })

  describe('mixTracks()', () => {
    it('returns a Float32Array of the correct length', () => {
      const mixer = new AudioMixer()
      const track = createTrack('t1', 0, 100, 0.5)
      const result = mixer.mixTracks([track], 0, 10)
      expect(result).toBeInstanceOf(Float32Array)
      expect(result.length).toBe(10)
    })

    it('mixes all tracks for each sample position', () => {
      const mixer = new AudioMixer()
      const track1 = createTrack('t1', 0, 100, 0.3)
      const track2 = createTrack('t2', 1, 100, 0.2)
      const result = mixer.mixTracks([track1, track2], 0, 5)
      for (let i = 0; i < 5; i++) {
        expect(result[i]).toBeCloseTo(0.5) // 0.3 + 0.2
      }
    })

    it('handles wrap-around per track', () => {
      const mixer = new AudioMixer()
      // Track with 3 samples that will wrap
      const buffer = new Float32Array([0.1, 0.2, 0.3])
      const track = new AudioTrack('t1', 0, buffer, SAMPLE_RATE)
      // Get 6 samples starting at 0: should be [0.1, 0.2, 0.3, 0.1, 0.2, 0.3]
      const result = mixer.mixTracks([track], 0, 6)
      expect(result[0]).toBeCloseTo(0.1)
      expect(result[1]).toBeCloseTo(0.2)
      expect(result[2]).toBeCloseTo(0.3)
      expect(result[3]).toBeCloseTo(0.1) // wrapped
      expect(result[4]).toBeCloseTo(0.2) // wrapped
      expect(result[5]).toBeCloseTo(0.3) // wrapped
    })

    it('returns silence (zeros) when all tracks are muted', () => {
      const mixer = new AudioMixer()
      const track1 = createTrack('t1', 0, 100, 0.5)
      const track2 = createTrack('t2', 1, 100, 0.3)
      track1.toggleMute()
      track2.toggleMute()
      const result = mixer.mixTracks([track1, track2], 0, 10)
      for (let i = 0; i < 10; i++) {
        expect(result[i]).toBe(0)
      }
    })

    it('returns silence when no tracks provided', () => {
      const mixer = new AudioMixer()
      const result = mixer.mixTracks([], 0, 10)
      expect(result.length).toBe(10)
      for (let i = 0; i < 10; i++) {
        expect(result[i]).toBe(0)
      }
    })

    it('applies master volume to the entire output', () => {
      const mixer = new AudioMixer(0.5)
      const track = createTrack('t1', 0, 100, 0.6)
      const result = mixer.mixTracks([track], 0, 5)
      for (let i = 0; i < 5; i++) {
        expect(result[i]).toBeCloseTo(0.3) // 0.6 * 0.5
      }
    })

    it('soft-limits all values to prevent harsh clipping', () => {
      const mixer = new AudioMixer()
      const track1 = createTrack('t1', 0, 100, 0.9)
      const track2 = createTrack('t2', 1, 100, 0.8)
      const result = mixer.mixTracks([track1, track2], 0, 5)
      const expected = softLimit(1.7)
      for (let i = 0; i < 5; i++) {
        expect(result[i]).toBeCloseTo(expected)
      }
    })
  })
})
