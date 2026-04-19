import { useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { Btn, Tag, Label } from '../components/primitives'
import { useStore } from '../store'

const stories = [
  {
    id: '1',
    title: 'A Stranger in the Orchard',
    genres: ['Literary', 'Mystery'],
    wordCount: 72340,
    targetWords: 90000,
    sceneCount: 47,
    draftNumber: 3,
    lastEdited: 'Today',
    status: 'in-progress' as const,
    tensionPreview: [2, 3, 5, 4, 7, 6, 8, 9, 7, 8, 6, 9],
  },
  {
    id: '2',
    title: "The Lighthouse Keeper's Daughter",
    genres: ['Gothic', 'Romance'],
    wordCount: 45200,
    targetWords: 80000,
    sceneCount: 28,
    draftNumber: 1,
    lastEdited: '3 days ago',
    status: 'in-progress' as const,
    tensionPreview: [1, 2, 4, 3, 5, 6, 4, 7, 5, 8],
  },
  {
    id: '3',
    title: 'Signal Loss',
    genres: ['Sci-Fi', 'Thriller'],
    wordCount: 89100,
    targetWords: 100000,
    sceneCount: 62,
    draftNumber: 2,
    lastEdited: '1 week ago',
    status: 'in-progress' as const,
    tensionPreview: [3, 5, 4, 6, 8, 7, 9, 8, 7, 9, 10, 8],
  },
  {
    id: '4',
    title: 'Parish of Small Mercies',
    genres: ['Literary Fiction'],
    wordCount: 34000,
    targetWords: 75000,
    sceneCount: 19,
    draftNumber: 1,
    lastEdited: '2 weeks ago',
    status: 'in-progress' as const,
    tensionPreview: [1, 2, 3, 2, 4, 3, 5, 4],
  },
  {
    id: '5',
    title: 'Untitled Project',
    genres: [],
    wordCount: 0,
    targetWords: 80000,
    sceneCount: 0,
    draftNumber: 0,
    lastEdited: 'Yesterday',
    status: 'not-started' as const,
    tensionPreview: [],
  },
  {
    id: '6',
    title: "The Cartographer's Error",
    genres: ['Historical', 'Adventure'],
    wordCount: 58400,
    targetWords: 60000,
    sceneCount: 41,
    draftNumber: 4,
    lastEdited: '1 month ago',
    status: 'completed' as const,
    tensionPreview: [2, 4, 3, 6, 5, 7, 8, 6, 9, 7, 8, 10],
  },
]

type FilterStatus = 'all' | 'in-progress' | 'completed' | 'not-started'
type SortMode = 'recent' | 'alphabetical' | 'wordcount'

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 28px',
  borderBottom: '1.5px solid var(--ink)',
  background: 'var(--paper)',
}

const navLinkStyle = (active: boolean) => ({
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: active ? 'var(--ink)' : 'var(--ink-3)',
  textDecoration: 'none',
  padding: '4px 0',
  borderBottom: active ? '1.5px solid var(--ink)' : '1.5px solid transparent',
})

const filterBtnStyle = (active: boolean) => ({
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  padding: '6px 12px',
  border: '1px solid var(--ink)',
  background: active ? 'var(--ink)' : 'var(--paper)',
  color: active ? 'var(--paper)' : 'var(--ink)',
  cursor: 'pointer',
})

function TensionSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const w = 120
  const h = 28
  const max = Math.max(...data, 1)
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - (v / max) * h
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke="var(--ink-3)"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function StatusBadge({ status }: { status: 'in-progress' | 'completed' | 'not-started' }) {
  if (status === 'completed') return <Tag variant="solid" style={{ background: 'var(--green)', borderColor: 'var(--green)', color: 'var(--paper)' }}>Completed</Tag>
  if (status === 'in-progress') return <Tag variant="blue">In Progress</Tag>
  return <Tag>Not Started</Tag>
}

