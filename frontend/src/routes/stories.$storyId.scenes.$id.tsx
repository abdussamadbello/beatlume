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
import type { CoreConfigNode, Scene } from '../types'

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

            <ChapterAssignment storyId={storyId} scene={scene} />

            <Participants storyId={storyId} scene={scene} />
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
