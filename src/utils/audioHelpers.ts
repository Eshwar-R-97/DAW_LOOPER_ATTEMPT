/** Concatenate multiple Float32Arrays into one */
export function concatFloat32Arrays(arrays: Float32Array[]): Float32Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Float32Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

/** Trim a buffer to a target length */
export function trimBuffer(buffer: Float32Array, targetLength: number): Float32Array {
  if (buffer.length <= targetLength) {
    return buffer
  }
  return buffer.slice(0, targetLength)
}

/** Pad a buffer with silence to reach target length */
export function padBuffer(buffer: Float32Array, targetLength: number): Float32Array {
  if (buffer.length >= targetLength) {
    return buffer
  }
  const result = new Float32Array(targetLength)
  result.set(buffer)
  return result
}

/** Trim or pad buffer to match exact target length */
export function fitBufferToLength(buffer: Float32Array, targetLength: number): Float32Array {
  if (buffer.length === targetLength) {
    return buffer
  }
  if (buffer.length > targetLength) {
    return trimBuffer(buffer, targetLength)
  }
  return padBuffer(buffer, targetLength)
}

/** Downsample an audio buffer to N peak values for waveform display */
export function generateWaveformPeaks(buffer: Float32Array, numPoints: number): number[] {
  if (buffer.length === 0) {
    return new Array(numPoints).fill(0)
  }

  const peaks: number[] = []
  const samplesPerPoint = buffer.length / numPoints

  for (let i = 0; i < numPoints; i++) {
    const start = Math.floor(i * samplesPerPoint)
    const end = Math.floor((i + 1) * samplesPerPoint)
    let peak = 0
    for (let j = start; j < end; j++) {
      const abs = Math.abs(buffer[j])
      if (abs > peak) {
        peak = abs
      }
    }
    peaks.push(peak)
  }

  return peaks
}

/** Clamp a number to a min/max range */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Soft-limit playback samples beyond ±1 to reduce harsh digital clipping. */
export function softLimit(sample: number): number {
  if (sample > 1 || sample < -1) {
    return Math.tanh(sample)
  }
  return sample
}

/** Generate a unique track ID */
let trackIdCounter = 0
export function generateTrackId(): string {
  trackIdCounter++
  return `track-${trackIdCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
