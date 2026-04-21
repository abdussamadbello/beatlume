import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Tag, Btn, Label } from '../components/primitives'
import { LoadingState } from '../components/LoadingState'
import {
  useCoreTree,
  useCoreSettings,
  useUpdateCoreSetting,
  useCreateCoreSetting,
  useDeleteCoreSetting,
} from '../api/core'
import { useScenes } from '../api/scenes'
import { useChapters } from '../api/manuscript'
import { useStore } from '../store'
import type { CoreConfigNode, ResolvedCoreSetting, TagVariant } from '../types'

const iconMap = { story: '\u25C7', part: '\u25A4', chap: '\u25AB', scene: '\u00B7', beat: '\u2219' } as const

function sourceVariant(source: string): TagVariant | undefined {
  const s = source.toLowerCase()
  if (s === 'ai') return 'blue'
  if (s === 'system') return 'amber'
  return undefined
}

export const Route = createFileRoute('/stories/$storyId/core')({
  validateSearch: (search: Record<string, unknown>) => ({
    chapter: typeof search.chapter === 'string' ? search.chapter : undefined,
  }),
  component: CorePage,
})

function CorePage() {
  const { storyId } = Route.useParams()
  const navigate = useNavigate()
  const { data: coreTree, isLoading: treeLoading } = useCoreTree(storyId)
  const { data: scenesData } = useScenes(storyId)
  const { data: chaptersData } = useChapters(storyId)
  const activeCoreIndex = useStore(s => s.activeCoreIndex)
  const setActiveCoreIndex = useStore(s => s.setActiveCoreIndex)

  const tree = coreTree ?? []
  const activeNode = tree[activeCoreIndex]
  // The story root (depth 0) has no overrides of its own, so fetch the
  // story-root bucket; every other node is scoped by its id.
  const activeNodeId = activeNode && activeNode.kind !== 'story' ? activeNode.id : null
  const { data: coreSettings, isLoading: settingsLoading } = useCoreSettings(storyId, activeNodeId)

  const updateSetting = useUpdateCoreSetting(storyId)
  const createSetting = useCreateCoreSetting(storyId)
  const deleteSetting = useDeleteCoreSetting(storyId)

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (treeLoading || settingsLoading) return <LoadingState />

  const settings = coreSettings ?? []
  const scenes = scenesData?.items ?? []
  const chapters = chaptersData ?? []
  const isStoryLevel = !activeNode || activeNode.kind === 'story'

  function handleNodeClick(_node: CoreConfigNode, index: number) {
    setActiveCoreIndex(index)
    // Tree selection always updates local state; we do NOT auto-navigate
    // anymore because the whole point now is that clicking a node changes
    // the settings panel. Users can still deep-link to Scene Detail or
    // Manuscript explicitly via the "Open" button rendered for navigable
    // nodes below.
  }

  function openNodeTarget(node: CoreConfigNode) {
    if (node.kind === 'scene') {
      const match = /^S?0*(\d+)/i.exec(node.label)
      if (match) {
        const n = Number(match[1])
        const scene = scenes.find(s => s.n === n)
        if (scene) {
          navigate({ to: '/stories/$storyId/scenes/$id', params: { storyId, id: scene.id } })
          return
        }
      }
    }
    if (node.kind === 'chap') {
      const match = /Ch\s*0*(\d+)/i.exec(node.label)
      if (match) {
        const num = match[1]
        const chapter = chapters.find(c => String(c.num) === num)
        if (chapter) {
          navigate({
            to: '/stories/$storyId/manuscript',
            params: { storyId },
            search: { chapter: num },
          })
        }
      }
    }
  }

  function startEdit(setting: ResolvedCoreSetting) {
    setEditingKey(setting.key)
    setEditingValue(setting.value)
    setErrorMsg(null)
  }

  function cancelEdit() {
    setEditingKey(null)
    setEditingValue('')
  }

  /** Write the edited value back. If the setting is currently inherited from
   *  an ancestor, this creates a node-scoped override on the active node. If
   *  it's already defined on this node, it updates the existing row. */
  function saveEdit(setting: ResolvedCoreSetting) {
    const trimmed = editingValue.trim()
    if (!trimmed) {
      setErrorMsg('Value cannot be empty')
      return
    }
    const onDone = () => {
      setEditingKey(null)
      setEditingValue('')
      setErrorMsg(null)
    }
    const onErr = (err: unknown) =>
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save')

    if (setting.is_override) {
      // Existing node-level row: update it.
      updateSetting.mutate(
        { key: setting.key, nodeId: activeNodeId, value: trimmed },
        { onSuccess: onDone, onError: onErr },
      )
      return
    }
    if (isStoryLevel) {
      // Story-root row: update in place.
      updateSetting.mutate(
        { key: setting.key, nodeId: null, value: trimmed },
        { onSuccess: onDone, onError: onErr },
      )
      return
    }
    // Inherited from an ancestor but we're on a descendant node: creating
    // here implicitly becomes an override on the active node.
    createSetting.mutate(
      {
        key: setting.key,
        value: trimmed,
        source: 'user',
        config_node_id: activeNodeId ?? undefined,
      },
      { onSuccess: onDone, onError: onErr },
    )
  }

  function handleAccept(setting: ResolvedCoreSetting) {
    setErrorMsg(null)
    updateSetting.mutate(
      {
        key: setting.key,
        nodeId: setting.defined_at_node_id,
        value: setting.value,
        source: 'user',
        tag: null,
      },
      {
        onError: (err: unknown) =>
          setErrorMsg(err instanceof Error ? err.message : 'Failed to accept'),
      },
    )
  }

  /** Delete either a node override (on the active node) or a story-root
   *  row. Inherited-only rows show a "Revert to inherit" which is the same
   *  as deleting the node override — hence we always use the node the row
   *  is defined on. */
  function handleDelete(setting: ResolvedCoreSetting) {
    setErrorMsg(null)
    deleteSetting.mutate(
      { key: setting.key, nodeId: setting.defined_at_node_id },
      {
        onError: (err: unknown) =>
          setErrorMsg(err instanceof Error ? err.message : 'Failed to delete'),
      },
    )
  }

  function submitCreate() {
    const key = newKey.trim()
    const value = newValue.trim()
    if (!key || !value) {
      setErrorMsg('Both key and value are required')
      return
    }
    createSetting.mutate(
      {
        key,
        value,
        source: 'user',
        config_node_id: isStoryLevel ? undefined : activeNodeId ?? undefined,
      },
      {
        onSuccess: () => {
          setShowCreate(false)
          setNewKey('')
          setNewValue('')
          setErrorMsg(null)
        },
        onError: (err: unknown) =>
          setErrorMsg(err instanceof Error ? err.message : 'Failed to create setting'),
      },
    )
  }

  const addButtonLabel = isStoryLevel ? '+ Setting' : '+ Override'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--ink)' }}>
        <div>
          <Label>Narrative Core</Label>
          <div className="title-serif" style={{ fontSize: 22 }}>Configuration hierarchy</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" onClick={() => { setShowCreate(false); setEditingKey(null); setErrorMsg(null) }}>
            Reset
          </Btn>
          <Btn onClick={() => { setShowCreate(true); setErrorMsg(null) }}>{addButtonLabel}</Btn>
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            padding: '8px 24px',
            background: 'var(--paper-2)',
            borderBottom: '1px solid var(--red)',
            color: 'var(--red)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}
        >
          {errorMsg}
        </div>
      )}

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '330px 1fr', overflow: 'hidden' }}>
        <div style={{ borderRight: '1px solid var(--ink)', padding: 14, fontFamily: 'var(--font-mono)', fontSize: 12, overflow: 'auto' }}>
          <div className="dim" style={{ padding: '0 0 10px 8px', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Structure
          </div>
          {tree.length === 0 && (
            <div className="dim" style={{ padding: '24px 8px', fontSize: 11, lineHeight: 1.6 }}>
              No structural hierarchy yet.
            </div>
          )}
          {tree.map((n, i) => {
            const icon = iconMap[n.kind]
            const isActive = i === activeCoreIndex
            const isNavigable = n.kind === 'scene' || n.kind === 'chap'
            return (
              <div
                key={n.id}
                onClick={() => handleNodeClick(n, i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: `5px 0 5px ${n.depth * 16 + 8}px`,
                  background: isActive ? 'var(--paper-2)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--blue)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                <span style={{ color: 'var(--ink-3)', width: 10 }}>{icon}</span>
                <span style={{ flex: 1 }}>{n.label}</span>
                {isNavigable && isActive && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      openNodeTarget(n)
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--ink-3)',
                      color: 'var(--ink-2)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      padding: '1px 4px',
                      cursor: 'pointer',
                    }}
                    title={`Open ${n.kind === 'scene' ? 'scene detail' : 'manuscript chapter'}`}
                  >
                    Open
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ overflow: 'auto' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--ink)', background: 'var(--paper-2)' }}>
            <Label>Resolving settings for</Label>
            <div className="title-serif" style={{ fontSize: 20 }}>
              {activeNode ? activeNode.label : 'Configuration'}
            </div>
            <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
              {isStoryLevel
                ? 'Story-level defaults. These cascade into every chapter and scene unless explicitly overridden.'
                : `Inherited from ancestors unless this ${activeNode?.kind} defines its own override. Click a value to edit; editing an inherited row creates an override here.`}
            </div>
          </div>

          {showCreate && (
            <div
              style={{
                padding: '12px 22px',
                borderBottom: '1px solid var(--line)',
                background: 'var(--paper)',
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {isStoryLevel ? 'New story-level setting' : `New override at ${activeNode?.label}`}
              </div>
              <input
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                placeholder="Key (e.g. POV)"
                style={inputStyle}
              />
              <input
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                placeholder="Value"
                style={{ ...inputStyle, flex: 1 }}
              />
              <Btn onClick={submitCreate} disabled={createSetting.isPending}>
                {createSetting.isPending ? 'Saving...' : 'Save'}
              </Btn>
              <Btn variant="ghost" onClick={() => { setShowCreate(false); setNewKey(''); setNewValue(''); setErrorMsg(null) }}>
                Cancel
              </Btn>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', background: 'var(--paper-2)' }}>
                <th style={thStyle}>Setting</th>
                <th style={thStyle}>Resolved</th>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Defined at</th>
                <th style={{ ...thStyle, textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {settings.length === 0 && !showCreate && (
                <tr>
                  <td colSpan={5} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 11 }}>
                    No settings yet. Click <strong style={{ color: 'var(--ink)' }}>{addButtonLabel}</strong> to add one.
                  </td>
                </tr>
              )}
              {settings.map((setting) => {
                const isEditing = editingKey === setting.key
                const isSystem = setting.source.toLowerCase() === 'system'
                const isAI = setting.source.toLowerCase() === 'ai'
                const isOverride = setting.is_override
                const isInherited = !isOverride && !isStoryLevel
                const isStoryRootRow = setting.defined_at_node_id === null
                return (
                  <tr key={`${setting.key}-${setting.defined_at_node_id ?? 'root'}`}>
                    <td style={tdStyle}>{setting.key}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>
                      {isEditing ? (
                        <input
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEdit(setting)
                            if (e.key === 'Escape') cancelEdit()
                          }}
                          style={{ ...inputStyle, width: '100%' }}
                        />
                      ) : (
                        <span
                          onClick={() => !isSystem && startEdit(setting)}
                          style={{
                            cursor: isSystem ? 'default' : 'text',
                            color: isInherited ? 'var(--ink-3)' : 'var(--ink)',
                          }}
                          title={
                            isSystem
                              ? 'System-derived, not editable'
                              : isInherited
                              ? `Click to override at ${activeNode?.label}`
                              : 'Click to edit'
                          }
                        >
                          {setting.value}
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <Tag variant={sourceVariant(setting.source)}>{setting.source || 'user'}</Tag>
                      {setting.tag && (
                        <span style={{ marginLeft: 6 }}>
                          <Label>{setting.tag}</Label>
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {isOverride ? (
                        <Tag variant="solid">override</Tag>
                      ) : isStoryRootRow ? (
                        <span className="dim" style={{ fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          Story
                        </span>
                      ) : (
                        <span
                          className="dim"
                          style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
                          title="Inherited from ancestor"
                        >
                          {setting.defined_at_label}
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(setting)}
                            disabled={updateSetting.isPending || createSetting.isPending}
                            style={iconBtnStyle}
                            title="Save"
                          >
                            Save
                          </button>
                          <button onClick={cancelEdit} style={iconBtnStyle} title="Cancel">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {isAI && (
                            <button
                              onClick={() => handleAccept(setting)}
                              disabled={updateSetting.isPending}
                              style={iconBtnStyle}
                              title="Accept AI suggestion"
                            >
                              Accept
                            </button>
                          )}
                          {isOverride && (
                            <button
                              onClick={() => handleDelete(setting)}
                              disabled={deleteSetting.isPending}
                              style={iconBtnStyle}
                              title="Remove this override and re-inherit from ancestor"
                            >
                              Revert
                            </button>
                          )}
                          {!isOverride && isStoryRootRow && !isSystem && isStoryLevel && (
                            <button
                              onClick={() => handleDelete(setting)}
                              disabled={deleteSetting.isPending}
                              style={iconBtnStyle}
                              title="Delete story-level setting"
                            >
                              Delete
                            </button>
                          )}
                          {isInherited && !isSystem && (
                            <button
                              onClick={() => startEdit(setting)}
                              style={iconBtnStyle}
                              title={`Override at ${activeNode?.label}`}
                            >
                              Override
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const thStyle = {
  padding: '8px 16px',
  borderBottom: '1px solid var(--ink)',
} as const

const tdStyle = {
  padding: '8px 16px',
  borderBottom: '1px dashed var(--line-2)',
  color: 'var(--ink-2)',
} as const

const inputStyle = {
  padding: '4px 6px',
  border: '1px solid var(--ink-3)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  background: 'var(--paper)',
  color: 'var(--ink)',
} as const

const iconBtnStyle = {
  background: 'transparent',
  border: '1px solid var(--ink-3)',
  color: 'var(--ink-2)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  padding: '3px 6px',
  marginLeft: 6,
  cursor: 'pointer',
} as const
