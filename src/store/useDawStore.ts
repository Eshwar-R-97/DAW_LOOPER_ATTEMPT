import { create } from 'zustand'
import { DawEngine } from '../engine/DawEngine'
import type { AudioEngineConfig, EngineEvent } from '../types'
import type { DawClipSnapshot, DawPlaybackState } from '../types/daw'

interface DawStore {
  playbackState: DawPlaybackState
  clips: DawClipSnapshot[]
  currentPosition: number
  timelineLength: number
  masterVolume: number
  error: string | null
  engine: DawEngine | null

  initializeEngine: (config?: Partial<AudioEngineConfig>) => Promise<void>
  play: () => void
  stop: () => void
  seekTo: (seconds: number) => void
  startRecording: () => void
  stopRecording: () => void
  moveClip: (clipId: string, startTime: number) => void
  deleteClip: (clipId: string) => void
  setClipVolume: (clipId: string, volume: number) => void
  toggleClipMute: (clipId: string) => void
  setClipReverb: (clipId: string, amount: number) => void
  setClipPitch: (clipId: string, octaves: number) => void
  setMasterVolume: (volume: number) => void
  dispose: () => void
}

const defaultConfig: AudioEngineConfig = { sampleRate: 44100, channelCount: 1 }

export const useDawStore = create<DawStore>((set, get) => {
  const handleEngineEvent = (event: EngineEvent) => {
    switch (event.type) {
      case 'stateChange': {
        // DawEngine emits stateChange with a DawStateSnapshot cast as never
        const snap = event.snapshot as never as import('../types/daw').DawStateSnapshot
        set({
          playbackState: snap.playbackState,
          clips: snap.clips,
          currentPosition: snap.currentPosition,
          timelineLength: snap.timelineLength,
          error: null,
        })
        break
      }
      case 'positionUpdate':
        set({ currentPosition: event.position })
        break
      case 'error':
        set({ error: event.message })
        break
    }
  }

  return {
    playbackState: 'idle',
    clips: [],
    currentPosition: 0,
    timelineLength: 0,
    masterVolume: 1.0,
    error: null,
    engine: null,

    initializeEngine: async (config?) => {
      const merged = { ...defaultConfig, ...config }
      const engine = new DawEngine(merged, handleEngineEvent)
      set({ engine })
      await engine.initialize()
    },

    play: () => { get().engine?.play() },
    stop: () => { get().engine?.stop() },
    seekTo: (seconds) => { get().engine?.seekTo(seconds) },
    startRecording: () => { void get().engine?.startRecording() },
    stopRecording: () => { get().engine?.stopRecording() },

    moveClip: (clipId, startTime) => {
      const engine = get().engine
      if (!engine) return
      const samples = Math.round(startTime * 44100)
      engine.moveClip(clipId, samples)
    },

    deleteClip: (clipId) => { get().engine?.deleteClip(clipId) },
    setClipVolume: (clipId, volume) => { get().engine?.setClipVolume(clipId, volume) },
    toggleClipMute: (clipId) => { get().engine?.toggleClipMute(clipId) },
    setClipReverb: (clipId, amount) => { get().engine?.setClipReverb(clipId, amount) },
    setClipPitch: (clipId, octaves) => { get().engine?.setClipPitch(clipId, octaves) },

    setMasterVolume: (volume) => {
      get().engine?.setMasterVolume(volume)
      set({ masterVolume: volume })
    },

    dispose: () => {
      get().engine?.dispose()
      set({
        playbackState: 'idle',
        clips: [],
        currentPosition: 0,
        timelineLength: 0,
        masterVolume: 1.0,
        error: null,
        engine: null,
      })
    },
  }
})
