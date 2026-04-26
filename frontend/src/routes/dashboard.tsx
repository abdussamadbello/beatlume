import { useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { Btn, Tag, Label } from '../components/primitives'
import { LoadingState } from '../components/LoadingState'
import { useStore } from '../store'
import {
  useStories,
  useUpdateStory,
  useDuplicateStory,
  type StoryListScope,
} from '../api/stories'
import { logout } from '../api/auth'
import type { Story } from '../types'

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
  const [scope, setScope] = useState<StoryListScope>('active')
  const { data, isLoading } = useStories(scope)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [sort, setSort] = useState<SortMode>('recent')
  const duplicateStory = useDuplicateStory()

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
    if (sort === 'wordcount') return b.draft_word_count - a.draft_word_count
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

        {/* Scope tabs: Active / Archived / All */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
          {(
            [
              ['active', 'Active'],
              ['archived', 'Archived'],
              ['all', 'All'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setScope(key)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '4px 0',
                border: 'none',
                background: 'transparent',
                borderBottom: scope === key ? '1.5px solid var(--ink)' : '1.5px solid transparent',
                color: scope === key ? 'var(--ink)' : 'var(--ink-3)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
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
          {sorted.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              onOpen={() => navigate({ to: '/stories/$storyId', params: { storyId: story.id } })}
              onAfterDuplicate={(newId) =>
                navigate({ to: '/stories/$storyId', params: { storyId: newId } })
              }
              duplicatePending={duplicateStory.isPending}
              duplicateFn={(id) => duplicateStory.mutateAsync(id)}
            />
          ))}
          {sorted.length === 0 && (
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '32px',
                textAlign: 'center',
                color: 'var(--ink-3)',
                fontSize: 12,
                border: '1px dashed var(--line)',
              }}
            >
              {scope === 'archived' ? 'No archived stories.' : 'No stories match the current filters.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StoryCard({
  story,
  onOpen,
  onAfterDuplicate,
  duplicatePending,
  duplicateFn,
}: {
  story: Story
  onOpen: () => void
  onAfterDuplicate: (newId: string) => void
  duplicatePending: boolean
  duplicateFn: (id: string) => Promise<Story>
}) {
  const updateStory = useUpdateStory(story.id)

  const toggleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await updateStory.mutateAsync({ archived: !story.archived })
  }
  const duplicate = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const copy = await duplicateFn(story.id)
    onAfterDuplicate(copy.id)
  }

  const progress = story.target_words > 0
    ? Math.min(story.draft_word_count / story.target_words, 1)
    : 0

  return (
    <div
      onClick={onOpen}
      style={{
        border: '1.5px solid var(--ink)',
        background: 'var(--paper)',
        padding: '20px',
        cursor: 'pointer',
        transition: 'background 0.1s',
        opacity: story.archived ? 0.75 : 1,
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--paper-2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--paper)'
      }}
    >
      {/* Title */}
      <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: '0 0 8px' }}>
        {story.title}
      </h3>

      {/* Genre tags */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {story.genres.map((g) => (
          <Tag key={g}>{g}</Tag>
        ))}
        {story.genres.length === 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', fontStyle: 'italic' }}>
            No genre set
          </span>
        )}
      </div>

      {/* Stats */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', marginBottom: 8 }}>
        Target: {story.target_words.toLocaleString()} words
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', marginBottom: 8 }}>
        Drafted: {story.draft_word_count.toLocaleString()} words
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        {story.draft_number > 0 && <Label>Draft {story.draft_number}</Label>}
        {story.archived && <Tag>Archived</Tag>}
      </div>

      <div style={{ marginBottom: 12 }}>
        <StatusBadge status={story.status} />
      </div>

      <div style={{ height: 3, background: 'var(--line)', marginBottom: 12 }}>
        <div
          style={{
            height: '100%',
            width: `${Math.min(progress * 100, 100)}%`,
            background: story.status === 'completed' ? 'var(--green)' : 'var(--ink)',
          }}
        />
      </div>

      {/* Row actions */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={toggleArchive}
          disabled={updateStory.isPending}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '4px 8px',
            border: '1px solid var(--line)',
            background: 'transparent',
            color: 'var(--ink-2)',
            cursor: updateStory.isPending ? 'default' : 'pointer',
          }}
        >
          {story.archived ? 'Unarchive' : 'Archive'}
        </button>
        <button
          onClick={duplicate}
          disabled={duplicatePending}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '4px 8px',
            border: '1px solid var(--line)',
            background: 'transparent',
            color: 'var(--ink-2)',
            cursor: duplicatePending ? 'default' : 'pointer',
          }}
        >
          {duplicatePending ? 'Copying…' : 'Duplicate'}
        </button>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})
