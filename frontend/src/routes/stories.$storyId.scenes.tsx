import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate, Outlet } from '@tanstack/react-router'
import { Btn, Label } from '../components/primitives'
import { LoadingState } from '../components/LoadingState'
import { useCreateScene, useScenes } from '../api/scenes'
import { useChapters } from '../api/manuscript'
import type { Scene } from '../types'

export const Route = createFileRoute('/stories/$storyId/scenes')({
  component: SceneBoard,
})

function povColor(pov: string): string {
  const map: Record<string, string> = {
    Iris: 'var(--ink)',
    Jon: 'var(--blue)',
    Cole: 'var(--amber)',
    Fen: 'var(--red)',
  };
  return map[pov] || 'var(--ink-3)';
}

const filterCycle: (string | null)[] = [null, 'Iris', 'Jon', 'Cole', 'Fen'];
const sortCycle: ('order' | 'tension' | 'pov')[] = ['order', 'tension', 'pov'];

function ActColumn({
  act,
  label,
  scenes,
  storyId,
  onSceneClick,
  onCreateScene,
}: {
  act: number
  label: string
  scenes: Scene[]
  storyId: string
  onSceneClick: (storyId: string, sceneId: string) => void
  onCreateScene: (act: number) => void
}) {
  const items = scenes.filter((s) => s.act === act)

  return (
    <div style={{ flex: 1, minWidth: 0, border: '1px solid var(--line)', background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
        <Label>ACT {label}</Label>
        <Label>{items.length} scenes</Label>
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        {items.map((s) => (
          <div
            key={s.id}
            onClick={() => onSceneClick(storyId, s.id)}
            style={{ border: '1px solid var(--ink)', background: 'var(--paper)', padding: 10, position: 'relative', cursor: 'pointer' }}
          >
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: povColor(s.pov) }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <Label>S{String(s.n).padStart(2, '0')} {'\u00B7'} {s.pov}</Label>
              <span style={{ display: 'inline-block', padding: '2px 7px', border: '1px solid var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>T {s.tension}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, lineHeight: 1.2 }}>{s.title}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {Array.from({ length: 10 }).map((_, k) => (
                <span key={k} style={{ flex: 1, height: 3, background: k < s.tension ? 'var(--ink)' : 'var(--line-2)' }} />
              ))}
            </div>
          </div>
        ))}
        <div
          onClick={() => onCreateScene(act)}
          style={{ border: '1px dashed var(--ink-3)', padding: 10, textAlign: 'center', color: 'var(--ink-3)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' as const, cursor: 'pointer' }}
        >
          + New scene
        </div>
      </div>
    </div>
  )
}

type GroupBy = 'act' | 'chapter'

function SceneBoard() {
  const { storyId } = Route.useParams()
  const { data, isLoading } = useScenes(storyId)
  const { data: chaptersData } = useChapters(storyId)
  const createScene = useCreateScene(storyId)
  const navigate = useNavigate()
  const [filterPov, setFilterPov] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'order' | 'tension' | 'pov'>('order')
  const [groupBy, setGroupBy] = useState<GroupBy>('act')

  if (isLoading) return <LoadingState />
  const scenes = data?.items ?? []
  const chapters = chaptersData ?? []

  const cycleFilter = () => {
    const idx = filterCycle.indexOf(filterPov)
    setFilterPov(filterCycle[(idx + 1) % filterCycle.length])
  }

  const cycleSort = () => {
    const idx = sortCycle.indexOf(sortBy)
    setSortBy(sortCycle[(idx + 1) % sortCycle.length])
  }

  const sortedScenes = [...scenes].sort((a, b) => {
    if (sortBy === 'tension') return b.tension - a.tension
    if (sortBy === 'pov') return a.pov.localeCompare(b.pov)
    return a.n - b.n
  })

  const filteredScenes = filterPov
    ? sortedScenes.filter(s => s.pov === filterPov)
    : sortedScenes

  const openScene = (storyId: string, sceneId: string) => {
    navigate({ to: '/stories/$storyId/scenes/$id', params: { storyId, id: sceneId } })
  }

  const createSceneInAct = async (act: number) => {
    const scene = await createScene.mutateAsync({
      title: 'Untitled scene',
      act,
      tension: 5,
      tag: 'Draft',
    })
    navigate({ to: '/stories/$storyId/scenes/$id', params: { storyId, id: scene.id } })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--ink)' }}>
        <div>
          <Label>Scene Board</Label>
          <div className="title-serif" style={{ fontSize: 26 }}>{scenes.length} scenes {'\u00B7'} drag to reorder</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" onClick={cycleFilter}>Filter: {filterPov || 'All'} {'\u25BE'}</Btn>
          <Btn variant="ghost" onClick={() => setGroupBy((g) => (g === 'act' ? 'chapter' : 'act'))}>
            Group: {groupBy === 'act' ? 'Act' : 'Chapter'}
          </Btn>
          <Btn variant="ghost" onClick={cycleSort}>Sort: {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)} {'\u25BE'}</Btn>
          <Btn variant="solid" onClick={() => createSceneInAct(1)} disabled={createScene.isPending}>
            {createScene.isPending ? 'Creating...' : '+ Scene'}
          </Btn>
        </div>
      </div>

      {/* Kanban columns */}
      <div style={{ flex: 1, padding: 16, display: 'flex', gap: 12, overflow: 'auto' }}>
        {groupBy === 'act' ? (
          <>
            <ActColumn act={1} label="I" scenes={filteredScenes} storyId={storyId} onSceneClick={openScene} onCreateScene={createSceneInAct} />
            <ActColumn act={2} label="II" scenes={filteredScenes} storyId={storyId} onSceneClick={openScene} onCreateScene={createSceneInAct} />
            <ActColumn act={3} label="III" scenes={filteredScenes} storyId={storyId} onSceneClick={openScene} onCreateScene={createSceneInAct} />
          </>
        ) : (
          <ChapterColumns scenes={filteredScenes} chapters={chapters} storyId={storyId} onSceneClick={openScene} />
        )}
      </div>

      {/* Scene detail modal renders here when /scenes/$id is matched */}
      <Outlet />
    </div>
  )
}

