import { useRef, useCallback, useState } from 'react'

interface KnobProps {
  value: number
  min: number
  max: number
  label: string
  unit?: string
  color?: string
  size?: number
  onChange: (value: number) => void
}

/**
 * Draws the 270° arc using two separate SVG arcs to avoid the
 * large-arc-flag flip bug at the 50% crossing.
 * Range: -135° → +135° (SVG rotation convention, 0° = 12 o'clock)
 */
function describeArc(
  cx: number, cy: number, r: number,
  startDeg: number, endDeg: number,
): string {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180
  const x1 = cx + r * Math.cos(toRad(startDeg))
  const y1 = cy + r * Math.sin(toRad(startDeg))
  const x2 = cx + r * Math.cos(toRad(endDeg))
  const y2 = cy + r * Math.sin(toRad(endDeg))
  const span = endDeg - startDeg
  const large = span > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}

export function Knob({ value, min, max, label, unit = '', size = 68, onChange }: KnobProps) {
  const [hovered, setHovered] = useState(false)
  const dragging  = useRef(false)
  const startY    = useRef(0)
  const startNorm = useRef(0)

  const norm  = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const angleDeg = -135 + norm * 270

  const CX = 50, CY = 50
  const TRACK_R = 36
  const BODY_R  = 26

  const trackPath  = describeArc(CX, CY, TRACK_R, -135, 135)
  const activePath = norm > 0.005
    ? describeArc(CX, CY, TRACK_R, -135, angleDeg)
    : null

  const uid = `k${label.replace(/\W/g, '')}`

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current  = true
    startY.current    = e.clientY
    startNorm.current = norm
    const move = (ev: MouseEvent) => {
      if (!dragging.current) return
      const n = Math.max(0, Math.min(1, startNorm.current + (startY.current - ev.clientY) / 200))
      onChange(min + n * (max - min))
    }
    const up = () => {
      dragging.current = false
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }, [norm, min, max, onChange])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    dragging.current  = true
    startY.current    = e.touches[0].clientY
    startNorm.current = norm
    const move = (ev: TouchEvent) => {
      if (!dragging.current) return
      const n = Math.max(0, Math.min(1, startNorm.current + (startY.current - ev.touches[0].clientY) / 200))
      onChange(min + n * (max - min))
    }
    const end = () => {
      dragging.current = false
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend', end)
    }
    document.addEventListener('touchmove', move, { passive: false })
    document.addEventListener('touchend', end)
  }, [norm, min, max, onChange])

  const display = Math.abs(value) < 10 ? value.toFixed(1) : Math.round(value).toString()

  return (
    <div className="knob-wrapper">
      <div
        className="knob-container"
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={() => onChange((min + max) / 2)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <svg viewBox="0 0 100 100" width={size} height={size}>
          <defs>
            <radialGradient id={uid} cx="34%" cy="27%" r="70%">
              <stop offset="0%"   stopColor="#ffffff" />
              <stop offset="45%"  stopColor="#e0e0e0" />
              <stop offset="100%" stopColor="#a8a8a8" />
            </radialGradient>
          </defs>

          {/* Track ring */}
          <path d={trackPath} fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="4" strokeLinecap="round" />

          {/* Active arc */}
          {activePath && (
            <path d={activePath} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="3" strokeLinecap="round" />
          )}

          {/* Knob body */}
          <circle cx={CX} cy={CY} r={BODY_R} fill={`url(#${uid})`} />
          <circle cx={CX} cy={CY} r={BODY_R} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
          <circle cx={CX} cy={CY} r={BODY_R - 0.5} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" />

          {/* Notch — rotates with value */}
          <g transform={`rotate(${angleDeg} ${CX} ${CY})`}>
            <rect x={CX - 2} y={CY - BODY_R + 1} width="4" height="9" rx="1.5" fill="rgba(0,0,0,0.35)" />
            <rect x={CX - 1.5} y={CY - BODY_R + 2} width="3" height="7" rx="1" fill={hovered ? '#fff' : 'rgba(40,40,40,0.7)'} />
          </g>
        </svg>

        {hovered && (
          <div className="knob-value-overlay">
            <span className="knob-value-text">{display}{unit}</span>
          </div>
        )}
      </div>
      <div className="knob-label">{label}</div>
    </div>
  )
}
