import { useMemo, useState, type FormEvent } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Tag, Label, PresenceStrip, TensionBar, Btn } from '../components/primitives'
import { LoadingState } from '../components/LoadingState'
import { Modal } from '../components/Modal'
import { useCharacters, useDeleteCharacter, useUpdateCharacter } from '../api/characters'
import { useGraph } from '../api/graph'
import { useScenes } from '../api/scenes'
import type { Character } from '../types'

export const Route = createFileRoute('/stories/$storyId/characters/$id')({
  component: CharacterDetailPage,
})

const sectionStyle: React.CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--paper)',
  padding: '16px 18px',
}

const statValueStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 22,
  marginTop: 4,
  color: 'var(--ink)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid var(--ink)',
  background: 'var(--paper)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--ink)',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: 'var(--font-serif)',
  fontSize: 13,
  resize: 'vertical',
  minHeight: 60,
}

function EditCharacterModal({
  open,
  onClose,
  storyId,
  character,
}: {
  open: boolean
  onClose: () => void
  storyId: string
  character: Character
}) {
  const update = useUpdateCharacter(storyId)
  const [name, setName] = useState(character.name)
  const [role, setRole] = useState(character.role)
  const [archetype, setArchetype] = useState(character.archetype ?? '')
  const [description, setDescription] = useState(character.description)
  const [bio, setBio] = useState(character.bio)
  const [desire, setDesire] = useState(character.desire)
  const [fear, setFear] = useState(character.fear ?? '')
  const [flaw, setFlaw] = useState(character.flaw)
  const [arcSummary, setArcSummary] = useState(character.arc_summary ?? '')
  const [relationshipNotes, setRelationshipNotes] = useState(character.relationship_notes ?? '')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setError(null)
    try {
      await update.mutateAsync({
        characterId: character.id,
        name: name.trim(),
        role: role.trim(),
        archetype: archetype.trim(),
        description: description.trim(),
        bio: bio.trim(),
        desire: desire.trim(),
        fear: fear.trim(),
        flaw: flaw.trim(),
        arc_summary: arcSummary.trim(),
        relationship_notes: relationshipNotes.trim(),
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update character')
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={560}>
      <form onSubmit={handleSubmit}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--ink)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="title-serif" style={{ fontSize: 22 }}>Edit {character.name}</span>
          <Label>Update character</Label>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto' }}>
          <div>
            <Label>Name *</Label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>Role</Label>
              <input value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} placeholder="Protagonist" />
            </div>
            <div>
              <Label>Archetype</Label>
              <input value={archetype} onChange={(e) => setArchetype(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} placeholder="Hero, Mentor" />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ ...inputStyle, marginTop: 4 }}
              placeholder="One-line summary"
              maxLength={500}
            />
          </div>
          <div>
            <Label>Bio</Label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{ ...textareaStyle, marginTop: 4, minHeight: 120 }}
              placeholder="Backstory and key history"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>Desire</Label>
              <textarea value={desire} onChange={(e) => setDesire(e.target.value)} style={{ ...textareaStyle, marginTop: 4 }} placeholder="What do they want?" />
            </div>
            <div>
              <Label>Fear</Label>
              <textarea value={fear} onChange={(e) => setFear(e.target.value)} style={{ ...textareaStyle, marginTop: 4 }} placeholder="What scares them?" />
            </div>
          </div>
          <div>
            <Label>Flaw</Label>
            <textarea value={flaw} onChange={(e) => setFlaw(e.target.value)} style={{ ...textareaStyle, marginTop: 4 }} placeholder="What holds them back?" />
          </div>
          <div>
            <Label>Arc summary</Label>
            <textarea value={arcSummary} onChange={(e) => setArcSummary(e.target.value)} style={{ ...textareaStyle, marginTop: 4 }} placeholder="How do they change?" />
          </div>
          <div>
            <Label>Relationship notes</Label>
            <textarea value={relationshipNotes} onChange={(e) => setRelationshipNotes(e.target.value)} style={{ ...textareaStyle, marginTop: 4 }} placeholder="Key dynamics with other characters" />
          </div>
          {error && <div style={{ fontSize: 11, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--ink)', background: 'var(--paper-2)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
          <Btn variant="solid" type="submit" disabled={update.isPending}>
            {update.isPending ? 'Saving...' : 'Save changes'}
          </Btn>
        </div>
      </form>
    </Modal>
  )
}

