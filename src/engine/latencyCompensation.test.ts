import { describe, expect, it } from 'vitest'
import { estimateRoundTripLatencyMs } from './latencyCompensation'

describe('estimateRoundTripLatencyMs', () => {
  it('returns 0 when all latencies are zero and buffers are zero-sized', () => {
    const ms = estimateRoundTripLatencyMs(
      { sampleRate: 44100, baseLatency: 0, outputLatency: 0 },
      { outputBufferSize: 0, inputBufferSize: 0 },
    )
    expect(ms).toBe(0)
  })

  it('sums output, input, and scheduling components', () => {
    const ms = estimateRoundTripLatencyMs(
      { sampleRate: 44100, baseLatency: 0.005, outputLatency: 0.01 },
      { outputBufferSize: 2048, inputBufferSize: 128 },
    )
    // output 15ms + input ~2.9ms + scheduling ~23.2ms
    expect(ms).toBe(41)
  })

  it('uses larger input buffer when ScriptProcessor fallback is active', () => {
    const worklet = estimateRoundTripLatencyMs(
      { sampleRate: 44100, baseLatency: 0, outputLatency: 0 },
      { outputBufferSize: 2048, inputBufferSize: 128 },
    )
    const script = estimateRoundTripLatencyMs(
      { sampleRate: 44100, baseLatency: 0, outputLatency: 0 },
      { outputBufferSize: 2048, inputBufferSize: 4096 },
    )
    expect(script).toBeGreaterThan(worklet)
  })

  it('falls back when latency properties are missing', () => {
    const ms = estimateRoundTripLatencyMs(
      { sampleRate: 48000 },
      { outputBufferSize: 1024, inputBufferSize: 128 },
    )
    // scheduling + default input quantum: (1024/48000/2 + 128/48000) * 1000 ≈ 13.4ms
    expect(ms).toBe(13)
  })
})
