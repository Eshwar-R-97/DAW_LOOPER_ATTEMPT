import '@testing-library/jest-dom'

// Mock Web Audio API for tests
class MockAudioContext {
  sampleRate = 44100
  state = 'running' as AudioContextState
  destination = {} as AudioDestinationNode

  createGain() {
    return {
      gain: { value: 1, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }
  }

  createAnalyser() {
    return {
      fftSize: 2048,
      frequencyBinCount: 1024,
      getByteTimeDomainData: vi.fn(),
      getFloatTimeDomainData: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    }
  }

  createMediaStreamSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    }
  }

  createScriptProcessor() {
    return {
      onaudioprocess: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    }
  }

  close() {
    this.state = 'closed' as AudioContextState
    return Promise.resolve()
  }

  resume() {
    this.state = 'running' as AudioContextState
    return Promise.resolve()
  }
}

// Assign mock to global
Object.defineProperty(globalThis, 'AudioContext', {
  value: MockAudioContext,
  writable: true,
})

Object.defineProperty(globalThis, 'webkitAudioContext', {
  value: MockAudioContext,
  writable: true,
})

// Mock navigator.mediaDevices.getUserMedia
// Only override mediaDevices, not the entire navigator (React DOM needs navigator.userAgent)
if (!globalThis.navigator.mediaDevices) {
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: {},
    writable: true,
    configurable: true,
  })
}

Object.defineProperty(globalThis.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => [{ stop: vi.fn() }],
    }),
  },
  writable: true,
  configurable: true,
})
