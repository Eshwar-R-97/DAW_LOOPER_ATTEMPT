import { useCallback, useRef, useEffect } from 'react'

interface RotaryKnobProps {
  value: number
  min?: number
  max?: number
  defaultValue?: number
  size?: number
  label?: string
  arcColor?: string
  onChange: (value: number) => void
}

const START_ANGLE = 225   // bottom-left (min)
const END_ANGLE = -45     // bottom-right (max)
const ARC_SPAN = 270      // total degrees of rotation

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle)
  const end = polarToCartesian(cx, cy, r, endAngle)
  const sweep = startAngle - endAngle
  const largeArc = sweep > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

export function RotaryKnob({
  value,
  min = 0,
  max = 2.0,
  defaultValue = 1.0,
  size = 48,
  label,
  arcColor = '#3b82f6',
  onChange,
}: RotaryKnobProps) {
  const knobRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null)

  const ratio = clamp((value - min) / (max - min), 0, 1)
  const pointerAngle = START_ANGLE - ARC_SPAN * ratio
  const displayPercent = Math.round((value / max) * 200)

  const cx = size / 2
  const cy = size / 2
  const arcRadius = size / 2 - 4
  const knobRadius = size / 2 - 10
  const pointerLen = knobRadius - 4

  // Full background arc (track)
  const bgArc = describeArc(cx, cy, arcRadius, START_ANGLE, END_ANGLE)

  // Filled arc (value)
  const valueAngle = START_ANGLE - ARC_SPAN * ratio
  const filledArc = ratio > 0.001 ? describeArc(cx, cy, arcRadius, START_ANGLE, valueAngle) : ''

  // Pointer line endpoint
  const pointerEnd = polarToCartesian(cx, cy, pointerLen, pointerAngle)

  // --- Drag interaction ---
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragRef.current = { startY: e.clientY, startValue: value }

      const handleMouseMove = (me: MouseEvent) => {
        if (!dragRef.current) return
        const deltaY = dragRef.current.startY - me.clientY
        const sensitivity = me.shiftKey ? 0.001 : 0.005
        const newValue = clamp(
          dragRef.current.startValue + deltaY * sensitivity * (max - min),
          min,
          max,
        )
        onChange(newValue)
      }

      const handleMouseUp = () => {
        dragRef.current = null
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [value, min, max, onChange],
  )

  // Touch support
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0]
      dragRef.current = { startY: touch.clientY, startValue: value }

      const handleTouchMove = (te: TouchEvent) => {
        if (!dragRef.current) return
        const t = te.touches[0]
        const deltaY = dragRef.current.startY - t.clientY
        const sensitivity = 0.005
        const newValue = clamp(
          dragRef.current.startValue + deltaY * sensitivity * (max - min),
          min,
          max,
        )
        onChange(newValue)
      }

      const handleTouchEnd = () => {
        dragRef.current = null
        window.removeEventListener('touchmove', handleTouchMove)
        window.removeEventListener('touchend', handleTouchEnd)
      }

      window.addEventListener('touchmove', handleTouchMove, { passive: false })
      window.addEventListener('touchend', handleTouchEnd)
    },
    [value, min, max, onChange],
  )

  // Mouse wheel
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()
      const step = e.shiftKey ? 0.01 : 0.05
      const direction = e.deltaY < 0 ? 1 : -1
      onChange(clamp(value + direction * step * (max - min), min, max))
    },
    [value, min, max, onChange],
  )

  useEffect(() => {
    const el = knobRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Double-click to reset
  const handleDoubleClick = useCallback(() => {
    onChange(defaultValue)
  }, [defaultValue, onChange])

  // Keyboard
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 0.01 : 0.05
      const range = max - min
      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowRight':
          e.preventDefault()
          onChange(clamp(value + step * range, min, max))
          break
        case 'ArrowDown':
        case 'ArrowLeft':
          e.preventDefault()
          onChange(clamp(value - step * range, min, max))
          break
        case 'Home':
          e.preventDefault()
          onChange(min)
          break
        case 'End':
          e.preventDefault()
          onChange(max)
          break
      }
    },
    [value, min, max, onChange],
  )

  return (
    <div className="knob-container" style={{ width: size, textAlign: 'center' }}>
      <svg
        ref={knobRef}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label || 'Volume'}
        tabIndex={0}
        style={{ cursor: 'pointer', touchAction: 'none', outline: 'none' }}
      >
        {/* Background arc (track) */}
        <path
          d={bgArc}
          fill="none"
          stroke="#404040"
          strokeWidth={3}
          strokeLinecap="round"
        />

        {/* Filled arc (value) */}
        {filledArc && (
          <path
            d={filledArc}
            fill="none"
            stroke={arcColor}
            strokeWidth={3}
            strokeLinecap="round"
          />
        )}

        {/* Knob body */}
        <circle
          cx={cx}
          cy={cy}
          r={knobRadius}
          fill="url(#knobGrad)"
          stroke="#555"
          strokeWidth={1}
        />

        {/* Pointer line */}
        <line
          x1={cx}
          y1={cy}
          x2={pointerEnd.x}
          y2={pointerEnd.y}
          stroke={arcColor}
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* Radial gradient for knob body */}
        <defs>
          <radialGradient id="knobGrad" cx="40%" cy="35%">
            <stop offset="0%" stopColor="#3a3a3a" />
            <stop offset="100%" stopColor="#222222" />
          </radialGradient>
        </defs>
      </svg>

      {/* Value + label */}
      <div className="knob-label">
        <span className="knob-value">{displayPercent}%</span>
        {label && <span className="knob-name">{label}</span>}
      </div>
    </div>
  )
}
