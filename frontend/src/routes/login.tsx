import { useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { Btn } from '../components/primitives'
import { useStore } from '../store'

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

function LoginPage() {
  const navigate = useNavigate()
  const login = useStore(s => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (email && password) {
      login()
      navigate({ to: '/dashboard' })
    }
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
          Sign in to BeatLume
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={inputStyle}
            />
          </div>

          {/* Submit */}
          <Btn
            variant="solid"
            style={{ width: '100%', justifyContent: 'center', padding: '10px 12px' }}
            onClick={() => handleSubmit(new Event('submit') as unknown as FormEvent)}
          >
            Log in
          </Btn>
        </form>

        {/* Forgot password */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link
            to="/forgot-password"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--blue)',
              textDecoration: 'none',
            }}
          >
            Forgot password?
          </Link>
        </div>

        {/* Divider */}
        <div
          style={{
            borderTop: '1px solid var(--line)',
            margin: '24px 0',
          }}
        />

        {/* Sign up link */}
        <div
          style={{
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-3)',
          }}
        >
          Don&rsquo;t have an account?{' '}
          <Link
            to="/signup"
            style={{
              color: 'var(--ink)',
              textDecoration: 'underline',
            }}
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/login')({
  component: LoginPage,
})
