import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Btn, Tag, Label } from '../components/primitives'

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 28px',
  borderBottom: '1.5px solid var(--ink)',
  background: 'var(--paper)',
}

const checkmark = '\u2713'
const dash = '\u2014'

interface Tier {
  name: string
  monthlyPrice: number
  annualPrice: number
  perUser: boolean
  features: string[]
  current: boolean
}

const tiers: Tier[] = [
  {
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    perUser: false,
    features: [
      '3 stories',
      '50k words per story',
      '5 AI queries per day',
      'Manual export (PDF)',
      'Single user',
      'Community support',
    ],
    current: true,
  },
  {
    name: 'Pro',
    monthlyPrice: 12,
    annualPrice: 115,
    perUser: false,
    features: [
      'Unlimited stories',
      'Unlimited words',
      'Unlimited AI queries',
      'All export formats',
      'Collaboration (up to 3)',
      'Priority support',
    ],
    current: false,
  },
  {
    name: 'Team',
    monthlyPrice: 29,
    annualPrice: 278,
    perUser: true,
    features: [
      'Everything in Pro',
      'Unlimited collaborators',
      'Team dashboard',
      'Shared templates',
      'Admin controls',
      'SSO',
    ],
    current: false,
  },
]

const comparisonFeatures = [
  { label: 'Stories', free: '3', pro: 'Unlimited', team: 'Unlimited' },
  { label: 'Words per story', free: '50k', pro: 'Unlimited', team: 'Unlimited' },
  { label: 'AI queries', free: '5/day', pro: 'Unlimited', team: 'Unlimited' },
  { label: 'Export formats', free: 'PDF only', pro: 'All', team: 'All' },
  { label: 'Collaboration', free: dash, pro: 'Up to 3', team: 'Unlimited' },
  { label: 'Shared templates', free: dash, pro: dash, team: checkmark },
  { label: 'Team dashboard', free: dash, pro: dash, team: checkmark },
  { label: 'Admin controls', free: dash, pro: dash, team: checkmark },
  { label: 'SSO', free: dash, pro: dash, team: checkmark },
  { label: 'Priority support', free: dash, pro: checkmark, team: checkmark },
]

function PricingPage() {
  const [annual, setAnnual] = useState(true)

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
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 36px' }}>
        {/* Title */}
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 36,
            margin: '0 0 8px',
            textAlign: 'center',
          }}
        >
          Choose your plan
        </h1>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            color: 'var(--ink-2)',
            textAlign: 'center',
            marginBottom: 32,
          }}
        >
          Start free, upgrade when you need more.
        </div>

        {/* Annual/Monthly toggle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            marginBottom: 40,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: !annual ? 'var(--ink)' : 'var(--ink-3)',
            }}
          >
            Monthly
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            style={{
              width: 44,
              height: 22,
              border: '1.5px solid var(--ink)',
              background: annual ? 'var(--ink)' : 'var(--paper)',
              cursor: 'pointer',
              position: 'relative',
              padding: 0,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                background: annual ? 'var(--paper)' : 'var(--ink)',
                position: 'absolute',
                top: 2,
                left: annual ? 24 : 2,
                transition: 'left 0.15s',
              }}
            />
          </button>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: annual ? 'var(--ink)' : 'var(--ink-3)',
            }}
          >
            Annual
          </span>
          {annual && (
            <Tag variant="blue" style={{ marginLeft: 4 }}>
              Save 20%
            </Tag>
          )}
        </div>

        {/* Tier cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 20,
            marginBottom: 60,
          }}
        >
          {tiers.map((tier) => {
            const price = annual ? tier.annualPrice : tier.monthlyPrice
            const period = annual
              ? tier.annualPrice === 0
                ? ''
                : '/yr'
              : tier.monthlyPrice === 0
                ? ''
                : '/mo'

            return (
              <div
                key={tier.name}
                style={{
                  border: tier.current ? '1.5px solid var(--ink)' : '1px solid var(--line)',
                  padding: '28px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22 }}>{tier.name}</span>
                  {tier.current && <Tag>Current Plan</Tag>}
                </div>

                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 32 }}>
                    ${price}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--ink-3)',
                    }}
                  >
                    {period}
                    {tier.perUser ? '/user' : ''}
                  </span>
                </div>

                <div style={{ flex: 1, marginBottom: 24 }}>
                  {tier.features.map((f) => (
                    <div
                      key={f}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        marginBottom: 8,
                        fontSize: 12,
                        color: 'var(--ink-2)',
                        lineHeight: 1.4,
                      }}
                    >
                      <span style={{ color: 'var(--green)', fontWeight: 600, flexShrink: 0 }}>
                        {checkmark}
                      </span>
                      {f}
                    </div>
                  ))}
                </div>

                {tier.current ? (
                  <Btn variant="ghost" style={{ width: '100%', justifyContent: 'center', opacity: 0.5, cursor: 'default' }}>
                    Current Plan
                  </Btn>
                ) : (
                  <Btn variant="solid" style={{ width: '100%', justifyContent: 'center' }}>
                    {tier.name === 'Free' ? 'Downgrade' : 'Upgrade'}
                  </Btn>
                )}
              </div>
            )
          })}
        </div>

        {/* Comparison table */}
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 24,
              margin: '0 0 20px',
              textAlign: 'center',
            }}
          >
            Feature comparison
          </h2>

          <div style={{ border: '1px solid var(--line)' }}>
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 120px 120px 120px',
                borderBottom: '1.5px solid var(--ink)',
                background: 'var(--paper-2)',
              }}
            >
              <div style={{ padding: '10px 16px' }}>
                <Label>Feature</Label>
              </div>
              <div style={{ padding: '10px 16px', textAlign: 'center' }}>
                <Label>Free</Label>
              </div>
              <div style={{ padding: '10px 16px', textAlign: 'center' }}>
                <Label>Pro</Label>
              </div>
              <div style={{ padding: '10px 16px', textAlign: 'center' }}>
                <Label>Team</Label>
              </div>
            </div>

            {/* Table rows */}
            {comparisonFeatures.map((row, i) => (
              <div
                key={row.label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 120px 120px',
                  borderBottom:
                    i < comparisonFeatures.length - 1 ? '1px solid var(--line)' : 'none',
                }}
              >
                <div
                  style={{
                    padding: '8px 16px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 12,
                    color: 'var(--ink-2)',
                  }}
                >
                  {row.label}
                </div>
                <div
                  style={{
                    padding: '8px 16px',
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: row.free === dash ? 'var(--ink-3)' : 'var(--ink-2)',
                  }}
                >
                  {row.free}
                </div>
                <div
                  style={{
                    padding: '8px 16px',
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: row.pro === dash ? 'var(--ink-3)' : 'var(--ink-2)',
                  }}
                >
                  {row.pro}
                </div>
                <div
                  style={{
                    padding: '8px 16px',
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: row.team === dash ? 'var(--ink-3)' : 'var(--ink-2)',
                  }}
                >
                  {row.team}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/pricing')({
  component: PricingPage,
})
