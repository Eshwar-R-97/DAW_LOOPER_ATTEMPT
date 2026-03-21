interface LoopProgressBarProps {
  currentPosition: number // 0.0 to 1.0
  isPlaying: boolean
}

export function LoopProgressBar({ currentPosition, isPlaying }: LoopProgressBarProps) {
  const widthPercent = Math.round(currentPosition * 100)

  return (
    <div
      className={`loop-progress-bar${isPlaying ? ' active' : ''}`}
      role="progressbar"
      aria-valuenow={widthPercent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="loop-progress-fill"
        data-testid="progress-fill"
        style={{ width: `${widthPercent}%` }}
      />
    </div>
  )
}
