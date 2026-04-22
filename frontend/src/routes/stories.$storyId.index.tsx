import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { TensionCurve } from '../components/charts'
import { Panel, PanelHead, Tag, Label, PresenceStrip } from '../components/primitives'
import { LoadingState } from '../components/LoadingState'
import { useStory } from '../api/stories'
import { useScenes } from '../api/scenes'
import { useCharacters } from '../api/characters'
import { useInsights } from '../api/insights'
import { useTensionCurve } from '../api/analytics'

export const Route = createFileRoute('/stories/$storyId/')({
  component: Overview,
})

function Overview() {
  const { storyId } = Route.useParams()
  const navigate = useNavigate()
  const { data: story, isLoading: storyLoading } = useStory(storyId)
  const { data: scenesData, isLoading: scenesLoading } = useScenes(storyId)
  const { data: charsData, isLoading: charsLoading } = useCharacters(storyId)
  const { data: insightsData, isLoading: insightsLoading } = useInsights(storyId)
  const { data: tensionCurveData } = useTensionCurve(storyId)

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
