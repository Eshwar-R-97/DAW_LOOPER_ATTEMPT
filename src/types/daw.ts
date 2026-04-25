export interface DawClipSnapshot {
  id: string
  index: number
  startTime: number      // seconds on timeline
  duration: number       // seconds
  volume: number
  isMuted: boolean
  isDeleted: boolean
  waveformData: number[]
  reverbAmount: number
  pitchOctaves: number
}

export type DawPlaybackState = 'idle' | 'playing' | 'recording' | 'stopped'

export interface DawStateSnapshot {
  playbackState: DawPlaybackState
  clips: DawClipSnapshot[]
  currentPosition: number  // seconds
  timelineLength: number   // seconds — auto: end of last clip
}