function DashboardPage() {
  const navigate = useNavigate()
  const logout = useStore(s => s.logout)
  const currentUser = useStore(s => s.currentUser)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [sort, setSort] = useState<SortMode>('recent')

  const filtered = stories.filter((s) => {
    if (filter === 'all') return true
    return s.status === filter
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'alphabetical') return a.title.localeCompare(b.title)
    if (sort === 'wordcount') return b.wordCount - a.wordCount
    return 0 // 'recent' keeps original order
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <Link
            to="/dashboard"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 22,
              fontStyle: 'italic',
              textDecoration: 'none',
              color: 'var(--ink)',
            }}
          >
            BeatLume
          </Link>
          <nav style={{ display: 'flex', gap: 20 }}>
            <Link to="/dashboard" style={navLinkStyle(true)}>Dashboard</Link>
            <Link to="/templates" style={navLinkStyle(false)}>Templates</Link>
            <Link to="/pricing" style={navLinkStyle(false)}>Pricing</Link>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-2)' }}>
            {currentUser.name}
          </span>
          <Link
            to="/settings"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
              textDecoration: 'none',
            }}
          >
            Settings
          </Link>
          <Btn
            variant="ghost"
            onClick={() => { logout(); navigate({ to: '/login' }) }}
            style={{ padding: '4px 8px' }}
          >
            Logout
          </Btn>
        </div>
      </div>

      {/* Main content */}
      <div style={{ padding: '32px 36px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Title row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, margin: 0 }}>My Stories</h1>
          <Btn variant="solid" onClick={() => navigate({ to: '/setup' })}>
            New Story
          </Btn>
        </div>

        {/* Filter + Sort bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', gap: 0 }}>
            {(
              [
                ['all', 'All'],
                ['in-progress', 'In Progress'],
                ['completed', 'Completed'],
                ['not-started', 'Not Started'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={filterBtnStyle(filter === key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Label>Sort by</Label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                border: '1px solid var(--ink)',
                background: 'var(--paper)',
                padding: '4px 8px',
              }}
            >
              <option value="recent">Recent</option>
              <option value="alphabetical">Alphabetical</option>
              <option value="wordcount">Word Count</option>
            </select>
          </div>
        </div>

        {/* Story grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 20,
          }}
        >
          {sorted.map((story) => {
            const progress = story.targetWords > 0 ? story.wordCount / story.targetWords : 0

            return (
              <div
                key={story.id}
                onClick={() => {
                  if (story.id === '1') {
                    navigate({ to: '/' })
                  } else {
                    alert('Coming soon')
                  }
                }}
                style={{
                  border: '1.5px solid var(--ink)',
                  background: 'var(--paper)',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--paper-2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--paper)'
                }}
              >
                {/* Title */}
                <h3
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 20,
                    margin: '0 0 8px',
                  }}
                >
                  {story.title}
                </h3>

                {/* Genre tags */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  {story.genres.map((g) => (
                    <Tag key={g}>{g}</Tag>
                  ))}
                  {story.genres.length === 0 && (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: 'var(--ink-3)',
                        fontStyle: 'italic',
                      }}
                    >
                      No genre set
                    </span>
                  )}
                </div>

                {/* Stats */}
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--ink-2)',
                    marginBottom: 8,
                  }}
                >
                  {story.wordCount.toLocaleString()} words &middot; {story.sceneCount} scenes
                </div>

                {/* Draft + last edited */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  {story.draftNumber > 0 && <Label>Draft {story.draftNumber}</Label>}
                  <Label>{story.lastEdited}</Label>
                </div>

                {/* Status badge */}
                <div style={{ marginBottom: 12 }}>
                  <StatusBadge status={story.status} />
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: 3,
                    background: 'var(--line)',
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(progress * 100, 100)}%`,
                      background: story.status === 'completed' ? 'var(--green)' : 'var(--ink)',
                    }}
                  />
                </div>

                {/* Tension sparkline */}
                <TensionSparkline data={story.tensionPreview} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})
