import { create } from 'zustand'
import { LooperState } from '../types'
import type { TrackSnapshot, AudioEngineConfig, EngineEvent } from '../types'
import { LoopEngine } from '../engine/LoopEngine'

interface LooperStore {
  // State
  looperState: LooperState
  tracks: TrackSnapshot[]
  masterLoopLength: number
  currentPosition: number
  masterVolume: number
  error: string | null
  canUndo: boolean
  canRedo: boolean

  // Engine reference
  engine: LoopEngine | null

  // Actions
  initializeEngine: (config?: Partial<AudioEngineConfig>) => Promise<void>
  startRecording: () => void
  stopRecording: () => void
  playAll: () => void
  stopAll: () => void
  toggleTrackMute: (trackId: string) => void
  setTrackVolume: (trackId: string, volume: number) => void
  setMasterVolume: (volume: number) => void
  undoLastTrack: () => void
  redoTrack: () => void
  latencyOffsetMs: number
  setLatencyOffset: (ms: number) => void
  dispose: () => void
}

const defaultConfig: AudioEngineConfig = {
  sampleRate: 44100,
  channelCount: 1,
}

export const useLooperStore = create<LooperStore>((set, get) => {
  const handleEngineEvent = (event: EngineEvent) => {
    switch (event.type) {
      case 'stateChange':
        set({
          looperState: event.snapshot.looperState,
          tracks: event.snapshot.tracks,
          masterLoopLength: event.snapshot.masterLoopLength,
          currentPosition: event.snapshot.currentPosition,
          error: null,
        })
        break

      case 'positionUpdate':
        set({ currentPosition: event.position })
        break

      case 'trackAdded':
        // State will be updated via the stateChange event that follows
        break

      case 'trackRemoved':
        // State will be updated via the stateChange event that follows
        break

      case 'error':
        set({ error: event.message })
        break
    }
  }

  return {
    // Initial state
    looperState: LooperState.EMPTY,
    tracks: [],
    masterLoopLength: 0,
    currentPosition: 0,
    masterVolume: 1.0,
    error: null,
    canUndo: false,
    canRedo: false,
    engine: null,

    // Actions
    initializeEngine: async (config?: Partial<AudioEngineConfig>) => {
      const mergedConfig = { ...defaultConfig, ...config }
      const engine = new LoopEngine(mergedConfig, handleEngineEvent)
      set({ engine })
      await engine.initialize()
    },

    startRecording: () => {
      void get().engine?.startRecording()
    },

    stopRecording: () => {
      get().engine?.stopRecording()
    },

    playAll: () => {
      get().engine?.playAll()
    },

    stopAll: () => {
      get().engine?.stopAll()
    },

    toggleTrackMute: (trackId: string) => {
      get().engine?.toggleTrackMute(trackId)
    },

    setTrackVolume: (trackId: string, volume: number) => {
      get().engine?.setTrackVolume(trackId, volume)
    },

    setMasterVolume: (volume: number) => {
      get().engine?.setMasterVolume(volume)
      set({ masterVolume: volume })
    },

    undoLastTrack: () => {
      get().engine?.undoLastTrack()
    },

    redoTrack: () => {
      get().engine?.redoTrack()
    },

    latencyOffsetMs: 0,

    setLatencyOffset: (ms: number) => {
      const engine = get().engine
      if (engine) {
        engine.setLatencyOffset(ms)
        set({ latencyOffsetMs: ms })
      }
    },

    dispose: () => {
      const { engine } = get()
      if (engine) {
        engine.dispose()
      }
      set({
        looperState: LooperState.EMPTY,
        tracks: [],
        masterLoopLength: 0,
        currentPosition: 0,
        masterVolume: 1.0,
        error: null,
        canUndo: false,
        canRedo: false,
        engine: null,
      })
    },
  }
})
