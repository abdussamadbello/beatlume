import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  useChatMessages,
  sendChatMessageStream,
  useArchiveChatThread,
} from '../../../api/chat'
import { useStore } from '../../../store'
import type { ChatMessage } from '../../../types'
import { ChatMessageView } from './ChatMessage'
import { ChatComposer } from './ChatComposer'

export function ChatThread({
  storyId,
  threadId,
  onClose,
}: {
  storyId: string
  threadId: string
  onClose: () => void
}) {
  const { data, refetch } = useChatMessages(threadId)
  const archive = useArchiveChatThread(storyId)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const activeSceneN = useStore((s) => s.activeSceneN)
  const [streaming, setStreaming] = useState<{ id: string; content: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  // Per-thread guard so the seeded-draft auto-send fires at most once per visit.
  const sentSeedForThread = useRef<string | null>(null)

  const messages: ChatMessage[] = data?.items ?? []

  // Auto-scroll to bottom when message list or streaming bubble updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length, streaming])

  async function send(text: string) {
    // v1 ships without token-level streaming — agent yields whole assistant
    // messages on chat.message.complete. Show "thinking" placeholder until
    // either the assistant message or a tool-call-proposed event arrives.
    setStreaming({ id: 'tmp', content: '…thinking' })
    try {
      // Optimistically refetch immediately to show the user's own message in the list
      await refetch()
      for await (const ev of sendChatMessageStream(threadId, text, activeSceneId ?? null)) {
        if (ev.type === 'chat.tool.executed') {
          const toolName =
            (ev.data as { tool_name?: string } | null)?.tool_name ?? 'tool'
          setStreaming({ id: 'tmp', content: `…using ${toolName}` })
        } else if (
          ev.type === 'chat.message.complete' ||
          ev.type === 'chat.tool_call.proposed'
        ) {
          setStreaming(null)
          await refetch()
          // Bump unread if the user has the panel closed when the response lands
          const s = useStore.getState()
          if (!s.aiPanelOpen) {
            s.markChatUnread(s.unreadAssistantMessages + 1)
          }
        }
      }
    } finally {
      setStreaming(null)
      await refetch()
    }
  }

  // Auto-send a seeded composer draft on first mount of an empty thread.
  // Guarded by a ref so StrictMode double-invocation, refetch races, and
  // user retries don't fire the seed twice for the same thread visit.
  useEffect(() => {
    if (messages.length > 0) return
    if (sentSeedForThread.current === threadId) return
    const draft = useStore.getState().chatComposerDrafts[threadId]
    if (!draft || !draft.trim()) return
    sentSeedForThread.current = threadId
    useStore.getState().setChatComposerDraft(threadId, '')
    void send(draft.trim())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, messages.length])

  return (
    <div style={shell}>
      <div style={head}>
        <button style={backBtn} onClick={onClose}>← Threads</button>
        <button
          style={archiveBtn}
          onClick={async () => {
            if (!confirm('Archive this thread?')) return
            await archive.mutateAsync(threadId)
            onClose()
          }}
        >
          Archive
        </button>
      </div>
      <div style={contextBar}>
        Story-level chat
        {activeSceneId ? ` · also using scene ${activeSceneN ?? '?'} as context` : ''}
      </div>
      <div ref={scrollRef} style={stream}>
        {messages.map((m) => (
          <ChatMessageView key={m.id} message={m} storyId={storyId} threadId={threadId} />
        ))}
        {streaming && (
          <div style={streamingBubble}>
            {streaming.content}
            <span style={caret} />
          </div>
        )}
      </div>
      <ChatComposer threadId={threadId} onSend={send} />
    </div>
  )
}

const shell: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
}
const head: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 12px',
  borderBottom: '1px solid var(--line)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
}
const backBtn: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--line)',
  padding: '2px 8px',
  cursor: 'pointer',
  color: 'var(--ink-2)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
}
const archiveBtn: CSSProperties = {
  ...backBtn,
  color: 'var(--red)',
  borderColor: 'var(--line)',
}
const contextBar: CSSProperties = {
  padding: '6px 12px',
  fontSize: 10,
  color: 'var(--ink-3)',
  fontFamily: 'var(--font-mono)',
  borderBottom: '1px solid var(--line-2)',
}
const stream: CSSProperties = {
  flex: '1 1 auto',
  overflowY: 'auto',
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}
const streamingBubble: CSSProperties = {
  padding: '8px 10px',
  background: 'var(--paper-2)',
  borderLeft: '2px solid var(--blue)',
  whiteSpace: 'pre-wrap',
  fontFamily: 'var(--font-serif)',
  fontSize: 14,
  lineHeight: 1.5,
}
const caret: CSSProperties = {
  display: 'inline-block',
  width: 6,
  height: 14,
  background: 'var(--blue)',
  marginLeft: 2,
  verticalAlign: 'text-bottom',
}
