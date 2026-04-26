import type { CSSProperties } from 'react'
import { useChatThreads } from '../../../api/chat'
import { useStore } from '../../../store'

export function ChatThreadList({ storyId }: { storyId: string }) {
  const { data, isLoading } = useChatThreads(storyId)
  const select = useStore((s) => s.setSelectedChatThreadId)

  if (isLoading) return <div style={loading}>Loading threads…</div>
  const items = data?.items ?? []
  if (items.length === 0) return null

  return (
    <ul style={list}>
      {items.map((t) => (
        <li key={t.id}>
          <button style={row} onClick={() => select(t.id)}>
            <span style={title}>{t.title ?? 'Untitled thread'}</span>
            <span style={meta}>{new Date(t.updated_at).toLocaleDateString()}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

const list: CSSProperties = { listStyle: 'none', margin: 0, padding: 0 }
const row: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  padding: '10px 16px',
  border: 'none',
  borderBottom: '1px solid var(--line-2)',
  background: 'transparent',
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'var(--font-mono)',
}
const title: CSSProperties = { fontSize: 12, color: 'var(--ink)' }
const meta: CSSProperties = { fontSize: 10, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }
const loading: CSSProperties = { padding: 16, fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }
