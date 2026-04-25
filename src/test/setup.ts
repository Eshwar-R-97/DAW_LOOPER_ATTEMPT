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

  createBuffer(_channels: number, length: number, sampleRate: number): AudioBuffer {
    return {
      numberOfChannels: 1,
      length,
      sampleRate,
      getChannelData: vi.fn(() => new Float32Array(length)),
      copyToChannel: vi.fn(),
    } as unknown as AudioBuffer
  }

  createConvolver() {
    return {
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    }
  }

  decodeAudioData(_arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return Promise.resolve({
      numberOfChannels: 1,
      length: 44100,
      sampleRate: 44100,
      getChannelData: vi.fn(() => new Float32Array(44100).fill(0.1)),
      copyToChannel: vi.fn(),
    } as unknown as AudioBuffer)
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

class MockOfflineAudioContext {
  constructor(
    public numberOfChannels: number,
    public length: number,
    public sampleRate: number
  ) {}

  createBuffer(_ch: number, len: number, rate: number): AudioBuffer {
    return {
      numberOfChannels: 1,
      length: len,
      sampleRate: rate,
      getChannelData: vi.fn(() => new Float32Array(len)),
      copyToChannel: vi.fn(),
    } as unknown as AudioBuffer
  }

  createBufferSource() {
    return {
      buffer: null as AudioBuffer | null,
      connect: vi.fn(),
      start: vi.fn(),
    }
  }

  startRendering(): Promise<AudioBuffer> {
    return Promise.resolve({
      numberOfChannels: 1,
      length: this.length,
      sampleRate: this.sampleRate,
      getChannelData: vi.fn(() => new Float32Array(this.length).fill(0.1)),
      copyToChannel: vi.fn(),
    } as unknown as AudioBuffer)
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
Object.defineProperty(globalThis, 'OfflineAudioContext', {
  value: MockOfflineAudioContext,
  writable: true,
  configurable: true,
})

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
