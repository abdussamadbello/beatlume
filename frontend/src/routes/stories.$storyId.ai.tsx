import { useState, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Tag, Btn, Label } from '../components/primitives'
import { LoadingState } from '../components/LoadingState'
import { useInsights, useDismissInsight } from '../api/insights'
import { useTriggerInsights } from '../api/ai'

export const Route = createFileRoute('/stories/$storyId/ai')({
  component: AIPage,
})

function AIPage() {
  const { storyId } = Route.useParams()
  const [activeCategory, setActiveCategory] = useState('All')
  const { data, isLoading } = useInsights(storyId)
  const dismissMutation = useDismissInsight(storyId)
  const generateMutation = useTriggerInsights(storyId)
  const navigate = useNavigate()

  if (isLoading) return <LoadingState />

  const insights = data?.items ?? []

  const categoryRouteMap: Record<string, string> = {
    Pacing: `/stories/${storyId}/timeline`,
    Characters: `/stories/${storyId}/characters`,
    Character: `/stories/${storyId}/characters`,
    Relationships: `/stories/${storyId}/graph`,
    Subplots: `/stories/${storyId}/graph`,
    Climax: `/stories/${storyId}/timeline`,
    Continuity: `/stories/${storyId}/timeline`,
    Structure: `/stories/${storyId}/timeline`,
    Symbol: `/stories/${storyId}/graph`,
  }

  const categoryCounts: Record<string, number> = {}
  insights.forEach(c => {
    categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1
  })

  const categories: [string, string][] = [['All', String(insights.length)]]
  const seen = new Set<string>()
  insights.forEach(c => {
    if (!seen.has(c.category)) {
      seen.add(c.category)
      categories.push([c.category, String(categoryCounts[c.category] || 0)])
    }
  })

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

  const handleDismiss = (insight: typeof insights[0]) => {
    dismissMutation.mutate(insight.id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--ink)', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <Label>AI Insights</Label>
          <div className="title-serif" style={{ fontSize: 22 }}>{insights.length} recommendations &middot; explainable</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Btn
            variant="ghost"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? 'Running...' : 'Generate Insights'}
          </Btn>
          {generateMutation.isError && (
            <span style={{ fontSize: 10, color: 'var(--red, #c00)' }}>Failed to generate</span>
          )}
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
          {filteredCards.map((c) => (
            <div
              key={c.id}
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
                <Btn variant="ghost" style={{ fontSize: 10 }} onClick={() => handleDismiss(c)}>Dismiss</Btn>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
