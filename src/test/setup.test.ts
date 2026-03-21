describe('Project Setup', () => {
  it('vitest is working', () => {
    expect(1 + 1).toBe(2)
  })

  it('Web Audio API mock is available', () => {
    const ctx = new AudioContext()
    expect(ctx.sampleRate).toBe(44100)
  })

  it('navigator.mediaDevices is mocked', () => {
    expect(navigator.mediaDevices.getUserMedia).toBeDefined()
  })
})
