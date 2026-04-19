import { useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { Btn, Tag, Label } from '../components/primitives'

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

const inputStyle = {
  border: '1px solid var(--ink)',
  background: 'var(--paper)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  padding: '8px 12px',
  outline: 'none',
  width: 260,
}

const templates = [
  {
    id: '1',
    title: 'Three-Act Thriller',
    genre: 'Thriller',
    scenes: 40,
    description: 'Fast-paced with escalating tension. Classic three-act structure with midpoint reversal and ticking-clock finale.',
    tensionCurve: [2, 3, 5, 4, 7, 6, 8, 5, 9, 10],
  },
  {
    id: '2',
    title: 'Romance Arc',
    genre: 'Romance',
    scenes: 32,
    description: 'Meet-cute to conflict to resolution. Two POVs with alternating chapters. Emotional intensity focus.',
    tensionCurve: [3, 5, 4, 6, 3, 7, 5, 8, 6, 9],
  },
  {
    id: '3',
    title: 'Mystery / Whodunit',
    genre: 'Mystery',
    scenes: 38,
    description: 'Clue planting, red herrings, revelation cascade. Suspect graph with alibi tracking.',
    tensionCurve: [2, 3, 4, 5, 4, 6, 5, 7, 8, 10],
  },
  {
    id: '4',
    title: 'Epic Fantasy',
    genre: 'Fantasy',
    scenes: 65,
    description: 'World-building heavy. Multiple subplots with large cast. Five-act structure with extended middle.',
    tensionCurve: [1, 2, 3, 4, 5, 4, 6, 7, 6, 8, 7, 9],
  },
  {
    id: '5',
    title: 'Literary Short Story',
    genre: 'Literary',
    scenes: 15,
    description: 'Single POV, compressed arc. Focus on internal conflict and epiphany moment.',
    tensionCurve: [2, 3, 4, 5, 6, 7, 6, 8],
  },
  {
    id: '6',
    title: 'Memoir',
    genre: 'Nonfiction',
    scenes: 30,
    description: 'Chronological and thematic structure. Real-world configuration with reflection beats.',
    tensionCurve: [3, 4, 3, 5, 4, 6, 5, 7, 6, 8],
  },
]

const allGenres = ['All', 'Thriller', 'Romance', 'Mystery', 'Fantasy', 'Literary', 'Nonfiction'] as const

function TensionCurve({ data }: { data: number[] }) {
  const w = 160
  const h = 36
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

function TemplatesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [genreFilter, setGenreFilter] = useState('All')

  const filtered = templates.filter((t) => {
    const matchesSearch =
      search === '' || t.title.toLowerCase().includes(search.toLowerCase())
    const matchesGenre = genreFilter === 'All' || t.genre === genreFilter
    return matchesSearch && matchesGenre
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
            <Link to="/dashboard" style={navLinkStyle(false)}>Dashboard</Link>
            <Link to="/templates" style={navLinkStyle(true)}>Templates</Link>
            <Link to="/pricing" style={navLinkStyle(false)}>Pricing</Link>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-2)' }}>
            Elena Marsh
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
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 36px' }}>
        {/* Title + search + filter */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, margin: 0 }}>
            Story Templates
          </h1>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            style={inputStyle}
          />
        </div>

        {/* Genre filter tags */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {allGenres.map((genre) => (
            <button
              key={genre}
              onClick={() => setGenreFilter(genre)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '4px 10px',
                border: '1px solid var(--ink)',
                background: genreFilter === genre ? 'var(--ink)' : 'var(--paper)',
                color: genreFilter === genre ? 'var(--paper)' : 'var(--ink)',
                cursor: 'pointer',
              }}
            >
              {genre}
            </button>
          ))}
        </div>

        {/* Template grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 20,
          }}
        >
          {filtered.map((template) => (
            <div
              key={template.id}
              style={{
                border: '1.5px solid var(--ink)',
                padding: '20px',
                background: 'var(--paper)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--paper-2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--paper)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>
                  {template.title}
                </h3>
                <Tag>{template.genre}</Tag>
              </div>

              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--ink-3)',
                }}
              >
                {template.scenes} scenes
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: 'var(--ink-2)',
                  lineHeight: 1.5,
                }}
              >
                {template.description}
              </div>

              {/* Tension curve */}
              <div>
                <Label style={{ marginBottom: 4, display: 'block' }}>Tension curve</Label>
                <TensionCurve data={template.tensionCurve} />
              </div>

              <div style={{ marginTop: 'auto' }}>
                <Btn
                  variant="solid"
                  onClick={() => navigate({ to: '/setup' })}
                >
                  Use Template
                </Btn>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/templates')({
  component: TemplatesPage,
})
