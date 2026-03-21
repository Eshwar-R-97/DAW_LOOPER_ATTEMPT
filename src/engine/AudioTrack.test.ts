import { AudioTrack } from './AudioTrack'
import { TrackState } from '../types'

// Helper: create a simple buffer with known values
function createTestBuffer(length: number, value = 0.5): Float32Array {
  const buffer = new Float32Array(length)
  buffer.fill(value)
  return buffer
}

// Helper: create a buffer with incrementing values (0.1, 0.2, 0.3...)
function createSequentialBuffer(length: number): Float32Array {
  const buffer = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    buffer[i] = (i + 1) * 0.1
  }
  return buffer
}

describe('AudioTrack', () => {
  const sampleRate = 44100

  describe('Constructor', () => {
    it('creates a track with the given id and index', () => {
      const track = new AudioTrack('track-1', 0, createTestBuffer(1000), sampleRate)
      expect(track.id).toBe('track-1')
      expect(track.index).toBe(0)
    })

    it('initializes with state PLAYING', () => {
      const track = new AudioTrack('track-1', 0, createTestBuffer(1000), sampleRate)
      expect(track.state).toBe(TrackState.PLAYING)
    })

    it('initializes with volume 1.0', () => {
      const track = new AudioTrack('track-1', 0, createTestBuffer(1000), sampleRate)
      expect(track.volume).toBe(1.0)
    })

    it('initializes with isMuted false', () => {
      const track = new AudioTrack('track-1', 0, createTestBuffer(1000), sampleRate)
      expect(track.isMuted).toBe(false)
    })

    it('calculates duration from buffer length and sample rate', () => {
      // 44100 samples at 44100 Hz = 1 second
      const track = new AudioTrack('track-1', 0, createTestBuffer(44100), sampleRate)
      expect(track.duration).toBeCloseTo(1.0)
    })

    it('calculates duration correctly for different lengths', () => {
      // 22050 samples at 44100 Hz = 0.5 seconds
      const track = new AudioTrack('track-1', 0, createTestBuffer(22050), sampleRate)
      expect(track.duration).toBeCloseTo(0.5)
    })

    it('generates waveform data on construction', () => {
      const track = new AudioTrack('track-1', 0, createTestBuffer(1000), sampleRate)
      expect(track.waveformData.length).toBeGreaterThan(0)
    })

    it('exposes sampleCount', () => {
      const track = new AudioTrack('track-1', 0, createTestBuffer(1000), sampleRate)
      expect(track.sampleCount).toBe(1000)
    })
  })

  describe('setVolume()', () => {
    it('sets volume to the given value', () => {
      const track = new AudioTrack('track-1', 0, createTestBuffer(1000), sampleRate)
      track.setVolume(0.7)
      expect(track.volume).toBe(0.7)
    })

    it('clamps volume to 0.0 minimum', () => {
      const track = new AudioTrack('track-1', 0, createTestBuffer(1000), sampleRate)
      track.setVolume(-0.5)
      expect(track.volume).toBe(0.0)
    })

    it('clamps volume to 2.0 maximum', () => {
      const track = new AudioTrack('track-1', 0, createTestBuffer(1000), sampleRate)
      track.setVolume(2.5)
      expect(track.volume).toBe(2.0)
    })

    it('accepts decimal values like 0.5', () => {
      const track = new AudioTrack('track-1', 0, createTestBuffer(1000), sampleRate)
      track.setVolume(0.5)
      expect(track.volume).toBe(0.5)
    })
  })

  describe('toggleMute()', () => {
    it('sets isMuted to true and state to MUTED when unmuted', () => {
      const track = new AudioTrack('track-1', 0, createTestBuffer(1000), sampleRate)
      expect(track.isMuted).toBe(false)
      track.toggleMute()
      expect(track.isMuted).toBe(true)
      expect(track.state).toBe(TrackState.MUTED)
    })

    it('sets isMuted to false and state to PLAYING when muted', () => {
      const track = new AudioTrack('track-1', 0, createTestBuffer(1000), sampleRate)
      track.toggleMute() // mute
      track.toggleMute() // unmute
      expect(track.isMuted).toBe(false)
      expect(track.state).toBe(TrackState.PLAYING)
    })
  })

  describe('play()', () => {
    it('sets state to PLAYING', () => {
      const track = new AudioTrack('track-1', 0, createTestBuffer(1000), sampleRate)
      track.stop()
      track.play()
      expect(track.state).toBe(TrackState.PLAYING)
    })

    it('does nothing if already PLAYING', () => {
      const track = new AudioTrack('track-1', 0, createTestBuffer(1000), sampleRate)
      track.play()
      expect(track.state).toBe(TrackState.PLAYING)
    })
  })

  describe('stop()', () => {
    it('sets state to STOPPED', () => {
      const track = new AudioTrack('track-1', 0, createTestBuffer(1000), sampleRate)
      track.stop()
      expect(track.state).toBe(TrackState.STOPPED)
    })
  })

  describe('getSample()', () => {
    it('returns the sample at the given position scaled by volume² (perceptual)', () => {
      const buffer = createTestBuffer(10, 0.8)
      const track = new AudioTrack('track-1', 0, buffer, sampleRate)
      track.setVolume(0.5)
      const sample = track.getSample(0)
      expect(sample).toBeCloseTo(0.2) // 0.8 * 0.5² = 0.8 * 0.25
    })

    it('returns full amplitude at volume 1.0', () => {
      const buffer = createTestBuffer(10, 0.6)
      const track = new AudioTrack('track-1', 0, buffer, sampleRate)
      expect(track.getSample(0)).toBeCloseTo(0.6)
    })

    it('returns 0 when track is muted', () => {
      const buffer = createTestBuffer(10, 0.8)
      const track = new AudioTrack('track-1', 0, buffer, sampleRate)
      track.toggleMute()
      expect(track.getSample(0)).toBe(0)
    })

    it('wraps around when position exceeds buffer length', () => {
      const buffer = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5])
      const track = new AudioTrack('track-1', 0, buffer, sampleRate)
      // Position 5 should wrap to index 0
      expect(track.getSample(5)).toBeCloseTo(0.1)
      // Position 7 should wrap to index 2
      expect(track.getSample(7)).toBeCloseTo(0.3)
    })

    it('returns 0 for negative position', () => {
      const buffer = createTestBuffer(10, 0.5)
      const track = new AudioTrack('track-1', 0, buffer, sampleRate)
      expect(track.getSample(-1)).toBe(0)
    })
  })

  describe('getSampleBatch()', () => {
    it('returns correct number of samples', () => {
      const buffer = createTestBuffer(100, 0.5)
      const track = new AudioTrack('track-1', 0, buffer, sampleRate)
      const batch = track.getSampleBatch(0, 10)
      expect(batch.length).toBe(10)
    })

    it('applies volume² scaling to all samples (perceptual)', () => {
      const buffer = createTestBuffer(100, 0.8)
      const track = new AudioTrack('track-1', 0, buffer, sampleRate)
      track.setVolume(0.5)
      const batch = track.getSampleBatch(0, 5)
      for (let i = 0; i < batch.length; i++) {
        expect(batch[i]).toBeCloseTo(0.2) // 0.8 * 0.5² = 0.8 * 0.25
      }
    })

    it('returns all zeros when muted', () => {
      const buffer = createTestBuffer(100, 0.8)
      const track = new AudioTrack('track-1', 0, buffer, sampleRate)
      track.toggleMute()
      const batch = track.getSampleBatch(0, 10)
      for (let i = 0; i < batch.length; i++) {
        expect(batch[i]).toBe(0)
      }
    })

    it('wraps around at buffer boundary', () => {
      const buffer = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5])
      const track = new AudioTrack('track-1', 0, buffer, sampleRate)
      // Start at position 3, get 5 samples: [0.4, 0.5, 0.1, 0.2, 0.3]
      const batch = track.getSampleBatch(3, 5)
      expect(batch[0]).toBeCloseTo(0.4)
      expect(batch[1]).toBeCloseTo(0.5)
      expect(batch[2]).toBeCloseTo(0.1) // wrapped
      expect(batch[3]).toBeCloseTo(0.2) // wrapped
      expect(batch[4]).toBeCloseTo(0.3) // wrapped
    })
  })

  describe('toSnapshot()', () => {
    it('returns object with all track metadata', () => {
      const track = new AudioTrack('track-1', 2, createTestBuffer(44100), sampleRate)
      track.setVolume(0.7)
      const snapshot = track.toSnapshot()

      expect(snapshot.id).toBe('track-1')
      expect(snapshot.index).toBe(2)
      expect(snapshot.state).toBe(TrackState.PLAYING)
      expect(snapshot.duration).toBeCloseTo(1.0)
      expect(snapshot.volume).toBe(0.7)
      expect(snapshot.isMuted).toBe(false)
      expect(snapshot.waveformData).toBeDefined()
      expect(Array.isArray(snapshot.waveformData)).toBe(true)
    })

    it('does not include raw audio buffer', () => {
      const track = new AudioTrack('track-1', 0, createTestBuffer(1000), sampleRate)
      const snapshot = track.toSnapshot()
      // The snapshot should not have an audioBuffer property
      expect((snapshot as Record<string, unknown>).audioBuffer).toBeUndefined()
      expect((snapshot as Record<string, unknown>).buffer).toBeUndefined()
    })
  })

  describe('generateWaveformData (static)', () => {
    it('returns the correct number of data points', () => {
      const buffer = createTestBuffer(1000, 0.5)
      const waveform = AudioTrack.generateWaveformData(buffer, 50)
      expect(waveform).toHaveLength(50)
    })

    it('peak values are between 0 and 1', () => {
      const buffer = new Float32Array(1000)
      for (let i = 0; i < 1000; i++) {
        buffer[i] = Math.sin(i * 0.1) * 0.9
      }
      const waveform = AudioTrack.generateWaveformData(buffer, 20)
      waveform.forEach((peak) => {
        expect(peak).toBeGreaterThanOrEqual(0)
        expect(peak).toBeLessThanOrEqual(1)
      })
    })

    it('handles empty buffer', () => {
      const buffer = new Float32Array(0)
      const waveform = AudioTrack.generateWaveformData(buffer, 10)
      expect(waveform).toHaveLength(10)
      waveform.forEach((peak) => expect(peak).toBe(0))
    })

    it('handles buffer shorter than numPoints', () => {
      const buffer = new Float32Array([0.5, -0.3])
      const waveform = AudioTrack.generateWaveformData(buffer, 10)
      expect(waveform).toHaveLength(10)
    })
  })
})
