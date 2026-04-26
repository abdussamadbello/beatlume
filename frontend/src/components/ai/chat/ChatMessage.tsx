import type { CSSProperties } from 'react'
import type { ChatMessage } from '../../../types'

export function ChatMessageView({
  message,
  storyId,
  threadId,
}: {
  message: ChatMessage
  storyId: string
  threadId: string
}) {
  void storyId
  void threadId
  if (message.role === 'tool') return null
  const wrap: CSSProperties = {
    padding: 8,
    fontFamily: 'var(--font-serif)',
    fontSize: 14,
    background: message.role === 'user' ? 'var(--ink)' : 'var(--paper-2)',
    color: message.role === 'user' ? 'var(--paper)' : 'var(--ink)',
    alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
    maxWidth: '90%',
    whiteSpace: 'pre-wrap',
  }
  return <div style={wrap}>{message.content}</div>
}
