import { useState, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AppShell, Sidebar } from '../components/chrome'
import { Tag, Btn, Label } from '../components/primitives'
import { useStore } from '../store'

const categoryRouteMap: Record<string, string> = {
  Pacing: '/timeline',
  Characters: '/characters',
  Character: '/characters',
  Relationships: '/graph',
  Subplots: '/graph',
  Climax: '/timeline',
  Continuity: '/timeline',
  Structure: '/timeline',
  Symbol: '/graph',
}

function AIPage() {
  const [activeCategory, setActiveCategory] = useState('All')
  const insights = useStore(s => s.insights)
  const dismissInsight = useStore(s => s.dismissInsight)
  const navigate = useNavigate()

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    insights.forEach(c => {
      counts[c.category] = (counts[c.category] || 0) + 1
    })
    return counts
  }, [insights])

  const categories: [string, string][] = useMemo(() => {
    const result: [string, string][] = [['All', String(insights.length)]]
    const seen = new Set<string>()
    insights.forEach(c => {
      if (!seen.has(c.category)) {
        seen.add(c.category)
        result.push([c.category, String(categoryCounts[c.category] || 0)])
      }
    })
    return result
  }, [insights, categoryCounts])

  const filteredCards =
    activeCategory === 'All'
      ? insights
      : insights.filter((c) => c.category === activeCategory)

  const handleInspect = (category: string) => {
    const route = categoryRouteMap[category]
    if (route) {
      navigate({ to: route })
    }
  }

  const handleDismiss = (index: number) => {
    // Find the actual index in the full insights array
    if (activeCategory === 'All') {
      dismissInsight(index)
    } else {
      // Find the real index by mapping filtered index back to original array
      const filtered = insights.filter(c => c.category === activeCategory)
      const insight = filtered[index]
      const realIndex = insights.indexOf(insight)
      if (realIndex !== -1) {
        dismissInsight(realIndex)
      }
    }
  }

  return (
    <AppShell sidebar={<Sidebar active="/ai" />}>
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--ink)', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <Label>AI Insights</Label>
            <div className="title-serif" style={{ fontSize: 22 }}>{insights.length} recommendations &middot; explainable</div>
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
                <div>&#x25B2; Flags ({insights.filter(i => i.severity === 'red').length})</div>
                <div>&#x25B8; Suggestions ({insights.filter(i => i.severity === 'amber').length})</div>
                <div>&#x2713; Resolved ({insights.filter(i => i.severity === 'blue').length})</div>
              </div>
            </div>
          </div>

          {/* Right cards */}
          <div style={{ padding: '18px 22px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredCards.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 14 }}>
                No insights in this category.
              </div>
            )}
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
                  variant={c.severity === 'red' ? 'red' : c.severity === 'amber' ? 'amber' : 'blue'}
                  style={{ marginTop: 3 }}
                >
                  {c.severity === 'red' ? 'FLAG' : c.severity === 'amber' ? 'REVIEW' : 'OK'}
                </Tag>
                <div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <Label>{c.category}</Label>
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
                  <Btn style={{ fontSize: 10 }} onClick={() => handleInspect(c.category)}>Inspect &rarr;</Btn>
                  <Btn variant="ghost" style={{ fontSize: 10 }}>Apply</Btn>
                  <Btn variant="ghost" style={{ fontSize: 10 }} onClick={() => handleDismiss(i)}>Dismiss</Btn>
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
