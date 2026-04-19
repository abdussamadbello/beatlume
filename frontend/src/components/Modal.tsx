import type { ReactNode } from 'react'

export function Modal({
  open,
  onClose,
  width = 600,
  children,
}: {
  open: boolean
  onClose: () => void
  width?: number
  children: ReactNode
}) {
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(26,29,36,0.35)',
        }}
      />

      {/* Dialog */}
      <div
        style={{
          position: 'relative',
          width,
          maxWidth: '96%',
          background: 'var(--paper)',
          border: '2px solid var(--ink)',
          boxShadow: '8px 8px 0 var(--ink)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
