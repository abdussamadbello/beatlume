import type { CSSProperties } from 'react'
import type { ChatMessage } from '../../../types'

export function ChatToolCard({ message }: { message: ChatMessage }) {
  const wrap: CSSProperties = {
    padding: 8,
    border: '1px dashed var(--line)',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
  }
  return (
    <div style={wrap}>
      tool card: {message.tool_calls?.[0]?.name} — {message.tool_call_status}
    </div>
  )
}
