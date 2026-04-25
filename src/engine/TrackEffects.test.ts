import { TrackEffects } from './TrackEffects'

describe('TrackEffects', () => {
  describe('bypass at reverbAmount=0', () => {
    it('returns input unchanged when reverb is 0', () => {
      const fx = new TrackEffects()
      expect(fx.process(0.5)).toBe(0.5)
      expect(fx.process(-0.3)).toBe(-0.3)
      expect(fx.process(0)).toBe(0)
    })
  })

  describe('setReverb / getReverb', () => {
    it('clamps to 0', () => {
      const fx = new TrackEffects()
      fx.setReverb(-1)
      expect(fx.getReverb()).toBe(0)
    })

    it('clamps to 1', () => {
      const fx = new TrackEffects()
      fx.setReverb(5)
      expect(fx.getReverb()).toBe(1)
    })

    it('stores the set value', () => {
      const fx = new TrackEffects()
      fx.setReverb(0.6)
      expect(fx.getReverb()).toBe(0.6)
    })
  })

  describe('process() with reverb active', () => {
    it('returns a different value when reverb > 0 after warm-up', () => {
      const fx = new TrackEffects()
      fx.setReverb(0.5)
      // Run a few samples to warm up the delay buffers
      for (let i = 0; i < 100; i++) fx.process(0.5)
      // Once delay buffers are non-zero, output should differ from dry input
      const out = fx.process(0.5)
      expect(out).not.toBe(0.5)
    })

    it('output is within a reasonable range', () => {
      const fx = new TrackEffects()
      fx.setReverb(0.8)
      for (let i = 0; i < 5000; i++) fx.process(Math.sin(i * 0.01))
      const out = fx.process(0.5)
      expect(out).toBeGreaterThan(-2)
      expect(out).toBeLessThan(2)
    })
  })

  describe('setPitch / getPitchOctaves / getPitchRatio', () => {
    it('defaults to 0 octaves and ratio 1', () => {
      const fx = new TrackEffects()
      expect(fx.getPitchOctaves()).toBe(0)
      expect(fx.getPitchRatio()).toBe(1)
    })

    it('+1 octave → ratio 2', () => {
      const fx = new TrackEffects()
      fx.setPitch(1)
      expect(fx.getPitchOctaves()).toBe(1)
      expect(fx.getPitchRatio()).toBeCloseTo(2)
    })

    it('-1 octave → ratio 0.5', () => {
      const fx = new TrackEffects()
      fx.setPitch(-1)
      expect(fx.getPitchOctaves()).toBe(-1)
      expect(fx.getPitchRatio()).toBeCloseTo(0.5)
    })

    it('+4 octaves → ratio 16', () => {
      const fx = new TrackEffects()
      fx.setPitch(4)
      expect(fx.getPitchRatio()).toBeCloseTo(16)
    })

    it('clamps above 4', () => {
      const fx = new TrackEffects()
      fx.setPitch(10)
      expect(fx.getPitchOctaves()).toBe(4)
    })

    it('clamps below -4', () => {
      const fx = new TrackEffects()
      fx.setPitch(-10)
      expect(fx.getPitchOctaves()).toBe(-4)
    })
  })

  describe('reset()', () => {
    it('clears delay buffers so process returns input again', () => {
      const fx = new TrackEffects()
      fx.setReverb(0.5)
      // Warm up
      for (let i = 0; i < 5000; i++) fx.process(0.5)
      fx.reset()
      // After reset, delay buffers are zeroed so output is pure dry/wet blend with wet=0
      // At reverb=0.5, output = input*0.5 + wet*0.5 = 0.5*0.5 + 0 = 0.25 on first sample
      const out = fx.process(0)
      expect(out).toBe(0)
    })
  })
})
