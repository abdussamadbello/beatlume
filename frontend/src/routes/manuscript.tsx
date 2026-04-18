import { createFileRoute } from '@tanstack/react-router'
import { AppShell, Sidebar } from '../components/chrome'
import { Btn, Label } from '../components/primitives'
import { manuscriptChapters } from '../data'

function ManuscriptPage() {
  return (
    <AppShell sidebar={<Sidebar active="/manuscript" />}>
      <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#F3EEDF' }}>
        {/* Top reader bar */}
        <div
          style={{
            padding: '12px 32px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--paper)',
          }}
        >
          <div>
            <Label>Manuscript &middot; Draft 3</Label>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontStyle: 'italic' }}>
              A Stranger in the Orchard
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', fontSize: 11, color: 'var(--ink-2)' }}>
            <span>72,340 words</span>
            <span>47 scenes &middot; 18 chapters</span>
            <span>Reading time &asymp; 4h 50m</span>
            <Btn variant="ghost">Export &middot; PDF</Btn>
            <Btn variant="ghost">Export &middot; DOCX</Btn>
            <Btn>Edit mode</Btn>
          </div>
        </div>

        {/* Page */}
        <div style={{ overflow: 'auto', flex: 1, padding: '48px 0' }}>
          <div
            style={{
              maxWidth: 640,
              margin: '0 auto',
              background: 'var(--paper)',
              padding: '72px 84px 96px',
              boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 24px 48px -24px rgba(60,50,30,0.18)',
              fontFamily: "'Instrument Serif', serif",
              fontSize: 17,
              lineHeight: 1.75,
              color: 'var(--ink)',
            }}
          >
            {/* Title page */}
            <div style={{ textAlign: 'center', marginBottom: 80 }}>
              <div
                style={{
                  letterSpacing: '0.4em',
                  fontSize: 10,
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                }}
              >
                A Novel
              </div>
              <h1
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontWeight: 400,
                  fontSize: 42,
                  margin: '24px 0 12px',
                }}
              >
                A Stranger
                <br />
                in the Orchard
              </h1>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 18 }}>by Elena Marsh</div>
            </div>

            {/* Chapters — prose contains <em> tags from static data, safe to render as HTML */}
            {manuscriptChapters.map((ch, i) => (
              <div key={ch.num} style={{ marginTop: i === 0 ? 0 : 72, pageBreakBefore: 'always' as const }}>
                <div
                  style={{
                    textAlign: 'center',
                    letterSpacing: '0.3em',
                    fontSize: 11,
                    color: 'var(--ink-3)',
                    textTransform: 'uppercase',
                  }}
                >
                  Chapter {ch.num}
                </div>
                <h2
                  style={{
                    textAlign: 'center',
                    fontFamily: "'Instrument Serif', serif",
                    fontWeight: 400,
                    fontSize: 28,
                    margin: '10px 0 36px',
                    fontStyle: 'italic',
                  }}
                >
                  {ch.title}
                </h2>
                {ch.paras.map((p, pi) => (
                  <p
                    key={pi}
                    style={{
                      textIndent: pi === 0 ? undefined : '1.6em',
                      margin: '0 0 0.6em',
                    }}
                    dangerouslySetInnerHTML={{ __html: p }}
                  />
                ))}
              </div>
            ))}

            <div
              style={{
                marginTop: 72,
                textAlign: 'center',
                fontSize: 11,
                color: 'var(--ink-3)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              &mdash; continued &middot; chapter six &mdash;
            </div>
          </div>
        </div>

        {/* Footer reader bar */}
        <div
          style={{
            padding: '10px 32px',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: 'var(--ink-3)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            background: 'var(--paper)',
          }}
        >
          <span>page 1 of 284</span>
          <span>chapter 1&ndash;5 visible</span>
          <span>progress &middot; 28%</span>
        </div>
      </div>
    </AppShell>
  )
}

export const Route = createFileRoute('/manuscript')({
  component: ManuscriptPage,
})
