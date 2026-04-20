import type { CSSProperties } from 'react'

const container: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  minHeight: 200,
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--ink-3)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return <div style={container}>{label}</div>
}
