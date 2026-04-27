import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Btn, Label } from '../components/primitives'
import { LoadingState } from '../components/LoadingState'
import { useChapters } from '../api/manuscript'
import { useStory } from '../api/stories'
import { useTriggerExport } from '../api/export'
import {
  useCoreTree,
  useCoreSettings,
  useCreateCoreSetting,
  useUpdateCoreSetting,
} from '../api/core'
import { useStore } from '../store'
import type { CoreConfigNode } from '../types'

function formatReadingTime(wordCount: number): string {
  if (wordCount <= 0) return '0m'
  const totalMinutes = Math.max(1, Math.ceil(wordCount / 250))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${totalMinutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function ManuscriptPage() {
  const { storyId } = Route.useParams()
  const { chapter: chapterParam } = Route.useSearch()
  const { data: story, isLoading: storyLoading } = useStory(storyId)
  const { data: chaptersData, isLoading } = useChapters(storyId)
  const exportMutation = useTriggerExport(storyId)
  const navigate = useNavigate()
  const editMode = useStore(s => s.editMode)

  // Quick-export from the manuscript page: hands off to the dedicated export view,
  // which already shows progress + the Download button. We persist the job id so
  // that page picks it up automatically on arrival.
  const startExport = (format: 'pdf' | 'docx') => {
    exportMutation.mutate(
      { format },
      {
        onSuccess: (res) => {
          try {
            window.localStorage.setItem(`beatlume:export-job:${storyId}`, res.job_id)
          } catch {
            // localStorage may be disabled (private mode, quota); fail silently
          }
          navigate({ to: '/stories/$storyId/export', params: { storyId } })
        },
      },
    )
  }
  const toggleEditMode = useStore(s => s.toggleEditMode)

  const [scrollProgress, setScrollProgress] = useState(0)
  const [activeChapter, setActiveChapter] = useState('1')
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const chapterRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())

  const chapters = chaptersData ?? []
  const manuscriptWords = story?.manuscript_word_count ?? 0
  const sceneCount = story?.scene_count ?? 0
  const draftNumber = story?.draft_number ?? 0
  const title = story?.title ?? 'Untitled story'

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const progress = scrollHeight > clientHeight
      ? Math.round((scrollTop / (scrollHeight - clientHeight)) * 100)
      : 0
    setScrollProgress(progress)

    let closestChapter = '1'
    let closestDistance = Infinity

    chapterRefsMap.current.forEach((el, num) => {
      const rect = el.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const distance = Math.abs(rect.top - containerRect.top)
      if (distance < closestDistance) {
        closestDistance = distance
        closestChapter = num
      }
    })

    setActiveChapter(closestChapter)
  }, [])

  const setChapterRef = useCallback((num: string, el: HTMLDivElement | null) => {
    if (el) {
      chapterRefsMap.current.set(num, el)
    } else {
      chapterRefsMap.current.delete(num)
    }
  }, [])

  useEffect(() => {
    if (!chapterParam) return
    const target = chapterRefsMap.current.get(chapterParam)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveChapter(chapterParam)
    }
  }, [chapterParam, chapters.length])

  if (isLoading || storyLoading) return <LoadingState />

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: '#F3EEDF',
      }}
    >
      {/* Top reader bar */}
      <div
        style={{
          padding: '12px 32px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--paper)',
        }}
      >
        <div>
          <Label>Manuscript &middot; Draft {draftNumber}</Label>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontStyle: 'italic' }}>
            {title}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', fontSize: 11, color: 'var(--ink-2)' }}>
          <span>{manuscriptWords.toLocaleString()} words</span>
          <span>{sceneCount} scenes &middot; {chapters.length} chapters</span>
          <span>Reading time &asymp; {formatReadingTime(manuscriptWords)}</span>
          <Btn
            variant="ghost"
            onClick={() => startExport('pdf')}
            disabled={exportMutation.isPending}
          >
            Export &middot; PDF
          </Btn>
          <Btn
            variant="ghost"
            onClick={() => startExport('docx')}
            disabled={exportMutation.isPending}
          >
            Export &middot; DOCX
          </Btn>
          <Btn onClick={() => toggleEditMode()}>
            {editMode ? 'Read mode' : 'Edit mode'}
          </Btn>
        </div>
      </div>

      {/* Body: plan rail + manuscript page */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <ChapterPlanRail storyId={storyId} chapterNum={activeChapter} />

      {/* Page */}
      <div ref={scrollContainerRef} onScroll={handleScroll} style={{ overflow: 'auto', flex: 1, padding: '48px 0' }}>
        <div
          style={{
            maxWidth: 640,
            margin: '0 auto',
            background: 'var(--paper)',
            padding: '72px 84px 96px',
            boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 24px 48px -24px rgba(60,50,30,0.18)',
            fontFamily: "'Instrument Serif', serif",
            fontSize: 17,
            lineHeight: 1.75,
            color: 'var(--ink)',
          }}
        >
          {/* Title page */}
          <div style={{ textAlign: 'center', marginBottom: 80 }}>
            <div
              style={{
                letterSpacing: '0.4em',
                fontSize: 10,
                color: 'var(--ink-3)',
                textTransform: 'uppercase',
              }}
            >
              A Novel
            </div>
            <h1
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontWeight: 400,
                fontSize: 42,
                margin: '24px 0 12px',
              }}
            >
              {title}
            </h1>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 18 }}>Draft {draftNumber}</div>
          </div>

          {chapters.length === 0 && (
            <div
              style={{
                marginTop: 64,
                textAlign: 'center',
                fontSize: 12,
                color: 'var(--ink-3)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              No chapters yet. Draft scenes in the Draft view; once a chapter is
              created it will appear here.
            </div>
          )}

          {/* Chapters - content is from internal API, not user-generated HTML */}
          {chapters.map((ch, i) => (
            <div
              key={ch.id}
              id={`chapter-${ch.num}`}
              ref={(el) => setChapterRef(String(ch.num), el)}
              style={{ marginTop: i === 0 ? 0 : 72, pageBreakBefore: 'always' as const }}
            >
              <div
                style={{
                  textAlign: 'center',
                  letterSpacing: '0.3em',
                  fontSize: 11,
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                }}
              >
                Chapter {ch.num}
              </div>
              <h2
                style={{
                  textAlign: 'center',
                  fontFamily: "'Instrument Serif', serif",
                  fontWeight: 400,
                  fontSize: 28,
                  margin: '10px 0 36px',
                  fontStyle: 'italic',
                }}
              >
                {ch.title}
              </h2>
              <div
                contentEditable={editMode}
                suppressContentEditableWarning={editMode}
                style={{
                  outline: editMode ? '1px dashed var(--line)' : 'none',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {ch.content}
              </div>
            </div>
          ))}

          {chapters.length > 0 && (
            <div
              style={{
                marginTop: 72,
                textAlign: 'center',
                fontSize: 11,
                color: 'var(--ink-3)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              &mdash; end of draft &mdash;
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Footer reader bar */}
      <div
        style={{
          padding: '10px 32px',
          borderTop: '1px solid var(--line)',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'var(--ink-3)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          background: 'var(--paper)',
        }}
      >
        <span>page 1 of 284</span>
        <span>chapter {activeChapter} visible</span>
        <span>progress &middot; {scrollProgress}%</span>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/stories/$storyId/manuscript')({
  validateSearch: (search: Record<string, unknown>) => ({
    chapter: typeof search.chapter === 'string' ? search.chapter : undefined,
  }),
  component: ManuscriptPage,
})

const PHASES = ['Setup', 'Escalation', 'Fallout', 'Reveal', 'Resolution'] as const

const CHAPTER_PLAN_FIELDS = [
  { key: 'Purpose', hint: 'One-line description of what this chapter does.' },
  { key: 'Phase', hint: 'Structural role.' },
  { key: 'Tension band', hint: 'Expected range, e.g. 4–7.' },
  { key: 'Time window', hint: 'When does the chapter happen?' },
] as const

const CHAPTER_LABEL_RE = /Ch\s*0*(\d+)/i

function findChapterNode(tree: CoreConfigNode[] | undefined, num: string): CoreConfigNode | undefined {
  if (!tree) return undefined
  const target = Number(num)
  for (const node of tree) {
    if (node.kind !== 'chap') continue
    const matched = node.label.match(CHAPTER_LABEL_RE)
    if (matched && Number(matched[1]) === target) return node
  }
  return undefined
}

function ChapterPlanRail({ storyId, chapterNum }: { storyId: string; chapterNum: string }) {
  const { data: tree } = useCoreTree(storyId)
  const node = useMemo(() => findChapterNode(tree, chapterNum), [tree, chapterNum])
  const { data: settings } = useCoreSettings(storyId, node?.id ?? null)
  const createSetting = useCreateCoreSetting(storyId)
  const updateSetting = useUpdateCoreSetting(storyId)

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const pending = createSetting.isPending || updateSetting.isPending

  function getOwnValue(key: string): string | null {
    if (!settings) return null
    const s = settings.find((x) => x.key.toLowerCase() === key.toLowerCase())
    return s?.is_override ? s.value : null
  }

  function getResolvedPOV() {
    if (!settings) return null
    return settings.find((x) => x.key.toLowerCase() === 'pov') ?? null
  }

  function startEdit(key: string, current: string | null) {
    if (!node) return
    setEditingKey(key)
    setDraft(current ?? '')
    setError(null)
  }

  function cancelEdit() {
    setEditingKey(null)
    setDraft('')
    setError(null)
  }

  function save(key: string) {
    if (!node) return
    const trimmed = draft.trim()
    if (!trimmed) {
      setError('Value cannot be empty')
      return
    }
    const existing = settings?.find((x) => x.key.toLowerCase() === key.toLowerCase())
    const onDone = () => { setEditingKey(null); setDraft(''); setError(null) }
    const onErr = (err: unknown) => setError(err instanceof Error ? err.message : 'Failed to save')

    if (existing?.is_override) {
      updateSetting.mutate({ key, nodeId: node.id, value: trimmed }, { onSuccess: onDone, onError: onErr })
    } else {
      createSetting.mutate(
        { key, value: trimmed, source: 'user', config_node_id: node.id },
        { onSuccess: onDone, onError: onErr },
      )
    }
  }

  const pov = getResolvedPOV()
  const povInheritance =
    pov && !pov.is_override
      ? pov.defined_at_node_id === null
        ? 'from story'
        : `from ${pov.defined_at_label}`
      : null

  return (
    <aside
      style={{
        width: 260,
        flexShrink: 0,
        borderRight: '1px solid var(--line)',
        background: 'var(--paper)',
        padding: '20px 16px',
        overflow: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 4 }}>
        Chapter plan
      </div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, lineHeight: 1.2, marginBottom: 14 }}>
        {node?.label ?? `Chapter ${chapterNum}`}
      </div>

      {!node && (
        <div style={{ color: 'var(--ink-3)', fontStyle: 'italic', fontSize: 11 }}>
          No plan node found for this chapter.
        </div>
      )}

      {node && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {CHAPTER_PLAN_FIELDS.map(({ key, hint }) => {
            const value = getOwnValue(key)
            const isEditing = editingKey === key
            const isPhase = key === 'Phase'

            return (
              <div key={key}>
                <div style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 3 }}>
                  {key}
                </div>
                {isEditing ? (
                  isPhase ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <select
                        value={draft}
                        onChange={(ev) => setDraft(ev.target.value)}
                        autoFocus
                        style={railInputStyle}
                      >
                        <option value="">—</option>
                        {PHASES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      {error && <span style={{ color: 'var(--red)', fontSize: 10 }}>{error}</span>}
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Btn variant="ghost" onClick={() => save(key)} disabled={pending}>Save</Btn>
                        <Btn variant="ghost" onClick={cancelEdit}>Cancel</Btn>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <input
                        value={draft}
                        onChange={(ev) => setDraft(ev.target.value)}
                        autoFocus
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter') save(key)
                          if (ev.key === 'Escape') cancelEdit()
                        }}
                        placeholder={hint}
                        style={railInputStyle}
                      />
                      {error && <span style={{ color: 'var(--red)', fontSize: 10 }}>{error}</span>}
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Btn variant="ghost" onClick={() => save(key)} disabled={pending}>Save</Btn>
                        <Btn variant="ghost" onClick={cancelEdit}>Cancel</Btn>
                      </div>
                    </div>
                  )
                ) : (
                  <div
                    onClick={() => startEdit(key, value)}
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: 14,
                      lineHeight: 1.3,
                      color: value ? 'var(--ink)' : 'var(--ink-3)',
                      cursor: 'pointer',
                      minHeight: 18,
                    }}
                    title={value ? 'Click to edit' : hint}
                  >
                    {value ?? '—'}
                  </div>
                )}
              </div>
            )
          })}

          {/* Dominant POV (resolved, inheritance shown) */}
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 3 }}>
              Dominant POV
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 14,
                  color: pov ? (pov.is_override ? 'var(--ink)' : 'var(--ink-3)') : 'var(--ink-3)',
                }}
              >
                {pov?.value ?? '—'}
              </div>
              {povInheritance && (
                <span style={{ fontSize: 9, color: 'var(--ink-3)', padding: '1px 5px', border: '1px dashed var(--line)' }}>
                  {povInheritance}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

const railInputStyle = {
  padding: '4px 6px',
  border: '1px solid var(--ink-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  background: 'var(--paper)',
  color: 'var(--ink)',
  width: '100%',
} as const
