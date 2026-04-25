import type { DawPlaybackState } from '../types/daw'

interface DawTransportBarProps {
  playbackState: DawPlaybackState
  currentPosition: number  // seconds
  onRecord: () => void
  onPlay: () => void
  onStop: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const tenths = Math.floor((seconds % 1) * 10)
  return `${m}:${String(s).padStart(2, '0')}.${tenths}`
}

export function DawTransportBar({
  playbackState,
  currentPosition,
  onRecord,
  onPlay,
  onStop,
}: DawTransportBarProps) {
  const isRecording = playbackState === 'recording'
  const isPlaying = playbackState === 'playing'

  return (
    <div className="daw-transport">
      <div className="daw-transport-buttons">
        <button
          className={`transport-btn record-btn${isRecording ? ' active' : ''}`}
          onClick={onRecord}
          aria-label={isRecording ? 'Stop recording' : 'Record'}
        >
          ●
        </button>

        <button
          className={`transport-btn play-btn${isPlaying ? ' active' : ''}`}
          onClick={onPlay}
          disabled={isRecording}
          aria-label="Play"
        >
          ▶
        </button>

        <button
          className="transport-btn stop-btn"
          onClick={onStop}
          aria-label="Stop"
        >
          ■
        </button>
      </div>

      <div className="daw-time-display">
        {formatTime(currentPosition)}
      </div>
    </div>
  )
}
