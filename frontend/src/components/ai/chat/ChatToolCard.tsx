import { useState, type CSSProperties } from 'react'
import { useApplyToolCall, useRejectToolCall } from '../../../api/chat'
import { ApiError } from '../../../api/client'
import type { ChatMessage } from '../../../types'

export function ChatToolCard({ message }: { message: ChatMessage }) {
  const tc = message.tool_calls?.[0]
  const status = message.tool_call_status
  const result = (message.tool_call_result ?? {}) as Record<string, unknown>
  const apply = useApplyToolCall()
  const reject = useRejectToolCall()
  const [errBanner, setErrBanner] = useState<string | null>(null)

  if (!tc) return null

  const isPending = status === 'proposed' && errBanner === null

  return (
    <div style={card(status)}>
      <div style={head}>
        <span style={toolName}>{tc.name}</span>
        <span style={statusPill(status)}>{status ?? '?'}</span>
      </div>
      {message.content && <div style={blurb}>{message.content}</div>}
      <Preview kind={String(result.kind ?? '')} result={result} />
      {errBanner && <div style={staleBanner}>{errBanner}</div>}
      {isPending && (
        <div style={actions}>
          <button
            style={rejectBtn}
            onClick={() =>
              reject.mutate({ messageId: message.id, reason: undefined })
            }
          >
            Reject
          </button>
          <button
            style={applyBtn}
            onClick={async () => {
              setErrBanner(null)
              try {
                await apply.mutateAsync(message.id)
              } catch (err) {
                if (err instanceof ApiError && err.status === 409) {
                  setErrBanner(
                    'This preview is stale or unsupported — re-ask the assistant or use the Tasks tab.',
                  )
                } else {
                  const msg = err instanceof Error ? err.message : 'unknown error'
                  setErrBanner(`Apply failed: ${msg}`)
                }
              }
            }}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}

function Preview({
  kind,
  result,
}: {
  kind: string
  result: Record<string, unknown>
}) {
  if (kind === 'diff') {
    return <pre style={diffBox}>{String(result.diff ?? '')}</pre>
  }
  if (kind === 'scene_proposal') {
    return (
      <div style={fields}>
        <div>
          <b>Scene #{String(result.scene_n)}:</b> {String(result.title ?? '(no title)')}
        </div>
        <div style={muted}>{String(result.summary)}</div>
      </div>
    )
  }
  if (kind === 'character_note') {
    return (
      <div style={fields}>
        <div style={muted}><b>{String(result.character_name)}</b></div>
        <pre style={diffBox}>{String(result.before ?? '(empty)')}</pre>
        <div style={muted}>↓ {result.append ? 'append' : 'replace'}</div>
        <pre style={diffBox}>{String(result.after ?? '')}</pre>
      </div>
    )
  }
  if (kind === 'summary_proposal') {
    return (
      <div style={fields}>
        <div style={muted}>Current summary:</div>
        <pre style={diffBox}>{String(result.current_summary ?? '')}</pre>
        <div style={muted}>{String(result.note ?? '')}</div>
      </div>
    )
  }
  return null
}

const card = (status: string | null | undefined): CSSProperties => ({
  alignSelf: 'flex-start',
  width: '100%',
  border: '1px solid var(--line)',
  borderLeft: `3px solid ${
    status === 'applied'
      ? 'var(--green)'
      : status === 'rejected'
      ? 'var(--red)'
      : 'var(--blue)'
  }`,
  background: 'var(--paper)',
  padding: 10,
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
})
const head: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: 6,
}
const toolName: CSSProperties = { color: 'var(--ink)', fontSize: 12 }
const statusPill = (s: string | null | undefined): CSSProperties => ({
  padding: '0 6px',
  fontSize: 9,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color:
    s === 'rejected'
      ? 'var(--red)'
      : s === 'applied'
      ? 'var(--green)'
      : 'var(--blue)',
  border: `1px solid currentColor`,
})
const blurb: CSSProperties = {
  fontFamily: 'var(--font-serif)',
  fontSize: 13,
  color: 'var(--ink-2)',
  marginBottom: 8,
}
const fields: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
}
const muted: CSSProperties = { color: 'var(--ink-3)', fontSize: 10 }
const diffBox: CSSProperties = {
  margin: 0,
  padding: 6,
  background: 'var(--paper-2)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: 200,
  overflow: 'auto',
}
const actions: CSSProperties = {
  display: 'flex',
  gap: 6,
  justifyContent: 'flex-end',
  marginTop: 8,
}
const applyBtn: CSSProperties = {
  padding: '4px 10px',
  border: '1px solid var(--ink)',
  background: 'var(--ink)',
  color: 'var(--paper)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
}
const rejectBtn: CSSProperties = {
  padding: '4px 10px',
  border: '1px solid var(--line)',
  background: 'var(--paper)',
  color: 'var(--ink-2)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
}
const staleBanner: CSSProperties = {
  marginTop: 6,
  padding: 6,
  background: 'var(--paper-2)',
  borderLeft: '2px solid var(--red)',
  color: 'var(--red)',
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
}
