import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Btn, Panel, PanelHead, Spinner } from '../components/primitives'
import { useTriggerExport, useExportStatus, useExportHistory, type ExportJobStatus } from '../api/export'

export const Route = createFileRoute('/stories/$storyId/export')({
  component: ExportPage,
})

const labelStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  display: 'block',
  marginBottom: 4,
}

const exportJobStorageKey = (storyId: string) => `beatlume:export-job:${storyId}`

const readStoredJobId = (storyId: string): string | null => {
  try {
    return window.localStorage.getItem(exportJobStorageKey(storyId))
  } catch {
    return null
  }
}

const writeStoredJobId = (storyId: string, jobId: string | null) => {
  try {
    if (jobId) window.localStorage.setItem(exportJobStorageKey(storyId), jobId)
    else window.localStorage.removeItem(exportJobStorageKey(storyId))
  } catch {
    // localStorage may be disabled (private mode, quota); fail silently
  }
}

const formatRelativeTime = (epochSeconds: number | null): string => {
  if (!epochSeconds) return ''
  const diff = Math.max(0, Date.now() / 1000 - epochSeconds)
  if (diff < 60) return 'JUST NOW'
  if (diff < 3600) return `${Math.floor(diff / 60)}M AGO`
  if (diff < 86400) return `${Math.floor(diff / 3600)}H AGO`
  return `${Math.floor(diff / 86400)}D AGO`
}

const statusColor = (status: string): string => {
  if (status === 'completed') return 'var(--green, #1a7f37)'
  if (status === 'failed') return 'var(--red, #c00)'
  if (status === 'running') return 'var(--blue, #06c)'
  return 'var(--ink-3)'
}

function ExportHistoryRow({ job }: { job: ExportJobStatus }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '60px 1fr 90px 120px',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderBottom: '1px solid var(--line)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        {job.format ?? '—'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: statusColor(job.status),
            flexShrink: 0,
          }}
          aria-label={job.status}
        />
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            color: 'var(--ink-2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {job.status === 'completed' && job.filename
            ? job.filename
            : job.status === 'failed'
            ? job.error ?? 'Export failed'
            : job.status === 'running'
            ? `Generating... ${Math.round((job.progress ?? 0) * 100)}%`
            : 'Queued'}
        </span>
      </div>
      <div
        style={{
          fontSize: 9,
          letterSpacing: '0.08em',
          color: 'var(--ink-3)',
          textTransform: 'uppercase',
        }}
      >
        {formatRelativeTime(job.created_at)}
      </div>
      <div style={{ justifySelf: 'end' }}>
        {job.status === 'completed' && job.download_url ? (
          <a href={job.download_url} target="_blank" rel="noopener noreferrer">
            <Btn variant="ghost" style={{ padding: '4px 12px' }}>
              Download
            </Btn>
          </a>
        ) : (
          <span style={{ fontSize: 9, letterSpacing: '0.08em', color: 'var(--ink-3)' }}>—</span>
        )}
      </div>
    </div>
  )
}

function ExportPage() {
  const { storyId } = Route.useParams()
  const exportMutation = useTriggerExport(storyId)
  const [activeJobId, setActiveJobId] = useState<string | null>(() => readStoredJobId(storyId))
  const exportStatus = useExportStatus(storyId, activeJobId)
  const exportHistory = useExportHistory(storyId)
  const [format, setFormat] = useState('pdf')
  const [includeTitlePage, setIncludeTitlePage] = useState(true)
  const [includeChapterHeaders, setIncludeChapterHeaders] = useState(true)
  const [includeSceneBreaks, setIncludeSceneBreaks] = useState(true)
  const [includeAuthorBio, setIncludeAuthorBio] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [privacy, setPrivacy] = useState('unlisted')
  const [copied, setCopied] = useState(false)

  const job = exportStatus.data
  // If the saved job id is stale (Redis TTL expired → 404), drop it so the UI unsticks.
  useEffect(() => {
    if (activeJobId && exportStatus.isError) {
      writeStoredJobId(storyId, null)
      setActiveJobId(null)
    }
  }, [activeJobId, exportStatus.isError, storyId])

  // When the active job lands in a terminal state, refresh history so the new row appears.
  useEffect(() => {
    if (job?.status === 'completed' || job?.status === 'failed') {
      exportHistory.refetch()
    }
  }, [job?.status, exportHistory])

  const isRunning =
    exportMutation.isPending ||
    (!!activeJobId &&
      !exportStatus.isError &&
      job?.status !== 'completed' &&
      job?.status !== 'failed')

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
    { value: 'plaintext', label: 'Plain Text' },
  ]

  return (
    <div style={{ padding: '32px 36px', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, margin: 0 }}>Export &amp; Share</h1>
      </div>

      <div
        style={{
          maxWidth: 1100,
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

            <Btn
              variant="solid"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() =>
                exportMutation.mutate(
                  {
                    format,
                    options: {
                      include_title_page: includeTitlePage,
                      include_chapter_headers: includeChapterHeaders,
                      include_scene_breaks: includeSceneBreaks,
                      include_author_bio: includeAuthorBio,
                    },
                  },
                  {
                    onSuccess: (res) => {
                      writeStoredJobId(storyId, res.job_id)
                      setActiveJobId(res.job_id)
                    },
                  },
                )
              }
              disabled={isRunning}
            >
              {isRunning ? (
                job?.status === 'running' ? (
                  <>
                    <Spinner variant="ticker" color="var(--paper)" />
                    Generating · {Math.round((job.progress ?? 0) * 100)}%
                  </>
                ) : (
                  <>
                    <Spinner variant="pulse" color="var(--paper)" />
                    Exporting
                  </>
                )
              ) : (
                `Export as ${formats.find((f) => f.value === format)?.label}`
              )}
            </Btn>
            {exportMutation.isError && (
              <div style={{ fontSize: 10, color: 'var(--red, #c00)', marginTop: 6, textAlign: 'center' }}>
                Export failed. Please try again.
              </div>
            )}
            {job?.status === 'failed' && (
              <div style={{ fontSize: 10, color: 'var(--red, #c00)', marginTop: 6, textAlign: 'center' }}>
                {job.error ?? 'Export failed. Please try again.'}
              </div>
            )}
            {job?.status === 'completed' && job.download_url && (
              <div style={{ marginTop: 12 }}>
                <a href={job.download_url} target="_blank" rel="noopener noreferrer">
                  <Btn variant="solid" style={{ width: '100%', justifyContent: 'center' }}>
                    Download {job.filename ?? 'file'}
                  </Btn>
                </a>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--ink-3)',
                    marginTop: 6,
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.06em',
                  }}
                >
                  Link expires in 24 hours
                </div>
              </div>
            )}
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

      <div style={{ maxWidth: 1100, marginTop: 24 }}>
        <Panel>
          <PanelHead left="Recent exports" />
          <div>
            {exportHistory.isLoading ? (
              <div
                style={{
                  padding: 16,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--ink-3)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Loading…
              </div>
            ) : !exportHistory.data || exportHistory.data.items.length === 0 ? (
              <div
                style={{
                  padding: 16,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  color: 'var(--ink-3)',
                }}
              >
                No exports yet. Export a manuscript above and it will appear here.
              </div>
            ) : (
              exportHistory.data.items.map((j) => (
                <ExportHistoryRow key={j.job_id} job={j} />
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
