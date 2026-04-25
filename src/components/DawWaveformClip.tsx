import { useRef, useCallback } from 'react'
import type { DawClipSnapshot } from '../types/daw'

interface DawWaveformClipProps {
  clip: DawClipSnapshot
  pixelsPerSecond: number
  containerRef: React.RefObject<HTMLDivElement | null>
  onDragEnd: (clipId: string, newStartTime: number) => void
  onDelete: (clipId: string) => void
}

export function DawWaveformClip({
  clip,
  pixelsPerSecond,
  containerRef,
  onDragEnd,
  onDelete,
}: DawWaveformClipProps) {
  const left = clip.startTime * pixelsPerSecond
  const width = Math.max(clip.duration * pixelsPerSecond, 4)
  const dragOffsetRef = useRef(0)
  const isDraggingRef = useRef(false)
  const currentLeftRef = useRef(left)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('clip-delete-btn')) return
    e.preventDefault()
    isDraggingRef.current = true
    currentLeftRef.current = left
    dragOffsetRef.current = e.clientX - (containerRef.current?.getBoundingClientRect().left ?? 0) - left

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return
      const containerLeft = containerRef.current.getBoundingClientRect().left
      const newLeft = Math.max(0, e.clientX - containerLeft - dragOffsetRef.current)
      currentLeftRef.current = newLeft
      // Move the element directly for smooth drag
      const el = document.getElementById(`clip-${clip.id}`)
      if (el) el.style.left = `${newLeft}px`
    }

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      const newStartTime = currentLeftRef.current / pixelsPerSecond
      onDragEnd(clip.id, newStartTime)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [clip.id, left, pixelsPerSecond, containerRef, onDragEnd])

  // Draw waveform bars
  const bars = clip.waveformData
  const barCount = Math.min(bars.length, Math.floor(width / 2))
  const step = bars.length / barCount

  return (
    <div
      id={`clip-${clip.id}`}
      className={`daw-clip${clip.isMuted ? ' muted' : ''}`}
      style={{ left, width }}
      onMouseDown={handleMouseDown}
    >
      <div className="clip-waveform">
        {Array.from({ length: barCount }, (_, i) => {
          const amp = bars[Math.floor(i * step)] ?? 0
          return (
            <div
              key={i}
              className="clip-waveform-bar"
              style={{ height: `${Math.max(2, amp * 100)}%` }}
            />
          )
        })}
      </div>
      <button
        className="clip-delete-btn"
        onClick={(e) => { e.stopPropagation(); onDelete(clip.id) }}
        aria-label="Delete clip"
      >
        ×
      </button>
    </div>
  )
}
