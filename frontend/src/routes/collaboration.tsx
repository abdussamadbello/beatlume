import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Btn, Tag, Label, Panel, PanelHead } from '../components/primitives'

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

const inputStyle = {
  border: '1px solid var(--ink)',
  background: 'var(--paper)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  padding: '8px 12px',
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

const collaborators = [
  {
    name: 'Elena Marsh',
    initials: 'EM',
    role: 'Author',
    lastActive: '2 minutes ago',
    permissions: 'Full access',
  },
  {
    name: 'Kai Tanaka',
    initials: 'KT',
    role: 'Editor',
    lastActive: '1 hour ago',
    permissions: 'Edit & comment',
  },
  {
    name: 'Priya Sharma',
    initials: 'PS',
    role: 'Reader',
    lastActive: '3 days ago',
    permissions: 'View & comment',
  },
]

const activities = [
  { who: 'Elena', action: 'added Scene 14', scene: 'S14', time: '2h ago' },
  { who: 'Kai', action: 'commented on', scene: 'S08', time: '5h ago' },
  { who: 'Elena', action: 'updated tension for', scene: 'S12', time: '6h ago' },
  { who: 'Priya', action: 'viewed', scene: 'S01-S10', time: '1d ago' },
  { who: 'Kai', action: 'suggested edit on', scene: 'S06', time: '1d ago' },
  { who: 'Elena', action: 'reordered', scene: 'S09-S11', time: '2d ago' },
  { who: 'Kai', action: 'approved changes in', scene: 'S04', time: '2d ago' },
  { who: 'Elena', action: 'merged draft changes for', scene: 'Act 2', time: '3d ago' },
  { who: 'Priya', action: 'left feedback on', scene: 'S15', time: '4d ago' },
  { who: 'Kai', action: 'added character note for', scene: 'Cole', time: '5d ago' },
]

const comments = [
  {
    author: 'Kai Tanaka',
    initials: 'KT',
    scene: 'Scene 08',
    text: 'The pacing here feels rushed. Consider splitting this scene to give the revelation more room to breathe.',
    time: '5h ago',
  },
  {
    author: 'Priya Sharma',
    initials: 'PS',
    scene: 'Scene 15',
    text: 'Beautiful imagery in the orchard sequence. The metaphor with the grafted branches works perfectly.',
    time: '4d ago',
  },
  {
    author: 'Kai Tanaka',
    initials: 'KT',
    scene: 'Scene 06',
    text: 'Cole\'s dialogue in paragraph 3 doesn\'t feel consistent with his voice from earlier chapters.',
    time: '1d ago',
  },
  {
    author: 'Priya Sharma',
    initials: 'PS',
    scene: 'Scene 03',
    text: 'I got confused about the timeline here. Is this a flashback or present day?',
    time: '5d ago',
  },
  {
    author: 'Kai Tanaka',
    initials: 'KT',
    scene: 'Scene 12',
    text: 'Tension drops too much after the confrontation. We need a lingering thread to carry into the next scene.',
    time: '6h ago',
  },
]

function CollaborationPage() {
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('reader')

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
              color: 'var(--ink-3)',
              textDecoration: 'none',
            }}
          >
            Settings
          </Link>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 36px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 30,
            margin: '0 0 24px',
          }}
        >
          Collaboration
        </h1>

        {/* Collaborators table */}
        <Panel style={{ marginBottom: 24 }}>
          <PanelHead
            left="Collaborators"
            right={
              <Btn
                variant="ghost"
                onClick={() => setShowInvite(!showInvite)}
                style={{ padding: '2px 8px', fontSize: 10 }}
              >
                {showInvite ? 'Cancel' : 'Invite'}
              </Btn>
            }
          />

          {showInvite && (
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-end',
              }}
            >
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="collaborator@example.com"
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' as const }}
                />
              </div>
              <div style={{ width: 140 }}>
                <label style={labelStyle}>Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    border: '1px solid var(--ink)',
                    background: 'var(--paper)',
                    padding: '8px 10px',
                    width: '100%',
                  }}
                >
                  <option value="editor">Editor</option>
                  <option value="reader">Reader</option>
                </select>
              </div>
              <Btn variant="solid" style={{ padding: '8px 16px' }}>
                Send invite
              </Btn>
            </div>
          )}

          <div>
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '48px 1fr 100px 120px 140px',
                gap: 12,
                padding: '10px 20px',
                borderBottom: '1px solid var(--line)',
                alignItems: 'center',
              }}
            >
              <Label>&nbsp;</Label>
              <Label>Name</Label>
              <Label>Role</Label>
              <Label>Last Active</Label>
              <Label>Permissions</Label>
            </div>

            {/* Table rows */}
            {collaborators.map((collab) => (
              <div
                key={collab.name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr 100px 120px 140px',
                  gap: 12,
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--line-2)',
                  alignItems: 'center',
                }}
              >
                {/* Avatar circle */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    border: '1.5px solid var(--ink)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--ink-2)',
                  }}
                >
                  {collab.initials}
                </div>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13 }}>
                  {collab.name}
                </span>
                <Tag>{collab.role}</Tag>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--ink-3)',
                  }}
                >
                  {collab.lastActive}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--ink-2)',
                  }}
                >
                  {collab.permissions}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Activity + Comments */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
          }}
        >
          {/* Activity Feed */}
          <Panel>
            <PanelHead left="Activity Feed" />
            <div style={{ padding: '8px 0' }}>
              {activities.map((a, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 20px',
                    borderBottom: i < activities.length - 1 ? '1px solid var(--line-2)' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{a.who}</span>{' '}
                    {a.action}{' '}
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--blue)',
                      }}
                    >
                      {a.scene}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--ink-3)',
                      whiteSpace: 'nowrap',
                      marginLeft: 12,
                    }}
                  >
                    {a.time}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Comments */}
          <Panel>
            <PanelHead left="Comments" right={<Label>{comments.length} comments</Label>} />
            <div style={{ padding: '8px 0' }}>
              {comments.map((c, i) => (
                <div
                  key={i}
                  style={{
                    padding: '14px 20px',
                    borderBottom: i < comments.length - 1 ? '1px solid var(--line-2)' : 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          border: '1px solid var(--ink)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          color: 'var(--ink-2)',
                        }}
                      >
                        {c.initials}
                      </div>
                      <span
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        {c.author}
                      </span>
                      <Tag variant="blue" style={{ fontSize: 9, padding: '1px 5px' }}>
                        {c.scene}
                      </Tag>
                    </div>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: 'var(--ink-3)',
                      }}
                    >
                      {c.time}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--ink-2)',
                      lineHeight: 1.5,
                      paddingLeft: 32,
                    }}
                  >
                    {c.text}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/collaboration')({
  component: CollaborationPage,
})
