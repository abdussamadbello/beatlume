import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Tag, Label } from '../components/primitives'
import { LoadingState } from '../components/LoadingState'
import { useScenes } from '../api/scenes'
import { useCharacters } from '../api/characters'
import { useDraft, useUpdateDraft } from '../api/draft'
import { useTriggerProseContinue } from '../api/ai'
import { useStore } from '../store'

function DraftPage() {
  const { storyId } = Route.useParams()
  const { data: scenesData, isLoading: scenesLoading } = useScenes(storyId)
  const { data: charsData, isLoading: charsLoading } = useCharacters(storyId)
  const activeSceneN = useStore(s => s.activeSceneN)
  const setActiveSceneN = useStore(s => s.setActiveSceneN)

  const scenes = scenesData?.items ?? []
  const characters = charsData?.items ?? []
  const activeScene = scenes.find(s => s.n === activeSceneN)

  const { data: draftData, isLoading: draftLoading, isFetching: draftFetching } =
    useDraft(storyId, activeScene?.id)
  const updateDraft = useUpdateDraft(storyId)
  const continueMutation = useTriggerProseContinue(storyId)

  const [draftContent, setDraftContent] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(null)

  // Sync textarea from server whenever the active scene or its fetched draft changes.
  const hydratedForSceneId = useRef<string | null>(null)
  useEffect(() => {
    if (!activeScene) return
    if (draftLoading) return
    if (hydratedForSceneId.current === activeScene.id) return
    setDraftContent(draftData?.content ?? '')
    hydratedForSceneId.current = activeScene.id
  }, [activeScene, draftData, draftLoading])

  // Debounced auto-save.
  const saveTimer = useRef<number | null>(null)
  useEffect(() => {
    if (!activeScene) return
    if (hydratedForSceneId.current !== activeScene.id) return
    if (draftContent === (draftData?.content ?? '')) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      updateDraft.mutate(
        { sceneId: activeScene.id, content: draftContent },
        {
          onSuccess: () => {
            const now = new Date()
            setSavedAt(now.toTimeString().slice(0, 5))
          },
        },
      )
    }, 800)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [draftContent, activeScene, draftData, updateDraft])

  if (scenesLoading || charsLoading) return <LoadingState />

  const wordCount = draftContent.split(/\s+/).filter(Boolean).length
  const povCharacter = activeScene
    ? characters.find(c => c.name === activeScene.pov)
    : null

  const handleAiContinue = () => {
    if (!activeScene) return
    continueMutation.mutate(activeScene.id)
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '240px 1fr 300px',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Scene rail */}
      <div style={{ borderRight: '1px solid var(--line)', overflow: 'auto', minHeight: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
          <Label>Scenes &middot; {scenes.length}</Label>
          <Label>Draft 3</Label>
        </div>
        {scenes.map((s) => {
          const isActive = s.n === activeSceneN
          return (
            <div
              key={s.id}
              onClick={() => setActiveSceneN(s.n)}
              style={{
                paddingTop: 10,
                paddingRight: 16,
                paddingBottom: 10,
                paddingLeft: 14,
                borderBottom: '1px dashed var(--line-2)',
                borderLeft: `2px solid ${isActive ? 'var(--blue)' : 'transparent'}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                background: isActive ? 'var(--paper-2)' : 'transparent',
              }}
            >
              <div>
                <Label style={{ fontSize: 9 }}>S{String(s.n).padStart(2, '0')} &middot; {s.pov}</Label>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14 }}>{s.title}</div>
              </div>
              <Tag style={{ fontSize: 9 }}>T {s.tension}</Tag>
            </div>
          )
        })}
      </div>

      {/* Editor */}
      <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '16px 36px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {activeScene ? (
              <>
                <Label>S{String(activeScene.n).padStart(2, '0')} &middot; {activeScene.pov} &middot; {activeScene.location}</Label>
                <div className="title-serif" style={{ fontSize: 24 }}>{activeScene.title}</div>
                <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
                  Act {activeScene.act} &middot; Tension {activeScene.tension}/10 &middot; {activeScene.tag}
                </div>
              </>
            ) : (
              <div className="title-serif" style={{ fontSize: 24 }}>No scene selected</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn ghost" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '6px 10px', border: '1px solid var(--ink-3)', background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer' }}>Outline mode</button>
            <button
              className="btn"
              onClick={handleAiContinue}
              disabled={continueMutation.isPending || !activeScene}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '6px 10px', border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)', cursor: continueMutation.isPending ? 'wait' : 'pointer' }}
            >
              {continueMutation.isPending ? 'Running...' : 'AI continue'}
            </button>
            {continueMutation.isError && (
              <span style={{ fontSize: 10, color: 'var(--red, #c00)' }}>Failed</span>
            )}
          </div>
        </div>
        {activeScene ? (
          <textarea
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            placeholder={draftLoading ? 'Loading…' : 'Begin writing this scene…'}
            style={{
              flex: 1,
              padding: '24px 36px',
              fontFamily: "'Instrument Serif', serif",
              fontSize: 17,
              lineHeight: 1.75,
              color: 'var(--ink)',
              border: 'none',
              outline: 'none',
              resize: 'none',
              background: 'transparent',
              width: '100%',
              minHeight: 0,
            }}
          />
        ) : (
          <div
            style={{
              flex: 1,
              padding: '24px 36px',
              color: 'var(--ink-3)',
              fontSize: 13,
            }}
          >
            Select a scene from the left to begin drafting.
          </div>
        )}
        <div
          style={{
            padding: '10px 36px',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: 'var(--ink-3)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          <span>
            {wordCount} words
            {' '}&middot;{' '}
            {updateDraft.isPending
              ? 'saving…'
              : draftFetching
                ? 'loading…'
                : savedAt
                  ? `autosaved ${savedAt}`
                  : 'not saved yet'}
          </span>
          <span>Target: 1,200&ndash;1,800</span>
        </div>
      </div>

      {/* Memory panel */}
      <div
        style={{
          borderLeft: '1px solid var(--line)',
          padding: '14px 16px',
          overflow: 'auto',
          minHeight: 0,
          background: 'var(--paper-2)',
        }}
      >
        <Label>Story memory in scope</Label>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
          Only these are passed to the model.
        </div>

        <div style={{ marginTop: 14 }}>
          <Label>Participants</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {povCharacter ? (
              <div
                style={{
                  border: '1px solid var(--line)',
                  padding: 8,
                  background: 'var(--paper)',
                  fontSize: 11,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{povCharacter.name}</strong>
                  <span className="dim">scene {activeSceneN} of {povCharacter.scene_count}</span>
                </div>
                <div style={{ color: 'var(--ink-2)', marginTop: 3 }}>
                  {povCharacter.role}. Desire: {povCharacter.desire}. Flaw: {povCharacter.flaw}.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>No POV character found.</div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <Label>Active relationships</Label>
          <div style={{ fontSize: 11, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div>
              Iris &harr; Wren &middot; <em>unresolved</em> &middot; last seen S01 (flashback)
            </div>
            <div>
              Iris &harr; Cole &middot; <em>conflict</em> &middot; letter arrived S02
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <Label>Prior scene summary</Label>
          <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.5 }}>
            {activeSceneN > 1
              ? `S${String(activeSceneN - 1).padStart(2, '0')} \u00B7 ${scenes.find(s => s.n === activeSceneN - 1)?.title || 'Previous scene'}`
              : 'First scene in the story.'}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <Label>Targets</Label>
          <div style={{ fontSize: 11, marginTop: 4 }}>
            {activeScene
              ? `Tension ${activeScene.tension} \u00B7 Tag: ${activeScene.tag} \u00B7 Location: ${activeScene.location}`
              : 'No scene selected.'}
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/stories/$storyId/draft')({
  component: DraftPage,
})
