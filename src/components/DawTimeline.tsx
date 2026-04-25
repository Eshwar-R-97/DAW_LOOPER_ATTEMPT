import { useRef, useCallback } from 'react'
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
  onSetClipVolume: (clipId: string, volume: number) => void
  onSetClipReverb: (clipId: string, amount: number) => void
  onSetClipPitch: (clipId: string, octaves: number) => void
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
  onSetClipVolume,
  onSetClipReverb,
  onSetClipPitch,
}: DawTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const isDraggingPlayhead = useRef(false)

  const displayLength = Math.max(timelineLength + 2, MIN_TIMELINE_SECONDS)
  const timelineWidth = displayLength * PIXELS_PER_SECOND
  const playheadLeft = currentPosition * PIXELS_PER_SECOND

  const ticks = buildRulerTicks(displayLength)

  // Shared helper: convert a clientX to a timeline position in seconds
  const clientXToSeconds = useCallback((clientX: number): number => {
    if (!containerRef.current) return 0
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left + containerRef.current.scrollLeft - TRACK_LABEL_WIDTH
    return Math.max(0, x / PIXELS_PER_SECOND)
  }, [])

  // Ruler click — seek to clicked position (only when not dragging the playhead)
  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingPlayhead.current) return
    onSeek(clientXToSeconds(e.clientX))
  }

  // Playhead drag — move the playhead directly in the DOM for smooth 60fps,
  // then commit the final position to the store on mouseup
  const handlePlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()  // don't trigger ruler click
    isDraggingPlayhead.current = true

    const handleMouseMove = (e: MouseEvent) => {
      if (!playheadRef.current) return
      const newLeft = Math.max(0, clientXToSeconds(e.clientX)) * PIXELS_PER_SECOND
      playheadRef.current.style.left = `${newLeft + TRACK_LABEL_WIDTH}px`
    }

    const handleMouseUp = (e: MouseEvent) => {
      isDraggingPlayhead.current = false
      onSeek(clientXToSeconds(e.clientX))
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [clientXToSeconds, onSeek])

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
              onSetVolume={(volume) => onSetClipVolume(clip.id, volume)}
              onSetReverb={(amount) => onSetClipReverb(clip.id, amount)}
              onSetPitch={(octaves) => onSetClipPitch(clip.id, octaves)}
            />
          ))}

          {clips.length === 0 && (
            <div className="daw-empty-state">
              Hit REC to record your first clip
            </div>
          )}
        </div>

        {/* Playhead — draggable; also click the ruler to jump */}
        <div
          ref={playheadRef}
          className="daw-playhead"
          style={{ left: playheadLeft + TRACK_LABEL_WIDTH }}
          onMouseDown={handlePlayheadMouseDown}
        />
      </div>
    </div>
  )
}
