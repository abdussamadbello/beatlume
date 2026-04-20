import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Btn, Tag, Label, Panel, PanelHead } from '../components/primitives'
import { LoadingState } from '../components/LoadingState'
import { useCollaborators, useComments, useActivity } from '../api/collaboration'

export const Route = createFileRoute('/stories/$storyId/collaboration')({
  component: CollaborationPage,
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

function CollaborationPage() {
  const { storyId } = Route.useParams()
  const { data: collaboratorsData, isLoading: collabLoading } = useCollaborators(storyId)
  const { data: commentsData, isLoading: commentsLoading } = useComments(storyId)
  const { data: activityData, isLoading: activityLoading } = useActivity(storyId)

  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('reader')

  if (collabLoading || commentsLoading || activityLoading) return <LoadingState />

  const collaborators = collaboratorsData ?? []
  const comments = commentsData ?? []
  const activities = activityData ?? []

  return (
    <div style={{ padding: '32px 36px', overflow: 'auto' }}>
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
              gridTemplateColumns: '48px 1fr 100px 120px',
              gap: 12,
              padding: '10px 20px',
              borderBottom: '1px solid var(--line)',
              alignItems: 'center',
            }}
          >
            <Label>&nbsp;</Label>
            <Label>User ID</Label>
            <Label>Role</Label>
            <Label>Invited At</Label>
          </div>

          {/* Table rows */}
          {collaborators.map((collab) => (
            <div
              key={collab.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '48px 1fr 100px 120px',
                gap: 12,
                padding: '12px 20px',
                borderBottom: '1px solid var(--line-2)',
                alignItems: 'center',
              }}
            >
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
                {collab.user_id.slice(0, 2).toUpperCase()}
              </div>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13 }}>
                {collab.user_id}
              </span>
              <Tag>{collab.role}</Tag>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--ink-3)',
                }}
              >
                {collab.invited_at}
              </span>
            </div>
          ))}
          {collaborators.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
              No collaborators yet.
            </div>
          )}
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
            {activities.map((a) => (
              <div
                key={a.id}
                style={{
                  padding: '10px 20px',
                  borderBottom: '1px solid var(--line-2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{a.user_id}</span>{' '}
                  {a.action}
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
                  {a.created_at}
                </span>
              </div>
            ))}
            {activities.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
                No activity yet.
              </div>
            )}
          </div>
        </Panel>

        {/* Comments */}
        <Panel>
          <PanelHead left="Comments" right={<Label>{comments.length} comments</Label>} />
          <div style={{ padding: '8px 0' }}>
            {comments.map((c) => (
              <div
                key={c.id}
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--line-2)',
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
                    <span
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {c.user_id}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--ink-3)',
                    }}
                  >
                    {c.created_at}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--ink-2)',
                    lineHeight: 1.5,
                  }}
                >
                  {c.body}
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
                No comments yet.
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
