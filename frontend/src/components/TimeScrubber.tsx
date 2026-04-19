import { useRef, useCallback } from 'react'
import type { Act } from '../types'

export function TimeScrubber({
  position,
  max,
  acts,
  onChange,
  label,
}: {
  position: number
  max: number
  acts: Act[]
  onChange: (pos: number) => void
  label?: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  const positionFromEvent = useCallback((e: MouseEvent | React.MouseEvent) => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const newPos = Math.round((x / rect.width) * max)
    onChange(Math.max(0, Math.min(newPos, max)))
  }, [max, onChange])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    positionFromEvent(e)

    const handleMove = (me: MouseEvent) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const x = Math.max(0, Math.min(me.clientX - rect.left, rect.width))
      const newPos = Math.round((x / rect.width) * max)
      onChange(Math.max(0, Math.min(newPos, max)))
    }

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [max, onChange, positionFromEvent])

  const pct = max > 0 ? (position / max) * 100 : 0

  return (
    <div>
      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        style={{
          position: 'relative',
          width: '100%',
          height: 20,
          border: '1px solid var(--ink)',
          cursor: 'pointer',
          background: 'var(--paper)',
        }}
      >
        {/* Act dividers */}
        {acts.map((act) => {
          const divPct = max > 0 ? (act.at / max) * 100 : 0
          return (
            <div
              key={act.label}
              style={{
                position: 'absolute',
                left: `${divPct}%`,
                top: 0,
                bottom: 0,
                width: 0,
                borderLeft: '1px dashed var(--ink-3)',
              }}
            />
          )
        })}

        {/* Position indicator */}
        <div
          style={{
            position: 'absolute',
            left: `${pct}%`,
            top: 0,
            bottom: 0,
            width: 2,
            background: 'var(--blue)',
            transform: 'translateX(-1px)',
          }}
        />
      </div>

      {label && (
        <div style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color: 'var(--ink-3)',
          marginTop: 4,
        }}>
          {label}
        </div>
      )}
    </div>
  )
}
