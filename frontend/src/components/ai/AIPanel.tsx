import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useStore } from '../../store'
import { useStory } from '../../api/stories'
import {
  useTriggerGenerateManuscript,
  useTriggerInsights,
  useTriggerProseContinue,
  useTriggerRelationships,
  useTriggerScaffold,
  useTriggerSummarize,
} from '../../api/ai'
import type { AITask, AITaskKind, AITaskStatus } from '../../types'

const PANEL_WIDTH = 360

const kindLabels: Record<AITaskKind, string> = {
  insight_generation: 'Insight analysis',
  insight_apply: 'Apply insight',
  prose_continuation: 'Prose continuation',
  relationship_inference: 'Relationship inference',
  scene_summarization: 'Scene summary',
  story_scaffolding: 'Story scaffold',
  full_manuscript: 'Full draft (all scenes)',
}

function routeForKind(kind: AITaskKind, storyId: string): string {
  switch (kind) {
    case 'insight_generation': return `/stories/${storyId}/ai`
    case 'insight_apply': return `/stories/${storyId}/draft`
    case 'prose_continuation': return `/stories/${storyId}/draft`
    case 'relationship_inference': return `/stories/${storyId}/graph`
    case 'scene_summarization': return `/stories/${storyId}/scenes`
    case 'story_scaffolding': return `/stories/${storyId}`
    case 'full_manuscript': return `/stories/${storyId}/draft`
  }
}

const statusGlyph: Record<AITaskStatus, string> = {
  queued: '◌',
  running: '◐',
  completed: '●',
  error: '!',
}

const statusColor: Record<AITaskStatus, string> = {
  queued: 'var(--ink-3)',
  running: 'var(--blue)',
  completed: 'var(--green)',
  error: 'var(--red)',
}

function formatRelative(ms: number, nowMs: number): string {
  const delta = Math.max(0, Math.floor((nowMs - ms) / 1000))
  if (delta < 60) return `${delta}s`
  if (delta < 3600) return `${Math.floor(delta / 60)}m`
  return `${Math.floor(delta / 3600)}h`
}

function useTick(intervalMs: number, enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs, enabled])
  return now
}

const launcherBase: CSSProperties = {
  position: 'fixed',
  right: 16,
  bottom: 16,
  zIndex: 40,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  border: '1px solid var(--ink)',
  background: 'var(--ink)',
  color: 'var(--paper)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
}

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 18,
  height: 18,
  padding: '0 5px',
  background: 'var(--paper)',
  color: 'var(--ink)',
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
}

export function AILauncher() {
  const aiTasks = useStore((s) => s.aiTasks)
  const aiPanelOpen = useStore((s) => s.aiPanelOpen)
  const aiPanelLastSeenAt = useStore((s) => s.aiPanelLastSeenAt)
  const toggleAIPanel = useStore((s) => s.toggleAIPanel)

  const activeCount = aiTasks.filter((t) => t.status === 'queued' || t.status === 'running').length
  const unseenCount = aiTasks.filter(
    (t) => (t.status === 'completed' || t.status === 'error') && (t.completed_at ?? 0) > aiPanelLastSeenAt,
  ).length
  const totalNotice = activeCount + unseenCount

  if (aiPanelOpen) return null

  return (
    <button style={launcherBase} onClick={toggleAIPanel} aria-label="Open AI tasks">
      <span>AI</span>
      {totalNotice > 0 && <span style={badgeStyle}>{totalNotice}</span>}
    </button>
  )
}

const panelShell: CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: PANEL_WIDTH,
  background: 'var(--paper)',
  borderLeft: '1px solid var(--line)',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 50,
  fontFamily: 'var(--font-mono)',
}

const panelHead: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid var(--line)',
  fontSize: 10,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
}

const headTitle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  color: 'var(--ink)',
}

const closeBtn: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--line)',
  color: 'var(--ink-2)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  padding: '2px 8px',
  cursor: 'pointer',
}

const sectionHead: CSSProperties = {
  padding: '10px 16px 4px',
  fontSize: 9,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
}

const empty: CSSProperties = {
  padding: 16,
  fontSize: 11,
  color: 'var(--ink-3)',
  fontFamily: 'var(--font-sans)',
}

const row: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '16px 1fr auto',
  alignItems: 'baseline',
  gap: 10,
  padding: '8px 16px',
  borderTop: '1px solid var(--line-2)',
  fontSize: 11,
}

const rowMain: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
}

