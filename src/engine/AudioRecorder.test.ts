import { AudioRecorder } from './AudioRecorder'
import { MIC_GET_USER_MEDIA_OPTIONS } from './micConstraints'

// Build more detailed mocks for AudioRecorder tests
function createMockAudioContext() {
  const scriptProcessorNode = {
    onaudioprocess: null as ((e: unknown) => void) | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    bufferSize: 4096,
  }

  const sourceNode = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  }

  const analyserNode = {
    fftSize: 2048,
    frequencyBinCount: 1024,
    smoothingTimeConstant: 0.3,
    getByteTimeDomainData: vi.fn(),
    getFloatTimeDomainData: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  }

  const silentGain = {
    gain: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }

  const ctx = {
    sampleRate: 44100,
    state: 'running' as string,
    destination: {},
    createScriptProcessor: vi.fn().mockReturnValue(scriptProcessorNode),
    createMediaStreamSource: vi.fn().mockReturnValue(sourceNode),
    createAnalyser: vi.fn().mockReturnValue(analyserNode),
    createGain: vi.fn().mockReturnValue(silentGain),
    close: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    // AudioWorklet mock — reject so it falls back to ScriptProcessor
    audioWorklet: {
      addModule: vi.fn().mockRejectedValue(new Error('Not supported in test')),
    },
  }

  return { ctx, scriptProcessorNode, sourceNode, analyserNode }
}

function createMockMediaStream() {
  const track = { stop: vi.fn(), kind: 'audio' }
  return {
    getTracks: vi.fn().mockReturnValue([track]),
    getAudioTracks: vi.fn().mockReturnValue([track]),
    _track: track,
  }
}

// Helper to simulate audio process events
function simulateAudioProcess(
  scriptProcessorNode: { onaudioprocess: ((e: unknown) => void) | null },
  samples: Float32Array
) {
  const event = {
    inputBuffer: {
      getChannelData: vi.fn().mockReturnValue(samples),
      numberOfChannels: 1,
    },
  }
  scriptProcessorNode.onaudioprocess?.(event)
}

