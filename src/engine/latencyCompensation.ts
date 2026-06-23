/** Minimal AudioContext surface needed for latency estimation. */
export interface LatencyAudioContext {
  sampleRate: number
  baseLatency?: number
  outputLatency?: number
}

export interface LatencyEstimateOptions {
  /** ScriptProcessor / mix callback buffer size (samples). */
  outputBufferSize: number
  /** Mic capture quantum: 128 for AudioWorklet, larger for ScriptProcessor fallback. */
  inputBufferSize: number
}

const DEFAULT_OUTPUT_BUFFER_SIZE = 2048
const DEFAULT_INPUT_BUFFER_SIZE = 128

/**
 * Estimate round-trip monitoring latency for overdub sync (milliseconds).
 *
 * User performs in time with heard playback, but the engine playhead is ahead of
 * what reaches the speakers and mic samples arrive after input buffering. Positive
 * values mean overdub audio should be placed earlier in the loop.
 */
export function estimateRoundTripLatencyMs(
  context: LatencyAudioContext,
  options: Partial<LatencyEstimateOptions> = {},
): number {
  const outputBufferSize = options.outputBufferSize ?? DEFAULT_OUTPUT_BUFFER_SIZE
  const inputBufferSize = options.inputBufferSize ?? DEFAULT_INPUT_BUFFER_SIZE
  const sampleRate = context.sampleRate || 44100

  const baseLatency = context.baseLatency ?? 0
  const outputLatency = context.outputLatency ?? 0

  // Output path: internal + device buffering before the user hears the mix.
  const outputMs = (baseLatency + outputLatency) * 1000

  // Input path: capture quantum (AudioWorklet) or ScriptProcessor block.
  const inputMs = (inputBufferSize / sampleRate) * 1000

  // Output scheduling: playhead advances in outputBufferSize chunks; audible center
  // of the last rendered block is roughly half a buffer behind the playhead.
  const schedulingMs = (outputBufferSize / sampleRate / 2) * 1000

  return Math.round(outputMs + inputMs + schedulingMs)
}
