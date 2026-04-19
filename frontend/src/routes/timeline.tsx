import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AppShell, Sidebar } from '../components/chrome'
import { TensionCurve } from '../components/charts'
import { Anno, SegmentedControl } from '../components/primitives'
import { tensionData, sampleActs, samplePeaks } from '../data'

export const Route = createFileRoute('/timeline')({
  component: TimelineView,
})

const metricLayers = [
  { label: 'Tension', color: 'var(--ink)', on: true },
  { label: 'Emotional', color: 'oklch(0.45 0.12 75)', on: true },
  { label: 'Stakes', color: 'var(--blue)', on: false },
  { label: 'Mystery', color: 'var(--ink-3)', on: false },
  { label: 'Romance', color: 'oklch(0.62 0.14 350)', on: false },
  { label: 'Danger', color: 'var(--red)', on: false },
  { label: 'Hope', color: 'var(--green)', on: false },
] as const;

const inferredMarkers = [
  { scene: 'S08', label: 'First Turn' },
  { scene: 'S20', label: 'Midpoint' },
  { scene: 'S26', label: 'All is Lost' },
  { scene: 'S37', label: 'Climax' },
  { scene: 'S40', label: 'Resolution' },
] as const;

const emotionalData = tensionData.map((v, i) => {
  const raw = v + Math.sin(i * 0.8) * 2 + 1;
  return Math.round(raw * 10) / 10;
});

function TimelineView() {
  const navigate = useNavigate()
  const [sourceMode, setSourceMode] = useState('Hybrid')
  const [visibleMetrics, setVisibleMetrics] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    metricLayers.forEach(m => { init[m.label] = m.on })
    return init
  })

  const toggleMetric = (label: string) => {
    setVisibleMetrics(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <AppShell sidebar={<Sidebar active="/timeline" />}>
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid var(--ink)' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--ink-3)' }}>Timeline</div>
            <div className="title-serif" style={{ fontSize: 24 }}>47 scenes {'\u00B7'} tension + emotional intensity</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ padding: '6px 10px', border: '1px solid var(--ink-3)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>View: Line {'\u25BE'}</span>
            <span style={{ padding: '6px 10px', border: '1px solid var(--ink-3)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Order: Scene {'\u25BE'}</span>
            <span style={{ padding: '6px 10px', border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Export PNG</span>
          </div>
        </div>

        {/* Main: chart + right panel */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 220px', overflow: 'hidden' }}>
          {/* Chart area */}
          <div style={{ padding: 20, position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              {visibleMetrics['Tension'] && (
                <TensionCurve width={960} height={360} data={tensionData} acts={sampleActs} peaks={samplePeaks} fill="var(--ink)" />
              )}
              {!visibleMetrics['Tension'] && (
                <div style={{ width: 960, height: 360 }} />
              )}
              <Anno variant="blue" style={{ left: 380, top: 100 }}>FLAT {'\u00B7'} sc. 18{'\u2013'}23</Anno>
              <Anno variant="amber" style={{ left: 520, top: 60 }}>MIDPOINT spike</Anno>
              <Anno variant="red" style={{ left: 760, top: 30 }}>CLIMAX S37</Anno>
              <Anno style={{ left: 100, top: 240 }}>SETUP plateau</Anno>
            </div>

            {/* Heatmap strip */}
            <div style={{ marginTop: 8, display: 'flex', gap: 2 }}>
              {tensionData.slice(0, 40).map((v, i) => (
                <div
                  key={i}
                  onClick={() => navigate({ to: '/scenes/$id', params: { id: String(i + 1) } })}
                  style={{
                    flex: 1,
                    height: 18,
                    background: v >= 8 ? 'var(--ink)' : v >= 5 ? 'var(--ink-2)' : 'var(--line)',
                    borderRight: '1px solid var(--paper)',
                    cursor: 'pointer',
                  }}
                  title={`S${i + 1} T${v}`}
                />
              ))}
            </div>
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.08em' }}>
              <span>S01</span><span>ACT I / II</span><span>MIDPOINT</span><span>ACT III</span><span>S47</span>
            </div>

            {/* Emotional overlay */}
            {visibleMetrics['Emotional'] && (
              <div style={{ marginTop: 18, borderTop: '1px dashed var(--ink-3)', paddingTop: 12 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--ink-3)' }}>Emotional intensity {'\u2014'} overlay</div>
                <TensionCurve width={960} height={140} data={emotionalData} stroke="oklch(0.45 0.12 75)" />
              </div>
            )}
          </div>

          {/* Right panel */}
          <div style={{ borderLeft: '1px solid var(--ink)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Metric layers */}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--ink-3)' }}>Metric layers</div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                {metricLayers.map(({ label, color }) => (
                  <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, background: color, display: 'inline-block' }} />
                    <span style={{ flex: 1 }}>{label}</span>
                    <input
                      type="checkbox"
                      checked={visibleMetrics[label] ?? false}
                      onChange={() => toggleMetric(label)}
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Source mode */}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--ink-3)' }}>Source mode</div>
              <div style={{ marginTop: 8 }}>
                <SegmentedControl
                  options={['Manual', 'AI', 'Hybrid']}
                  value={sourceMode}
                  onChange={setSourceMode}
                />
              </div>
            </div>

            {/* Inferred markers */}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--ink-3)' }}>Inferred markers</div>
              <div style={{ marginTop: 6, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {inferredMarkers.map(({ scene, label }) => (
                  <div key={scene} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed var(--line-2)' }}>
                    <span className="mono">{scene}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