const rowKind: CSSProperties = {
  color: 'var(--ink)',
  fontSize: 12,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const rowMeta: CSSProperties = {
  color: 'var(--ink-3)',
  fontSize: 10,
  letterSpacing: '0.04em',
}

const rowError: CSSProperties = {
  color: 'var(--red)',
  fontSize: 10,
  fontFamily: 'var(--font-sans)',
  marginTop: 2,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const rowTime: CSSProperties = {
  color: 'var(--ink-3)',
  fontSize: 10,
  fontVariantNumeric: 'tabular-nums',
}

const footer: CSSProperties = {
  marginTop: 'auto',
  padding: '10px 16px',
  borderTop: '1px solid var(--line)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 10,
  color: 'var(--ink-3)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const clearBtn: CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--line)',
  color: 'var(--ink-2)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  padding: '4px 8px',
  cursor: 'pointer',
}

const list: CSSProperties = {
  overflowY: 'auto',
  flex: '1 1 auto',
}

const runBtn: CSSProperties = {
  flex: 1,
  padding: '8px 10px',
  border: '1px solid var(--ink)',
  background: 'var(--paper)',
  color: 'var(--ink)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
}

const runBtnDisabled: CSSProperties = {
  ...runBtn,
  background: 'var(--paper-2)',
  color: 'var(--ink-3)',
  borderColor: 'var(--line)',
  cursor: 'not-allowed',
}

const runBtnDanger: CSSProperties = {
  ...runBtn,
  borderColor: 'var(--red)',
  color: 'var(--red)',
}

const rowClickable: CSSProperties = {
  cursor: 'pointer',
}

const streamingBlock: CSSProperties = {
  margin: '0 16px 10px',
  padding: '10px 12px',
  background: 'var(--paper-2)',
  border: '1px solid var(--line)',
  borderLeft: '2px solid var(--blue)',
  fontFamily: 'var(--font-serif)',
  fontSize: 14,
  lineHeight: 1.55,
  color: 'var(--ink)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: 240,
  overflowY: 'auto',
}

const streamingCaret: CSSProperties = {
  display: 'inline-block',
  width: 6,
  height: 14,
  background: 'var(--blue)',
  verticalAlign: 'text-bottom',
  marginLeft: 2,
}

const streamingMeta: CSSProperties = {
  padding: '2px 16px 8px',
  fontSize: 9,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
  fontFamily: 'var(--font-mono)',
}

const runRowLabel: CSSProperties = {
  padding: '10px 16px 2px',
  fontSize: 9,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
}

const runGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
  padding: '0 16px 12px',
}

function statusLabel(task: AITask, now: number): string {
  if (task.status === 'queued') return 'Queued'
  if (task.status === 'running') {
    const run = `Running ${formatRelative(task.started_at, now)}`
    if (task.kind === 'full_manuscript' && task.progress_total) {
      const w = `${task.progress_current ?? 0}/${task.progress_total} scenes`
      const n = task.scene_n != null ? ` · #${task.scene_n}` : ''
      return `${run} · ${w}${n}`
    }
    return run
  }
  if (task.status === 'completed') {
    const at = task.completed_at ?? task.started_at
    if (task.kind === 'full_manuscript' && task.manuscript_scenes_targeted != null) {
      const targeted = task.manuscript_scenes_targeted
      const written = task.manuscript_scenes_written ?? 0
      const skipped = task.manuscript_scenes_skipped ?? Math.max(0, targeted - written)
      if (targeted > 0 && written === 0) {
        return skipped >= targeted
          ? `Finished — no new prose (${skipped} scene(s) already had draft; "skip non-empty" is on)`
          : `Finished — wrote 0 of ${targeted} (${skipped} skipped)`
      }
      if (targeted > 0 && written > 0) {
        return `Done ${formatRelative(at, now)} ago · wrote ${written}/${targeted} scene(s)${skipped > 0 ? ` (${skipped} skipped)` : ''}`
      }
    }
    return `Done ${formatRelative(at, now)} ago`
  }
  const at = task.completed_at ?? task.started_at
  return `Failed ${formatRelative(at, now)} ago`
}

/** Right column: avoid "0s" for instant completes; show run length when we have both timestamps. */
function taskRowDurationOrAge(task: AITask, now: number): string {
  if (task.status === 'completed' && task.completed_at != null) {
    const d = task.completed_at - task.started_at
    if (d >= 0 && d < 2000) return 'instant'
    if (d >= 2000 && d < 60_000) return `${Math.round(d / 1000)}s run`
    if (d >= 60_000 && d < 3600_000) return `${Math.round(d / 60000)}m run`
    if (d >= 3600_000) return `${Math.round(d / 3_600_000)}h run`
  }
  if (task.status === 'error' && task.completed_at != null) {
    return formatRelative(task.completed_at, now)
  }
  return formatRelative(task.started_at, now)
}

function TaskRow({ task, now, onOpen }: { task: AITask; now: number; onOpen?: () => void }) {
  const interactive = Boolean(onOpen)
  const showStream = task.status === 'running' && task.streaming_text
  const showFinal = task.status === 'completed' && task.streaming_text
  const streamRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!showStream) return
    const el = streamRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [task.streaming_text, showStream])

  return (
    <>
      <div
        style={{ ...row, ...(interactive ? rowClickable : {}) }}
        onClick={onOpen}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') onOpen?.() } : undefined}
      >
        <span style={{ color: statusColor[task.status], fontSize: 13, lineHeight: 1 }}>
          {statusGlyph[task.status]}
        </span>
        <div style={rowMain}>
          <span style={rowKind}>{kindLabels[task.kind] ?? task.kind}</span>
          <span style={rowMeta}>{statusLabel(task, now)}</span>
          {task.error && <span style={rowError} title={task.error}>{task.error}</span>}
        </div>
        <span style={rowTime}>{taskRowDurationOrAge(task, now)}</span>
      </div>
      {(showStream || showFinal) && (
        <>
          {showStream && (
            <div style={streamingMeta}>
              Streaming · {task.chunk_count ?? 0} chunks
            </div>
          )}
          <div ref={streamRef} style={streamingBlock}>
            {task.streaming_text}
            {showStream && <span style={streamingCaret} />}
          </div>
        </>
      )}
    </>
  )
}

