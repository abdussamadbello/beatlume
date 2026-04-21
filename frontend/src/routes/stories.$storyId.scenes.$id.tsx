import { Fragment } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { GraphRenderer } from '../components/charts'
import { Tag, Btn, Label, TensionBar } from '../components/primitives'
import { LoadingState } from '../components/LoadingState'
import { useScenes, useScene } from '../api/scenes'
import type { SceneNode, GraphEdge } from '../types'

const graphNodes: SceneNode[] = [
  { id: 'iris', character_id: 'iris', x: 180, y: 100, label: 'Iris', initials: 'IR', node_type: 'hub', first_appearance_scene: 1 },
  { id: 'jon', character_id: 'jon', x: 290, y: 70, label: 'Jon', initials: 'JN', first_appearance_scene: 1 },
  { id: 'fen', character_id: 'fen', x: 90, y: 140, label: 'Fen', initials: 'FN', first_appearance_scene: 2 },
]

const graphEdges: GraphEdge[] = [
  { id: 'e1', source_node_id: 'iris', target_node_id: 'jon', kind: 'alliance', weight: 3, provenance: 'author', evidence: [], first_evidenced_scene: 1 },
  { id: 'e2', source_node_id: 'iris', target_node_id: 'fen', kind: 'secret', weight: 2, provenance: 'author', evidence: [], first_evidenced_scene: 2 },
]

const beats = [
  { id: 'B1', tag: 'Action', text: 'Iris runs toward the smoke' },
  { id: 'B2', tag: 'Reveal', text: 'Fen with something in his coat' },
  { id: 'B3', tag: 'Decision', text: 'Jon says "I\'m staying"' },
]

