import type { CSSProperties } from 'react'
import { useChatThreads, useCreateChatThread } from '../../../api/chat'
import { useStore } from '../../../store'
import { ChatThreadList } from './ChatThreadList'
import { ChatThread } from './ChatThread'

const SUGGESTED = [
  'Find plot inconsistencies.',
  'Suggest a midpoint twist.',
  'Help me develop a character.',
]

export function ChatTab({ storyId }: { storyId: string }) {
  const { data } = useChatThreads(storyId)
  const selectedId = useStore((s) => s.selectedChatThreadId)
  const select = useStore((s) => s.setSelectedChatThreadId)
  const createThread = useCreateChatThread(storyId)

  const threads = data?.items ?? []

  // Active thread view
  if (selectedId) {
    return <ChatThread storyId={storyId} threadId={selectedId} onClose={() => select(null)} />
  }

  // Empty state
  if (threads.length === 0) {
    return (
      <div style={empty}>
        <h3 style={emptyHead}>Start a chat about this story</h3>
        <p style={emptyBody}>
          The assistant has read tools to inspect your story and proposes write changes as cards
          you approve.
        </p>
        <div style={ctaCol}>
          {SUGGESTED.map((p) => (
            <button
              key={p}
              style={cta}
              onClick={async () => {
                const t = await createThread.mutateAsync(p.slice(0, 60))
                select(t.id)
                useStore.getState().setChatComposerDraft(t.id, p)
              }}
            >
              {p}
            </button>
          ))}
          <button
            style={ctaPrimary}
            onClick={async () => {
              const t = await createThread.mutateAsync()
              select(t.id)
            }}
          >
            New blank thread
          </button>
        </div>
      </div>
    )
  }

  // Thread-list view
  return (
    <div style={listShell}>
      <button
        style={newBtn}
        onClick={async () => {
          const t = await createThread.mutateAsync()
          select(t.id)
        }}
      >
        + New thread
      </button>
      <ChatThreadList storyId={storyId} />
    </div>
  )
}

const empty: CSSProperties = { padding: 16, fontFamily: 'var(--font-mono)' }
const emptyHead: CSSProperties = {
  fontFamily: 'var(--font-serif)',
  fontWeight: 400,
  fontSize: 18,
  margin: '0 0 8px',
}
const emptyBody: CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 12,
  color: 'var(--ink-3)',
  margin: '0 0 12px',
}
const ctaCol: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 }
const cta: CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--line)',
  background: 'var(--paper)',
  color: 'var(--ink)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textAlign: 'left',
  cursor: 'pointer',
}
const ctaPrimary: CSSProperties = {
  ...cta,
  borderColor: 'var(--ink)',
  background: 'var(--ink)',
  color: 'var(--paper)',
}
const listShell: CSSProperties = { display: 'flex', flexDirection: 'column' }
const newBtn: CSSProperties = { ...cta, margin: 12, textAlign: 'center' }
