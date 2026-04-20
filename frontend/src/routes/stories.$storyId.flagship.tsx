import { useState, useEffect, useRef, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { GraphRenderer, TensionCurve } from '../components/charts'
import { Anno, Tag, Btn, Label } from '../components/primitives'
import { TimeScrubber } from '../components/TimeScrubber'
import { EdgeLegend } from '../components/EdgeLegend'
import { LoadingState } from '../components/LoadingState'
import { useGraph } from '../api/graph'
import { useStore } from '../store'
import { tensionData, sampleActs, samplePeaks } from '../data'
import type { SceneNode } from '../types'

export const Route = createFileRoute('/stories/$storyId/flagship')({
  component: FlagshipView,
})

const historyEntries = [
  { scene: 'S02', text: 'First letter \u2014 tension 5' },
  { scene: 'S14', text: 'Court confrontation \u2014 7' },
  { scene: 'S21', text: 'Cole denies \u2014 8' },
  { scene: 'S23', text: '\u25B6 Today \u2014 7' },
] as const;

const edgeAppearances = [1, 2, 6, 14, 17, 21, 23, 26, 32, 37];

function FlagshipView() {
  const { storyId } = Route.useParams()
  const { data: graphData, isLoading } = useGraph(storyId)
  const selectedNodeId = useStore(s => s.selectedNodeId)
  const selectNode = useStore(s => s.selectNode)

  const [scrubberPosition, setScrubberPosition] = useState(22)
  const [isPlaying, setIsPlaying] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const nodes = graphData?.nodes ?? []
  const edges = graphData?.edges ?? []

  const scaledNodes: SceneNode[] = nodes.map((n) => ({
    ...n,
    x: n.x * 1.4 + 40,
    y: n.y * 0.95,
  }))

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null
  const selectedEdges = selectedNodeId
    ? edges.filter(e => e.source_node_id === selectedNodeId || e.target_node_id === selectedNodeId)
    : []

  const stopPlayback = useCallback(() => {
    setIsPlaying(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const startPlayback = useCallback(() => {
    setIsPlaying(true)
  }, [])

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setScrubberPosition(prev => {
          if (prev >= 46) {
            stopPlayback()
            return 46
          }
          return prev + 1
        })
      }, 800)
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isPlaying, stopPlayback])

  const togglePlayback = () => {
    if (isPlaying) {
      stopPlayback()
    } else {
      if (scrubberPosition >= 46) {
        setScrubberPosition(0)
      }
      startPlayback()
    }
  }

  if (isLoading) return <LoadingState />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid var(--ink)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <div className="title-serif" style={{ fontSize: 22 }}>Graph {'\u00D7'} Timeline</div>
          <Tag variant="blue">Linked</Tag>
          <Label>S01 {'\u2014'} S47 {'\u00B7'} all POV {'\u00B7'} all subplots</Label>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost">Metric: Tension {'\u25BE'}</Btn>
          <Btn variant="ghost">Graph: Characters {'\u25BE'}</Btn>
          <Btn variant="solid" onClick={togglePlayback}>
            {isPlaying ? 'Pause \u275A\u275A' : 'Play \u25B8'}
          </Btn>
        </div>
      </div>

      {/* Graph region */}
      <div style={{ flex: 1.4, display: 'grid', gridTemplateColumns: '1fr 260px', borderBottom: '1px solid var(--ink)', overflow: 'hidden' }}>
        <div style={{ position: 'relative' }} className="grid-bg-fine">
          <GraphRenderer
            width={920}
            height={430}
            nodes={scaledNodes}
            edges={edges}
            onNodeClick={(id) => selectNode(id)}
            selectedId={selectedNodeId ?? undefined}
          />
          <Anno variant="blue" style={{ left: 480, top: 200 }}>@ S{scrubberPosition + 1} {'\u2014'} Iris {'\u2194'} Cole heat rising</Anno>
          <Anno variant="red" style={{ left: 700, top: 160 }}>new edge forms at S{scrubberPosition + 1}</Anno>
          <Anno style={{ left: 140, top: 380, borderStyle: 'dashed', color: 'var(--ink-3)' }}>dormant since S14</Anno>
          {/* Time marker corner */}
          <div style={{ position: 'absolute', top: 12, right: 12, background: 'var(--ink)', color: 'var(--paper)', padding: '4px 10px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            NOW {'\u00B7'} SCENE {scrubberPosition + 1} / 47
          </div>
        </div>

        {/* Inspector panel */}
        <div style={{ borderLeft: '1px solid var(--ink)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 11 }}>
          {selectedNode ? (
            <div>
              <Label>Inspector {'\u00B7'} Node</Label>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, marginTop: 4 }}>{selectedNode.label}</div>
              <div className="dim" style={{ marginTop: 2 }}>
                {selectedNode.node_type === 'hub' ? 'Hub' : 'Standard'} {'\u00B7'} {selectedEdges.length} edges
              </div>
              <div style={{ marginTop: 8, height: 24, display: 'flex', gap: 1 }}>
                {Array.from({ length: 47 }).map((_, i) => {
                  const sceneNum = i + 1;
                  const cur = sceneNum === scrubberPosition + 1;
                  const hasEdge = selectedEdges.some(e => {
                    const otherNode = e.source_node_id === selectedNodeId ? e.target_node_id : e.source_node_id;
                    return edgeAppearances.includes(sceneNum) || otherNode === selectedNodeId;
                  });
                  return (
                    <span key={i} style={{ flex: 1, background: cur ? 'var(--blue)' : hasEdge ? 'var(--ink)' : 'var(--line-2)' }} />
                  );
                })}
              </div>
              <div className="dim" style={{ fontSize: 9, marginTop: 4 }}>appearance map {'\u00B7'} S01 {'\u2192'} S47</div>
            </div>
          ) : (
            <div>
              <Label>Inspector {'\u00B7'} Edge</Label>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, marginTop: 4 }}>Iris {'\u2194'} Cole</div>
              <div className="dim" style={{ marginTop: 2 }}>Conflict {'\u00B7'} intensity 3/3 {'\u00B7'} polarity {'\u2013'}</div>
              <div style={{ marginTop: 8, height: 24, display: 'flex', gap: 1 }}>
                {Array.from({ length: 47 }).map((_, i) => {
                  const sceneNum = i + 1;
                  const on = edgeAppearances.includes(sceneNum);
                  const cur = sceneNum === scrubberPosition + 1;
                  return (
                    <span key={i} style={{ flex: 1, background: cur ? 'var(--blue)' : on ? 'var(--red)' : 'var(--line-2)' }} />
                  );
                })}
              </div>
              <div className="dim" style={{ fontSize: 9, marginTop: 4 }}>appearance map {'\u00B7'} S01 {'\u2192'} S47</div>
            </div>
          )}

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
            <div style={{ marginTop: 4 }}>Reveal slot between S26{'\u2013'}S30 still unfilled.</div>
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
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <EdgeLegend />
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
              BRUSH {'\u00B7'} S22{'\u2013'}S28
            </div>
          </div>
          {/* Scrubber */}
          <div style={{ position: 'absolute', left: `${((scrubberPosition) / 46) * 100}%`, top: 10, bottom: 20, width: 2, background: 'var(--blue)' }}>
            <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, background: 'var(--blue)', border: '2px solid var(--paper)' }} />
            <div style={{ position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--blue)' }}>S{scrubberPosition + 1}</div>
          </div>
          <Anno variant="red" style={{ left: 550, top: 210 }}>AI {'\u00B7'} flat middle {'\u00B7'} 6 scenes</Anno>
        </div>
        <div style={{ marginTop: 12 }}>
          <TimeScrubber
            position={scrubberPosition}
            max={46}
            acts={sampleActs}
            onChange={setScrubberPosition}
            label={`Scene ${scrubberPosition + 1} of 47`}
          />
        </div>
      </div>
    </div>
  )
}
