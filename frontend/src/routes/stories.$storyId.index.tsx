import { useMemo, useState, type CSSProperties } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { TensionCurve } from '../components/charts'
import { Panel, PanelHead, Tag, Label, PresenceStrip, Spinner } from '../components/primitives'
import { LoadingState } from '../components/LoadingState'
import { Modal } from '../components/Modal'
import { useStory } from '../api/stories'
import { useScenes } from '../api/scenes'
import { useCharacters } from '../api/characters'
import { useInsights } from '../api/insights'
import { useTensionCurve } from '../api/analytics'
import { useTriggerScaffold, useTriggerGenerateManuscript } from '../api/ai'
import { useStore } from '../store'

export const Route = createFileRoute('/stories/$storyId/')({
  component: Overview,
})

const calloutBox: CSSProperties = {
  border: '2px solid var(--ink)',
  background: 'var(--paper-2)',
  padding: '18px 20px',
  marginBottom: 24,
  display: 'grid',
  gap: 10,
  maxWidth: 720,
}

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '10px 16px',
  border: '1px solid var(--ink)',
  background: 'var(--ink)',
  color: 'var(--paper)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  width: 'fit-content',
}

const primaryBtnDisabled: React.CSSProperties = {
  ...primaryBtn,
  opacity: 0.55,
  cursor: 'not-allowed',
}

const ghostLink: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--ink-2)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  textDecoration: 'underline',
  cursor: 'pointer',
  textAlign: 'left',
  padding: 0,
}

