import { useState, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Tag, Label } from '../components/primitives'
import { LoadingState } from '../components/LoadingState'
import { useScenes } from '../api/scenes'
import { useCharacters } from '../api/characters'
import { useStore } from '../store'

const mockParagraph = 'She stood for a long time after he left, listening to the truck turn over twice before it caught. The sound carried across the empty field and came back to her changed, the way all sounds did here — smaller, and sadder, and more honest than they had any right to be.'

function DraftPage() {
  const { storyId } = Route.useParams()
  const { data: scenesData, isLoading: scenesLoading } = useScenes(storyId)
  const { data: charsData, isLoading: charsLoading } = useCharacters(storyId)
  const activeSceneN = useStore(s => s.activeSceneN)
  const setActiveSceneN = useStore(s => s.setActiveSceneN)

  const [isGenerating, setIsGenerating] = useState(false)
  const [draftContent, setDraftContentState] = useState<Record<number, string>>({})

  if (scenesLoading || charsLoading) return <LoadingState />

  const scenes = scenesData?.items ?? []
  const characters = charsData?.items ?? []

  const activeScene = scenes.find(s => s.n === activeSceneN)
  const currentContent = draftContent[activeSceneN] || ''
  const wordCount = currentContent.split(/\s+/).filter(Boolean).length

  const povCharacter = activeScene
    ? characters.find(c => c.name === activeScene.pov)
    : null

  const handleAiContinue = () => {
    setIsGenerating(true)
    setTimeout(() => {
      setDraftContentState(prev => ({
        ...prev,
        [activeSceneN]: (prev[activeSceneN] || '') + '\n\n' + mockParagraph,
      }))
      setIsGenerating(false)
    }, 300)
  }

  const handleContentChange = (value: string) => {
    setDraftContentState(prev => ({ ...prev, [activeSceneN]: value }))
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 300px', overflow: 'hidden' }}>
      {/* Scene rail */}
      <div style={{ borderRight: '1px solid var(--line)', overflow: 'auto' }}>
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
                padding: '10px 16px',
                borderBottom: '1px dashed var(--line-2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                ...(isActive
                  ? { background: 'var(--paper-2)', borderLeft: '2px solid var(--blue)', paddingLeft: 14 }
                  : {}),
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
      <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
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
              disabled={isGenerating}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '6px 10px', border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)', cursor: isGenerating ? 'wait' : 'pointer' }}
            >
              {isGenerating ? 'Generating...' : 'AI continue'}
            </button>
          </div>
        </div>
        <textarea
          value={currentContent}
          onChange={(e) => handleContentChange(e.target.value)}
          style={{
            flex: 1,
            padding: '24px 36px',
            fontFamily: "'Instrument Serif', serif",
            fontSize: 17,
            lineHeight: 1.75,
            color: 'var(--ink)',
            maxWidth: 720,
            border: 'none',
            outline: 'none',
            resize: 'none',
            background: 'transparent',
            width: '100%',
          }}
        />
        <div
          style={{
            marginTop: 'auto',
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
          <span>{wordCount} words &middot; autosaved 14:02</span>
          <span>Target: 1,200&ndash;1,800</span>
        </div>
      </div>

      {/* Memory panel */}
      <div
        style={{
          borderLeft: '1px solid var(--line)',
          padding: '14px 16px',
          overflow: 'auto',
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
