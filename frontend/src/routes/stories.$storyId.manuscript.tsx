import { useState, useRef, useEffect, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Btn, Label } from '../components/primitives'
import { LoadingState } from '../components/LoadingState'
import { useChapters } from '../api/manuscript'
import { useTriggerExport } from '../api/export'
import { useStore } from '../store'

function ManuscriptPage() {
  const { storyId } = Route.useParams()
  const { chapter: chapterParam } = Route.useSearch()
  const { data: chaptersData, isLoading } = useChapters(storyId)
  const exportMutation = useTriggerExport(storyId)
  const editMode = useStore(s => s.editMode)
  const toggleEditMode = useStore(s => s.toggleEditMode)

  const [scrollProgress, setScrollProgress] = useState(0)
  const [activeChapter, setActiveChapter] = useState('1')
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const chapterRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())

  const chapters = chaptersData ?? []

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

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

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

  if (isLoading) return <LoadingState />

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
          <Label>Manuscript &middot; Draft 3</Label>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontStyle: 'italic' }}>
            A Stranger in the Orchard
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', fontSize: 11, color: 'var(--ink-2)' }}>
          <span>72,340 words</span>
          <span>47 scenes &middot; {chapters.length} chapters</span>
          <span>Reading time &asymp; 4h 50m</span>
          <Btn
            variant="ghost"
            onClick={() => exportMutation.mutate({ format: 'pdf' })}
            disabled={exportMutation.isPending}
          >
            Export &middot; PDF
          </Btn>
          <Btn
            variant="ghost"
            onClick={() => exportMutation.mutate({ format: 'docx' })}
            disabled={exportMutation.isPending}
          >
            Export &middot; DOCX
          </Btn>
          <Btn onClick={() => toggleEditMode()}>
            {editMode ? 'Read mode' : 'Edit mode'}
          </Btn>
        </div>
      </div>

      {/* Page */}
      <div ref={scrollContainerRef} style={{ overflow: 'auto', flex: 1, padding: '48px 0' }}>
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
              A Stranger
              <br />
              in the Orchard
            </h1>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 18 }}>by Elena Marsh</div>
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
