import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AppShell, Sidebar } from '../components/chrome'
import { Tag, Btn, Label } from '../components/primitives'

const categories: [string, string][] = [
  ['All', '12'],
  ['Pacing', '3'],
  ['Relationships', '4'],
  ['Characters', '2'],
  ['Subplots', '2'],
  ['Climax placement', '1'],
]

const insightCards = [
  {
    sev: 'red' as const,
    cat: 'Pacing',
    title: 'Flat middle: scenes 18\u201323',
    body: 'Six consecutive scenes hold tension between 3 and 4. The same two characters (Iris, Mara) argue variations on the same topic. Consider pulling the cellar reveal (S32) earlier, or inserting an aftermath after S08 fire.',
    refs: ['S18', 'S19', 'S20', 'S21', 'S22', 'S23'],
  },
  {
    sev: 'amber' as const,
    cat: 'Characters',
    title: 'Mara disappears for 9 scenes',
    body: 'Mara is present in S01\u2013S12, then absent until S22. Longest character absence. Her last appearance (S12) does not read as an off-screen exit.',
    refs: ['Mara', 'S12', 'S22'],
  },
  {
    sev: 'amber' as const,
    cat: 'Relationships',
    title: "Fen\u2019s secret edge never pays off",
    body: 'Edge Iris \u2194 Fen is typed "secret" but no scene discharges it. A reveal slot between S26\u2013S30 would match the rising curve and align with the stream.',
    refs: ['Iris\u2194Fen', 'S26', 'S30'],
  },
  {
    sev: 'blue' as const,
    cat: 'Climax',
    title: 'Climax feels earned',
    body: 'S37 peak is supported by 4 consecutive scenes escalating tension 6\u219210 and two new graph edges forming at S32 and S35. No suggested change.',
    refs: ['S32', 'S35', 'S37'],
  },
  {
    sev: 'amber' as const,
    cat: 'Subplots',
    title: 'Court subplot disconnects at Ch. 9',
    body: "Cole\u2019s court thread has no shared scenes with the main plot after S18. Either bring Iris to court or cut Cole\u2019s scene S15.",
    refs: ['Cole', 'Court', 'S15', 'S18'],
  },
]

function AIPage() {
  const [activeCategory, setActiveCategory] = useState('All')

  const filteredCards =
    activeCategory === 'All'
      ? insightCards
      : insightCards.filter((c) => c.cat === activeCategory)

  return (
    <AppShell sidebar={<Sidebar active="/ai" />}>
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--ink)', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <Label>AI Insights</Label>
            <div className="title-serif" style={{ fontSize: 22 }}>12 recommendations &middot; explainable</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost">Run again</Btn>
            <Btn>Settings</Btn>
          </div>
        </div>

        {/* Two-panel */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr', overflow: 'hidden' }}>
          {/* Left category nav */}
          <div style={{ borderRight: '1px solid var(--ink)', padding: '14px 12px', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {categories.map(([label, count]) => {
              const isActive = label === activeCategory
              return (
                <div
                  key={label}
                  onClick={() => setActiveCategory(label)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    borderLeft: `2px solid ${isActive ? 'var(--blue)' : 'transparent'}`,
                    background: isActive ? 'var(--paper-2)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <span>{label}</span>
                  <span className="dim">{count}</span>
                </div>
              )
            })}
            <div style={{ borderTop: '1px dashed var(--line)', marginTop: 12, paddingTop: 10 }}>
              <Label>Status</Label>
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>&#x25B2; Flags (3)</div>
                <div>&#x25B8; Suggestions (7)</div>
                <div>&#x2713; Resolved (2)</div>
              </div>
            </div>
          </div>

          {/* Right cards */}
          <div style={{ padding: '18px 22px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredCards.map((c, i) => (
              <div
                key={i}
                style={{
                  border: '1.5px solid var(--ink)',
                  background: 'var(--paper)',
                  padding: '14px 18px',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: 16,
                  alignItems: 'start',
                }}
              >
                <Tag
                  variant={c.sev === 'red' ? 'red' : c.sev === 'amber' ? 'amber' : 'blue'}
                  style={{ marginTop: 3 }}
                >
                  {c.sev === 'red' ? 'FLAG' : c.sev === 'amber' ? 'REVIEW' : 'OK'}
                </Tag>
                <div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <Label>{c.cat}</Label>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20 }}>{c.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55, marginTop: 6 }}>{c.body}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {c.refs.map((r) => (
                      <Tag key={r} style={{ fontSize: 9 }}>{r}</Tag>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Btn style={{ fontSize: 10 }}>Inspect &rarr;</Btn>
                  <Btn variant="ghost" style={{ fontSize: 10 }}>Apply</Btn>
                  <Btn variant="ghost" style={{ fontSize: 10 }}>Dismiss</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export const Route = createFileRoute('/ai')({
  component: AIPage,
})
