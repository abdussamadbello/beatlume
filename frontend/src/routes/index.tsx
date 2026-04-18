import { createFileRoute } from '@tanstack/react-router'
import { AppShell, Sidebar } from '../components/chrome'
import { TensionCurve } from '../components/charts'
import { Panel, PanelHead, Tag, Label } from '../components/primitives'
import { tensionData, sampleActs, samplePeaks, sampleScenes } from '../data'

export const Route = createFileRoute('/')({
  component: Overview,
})

function Overview() {
  const charPresence = ['Iris', 'Wren', 'Jon', 'Mara', 'Kai', 'Cole', 'Fen'] as const;
  const charCounts = [40, 24, 18, 12, 9, 8, 6] as const;

  const stats = [
    { n: '47', l: 'Scenes', s: 'of ~58' },
    { n: '14', l: 'Characters', s: '6 active' },
    { n: '3', l: 'Subplots', s: '2 resolved' },
    { n: '9', l: 'Relationships', s: 'in flux' },
  ] as const;

  return (
    <AppShell sidebar={<Sidebar active="/" />}>
      <div style={{ padding: '28px 36px', overflow: 'hidden' }}>
        {/* Story title section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <Label>Story {'\u00B7'} Draft 3</Label>
            <h1 className="title-serif" style={{ margin: '4px 0 8px', fontSize: 44 }}>A Stranger in the Orchard</h1>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', maxWidth: '62ch' }}>
              A widow returning to her family's failing orchard discovers the stranger who appears at harvest may be the one who buried her sister.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <Tag>Literary {'\u00B7'} Mystery</Tag>
              <Tag>Multi-POV {'\u00B7'} 3</Tag>
              <Tag variant="blue">72,000 words target</Tag>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Label>Last edited</Label>
            <div style={{ fontSize: 12 }}>Today, 14:02 {'\u00B7'} Scene 23</div>
          </div>
        </div>

        {/* Tension curve + AI flag */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <Panel>
            <PanelHead left="Tension curve \u00B7 whole story" right="47 scenes" />
            <div style={{ padding: 8 }}>
              <TensionCurve width={760} height={200} data={tensionData} acts={sampleActs} peaks={samplePeaks} />
            </div>
          </Panel>
          <Panel>
            <PanelHead left="Next AI flag" right={<Tag variant="amber">Review</Tag>} />
            <div style={{ padding: '12px 16px', fontSize: 12, lineHeight: 1.55 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, marginBottom: 8 }}>Middle feels flat (sc. 18\u201323).</div>
              <div style={{ color: 'var(--ink-2)' }}>
                Tension holds between 4\u20135 for six consecutive scenes. Consider pulling the cellar reveal earlier, or inserting an aftermath with Jon.
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <span className="btn" style={{ padding: '6px 10px', border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Inspect</span>
                <span className="btn" style={{ padding: '6px 10px', border: '1px solid var(--ink-3)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Dismiss</span>
              </div>
            </div>
          </Panel>
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
              {sampleScenes.slice(0, 5).map((s) => (
                <div key={s.n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', borderBottom: '1px dashed var(--line-2)' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                    <Label style={{ minWidth: 24 }}>{String(s.n).padStart(2, '0')}</Label>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16 }}>{s.title}</span>
                    <span className="dim" style={{ fontSize: 10 }}>{s.pov} {'\u00B7'} {s.location}</span>
                  </div>
                  <Tag>T {s.tension}</Tag>
                </div>
              ))}
            </div>
          </Panel>
          <Panel>
            <PanelHead left="Character presence" right={<Label>by scene</Label>} />
            <div style={{ padding: 12 }}>
              {charPresence.map((c, i) => (
                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' }}>
                  <span style={{ width: 42, fontSize: 11 }}>{c}</span>
                  <div style={{ flex: 1, display: 'flex', gap: 2 }}>
                    {Array.from({ length: 40 }).map((_, k) => {
                      const on = c === 'Iris' || Math.sin((i + 1) * (k + 3) * 0.7) > [0.2, 0.4, 0.0, -0.2, 0.3, 0.1, 0.5][i];
                      return (
                        <span key={k} style={{ flex: 1, height: 10, background: on ? 'var(--ink)' : 'var(--line-2)' }} />
                      );
                    })}
                  </div>
                  <Label style={{ width: 30, textAlign: 'right' }}>{charCounts[i]}</Label>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  )
}