function CharacterDetailPage() {
  const { storyId, id } = Route.useParams()
  const navigate = useNavigate()
  const { data: charsData, isLoading: charsLoading } = useCharacters(storyId)
  const { data: graphData, isLoading: graphLoading } = useGraph(storyId)
  const { data: scenesData, isLoading: scenesLoading } = useScenes(storyId)
  const deleteChar = useDeleteCharacter(storyId)
  const [editOpen, setEditOpen] = useState(false)

  const characters = useMemo(() => charsData?.items ?? [], [charsData?.items])
  const nodes = useMemo(() => graphData?.nodes ?? [], [graphData?.nodes])
  const edges = useMemo(() => graphData?.edges ?? [], [graphData?.edges])
  const scenes = useMemo(() => scenesData?.items ?? [], [scenesData?.items])

  const char = useMemo(() => characters.find((c) => c.id === id), [characters, id])
  const charIndex = useMemo(() => characters.findIndex((c) => c.id === id), [characters, id])
  const charNode = useMemo(() => nodes.find((n) => n.character_id === id), [nodes, id])

  const characterScenes = useMemo(
    () => (char ? scenes.filter((s) => s.pov === char.name).sort((a, b) => a.n - b.n) : []),
    [scenes, char]
  )

  const stats = useMemo(() => {
    if (characterScenes.length === 0) {
      return { firstScene: null, lastScene: null, peakTension: 0, avgTension: 0, actCounts: [0, 0, 0] }
    }
    const tensions = characterScenes.map((s) => s.tension)
    const peakTension = Math.max(...tensions)
    const avgTension = tensions.reduce((a, b) => a + b, 0) / tensions.length
    const actCounts: [number, number, number] = [0, 0, 0]
    for (const s of characterScenes) {
      if (s.act >= 1 && s.act <= 3) actCounts[s.act - 1]++
    }
    return {
      firstScene: characterScenes[0],
      lastScene: characterScenes[characterScenes.length - 1],
      peakTension,
      avgTension,
      actCounts,
    }
  }, [characterScenes])

  const relatedEdges = useMemo(() => {
    if (!charNode) return []
    return edges
      .filter((e) => e.source_node_id === charNode.id || e.target_node_id === charNode.id)
      .map((edge) => {
        const otherNodeId = edge.source_node_id === charNode.id ? edge.target_node_id : edge.source_node_id
        const otherNode = nodes.find((n) => n.id === otherNodeId)
        const otherChar = otherNode ? characters.find((c) => c.id === otherNode.character_id) : null
        return { edge, otherChar, otherNodeLabel: otherNode?.label ?? otherNodeId }
      })
  }, [edges, nodes, characters, charNode])

  if (charsLoading || graphLoading || scenesLoading) return <LoadingState />

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

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${char.name}? This cannot be undone.`)) return
    await deleteChar.mutateAsync(char.id)
    navigate({ to: '/stories/$storyId/characters', params: { storyId } })
  }

  const totalScenes = scenes.length

  return (
    <div style={{ padding: '20px 28px', maxWidth: 1100 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Link to="/stories/$storyId/characters" params={{ storyId }} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', textDecoration: 'none' }}>
          &larr; Back to Characters
        </Link>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" onClick={() => navigate({ to: '/stories/$storyId/graph', params: { storyId } })}>
            View in graph
          </Btn>
          <Btn variant="solid" onClick={() => setEditOpen(true)}>
            Edit
          </Btn>
          <Btn variant="ghost" onClick={handleDelete} disabled={deleteChar.isPending}>
            {deleteChar.isPending ? 'Deleting...' : 'Delete'}
          </Btn>
        </div>
      </div>

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 4 }}>
        <div className="title-serif" style={{ fontSize: 36 }}>{char.name}</div>
        {char.role && <Tag>{char.role}</Tag>}
        {charNode?.node_type === 'hub' && <Tag variant="blue">Hub</Tag>}
      </div>

      {/* One-line description (italic, just under the title) */}
      {char.description && (
        <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 17, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.4, maxWidth: 800 }}>
          {char.description}
        </div>
      )}

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 10, marginBottom: 24 }}>
        Appears in {char.scene_count} of {totalScenes || '?'} scenes
        {stats.firstScene && stats.lastScene && (
          <>
            {' '}{'\u00B7'} POV from S{String(stats.firstScene.n).padStart(2, '0')} to S{String(stats.lastScene.n).padStart(2, '0')}
          </>
        )}
      </div>

      {/* Bio */}
      <div style={{ ...sectionStyle, marginBottom: 16 }}>
        <Label>Bio</Label>
        {char.bio ? (
          <div
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 15,
              lineHeight: 1.65,
              marginTop: 10,
              color: 'var(--ink)',
              whiteSpace: 'pre-wrap',
              maxWidth: 780,
            }}
          >
            {char.bio}
          </div>
        ) : (
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontStyle: 'italic', color: 'var(--ink-3)', marginTop: 10 }}>
            No bio yet. Click <strong>Edit</strong> to add one.
          </div>
        )}
      </div>

      {/* Desire / Flaw */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={sectionStyle}>
          <Label>Desire</Label>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, marginTop: 8, lineHeight: 1.5, color: char.desire ? 'var(--ink)' : 'var(--ink-3)', fontStyle: char.desire ? 'normal' : 'italic' }}>
            {char.desire || 'No desire defined'}
          </div>
        </div>
        <div style={sectionStyle}>
          <Label>Flaw</Label>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, marginTop: 8, lineHeight: 1.5, color: char.flaw ? 'var(--ink)' : 'var(--ink-3)', fontStyle: char.flaw ? 'normal' : 'italic' }}>
            {char.flaw || 'No flaw defined'}
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 16 }}>
        <div style={sectionStyle}>
          <Label>Scene count</Label>
          <div style={statValueStyle}>{char.scene_count}</div>
        </div>
        <div style={sectionStyle}>
          <Label>Longest gap</Label>
          <div style={{ ...statValueStyle, color: char.longest_gap > 10 ? 'var(--red)' : 'var(--ink)' }}>
            {char.longest_gap || '\u2014'}
          </div>
        </div>
        <div style={sectionStyle}>
          <Label>Peak tension</Label>
          <div style={statValueStyle}>{stats.peakTension || '\u2014'}</div>
        </div>
        <div style={sectionStyle}>
          <Label>Avg tension</Label>
          <div style={statValueStyle}>
            {stats.avgTension ? stats.avgTension.toFixed(1) : '\u2014'}
          </div>
        </div>
        <div style={sectionStyle}>
          <Label>Relationships</Label>
          <div style={statValueStyle}>{relatedEdges.length}</div>
        </div>
      </div>

      {/* Act distribution */}
      <div style={{ ...sectionStyle, marginBottom: 16 }}>
        <Label>Act distribution (POV scenes)</Label>
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {(['I', 'II', 'III'] as const).map((label, idx) => {
            const count = stats.actCounts[idx]
            const max = Math.max(1, ...stats.actCounts)
            return (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                  <span>Act {label}</span>
                  <span>{count}</span>
                </div>
                <div style={{ marginTop: 4, height: 6, background: 'var(--line)' }}>
                  <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: 'var(--ink)' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tension across their POV scenes (real data) */}
      {characterScenes.length > 0 && (
        <div style={{ ...sectionStyle, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Label>Tension across POV scenes</Label>
            <Label>{characterScenes.length} scenes</Label>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 3, alignItems: 'flex-end', height: 80 }}>
            {characterScenes.map((s) => (
              <button
                key={s.id}
                title={`S${String(s.n).padStart(2, '0')} ${s.title} (T${s.tension})`}
                onClick={() => navigate({ to: '/stories/$storyId/scenes/$id', params: { storyId, id: s.id } })}
                style={{
                  flex: 1,
                  minWidth: 6,
                  height: `${(s.tension / 10) * 100}%`,
                  background: s.tension >= 8 ? 'var(--red)' : s.tension >= 5 ? 'var(--ink)' : 'var(--ink-3)',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
            Click a bar to open the scene
          </div>
        </div>
      )}

      {/* Presence strip across full story */}
      <div style={{ ...sectionStyle, marginBottom: 16 }}>
        <Label>Presence across the story</Label>
        <div style={{ marginTop: 10, maxWidth: 600 }}>
          <PresenceStrip characterIndex={charIndex >= 0 ? charIndex : 0} sceneCount={char.scene_count} />
        </div>
      </div>

      {/* POV scene list */}
      {characterScenes.length > 0 && (
        <div style={{ ...sectionStyle, marginBottom: 16 }}>
          <Label>POV scenes</Label>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {characterScenes.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate({ to: '/stories/$storyId/scenes/$id', params: { storyId, id: s.id } })}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 80px 60px',
                  gap: 12,
                  padding: '8px 12px',
                  background: 'var(--paper-2)',
                  border: 'none',
                  borderLeft: '3px solid var(--ink)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  alignItems: 'center',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                  S{String(s.n).padStart(2, '0')}
                </span>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 14 }}>{s.title}</span>
                <Tag>{s.tag}</Tag>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: s.tension >= 8 ? 'var(--red)' : 'var(--ink-2)' }}>
                  T {s.tension}/10
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Relationships */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Label>Relationships ({relatedEdges.length})</Label>
          <Label>From the character graph</Label>
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {relatedEdges.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
              No relationships in graph yet. Try "Suggest Relationships" on the Graph page.
            </div>
          )}
          {relatedEdges.map(({ edge, otherChar, otherNodeLabel }) => {
            const display = otherChar ? otherChar.name : otherNodeLabel
            return (
              <div
                key={edge.id}
                onClick={() => {
                  if (otherChar) {
                    navigate({ to: '/stories/$storyId/characters/$id', params: { storyId, id: otherChar.id } })
                  }
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 80px 60px',
                  gap: 12,
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'var(--paper-2)',
                  borderLeft: '3px solid var(--ink)',
                  cursor: otherChar ? 'pointer' : 'default',
                  fontSize: 12,
                }}
              >
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 14 }}>{display}</span>
                <Tag style={{ fontSize: 10 }}>{edge.kind}</Tag>
                <div style={{ width: 60 }}>
                  <TensionBar value={Math.round(edge.weight * 10)} max={10} height={5} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                  w {edge.weight.toFixed(2)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <EditCharacterModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        storyId={storyId}
        character={char}
      />
    </div>
  )
}
