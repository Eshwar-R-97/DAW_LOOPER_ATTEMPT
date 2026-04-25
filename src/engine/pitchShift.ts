// OLA pitch shift: time-stretch to pitchRatio × length, then resample back.
// Preserves loop tempo while changing pitch.
//
// Grain size 512 (~11.6ms at 44100Hz), 75% overlap — better transient
// preservation than larger grains, critical for beatbox/percussive content.

const GRAIN_SIZE = 512
const HOP_SIZE = 128  // 75% overlap

// Pre-computed once — Hann window with 75% overlap satisfies COLA (sums to 1.0)
const HANN_WINDOW = ((): Float32Array => {
  const w = new Float32Array(GRAIN_SIZE)
  for (let i = 0; i < GRAIN_SIZE; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (GRAIN_SIZE - 1)))
  }
  return w
})()

function timeStretch(input: Float32Array, stretchFactor: number): Float32Array {
  const outputLength = Math.round(input.length * stretchFactor)
  const output = new Float32Array(outputLength)
  const weights = new Float32Array(outputLength)
  const N = input.length

  // Extend loop range by one full grain margin on each side so that the first
  // and last samples accumulate the same number of overlapping grains as the
  // middle — without this, edge weights are near zero and dividing by them
  // amplifies floating-point noise into audible static.
  const margin = GRAIN_SIZE - HOP_SIZE
  for (let writePos = -margin; writePos < outputLength + margin; writePos += HOP_SIZE) {
    // Proportionally map the grain centre in the output back to the source.
    // This uniform mapping is what keeps the full content present at any ratio.
    const writeCenter = writePos + GRAIN_SIZE / 2
    const readCenter = (writeCenter / outputLength) * N
    const readStart = readCenter - GRAIN_SIZE / 2

    for (let i = 0; i < GRAIN_SIZE; i++) {
      const outIdx = writePos + i
      if (outIdx < 0 || outIdx >= outputLength) continue

      // Linear interpolation inside each grain (fine at this scale)
      const srcPos = readStart + i
      const srcFloor = Math.floor(srcPos)
      const frac = srcPos - srcFloor
      const idx = ((srcFloor % N) + N) % N   // safe modulo for negative srcFloor
      const next = (idx + 1) % N

      output[outIdx] += (input[idx] * (1 - frac) + input[next] * frac) * HANN_WINDOW[i]
      weights[outIdx] += HANN_WINDOW[i]
    }
  }

  // Normalise by accumulated window weight. Threshold of 0.5 means we only
  // normalise where grains fully overlap; below that we zero rather than
  // amplify noise (the margin extension above makes this only affect samples
  // beyond the buffer bounds, which can't happen with our loop range).
  for (let i = 0; i < outputLength; i++) {
    output[i] = weights[i] >= 0.5 ? output[i] / weights[i] : 0
  }

  return output
}

function resampleTo(input: Float32Array, targetLength: number): Float32Array {
  if (input.length === targetLength) return input

  const output = new Float32Array(targetLength)
  const N = input.length
  const ratio = (N - 1) / (targetLength - 1 || 1)

  for (let i = 0; i < targetLength; i++) {
    const srcPos = i * ratio
    const b = Math.floor(srcPos)
    const t = srcPos - b

    // Catmull-Rom cubic interpolation — significantly less aliasing than
    // linear at high compression ratios (2:1, 4:1), which is where linear
    // interp causes the intermodulation that makes layered tracks break apart.
    const p0 = input[Math.max(b - 1, 0)]
    const p1 = input[b]
    const p2 = input[Math.min(b + 1, N - 1)]
    const p3 = input[Math.min(b + 2, N - 1)]

    output[i] = p1 + 0.5 * t * (
      p2 - p0 + t * (
        2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)
      )
    )
  }

  return output
}

export function olaShift(buffer: Float32Array, pitchRatio: number): Float32Array {
  if (pitchRatio === 1.0) return buffer

  // Step 1: spread/compress content to pitchRatio × original length (same pitch, different duration)
  const stretched = timeStretch(buffer, pitchRatio)

  // Step 2: resample back to original length (restores tempo, shifts pitch)
  return resampleTo(stretched, buffer.length)
}
