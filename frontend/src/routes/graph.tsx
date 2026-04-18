import { createFileRoute } from '@tanstack/react-router'
import { AppShell, Sidebar } from '../components/chrome'
import { GraphRenderer } from '../components/charts'
import { Anno } from '../components/primitives'
import { sampleNodes, sampleEdges } from '../data'
import type { SceneNode } from '../types'

export const Route = createFileRoute('/graph')({
  component: GraphView,
})

const scaledNodes: SceneNode[] = sampleNodes.map((n) => ({
  ...n,
  x: n.x * 1.4 + 40,
  y: n.y * 1.22,
}));

const modeTabs = ['Characters', 'Scenes', 'Subplots', 'Mixed'] as const;

const edgeLegend = [
  { label: 'Alliance', color: 'var(--blue)', style: 'solid' },
  { label: 'Conflict', color: 'var(--red)', style: 'dashed' },
  { label: 'Romance', color: 'oklch(0.62 0.14 350)', style: 'solid' },
  { label: 'Mentor', color: 'var(--ink)', style: 'solid' },
  { label: 'Secret', color: 'var(--ink-3)', style: 'dotted' },
  { label: 'Family', color: 'var(--green)', style: 'solid' },
] as const;

function GraphView() {
  return (
    <AppShell sidebar={<Sidebar active="/graph" />}>
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header with mode toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid var(--ink)' }}>
          <div style={{ display: 'flex', gap: 2, border: '1px solid var(--ink)' }}>
            {modeTabs.map((l, i) => (
              <span key={l} style={{
                padding: '6px 14px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                background: i === 0 ? 'var(--ink)' : 'var(--paper)',
                color: i === 0 ? 'var(--paper)' : 'var(--ink)',
                borderRight: i < modeTabs.length - 1 ? '1px solid var(--ink)' : 'none',
                cursor: 'pointer',
              }}>{l}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ padding: '6px 10px', border: '1px solid var(--ink-3)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Cluster: Subplot {'\u25BE'}</span>
            <span style={{ padding: '6px 10px', border: '1px solid var(--ink-3)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Layout: Force {'\u25BE'}</span>
            <span style={{ padding: '6px 10px', border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Export SVG</span>
          </div>
        </div>

        {/* Main content: graph + right panel */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 240px', overflow: 'hidden' }}>
          <div style={{ position: 'relative' }} className="grid-bg-fine">
            <GraphRenderer width={920} height={560} nodes={scaledNodes} edges={sampleEdges} />
            <Anno variant="blue" style={{ left: 500, top: 190 }}>hub {'\u00B7'} Iris {'\u00B7'} degree 6</Anno>
            <Anno variant="red" style={{ left: 620, top: 170 }}>conflict triangle</Anno>
            <Anno style={{ left: 120, top: 440, borderStyle: 'dashed', color: 'var(--ink-3)' }}>disconnected \u2014 Doc</Anno>
          </div>

          {/* Right sidebar */}
          <div style={{ borderLeft: '1px solid var(--ink)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Edge kinds legend */}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--ink-3)' }}>Edge kinds</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, fontSize: 11 }}>
                {edgeLegend.map(({ label, color, style }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 24, height: 0, borderTop: `1.5px ${style} ${color}` }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--ink-3)' }}>Filters</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, fontSize: 11 }}>
                <label style={{ display: 'flex', gap: 6 }}><input type="checkbox" defaultChecked />Act I {'\u00B7'} II {'\u00B7'} III</label>
                <label style={{ display: 'flex', gap: 6 }}><input type="checkbox" defaultChecked />All POV</label>
                <label style={{ display: 'flex', gap: 6 }}><input type="checkbox" />Hide minor (&lt;3)</label>
                <label style={{ display: 'flex', gap: 6 }}><input type="checkbox" />Only unresolved</label>
              </div>
            </div>

            {/* Selected info */}
            <div style={{ marginTop: 'auto', borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--ink-3)' }}>Selected {'\u00B7'} Iris</div>
              <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 4 }}>6 relationships {'\u00B7'} in 40 scenes {'\u00B7'} last: S23</div>
            </div>
          </div>
        </div>

        {/* Time scrubber */}
        <div style={{ borderTop: '1px solid var(--ink)', padding: '10px 24px', background: 'var(--paper-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
            <span>Time-slice {'\u00B7'} Scene 23 of 47</span>
            <span>Drag to animate relationships across the story {'\u2192'}</span>
          </div>
          <div style={{ position: 'relative', height: 20 }}>
            <div style={{ position: 'absolute', inset: '8px 0', border: '1px solid var(--ink)' }} />
            <div style={{ position: 'absolute', left: '48%', top: 0, bottom: 0, width: 2, background: 'var(--blue)' }} />
            {[
              { pct: 8 * 2.13, label: 'ACT I' },
              { pct: 26 * 2.13, label: 'II' },
              { pct: 36 * 2.13, label: 'III' },
            ].map((item) => (
              <div key={item.label} style={{ position: 'absolute', left: `${item.pct}%`, top: 0, width: 1, height: '100%', borderLeft: '1px dashed var(--ink-3)' }}>
                <span style={{ position: 'absolute', top: -14, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
