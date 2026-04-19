import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AppShell, Sidebar } from '../components/chrome'
import { Tag, Btn, Label, PresenceStrip } from '../components/primitives'
import { useStore } from '../store'

export const Route = createFileRoute('/characters')({
  component: CharactersView,
})

function CharactersView() {
  const characters = useStore(s => s.characters)
  const navigate = useNavigate()
  const [sortBy, setSortBy] = useState<'name' | 'scenes' | 'gap'>('name')
  const [selectedName, setSelectedName] = useState<string | null>(null)

  const sorted = [...characters].sort((a, b) => {
    if (sortBy === 'scenes') return b.sceneCount - a.sceneCount
    if (sortBy === 'gap') return b.longestGap - a.longestGap
    return a.name.localeCompare(b.name)
  })

  const headerStyle = (col: 'name' | 'scenes' | 'gap') => ({
    cursor: 'pointer' as const,
    textDecoration: sortBy === col ? 'underline' : 'none',
  })

  return (
    <AppShell sidebar={<Sidebar active="/characters" />}>
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid var(--ink)' }}>
          <div className="title-serif" style={{ fontSize: 24 }}>Cast {'\u00B7'} {characters.length} characters</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost">Filter {'\u25BE'}</Btn>
            <Btn variant="solid">+ Character</Btn>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '48px 140px 110px 1fr 80px 80px 100px',
            gap: 10,
            padding: '10px 24px',
            borderBottom: '1px solid var(--ink)',
            fontSize: 10,
            letterSpacing: '0.08em',
            color: 'var(--ink-3)',
            textTransform: 'uppercase' as const,
          }}>
            <span />
            <span style={headerStyle('name')} onClick={() => setSortBy('name')}>Name</span>
            <span>Role</span>
            <span>Presence</span>
            <span style={headerStyle('scenes')} onClick={() => setSortBy('scenes')}>Scenes</span>
            <span style={headerStyle('gap')} onClick={() => setSortBy('gap')}>Longest gap</span>
            <span>Arc</span>
          </div>

          {/* Rows */}
          {sorted.map((c, i) => {
            const isSelected = c.name === selectedName
            return (
              <div
                key={c.name}
                onClick={() => {
                  setSelectedName(c.name)
                  navigate({ to: '/characters/$name', params: { name: c.name } })
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '48px 140px 110px 1fr 80px 80px 100px',
                  gap: 10,
                  padding: '12px 24px',
                  borderBottom: '1px dashed var(--line-2)',
                  alignItems: 'center',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--paper-2)' : 'transparent',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 32,
                  height: 32,
                  border: '1.5px solid var(--ink)',
                  background: i === 0 ? 'var(--ink)' : 'var(--paper)',
                  color: i === 0 ? 'var(--paper)' : 'var(--ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                }}>
                  {c.name.slice(0, 2).toUpperCase()}
                </div>

                {/* Name */}
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16 }}>{c.name}</div>

                {/* Role */}
                <div><Tag>{c.role}</Tag></div>

                {/* Presence strip */}
                <div>
                  <PresenceStrip characterIndex={i} sceneCount={c.sceneCount} />
                </div>

                {/* Scene count */}
                <div className="mono" style={{ fontSize: 12 }}>{c.sceneCount}</div>

                {/* Longest gap */}
                <div className="mono" style={{ fontSize: 12, color: c.longestGap > 10 ? 'var(--red)' : 'var(--ink)' }}>
                  {c.longestGap || '\u2014'}
                </div>

                {/* Arc sparkline */}
                <div style={{ display: 'flex', gap: 2, height: 18, alignItems: 'flex-end' }}>
                  {Array.from({ length: 8 }).map((_, k) => (
                    <span key={k} style={{
                      flex: 1,
                      background: 'var(--ink)',
                      height: `${20 + k * 10 + Math.sin(i + k) * 20}%`,
                    }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  )
}
