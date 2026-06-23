import { useEffect, useState } from 'react'
import { useLooperStore } from '../store/useLooperStore'

const HOT_THRESHOLD = 0.95

export function InputLevelMeter() {
  const engine = useLooperStore((s) => s.engine)
  const [level, setLevel] = useState(0)

  useEffect(() => {
    if (!engine) return

    let frameId = 0
    const tick = () => {
      setLevel(engine.getInputPeakLevel())
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [engine])

  const percent = Math.min(100, Math.round(level * 100))
  const isHot = level >= HOT_THRESHOLD

  return (
    <div className="input-level-meter" aria-label="Microphone input level">
      <span className="input-level-label">INPUT</span>
      <div className="input-level-track" role="meter" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`input-level-fill${isHot ? ' input-level-fill--hot' : ''}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {isHot && <span className="input-level-warning">Hot — back off mic</span>}
    </div>
  )
}
