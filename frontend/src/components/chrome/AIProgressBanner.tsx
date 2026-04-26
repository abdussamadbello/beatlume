import type { CSSProperties } from 'react'
import { useStore } from '../../store'
import type { AITask } from '../../types'

const wrap: CSSProperties = {
  borderBottom: '1px solid var(--line)',
  background: 'var(--paper-2)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--ink-2)',
  padding: '8px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
}

const dot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: 'var(--blue, #06c)',
  animation: 'beatlume-pulse 1.4s ease-in-out infinite',
  flexShrink: 0,
}

const labelStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
}

const KIND_LABELS: Record<string, string> = {
  full_manuscript: 'Drafting manuscript',
  story_scaffolding: 'Generating story structure',
  insight_apply: 'Applying insight',
}

function describe(task: AITask): string {
  const base = KIND_LABELS[task.kind] ?? 'AI task'
  if (task.kind === 'full_manuscript') {
    if (task.progress_current != null && task.progress_total != null) {
      return `${base} · scene ${task.progress_current} of ${task.progress_total}`
    }
    if (task.scene_n != null) {
      return `${base} · scene ${task.scene_n}`
    }
  }
  return task.status === 'queued' ? `${base} · queued` : base
}

export function AIProgressBanner() {
  const aiTasks = useStore((s) => s.aiTasks)
  const toggleAIPanel = useStore((s) => s.toggleAIPanel)

  const tracked = aiTasks.find(
    (t) =>
      (t.status === 'queued' || t.status === 'running') &&
      (t.kind === 'full_manuscript' ||
        t.kind === 'story_scaffolding' ||
        t.kind === 'insight_apply'),
  )

  if (!tracked) return null

  return (
    <div style={wrap}>
      <span style={dot} aria-hidden />
      <span style={labelStyle}>AI</span>
      <span style={{ flex: 1 }}>{describe(tracked)}</span>
      <button
        type="button"
        onClick={toggleAIPanel}
        style={{
          background: 'transparent',
          border: '1px solid var(--line)',
          padding: '4px 10px',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
          cursor: 'pointer',
        }}
      >
        Open panel
      </button>
    </div>
  )
}
