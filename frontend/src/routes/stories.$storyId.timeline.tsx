import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { TensionCurve } from '../components/charts'
import { LoadingState } from '../components/LoadingState'
import { useTensionCurve } from '../api/analytics'

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

  if (isLoading) return <LoadingState />

  const tensionData = data?.data ?? []
  const acts = data?.acts ?? []
  const peaks = data?.peaks ?? []
  const metrics = data?.metrics
  const n = tensionData.length

  const goToScene = (i: number) => {
    navigate({
      to: '/stories/$storyId/scenes/$id',
      params: { storyId, id: String(i + 1) },
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
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--ink)' }}>
        <div style={labelStyle}>Timeline</div>
        <div className="title-serif" style={{ fontSize: 24 }}>
          {n} scene{n === 1 ? '' : 's'} {'·'} tension curve
        </div>
      </div>

      {/* Main: chart + right panel */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 240px', overflow: 'hidden' }}>
        {/* Chart area */}
        <div style={{ padding: 20 }}>
          <TensionCurve
            width={960}
            height={360}
            data={tensionData}
            acts={acts}
            peaks={peaks}
            fill="var(--ink)"
            onPointClick={goToScene}
          />

          {/* Heatmap strip */}
          <div style={{ marginTop: 8, display: 'flex', gap: 2 }}>
            {tensionData.map((v, i) => (
              <div
                key={i}
                onClick={() => goToScene(i)}
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
        </div>

        {/* Right panel */}
        <div style={{ borderLeft: '1px solid var(--ink)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
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
                    onClick={() => goToScene(peak.at)}
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
    </div>
  )
}
