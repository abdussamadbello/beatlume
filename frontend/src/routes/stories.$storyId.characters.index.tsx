import { useMemo, useState, type FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Tag, Btn, Label, PresenceStrip } from '../components/primitives'
import { LoadingState } from '../components/LoadingState'
import { Modal } from '../components/Modal'
import { useCharacters, useCreateCharacter } from '../api/characters'

export const Route = createFileRoute('/stories/$storyId/characters/')({
  component: CharactersView,
})

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

function CreateCharacterModal({
  open,
  onClose,
  storyId,
}: {
  open: boolean
  onClose: () => void
  storyId: string
}) {
  const create = useCreateCharacter(storyId)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [description, setDescription] = useState('')
  const [bio, setBio] = useState('')
  const [desire, setDesire] = useState('')
  const [flaw, setFlaw] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName('')
    setRole('')
    setDescription('')
    setBio('')
    setDesire('')
    setFlaw('')
    setError(null)
    create.reset()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setError(null)
    try {
      await create.mutateAsync({
        name: name.trim(),
        role: role.trim() || undefined,
        description: description.trim() || undefined,
        bio: bio.trim() || undefined,
        desire: desire.trim() || undefined,
        flaw: flaw.trim() || undefined,
      })
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create character')
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      width={520}
    >
      <form onSubmit={handleSubmit}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--ink)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="title-serif" style={{ fontSize: 22 }}>New character</span>
          <Label>Add to cast</Label>
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Label>Name *</Label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ ...inputStyle, marginTop: 4 }}
              placeholder="e.g. Mara Holloway"
            />
          </div>
          <div>
            <Label>Role</Label>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ ...inputStyle, marginTop: 4 }}
              placeholder="e.g. Protagonist, Antagonist, Family"
            />
          </div>
          <div>
            <Label>Description</Label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ ...inputStyle, marginTop: 4 }}
              placeholder="One-line summary, e.g. A widow returning to her family's failing orchard"
              maxLength={500}
            />
          </div>
          <div>
            <Label>Bio</Label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{ ...textareaStyle, marginTop: 4, minHeight: 100 }}
              placeholder="Backstory, role in the world, key history. A paragraph or two."
            />
          </div>
          <div>
            <Label>Desire</Label>
            <textarea
              value={desire}
              onChange={(e) => setDesire(e.target.value)}
              style={{ ...textareaStyle, marginTop: 4 }}
              placeholder="What do they want?"
            />
          </div>
          <div>
            <Label>Flaw</Label>
            <textarea
              value={flaw}
              onChange={(e) => setFlaw(e.target.value)}
              style={{ ...textareaStyle, marginTop: 4 }}
              placeholder="What holds them back?"
            />
          </div>
          {error && (
            <div style={{ fontSize: 11, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>{error}</div>
          )}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--ink)', background: 'var(--paper-2)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn variant="ghost" type="button" onClick={() => { reset(); onClose() }}>
            Cancel
          </Btn>
          <Btn variant="solid" type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating...' : 'Create character'}
          </Btn>
        </div>
      </form>
    </Modal>
  )
}

function FilterMenu({
  roles,
  selected,
  onToggle,
  onClear,
  hideMinor,
  onHideMinor,
  onClose,
}: {
  roles: string[]
  selected: Set<string>
  onToggle: (role: string) => void
  onClear: () => void
  hideMinor: boolean
  onHideMinor: (v: boolean) => void
  onClose: () => void
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 50 }}
      />
      <div
        style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          right: 0,
          minWidth: 220,
          background: 'var(--paper)',
          border: '1.5px solid var(--ink)',
          boxShadow: '4px 4px 0 var(--ink)',
          padding: 12,
          zIndex: 51,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Label>Filter by role</Label>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={onClear}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--ink-3)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Clear
            </button>
          )}
        </div>
        {roles.length === 0 && (
          <div style={{ color: 'var(--ink-3)', fontSize: 10, padding: '4px 0' }}>No roles defined yet</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
          {roles.map((role) => (
            <label key={role} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '2px 0' }}>
              <input
                type="checkbox"
                checked={selected.has(role)}
                onChange={() => onToggle(role)}
              />
              <span style={{ color: 'var(--ink)' }}>{role}</span>
            </label>
          ))}
        </div>
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--line)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={hideMinor}
              onChange={(e) => onHideMinor(e.target.checked)}
            />
            <span style={{ color: 'var(--ink)' }}>Hide minor (&lt;3 scenes)</span>
          </label>
        </div>
      </div>
    </>
  )
}

