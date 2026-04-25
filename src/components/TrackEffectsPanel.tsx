import { RotaryKnob } from './RotaryKnob'

interface TrackEffectsPanelProps {
  reverbAmount: number
  onSetReverb: (amount: number) => void
}

export function TrackEffectsPanel({ reverbAmount, onSetReverb }: TrackEffectsPanelProps) {
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

      <div className="fx-effect-slot placeholder">
        <span className="fx-effect-label">PITCH</span>
        <div className="fx-placeholder-knob" />
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
