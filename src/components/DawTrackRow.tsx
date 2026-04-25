import type { DawClipSnapshot } from '../types/daw'
import { DawWaveformClip } from './DawWaveformClip'

interface DawTrackRowProps {
  clip: DawClipSnapshot
  pixelsPerSecond: number
  timelineWidth: number
  containerRef: React.RefObject<HTMLDivElement | null>
  onDragEnd: (clipId: string, newStartTime: number) => void
  onDelete: (clipId: string) => void
}

export function DawTrackRow({
  clip,
  pixelsPerSecond,
  timelineWidth,
  containerRef,
  onDragEnd,
  onDelete,
}: DawTrackRowProps) {
  return (
    <div className="daw-track-lane" style={{ width: timelineWidth }}>
      <div className="daw-track-label">Track {clip.index + 1}</div>
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
  )
}
