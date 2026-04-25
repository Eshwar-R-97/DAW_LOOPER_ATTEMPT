import { useRef } from 'react'
import type { DawClipSnapshot, DawPlaybackState } from '../types/daw'
import { DawTrackRow } from './DawTrackRow'

interface DawTimelineProps {
  clips: DawClipSnapshot[]
  playbackState: DawPlaybackState
  currentPosition: number   // seconds
  timelineLength: number    // seconds
  onMoveClip: (clipId: string, startTime: number) => void
  onDeleteClip: (clipId: string) => void
  onSeek: (seconds: number) => void
}

const PIXELS_PER_SECOND = 100
const MIN_TIMELINE_SECONDS = 10  // always show at least 10s
const TRACK_LABEL_WIDTH = 72     // px reserved for track label on left

function buildRulerTicks(totalSeconds: number): { time: number; label: boolean }[] {
  const ticks: { time: number; label: boolean }[] = []
  const step = totalSeconds > 60 ? 5 : 1
  for (let t = 0; t <= totalSeconds; t += step) {
    ticks.push({ time: t, label: true })
    if (step === 5) {
      for (let sub = t + 1; sub < t + step && sub <= totalSeconds; sub++) {
        ticks.push({ time: sub, label: false })
      }
    }
  }
  return ticks
}

export function DawTimeline({
  clips,
  playbackState: _playbackState,
  currentPosition,
  timelineLength,
  onMoveClip,
  onDeleteClip,
  onSeek,
}: DawTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const displayLength = Math.max(timelineLength + 2, MIN_TIMELINE_SECONDS)
  const timelineWidth = displayLength * PIXELS_PER_SECOND
  const playheadLeft = currentPosition * PIXELS_PER_SECOND

  const ticks = buildRulerTicks(displayLength)

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left + containerRef.current.scrollLeft - TRACK_LABEL_WIDTH
    const seconds = Math.max(0, x / PIXELS_PER_SECOND)
    onSeek(seconds)
  }

  return (
    <div className="daw-timeline-wrapper">
      <div className="daw-timeline-container" ref={containerRef}>
        {/* Ruler — click to seek */}
        <div
          className="daw-ruler"
          style={{ width: timelineWidth + TRACK_LABEL_WIDTH }}
          onClick={handleRulerClick}
        >
          <div className="daw-ruler-label-gap" style={{ width: TRACK_LABEL_WIDTH }} />
          <div className="daw-ruler-ticks" style={{ width: timelineWidth }}>
            {ticks.map(({ time, label }) => (
              <div
                key={time}
                className={`daw-tick${label ? ' major' : ''}`}
                style={{ left: time * PIXELS_PER_SECOND }}
              >
                {label && <span className="daw-tick-label">{time}s</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Track lanes */}
        <div className="daw-lanes" style={{ width: timelineWidth + TRACK_LABEL_WIDTH }}>
          {clips.map(clip => (
            <DawTrackRow
              key={clip.id}
              clip={clip}
              pixelsPerSecond={PIXELS_PER_SECOND}
              timelineWidth={timelineWidth}
              containerRef={containerRef}
              onDragEnd={onMoveClip}
              onDelete={onDeleteClip}
            />
          ))}

          {clips.length === 0 && (
            <div className="daw-empty-state">
              Hit REC to record your first clip
            </div>
          )}
        </div>

        {/* Playhead — sits over everything */}
        <div
          className="daw-playhead"
          style={{ left: playheadLeft + TRACK_LABEL_WIDTH }}
        />
      </div>
    </div>
  )
}