export function AIPanel({ storyId }: { storyId: string }) {
  const aiTasks = useStore((s) => s.aiTasks)
  const aiPanelOpen = useStore((s) => s.aiPanelOpen)
  const setAIPanelOpen = useStore((s) => s.setAIPanelOpen)
  const clearCompletedAITasks = useStore((s) => s.clearCompletedAITasks)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const activeSceneN = useStore((s) => s.activeSceneN)
  const navigate = useNavigate()
  const { data: story } = useStory(storyId)
  const triggerInsights = useTriggerInsights(storyId)
  const triggerRelationships = useTriggerRelationships(storyId)
  const triggerProse = useTriggerProseContinue(storyId)
  const triggerSummarize = useTriggerSummarize(storyId)
  const triggerScaffold = useTriggerScaffold(storyId)
  const triggerManuscript = useTriggerGenerateManuscript(storyId)

  const hasActive = useMemo(
    () => aiTasks.some((t) => t.status === 'queued' || t.status === 'running'),
    [aiTasks],
  )
  const hasStreaming = useMemo(
    () => aiTasks.some((t) => t.status === 'running' && t.streaming_text),
    [aiTasks],
  )
  const now = useTick(hasStreaming ? 200 : 1000, aiPanelOpen && hasActive)

  const insightsBusy = aiTasks.some(
    (t) =>
      (t.kind === 'insight_generation' || t.kind === 'insight_apply') &&
      (t.status === 'queued' || t.status === 'running'),
  )
  const relationshipsBusy = aiTasks.some(
    (t) => t.kind === 'relationship_inference' && (t.status === 'queued' || t.status === 'running'),
  )
  const scaffoldBusy = aiTasks.some(
    (t) => t.kind === 'story_scaffolding' && (t.status === 'queued' || t.status === 'running'),
  )
  const manuscriptBusy = aiTasks.some(
    (t) => t.kind === 'full_manuscript' && (t.status === 'queued' || t.status === 'running'),
  )
  const proseBusyForScene = aiTasks.some(
    (t) => t.kind === 'prose_continuation' && t.scene_id === activeSceneId && (t.status === 'queued' || t.status === 'running'),
  )
  const summaryBusyForScene = aiTasks.some(
    (t) => t.kind === 'scene_summarization' && t.scene_id === activeSceneId && (t.status === 'queued' || t.status === 'running'),
  )

  if (!aiPanelOpen) return null

  const active = aiTasks.filter((t) => t.status === 'queued' || t.status === 'running')
  const recent = aiTasks.filter((t) => t.status === 'completed' || t.status === 'error')
  const completedCount = recent.length

  const openTask = (task: AITask) => {
    navigate({ to: routeForKind(task.kind, storyId) })
  }

  const sceneLabel = activeSceneId ? `scene ${activeSceneN}` : 'no scene active'
  const proseDisabled = !activeSceneId || proseBusyForScene
  const summaryDisabled = !activeSceneId || summaryBusyForScene

  return (
    <aside style={panelShell} aria-label="AI task panel">
      <div style={panelHead}>
        <span style={headTitle}>
          <span>AI</span>
          <span style={{ color: 'var(--ink-3)', fontSize: 10 }}>tasks</span>
        </span>
        <button style={closeBtn} onClick={() => setAIPanelOpen(false)} aria-label="Close AI panel">
          ×
        </button>
      </div>

      <div style={runRowLabel}>Story-wide</div>
      <div style={runGrid}>
        <button
          style={insightsBusy ? runBtnDisabled : runBtn}
          disabled={insightsBusy}
          onClick={() => triggerInsights.mutate()}
        >
          {insightsBusy ? 'Insights running' : 'Generate insights'}
        </button>
        <button
          style={relationshipsBusy ? runBtnDisabled : runBtn}
          disabled={relationshipsBusy}
          onClick={() => triggerRelationships.mutate()}
        >
          {relationshipsBusy ? 'Relations running' : 'Infer relations'}
        </button>
      </div>

      <div style={runRowLabel}>Structure & full draft</div>
      <div style={runGrid}>
        <button
          style={!story || scaffoldBusy ? runBtnDisabled : runBtn}
          disabled={!story || scaffoldBusy}
          onClick={() => {
            if (!story) return
            triggerScaffold.mutate({
              premise: [story.title, story.logline].filter((x) => x?.trim()).join('\n\n') || story.title,
              structure_type: story.structure_type,
              target_words: story.target_words,
              genres: story.genres,
              characters: [],
              replace_existing: false,
            })
          }}
        >
          {scaffoldBusy ? 'Scaffolding…' : 'Story structure'}
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
          <button
            style={!story || manuscriptBusy ? runBtnDisabled : runBtn}
            disabled={!story || manuscriptBusy}
            title="Skips scenes that already have draft text."
            onClick={() => triggerManuscript.mutate({ skip_non_empty: true })}
          >
            {manuscriptBusy ? 'Drafting…' : 'Fill empty scenes'}
          </button>
          <button
            style={!story || manuscriptBusy ? runBtnDisabled : runBtnDanger}
            disabled={!story || manuscriptBusy}
            title="Runs AI for every scene and replaces existing draft text. Confirms before starting."
            onClick={() => {
              if (
                !window.confirm(
                  'Regenerate prose for every scene? Existing draft text will be overwritten. This uses a lot of tokens.',
                )
              ) {
                return
              }
              triggerManuscript.mutate({ skip_non_empty: false })
            }}
          >
            {manuscriptBusy ? 'Drafting…' : 'Regenerate all'}
          </button>
        </div>
      </div>

      <div style={runRowLabel}>Scene · {sceneLabel}</div>
      <div style={runGrid}>
        <button
          style={proseDisabled ? runBtnDisabled : runBtn}
          disabled={proseDisabled}
          onClick={() => activeSceneId && triggerProse.mutate(activeSceneId)}
          title={activeSceneId ? '' : 'Open the Draft view to set an active scene'}
        >
          {proseBusyForScene ? 'Prose streaming' : 'Continue prose'}
        </button>
        <button
          style={summaryDisabled ? runBtnDisabled : runBtn}
          disabled={summaryDisabled}
          onClick={() => activeSceneId && triggerSummarize.mutate(activeSceneId)}
          title={activeSceneId ? '' : 'Open the Draft view to set an active scene'}
        >
          {summaryBusyForScene ? 'Summarizing' : 'Summarize scene'}
        </button>
      </div>

      <div style={list}>
        {aiTasks.length === 0 && (
          <div style={empty}>
            No AI tasks yet. Launch from above, or trigger prose continuation and scene summaries from the Draft / Scene views.
          </div>
        )}

        {active.length > 0 && (
          <>
            <div style={sectionHead}>In flight · {active.length}</div>
            {active.map((t) => (
              <TaskRow key={t.task_id} task={t} now={now} onOpen={() => openTask(t)} />
            ))}
          </>
        )}

        {recent.length > 0 && (
          <>
            <div style={sectionHead}>Recent</div>
            {recent.map((t) => (
              <TaskRow key={t.task_id} task={t} now={now} onOpen={() => openTask(t)} />
            ))}
          </>
        )}
      </div>

      <div style={footer}>
        <span>{aiTasks.length} total</span>
        {completedCount > 0 && (
          <button style={clearBtn} onClick={clearCompletedAITasks}>
            Clear {completedCount}
          </button>
        )}
      </div>
    </aside>
  )
}
