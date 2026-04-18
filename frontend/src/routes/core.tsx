import { createFileRoute } from '@tanstack/react-router'
import { AppShell, Sidebar } from '../components/chrome'
import { Tag, Btn, Label } from '../components/primitives'

const treeNodes = [
  { d: 0, l: 'Story \u00b7 A Stranger in the Orchard', k: 'story' as const, active: false },
  { d: 1, l: 'Part I', k: 'part' as const },
  { d: 2, l: 'Chapter 1 \u00b7 Arrival', k: 'chap' as const },
  { d: 3, l: 'S01 Orchard at dawn', k: 'scene' as const },
  { d: 3, l: 'S02 The letter', k: 'scene' as const },
  { d: 4, l: 'Beat \u00b7 Iris opens the envelope', k: 'beat' as const },
  { d: 4, l: 'Beat \u00b7 decides to answer', k: 'beat' as const },
  { d: 3, l: 'S03 Wren returns', k: 'scene' as const },
  { d: 2, l: 'Chapter 2 \u00b7 Rumors', k: 'chap' as const },
  { d: 3, l: 'S04 Mara dismisses', k: 'scene' as const, active: true },
  { d: 3, l: 'S05 Jon on the ridge', k: 'scene' as const },
  { d: 1, l: 'Part II', k: 'part' as const },
  { d: 2, l: 'Chapter 3 \u00b7 Fire', k: 'chap' as const },
]

const iconMap = { story: '\u25C7', part: '\u25A4', chap: '\u25AB', scene: '\u00B7', beat: '\u2219' } as const

const settingsRows: [string, string, string, string][] = [
  ['Genre', 'Literary / Mystery', 'Story', ''],
  ['Default POV', 'Close third', 'Story', ''],
  ['POV', 'Iris', 'Scene', 'override'],
  ['Location', 'Barn', 'Scene', ''],
  ['Tone', 'Restrained, elegiac', 'Chapter', ''],
  ['World rules', 'No supernatural', 'Story', ''],
  ['Target tension band', '4\u20136', 'Chapter', ''],
  ['Tension score', '4', 'Scene (manual)', ''],
  ['Subplot link', 'Sister disappearance', 'Scene', ''],
  ['Goal', 'Put Wren off the scent', 'Scene', ''],
  ['Conflict', "Mara's denial vs Iris' doubt", 'Scene', ''],
  ['Outcome', 'Tension unresolved', 'Scene', ''],
  ['Metrics enabled', 'Tension, Emotional, Mystery', 'Story', ''],
  ['Beat structure', 'Optional', 'Story', ''],
]

function CorePage() {
  return (
    <AppShell sidebar={<Sidebar active="/core" />}>
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--ink)' }}>
          <div>
            <Label>Narrative Core</Label>
            <div className="title-serif" style={{ fontSize: 22 }}>Configuration hierarchy</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost">Expand all</Btn>
            <Btn>+ Override</Btn>
          </div>
        </div>

        {/* Two-panel */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '330px 1fr', overflow: 'hidden' }}>
          {/* Left tree */}
          <div style={{ borderRight: '1px solid var(--ink)', padding: 14, fontFamily: 'var(--font-mono)', fontSize: 12, overflow: 'auto' }}>
            {treeNodes.map((n, i) => {
              const icon = iconMap[n.k]
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: `5px 0 5px ${n.d * 16 + 8}px`,
                    background: n.active ? 'var(--paper-2)' : 'transparent',
                    borderLeft: n.active ? '2px solid var(--blue)' : '2px solid transparent',
                  }}
                >
                  <span style={{ color: 'var(--ink-3)', width: 10 }}>{icon}</span>
                  <span>{n.l}</span>
                  {n.active && <Label style={{ marginLeft: 'auto' }}>Editing</Label>}
                </div>
              )
            })}
          </div>

          {/* Right settings */}
          <div style={{ overflow: 'auto' }}>
            <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--ink)', background: 'var(--paper-2)' }}>
              <Label>Resolving settings for</Label>
              <div className="title-serif" style={{ fontSize: 20 }}>S04 &middot; Mara dismisses the rumor</div>
              <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>Story &#x2933; Chapter 2 &#x2933; S04 &middot; no beat overrides</div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', background: 'var(--paper-2)' }}>
                  <th style={{ padding: '8px 16px', borderBottom: '1px solid var(--ink)' }}>Setting</th>
                  <th style={{ padding: '8px 16px', borderBottom: '1px solid var(--ink)' }}>Resolved</th>
                  <th style={{ padding: '8px 16px', borderBottom: '1px solid var(--ink)' }}>Defined at</th>
                  <th style={{ padding: '8px 16px', borderBottom: '1px solid var(--ink)' }}></th>
                </tr>
              </thead>
              <tbody>
                {settingsRows.map(([k, v, src, tag], i) => (
                  <tr key={i}>
                    <td style={{ padding: '8px 16px', borderBottom: '1px dashed var(--line-2)', color: 'var(--ink-2)' }}>{k}</td>
                    <td style={{ padding: '8px 16px', borderBottom: '1px dashed var(--line-2)', fontFamily: 'var(--font-mono)' }}>{v}</td>
                    <td style={{ padding: '8px 16px', borderBottom: '1px dashed var(--line-2)' }}>
                      <Tag variant={src.startsWith('Scene') ? 'blue' : src === 'Chapter' ? 'amber' : undefined}>{src}</Tag>
                    </td>
                    <td style={{ padding: '8px 16px', borderBottom: '1px dashed var(--line-2)', textAlign: 'right' }}>
                      {tag ? (
                        <Label>{tag}</Label>
                      ) : (
                        <span className="dim" style={{ fontSize: 10 }}>inherit</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export const Route = createFileRoute('/core')({
  component: CorePage,
})
