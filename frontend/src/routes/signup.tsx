import { useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { Btn } from '../components/primitives'
import { signup } from '../api/auth'

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

const genres = ['Literary', 'Mystery', 'Sci-Fi', 'Fantasy', 'Romance', 'Thriller'] as const

function SignupPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password) return
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError('')
    try {
      await signup(name, email, password)
      navigate({ to: '/welcome' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
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
        padding: '40px 16px',
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
          Create your account
        </div>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              style={inputStyle}
            />
          </div>

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
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              style={inputStyle}
            />
          </div>

          {/* Confirm Password */}
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              style={inputStyle}
            />
          </div>

          {/* Genre preferences */}
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Genre Preferences</label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginTop: 8,
              }}
            >
              {genres.map((genre) => (
                <label
                  key={genre}
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
                    checked={selectedGenres.includes(genre)}
                    onChange={() => toggleGenre(genre)}
                    style={{ accentColor: 'var(--ink)' }}
                  />
                  {genre}
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <Btn
            variant="solid"
            style={{ width: '100%', justifyContent: 'center', padding: '10px 12px' }}
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create account'}
          </Btn>
        </form>

        {/* Error */}
        {error && (
          <div style={{ color: 'var(--red)', fontSize: 12, textAlign: 'center', marginTop: 12 }}>
            {error}
          </div>
        )}

        {/* Divider */}
        <div
          style={{
            borderTop: '1px solid var(--line)',
            margin: '24px 0',
          }}
        />

        {/* Login link */}
        <div
          style={{
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--ink-3)',
          }}
        >
          Already have an account?{' '}
          <Link
            to="/login"
            style={{
              color: 'var(--ink)',
              textDecoration: 'underline',
            }}
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/signup')({
  component: SignupPage,
})