function ChapterColumns({
  scenes,
  chapters,
  storyId,
  onSceneClick,
}: {
  scenes: Scene[]
  chapters: Array<{ id: string; num: number; title: string }>
  storyId: string
  onSceneClick: (storyId: string, sceneId: string) => void
}) {
  const orderedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.num - b.num),
    [chapters],
  )
  const unassigned = scenes.filter((s) => !s.chapter_id)

  if (chapters.length === 0) {
    return (
      <div style={{ flex: 1, padding: 24, color: 'var(--ink-3)', fontSize: 12 }}>
        No chapters yet. Create chapters in the Manuscript view, then assign scenes from Scene Detail.
      </div>
    )
  }

  return (
    <>
      {orderedChapters.map((ch) => {
        const items = scenes.filter((s) => s.chapter_id === ch.id)
        return (
          <ChapterColumn
            key={ch.id}
            title={`Ch ${ch.num}`}
            subtitle={ch.title}
            scenes={items}
            storyId={storyId}
            onSceneClick={onSceneClick}
          />
        )
      })}
      {unassigned.length > 0 && (
        <ChapterColumn
          title="Unassigned"
          subtitle="No chapter"
          scenes={unassigned}
          storyId={storyId}
          onSceneClick={onSceneClick}
          muted
        />
      )}
    </>
  )
}

function ChapterColumn({
  title,
  subtitle,
  scenes,
  storyId,
  onSceneClick,
  muted = false,
}: {
  title: string
  subtitle?: string
  scenes: Scene[]
  storyId: string
  onSceneClick: (storyId: string, sceneId: string) => void
  muted?: boolean
}) {
  return (
    <div
      style={{
        flex: '0 0 280px',
        minWidth: 0,
        border: `1px solid ${muted ? 'var(--line-2)' : 'var(--line)'}`,
        background: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <Label>{title}</Label>
          {subtitle && (
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 13, color: muted ? 'var(--ink-3)' : 'var(--ink)' }}>
              {subtitle}
            </div>
          )}
        </div>
        <Label>{scenes.length} scenes</Label>
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        {scenes.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', padding: '8px 0' }}>
            No scenes here.
          </div>
        )}
        {scenes.map((s) => (
          <div
            key={s.id}
            onClick={() => onSceneClick(storyId, s.id)}
            style={{ border: '1px solid var(--ink)', background: 'var(--paper)', padding: 10, position: 'relative', cursor: 'pointer' }}
          >
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: povColor(s.pov) }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <Label>S{String(s.n).padStart(2, '0')}</Label>
              <span style={{ display: 'inline-block', padding: '2px 7px', border: '1px solid var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>T {s.tension}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, lineHeight: 1.2 }}>{s.title}</div>
            <div style={{ marginTop: 4, fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
              {s.pov}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