describe('AudioRecorder', () => {
  let mockStream: ReturnType<typeof createMockMediaStream>

  beforeEach(() => {
    mockStream = createMockMediaStream()
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValue(
      mockStream as unknown as MediaStream
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructor', () => {
    it('creates an instance with an AudioContext', () => {
      const { ctx } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      expect(recorder).toBeDefined()
    })

    it('initializes with isRecording = false', () => {
      const { ctx } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      expect(recorder.isRecording).toBe(false)
    })
  })

  describe('requestMicAccess()', () => {
    it('requests raw mic audio without browser DSP', async () => {
      const { ctx } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      await recorder.requestMicAccess()
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(MIC_GET_USER_MEDIA_OPTIONS)
    })

    it('stores the returned MediaStream', async () => {
      const { ctx } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      await recorder.requestMicAccess()
      expect(recorder.hasStream).toBe(true)
    })

    it('throws an error if mic permission is denied', async () => {
      vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(
        new Error('Permission denied')
      )
      const { ctx } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      await expect(recorder.requestMicAccess()).rejects.toThrow('Permission denied')
    })
  })

  describe('startCapture()', () => {
    it('throws if requestMicAccess was not called first', () => {
      const { ctx } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      expect(() => recorder.startCapture()).toThrow()
    })

    it('sets isRecording to true', async () => {
      const { ctx } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      await recorder.requestMicAccess()
      recorder.startCapture()
      expect(recorder.isRecording).toBe(true)
    })

    it('creates a media stream source from the stream', async () => {
      const { ctx } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      await recorder.requestMicAccess()
      recorder.startCapture()
      expect(ctx.createMediaStreamSource).toHaveBeenCalled()
    })

    it('falls back to script processor when worklet unavailable', async () => {
      const { ctx } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      await recorder.requestMicAccess()
      recorder.startCapture()
      expect(ctx.createScriptProcessor).toHaveBeenCalled()
    })

    it('begins accumulating audio chunks', async () => {
      const { ctx, scriptProcessorNode } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      await recorder.requestMicAccess()
      recorder.startCapture()

      // Simulate some audio data coming in
      const samples = new Float32Array([0.1, 0.2, 0.3])
      simulateAudioProcess(scriptProcessorNode, samples)

      // Stop and verify we got data back
      const result = recorder.stopCapture()
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('stopCapture()', () => {
    it('sets isRecording to false', async () => {
      const { ctx } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      await recorder.requestMicAccess()
      recorder.startCapture()
      recorder.stopCapture()
      expect(recorder.isRecording).toBe(false)
    })

    it('returns a concatenated Float32Array of all recorded chunks', async () => {
      const { ctx, scriptProcessorNode } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      await recorder.requestMicAccess()
      recorder.startCapture()

      simulateAudioProcess(scriptProcessorNode, new Float32Array([0.1, 0.2]))
      simulateAudioProcess(scriptProcessorNode, new Float32Array([0.3, 0.4]))

      const result = recorder.stopCapture()
      expect(result).toEqual(new Float32Array([0.1, 0.2, 0.3, 0.4]))
    })

    it('returns an empty Float32Array if no audio was captured', async () => {
      const { ctx } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      await recorder.requestMicAccess()
      recorder.startCapture()
      const result = recorder.stopCapture()
      expect(result).toEqual(new Float32Array([]))
    })

    it('resets internal chunks array after stopping', async () => {
      const { ctx, scriptProcessorNode } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      await recorder.requestMicAccess()

      recorder.startCapture()
      simulateAudioProcess(scriptProcessorNode, new Float32Array([0.5, 0.6]))
      const first = recorder.stopCapture()
      expect(first.length).toBe(2)

      recorder.startCapture()
      simulateAudioProcess(scriptProcessorNode, new Float32Array([0.7]))
      const second = recorder.stopCapture()
      expect(second).toEqual(new Float32Array([0.7]))
    })

    it('disconnects capture nodes but keeps mic graph after stopping', async () => {
      const { ctx, sourceNode, scriptProcessorNode } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      await recorder.requestMicAccess()
      recorder.startCapture()
      recorder.stopCapture()
      expect(scriptProcessorNode.disconnect).toHaveBeenCalled()
      expect(sourceNode.disconnect).not.toHaveBeenCalled()
    })
  })

  describe('getAnalyserNode()', () => {
    it('returns the analyser node after mic access', async () => {
      const { ctx, analyserNode } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      await recorder.requestMicAccess()
      expect(recorder.getAnalyserNode()).toBe(analyserNode)
    })
  })

  describe('getInputPeakLevel()', () => {
    it('returns 0 before mic access', () => {
      const { ctx } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      expect(recorder.getInputPeakLevel()).toBe(0)
    })

    it('returns peak amplitude from analyser data', async () => {
      const { ctx, analyserNode } = createMockAudioContext()
      analyserNode.getFloatTimeDomainData = vi.fn((buf: Float32Array) => {
        buf[0] = 0.8
        buf[1] = -0.3
      })
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      await recorder.requestMicAccess()
      expect(recorder.getInputPeakLevel()).toBeCloseTo(0.8)
    })
  })

  describe('dispose()', () => {
    it('stops all MediaStream tracks', async () => {
      const { ctx } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      await recorder.requestMicAccess()
      recorder.dispose()
      expect(mockStream._track.stop).toHaveBeenCalled()
    })

    it('disconnects audio nodes if recording', async () => {
      const { ctx, sourceNode, scriptProcessorNode } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      await recorder.requestMicAccess()
      recorder.startCapture()
      recorder.dispose()
      expect(sourceNode.disconnect).toHaveBeenCalled()
      expect(scriptProcessorNode.disconnect).toHaveBeenCalled()
    })

    it('can be called safely even if never started', () => {
      const { ctx } = createMockAudioContext()
      const recorder = new AudioRecorder(ctx as unknown as AudioContext)
      expect(() => recorder.dispose()).not.toThrow()
    })
  })
})
