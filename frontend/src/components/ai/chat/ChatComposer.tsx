import { useEffect, useRef, type CSSProperties, type FormEvent } from 'react'
import { useStore } from '../../../store'

export function ChatComposer({
  threadId,
  onSend,
}: {
  threadId: string
  onSend: (text: string) => void | Promise<void>
}) {
  const draft = useStore((s) => s.chatComposerDrafts[threadId] ?? '')
  const setDraft = useStore((s) => s.setChatComposerDraft)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const activeSceneN = useStore((s) => s.activeSceneN)
  const taRef = useRef<HTMLTextAreaElement | null>(null)

  // Auto-resize on draft change
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`
  }, [draft])

  function submit(e: FormEvent) {
    e.preventDefault()
    const v = draft.trim()
    if (!v) return
    setDraft(threadId, '')
    void onSend(v)
  }

  return (
    <form style={wrap} onSubmit={submit}>
      <div style={meta}>
        {activeSceneId
          ? `Will include scene ${activeSceneN} as context`
          : 'No active scene'}
      </div>
      <textarea
        ref={taRef}
        style={textarea}
        value={draft}
        placeholder="Ask about your story…"
        onChange={(e) => setDraft(threadId, e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            submit(e as unknown as FormEvent)
          }
        }}
        rows={2}
      />
      <button type="submit" style={sendBtn} disabled={!draft.trim()}>send</button>
    </form>
  )
}

const wrap: CSSProperties = {
  borderTop: '1px solid var(--line)',
  padding: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}
const meta: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  color: 'var(--ink-3)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}
const textarea: CSSProperties = {
  resize: 'none',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  padding: 6,
  border: '1px solid var(--line)',
  background: 'var(--paper)',
  color: 'var(--ink)',
  outline: 'none',
}
const sendBtn: CSSProperties = {
  alignSelf: 'flex-end',
  padding: '4px 12px',
  border: '1px solid var(--ink)',
  background: 'var(--ink)',
  color: 'var(--paper)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
}
