/** The current state of the overall looper */
export enum LooperState {
  EMPTY = 'empty',
  RECORDING = 'recording',
  PLAYING = 'playing',
  STOPPED = 'stopped',
}

/** The state of an individual track */
export enum TrackState {
  RECORDING = 'recording',
  PLAYING = 'playing',
  MUTED = 'muted',
  STOPPED = 'stopped',
}

/** Lightweight track info for the store (no raw audio buffer) */
export interface TrackSnapshot {
  id: string
  index: number
  state: TrackState
  duration: number
  volume: number
  isMuted: boolean
  isDeleted: boolean
  waveformData: number[]
}

/** Configuration for the audio engine */
export interface AudioEngineConfig {
  sampleRate: number
  channelCount: number
  inputDeviceId?: string
}

/** Snapshot of engine state emitted to the store */
export interface EngineStateSnapshot {
  looperState: LooperState
  tracks: TrackSnapshot[]
  masterLoopLength: number
  currentPosition: number
}

/** Events emitted by the engine to notify the store of changes */
export type EngineEvent =
  | { type: 'stateChange'; snapshot: EngineStateSnapshot }
  | { type: 'positionUpdate'; position: number }
  | { type: 'trackAdded'; track: TrackSnapshot }
  | { type: 'trackRemoved'; trackId: string }
  | { type: 'error'; message: string }
