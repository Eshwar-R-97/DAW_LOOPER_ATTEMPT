import { useState } from 'react'
import type { TrackSnapshot } from '../types'
import { WaveformDisplay } from './WaveformDisplay'
import { RotaryKnob } from './RotaryKnob'
import { TrackEffectsPanel } from './TrackEffectsPanel'

interface TrackRowProps {
  track: TrackSnapshot
  onToggleMute: () => void
  onSetVolume: (volume: number) => void
  onDelete: () => void
  onSetReverb: (amount: number) => void
}

function FxIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="2" y="8" width="2" height="4" fill="currentColor" />
      <rect x="6" y="4" width="2" height="8" fill="currentColor" />
      <rect x="10" y="2" width="2" height="10" fill="currentColor" />
    </svg>
  )
}

export function TrackRow({ track, onToggleMute, onSetVolume, onDelete, onSetReverb }: TrackRowProps) {
  const [fxOpen, setFxOpen] = useState(false)

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

        <button
          className={`fx-button${fxOpen ? ' active' : ''}`}
          onClick={() => setFxOpen((o) => !o)}
          aria-label="Toggle effects"
          title="Effects"
        >
          <FxIcon />
        </button>

        <RotaryKnob
          value={track.volume}
          onChange={onSetVolume}
          label="VOL"
          size={40}
        />
      </div>

      {fxOpen && (
        <TrackEffectsPanel
          reverbAmount={track.reverbAmount}
          onSetReverb={onSetReverb}
        />
      )}
    </div>
  )
}
