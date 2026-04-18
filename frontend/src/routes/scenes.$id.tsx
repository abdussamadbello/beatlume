import { Fragment } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { GraphRenderer } from '../components/charts'
import { Tag, Btn, Label } from '../components/primitives'
import type { SceneNode, GraphEdge } from '../types'

const fields: [string, string][] = [
  ['POV', 'Iris'],
  ['Location', 'Orchard \u00b7 north field'],
  ['Time', 'Night \u00b7 Day 4'],
  ['Participants', 'Iris, Jon (arriving), Fen (fleeing)'],
  ['Goal', 'Save the north rows.'],
  ['Conflict', 'Wind changes; Jon refuses to leave.'],
  ['Outcome', 'Rows lost. Jon stays.'],
  ['Emotional turn', 'Desperation \u2192 resigned alliance.'],
  ['Tags', 'Fire, Alliance, Revelation'],
  ['Subplot', 'Sister disappearance (parallel)'],
]

const scores: [string, number, string][] = [
  ['Tension', 9, 'var(--ink)'],
  ['Emotional', 8, 'oklch(0.45 0.12 75)'],
  ['Stakes', 9, 'var(--blue)'],
  ['Mystery', 6, 'var(--ink-3)'],
  ['Danger', 9, 'var(--red)'],
  ['Hope', 3, 'var(--green)'],
]

const graphNodes: SceneNode[] = [
  { id: 'iris', x: 180, y: 100, label: 'Iris', initials: 'IR', type: 'hub' },
  { id: 'jon', x: 290, y: 70, label: 'Jon', initials: 'JN' },
  { id: 'fen', x: 90, y: 140, label: 'Fen', initials: 'FN' },
]

const graphEdges: GraphEdge[] = [
  { a: 'iris', b: 'jon', kind: 'alliance', weight: 3 },
  { a: 'iris', b: 'fen', kind: 'secret', weight: 2 },
]

const beats = [
  { id: 'B1', tag: 'Action', text: 'Iris runs toward the smoke' },
  { id: 'B2', tag: 'Reveal', text: 'Fen with something in his coat' },
  { id: 'B3', tag: 'Decision', text: 'Jon says "I\'m staying"' },
]

function SceneDetailPage() {
  const navigate = useNavigate()

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
        onClick={() => navigate({ to: '/scenes' })}
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
              <Label>Scene 08 &middot; Act II</Label>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 26 }}>Night &mdash; the first fire</span>
              <Tag variant="blue">Turn</Tag>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost">&laquo; S07</Btn>
              <Btn variant="ghost">S09 &raquo;</Btn>
              <Btn variant="ghost" onClick={() => navigate({ to: '/scenes' })}>&#x2715;</Btn>
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
                  The first fire comes at the edge of the north field. Iris meets it alone until Jon arrives with a
                  shovel. They watch Fen vanish into the smoke with something small cradled against his coat. By
                  morning only the scarred trees and an unspoken pact remain.
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
                      <div style={{ marginTop: 3, display: 'flex', gap: 2 }}>
                        {Array.from({ length: 10 }).map((_, k) => (
                          <span
                            key={k}
                            style={{
                              flex: 1,
                              height: 8,
                              background: k < value ? color : 'var(--line-2)',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Graph impact after this scene</Label>
                <div style={{ border: '1px solid var(--line)', marginTop: 6 }}>
                  <GraphRenderer nodes={graphNodes} edges={graphEdges} width={360} height={200} />
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
              <Btn>Open in Draft</Btn>
              <Btn variant="ghost">Linked AI</Btn>
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

export const Route = createFileRoute('/scenes/$id')({
  component: SceneDetailPage,
})
