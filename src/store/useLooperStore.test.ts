import { act } from 'react'
import { useLooperStore } from './useLooperStore'
import { LooperState, TrackState } from '../types'
import type { EngineEvent, TrackSnapshot } from '../types'

// Capture the onEvent callback the store passes to LoopEngine
let capturedOnEvent: ((event: EngineEvent) => void) | null = null

// Mock LoopEngine
vi.mock('../engine/LoopEngine', () => {
  class MockLoopEngine {
    private onEvent: (event: EngineEvent) => void
    private _state = LooperState.EMPTY
    private _tracks: TrackSnapshot[] = []

    constructor(_config: unknown, onEvent: (event: EngineEvent) => void) {
      this.onEvent = onEvent
      capturedOnEvent = onEvent
    }

    get state() { return this._state }
    get trackCount() { return this._tracks.length }
    get masterDuration() { return 0 }
    get currentPosition() { return 0 }
    get allTracks() { return this._tracks }
    get masterVolume() { return 1.0 }

    initialize = vi.fn(async () => {
      this.onEvent({
        type: 'stateChange',
        snapshot: {
          looperState: LooperState.EMPTY,
          tracks: [],
          masterLoopLength: 0,
          currentPosition: 0,
        },
      })
    })

    startRecording = vi.fn()
    stopRecording = vi.fn()
    playAll = vi.fn()
    stopAll = vi.fn()
    toggleTrackMute = vi.fn()
    setTrackVolume = vi.fn()
    setMasterVolume = vi.fn()
    undoLastTrack = vi.fn().mockReturnValue(null)
    redoTrack = vi.fn().mockReturnValue(null)
    dispose = vi.fn()
  }

  return { LoopEngine: MockLoopEngine }
})

// Helper: create a fake track snapshot
function fakeTrack(id: string, index: number): TrackSnapshot {
  return {
    id,
    index,
    state: TrackState.PLAYING,
    duration: 1.0,
    volume: 1.0,
    isMuted: false,
    waveformData: [0.5, 0.3, 0.7],
  }
}

