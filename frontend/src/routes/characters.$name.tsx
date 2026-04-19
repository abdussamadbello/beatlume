import { createFileRoute, Link } from '@tanstack/react-router'
import { AppShell, Sidebar } from '../components/chrome'
import { Tag, Label, PresenceStrip } from '../components/primitives'
import { useStore } from '../store'

export const Route = createFileRoute('/characters/$name')({
  component: CharacterDetailPage,
})

function CharacterDetailPage() {
  const { name } = Route.useParams()
  const characters = useStore((s) => s.characters)
  const edges = useStore((s) => s.edges)

  const char = characters.find((c) => c.name.toLowerCase() === name.toLowerCase())
  const charIndex = characters.findIndex((c) => c.name.toLowerCase() === name.toLowerCase())

  if (!char) {
    return (
      <AppShell sidebar={<Sidebar active="/characters" />}>
        <div style={{ padding: 24 }}>
          <Link to="/characters" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', textDecoration: 'none' }}>
            &larr; Back to Characters
          </Link>
          <div className="title-serif" style={{ fontSize: 24, marginTop: 16 }}>Character not found</div>
        </div>
      </AppShell>
    )
  }

  const charId = char.name.toLowerCase().slice(0, 3)
  // Possible id patterns used in graph
  const possibleIds = [
    char.name.toLowerCase(),
    charId,
    char.name.toLowerCase().slice(0, 2),
  ]
  const relatedEdges = edges.filter(
    (e) => possibleIds.includes(e.a) || possibleIds.includes(e.b)
  )

  return (
    <AppShell sidebar={<Sidebar active="/characters" />}>
      <div style={{ padding: 24, overflow: 'auto' }}>
        <Link to="/characters" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', textDecoration: 'none' }}>
          &larr; Back to Characters
        </Link>

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <div className="title-serif" style={{ fontSize: 32 }}>{char.name}</div>
          <Tag>{char.role}</Tag>
        </div>

        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, maxWidth: 800 }}>
          <div>
            <Label>Desire</Label>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, marginTop: 4, lineHeight: 1.5 }}>
              {char.desire}
            </div>
          </div>
          <div>
            <Label>Flaw</Label>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, marginTop: 4, lineHeight: 1.5 }}>
              {char.flaw}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 32 }}>
          <div>
            <Label>Scene count</Label>
            <div className="mono" style={{ fontSize: 20, marginTop: 4 }}>{char.sceneCount}</div>
          </div>
          <div>
            <Label>Longest gap</Label>
            <div className="mono" style={{ fontSize: 20, marginTop: 4, color: char.longestGap > 10 ? 'var(--red)' : 'var(--ink)' }}>
              {char.longestGap || '\u2014'}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <Label>Presence</Label>
          <div style={{ marginTop: 8, maxWidth: 600 }}>
            <PresenceStrip characterIndex={charIndex >= 0 ? charIndex : 0} sceneCount={char.sceneCount} />
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <Label>Arc sparkline</Label>
          <div style={{ display: 'flex', gap: 2, height: 32, alignItems: 'flex-end', marginTop: 8, maxWidth: 200 }}>
            {Array.from({ length: 8 }).map((_, k) => (
              <span key={k} style={{
                flex: 1,
                background: 'var(--ink)',
                height: `${20 + k * 10 + Math.sin((charIndex >= 0 ? charIndex : 0) + k) * 20}%`,
              }} />
            ))}
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <Label>Relationship edges ({relatedEdges.length})</Label>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {relatedEdges.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>No edges found in graph.</div>
            )}
            {relatedEdges.map((edge, i) => (
              <div key={i} style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                padding: '6px 10px',
                background: 'var(--paper-2)',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
              }}>
                <span>{edge.a}</span>
                <span style={{ color: 'var(--ink-3)' }}>&harr;</span>
                <span>{edge.b}</span>
                <Tag style={{ fontSize: 9 }}>{edge.kind}</Tag>
                <span style={{ color: 'var(--ink-3)', fontSize: 10 }}>w{edge.weight}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