function CharactersView() {
  const { storyId } = Route.useParams()
  const { data, isLoading } = useCharacters(storyId)
  const navigate = useNavigate()
  const [sortBy, setSortBy] = useState<'name' | 'scenes' | 'gap'>('name')
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [roleFilter, setRoleFilter] = useState<Set<string>>(new Set())
  const [hideMinor, setHideMinor] = useState(false)

  const characters = data?.items ?? []

  const allRoles = useMemo(
    () =>
      Array.from(
        new Set(characters.map((c) => c.role).filter((r): r is string => Boolean(r)))
      ).sort(),
    [characters]
  )

  const filtered = useMemo(
    () =>
      characters.filter((c) => {
        if (roleFilter.size > 0 && !roleFilter.has(c.role)) return false
        if (hideMinor && c.scene_count < 3) return false
        return true
      }),
    [characters, roleFilter, hideMinor]
  )

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (sortBy === 'scenes') return b.scene_count - a.scene_count
        if (sortBy === 'gap') return b.longest_gap - a.longest_gap
        return a.name.localeCompare(b.name)
      }),
    [filtered, sortBy]
  )

  if (isLoading) return <LoadingState />

  const headerStyle = (col: 'name' | 'scenes' | 'gap') => ({
    cursor: 'pointer' as const,
    textDecoration: sortBy === col ? 'underline' : 'none',
  })

  const activeFilterCount = roleFilter.size + (hideMinor ? 1 : 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid var(--ink)' }}>
        <div className="title-serif" style={{ fontSize: 24 }}>
          Cast {'\u00B7'} {filtered.length}
          {filtered.length !== characters.length && (
            <span style={{ color: 'var(--ink-3)', fontSize: 14, marginLeft: 6 }}>of {characters.length}</span>
          )}
          {' '}characters
        </div>
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <Btn variant="ghost" onClick={() => setFilterOpen((v) => !v)}>
            Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''} {'\u25BE'}
          </Btn>
          {filterOpen && (
            <FilterMenu
              roles={allRoles}
              selected={roleFilter}
              onToggle={(role) => {
                setRoleFilter((prev) => {
                  const next = new Set(prev)
                  if (next.has(role)) next.delete(role)
                  else next.add(role)
                  return next
                })
              }}
              onClear={() => {
                setRoleFilter(new Set())
                setHideMinor(false)
              }}
              hideMinor={hideMinor}
              onHideMinor={setHideMinor}
              onClose={() => setFilterOpen(false)}
            />
          )}
          <Btn variant="solid" onClick={() => setCreateOpen(true)}>+ Character</Btn>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '48px 140px 110px 1fr 80px 80px 100px',
          gap: 10,
          padding: '10px 24px',
          borderBottom: '1px solid var(--ink)',
          fontSize: 10,
          letterSpacing: '0.08em',
          color: 'var(--ink-3)',
          textTransform: 'uppercase' as const,
        }}>
          <span />
          <span style={headerStyle('name')} onClick={() => setSortBy('name')}>Name</span>
          <span>Role</span>
          <span>Presence</span>
          <span style={headerStyle('scenes')} onClick={() => setSortBy('scenes')}>Scenes</span>
          <span style={headerStyle('gap')} onClick={() => setSortBy('gap')}>Longest gap</span>
          <span>Arc</span>
        </div>

        {/* Rows */}
        {sorted.length === 0 && (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
            {characters.length === 0
              ? 'No characters yet. Click "+ Character" to add the first one.'
              : 'No characters match the current filter.'}
          </div>
        )}
        {sorted.map((c, i) => {
          const isSelected = c.name === selectedName
          return (
            <div
              key={c.id}
              onClick={() => {
                setSelectedName(c.name)
                navigate({ to: '/stories/$storyId/characters/$id', params: { storyId, id: c.id } })
              }}
              style={{
                display: 'grid',
                gridTemplateColumns: '48px 140px 110px 1fr 80px 80px 100px',
                gap: 10,
                padding: '12px 24px',
                borderBottom: '1px dashed var(--line-2)',
                alignItems: 'center',
                cursor: 'pointer',
                background: isSelected ? 'var(--paper-2)' : 'transparent',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 32,
                height: 32,
                border: '1.5px solid var(--ink)',
                background: i === 0 ? 'var(--ink)' : 'var(--paper)',
                color: i === 0 ? 'var(--paper)' : 'var(--ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
              }}>
                {c.name.slice(0, 2).toUpperCase()}
              </div>

              {/* Name */}
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16 }}>{c.name}</div>

              {/* Role */}
              <div>{c.role ? <Tag>{c.role}</Tag> : <span style={{ color: 'var(--ink-3)', fontSize: 10 }}>—</span>}</div>

              {/* Presence strip */}
              <div>
                <PresenceStrip characterIndex={i} sceneCount={c.scene_count} />
              </div>

              {/* Scene count */}
              <div className="mono" style={{ fontSize: 12 }}>{c.scene_count}</div>

              {/* Longest gap */}
              <div className="mono" style={{ fontSize: 12, color: c.longest_gap > 10 ? 'var(--red)' : 'var(--ink)' }}>
                {c.longest_gap || '\u2014'}
              </div>

              {/* Arc sparkline */}
              <div style={{ display: 'flex', gap: 2, height: 18, alignItems: 'flex-end' }}>
                {Array.from({ length: 8 }).map((_, k) => (
                  <span key={k} style={{
                    flex: 1,
                    background: 'var(--ink)',
                    height: `${20 + k * 10 + Math.sin(i + k) * 20}%`,
                  }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <CreateCharacterModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        storyId={storyId}
      />
    </div>
  )
}
