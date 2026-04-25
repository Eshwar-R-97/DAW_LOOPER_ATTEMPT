import { olaShift } from './pitchShift'

function makeSine(length: number, freq: number, sampleRate = 44100): Float32Array {
  const buf = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    buf[i] = Math.sin(2 * Math.PI * freq * i / sampleRate)
  }
  return buf
}

describe('olaShift', () => {
  it('returns the same buffer reference at ratio 1.0', () => {
    const buf = new Float32Array(44100).fill(0.5)
    expect(olaShift(buf, 1.0)).toBe(buf)
  })

  it('output is the same length as input', () => {
    const buf = makeSine(44100, 440)
    expect(olaShift(buf, 2.0).length).toBe(44100)
    expect(olaShift(buf, 0.5).length).toBe(44100)
  })

  it('output is non-silent for non-silent input', () => {
    const buf = makeSine(44100, 440)
    const out = olaShift(buf, 2.0)
    const rms = Math.sqrt(out.reduce((s, x) => s + x * x, 0) / out.length)
    expect(rms).toBeGreaterThan(0.05)
  })

  it('output amplitude stays in a reasonable range', () => {
    const buf = makeSine(44100, 440)
    const out = olaShift(buf, 2.0)
    for (const s of out) {
      expect(Math.abs(s)).toBeLessThan(2.0)
    }
  })

  it('handles pitch down without throwing', () => {
    const buf = makeSine(44100, 440)
    expect(() => olaShift(buf, 0.5)).not.toThrow()
  })

  it('handles extreme ratios without throwing', () => {
    const buf = makeSine(22050, 220)
    expect(() => olaShift(buf, 16.0)).not.toThrow()
    expect(() => olaShift(buf, 1 / 16)).not.toThrow()
  })
})
