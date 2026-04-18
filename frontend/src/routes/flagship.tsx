import { createFileRoute } from '@tanstack/react-router'
import { AppShell, Sidebar } from '../components/chrome'
import { GraphRenderer, TensionCurve } from '../components/charts'
import { Anno, Tag, Btn, Label } from '../components/primitives'
import { sampleNodes, sampleEdges, tensionData, sampleActs, samplePeaks } from '../data'
import type { SceneNode } from '../types'

export const Route = createFileRoute('/flagship')({
  component: FlagshipView,
})

const scaledNodes: SceneNode[] = sampleNodes.map((n) => ({
  ...n,
  x: n.x * 1.4 + 40,
  y: n.y * 0.95,
}));

const historyEntries = [
  { scene: 'S02', text: 'First letter \u2014 tension 5' },
  { scene: 'S14', text: 'Court confrontation \u2014 7' },
  { scene: 'S21', text: 'Cole denies \u2014 8' },
  { scene: 'S23', text: '\u25B6 Today \u2014 7' },
] as const;

const edgeAppearances = [1, 2, 6, 14, 17, 21, 23, 26, 32, 37];

function FlagshipView() {
  return (
    <AppShell sidebar={<Sidebar active="/graph" />}>
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid var(--ink)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <div className="title-serif" style={{ fontSize: 22 }}>Graph {'\u00D7'} Timeline</div>
            <Tag variant="blue">Linked</Tag>
            <Label>S01 \u2014 S47 {'\u00B7'} all POV {'\u00B7'} all subplots</Label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost">Metric: Tension {'\u25BE'}</Btn>
            <Btn variant="ghost">Graph: Characters {'\u25BE'}</Btn>
            <Btn variant="solid">Play {'\u25B8'}</Btn>
          </div>
        </div>

        {/* Graph region */}
        <div style={{ flex: 1.4, display: 'grid', gridTemplateColumns: '1fr 260px', borderBottom: '1px solid var(--ink)', overflow: 'hidden' }}>
          <div style={{ position: 'relative' }} className="grid-bg-fine">
            <GraphRenderer width={920} height={430} nodes={scaledNodes} edges={sampleEdges} />
            <Anno variant="blue" style={{ left: 480, top: 200 }}>@ S23 \u2014 Iris {'\u2194'} Cole heat rising</Anno>
            <Anno variant="red" style={{ left: 700, top: 160 }}>new edge forms at S23</Anno>
            <Anno style={{ left: 140, top: 380, borderStyle: 'dashed', color: 'var(--ink-3)' }}>dormant since S14</Anno>
            {/* Time marker corner */}
            <div style={{ position: 'absolute', top: 12, right: 12, background: 'var(--ink)', color: 'var(--paper)', padding: '4px 10px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              NOW {'\u00B7'} SCENE 23 / 47
            </div>
          </div>

          {/* Inspector panel */}
          <div style={{ borderLeft: '1px solid var(--ink)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 11 }}>
            <div>
              <Label>Inspector {'\u00B7'} Edge</Label>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, marginTop: 4 }}>Iris {'\u2194'} Cole</div>
              <div className="dim" style={{ marginTop: 2 }}>Conflict {'\u00B7'} intensity 3/3 {'\u00B7'} polarity \u2013</div>
              <div style={{ marginTop: 8, height: 24, display: 'flex', gap: 1 }}>
                {Array.from({ length: 47 }).map((_, i) => {
                  const sceneNum = i + 1;
                  const on = edgeAppearances.includes(sceneNum);
                  const cur = sceneNum === 23;
                  return (
                    <span key={i} style={{ flex: 1, background: cur ? 'var(--blue)' : on ? 'var(--red)' : 'var(--line-2)' }} />
                  );
                })}
              </div>
              <div className="dim" style={{ fontSize: 9, marginTop: 4 }}>appearance map {'\u00B7'} S01 {'\u2192'} S47</div>
            </div>

            <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
              <Label>History</Label>
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {historyEntries.map(({ scene, text }) => (
                  <div key={scene} style={{ display: 'flex', gap: 8 }}>
                    <span className="mono" style={{ width: 28 }}>{scene}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px dashed var(--line)' }}>
              <Label style={{ color: 'var(--amber)' }}>AI</Label>
              <div style={{ marginTop: 4 }}>Reveal slot between S26\u2013S30 still unfilled.</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                <Btn style={{ fontSize: 10 }}>Suggest scene</Btn>
                <Btn variant="ghost" style={{ fontSize: 10 }}>Dismiss</Btn>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline region */}
        <div style={{ flex: 1, position: 'relative', padding: '12px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Label>Tension curve {'\u00B7'} click to jump {'\u00B7'} drag to brush</Label>
            <div style={{ display: 'flex', gap: 6 }}>
              <Tag>Tension</Tag>
              <Tag variant="blue">Stakes</Tag>
              <Label>hold {'\u21E7'} to add metric</Label>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <TensionCurve width={1140} height={220} data={tensionData} acts={sampleActs} peaks={samplePeaks} fill="var(--ink)" />
            {/* Brush selection */}
            <div style={{
              position: 'absolute', left: 520, top: 20, width: 140, height: 180,
              border: '1.5px solid var(--blue)',
              background: 'oklch(0.88 0.04 245 / 0.25)',
            }}>
              <div style={{ position: 'absolute', top: -18, left: 0, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--blue)' }}>
                BRUSH {'\u00B7'} S22\u2013S28
              </div>
            </div>
            {/* Scrubber */}
            <div style={{ position: 'absolute', left: 560, top: 10, bottom: 20, width: 2, background: 'var(--blue)' }}>
              <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, background: 'var(--blue)', border: '2px solid var(--paper)' }} />
              <div style={{ position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--blue)' }}>S23</div>
            </div>
            <Anno variant="red" style={{ left: 550, top: 210 }}>AI {'\u00B7'} flat middle {'\u00B7'} 6 scenes</Anno>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
