import type { CSSProperties } from 'react'

export function ChatTab({ storyId }: { storyId: string }) {
  void storyId
  const wrap: CSSProperties = {
    padding: 16,
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--ink-3)',
  }
  return <div style={wrap}>Chat coming up.</div>
}