function SceneDetailPage() {
  const navigate = useNavigate()
  const { storyId, id } = Route.useParams()
  const { data: sceneData, isLoading: sceneLoading } = useScene(storyId, id)
  const { data: scenesData, isLoading: scenesLoading } = useScenes(storyId)

  if (sceneLoading || scenesLoading) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,29,36,0.35)', backdropFilter: 'blur(0.5px)' }} />
        <div style={{ position: 'relative', background: 'var(--paper)', border: '2px solid var(--ink)', boxShadow: '8px 8px 0 var(--ink)', padding: '40px 60px' }}>
          <LoadingState />
        </div>
      </div>
    )
  }

  const scene = sceneData
  const scenes = scenesData?.items ?? []

  if (!scene) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(26,29,36,0.35)', backdropFilter: 'blur(0.5px)' }}
          onClick={() => navigate({ to: '/stories/$storyId/scenes', params: { storyId } })}
        />
        <div style={{ position: 'relative', background: 'var(--paper)', border: '2px solid var(--ink)', boxShadow: '8px 8px 0 var(--ink)', padding: '40px 60px', textAlign: 'center' }}>
          <div className="title-serif" style={{ fontSize: 24, marginBottom: 12 }}>Scene not found</div>
          <Btn onClick={() => navigate({ to: '/stories/$storyId/scenes', params: { storyId } })}>Back to scenes</Btn>
        </div>
      </div>
    )
  }

  const sorted = [...scenes].sort((a, b) => a.n - b.n)
  const currentIdx = sorted.findIndex(s => s.id === id)
  const prevScene = currentIdx > 0 ? sorted[currentIdx - 1] : null
  const nextScene = currentIdx < sorted.length - 1 ? sorted[currentIdx + 1] : null

  const fields: [string, string][] = [
    ['POV', scene.pov],
    ['Location', scene.location],
    ['Act', `Act ${scene.act}`],
    ['Tag', scene.tag],
    ['Tension', `${scene.tension}/10`],
  ]

  if (scene.summary) {
    fields.push(['Summary', scene.summary])
  }

  const scores: [string, number, string][] = [
    ['Tension', scene.tension, 'var(--ink)'],
    ['Emotional', Math.min(10, scene.tension + 1), 'oklch(0.45 0.12 75)'],
    ['Stakes', scene.tension, 'var(--blue)'],
    ['Mystery', Math.max(1, scene.tension - 3), 'var(--ink-3)'],
    ['Danger', scene.tension, 'var(--red)'],
    ['Hope', Math.max(1, 10 - scene.tension), 'var(--green)'],
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999 }}>
      {/* Blurred background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(26,29,36,0.35)',
          backdropFilter: 'blur(0.5px)',
        }}
        onClick={() => navigate({ to: '/stories/$storyId/scenes', params: { storyId } })}
      />

      {/* Modal dialog */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 1080,
            maxWidth: '96%',
            background: 'var(--paper)',
            border: '2px solid var(--ink)',
            boxShadow: '8px 8px 0 var(--ink)',
            position: 'relative',
            pointerEvents: 'auto',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 24px',
              borderBottom: '1px solid var(--ink)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <Label>Scene {String(scene.n).padStart(2, '0')} &middot; Act {scene.act === 1 ? 'I' : scene.act === 2 ? 'II' : 'III'}</Label>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 26 }}>{scene.title}</span>
              <Tag variant="blue">{scene.tag}</Tag>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {prevScene && (
                <Btn variant="ghost" onClick={() => navigate({ to: '/stories/$storyId/scenes/$id', params: { storyId, id: prevScene.id } })}>
                  &laquo; S{String(prevScene.n).padStart(2, '0')}
                </Btn>
              )}
              {nextScene && (
                <Btn variant="ghost" onClick={() => navigate({ to: '/stories/$storyId/scenes/$id', params: { storyId, id: nextScene.id } })}>
                  S{String(nextScene.n).padStart(2, '0')} &raquo;
                </Btn>
              )}
              <Btn variant="ghost" onClick={() => navigate({ to: '/stories/$storyId/scenes', params: { storyId } })}>&#x2715;</Btn>
            </div>
          </div>

          {/* Two columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 0 }}>
            {/* Left: fields + summary + beats */}
            <div style={{ padding: '22px 24px', borderRight: '1px solid var(--line)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '10px 16px', fontSize: 12, lineHeight: 1.6 }}>
                {fields.map(([k, v]) => (
                  <Fragment key={k}>
                    <Label>{k}</Label>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{v}</span>
                  </Fragment>
                ))}
              </div>

              <div style={{ marginTop: 20 }}>
                <Label>Summary</Label>
                <div
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: 15,
                    lineHeight: 1.55,
                    marginTop: 6,
                    color: 'var(--ink)',
                  }}
                >
                  {scene.summary || `Scene ${scene.n}: ${scene.title}. POV: ${scene.pov}, Location: ${scene.location}.`}
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <Label>Beats (3 &middot; optional)</Label>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                  {beats.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '24px 90px 1fr',
                        gap: 8,
                        padding: '6px 8px',
                        background: 'var(--paper-2)',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{b.id}</span>
                      <Tag>{b.tag}</Tag>
                      <span>{b.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: scoring + graph */}
            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Label>Scoring</Label>
                  <Label>Hybrid &middot; AI + manual</Label>
                </div>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {scores.map(([label, value, color]) => (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span>{label}</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{value}/10</span>
                      </div>
                      <div style={{ marginTop: 3 }}>
                        <TensionBar
                          value={value}
                          max={10}
                          height={8}
                          color={color}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Graph impact after this scene</Label>
                <div style={{ border: '1px solid var(--line)', marginTop: 6 }}>
                  <GraphRenderer nodes={graphNodes} edges={graphEdges} width={360} height={200} interactive={false} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                  +1 edge (Iris&harr;Jon). Fen edge upgraded 1&rarr;2.
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '12px 24px',
              borderTop: '1px solid var(--ink)',
              background: 'var(--paper-2)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={() => navigate({ to: '/stories/$storyId/draft', params: { storyId } })}>Open in Draft</Btn>
              <Btn variant="ghost" onClick={() => navigate({ to: '/stories/$storyId/ai', params: { storyId } })}>Linked AI</Btn>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost">Delete</Btn>
              <Btn variant="solid">Save</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/stories/$storyId/scenes/$id')({
  component: SceneDetailPage,
})