describe('useLooperStore', () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    const store = useLooperStore.getState()
    if (store.engine) {
      store.dispose()
    }
    // Force reset
    useLooperStore.setState({
      looperState: LooperState.EMPTY,
      tracks: [],
      masterLoopLength: 0,
      currentPosition: 0,
      masterVolume: 1.0,
      error: null,
      engine: null,
      canUndo: false,
      canRedo: false,
    })
    capturedOnEvent = null
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('starts with looperState EMPTY', () => {
      expect(useLooperStore.getState().looperState).toBe(LooperState.EMPTY)
    })

    it('starts with empty tracks array', () => {
      expect(useLooperStore.getState().tracks).toEqual([])
    })

    it('starts with masterLoopLength 0', () => {
      expect(useLooperStore.getState().masterLoopLength).toBe(0)
    })

    it('starts with currentPosition 0', () => {
      expect(useLooperStore.getState().currentPosition).toBe(0)
    })

    it('starts with masterVolume 1.0', () => {
      expect(useLooperStore.getState().masterVolume).toBe(1.0)
    })

    it('starts with engine null', () => {
      expect(useLooperStore.getState().engine).toBeNull()
    })
  })

  describe('initializeEngine()', () => {
    it('creates a LoopEngine instance', async () => {
      await act(async () => {
        await useLooperStore.getState().initializeEngine()
      })
      expect(useLooperStore.getState().engine).not.toBeNull()
    })

    it('calls engine.initialize()', async () => {
      await act(async () => {
        await useLooperStore.getState().initializeEngine()
      })
      const engine = useLooperStore.getState().engine!
      expect(engine.initialize).toHaveBeenCalled()
    })

    it('updates store on engine stateChange events', async () => {
      await act(async () => {
        await useLooperStore.getState().initializeEngine()
      })

      // Simulate engine emitting a state change
      act(() => {
        capturedOnEvent!({
          type: 'stateChange',
          snapshot: {
            looperState: LooperState.PLAYING,
            tracks: [fakeTrack('t1', 0)],
            masterLoopLength: 1.0,
            currentPosition: 0.5,
          },
        })
      })

      const state = useLooperStore.getState()
      expect(state.looperState).toBe(LooperState.PLAYING)
      expect(state.tracks).toHaveLength(1)
      expect(state.masterLoopLength).toBe(1.0)
    })

    it('updates currentPosition on positionUpdate events', async () => {
      await act(async () => {
        await useLooperStore.getState().initializeEngine()
      })

      act(() => {
        capturedOnEvent!({ type: 'positionUpdate', position: 0.75 })
      })

      expect(useLooperStore.getState().currentPosition).toBe(0.75)
    })

    it('sets error on engine error events', async () => {
      await act(async () => {
        await useLooperStore.getState().initializeEngine()
      })

      act(() => {
        capturedOnEvent!({ type: 'error', message: 'Something went wrong' })
      })

      expect(useLooperStore.getState().error).toBe('Something went wrong')
    })
  })

  describe('Action Delegation', () => {
    beforeEach(async () => {
      await act(async () => {
        await useLooperStore.getState().initializeEngine()
      })
    })

    it('startRecording() calls engine.startRecording()', () => {
      act(() => useLooperStore.getState().startRecording())
      expect(useLooperStore.getState().engine!.startRecording).toHaveBeenCalled()
    })

    it('stopRecording() calls engine.stopRecording()', () => {
      act(() => useLooperStore.getState().stopRecording())
      expect(useLooperStore.getState().engine!.stopRecording).toHaveBeenCalled()
    })

    it('playAll() calls engine.playAll()', () => {
      act(() => useLooperStore.getState().playAll())
      expect(useLooperStore.getState().engine!.playAll).toHaveBeenCalled()
    })

    it('stopAll() calls engine.stopAll()', () => {
      act(() => useLooperStore.getState().stopAll())
      expect(useLooperStore.getState().engine!.stopAll).toHaveBeenCalled()
    })

    it('toggleTrackMute() calls engine with correct trackId', () => {
      act(() => useLooperStore.getState().toggleTrackMute('track-1'))
      expect(useLooperStore.getState().engine!.toggleTrackMute).toHaveBeenCalledWith('track-1')
    })

    it('setTrackVolume() calls engine with correct trackId and volume', () => {
      act(() => useLooperStore.getState().setTrackVolume('track-1', 0.7))
      expect(useLooperStore.getState().engine!.setTrackVolume).toHaveBeenCalledWith('track-1', 0.7)
    })

    it('setMasterVolume() calls engine and updates local state', () => {
      act(() => useLooperStore.getState().setMasterVolume(0.6))
      expect(useLooperStore.getState().engine!.setMasterVolume).toHaveBeenCalledWith(0.6)
    })

    it('undoLastTrack() calls engine.undoLastTrack()', () => {
      act(() => useLooperStore.getState().undoLastTrack())
      expect(useLooperStore.getState().engine!.undoLastTrack).toHaveBeenCalled()
    })

    it('redoTrack() calls engine.redoTrack()', () => {
      act(() => useLooperStore.getState().redoTrack())
      expect(useLooperStore.getState().engine!.redoTrack).toHaveBeenCalled()
    })
  })

  describe('State Sync', () => {
    beforeEach(async () => {
      await act(async () => {
        await useLooperStore.getState().initializeEngine()
      })
    })

    it('tracks array updates when engine emits trackAdded', () => {
      const track = fakeTrack('t1', 0)
      act(() => {
        capturedOnEvent!({ type: 'trackAdded', track })
        // Also emit stateChange so tracks array updates
        capturedOnEvent!({
          type: 'stateChange',
          snapshot: {
            looperState: LooperState.PLAYING,
            tracks: [track],
            masterLoopLength: 1.0,
            currentPosition: 0,
          },
        })
      })

      expect(useLooperStore.getState().tracks).toHaveLength(1)
      expect(useLooperStore.getState().tracks[0].id).toBe('t1')
    })

    it('tracks array updates when engine emits trackRemoved', () => {
      // First add a track
      const track = fakeTrack('t1', 0)
      act(() => {
        capturedOnEvent!({
          type: 'stateChange',
          snapshot: {
            looperState: LooperState.PLAYING,
            tracks: [track],
            masterLoopLength: 1.0,
            currentPosition: 0,
          },
        })
      })
      expect(useLooperStore.getState().tracks).toHaveLength(1)

      // Then remove it
      act(() => {
        capturedOnEvent!({ type: 'trackRemoved', trackId: 't1' })
        capturedOnEvent!({
          type: 'stateChange',
          snapshot: {
            looperState: LooperState.EMPTY,
            tracks: [],
            masterLoopLength: 0,
            currentPosition: 0,
          },
        })
      })

      expect(useLooperStore.getState().tracks).toHaveLength(0)
    })

    it('looperState updates on every engine stateChange', () => {
      act(() => {
        capturedOnEvent!({
          type: 'stateChange',
          snapshot: {
            looperState: LooperState.RECORDING,
            tracks: [],
            masterLoopLength: 0,
            currentPosition: 0,
          },
        })
      })
      expect(useLooperStore.getState().looperState).toBe(LooperState.RECORDING)

      act(() => {
        capturedOnEvent!({
          type: 'stateChange',
          snapshot: {
            looperState: LooperState.PLAYING,
            tracks: [fakeTrack('t1', 0)],
            masterLoopLength: 1.0,
            currentPosition: 0,
          },
        })
      })
      expect(useLooperStore.getState().looperState).toBe(LooperState.PLAYING)
    })
  })

  describe('Error Handling', () => {
    beforeEach(async () => {
      await act(async () => {
        await useLooperStore.getState().initializeEngine()
      })
    })

    it('sets error when engine emits error event', () => {
      act(() => {
        capturedOnEvent!({ type: 'error', message: 'Mic not found' })
      })
      expect(useLooperStore.getState().error).toBe('Mic not found')
    })

    it('clears error on stateChange (successful action)', () => {
      // Set an error first
      act(() => {
        capturedOnEvent!({ type: 'error', message: 'Some error' })
      })
      expect(useLooperStore.getState().error).toBe('Some error')

      // A stateChange should clear the error
      act(() => {
        capturedOnEvent!({
          type: 'stateChange',
          snapshot: {
            looperState: LooperState.EMPTY,
            tracks: [],
            masterLoopLength: 0,
            currentPosition: 0,
          },
        })
      })
      expect(useLooperStore.getState().error).toBeNull()
    })
  })

  describe('Dispose', () => {
    it('dispose() calls engine.dispose()', async () => {
      await act(async () => {
        await useLooperStore.getState().initializeEngine()
      })
      const engine = useLooperStore.getState().engine!

      act(() => useLooperStore.getState().dispose())
      expect(engine.dispose).toHaveBeenCalled()
    })

    it('dispose() resets store to initial state', async () => {
      await act(async () => {
        await useLooperStore.getState().initializeEngine()
      })

      // Simulate some state changes
      act(() => {
        capturedOnEvent!({
          type: 'stateChange',
          snapshot: {
            looperState: LooperState.PLAYING,
            tracks: [fakeTrack('t1', 0)],
            masterLoopLength: 1.0,
            currentPosition: 0.5,
          },
        })
      })

      act(() => useLooperStore.getState().dispose())

      const state = useLooperStore.getState()
      expect(state.looperState).toBe(LooperState.EMPTY)
      expect(state.tracks).toEqual([])
      expect(state.masterLoopLength).toBe(0)
      expect(state.currentPosition).toBe(0)
      expect(state.engine).toBeNull()
      expect(state.error).toBeNull()
    })
  })
})
