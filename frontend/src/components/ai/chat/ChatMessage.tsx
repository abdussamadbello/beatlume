import type { CSSProperties } from 'react'
import type { ChatMessage } from '../../../types'
import { ChatToolCard } from './ChatToolCard'

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

  // Pure tool messages (read-tool results) are not rendered — the AI consumed them already.
  if (message.role === 'tool') return null

  // Assistant messages with tool calls render as approval cards (proposed/applied/rejected)
  if (
    message.role === 'assistant' &&
    message.tool_call_status &&
    message.tool_calls &&
    message.tool_calls.length > 0
  ) {
    return <ChatToolCard message={message} />
  }

  return (
    <div style={message.role === 'user' ? userBubble : assistantBubble}>
      {message.content}
    </div>
  )
}

const userBubble: CSSProperties = {
  alignSelf: 'flex-end',
  maxWidth: '85%',
  padding: '8px 10px',
  background: 'var(--ink)',
  color: 'var(--paper)',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
}

const assistantBubble: CSSProperties = {
  alignSelf: 'flex-start',
  maxWidth: '95%',
  padding: '8px 10px',
  background: 'var(--paper-2)',
  borderLeft: '2px solid var(--blue)',
  color: 'var(--ink)',
  fontFamily: 'var(--font-serif)',
  fontSize: 14,
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap',
}
