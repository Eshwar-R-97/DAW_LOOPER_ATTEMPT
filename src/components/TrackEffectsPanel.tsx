import { RotaryKnob } from './RotaryKnob'

interface TrackEffectsPanelProps {
  reverbAmount: number
  onSetReverb: (amount: number) => void
  pitchOctaves: number
  onSetPitch: (octaves: number) => void
}

function pitchLabel(octaves: number): string {
  if (octaves === 0) return '—'
  return `${octaves > 0 ? '+' : ''}${octaves.toFixed(1)} oct`
}

export function TrackEffectsPanel({ reverbAmount, onSetReverb, pitchOctaves, onSetPitch }: TrackEffectsPanelProps) {
  return (
    <div className="track-effects-panel">
      <div className="fx-effect-slot">
        <span className="fx-effect-label">REVERB</span>
        <RotaryKnob
          value={reverbAmount}
          min={0}
          max={1}
          defaultValue={0}
          onChange={onSetReverb}
          size={40}
          arcColor="#a78bfa"
        />
      </div>

      <div className="fx-effect-slot">
        <span className="fx-effect-label">PITCH</span>
        <RotaryKnob
          value={pitchOctaves}
          min={-4}
          max={4}
          defaultValue={0}
          onChange={onSetPitch}
          size={40}
          arcColor="#facc15"
        />
        <span className="fx-pitch-readout">{pitchLabel(pitchOctaves)}</span>
      </div>

      <div className="fx-effect-slot placeholder">
        <span className="fx-effect-label">SPEED</span>
        <div className="fx-placeholder-knob" />
      </div>

      <div className="fx-effect-slot placeholder">
        <span className="fx-effect-label">DELAY</span>
        <div className="fx-placeholder-knob" />
      </div>
    </div>
  )
}
