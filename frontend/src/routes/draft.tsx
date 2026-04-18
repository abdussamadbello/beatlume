import { createFileRoute } from '@tanstack/react-router'
import { AppShell, Sidebar } from '../components/chrome'
import { Tag, Label } from '../components/primitives'
import { sampleScenes } from '../data'

const sceneRail = [...sampleScenes, ...sampleScenes].slice(0, 14)

function DraftPage() {
  return (
    <AppShell sidebar={<Sidebar active="/draft" />}>
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 300px', overflow: 'hidden' }}>
        {/* Scene rail */}
        <div style={{ borderRight: '1px solid var(--line)', overflow: 'auto' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
            <Label>Scenes &middot; 47</Label>
            <Label>Draft 3</Label>
          </div>
          {sceneRail.map((s, i) => {
            const isActive = i === 2
            return (
              <div
                key={i}
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px dashed var(--line-2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  ...(isActive
                    ? { background: 'var(--paper-2)', borderLeft: '2px solid var(--blue)', paddingLeft: 14 }
                    : {}),
                }}
              >
                <div>
                  <Label style={{ fontSize: 9 }}>S{String(i + 1).padStart(2, '0')} &middot; {s.pov}</Label>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14 }}>{s.title}</div>
                </div>
                <Tag style={{ fontSize: 9 }}>T {s.tension}</Tag>
              </div>
            )
          })}
        </div>

        {/* Editor */}
        <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 36px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Label>S03 &middot; Iris &middot; Porch</Label>
              <div className="title-serif" style={{ fontSize: 24 }}>Wren returns, uninvited</div>
              <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
                Goal: Iris wants Wren to leave. Conflict: Wren brings news that upends the letter. Outcome: Wren stays the night.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn ghost" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '6px 10px', border: '1px solid var(--ink-3)', background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer' }}>Outline mode</button>
              <button className="btn" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '6px 10px', border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)', cursor: 'pointer' }}>AI continue</button>
            </div>
          </div>
          <div
            style={{
              padding: '24px 36px',
              fontFamily: "'Instrument Serif', serif",
              fontSize: 17,
              lineHeight: 1.75,
              color: 'var(--ink)',
              maxWidth: 720,
              overflow: 'auto',
            }}
          >
            <p>
              The porch boards complained under his boots before she saw him, which meant she had ten seconds to
              pretend the letter had never come. Iris folded it twice along a seam already tired from folding, slid
              it into the pocket of her apron, and wiped her hands on the same apron as if flour, not paper, were
              the thing she needed to get rid of.
            </p>
            <p>&ldquo;You&rsquo;re early,&rdquo; she said, without turning.</p>
            <p>&ldquo;I&rsquo;m not early, Iris. You&rsquo;ve just been expecting me for eleven years.&rdquo;</p>
            <p>
              She turned then, because not turning would have been the louder answer. Wren looked older in the
              unkind way men sometimes did — not weathered, exactly, but <em>used</em>, as if the intervening years
              had handled him roughly and put him back in a different order. He was still tall. He still stood with
              one shoulder forward, as if listening for a door he did not trust.
            </p>
            <p>&ldquo;You shouldn&rsquo;t be on this porch.&rdquo;</p>
            <p>&ldquo;I know.&rdquo; He did not move. &ldquo;I read about Cole.&rdquo;</p>
            <p>
              The name, said aloud by him, landed somewhere below her ribs. She waited for it to finish landing.
            </p>
            <p>&ldquo;Read where.&rdquo;</p>
            <p>
              &ldquo;A paper in Billings. A small one. I wouldn&rsquo;t have seen it except a woman I used to
              — &rdquo; he stopped, decided against the sentence, and tried a different one. &ldquo;Someone sent it
              to me. I came as soon as I could, which wasn&rsquo;t soon.&rdquo;
            </p>
            <p>&ldquo;He&rsquo;s been gone four months.&rdquo;</p>
            <p>
              &ldquo;I know that too.&rdquo; He looked past her, at the orchard, and the old habit of his face —
              the small tightening at the jaw before a truth he didn&rsquo;t want to tell — arrived exactly where
              she remembered it. &ldquo;Iris. The orchard.&rdquo;
            </p>
            <p>&ldquo;Don&rsquo;t.&rdquo;</p>
            <p>
              &ldquo;The lawyer in Helena has been writing to the wrong address for months. That&rsquo;s why you
              haven&rsquo;t had the letters. They&rsquo;ve been going to <em>my</em> mother, because my
              father&rsquo;s name is on the deed and nobody bothered to update it in 1974. She kept them. All of
              them. I have them in the truck.&rdquo;
            </p>
            <p>
              The wind moved in the apple trees, and for a second the whole yard seemed to tilt toward the road.
            </p>
            <p>&ldquo;How many letters.&rdquo;</p>
            <p>&ldquo;Fourteen.&rdquo;</p>

            {/* AI continuation prompt */}
            <p
              style={{
                color: 'var(--ink-3)',
                borderLeft: '2px solid var(--line)',
                paddingLeft: 12,
                fontStyle: 'italic',
              }}
            >
              AI will continue from here using: Iris&rsquo;s unread-letter arc (est. S02, S05), Wren&rsquo;s return
              motive, the porch as threshold motif, and the sale-deadline reveal scheduled for S04.
            </p>

            {/* Graph update suggestion */}
            <p
              style={{
                background: 'var(--blue-soft)',
                borderLeft: '3px solid var(--blue)',
                padding: '10px 14px',
                fontFamily: 'var(--font-mono)',
                fontSize: 12.5,
                color: 'var(--ink)',
                fontStyle: 'normal',
              }}
            >
              <strong>Update graph from this scene?</strong> New edge suggested: Iris &harr; Wren &middot;
              &ldquo;alliance (reluctant)&rdquo;.{' '}
              <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Accept</span> &middot;{' '}
              <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Edit</span> &middot;{' '}
              <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Dismiss</span>
            </p>
          </div>
          <div
            style={{
              marginTop: 'auto',
              padding: '10px 36px',
              borderTop: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 10,
              color: 'var(--ink-3)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            <span>847 words &middot; autosaved 14:02</span>
            <span>Target: 1,200&ndash;1,800</span>
          </div>
        </div>

        {/* Memory panel */}
        <div
          style={{
            borderLeft: '1px solid var(--line)',
            padding: '14px 16px',
            overflow: 'auto',
            background: 'var(--paper-2)',
          }}
        >
          <Label>Story memory in scope</Label>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
            Only these are passed to the model.
          </div>

          <div style={{ marginTop: 14 }}>
            <Label>Participants</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
              {[
                ['Iris', 'Protagonist, widow. Flaw: cannot trust.'],
                ['Wren', 'Foil. Left eleven years ago.'],
              ].map(([name, desc]) => (
                <div
                  key={name}
                  style={{
                    border: '1px solid var(--line)',
                    padding: 8,
                    background: 'var(--paper)',
                    fontSize: 11,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{name}</strong>
                    <span className="dim">scene 3 of 40</span>
                  </div>
                  <div style={{ color: 'var(--ink-2)', marginTop: 3 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <Label>Active relationships</Label>
            <div style={{ fontSize: 11, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div>
                Iris &harr; Wren &middot; <em>unresolved</em> &middot; last seen S01 (flashback)
              </div>
              <div>
                Iris &harr; Cole &middot; <em>conflict</em> &middot; letter arrived S02
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <Label>Prior scene summary</Label>
            <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.5 }}>
              S02 &middot; The letter: Cole&rsquo;s lawyer confirmed the orchard sale would proceed. Iris burned the
              envelope but kept the page.
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <Label>Targets</Label>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              Tension 6 &middot; Outcome: Wren stays the night &middot; Reveal: partial (hold the body of the
              letter).
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export const Route = createFileRoute('/draft')({
  component: DraftPage,
})
