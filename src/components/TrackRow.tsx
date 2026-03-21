import type { TrackSnapshot } from '../types'
import { WaveformDisplay } from './WaveformDisplay'

interface TrackRowProps {
  track: TrackSnapshot
  onToggleMute: () => void
  onSetVolume: (volume: number) => void
}

export function TrackRow({ track, onToggleMute, onSetVolume }: TrackRowProps) {
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSetVolume(Number(e.target.value) / 100)
  }

  const volumePercent = Math.round(track.volume * 100 / 2) // 0–2 mapped to 0%–100%

  return (
    <div className={`track-row ${track.state}`}>
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

        <span className="volume-label">{volumePercent}%</span>
        <input
          type="range"
          className="volume-slider"
          min={0}
          max={200}
          value={Math.round(track.volume * 100)}
          onChange={handleVolumeChange}
          aria-label="Volume"
        />
      </div>
    </div>
  )
}
