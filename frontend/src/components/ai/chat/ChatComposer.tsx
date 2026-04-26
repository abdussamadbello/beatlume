import { useState, type CSSProperties } from 'react'

export function ChatComposer({
  threadId,
  onSend,
}: {
  threadId: string
  onSend: (text: string) => void | Promise<void>
}) {
  void threadId
  const [text, setText] = useState('')
  const wrap: CSSProperties = {
    padding: 8,
    borderTop: '1px solid var(--line)',
    display: 'flex',
    gap: 8,
  }
  return (
    <form
      style={wrap}
      onSubmit={(e) => {
        e.preventDefault()
        const v = text.trim()
        if (!v) return
        setText('')
        void onSend(v)
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ flex: 1, padding: 6, fontFamily: 'var(--font-sans)', fontSize: 13 }}
        placeholder="Ask about your story…"
      />
      <button type="submit" style={{ padding: '4px 12px', cursor: 'pointer' }}>send</button>
    </form>
  )
}
