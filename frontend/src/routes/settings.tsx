import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Btn, Tag, Label } from '../components/primitives'

const inputStyle = {
  border: '1px solid var(--ink)',
  background: 'var(--paper)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  padding: '8px 12px',
  width: '100%',
  boxSizing: 'border-box' as const,
  outline: 'none',
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

const selectStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  border: '1px solid var(--ink)',
  background: 'var(--paper)',
  padding: '6px 10px',
  width: '100%',
}

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 28px',
  borderBottom: '1.5px solid var(--ink)',
  background: 'var(--paper)',
}

const navLinkStyle = (active: boolean) => ({
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: active ? 'var(--ink)' : 'var(--ink-3)',
  textDecoration: 'none',
  padding: '4px 0',
  borderBottom: active ? '1.5px solid var(--ink)' : '1.5px solid transparent',
})

type SettingsTab = 'profile' | 'preferences' | 'subscription' | 'export' | 'api'

const tabs: { key: SettingsTab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'preferences', label: 'Preferences' },
  { key: 'subscription', label: 'Subscription' },
  { key: 'export', label: 'Export Defaults' },
  { key: 'api', label: 'API Keys' },
]

function UsageBar({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = Math.min((used / total) * 100, 100)
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <Label>{label}</Label>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)' }}>
          {used} / {total}
        </span>
      </div>
      <div style={{ height: 4, background: 'var(--line)', width: '100%' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: pct > 80 ? 'var(--amber)' : 'var(--ink)',
          }}
        />
      </div>
    </div>
  )
}

function ProfileTab() {
  const [name, setName] = useState('Elena Marsh')
  const [email, setEmail] = useState('elena@beatlume.io')
  const [bio, setBio] = useState('')

  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, margin: '0 0 24px' }}>Profile</h2>

      {/* Avatar placeholder */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Avatar</label>
        <div
          style={{
            width: 64,
            height: 64,
            border: '1px dashed var(--ink-3)',
            background: 'var(--paper-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 18,
            color: 'var(--ink-3)',
            marginTop: 4,
          }}
        >
          EM
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A few words about yourself..."
          rows={4}
          style={{
            ...inputStyle,
            resize: 'vertical',
            fontFamily: 'var(--font-sans)',
          }}
        />
      </div>

      <Btn variant="solid">Save changes</Btn>
    </div>
  )
}

function PreferencesTab() {
  const [genre, setGenre] = useState('literary')
  const [targetWords, setTargetWords] = useState('80000')
  const [aiTone, setAiTone] = useState('conversational')
  const [theme, setTheme] = useState('light')

  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, margin: '0 0 24px' }}>
        Preferences
      </h2>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Default Genre</label>
        <select
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          style={selectStyle}
        >
          <option value="literary">Literary Fiction</option>
          <option value="mystery">Mystery</option>
          <option value="scifi">Science Fiction</option>
          <option value="fantasy">Fantasy</option>
          <option value="romance">Romance</option>
          <option value="thriller">Thriller</option>
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Target Word Count</label>
        <input
          type="number"
          value={targetWords}
          onChange={(e) => setTargetWords(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>AI Tone</label>
        <select
          value={aiTone}
          onChange={(e) => setAiTone(e.target.value)}
          style={selectStyle}
        >
          <option value="formal">Formal</option>
          <option value="conversational">Conversational</option>
          <option value="terse">Terse</option>
        </select>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Theme</label>
        <div style={{ display: 'flex', gap: 0, marginTop: 4 }}>
          {(['light', 'dark'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '6px 16px',
                border: '1px solid var(--ink)',
                background: theme === t ? 'var(--ink)' : 'var(--paper)',
                color: theme === t ? 'var(--paper)' : 'var(--ink)',
                cursor: 'pointer',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <Btn variant="solid">Save preferences</Btn>
    </div>
  )
}

function SubscriptionTab() {
  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, margin: '0 0 24px' }}>
        Subscription
      </h2>

      {/* Current plan */}
      <div
        style={{
          border: '1.5px solid var(--ink)',
          padding: '20px',
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22 }}>Free Plan</span>
          <Tag>Current</Tag>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 20 }}>
          Basic access with limited stories and AI queries.
        </div>

        <UsageBar label="Stories" used={3} total={5} />
        <UsageBar label="AI Queries Today" used={47} total={100} />

        <Link to="/pricing" style={{ textDecoration: 'none' }}>
          <Btn variant="solid">Upgrade to Pro</Btn>
        </Link>
      </div>
    </div>
  )
}

