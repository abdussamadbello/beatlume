import type { CSSProperties } from 'react'

export function ChatThread({
  storyId,
  threadId,
  onClose,
}: {
  storyId: string
  threadId: string
  onClose: () => void
}) {
  void storyId
  const wrap: CSSProperties = { padding: 16, fontFamily: 'var(--font-mono)', fontSize: 11 }
  return (
    <div style={wrap}>
      <button onClick={onClose} style={{ marginBottom: 12, cursor: 'pointer' }}>← Threads</button>
      <div>Thread {threadId} — full UI in next task.</div>
    </div>
  )
}
