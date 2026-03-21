import {
  concatFloat32Arrays,
  trimBuffer,
  padBuffer,
  fitBufferToLength,
  generateWaveformPeaks,
  clamp,
  generateTrackId,
} from './audioHelpers'

describe('concatFloat32Arrays', () => {
  it('concatenates two arrays into one', () => {
    const a = new Float32Array([1, 2, 3])
    const b = new Float32Array([4, 5, 6])
    const result = concatFloat32Arrays([a, b])
    expect(result).toEqual(new Float32Array([1, 2, 3, 4, 5, 6]))
  })

  it('handles empty input array', () => {
    const result = concatFloat32Arrays([])
    expect(result).toEqual(new Float32Array([]))
  })

  it('handles single array input', () => {
    const a = new Float32Array([1, 2, 3])
    const result = concatFloat32Arrays([a])
    expect(result).toEqual(new Float32Array([1, 2, 3]))
  })

  it('preserves all values in order', () => {
    const a = new Float32Array([0.1, 0.2])
    const b = new Float32Array([0.3])
    const c = new Float32Array([0.4, 0.5])
    const result = concatFloat32Arrays([a, b, c])
    expect(result).toEqual(new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]))
  })
})

describe('trimBuffer', () => {
  it('returns first N samples', () => {
    const buffer = new Float32Array([1, 2, 3, 4, 5])
    const result = trimBuffer(buffer, 3)
    expect(result).toEqual(new Float32Array([1, 2, 3]))
  })

  it('returns original if already shorter than target', () => {
    const buffer = new Float32Array([1, 2])
    const result = trimBuffer(buffer, 5)
    expect(result).toEqual(new Float32Array([1, 2]))
  })

  it('handles target length of 0', () => {
    const buffer = new Float32Array([1, 2, 3])
    const result = trimBuffer(buffer, 0)
    expect(result).toEqual(new Float32Array([]))
  })
})

describe('padBuffer', () => {
  it('pads with zeros to target length', () => {
    const buffer = new Float32Array([1, 2])
    const result = padBuffer(buffer, 5)
    expect(result).toEqual(new Float32Array([1, 2, 0, 0, 0]))
  })

  it('returns original if already longer than target', () => {
    const buffer = new Float32Array([1, 2, 3, 4, 5])
    const result = padBuffer(buffer, 3)
    expect(result).toEqual(new Float32Array([1, 2, 3, 4, 5]))
  })

  it('preserves original samples at the start', () => {
    const buffer = new Float32Array([0.5, -0.5])
    const result = padBuffer(buffer, 4)
    expect(result[0]).toBe(0.5)
    expect(result[1]).toBe(-0.5)
    expect(result[2]).toBe(0)
    expect(result[3]).toBe(0)
  })
})

describe('fitBufferToLength', () => {
  it('trims a longer buffer', () => {
    const buffer = new Float32Array([1, 2, 3, 4, 5])
    const result = fitBufferToLength(buffer, 3)
    expect(result).toEqual(new Float32Array([1, 2, 3]))
  })

  it('pads a shorter buffer', () => {
    const buffer = new Float32Array([1, 2])
    const result = fitBufferToLength(buffer, 4)
    expect(result).toEqual(new Float32Array([1, 2, 0, 0]))
  })

  it('returns same-length buffer unchanged', () => {
    const buffer = new Float32Array([1, 2, 3])
    const result = fitBufferToLength(buffer, 3)
    expect(result).toEqual(new Float32Array([1, 2, 3]))
  })
})

describe('generateWaveformPeaks', () => {
  it('returns correct number of peaks', () => {
    const buffer = new Float32Array(1000)
    buffer.fill(0.5)
    const result = generateWaveformPeaks(buffer, 10)
    expect(result).toHaveLength(10)
  })

  it('peaks are absolute values between 0 and 1', () => {
    const buffer = new Float32Array(100)
    for (let i = 0; i < 100; i++) {
      buffer[i] = Math.sin(i) * 0.8 // values between -0.8 and 0.8
    }
    const result = generateWaveformPeaks(buffer, 10)
    result.forEach((peak) => {
      expect(peak).toBeGreaterThanOrEqual(0)
      expect(peak).toBeLessThanOrEqual(1)
    })
  })

  it('returns zeros for silent audio', () => {
    const buffer = new Float32Array(100) // defaults to all zeros
    const result = generateWaveformPeaks(buffer, 10)
    result.forEach((peak) => {
      expect(peak).toBe(0)
    })
  })

  it('handles empty buffer', () => {
    const buffer = new Float32Array(0)
    const result = generateWaveformPeaks(buffer, 10)
    expect(result).toHaveLength(10)
    result.forEach((peak) => {
      expect(peak).toBe(0)
    })
  })
})

describe('clamp', () => {
  it('returns value if within range', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5)
  })

  it('returns min if value is below', () => {
    expect(clamp(-5, 0, 1)).toBe(0)
  })

  it('returns max if value is above', () => {
    expect(clamp(10, 0, 1)).toBe(1)
  })
})

describe('generateTrackId', () => {
  it('returns a non-empty string', () => {
    const id = generateTrackId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('returns unique values on each call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateTrackId()))
    expect(ids.size).toBe(100)
  })
})
