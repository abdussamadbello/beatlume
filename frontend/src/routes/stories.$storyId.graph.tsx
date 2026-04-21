import { useState, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { GraphRenderer } from '../components/charts'
import { SegmentedControl } from '../components/primitives'
import { TimeScrubber } from '../components/TimeScrubber'
import { EdgeLegend } from '../components/EdgeLegend'
import { LoadingState } from '../components/LoadingState'
import { useGraph } from '../api/graph'
import { useStore } from '../store'
import { useTensionCurve } from '../api/analytics'
import { useTriggerRelationships } from '../api/ai'
import type { SceneNode } from '../types'

export const Route = createFileRoute('/stories/$storyId/graph')({
  component: GraphView,
})

function GraphView() {
  const { storyId } = Route.useParams()
  const { data: graphData, isLoading } = useGraph(storyId)
  const { data: tensionCurveData } = useTensionCurve(storyId)
  const relationshipsMutation = useTriggerRelationships(storyId)
  const selectedNodeId = useStore(s => s.selectedNodeId)
  const selectNode = useStore(s => s.selectNode)

  const [mode, setMode] = useState('Characters')
  const [filters, setFilters] = useState({
    hideMinor: false,
    onlyUnresolved: false,
    allActs: true,
    allPov: true,
  })
  // Default to final scene so relationship lines are visible on first load (earlier
  // slices hide edges/nodes by first_evidenced / first_appearance until that scene).
  const [scrubberPosition, setScrubberPosition] = useState(46)

  const nodes = graphData?.nodes ?? []
  const edges = graphData?.edges ?? []
  const sampleActs = tensionCurveData?.acts ?? []

  const visibleNodes: SceneNode[] = useMemo(
    () => (filters.hideMinor ? nodes.filter((n) => n.node_type !== 'minor') : nodes),
    [nodes, filters.hideMinor],
  )

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null
  const selectedEdges = selectedNodeId
    ? edges.filter(e => e.source_node_id === selectedNodeId || e.target_node_id === selectedNodeId)
    : []

  if (isLoading) return <LoadingState />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header with mode toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid var(--ink)' }}>
        <SegmentedControl
          options={['Characters', 'Scenes', 'Subplots', 'Mixed']}
          value={mode}
          onChange={setMode}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ padding: '6px 10px', border: '1px solid var(--ink-3)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Cluster: Subplot {'\u25BE'}</span>
          <span style={{ padding: '6px 10px', border: '1px solid var(--ink-3)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Layout: Force {'\u25BE'}</span>
          <span
            onClick={() => relationshipsMutation.mutate()}
            style={{
              padding: '6px 10px',
              border: '1px solid var(--ink)',
              background: relationshipsMutation.isPending ? 'var(--paper-2)' : 'var(--ink)',
              color: relationshipsMutation.isPending ? 'var(--ink-3)' : 'var(--paper)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              cursor: relationshipsMutation.isPending ? 'wait' : 'pointer',
              pointerEvents: relationshipsMutation.isPending ? 'none' : 'auto',
            }}
          >
            {relationshipsMutation.isPending ? 'Running...' : 'Suggest Relationships'}
          </span>
          {relationshipsMutation.isError && (
            <span style={{ fontSize: 10, color: 'var(--red, #c00)', alignSelf: 'center' }}>Failed</span>
          )}
          <span style={{ padding: '6px 10px', border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Export SVG</span>
        </div>
      </div>

      {/* Main content: graph + right panel */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 240px', overflow: 'hidden' }}>
        <div style={{ position: 'relative' }} className="grid-bg-fine">
          <GraphRenderer
            width={920}
            height={560}
            nodes={visibleNodes}
            edges={edges}
            timeSlice={scrubberPosition + 1}
            onNodeClick={(id) => selectNode(id)}
            selectedId={selectedNodeId ?? undefined}
          />
        </div>

        {/* Right sidebar */}
        <div style={{ borderLeft: '1px solid var(--ink)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Edge kinds legend */}
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--ink-3)' }}>Edge kinds</div>
            <div style={{ marginTop: 8 }}>
              <EdgeLegend />
            </div>
          </div>

          {/* Filters */}
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--ink-3)' }}>Filters</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, fontSize: 11 }}>
              <label style={{ display: 'flex', gap: 6 }}>
                <input type="checkbox" checked={filters.allActs} onChange={(e) => setFilters(f => ({ ...f, allActs: e.target.checked }))} />
                Act I {'\u00B7'} II {'\u00B7'} III
              </label>
              <label style={{ display: 'flex', gap: 6 }}>
                <input type="checkbox" checked={filters.allPov} onChange={(e) => setFilters(f => ({ ...f, allPov: e.target.checked }))} />
                All POV
              </label>
              <label style={{ display: 'flex', gap: 6 }}>
                <input type="checkbox" checked={filters.hideMinor} onChange={(e) => setFilters(f => ({ ...f, hideMinor: e.target.checked }))} />
                Hide minor (&lt;3)
              </label>
              <label style={{ display: 'flex', gap: 6 }}>
                <input type="checkbox" checked={filters.onlyUnresolved} onChange={(e) => setFilters(f => ({ ...f, onlyUnresolved: e.target.checked }))} />
                Only unresolved
              </label>
            </div>
          </div>

          {/* Selected info */}
          <div style={{ marginTop: 'auto', borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--ink-3)' }}>
              Selected {'\u00B7'} {selectedNode ? selectedNode.label : 'None'}
            </div>
            {selectedNode ? (
              <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 4 }}>
                {selectedEdges.length} relationships {'\u00B7'} {selectedNode.node_type === 'hub' ? 'hub node' : 'standard node'}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>Click a node to inspect</div>
            )}
          </div>
        </div>
      </div>

      {/* Time scrubber */}
      <div style={{ borderTop: '1px solid var(--ink)', padding: '10px 24px', background: 'var(--paper-2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 6 }}>
          <span>Time-slice {'\u00B7'} Scene {scrubberPosition + 1} of 47</span>
          <span>Drag to animate relationships across the story {'\u2192'}</span>
        </div>
        <TimeScrubber
          position={scrubberPosition}
          max={46}
          acts={sampleActs}
          onChange={setScrubberPosition}
        />
      </div>
    </div>
  )
}
