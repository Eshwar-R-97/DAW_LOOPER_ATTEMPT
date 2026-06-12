import { LoopEngine } from './LoopEngine'
import { LooperState, TrackState } from '../types'
import type { EngineEvent, AudioEngineConfig } from '../types'

// Mock AudioRecorder so we don't need real mic access
vi.mock('./AudioRecorder', () => {
  class MockAudioRecorder {
    isRecording = false
    hasStream = false
    private _buffer: Float32Array = new Float32Array()
    private _onFirstSample?: () => void
    private _onSamples?: (samples: Float32Array) => void
    private _firstSampleFired = false

    requestMicAccess = vi.fn(async () => {
      this.hasStream = true
    })

    startCapture = vi.fn((onFirstSample?: () => void, onSamples?: (samples: Float32Array) => void) => {
      this.isRecording = true
      this._onFirstSample = onFirstSample
      this._onSamples = onSamples
      this._firstSampleFired = false
    })

    stopCapture = vi.fn(() => {
      this.isRecording = false
      this._onFirstSample = undefined
      this._onSamples = undefined
      return this._buffer
    })

    getAnalyserNode = vi.fn().mockReturnValue(null)
    dispose = vi.fn()

    // Test helper: set what buffer stopCapture() returns
    _setBuffer(b: Float32Array) {
      this._buffer = b
    }

    // Test helper: simulate mic samples arriving during capture
    _simulateSamples(samples: Float32Array) {
      if (!this._firstSampleFired && this._onFirstSample) {
        this._onFirstSample()
        this._firstSampleFired = true
      }
      this._onSamples?.(samples)
    }
  }

  return { AudioRecorder: MockAudioRecorder }
})

const defaultConfig: AudioEngineConfig = {
  sampleRate: 44100,
  channelCount: 1,
}

// Helper to collect events
function createEventCollector() {
  const events: EngineEvent[] = []
  const handler = (event: EngineEvent) => events.push(event)
  return { events, handler }
}

// Helper: create engine, initialize, and set a fake buffer for next recording
async function createReadyEngine(
  onEvent?: (event: EngineEvent) => void,
  bufferForRecording?: Float32Array
) {
  const { handler } = createEventCollector()
  const engine = new LoopEngine(defaultConfig, onEvent ?? handler)
  await engine.initialize()

  if (bufferForRecording) {
    // Access the mock recorder to set the buffer it will return
    const recorder = (engine as unknown as { recorder: { _setBuffer: (b: Float32Array) => void } }).recorder
    recorder._setBuffer(bufferForRecording)
  }

  return engine
}

// Helper: create a buffer of a given length filled with a value
function makeBuffer(length: number, value = 0.5): Float32Array {
  const buf = new Float32Array(length)
  buf.fill(value)
  return buf
}

