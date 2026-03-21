import type { TrackSnapshot } from '../types'
import { WaveformDisplay } from './WaveformDisplay'
import { RotaryKnob } from './RotaryKnob'

interface TrackRowProps {
  track: TrackSnapshot
  onToggleMute: () => void
  onSetVolume: (volume: number) => void
  onDelete: () => void
}

export function TrackRow({ track, onToggleMute, onSetVolume, onDelete }: TrackRowProps) {
  return (
    <div className={`track-row ${track.state}`}>
      <button
        className="delete-button"
        onClick={onDelete}
        aria-label={`Delete Track ${track.index + 1}`}
      >
        &times;
      </button>

      <div className="track-info">
        <span
          className={`track-state-indicator ${track.state}`}
          data-testid="track-state-indicator"
        />
        <span className="track-label" data-testid="track-label">
          Track {track.index + 1}
        </span>
      </div>

      <WaveformDisplay waveformData={track.waveformData} state={track.state} />

      <div className="track-controls">
        <button
          className={`mute-button ${track.isMuted ? 'muted' : ''}`}
          onClick={onToggleMute}
          aria-label={track.isMuted ? 'Unmute' : 'Mute'}
        >
          {track.isMuted ? 'Unmute' : 'Mute'}
        </button>

        <RotaryKnob
          value={track.volume}
          onChange={onSetVolume}
          label="VOL"
          size={40}
        />
      </div>
    </div>
  )
}
