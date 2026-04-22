import { Fragment, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Tag, Btn, Label } from '../components/primitives'
import { LoadingState } from '../components/LoadingState'
import { useDeleteScene, useScenes, useScene, useUpdateScene } from '../api/scenes'
import { useCharacters } from '../api/characters'
import { useChapters } from '../api/manuscript'
import {
  useCoreTree,
  useCoreSettings,
  useCreateCoreSetting,
  useUpdateCoreSetting,
} from '../api/core'
import type { Beat, CoreConfigNode, Scene, SceneMetric } from '../types'
import { BEAT_KINDS, SCENE_METRICS } from '../types'
import {
  useBeats,
  useCreateBeat,
  useDeleteBeat,
  useReorderBeats,
  useUpdateBeat,
} from '../api/beats'
import { useComments, useCreateComment } from '../api/collaboration'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SceneDetailPage() {
  const navigate = useNavigate()
  const { storyId, id } = Route.useParams()
  const { data: sceneData, isLoading: sceneLoading } = useScene(storyId, id)
  const { data: scenesData, isLoading: scenesLoading } = useScenes(storyId)
  const deleteScene = useDeleteScene(storyId)

  if (sceneLoading || scenesLoading) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,29,36,0.35)', backdropFilter: 'blur(0.5px)' }} />
        <div style={{ position: 'relative', background: 'var(--paper)', border: '2px solid var(--ink)', boxShadow: '8px 8px 0 var(--ink)', padding: '40px 60px' }}>
          <LoadingState />
        </div>
      </div>
    )
  }

  const scene = sceneData
  const scenes = scenesData?.items ?? []

  if (!scene) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(26,29,36,0.35)', backdropFilter: 'blur(0.5px)' }}
          onClick={() => navigate({ to: '/stories/$storyId/scenes', params: { storyId } })}
        />
        <div style={{ position: 'relative', background: 'var(--paper)', border: '2px solid var(--ink)', boxShadow: '8px 8px 0 var(--ink)', padding: '40px 60px', textAlign: 'center' }}>
          <div className="title-serif" style={{ fontSize: 24, marginBottom: 12 }}>Scene not found</div>
          <Btn onClick={() => navigate({ to: '/stories/$storyId/scenes', params: { storyId } })}>Back to scenes</Btn>
        </div>
      </div>
    )
  }

  const sorted = [...scenes].sort((a, b) => a.n - b.n)
  const currentIdx = sorted.findIndex(s => s.id === id)
  const prevScene = currentIdx > 0 ? sorted[currentIdx - 1] : null
  const nextScene = currentIdx < sorted.length - 1 ? sorted[currentIdx + 1] : null

  const fields: [string, string][] = [
    ['POV', scene.pov],
    ['Location', scene.location],
    ['Act', `Act ${scene.act}`],
    ['Tag', scene.tag],
    ['Tension', `${scene.tension}/10`],
  ]

  if (scene.summary) {
    fields.push(['Summary', scene.summary])
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete scene ${scene.n}: ${scene.title}? This cannot be undone.`)) return
    await deleteScene.mutateAsync(scene.id)
    navigate({ to: '/stories/$storyId/scenes', params: { storyId } })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999 }}>
      {/* Blurred background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(26,29,36,0.35)',
          backdropFilter: 'blur(0.5px)',
        }}
        onClick={() => navigate({ to: '/stories/$storyId/scenes', params: { storyId } })}
      />

      {/* Modal dialog */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 720,
            maxWidth: '96%',
            background: 'var(--paper)',
            border: '2px solid var(--ink)',
            boxShadow: '8px 8px 0 var(--ink)',
            position: 'relative',
            pointerEvents: 'auto',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 24px',
              borderBottom: '1px solid var(--ink)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <Label>Scene {String(scene.n).padStart(2, '0')} &middot; Act {scene.act === 1 ? 'I' : scene.act === 2 ? 'II' : 'III'}</Label>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 26 }}>{scene.title}</span>
              <Tag variant="blue">{scene.tag}</Tag>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {prevScene && (
                <Btn variant="ghost" onClick={() => navigate({ to: '/stories/$storyId/scenes/$id', params: { storyId, id: prevScene.id } })}>
                  &laquo; S{String(prevScene.n).padStart(2, '0')}
                </Btn>
              )}
              {nextScene && (
                <Btn variant="ghost" onClick={() => navigate({ to: '/stories/$storyId/scenes/$id', params: { storyId, id: nextScene.id } })}>
                  S{String(nextScene.n).padStart(2, '0')} &raquo;
                </Btn>
              )}
              <Btn variant="ghost" onClick={() => navigate({ to: '/stories/$storyId/scenes', params: { storyId } })}>&#x2715;</Btn>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '22px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '10px 16px', fontSize: 12, lineHeight: 1.6 }}>
              {fields.map(([k, v]) => (
                <Fragment key={k}>
                  <Label>{k}</Label>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{v}</span>
                </Fragment>
              ))}
            </div>

            <div style={{ marginTop: 20 }}>
              <Label>Summary</Label>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 15,
                  lineHeight: 1.55,
                  marginTop: 6,
                  color: 'var(--ink)',
                }}
              >
                {scene.summary || `Scene ${scene.n}: ${scene.title}. POV: ${scene.pov}, Location: ${scene.location}.`}
              </div>
            </div>

            <DramaticStructure storyId={storyId} scene={scene} />

            <TensionFacets storyId={storyId} scene={scene} />

            <Beats storyId={storyId} scene={scene} />

            <ChapterAssignment storyId={storyId} scene={scene} />

            <Participants storyId={storyId} scene={scene} />

            <SceneComments storyId={storyId} sceneId={scene.id} />
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '12px 24px',
              borderTop: '1px solid var(--ink)',
              background: 'var(--paper-2)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={() => navigate({ to: '/stories/$storyId/draft', params: { storyId } })}>Open in Draft</Btn>
              <Btn variant="ghost" onClick={() => navigate({ to: '/stories/$storyId/ai', params: { storyId } })}>Linked AI</Btn>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={handleDelete} disabled={deleteScene.isPending}>
                {deleteScene.isPending ? 'Deleting...' : 'Delete'}
              </Btn>
              <Btn variant="solid" disabled>Saved</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/stories/$storyId/scenes/$id')({
  component: SceneDetailPage,
})

const DRAMATIC_FIELDS = [
  { key: 'Goal', hint: 'What the POV character wants in this scene.' },
  { key: 'Conflict', hint: 'What gets in the way?' },
  { key: 'Obstacle', hint: 'The specific impediment or opposition.' },
  { key: 'Outcome', hint: 'How it ends — success, failure, reversal.' },
  { key: 'Emotional turn', hint: 'The shift in feeling from start to end.' },
] as const

const SCENE_LABEL_RE = /^S?0*(\d+)/i

function findSceneNode(tree: CoreConfigNode[] | undefined, n: number): CoreConfigNode | undefined {
  if (!tree) return undefined
  for (const node of tree) {
    if (node.kind !== 'scene') continue
    const matched = node.label.match(SCENE_LABEL_RE)
    if (matched && Number(matched[1]) === n) return node
  }
  return undefined
}

function DramaticStructure({ storyId, scene }: { storyId: string; scene: Scene }) {
  const { data: tree } = useCoreTree(storyId)
  const node = useMemo(() => findSceneNode(tree, scene.n), [tree, scene.n])
  const { data: settings } = useCoreSettings(storyId, node?.id ?? null)
  const createSetting = useCreateCoreSetting(storyId)
  const updateSetting = useUpdateCoreSetting(storyId)

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const pending = createSetting.isPending || updateSetting.isPending

  function getValue(key: string): string | null {
    if (!settings) return null
    const s = settings.find((x) => x.key.toLowerCase() === key.toLowerCase())
    return s?.is_override ? s.value : null
  }

  function startEdit(key: string, current: string | null) {
    if (!node) return
    setEditingKey(key)
    setDraft(current ?? '')
    setError(null)
  }

  function cancelEdit() {
    setEditingKey(null)
    setDraft('')
    setError(null)
  }

  function save(key: string) {
    if (!node) return
    const trimmed = draft.trim()
    if (!trimmed) {
      setError('Value cannot be empty')
      return
    }
    const existing = settings?.find((x) => x.key.toLowerCase() === key.toLowerCase())
    const onDone = () => { setEditingKey(null); setDraft(''); setError(null) }
    const onErr = (err: unknown) => setError(err instanceof Error ? err.message : 'Failed to save')

    if (existing?.is_override) {
      updateSetting.mutate({ key, nodeId: node.id, value: trimmed }, { onSuccess: onDone, onError: onErr })
    } else {
      createSetting.mutate(
        { key, value: trimmed, source: 'user', config_node_id: node.id },
        { onSuccess: onDone, onError: onErr },
      )
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <Label>Dramatic structure</Label>
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column' }}>
        {DRAMATIC_FIELDS.map(({ key, hint }) => {
          const value = getValue(key)
          const isEditing = editingKey === key
          return (
            <div
              key={key}
              style={{
                display: 'grid',
                gridTemplateColumns: '110px 1fr',
                gap: 12,
                padding: '6px 0',
                borderBottom: '1px dashed var(--line-2)',
                alignItems: 'start',
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-3)', paddingTop: 3 }}>
                {key}
              </div>
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <input
                    value={draft}
                    onChange={(ev) => setDraft(ev.target.value)}
                    autoFocus
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter') save(key)
                      if (ev.key === 'Escape') cancelEdit()
                    }}
                    placeholder={hint}
                    style={{
                      padding: '4px 6px',
                      border: '1px solid var(--ink-3)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      background: 'var(--paper)',
                      color: 'var(--ink)',
                    }}
                  />
                  {error && <span style={{ color: 'var(--red)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>{error}</span>}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Btn variant="ghost" onClick={() => save(key)} disabled={pending}>Save</Btn>
                    <Btn variant="ghost" onClick={cancelEdit}>Cancel</Btn>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => startEdit(key, value)}
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 14,
                    lineHeight: 1.45,
                    color: value ? 'var(--ink)' : 'var(--ink-3)',
                    cursor: node ? 'pointer' : 'default',
                    padding: '2px 0',
                    minHeight: 20,
                  }}
                  title={node ? (value ? 'Click to edit' : hint) : 'No config node for this scene'}
                >
                  {value ?? '—'}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ChapterAssignment({ storyId, scene }: { storyId: string; scene: Scene }) {
  const { data: chaptersData } = useChapters(storyId)
  const update = useUpdateScene(storyId)
  const chapters = chaptersData ?? []

  const handleChange = (value: string) => {
    update.mutate({ sceneId: scene.id, chapter_id: value || null })
  }

  return (
    <div style={{ marginTop: 20 }}>
      <Label>Chapter</Label>
      <div style={{ marginTop: 6 }}>
        <select
          value={scene.chapter_id ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          disabled={update.isPending}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            padding: '6px 8px',
            border: '1px solid var(--ink-3)',
            background: 'var(--paper)',
            color: 'var(--ink)',
            minWidth: 260,
          }}
        >
          <option value="">— Unassigned —</option>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              Ch {c.num} — {c.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

function Participants({ storyId, scene }: { storyId: string; scene: Scene }) {
  const { data: charactersData } = useCharacters(storyId)
  const update = useUpdateScene(storyId)
  const characters = charactersData?.items ?? []

  const charById = useMemo(() => {
    const map = new Map(characters.map((c) => [c.id, c]))
    return map
  }, [characters])

  const current = scene.participants ?? []
  const currentIds = new Set(current.map((p) => p.character_id))

  const [addOpen, setAddOpen] = useState(false)

  const writeAll = (next: Array<{ character_id: string; role: string }>) => {
    update.mutate({ sceneId: scene.id, participants: next })
  }

  const remove = (characterId: string) => {
    const next = current
      .filter((p) => p.character_id !== characterId)
      .map((p) => ({ character_id: p.character_id, role: p.role }))
    writeAll(next)
  }

  const setRole = (characterId: string, role: string) => {
    const next = current.map((p) => ({
      character_id: p.character_id,
      role: p.character_id === characterId ? role : p.role,
    }))
    writeAll(next)
  }

  const add = (characterId: string) => {
    const next = [
      ...current.map((p) => ({ character_id: p.character_id, role: p.role })),
      { character_id: characterId, role: 'supporting' },
    ]
    writeAll(next)
    setAddOpen(false)
  }

  const ROLE_OPTIONS = ['pov', 'supporting', 'antagonist', 'mentioned', 'ensemble'] as const
  const available = characters.filter((c) => !currentIds.has(c.id))

  return (
    <div style={{ marginTop: 20 }}>
      <Label>Participants</Label>
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {current.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>
            No participants yet.
          </div>
        )}
        {current.map((p) => {
          const char = charById.get(p.character_id)
          return (
            <div
              key={p.character_id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 140px auto',
                gap: 10,
                alignItems: 'center',
                padding: '6px 0',
                borderBottom: '1px dashed var(--line-2)',
              }}
            >
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 14 }}>
                {char?.name ?? '(removed character)'}
              </span>
              <select
                value={p.role}
                onChange={(e) => setRole(p.character_id, e.target.value)}
                disabled={update.isPending}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  padding: '4px 6px',
                  border: '1px solid var(--ink-3)',
                  background: 'var(--paper)',
                  color: 'var(--ink)',
                }}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
                {!ROLE_OPTIONS.includes(p.role as typeof ROLE_OPTIONS[number]) && (
                  <option value={p.role}>{p.role}</option>
                )}
              </select>
              <button
                onClick={() => remove(p.character_id)}
                disabled={update.isPending}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--ink-3)',
                  color: 'var(--ink-2)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  padding: '3px 8px',
                  cursor: 'pointer',
                }}
                title="Remove participant"
              >
                Remove
              </button>
            </div>
          )
        })}

        {addOpen ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
            <select
              autoFocus
              defaultValue=""
              onChange={(e) => e.target.value && add(e.target.value)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                padding: '4px 8px',
                border: '1px solid var(--ink-3)',
                background: 'var(--paper)',
                color: 'var(--ink)',
                minWidth: 220,
              }}
            >
              <option value="" disabled>Pick a character…</option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.role ? `· ${c.role}` : ''}
                </option>
              ))}
            </select>
            <Btn variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Btn>
          </div>
        ) : (
          available.length > 0 && (
            <button
              onClick={() => setAddOpen(true)}
              disabled={update.isPending}
              style={{
                marginTop: 6,
                background: 'transparent',
                border: '1px dashed var(--ink-3)',
                color: 'var(--ink-3)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '6px 10px',
                cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              + Add participant
            </button>
          )
        )}
      </div>
    </div>
  )
}

const FACET_LABELS: Record<SceneMetric | 'tension', string> = {
  tension: 'Tension',
  emotional: 'Emotional',
  stakes: 'Stakes',
  mystery: 'Mystery',
  romance: 'Romance',
  danger: 'Danger',
  hope: 'Hope',
}

const FACET_HINTS: Record<SceneMetric | 'tension', string> = {
  tension: 'Overall dramatic pressure (1-10).',
  emotional: 'Raw feeling intensity — grief, rage, longing.',
  stakes: 'How much is on the line for the POV character.',
  mystery: 'Unresolved questions surfacing or deepening.',
  romance: 'Affection, attraction, intimacy.',
  danger: 'Physical or existential threat level.',
  hope: 'Belief that a better outcome is possible.',
}

function FacetRow({
  label,
  hint,
  value,
  min,
  onCommit,
}: {
  label: string
  hint: string
  value: number
  min: 0 | 1
  onCommit: (n: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const current = Math.max(min, Math.min(10, Number(draft) || min))
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '100px 1fr 60px',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <div title={hint}>
        <Label>{label}</Label>
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 6,
              background: i < current ? 'var(--ink)' : 'var(--line-2)',
            }}
          />
        ))}
      </div>
      <input
        type="number"
        min={min}
        max={10}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Math.max(min, Math.min(10, parseInt(draft, 10) || min))
          setDraft(String(n))
          if (n !== value) onCommit(n)
        }}
        style={{
          width: 56,
          padding: '4px 8px',
          border: '1px solid var(--ink-3)',
          background: 'var(--paper)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          textAlign: 'center',
        }}
      />
    </div>
  )
}

function TensionFacets({ storyId, scene }: { storyId: string; scene: Scene }) {
  const update = useUpdateScene(storyId)
  const commit = (patch: Partial<Pick<Scene, 'tension' | SceneMetric>>) => {
    update.mutate({ sceneId: scene.id, ...patch })
  }
  return (
    <div style={{ marginTop: 24 }}>
      <Label>Tension facets</Label>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4, marginBottom: 10 }}>
        Score each dimension 0-10. 0 means "not applicable in this scene" — layered facets stay hidden in the Timeline until they have a non-zero score somewhere.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FacetRow
          label={FACET_LABELS.tension}
          hint={FACET_HINTS.tension}
          value={scene.tension}
          min={1}
          onCommit={(n) => commit({ tension: n })}
        />
        {SCENE_METRICS.map((m) => (
          <FacetRow
            key={m}
            label={FACET_LABELS[m]}
            hint={FACET_HINTS[m]}
            value={scene[m]}
            min={0}
            onCommit={(n) => commit({ [m]: n } as Partial<Pick<Scene, SceneMetric>>)}
          />
        ))}
      </div>
    </div>
  )
}

function Beats({ storyId, scene }: { storyId: string; scene: Scene }) {
  const { data: beats } = useBeats(storyId, scene.id)
  const create = useCreateBeat(storyId, scene.id)
  const reorder = useReorderBeats(storyId, scene.id)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const items = beats ?? []
  const itemIds = items.map((b) => b.id)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = items.findIndex((b) => b.id === active.id)
    const toIndex = items.findIndex((b) => b.id === over.id)
    if (fromIndex === -1 || toIndex === -1) return
    const next = arrayMove(items, fromIndex, toIndex)
    reorder.mutate(next.map((b) => b.id))
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Label>Beats</Label>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
          {items.length} beat{items.length === 1 ? '' : 's'}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4, marginBottom: 10 }}>
        The smallest units inside this scene — setup, action, reaction, decision, reveal, turn. Grab the handle to reorder.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              {items.map((b) => (
                <BeatRow key={b.id} storyId={storyId} sceneId={scene.id} beat={b} />
              ))}
            </SortableContext>
          </DndContext>
        )}
        {items.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', padding: '4px 0' }}>
            No beats yet. Add the first one to sketch what moves inside this scene.
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={create.isPending}
        onClick={() => create.mutate({ title: '', kind: 'action' })}
        style={{
          marginTop: 10,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          border: '1px dashed var(--ink-3)',
          background: 'transparent',
          padding: '6px 10px',
          cursor: create.isPending ? 'default' : 'pointer',
          opacity: create.isPending ? 0.6 : 1,
        }}
      >
        + Add beat
      </button>
    </div>
  )
}

function BeatRow({
  storyId,
  sceneId,
  beat,
}: {
  storyId: string
  sceneId: string
  beat: Beat
}) {
  const update = useUpdateBeat(storyId, sceneId)
  const remove = useDeleteBeat(storyId, sceneId)
  const [title, setTitle] = useState(beat.title)
  const [summary, setSummary] = useState(beat.summary ?? '')
  const [expanded, setExpanded] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: beat.id,
  })
  const rowStyle: React.CSSProperties = {
    border: '1px solid var(--line)',
    background: 'var(--paper)',
    padding: '8px 10px',
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const commitTitle = () => {
    if (title !== beat.title) update.mutate({ beatId: beat.id, title })
  }
  const commitKind = (kind: string) => {
    if (kind !== beat.kind) update.mutate({ beatId: beat.id, kind })
  }
  const commitSummary = () => {
    const next = summary.trim() === '' ? null : summary
    if (next !== (beat.summary ?? null)) {
      update.mutate({ beatId: beat.id, summary: next })
    }
  }

  return (
    <div ref={setNodeRef} style={rowStyle}>
      <div style={{ display: 'grid', gridTemplateColumns: '14px 34px 90px 1fr 20px', gap: 8, alignItems: 'center' }}>
        <span
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          style={{
            cursor: 'grab',
            color: 'var(--ink-3)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            lineHeight: 1,
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
          ⋮⋮
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
          B{String(beat.n).padStart(2, '0')}
        </span>
        <select
          value={beat.kind}
          onChange={(e) => commitKind(e.target.value)}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '2px 6px',
            border: '1px solid var(--line)',
            background: 'var(--paper)',
          }}
        >
          {BEAT_KINDS.includes(beat.kind as (typeof BEAT_KINDS)[number])
            ? null
            : <option value={beat.kind}>{beat.kind}</option>}
          {BEAT_KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          placeholder="Beat title — one short line"
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 14,
            border: 'none',
            borderBottom: '1px solid var(--line)',
            background: 'transparent',
            padding: '3px 0',
            outline: 'none',
            minWidth: 0,
          }}
        />
        <button
          type="button"
          aria-label="Delete beat"
          disabled={remove.isPending}
          onClick={() => remove.mutate(beat.id)}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--ink-3)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            cursor: remove.isPending ? 'default' : 'pointer',
          }}
          title="Delete beat"
        >
          ×
        </button>
      </div>

      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--ink-3)',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          {expanded ? '− Hide summary' : '+ Add summary'}
        </button>
      </div>

      {expanded && (
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={commitSummary}
          placeholder="Optional — what happens in this beat, in prose."
          rows={2}
          style={{
            width: '100%',
            marginTop: 4,
            fontFamily: 'var(--font-serif)',
            fontSize: 13,
            lineHeight: 1.45,
            border: '1px solid var(--line)',
            background: 'var(--paper-2)',
            padding: 6,
            outline: 'none',
            resize: 'vertical',
          }}
        />
      )}
    </div>
  )
}

function SceneComments({ storyId, sceneId }: { storyId: string; sceneId: string }) {
  const { data: comments } = useComments(storyId, sceneId)
  const create = useCreateComment(storyId)
  const [draft, setDraft] = useState('')

  const submit = async () => {
    if (!draft.trim()) return
    await create.mutateAsync({ body: draft.trim(), scene_id: sceneId })
    setDraft('')
  }

  const list = comments ?? []

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Label>Comments</Label>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
          {list.length} comment{list.length === 1 ? '' : 's'}
        </span>
      </div>

      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {list.map((c) => (
          <div
            key={c.id}
            style={{
              border: '1px solid var(--line)',
              background: 'var(--paper)',
              padding: '8px 10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>
                {c.user_id.slice(0, 8)}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                {new Date(c.created_at).toLocaleString()}
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, lineHeight: 1.5, color: 'var(--ink)' }}>
              {c.body}
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', padding: '4px 0' }}>
            No comments on this scene yet.
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Leave a note on this scene…"
          rows={2}
          style={{
            flex: 1,
            fontFamily: 'var(--font-serif)',
            fontSize: 13,
            padding: '6px 8px',
            border: '1px solid var(--ink-3)',
            background: 'var(--paper)',
            outline: 'none',
            resize: 'vertical',
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={create.isPending || !draft.trim()}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            padding: '6px 12px',
            border: '1px solid var(--ink)',
            background: create.isPending || !draft.trim() ? 'var(--paper-2)' : 'var(--ink)',
            color: create.isPending || !draft.trim() ? 'var(--ink-3)' : 'var(--paper)',
            cursor: create.isPending || !draft.trim() ? 'default' : 'pointer',
            alignSelf: 'flex-end',
          }}
        >
          {create.isPending ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  )
}
