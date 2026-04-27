import { useEffect, useState, type CSSProperties } from 'react'

const dotPulse: CSSProperties = {
  display: 'inline-block',
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: 'currentColor',
  animation: 'beatlume-pulse 1.4s ease-in-out infinite',
  flexShrink: 0,
  verticalAlign: 'middle',
}

const FRAMES = ['·  ', '·· ', '···', ' ··', '  ·', '   ']

/**
 * Ticker spinner: a tiny rotating ASCII dot pattern. Calmer than a CSS rotate(),
 * matches the mono-font typographic aesthetic.
 */
function Ticker({ color }: { color?: string }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const handle = window.setInterval(() => {
      setI((prev) => (prev + 1) % FRAMES.length)
    }, 120)
    return () => window.clearInterval(handle)
  }, [])
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: '2.4ch',
        fontFamily: 'var(--font-mono)',
        color: color ?? 'currentColor',
        letterSpacing: 0,
        textAlign: 'left',
      }}
    >
      {FRAMES[i]}
    </span>
  )
}

/**
 * Spinner — inline loading indicator.
 *
 * Variants:
 *   - 'pulse' (default): slow dot pulse. Use for queued / waiting states.
 *   - 'ticker': rotating ASCII dots. Use for active streaming / running states.
 */
export function Spinner({
  variant = 'pulse',
  color,
}: {
  variant?: 'pulse' | 'ticker'
  color?: string
}) {
  if (variant === 'ticker') return <Ticker color={color} />
  return <span aria-hidden style={{ ...dotPulse, ...(color ? { background: color } : {}) }} />
}
