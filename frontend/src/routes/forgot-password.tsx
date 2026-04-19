import { useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Btn } from '../components/primitives'

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

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSent(true)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--paper)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          border: '1.5px solid var(--ink)',
          background: 'var(--paper)',
          padding: '40px 36px',
        }}
      >
        {/* Logo */}
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 28,
            fontStyle: 'italic',
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          BeatLume
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--ink-3)',
            textAlign: 'center',
            marginBottom: 32,
          }}
        >
          Reset your password
        </div>

        {sent ? (
          <div>
            <div
              style={{
                border: '1px solid var(--green)',
                background: 'var(--paper)',
                padding: '16px 20px',
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--green)',
                  marginBottom: 6,
                }}
              >
                Email sent
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  color: 'var(--ink-2)',
                  lineHeight: 1.5,
                }}
              >
                Check your email for a reset link. It may take a minute to arrive.
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Link
                to="/login"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--ink)',
                  textDecoration: 'underline',
                }}
              >
                Back to login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                color: 'var(--ink-2)',
                lineHeight: 1.5,
                marginBottom: 24,
              }}
            >
              Enter the email address associated with your account and we will send you a link to
              reset your password.
            </div>

            {/* Email */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
              />
            </div>

            {/* Submit */}
            <Btn
              variant="solid"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 12px' }}
              onClick={() => handleSubmit(new Event('submit') as unknown as FormEvent)}
            >
              Send reset link
            </Btn>

            {/* Back to login */}
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Link
                to="/login"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--ink)',
                  textDecoration: 'underline',
                }}
              >
                Back to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})