function Overview() {
  const { storyId } = Route.useParams()
  const navigate = useNavigate()
  const aiTasks = useStore((s) => s.aiTasks)
  const { data: story, isLoading: storyLoading } = useStory(storyId)
  const { data: scenesData, isLoading: scenesLoading } = useScenes(storyId)
  const { data: charsData, isLoading: charsLoading } = useCharacters(storyId)
  const { data: insightsData, isLoading: insightsLoading } = useInsights(storyId)
  const { data: tensionCurveData } = useTensionCurve(storyId)
  const triggerScaffold = useTriggerScaffold(storyId)
  const triggerManuscript = useTriggerGenerateManuscript(storyId)
  const [manuscriptModalOpen, setManuscriptModalOpen] = useState(false)
  const [manuscriptAck, setManuscriptAck] = useState(false)
  /** false = skip scenes that already have draft (default); true = overwrite every scene */
  const [manuscriptRegenerate, setManuscriptRegenerate] = useState(false)
  const [manuscriptOverwriteAck, setManuscriptOverwriteAck] = useState(false)
  const [regenOpen, setRegenOpen] = useState(false)

  const lastManuscriptError = useMemo(
    () => aiTasks.find((t) => t.kind === 'full_manuscript' && t.status === 'error'),
    [aiTasks],
  )
  const scaffoldRunning = aiTasks.some(
    (t) => t.kind === 'story_scaffolding' && (t.status === 'queued' || t.status === 'running'),
  )
  const manuscriptRunning = aiTasks.some(
    (t) => t.kind === 'full_manuscript' && (t.status === 'queued' || t.status === 'running'),
  )

  if (storyLoading || scenesLoading || charsLoading || insightsLoading) return <LoadingState />

  const scenes = scenesData?.items ?? []
  const characters = charsData?.items ?? []
  const insights = insightsData?.items ?? []

  const tensionData: number[] = tensionCurveData?.data ?? []
  const sampleActs = tensionCurveData?.acts ?? []
  const samplePeaks = tensionCurveData?.peaks ?? []

  const firstInsight = insights.length > 0 ? insights[0] : null
  const povCount = new Set(scenes.map((s) => s.pov).filter(Boolean)).size
  const actCount = scenes.reduce((max, s) => Math.max(max, s.act), 0)
  const activeInsights = insights.filter((i) => !i.dismissed)
  const redInsights = insights.filter((i) => i.severity === 'red')

  const stats = [
    { n: String(scenes.length), l: 'Scenes', s: povCount > 0 ? `${povCount} POV${povCount === 1 ? '' : 's'}` : 'no POVs yet' },
    { n: String(characters.length), l: 'Characters', s: `${characters.filter((c) => c.scene_count > 5).length} active` },
    { n: String(actCount || '—'), l: 'Acts', s: story?.structure_type ?? '—' },
    { n: String(activeInsights.length), l: 'AI flags', s: `${redInsights.length} red` },
  ] as const

  const MIDDOT = '·'

  return (
    <div style={{ padding: '28px 36px', overflow: 'hidden' }}>
      {/* Story title section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Label>Story {MIDDOT} Draft {story?.draft_number ?? '—'}</Label>
          <h1 className="title-serif" style={{ margin: '4px 0 8px', fontSize: 44 }}>
            {story?.title ?? 'Untitled story'}
          </h1>
          {story?.logline && (
            <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink-2)', maxWidth: '62ch', lineHeight: 1.5 }}>
              {story.logline}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            {(story?.genres ?? []).length > 0 && (
              <Tag>{(story?.genres ?? []).join(` ${MIDDOT} `)}</Tag>
            )}
            {story?.subgenre && <Tag>{story.subgenre}</Tag>}
            {povCount > 1 && <Tag>Multi-POV {MIDDOT} {povCount}</Tag>}
            {povCount === 1 && <Tag>Single POV</Tag>}
            {story && <Tag variant="blue">{story.target_words.toLocaleString()} words target</Tag>}
          </div>
          {(story?.themes ?? []).length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <Label>Themes</Label>
              {(story?.themes ?? []).map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <Label>Status</Label>
          <div style={{ fontSize: 12, textTransform: 'capitalize' }}>
            {(story?.status ?? '').replace('_', ' ') || '—'}
          </div>
        </div>
      </div>

      {story && (
        <>
          {lastManuscriptError && (
            <div
              style={{
                ...calloutBox,
                borderColor: 'var(--red)',
                background: 'rgba(180, 60, 50, 0.06)',
              }}
            >
              <Label style={{ color: 'var(--red)' }}>Full draft paused</Label>
              <div style={{ fontSize: 13, color: 'var(--ink)' }}>{lastManuscriptError.error ?? 'The last run did not finish.'}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                Run again to continue (skips scenes that already have prose), or use Generate full draft below and choose
                Regenerate every scene to overwrite existing drafts.
              </div>
              <button
                type="button"
                style={manuscriptRunning ? primaryBtnDisabled : primaryBtn}
                disabled={manuscriptRunning}
                onClick={() => triggerManuscript.mutate({ skip_non_empty: true })}
              >
                {manuscriptRunning ? <><Spinner variant="ticker" color="var(--paper)" /> Resuming</> : 'Resume full draft'}
              </button>
            </div>
          )}

          {scenes.length === 0 ? (
            <div style={calloutBox}>
              <Label>Start with a storyline</Label>
              <div style={{ fontSize: 14, fontFamily: 'var(--font-serif)', lineHeight: 1.5 }}>
                Generate an AI scene map from your premise and setup—then you can draft scene by scene or run a full pass.
              </div>
              <button
                type="button"
                style={scaffoldRunning || triggerScaffold.isPending ? primaryBtnDisabled : primaryBtn}
                disabled={scaffoldRunning || triggerScaffold.isPending}
                onClick={() =>
                  triggerScaffold.mutate({
                    premise: [story.title, story.logline].filter((x) => x?.trim()).join('\n\n') || story.title,
                    structure_type: story.structure_type,
                    target_words: story.target_words,
                    genres: story.genres,
                    characters: characters.map((c) => ({
                      name: c.name,
                      role: c.role,
                      description: c.description ?? '',
                    })),
                    replace_existing: false,
                  })
                }
              >
                {scaffoldRunning || triggerScaffold.isPending ? <><Spinner variant="ticker" color="var(--paper)" /> Scaffolding</> : 'Generate story structure'}
              </button>
              <button
                type="button"
                style={ghostLink}
                onClick={() => navigate({ to: '/stories/$storyId/scenes', params: { storyId } })}
              >
                Or add scenes manually on the Scene board →
              </button>
            </div>
          ) : (
            <div style={calloutBox}>
              <Label>Next: draft the manuscript</Label>
              <div style={{ fontSize: 14, fontFamily: 'var(--font-serif)', lineHeight: 1.5 }}>
                You have {scenes.length} scene{scenes.length === 1 ? '' : 's'}. Run AI prose for every scene in order, or work
                scene-by-scene from the Draft view.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <button
                  type="button"
                  style={manuscriptRunning ? primaryBtnDisabled : primaryBtn}
                  disabled={manuscriptRunning}
                  onClick={() => {
                    setManuscriptModalOpen(true)
                    setManuscriptAck(false)
                    setManuscriptRegenerate(false)
                    setManuscriptOverwriteAck(false)
                  }}
                >
                  {manuscriptRunning ? <><Spinner variant="ticker" color="var(--paper)" /> Drafting all scenes</> : 'Generate full draft'}
                </button>
                <button
                  type="button"
                  style={ghostLink}
                  onClick={() => navigate({ to: '/stories/$storyId/draft', params: { storyId } })}
                >
                  Open Draft workspace
                </button>
              </div>
              <button type="button" style={ghostLink} onClick={() => setRegenOpen(true)}>
                Regenerate story structure (replaces all current scenes) →
              </button>
            </div>
          )}

          <Modal
            open={manuscriptModalOpen}
            onClose={() => {
              setManuscriptModalOpen(false)
              setManuscriptRegenerate(false)
              setManuscriptOverwriteAck(false)
            }}
            width={480}
          >
            <div style={{ padding: 20 }}>
              <h2 className="title-serif" style={{ fontSize: 24, margin: '0 0 8px' }}>
                Generate full draft
              </h2>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                This will request prose for about <strong>{scenes.length}</strong> scene{scenes.length === 1 ? '' : 's'}. A rough
                order-of-magnitude is {Math.max(1, Math.round(scenes.length * 0.4))}k–{Math.max(1, Math.round(scenes.length * 0.7))}
                k output tokens, depending on the model. It can take several minutes; watch progress in the AI panel.
              </p>
              <div style={{ display: 'grid', gap: 10, marginTop: 14, fontSize: 12, color: 'var(--ink)' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="manuscript-mode"
                    checked={!manuscriptRegenerate}
                    onChange={() => {
                      setManuscriptRegenerate(false)
                      setManuscriptOverwriteAck(false)
                    }}
                  />
                  <span>
                    <strong>Fill empty only</strong> — skip scenes that already have draft text (saves time and tokens).
                  </span>
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="manuscript-mode"
                    checked={manuscriptRegenerate}
                    onChange={() => setManuscriptRegenerate(true)}
                  />
                  <span>
                    <strong>Regenerate every scene</strong> — run AI prose for all scenes and <em>replace</em> existing draft
                    text.
                  </span>
                </label>
              </div>
              {manuscriptRegenerate && (
                <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 10, lineHeight: 1.45 }}>
                  Overwrite mode cannot be undone from here; export or copy any prose you need before running.
                </p>
              )}
              <label style={{ display: 'flex', gap: 8, fontSize: 12, marginTop: 12, alignItems: 'flex-start' }}>
                <input type="checkbox" checked={manuscriptAck} onChange={(e) => setManuscriptAck(e.target.checked)} />
                <span>I understand this uses AI and may take a while.</span>
              </label>
              {manuscriptRegenerate && (
                <label style={{ display: 'flex', gap: 8, fontSize: 12, marginTop: 10, alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={manuscriptOverwriteAck}
                    onChange={(e) => setManuscriptOverwriteAck(e.target.checked)}
                  />
                  <span>I understand existing scene drafts will be replaced.</span>
                </label>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  style={ghostLink}
                  onClick={() => {
                    setManuscriptModalOpen(false)
                    setManuscriptRegenerate(false)
                    setManuscriptOverwriteAck(false)
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={
                    !manuscriptAck ||
                    manuscriptRunning ||
                    (manuscriptRegenerate && !manuscriptOverwriteAck)
                      ? primaryBtnDisabled
                      : manuscriptRegenerate
                        ? { ...primaryBtn, background: 'var(--red)', borderColor: 'var(--red)' }
                        : primaryBtn
                  }
                  disabled={
                    !manuscriptAck ||
                    manuscriptRunning ||
                    (manuscriptRegenerate && !manuscriptOverwriteAck)
                  }
                  onClick={() => {
                    triggerManuscript.mutate({ skip_non_empty: !manuscriptRegenerate })
                    setManuscriptModalOpen(false)
                    setManuscriptRegenerate(false)
                    setManuscriptOverwriteAck(false)
                  }}
                >
                  {manuscriptRegenerate ? 'Start (regenerate all)' : 'Start'}
                </button>
              </div>
            </div>
          </Modal>

          <Modal open={regenOpen} onClose={() => setRegenOpen(false)} width={440}>
            <div style={{ padding: 20 }}>
              <h2 className="title-serif" style={{ fontSize: 22, margin: '0 0 8px' }}>
                Regenerate structure?
              </h2>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                This removes all current scenes and relationship edges from the scaffold, then runs AI scaffolding again. Your
                story title and logline stay as they are; draft text tied to old scene ids will be removed with those scenes.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <button type="button" style={ghostLink} onClick={() => setRegenOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  style={
                    scaffoldRunning || triggerScaffold.isPending
                      ? primaryBtnDisabled
                      : { ...primaryBtn, background: 'var(--red)', borderColor: 'var(--red)' }
                  }
                  disabled={scaffoldRunning || triggerScaffold.isPending}
                  onClick={() => {
                    setRegenOpen(false)
                    triggerScaffold.mutate({
                      premise: [story.title, story.logline].filter((x) => x?.trim()).join('\n\n') || story.title,
                      structure_type: story.structure_type,
                      target_words: story.target_words,
                      genres: story.genres,
                      characters: characters.map((c) => ({
                        name: c.name,
                        role: c.role,
                        description: c.description ?? '',
                      })),
                      replace_existing: true,
                    })
                  }}
                >
                  Replace all scenes
                </button>
              </div>
            </div>
          </Modal>
        </>
      )}

      {/* Tension curve + AI flag */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <Panel>
          <PanelHead left={`Tension curve ${MIDDOT} whole story`} right={`${scenes.length} scenes`} />
          <div style={{ padding: 8 }}>
            <TensionCurve width={760} height={200} data={tensionData} acts={sampleActs} peaks={samplePeaks} />
          </div>
        </Panel>
        {firstInsight ? (
          <Panel>
            <PanelHead left="Next AI flag" right={<Tag variant={firstInsight.severity === 'red' ? 'red' : firstInsight.severity === 'amber' ? 'amber' : 'blue'}>{firstInsight.severity === 'red' ? 'Flag' : firstInsight.severity === 'amber' ? 'Review' : 'OK'}</Tag>} />
            <div style={{ padding: '12px 16px', fontSize: 12, lineHeight: 1.55 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, marginBottom: 8 }}>{firstInsight.title}</div>
              <div style={{ color: 'var(--ink-2)' }}>
                {firstInsight.body}
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <span className="btn" onClick={() => navigate({ to: '/stories/$storyId/ai', params: { storyId } })} style={{ padding: '6px 10px', border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Inspect</span>
                <span className="btn" style={{ padding: '6px 10px', border: '1px solid var(--ink-3)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Dismiss</span>
              </div>
            </div>
          </Panel>
        ) : (
          <Panel>
            <PanelHead left="AI flags" right={<Tag variant="blue">All clear</Tag>} />
            <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--ink-3)' }}>
              No pending AI flags.
            </div>
          </Panel>
        )}
      </div>

      {/* 4 stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 20 }}>
        {stats.map((stat) => (
          <Panel key={stat.l}>
            <div style={{ padding: '14px 16px' }}>
              <Label>{stat.l}</Label>
              <div className="title-serif" style={{ fontSize: 32, lineHeight: 1 }}>{stat.n}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{stat.s}</div>
            </div>
          </Panel>
        ))}
      </div>

      {/* Recent scenes + Character presence */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
        <Panel>
          <PanelHead left="Recent scenes" right={<Label>edited today</Label>} />
          <div style={{ padding: '4px 0' }}>
            {scenes.slice(0, 5).map((s) => (
              <div
                key={s.id}
                onClick={() => navigate({ to: '/stories/$storyId/scenes/$id', params: { storyId, id: s.id } })}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px dashed var(--line-2)', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                  <Label style={{ minWidth: 24 }}>{String(s.n).padStart(2, '0')}</Label>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16 }}>{s.title}</span>
                  <span className="dim" style={{ fontSize: 10 }}>{s.pov} {MIDDOT} {s.location}</span>
                </div>
                <Tag>T {s.tension}</Tag>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHead left="Character presence" right={<Label>by scene</Label>} />
          <div style={{ padding: 12 }}>
            {characters.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                <span style={{ width: 42, fontSize: 11 }}>{c.name}</span>
                <div style={{ flex: 1 }}>
                  <PresenceStrip characterIndex={i} sceneCount={c.scene_count} barCount={40} />
                </div>
                <Label style={{ width: 30, textAlign: 'right' }}>{c.scene_count}</Label>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}
