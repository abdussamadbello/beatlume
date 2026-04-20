import { createFileRoute, Link } from '@tanstack/react-router'
import { Tag, Label, PresenceStrip } from '../components/primitives'
import { LoadingState } from '../components/LoadingState'
import { useCharacters } from '../api/characters'
import { useGraph } from '../api/graph'

export const Route = createFileRoute('/stories/$storyId/characters/$id')({
  component: CharacterDetailPage,
})

function CharacterDetailPage() {
  const { storyId, id } = Route.useParams()
  const { data: charsData, isLoading: charsLoading } = useCharacters(storyId)
  const { data: graphData, isLoading: graphLoading } = useGraph(storyId)

  if (charsLoading || graphLoading) return <LoadingState />

  const characters = charsData?.items ?? []
  const edges = graphData?.edges ?? []

  const char = characters.find((c) => c.id === id)
  const charIndex = characters.findIndex((c) => c.id === id)

  if (!char) {
    return (
      <div style={{ padding: 24 }}>
        <Link to="/stories/$storyId/characters" params={{ storyId }} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', textDecoration: 'none' }}>
          &larr; Back to Characters
        </Link>
        <div className="title-serif" style={{ fontSize: 24, marginTop: 16 }}>Character not found</div>
      </div>
    )
  }

  // Find edges related to this character via graph nodes
  const relatedEdges = edges.filter(
    (e) => e.source_node_id === id || e.target_node_id === id
  )

  return (
    <div style={{ padding: 24, overflow: 'auto' }}>
      <Link to="/stories/$storyId/characters" params={{ storyId }} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', textDecoration: 'none' }}>
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
          <div className="mono" style={{ fontSize: 20, marginTop: 4 }}>{char.scene_count}</div>
        </div>
        <div>
          <Label>Longest gap</Label>
          <div className="mono" style={{ fontSize: 20, marginTop: 4, color: char.longest_gap > 10 ? 'var(--red)' : 'var(--ink)' }}>
            {char.longest_gap || '\u2014'}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Label>Presence</Label>
        <div style={{ marginTop: 8, maxWidth: 600 }}>
          <PresenceStrip characterIndex={charIndex >= 0 ? charIndex : 0} sceneCount={char.scene_count} />
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
          {relatedEdges.map((edge) => (
            <div key={edge.id} style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              padding: '6px 10px',
              background: 'var(--paper-2)',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
            }}>
              <span>{edge.source_node_id}</span>
              <span style={{ color: 'var(--ink-3)' }}>&harr;</span>
              <span>{edge.target_node_id}</span>
              <Tag style={{ fontSize: 9 }}>{edge.kind}</Tag>
              <span style={{ color: 'var(--ink-3)', fontSize: 10 }}>w{edge.weight}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
