import type { CSSProperties } from 'react'

const container: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  minHeight: 200,
  gap: 12,
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--ink-2)',
}

export function ErrorState({ error, onRetry }: { error: Error | null; onRetry?: () => void }) {
  return (
    <div style={container}>
      <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--red)' }}>Error</div>
      <div style={{ maxWidth: 400, textAlign: 'center', lineHeight: 1.5 }}>
        {error?.message || 'Something went wrong'}
      </div>
      {onRetry && (
        <button onClick={onRetry} style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
          textTransform: 'uppercase', padding: '6px 12px', border: '1px solid var(--ink)',
          background: 'var(--paper)', cursor: 'pointer',
        }}>Retry</button>
      )}
    </div>
  )
}
