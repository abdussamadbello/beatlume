import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Btn, Label, Panel, PanelHead } from '../components/primitives'

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 28px',
  borderBottom: '1.5px solid var(--ink)',
  background: 'var(--paper)',
}

const labelStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  display: 'block',
  marginBottom: 4,
}

function ExportPage() {
  const [format, setFormat] = useState('pdf')
  const [includeTitlePage, setIncludeTitlePage] = useState(true)
  const [includeChapterHeaders, setIncludeChapterHeaders] = useState(true)
  const [includeSceneBreaks, setIncludeSceneBreaks] = useState(true)
  const [includeAuthorBio, setIncludeAuthorBio] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [privacy, setPrivacy] = useState('unlisted')
  const [copied, setCopied] = useState(false)

  const generateLink = () => {
    setShareLink('https://beatlume.io/share/abc123')
  }

  const copyLink = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formats = [
    { value: 'pdf', label: 'PDF' },
    { value: 'docx', label: 'DOCX' },
    { value: 'epub', label: 'ePub' },
    { value: 'txt', label: 'Plain Text' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link
            to="/dashboard"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 22,
              fontStyle: 'italic',
              textDecoration: 'none',
              color: 'var(--ink)',
            }}
          >
            BeatLume
          </Link>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.04em',
              color: 'var(--ink-3)',
            }}
          >
            / Export &amp; Share
          </span>
        </div>
        <Link
          to="/dashboard"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--ink-3)',
            textDecoration: 'none',
          }}
        >
          &larr; Back to dashboard
        </Link>
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '32px 36px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 320px',
          gap: 24,
        }}
      >
        {/* Export panel */}
        <Panel>
          <PanelHead left="Export" />
          <div style={{ padding: '20px' }}>
            {/* Format */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Format</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {formats.map((f) => (
                  <label
                    key={f.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontFamily: 'var(--font-sans)',
                      fontSize: 12,
                      color: 'var(--ink-2)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="format"
                      value={f.value}
                      checked={format === f.value}
                      onChange={() => setFormat(f.value)}
                      style={{ accentColor: 'var(--ink)' }}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Options */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Options</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                {[
                  { label: 'Include title page', checked: includeTitlePage, set: setIncludeTitlePage },
                  { label: 'Include chapter headers', checked: includeChapterHeaders, set: setIncludeChapterHeaders },
                  { label: 'Include scene breaks', checked: includeSceneBreaks, set: setIncludeSceneBreaks },
                  { label: 'Include author bio', checked: includeAuthorBio, set: setIncludeAuthorBio },
                ].map((opt) => (
                  <label
                    key={opt.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontFamily: 'var(--font-sans)',
                      fontSize: 12,
                      color: 'var(--ink-2)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={opt.checked}
                      onChange={(e) => opt.set(e.target.checked)}
                      style={{ accentColor: 'var(--ink)' }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <Btn variant="solid" style={{ width: '100%', justifyContent: 'center' }}>
              Export as {formats.find((f) => f.value === format)?.label}
            </Btn>
          </div>
        </Panel>

        {/* Share panel */}
        <Panel>
          <PanelHead left="Share" />
          <div style={{ padding: '20px' }}>
            <div
              style={{
                fontSize: 12,
                color: 'var(--ink-2)',
                lineHeight: 1.5,
                marginBottom: 20,
              }}
            >
              Generate a shareable link to your manuscript. Readers can view it in the browser
              without needing an account.
            </div>

            {!shareLink ? (
              <Btn variant="solid" onClick={generateLink} style={{ width: '100%', justifyContent: 'center' }}>
                Generate link
              </Btn>
            ) : (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Share URL</label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 4,
                    }}
                  >
                    <code
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        background: 'var(--paper-2)',
                        padding: '6px 10px',
                        border: '1px solid var(--line)',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {shareLink}
                    </code>
                    <Btn
                      variant="ghost"
                      onClick={copyLink}
                      style={{ padding: '4px 10px', whiteSpace: 'nowrap' }}
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </Btn>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Privacy</label>
                  <select
                    value={privacy}
                    onChange={(e) => setPrivacy(e.target.value)}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      border: '1px solid var(--ink)',
                      background: 'var(--paper)',
                      padding: '6px 10px',
                      width: '100%',
                    }}
                  >
                    <option value="unlisted">Unlisted</option>
                    <option value="public">Public</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* Preview panel */}
        <Panel>
          <PanelHead left="Preview" />
          <div style={{ padding: '20px' }}>
            {/* Mini manuscript preview */}
            <div
              style={{
                border: '1px solid var(--line)',
                background: '#fff',
                padding: '24px 20px',
                minHeight: 360,
              }}
            >
              {includeTitlePage && (
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: 18,
                      marginBottom: 4,
                    }}
                  >
                    A Stranger in the Orchard
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      color: 'var(--ink-3)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    by Elena Marsh
                  </div>
                  <div
                    style={{
                      borderBottom: '1px solid var(--line)',
                      margin: '16px auto',
                      width: 40,
                    }}
                  />
                </div>
              )}

              {includeChapterHeaders && (
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-3)',
                    marginBottom: 8,
                  }}
                >
                  Chapter One
                </div>
              )}

              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 11,
                  lineHeight: 1.7,
                  color: 'var(--ink-2)',
                }}
              >
                The orchard hadn&rsquo;t changed. That was the first thing Iris noticed when
                she stepped out of the car, the gravel crunching beneath shoes that had
                no business being this far from the city.
              </div>

              {includeSceneBreaks && (
                <div
                  style={{
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    color: 'var(--ink-3)',
                    margin: '12px 0',
                    letterSpacing: '0.3em',
                  }}
                >
                  ***
                </div>
              )}

              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 11,
                  lineHeight: 1.7,
                  color: 'var(--ink-2)',
                }}
              >
                Cole was waiting on the porch. He hadn&rsquo;t changed either, though
                eleven years had added lines around his mouth that made him look
                like their father.
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--ink-3)',
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Preview &middot; {format.toUpperCase()} format
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/export')({
  component: ExportPage,
})
