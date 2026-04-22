import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { TensionCurve } from '../components/charts'
import type { FacetLayer } from '../components/charts/TensionCurve'
import { Btn, Label, Tag, TensionBar } from '../components/primitives'
import { Modal } from '../components/Modal'
import { LoadingState } from '../components/LoadingState'
import { useTensionCurve } from '../api/analytics'
import { useScenes } from '../api/scenes'
import type { Scene, SceneMetric } from '../types'
import { SCENE_METRICS } from '../types'

const FACET_COLORS: Record<SceneMetric, string> = {
  emotional: 'var(--red)',
  stakes: 'var(--amber)',
  mystery: 'var(--blue)',
  romance: '#d4679a',
  danger: 'var(--ink)',
  hope: '#6c9a47',
}

const FACET_LABELS: Record<SceneMetric, string> = {
  emotional: 'Emotional',
  stakes: 'Stakes',
  mystery: 'Mystery',
  romance: 'Romance',
  danger: 'Danger',
  hope: 'Hope',
}

export const Route = createFileRoute('/stories/$storyId/timeline')({
  component: TimelineView,
})

const labelStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
}

const sceneCode = (index: number) => `S${String(index + 1).padStart(2, '0')}`

function TimelineView() {
  const { storyId } = Route.useParams()
  const navigate = useNavigate()
  const { data, isLoading } = useTensionCurve(storyId)
  const { data: scenesData } = useScenes(storyId)

  const [chartWidth, setChartWidth] = useState(0)
  const [activeScene, setActiveScene] = useState<Scene | null>(null)
  const [enabledFacets, setEnabledFacets] = useState<Set<SceneMetric>>(new Set())

  const chartContainerRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setChartWidth(Math.floor(entry.contentRect.width))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scenesById = useMemo(() => {
    const items = scenesData?.items ?? []
    return [...items].sort((a, b) => a.n - b.n)
  }, [scenesData])

  useEffect(() => {
    if (!activeScene) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveScene(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeScene])

  if (isLoading) return <LoadingState />

  const tensionData = data?.data ?? []
  const acts = data?.acts ?? []
  const peaks = data?.peaks ?? []
  const metrics = data?.metrics
  const facetsData = data?.facets
  const n = tensionData.length

  // A facet is "scored" once at least one scene has a non-zero value. Unscored
  // facets stay disabled so authors aren't tempted to toggle on six flat lines.
  const scoredFacets = useMemo<SceneMetric[]>(() => {
    if (!facetsData) return []
    return SCENE_METRICS.filter((m) => facetsData[m].some((v) => v > 0))
  }, [facetsData])

  const chartFacets = useMemo<FacetLayer[]>(() => {
    if (!facetsData) return []
    return [...enabledFacets].map((m) => ({
      name: m,
      data: facetsData[m],
      stroke: FACET_COLORS[m],
    }))
  }, [facetsData, enabledFacets])

  const toggleFacet = (m: SceneMetric) => {
    setEnabledFacets((prev) => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })
  }

  const previewScene = (i: number) => {
    const scene = scenesById[i]
    if (scene) setActiveScene(scene)
  }

  const openFullScene = (scene: Scene) => {
    setActiveScene(null)
    navigate({
      to: '/stories/$storyId/scenes/$id',
      params: { storyId, id: scene.id },
    })
  }

  if (n === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 64 }}>
        <div style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
          <div className="title-serif" style={{ fontSize: 22, marginBottom: 8 }}>No timeline data yet</div>
          <div style={{ fontSize: 12, marginBottom: 12 }}>Add scenes and tension scores to see the timeline chart.</div>
          <Link
            to="/stories/$storyId/scenes"
            params={{ storyId }}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink)', textDecoration: 'underline' }}
          >
            Go to Scenes
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--ink)' }}>
        <div style={labelStyle}>Timeline</div>
        <div className="title-serif" style={{ fontSize: 24 }}>
          {n} scene{n === 1 ? '' : 's'} {'·'} tension curve
        </div>
      </div>

      {/* Main: chart + right panel */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 240px', overflow: 'hidden' }}>
        {/* Chart area */}
        <div ref={chartContainerRef} style={{ padding: 20, minWidth: 0 }}>
          {chartWidth > 0 && (
            <>
              {scoredFacets.length > 0 && (
                <div style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span style={{ ...labelStyle, marginRight: 4 }}>Layers</span>
                  {SCENE_METRICS.map((m) => {
                    const scored = scoredFacets.includes(m)
                    const active = enabledFacets.has(m)
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => scored && toggleFacet(m)}
                        disabled={!scored}
                        title={scored ? `Toggle ${FACET_LABELS[m]}` : `${FACET_LABELS[m]} not scored yet`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '3px 9px',
                          border: `1px solid ${active ? 'var(--ink)' : 'var(--line)'}`,
                          background: active ? 'var(--paper-2)' : 'var(--paper)',
                          color: scored ? 'var(--ink)' : 'var(--ink-3)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          cursor: scored ? 'pointer' : 'not-allowed',
                          opacity: scored ? 1 : 0.55,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            background: FACET_COLORS[m],
                            opacity: scored ? 1 : 0.4,
                          }}
                        />
                        {FACET_LABELS[m]}
                      </button>
                    )
                  })}
                </div>
              )}

              <TensionCurve
                width={chartWidth}
                height={360}
                data={tensionData}
                acts={acts}
                peaks={peaks}
                fill="var(--ink)"
                onPointClick={previewScene}
                facets={chartFacets}
              />

              <div style={{ marginTop: 8, display: 'flex', gap: 2 }}>
                {tensionData.map((v, i) => (
                  <div
                    key={i}
                    onClick={() => previewScene(i)}
                    style={{
                      flex: 1,
                      height: 18,
                      background: v >= 8 ? 'var(--ink)' : v >= 5 ? 'var(--ink-2)' : 'var(--line)',
                      borderRight: '1px solid var(--paper)',
                      cursor: 'pointer',
                    }}
                    title={`${sceneCode(i)} · tension ${v}`}
                  />
                ))}
              </div>
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
                <span>{sceneCode(0)}</span>
                <span>{sceneCode(n - 1)}</span>
              </div>
            </>
          )}
        </div>

        {/* Right panel */}
        <div style={{ borderLeft: '1px solid var(--ink)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 18, overflow: 'auto' }}>
          {metrics && (
            <div>
              <div style={labelStyle}>Metrics</div>
              <dl style={{ marginTop: 8, fontSize: 11, display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px' }}>
                <dt style={{ color: 'var(--ink-3)' }}>Mean</dt>
                <dd className="mono" style={{ margin: 0 }}>{metrics.mean.toFixed(1)}</dd>
                <dt style={{ color: 'var(--ink-3)' }}>Max</dt>
                <dd className="mono" style={{ margin: 0 }}>{metrics.max}</dd>
                <dt style={{ color: 'var(--ink-3)' }}>Min</dt>
                <dd className="mono" style={{ margin: 0 }}>{metrics.min}</dd>
                <dt style={{ color: 'var(--ink-3)' }}>Std dev</dt>
                <dd className="mono" style={{ margin: 0 }}>{metrics.std.toFixed(1)}</dd>
                <dt style={{ color: 'var(--ink-3)' }}>Climax</dt>
                <dd className="mono" style={{ margin: 0 }}>{sceneCode(metrics.climax_position)}</dd>
              </dl>
            </div>
          )}

          {acts.length > 0 && (
            <div>
              <div style={labelStyle}>Acts</div>
              <div style={{ marginTop: 6, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {acts.map((act) => (
                  <div key={`${act.at}-${act.label}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed var(--line-2)' }}>
                    <span>{act.label}</span>
                    <span className="mono" style={{ color: 'var(--ink-3)' }}>{sceneCode(Number(act.at))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {peaks.length > 0 && (
            <div>
              <div style={labelStyle}>Inferred markers</div>
              <div style={{ marginTop: 6, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {peaks.map((peak) => (
                  <button
                    key={`${peak.at}-${peak.label}`}
                    onClick={() => previewScene(peak.at)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '4px 0',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px dashed var(--line-2)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      font: 'inherit',
                      color: 'inherit',
                      width: '100%',
                    }}
                  >
                    <span className="mono">{sceneCode(peak.at)}</span>
                    <span>{peak.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal open={!!activeScene} onClose={() => setActiveScene(null)} width={520}>
        {activeScene && <ScenePreview scene={activeScene} onOpenFull={() => openFullScene(activeScene)} onClose={() => setActiveScene(null)} />}
      </Modal>
    </div>
  )
}

function ScenePreview({
  scene,
  onOpenFull,
  onClose,
}: {
  scene: Scene
  onOpenFull: () => void
  onClose: () => void
}) {
  const metaBits = [scene.pov && `POV: ${scene.pov}`, `Act ${scene.act}`, scene.location].filter(Boolean)

  return (
    <div style={{ padding: '18px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Label>S{String(scene.n).padStart(2, '0')}</Label>
        <button
          onClick={onClose}
          aria-label="Close preview"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 16,
            color: 'var(--ink-3)',
            lineHeight: 1,
            padding: 4,
          }}
        >
          ×
        </button>
      </div>

      <div className="title-serif" style={{ fontSize: 22, marginBottom: 6 }}>
        {scene.title}
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em', color: 'var(--ink-3)', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {metaBits.flatMap((bit, i) =>
          i === 0
            ? [<span key={`bit-${i}`}>{bit}</span>]
            : [
                <span key={`sep-${i}`} style={{ color: 'var(--line)' }}>·</span>,
                <span key={`bit-${i}`}>{bit}</span>,
              ],
        )}
        {scene.tag && <Tag style={{ fontSize: 9 }}>{scene.tag}</Tag>}
      </div>

      <Label style={{ display: 'block', marginBottom: 6 }}>Tension</Label>
      <TensionBar value={scene.tension} />

      {scene.summary && (
        <>
          <Label style={{ display: 'block', marginTop: 16, marginBottom: 6 }}>Summary</Label>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)' }}>
            {scene.summary}
          </div>
        </>
      )}

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
        <Btn onClick={onOpenFull}>Open full scene →</Btn>
      </div>
    </div>
  )
}
