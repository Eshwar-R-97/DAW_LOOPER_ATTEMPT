import { describe, expect, it } from 'vitest'
import { MIC_GET_USER_MEDIA_OPTIONS, RAW_MIC_AUDIO_CONSTRAINTS } from './micConstraints'

describe('micConstraints', () => {
  it('disables browser audio processing on the mic', () => {
    expect(RAW_MIC_AUDIO_CONSTRAINTS.echoCancellation).toBe(false)
    expect(RAW_MIC_AUDIO_CONSTRAINTS.noiseSuppression).toBe(false)
    expect(RAW_MIC_AUDIO_CONSTRAINTS.autoGainControl).toBe(false)
  })

  it('exports getUserMedia options with raw audio constraints', () => {
    expect(MIC_GET_USER_MEDIA_OPTIONS.audio).toEqual(RAW_MIC_AUDIO_CONSTRAINTS)
  })
})