function ExportTab() {
  const [format, setFormat] = useState('pdf')
  const [pageSize, setPageSize] = useState('letter')
  const [font, setFont] = useState('serif')
  const [chapterHeaders, setChapterHeaders] = useState(true)

  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, margin: '0 0 24px' }}>
        Export Defaults
      </h2>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Format</label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          style={selectStyle}
        >
          <option value="pdf">PDF</option>
          <option value="docx">DOCX</option>
          <option value="epub">ePub</option>
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Page Size</label>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(e.target.value)}
          style={selectStyle}
        >
          <option value="letter">US Letter</option>
          <option value="a4">A4</option>
          <option value="a5">A5 (Book)</option>
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Font</label>
        <select
          value={font}
          onChange={(e) => setFont(e.target.value)}
          style={selectStyle}
        >
          <option value="serif">Serif (Georgia)</option>
          <option value="sans">Sans-Serif (Inter)</option>
          <option value="mono">Monospace (JetBrains Mono)</option>
        </select>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label
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
            checked={chapterHeaders}
            onChange={(e) => setChapterHeaders(e.target.checked)}
            style={{ accentColor: 'var(--ink)' }}
          />
          Include chapter headers
        </label>
      </div>

      <Btn variant="solid">Save defaults</Btn>
    </div>
  )
}

function ApiKeysTab() {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, margin: '0 0 24px' }}>
        API Keys
      </h2>

      <div
        style={{
          border: '1px solid var(--line)',
          padding: '16px 20px',
          marginBottom: 24,
        }}
      >
        <label style={labelStyle}>Secret Key</label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 8,
          }}
        >
          <code
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              background: 'var(--paper-2)',
              padding: '6px 10px',
              border: '1px solid var(--line)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            bl_sk_...abc123
          </code>
          <Btn variant="ghost" onClick={handleCopy} style={{ padding: '4px 10px', whiteSpace: 'nowrap' }}>
            {copied ? 'Copied' : 'Copy'}
          </Btn>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <Btn variant="ghost">Regenerate key</Btn>
      </div>

      <div
        style={{
          border: '1px solid var(--line)',
          padding: '16px 20px',
        }}
      >
        <label style={labelStyle}>Usage This Month</label>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: 'var(--ink)',
            marginTop: 8,
          }}
        >
          142 requests
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-3)',
            marginTop: 4,
          }}
        >
          Last used: 2 hours ago
        </div>
      </div>
    </div>
  )
}

function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
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
          <nav style={{ display: 'flex', gap: 20 }}>
            <Link to="/dashboard" style={navLinkStyle(false)}>Dashboard</Link>
            <Link to="/templates" style={navLinkStyle(false)}>Templates</Link>
            <Link to="/pricing" style={navLinkStyle(false)}>Pricing</Link>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-2)' }}>
            Elena Marsh
          </span>
          <Link
            to="/settings"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--ink)',
              textDecoration: 'none',
              borderBottom: '1.5px solid var(--ink)',
              paddingBottom: 2,
            }}
          >
            Settings
          </Link>
        </div>
      </div>

      {/* Settings content */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr',
          maxWidth: 1000,
          margin: '0 auto',
          minHeight: 'calc(100vh - 52px)',
        }}
      >
        {/* Settings sidebar */}
        <div
          style={{
            borderRight: '1px solid var(--line)',
            padding: '24px 0',
          }}
        >
          {tabs.map((tab) => (
            <div
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 24px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                color: activeTab === tab.key ? 'var(--ink)' : 'var(--ink-3)',
                background: activeTab === tab.key ? 'var(--paper-2)' : 'transparent',
                borderRight: activeTab === tab.key ? '2px solid var(--ink)' : '2px solid transparent',
              }}
            >
              {tab.label}
            </div>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: '32px 40px' }}>
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'preferences' && <PreferencesTab />}
          {activeTab === 'subscription' && <SubscriptionTab />}
          {activeTab === 'export' && <ExportTab />}
          {activeTab === 'api' && <ApiKeysTab />}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})
