import { useState } from 'react'
import { createFileRoute, useNavigate, Outlet } from '@tanstack/react-router'
import { Btn, Label } from '../components/primitives'
import { LoadingState } from '../components/LoadingState'
import { useScenes } from '../api/scenes'

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

function SceneBoard() {
  const { storyId } = Route.useParams()
  const { data, isLoading } = useScenes(storyId)
  const navigate = useNavigate()
  const [filterPov, setFilterPov] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'order' | 'tension' | 'pov'>('order')

  if (isLoading) return <LoadingState />
  const scenes = data?.items ?? []

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

  function ActColumn({ act, label }: { act: number; label: string }) {
    const items = filteredScenes.filter((s) => s.act === act);
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
              onClick={() => navigate({ to: '/stories/$storyId/scenes/$id', params: { storyId, id: s.id } })}
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
            style={{ border: '1px dashed var(--ink-3)', padding: 10, textAlign: 'center', color: 'var(--ink-3)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' as const, cursor: 'pointer' }}
          >
            + New scene
          </div>
        </div>
      </div>
    );
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
          <Btn variant="ghost">Group: Act {'\u25BE'}</Btn>
          <Btn variant="ghost" onClick={cycleSort}>Sort: {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)} {'\u25BE'}</Btn>
          <Btn variant="solid">+ Scene</Btn>
        </div>
      </div>

      {/* Kanban columns */}
      <div style={{ flex: 1, padding: 16, display: 'flex', gap: 12, overflow: 'hidden' }}>
        <ActColumn act={1} label="I" />
        <ActColumn act={2} label="II" />
        <ActColumn act={3} label="III" />
      </div>

      {/* Scene detail modal renders here when /scenes/$id is matched */}
      <Outlet />
    </div>
  )
}
