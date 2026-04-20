import { useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { Btn, Tag, Label } from '../components/primitives'
import { LoadingState } from '../components/LoadingState'
import { useStore } from '../store'
import { useStories } from '../api/stories'
import { logout } from '../api/auth'

type FilterStatus = 'all' | 'in_progress' | 'completed' | 'not_started'
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

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return <Tag variant="solid" style={{ background: 'var(--green)', borderColor: 'var(--green)', color: 'var(--paper)' }}>Completed</Tag>
  if (status === 'in_progress') return <Tag variant="blue">In Progress</Tag>
  return <Tag>Not Started</Tag>
}

function DashboardPage() {
  const navigate = useNavigate()
  const currentUser = useStore(s => s.currentUser)
  const { data, isLoading } = useStories()
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [sort, setSort] = useState<SortMode>('recent')

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
        <LoadingState label="Loading stories..." />
      </div>
    )
  }

  const stories = data?.items ?? []

  const filtered = stories.filter((s) => {
    if (filter === 'all') return true
    return s.status === filter
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'alphabetical') return a.title.localeCompare(b.title)
    if (sort === 'wordcount') return b.target_words - a.target_words
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
            {currentUser?.name ?? 'User'}
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
            onClick={async () => { await logout(); navigate({ to: '/login' }) }}
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
                ['in_progress', 'In Progress'],
                ['completed', 'Completed'],
                ['not_started', 'Not Started'],
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
            const progress = story.target_words > 0 ? 0 / story.target_words : 0

            return (
              <div
                key={story.id}
                onClick={() => {
                  navigate({ to: '/stories/$storyId', params: { storyId: story.id } })
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
                  Target: {story.target_words.toLocaleString()} words
                </div>

                {/* Draft + last edited */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  {story.draft_number > 0 && <Label>Draft {story.draft_number}</Label>}
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

                {/* Tension sparkline placeholder */}
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
