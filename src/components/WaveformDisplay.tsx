import { useRef, useEffect } from 'react'
import { TrackState } from '../types'

interface WaveformDisplayProps {
  waveformData: number[]
  state: TrackState
  currentPosition?: number // 0.0 to 1.0
}

const STATE_COLORS: Record<TrackState, string> = {
  [TrackState.PLAYING]: '#4ade80',   // green
  [TrackState.RECORDING]: '#f87171', // red
  [TrackState.MUTED]: '#6b7280',     // grey
  [TrackState.STOPPED]: '#6b7280',   // grey
}

export function WaveformDisplay({ waveformData, state, currentPosition }: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    if (waveformData.length === 0) return

    const color = STATE_COLORS[state]
    ctx.fillStyle = color

    const barWidth = width / waveformData.length
    const centerY = height / 2

    for (let i = 0; i < waveformData.length; i++) {
      const barHeight = waveformData[i] * height * 0.8
      const x = i * barWidth
      ctx.fillRect(x, centerY - barHeight / 2, Math.max(barWidth - 1, 1), barHeight || 1)
    }
  }, [waveformData, state])

  return (
    <div className={`waveform-display ${state}`} data-testid="waveform-display">
      <canvas
        ref={canvasRef}
        data-testid="waveform-canvas"
        width={400}
        height={60}
      />
      {currentPosition !== undefined && (
        <div
          className="waveform-playhead"
          data-testid="waveform-playhead"
          style={{ left: `${currentPosition * 100}%` }}
        />
      )}
    </div>
  )
}