describe('LoopEngine', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Constructor & Initialization', () => {
    it('creates engine in EMPTY state', () => {
      const { handler } = createEventCollector()
      const engine = new LoopEngine(defaultConfig, handler)
      expect(engine.state).toBe(LooperState.EMPTY)
    })

    it('initialize() requests mic access', async () => {
      const engine = await createReadyEngine()
      const recorder = (engine as unknown as { recorder: { requestMicAccess: ReturnType<typeof vi.fn> } }).recorder
      expect(recorder.requestMicAccess).toHaveBeenCalled()
    })

    it('starts with 0 tracks', async () => {
      const engine = await createReadyEngine()
      expect(engine.trackCount).toBe(0)
    })

    it('starts with masterDuration 0', async () => {
      const engine = await createReadyEngine()
      expect(engine.masterDuration).toBe(0)
    })

    it('emits stateChange event after initialization', async () => {
      const { events, handler } = createEventCollector()
      const engine = new LoopEngine(defaultConfig, handler)
      await engine.initialize()
      const stateEvents = events.filter((e) => e.type === 'stateChange')
      expect(stateEvents.length).toBeGreaterThanOrEqual(1)
    })

    it('measures auto latency compensation on initialize', async () => {
      const engine = await createReadyEngine()
      expect(engine.autoLatencyOffsetMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('First Track Recording (Master Loop)', () => {
    it('startRecording() transitions from EMPTY to RECORDING', async () => {
      const engine = await createReadyEngine()
      engine.startRecording()
      expect(engine.state).toBe(LooperState.RECORDING)
    })

    it('startRecording() begins mic capture', async () => {
      const engine = await createReadyEngine()
      engine.startRecording()
      const recorder = (engine as unknown as { recorder: { startCapture: ReturnType<typeof vi.fn> } }).recorder
      expect(recorder.startCapture).toHaveBeenCalled()
    })

    it('stopRecording() transitions from RECORDING to PLAYING', async () => {
      const engine = await createReadyEngine(undefined, makeBuffer(44100))
      engine.startRecording()
      engine.stopRecording()
      expect(engine.state).toBe(LooperState.PLAYING)
    })

    it('stopRecording() creates an AudioTrack from recorded buffer', async () => {
      const engine = await createReadyEngine(undefined, makeBuffer(44100))
      engine.startRecording()
      engine.stopRecording()
      expect(engine.trackCount).toBe(1)
    })

    it('stopRecording() sets masterLoopLength to first tracks length', async () => {
      const engine = await createReadyEngine(undefined, makeBuffer(44100))
      engine.startRecording()
      engine.stopRecording()
      // 44100 samples at 44100 Hz = 1 second
      expect(engine.masterDuration).toBeCloseTo(1.0)
    })

    it('stopRecording() adds track to tracks array', async () => {
      const engine = await createReadyEngine(undefined, makeBuffer(44100))
      engine.startRecording()
      engine.stopRecording()
      const tracks = engine.allTracks
      expect(tracks).toHaveLength(1)
      expect(tracks[0].state).toBe(TrackState.PLAYING)
    })

    it('stopRecording() emits trackAdded event', async () => {
      const { events, handler } = createEventCollector()
      const engine = new LoopEngine(defaultConfig, handler)
      await engine.initialize()
      const recorder = (engine as unknown as { recorder: { _setBuffer: (b: Float32Array) => void } }).recorder
      recorder._setBuffer(makeBuffer(44100))

      engine.startRecording()
      engine.stopRecording()

      const trackAddedEvents = events.filter((e) => e.type === 'trackAdded')
      expect(trackAddedEvents.length).toBe(1)
    })

    it('stopRecording() emits stateChange event', async () => {
      const { events, handler } = createEventCollector()
      const engine = new LoopEngine(defaultConfig, handler)
      await engine.initialize()
      const recorder = (engine as unknown as { recorder: { _setBuffer: (b: Float32Array) => void } }).recorder
      recorder._setBuffer(makeBuffer(44100))

      events.length = 0 // clear init events
      engine.startRecording()
      engine.stopRecording()

      const stateEvents = events.filter((e) => e.type === 'stateChange')
      expect(stateEvents.length).toBeGreaterThanOrEqual(1)
    })

    it('first track has index 0', async () => {
      const engine = await createReadyEngine(undefined, makeBuffer(44100))
      engine.startRecording()
      engine.stopRecording()
      expect(engine.allTracks[0].index).toBe(0)
    })
  })

  describe('Subsequent Track Recording (Overdub)', () => {
    async function engineWithOneTrack(onEvent?: (event: EngineEvent) => void) {
      const engine = await createReadyEngine(onEvent, makeBuffer(44100))
      engine.startRecording()
      engine.stopRecording()
      return engine
    }

    it('startRecording() while PLAYING transitions to RECORDING', async () => {
      const engine = await engineWithOneTrack()
      // Set buffer for next recording
      const recorder = (engine as unknown as { recorder: { _setBuffer: (b: Float32Array) => void } }).recorder
      recorder._setBuffer(makeBuffer(44100))

      expect(engine.state).toBe(LooperState.PLAYING)
      engine.startRecording()
      expect(engine.state).toBe(LooperState.RECORDING)
    })

    it('stopRecording() trims buffer to masterLoopLength if longer', async () => {
      const engine = await engineWithOneTrack()
      const recorder = (engine as unknown as { recorder: { _setBuffer: (b: Float32Array) => void } }).recorder
      // Second recording is longer than master (88200 > 44100)
      recorder._setBuffer(makeBuffer(88200))

      engine.startRecording()
      engine.stopRecording()

      // Second track should be trimmed to match master
      const tracks = engine.allTracks
      expect(tracks).toHaveLength(2)
      // Duration should match master (1 second), not the longer buffer
      expect(tracks[1].duration).toBeCloseTo(1.0)
    })

    it('stopRecording() pads buffer with silence if shorter than masterLoopLength', async () => {
      const engine = await engineWithOneTrack()
      const recorder = (engine as unknown as { recorder: { _setBuffer: (b: Float32Array) => void } }).recorder
      // Second recording is shorter (22050 < 44100)
      recorder._setBuffer(makeBuffer(22050))

      engine.startRecording()
      engine.stopRecording()

      const tracks = engine.allTracks
      expect(tracks).toHaveLength(2)
      // Duration should be padded to match master (1 second)
      expect(tracks[1].duration).toBeCloseTo(1.0)
    })

    it('new track gets incrementing index', async () => {
      const engine = await engineWithOneTrack()
      const recorder = (engine as unknown as { recorder: { _setBuffer: (b: Float32Array) => void } }).recorder
      recorder._setBuffer(makeBuffer(44100))

      engine.startRecording()
      engine.stopRecording()

      const tracks = engine.allTracks
      expect(tracks[0].index).toBe(0)
      expect(tracks[1].index).toBe(1)
    })

    it('new track is added alongside existing tracks', async () => {
      const engine = await engineWithOneTrack()
      const recorder = (engine as unknown as { recorder: { _setBuffer: (b: Float32Array) => void } }).recorder
      recorder._setBuffer(makeBuffer(44100))

      engine.startRecording()
      engine.stopRecording()

      expect(engine.trackCount).toBe(2)
    })

    it('all tracks play after stopRecording()', async () => {
      const engine = await engineWithOneTrack()
      const recorder = (engine as unknown as { recorder: { _setBuffer: (b: Float32Array) => void } }).recorder
      recorder._setBuffer(makeBuffer(44100))

      engine.startRecording()
      engine.stopRecording()

      engine.allTracks.forEach((track) => {
        expect(track.state).toBe(TrackState.PLAYING)
      })
    })

    it('overdub keeps the last loop pass via real-time overwriting buffer', async () => {
      const loopLen = 100
      const engine = await createReadyEngine(undefined, makeBuffer(loopLen))
      engine.startRecording()
      engine.stopRecording()

      const recorder = (engine as unknown as {
        recorder: {
          _setBuffer: (b: Float32Array) => void
          _simulateSamples: (s: Float32Array) => void
        }
      }).recorder
      recorder._setBuffer(makeBuffer(loopLen * 3)) // ignored for overdub

      // Set playhead to 0 for deterministic writes; disable auto latency in unit tests
      ;(engine as unknown as { playheadPosition: number }).playheadPosition = 0
      ;(engine as unknown as { _autoLatencyOffsetMs: number })._autoLatencyOffsetMs = 0

      engine.startRecording()

      // First loop pass — distinct marker value
      const pass1 = new Float32Array(10)
      pass1.fill(0.1)
      recorder._simulateSamples(pass1)

      // Second loop pass — overwrites the same positions
      ;(engine as unknown as { playheadPosition: number }).playheadPosition = 0
      const pass2 = new Float32Array(10)
      pass2.fill(0.9)
      recorder._simulateSamples(pass2)

      engine.stopRecording()

      const track2 = (engine as unknown as {
        tracks: Array<{ getSample: (pos: number) => number }>
      }).tracks[1]
      const vol = engine.allTracks[1].volume

      // getSample applies volume²; buffer should still hold the last pass (0.9), not pass1 (0.1)
      expect(track2.getSample(0)).toBeCloseTo(0.9 * vol * vol)
      expect(track2.getSample(9)).toBeCloseTo(0.9 * vol * vol)
      expect(track2.getSample(0)).not.toBeCloseTo(0.1 * vol * vol)
    })

    it('auto-matches overdub volume to the heard backing mix', async () => {
      const loopLen = 44100
      const engine = await createReadyEngine(undefined, makeBuffer(loopLen, 0.8))
      engine.startRecording()
      engine.stopRecording()

      engine.setTrackVolume(engine.allTracks[0].id, 0.5)

      const recorder = (engine as unknown as {
        recorder: { _simulateSamples: (s: Float32Array) => void }
      }).recorder

      ;(engine as unknown as { playheadPosition: number }).playheadPosition = 0
      ;(engine as unknown as { _autoLatencyOffsetMs: number })._autoLatencyOffsetMs = 0

      engine.startRecording()
      const loud = new Float32Array(100)
      loud.fill(0.8)
      recorder._simulateSamples(loud)
      engine.stopRecording()

      // Backing plays at 0.8 * 0.5² = 0.2; raw overdub at 0.8 → volume ≈ sqrt(0.2/0.8) = 0.5
      expect(engine.allTracks[1].volume).toBeCloseTo(0.5, 1)
    })

    it('applies latency compensation while writing overdub samples', async () => {
      const loopLen = 100
      const engine = await createReadyEngine(undefined, makeBuffer(loopLen))
      engine.startRecording()
      engine.stopRecording()

      ;(engine as unknown as { _autoLatencyOffsetMs: number })._autoLatencyOffsetMs = 0
      // ~10 samples earlier at 44100 Hz
      engine.setLatencyOffset((10 * 1000) / 44100)

      const recorder = (engine as unknown as {
        recorder: { _simulateSamples: (s: Float32Array) => void }
      }).recorder

      ;(engine as unknown as { playheadPosition: number }).playheadPosition = 50
      engine.startRecording()
      recorder._simulateSamples(new Float32Array([0.8]))
      engine.stopRecording()

      const track2 = (engine as unknown as {
        tracks: Array<{ getSample: (pos: number) => number }>
      }).tracks[1]
      const vol = engine.allTracks[1].volume

      expect(track2.getSample(40)).toBeCloseTo(0.8 * vol * vol)
      expect(track2.getSample(50)).toBeCloseTo(0)
    })

    it('overdub ignores long stopCapture buffer and uses loop-length overdub buffer', async () => {
      const engine = await engineWithOneTrack()
      const recorder = (engine as unknown as {
        recorder: { _setBuffer: (b: Float32Array) => void; _simulateSamples: (s: Float32Array) => void }
      }).recorder
      recorder._setBuffer(makeBuffer(88200))

      ;(engine as unknown as { playheadPosition: number }).playheadPosition = 0
      ;(engine as unknown as { _autoLatencyOffsetMs: number })._autoLatencyOffsetMs = 0
      engine.startRecording()
      const chunk = new Float32Array(100)
      chunk.fill(0.5)
      recorder._simulateSamples(chunk)
      engine.stopRecording()

      expect(engine.allTracks[1].duration).toBeCloseTo(1.0)
      const track2 = (engine as unknown as {
        tracks: Array<{ sampleCount: number; getSample: (pos: number) => number }>
      }).tracks[1]
      expect(track2.sampleCount).toBe(44100)
      expect(track2.getSample(0)).toBeCloseTo(0.5)
    })
  })

  describe('Playback', () => {
    async function engineWithOneTrack() {
      const engine = await createReadyEngine(undefined, makeBuffer(44100))
      engine.startRecording()
      engine.stopRecording()
      return engine
    }

    it('playAll() transitions from STOPPED to PLAYING', async () => {
      const engine = await engineWithOneTrack()
      engine.stopAll()
      expect(engine.state).toBe(LooperState.STOPPED)
      engine.playAll()
      expect(engine.state).toBe(LooperState.PLAYING)
    })

    it('playAll() does nothing if already PLAYING', async () => {
      const engine = await engineWithOneTrack()
      expect(engine.state).toBe(LooperState.PLAYING)
      engine.playAll() // should not throw
      expect(engine.state).toBe(LooperState.PLAYING)
    })

    it('stopAll() transitions from PLAYING to STOPPED', async () => {
      const engine = await engineWithOneTrack()
      engine.stopAll()
      expect(engine.state).toBe(LooperState.STOPPED)
    })

    it('stopAll() resets playhead to 0', async () => {
      const engine = await engineWithOneTrack()
      engine.stopAll()
      expect(engine.currentPosition).toBe(0)
    })
  })

  describe('Track Controls', () => {
    async function engineWithTwoTracks() {
      const engine = await createReadyEngine(undefined, makeBuffer(44100))
      engine.startRecording()
      engine.stopRecording()
      const recorder = (engine as unknown as { recorder: { _setBuffer: (b: Float32Array) => void } }).recorder
      recorder._setBuffer(makeBuffer(44100, 0.3))
      engine.startRecording()
      engine.stopRecording()
      return engine
    }

    it('toggleTrackMute() mutes an unmuted track', async () => {
      const engine = await engineWithTwoTracks()
      const trackId = engine.allTracks[0].id
      engine.toggleTrackMute(trackId)
      const track = engine.allTracks.find((t) => t.id === trackId)
      expect(track?.isMuted).toBe(true)
      expect(track?.state).toBe(TrackState.MUTED)
    })

    it('toggleTrackMute() unmutes a muted track', async () => {
      const engine = await engineWithTwoTracks()
      const trackId = engine.allTracks[0].id
      engine.toggleTrackMute(trackId) // mute
      engine.toggleTrackMute(trackId) // unmute
      const track = engine.allTracks.find((t) => t.id === trackId)
      expect(track?.isMuted).toBe(false)
      expect(track?.state).toBe(TrackState.PLAYING)
    })

    it('toggleTrackMute() throws for invalid track ID', async () => {
      const engine = await engineWithTwoTracks()
      expect(() => engine.toggleTrackMute('nonexistent')).toThrow()
    })

    it('setTrackVolume() updates the tracks volume', async () => {
      const engine = await engineWithTwoTracks()
      const trackId = engine.allTracks[0].id
      engine.setTrackVolume(trackId, 0.3)
      const track = engine.allTracks.find((t) => t.id === trackId)
      expect(track?.volume).toBe(0.3)
    })

    it('setTrackVolume() clamps to valid range', async () => {
      const engine = await engineWithTwoTracks()
      const trackId = engine.allTracks[0].id
      engine.setTrackVolume(trackId, 5.0)
      const track = engine.allTracks.find((t) => t.id === trackId)
      expect(track?.volume).toBe(2.0)
    })

    it('setTrackVolume() throws for invalid track ID', async () => {
      const engine = await engineWithTwoTracks()
      expect(() => engine.setTrackVolume('nonexistent', 0.5)).toThrow()
    })

    it('setMasterVolume() updates mixer volume', async () => {
      const engine = await engineWithTwoTracks()
      engine.setMasterVolume(0.7)
      expect(engine.masterVolume).toBe(0.7)
    })
  })

  describe('Undo/Redo', () => {
    async function engineWithTwoTracks(onEvent?: (event: EngineEvent) => void) {
      const engine = await createReadyEngine(onEvent, makeBuffer(44100))
      engine.startRecording()
      engine.stopRecording()
      const recorder = (engine as unknown as { recorder: { _setBuffer: (b: Float32Array) => void } }).recorder
      recorder._setBuffer(makeBuffer(44100, 0.3))
      engine.startRecording()
      engine.stopRecording()
      return engine
    }

    it('undoLastTrack() removes the most recent track', async () => {
      const engine = await engineWithTwoTracks()
      expect(engine.trackCount).toBe(2)
      engine.undoLastTrack()
      expect(engine.trackCount).toBe(1)
    })

    it('undoLastTrack() returns the removed track snapshot', async () => {
      const engine = await engineWithTwoTracks()
      const removedTrackId = engine.allTracks[1].id
      const result = engine.undoLastTrack()
      expect(result).not.toBeNull()
      expect(result!.id).toBe(removedTrackId)
    })

    it('undoLastTrack() resets to EMPTY if last track removed', async () => {
      const engine = await createReadyEngine(undefined, makeBuffer(44100))
      engine.startRecording()
      engine.stopRecording()
      expect(engine.trackCount).toBe(1)

      engine.undoLastTrack()
      expect(engine.trackCount).toBe(0)
      expect(engine.state).toBe(LooperState.EMPTY)
    })

    it('undoLastTrack() resets masterLoopLength if last track removed', async () => {
      const engine = await createReadyEngine(undefined, makeBuffer(44100))
      engine.startRecording()
      engine.stopRecording()

      engine.undoLastTrack()
      expect(engine.masterDuration).toBe(0)
    })

    it('undoLastTrack() returns null if no tracks exist', async () => {
      const engine = await createReadyEngine()
      const result = engine.undoLastTrack()
      expect(result).toBeNull()
    })

    it('undoLastTrack() emits trackRemoved event', async () => {
      const { events, handler } = createEventCollector()
      const engine = await engineWithTwoTracks(handler)
      events.length = 0

      engine.undoLastTrack()
      const removeEvents = events.filter((e) => e.type === 'trackRemoved')
      expect(removeEvents.length).toBe(1)
    })

    it('redoTrack() re-adds the most recently undone track', async () => {
      const engine = await engineWithTwoTracks()
      const removedId = engine.allTracks[1].id
      engine.undoLastTrack()
      expect(engine.trackCount).toBe(1)

      engine.redoTrack()
      expect(engine.trackCount).toBe(2)
      expect(engine.allTracks[1].id).toBe(removedId)
    })

    it('redoTrack() returns null if nothing to redo', async () => {
      const engine = await engineWithTwoTracks()
      const result = engine.redoTrack()
      expect(result).toBeNull()
    })

    it('redoTrack() emits trackAdded event', async () => {
      const { events, handler } = createEventCollector()
      const engine = await engineWithTwoTracks(handler)
      engine.undoLastTrack()
      events.length = 0

      engine.redoTrack()
      const addEvents = events.filter((e) => e.type === 'trackAdded')
      expect(addEvents.length).toBe(1)
    })

    it('recording a new track clears the redo stack', async () => {
      const engine = await engineWithTwoTracks()
      engine.undoLastTrack() // remove track 2, can redo

      // Record a new track instead of redoing
      const recorder = (engine as unknown as { recorder: { _setBuffer: (b: Float32Array) => void } }).recorder
      recorder._setBuffer(makeBuffer(44100, 0.7))
      engine.startRecording()
      engine.stopRecording()

      // Redo should now return null since stack was cleared
      const result = engine.redoTrack()
      expect(result).toBeNull()
    })
  })

  describe('Events', () => {
    it('emits stateChange on every state transition', async () => {
      const { events, handler } = createEventCollector()
      const engine = new LoopEngine(defaultConfig, handler)
      await engine.initialize()
      const recorder = (engine as unknown as { recorder: { _setBuffer: (b: Float32Array) => void } }).recorder
      recorder._setBuffer(makeBuffer(44100))

      events.length = 0
      engine.startRecording()  // EMPTY -> RECORDING
      engine.stopRecording()   // RECORDING -> PLAYING
      engine.stopAll()         // PLAYING -> STOPPED
      engine.playAll()         // STOPPED -> PLAYING

      const stateEvents = events.filter((e) => e.type === 'stateChange')
      expect(stateEvents.length).toBeGreaterThanOrEqual(4)
    })

    it('emits trackAdded when a track is created', async () => {
      const { events, handler } = createEventCollector()
      const engine = new LoopEngine(defaultConfig, handler)
      await engine.initialize()
      const recorder = (engine as unknown as { recorder: { _setBuffer: (b: Float32Array) => void } }).recorder
      recorder._setBuffer(makeBuffer(44100))

      engine.startRecording()
      engine.stopRecording()

      const addEvents = events.filter((e) => e.type === 'trackAdded')
      expect(addEvents.length).toBe(1)
    })

    it('emits trackRemoved on undo', async () => {
      const { events, handler } = createEventCollector()
      const engine = new LoopEngine(defaultConfig, handler)
      await engine.initialize()
      const recorder = (engine as unknown as { recorder: { _setBuffer: (b: Float32Array) => void } }).recorder
      recorder._setBuffer(makeBuffer(44100))

      engine.startRecording()
      engine.stopRecording()
      events.length = 0

      engine.undoLastTrack()
      const removeEvents = events.filter((e) => e.type === 'trackRemoved')
      expect(removeEvents.length).toBe(1)
    })

    it('emits error event when startRecording called during RECORDING', async () => {
      const { events, handler } = createEventCollector()
      const engine = new LoopEngine(defaultConfig, handler)
      await engine.initialize()
      const recorder = (engine as unknown as { recorder: { _setBuffer: (b: Float32Array) => void } }).recorder
      recorder._setBuffer(makeBuffer(44100))

      engine.startRecording()
      engine.startRecording() // Already recording

      const errorEvents = events.filter((e) => e.type === 'error')
      expect(errorEvents.length).toBe(1)
    })
  })

  describe('Dispose', () => {
    it('dispose() sets state to STOPPED', async () => {
      const engine = await createReadyEngine(undefined, makeBuffer(44100))
      engine.startRecording()
      engine.stopRecording()
      engine.dispose()
      expect(engine.state).toBe(LooperState.STOPPED)
    })

    it('dispose() clears all tracks', async () => {
      const engine = await createReadyEngine(undefined, makeBuffer(44100))
      engine.startRecording()
      engine.stopRecording()
      engine.dispose()
      expect(engine.trackCount).toBe(0)
    })

    it('dispose() disposes recorder', async () => {
      const engine = await createReadyEngine()
      const recorder = (engine as unknown as { recorder: { dispose: ReturnType<typeof vi.fn> } }).recorder
      engine.dispose()
      expect(recorder.dispose).toHaveBeenCalled()
    })
  })

  describe('addTrackFromBuffer()', () => {
    it('creates a track from a Float32Array', async () => {
      const engine = await createReadyEngine()
      engine.addTrackFromBuffer(makeBuffer(44100))
      expect(engine.trackCount).toBe(1)
    })

    it('sets master loop length from first track buffer', async () => {
      const engine = await createReadyEngine()
      engine.addTrackFromBuffer(makeBuffer(22050))
      expect(engine.masterDuration).toBeCloseTo(0.5, 2)
    })

    it('transitions to PLAYING state', async () => {
      const engine = await createReadyEngine()
      engine.addTrackFromBuffer(makeBuffer(44100))
      expect(engine.state).toBe(LooperState.PLAYING)
    })

    it('trims a second buffer that is too long', async () => {
      const engine = await createReadyEngine()
      engine.addTrackFromBuffer(makeBuffer(44100))    // master = 1s
      engine.addTrackFromBuffer(makeBuffer(88200))    // 2s input
      expect(engine.allTracks[1].duration).toBeCloseTo(1.0, 2)
    })

    it('pads a second buffer that is too short', async () => {
      const engine = await createReadyEngine()
      engine.addTrackFromBuffer(makeBuffer(44100))    // master = 1s
      engine.addTrackFromBuffer(makeBuffer(22050))    // 0.5s input
      expect(engine.allTracks[1].duration).toBeCloseTo(1.0, 2)
    })

    it('emits trackAdded event', async () => {
      const { events, handler } = createEventCollector()
      const engine = new LoopEngine(defaultConfig, handler)
      await engine.initialize()
      events.length = 0
      engine.addTrackFromBuffer(makeBuffer(44100))
      const addEvents = events.filter((e) => e.type === 'trackAdded')
      expect(addEvents).toHaveLength(1)
    })

    it('clears redo stack', async () => {
      const engine = await createReadyEngine(undefined, makeBuffer(44100))
      await engine.startRecording()
      engine.stopRecording()
      engine.undoLastTrack()
      engine.addTrackFromBuffer(makeBuffer(44100))
      // Redo should have nothing — redo stack was cleared
      expect(engine.redoTrack()).toBeNull()
    })
  })

  describe('loadTrackFromUrl()', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(44100 * 4)),
      }))
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('fetches the given URL', async () => {
      const engine = await createReadyEngine()
      await engine.loadTrackFromUrl('https://proxy.test/audio.mp3')
      expect(global.fetch).toHaveBeenCalledWith('https://proxy.test/audio.mp3')
    })

    it('creates a track from the decoded buffer', async () => {
      const engine = await createReadyEngine()
      await engine.loadTrackFromUrl('https://proxy.test/audio.mp3')
      expect(engine.trackCount).toBe(1)
    })

    it('sets master loop length from loaded audio when first track', async () => {
      const engine = await createReadyEngine()
      await engine.loadTrackFromUrl('https://proxy.test/audio.mp3')
      expect(engine.masterDuration).toBeGreaterThan(0)
    })

    it('emits trackAdded event', async () => {
      const { events, handler } = createEventCollector()
      const engine = new LoopEngine(defaultConfig, handler)
      await engine.initialize()
      events.length = 0
      await engine.loadTrackFromUrl('https://proxy.test/audio.mp3')
      const addEvents = events.filter((e) => e.type === 'trackAdded')
      expect(addEvents).toHaveLength(1)
    })

    it('throws if engine not initialized', async () => {
      const { handler } = createEventCollector()
      const engine = new LoopEngine(defaultConfig, handler)
      await expect(engine.loadTrackFromUrl('https://proxy.test/audio.mp3')).rejects.toThrow('not initialized')
    })

    it('throws if fetch returns non-ok response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
      const engine = await createReadyEngine()
      await expect(engine.loadTrackFromUrl('https://proxy.test/audio.mp3')).rejects.toThrow('Failed to fetch audio')
    })

    it('fits loaded buffer to master loop length when tracks already exist', async () => {
      const engine = await createReadyEngine(undefined, makeBuffer(44100))
      await engine.startRecording()
      engine.stopRecording()
      await engine.loadTrackFromUrl('https://proxy.test/audio.mp3')
      expect(engine.trackCount).toBe(2)
      expect(engine.allTracks[1].duration).toBeCloseTo(engine.allTracks[0].duration, 1)
    })
  })
})
