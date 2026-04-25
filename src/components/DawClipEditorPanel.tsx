import { RotaryKnob } from './RotaryKnob'
import type { DawClipSnapshot } from '../types/daw'

interface DawClipEditorPanelProps {
  clip: DawClipSnapshot
  onSetVolume: (volume: number) => void
  onSetReverb: (amount: number) => void
  onSetPitch: (octaves: number) => void
}

function pitchLabel(octaves: number): string {
  if (octaves === 0) return '—'
  return `${octaves > 0 ? '+' : ''}${octaves.toFixed(1)} oct`
}

function ScissorsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="4" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="4" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="6.5" y1="5.5" x2="14" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6.5" y1="10.5" x2="14" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function SpliceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="5" width="5" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10" y="5" width="5" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <line x1="6" y1="8" x2="10" y2="8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1" />
    </svg>
  )
}

function TrimIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="5" width="14" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <line x1="4" y1="3" x2="4" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="3" x2="12" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function DawClipEditorPanel({ clip, onSetVolume, onSetReverb, onSetPitch }: DawClipEditorPanelProps) {
  return (
    <div className="daw-clip-editor">

      {/* Effects section */}
      <div className="daw-editor-section">
        <span className="daw-editor-section-label">Effects</span>
        <div className="daw-editor-slots">
          <div className="daw-editor-slot">
            <span className="daw-editor-slot-label">VOL</span>
            <RotaryKnob
              value={clip.volume}
              min={0}
              max={2}
              defaultValue={1}
              onChange={onSetVolume}
              size={40}
              arcColor="#4ade80"
            />
          </div>

          <div className="daw-editor-slot">
            <span className="daw-editor-slot-label">REVERB</span>
            <RotaryKnob
              value={clip.reverbAmount}
              min={0}
              max={1}
              defaultValue={0}
              onChange={onSetReverb}
              size={40}
              arcColor="#a78bfa"
            />
          </div>

          <div className="daw-editor-slot">
            <span className="daw-editor-slot-label">PITCH</span>
            <RotaryKnob
              value={clip.pitchOctaves}
              min={-4}
              max={4}
              defaultValue={0}
              onChange={onSetPitch}
              size={40}
              arcColor="#facc15"
            />
            <span className="daw-editor-pitch-readout">{pitchLabel(clip.pitchOctaves)}</span>
          </div>
        </div>
      </div>

      <div className="daw-editor-divider" />

      {/* Editing section — placeholders until implemented */}
      <div className="daw-editor-section">
        <span className="daw-editor-section-label">Editing</span>
        <div className="daw-editor-slots">
          <div className="daw-editor-slot">
            <button className="daw-editor-action-btn" disabled title="Coming soon">
              <ScissorsIcon />
              <span>CUT</span>
            </button>
          </div>

          <div className="daw-editor-slot">
            <button className="daw-editor-action-btn" disabled title="Coming soon">
              <SpliceIcon />
              <span>SPLICE</span>
            </button>
          </div>

          <div className="daw-editor-slot">
            <button className="daw-editor-action-btn" disabled title="Coming soon">
              <TrimIcon />
              <span>TRIM</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
