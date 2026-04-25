import { useState } from 'react'
import type { DawClipSnapshot } from '../types/daw'
import { DawWaveformClip } from './DawWaveformClip'
import { DawClipEditorPanel } from './DawClipEditorPanel'

interface DawTrackRowProps {
  clip: DawClipSnapshot
  pixelsPerSecond: number
  timelineWidth: number
  containerRef: React.RefObject<HTMLDivElement | null>
  onDragEnd: (clipId: string, newStartTime: number) => void
  onDelete: (clipId: string) => void
  onSetVolume: (volume: number) => void
  onSetReverb: (amount: number) => void
  onSetPitch: (octaves: number) => void
}

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function DawTrackRow({
  clip,
  pixelsPerSecond,
  timelineWidth,
  containerRef,
  onDragEnd,
  onDelete,
  onSetVolume,
  onSetReverb,
  onSetPitch,
}: DawTrackRowProps) {
  const [editorOpen, setEditorOpen] = useState(false)

  return (
    <>
      <div className="daw-track-lane" style={{ width: timelineWidth }}>
        <div className="daw-track-label">
          <span className="daw-track-name">Track {clip.index + 1}</span>
          <button
            className={`daw-edit-btn${editorOpen ? ' active' : ''}`}
            onClick={() => setEditorOpen(o => !o)}
            title={editorOpen ? 'Close editor' : 'Edit clip'}
            aria-label="Edit clip"
          >
            <EditIcon />
          </button>
        </div>
        <div className="daw-track-clips">
          <DawWaveformClip
            clip={clip}
            pixelsPerSecond={pixelsPerSecond}
            containerRef={containerRef}
            onDragEnd={onDragEnd}
            onDelete={onDelete}
          />
        </div>
      </div>

      {editorOpen && (
        <DawClipEditorPanel
          clip={clip}
          onSetVolume={onSetVolume}
          onSetReverb={onSetReverb}
          onSetPitch={onSetPitch}
        />
      )}
    </>
  )
}
