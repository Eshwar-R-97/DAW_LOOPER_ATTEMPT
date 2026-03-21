import { LooperState, TrackState } from './types'

describe('LooperState', () => {
  it('has all expected values', () => {
    expect(LooperState.EMPTY).toBe('empty')
    expect(LooperState.RECORDING).toBe('recording')
    expect(LooperState.PLAYING).toBe('playing')
    expect(LooperState.STOPPED).toBe('stopped')
  })

  it('has exactly 4 states', () => {
    const values = Object.values(LooperState)
    expect(values).toHaveLength(4)
  })
})

describe('TrackState', () => {
  it('has all expected values', () => {
    expect(TrackState.RECORDING).toBe('recording')
    expect(TrackState.PLAYING).toBe('playing')
    expect(TrackState.MUTED).toBe('muted')
    expect(TrackState.STOPPED).toBe('stopped')
  })

  it('has exactly 4 states', () => {
    const values = Object.values(TrackState)
    expect(values).toHaveLength(4)
  })
})
