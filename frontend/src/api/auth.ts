import { useStore } from '../store'
import type { UserProfile } from '../types'
import { api, ApiError } from './client'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface TokenResponse {
  access_token: string
  token_type: string
}

export async function login(email: string, password: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: 'Login failed' }))
    throw new Error(body.detail || 'Login failed')
  }
  const data: TokenResponse = await response.json()
  // Fetch user profile
  const user = await fetchMe(data.access_token)
  useStore.getState().setAuth(data.access_token, user)
}

export async function signup(name: string, email: string, password: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
    credentials: 'include',
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: 'Signup failed' }))
    throw new Error(body.detail || 'Signup failed')
  }
  const data: TokenResponse = await response.json()
  const user = await fetchMe(data.access_token)
  useStore.getState().setAuth(data.access_token, user)
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
  } finally {
    useStore.getState().clearAuth()
  }
}

export async function forgotPassword(email: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const data = await response.json()
  return data.message
}

async function fetchMe(token: string): Promise<UserProfile> {
  const response = await fetch(`${BASE_URL}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.json()
}

/**
 * Hydrate the user profile from the backend.
 *
 * Goes through the refresh-aware api client, so an expired access token paired
 * with a still-valid refresh cookie self-heals. Returns:
 *   - 'hydrated' on success
 *   - 'auth-failed' on real auth failure (refresh cookie also invalid → caller should logout)
 *   - 'transient' on network/server hiccups (caller should leave state alone and retry later)
 */
export async function hydrateCurrentUser(): Promise<'hydrated' | 'auth-failed' | 'transient'> {
  try {
    const profile = await api.get<UserProfile>('/api/users/me')
    const { accessToken } = useStore.getState()
    if (!accessToken) return 'auth-failed'
    useStore.getState().setAuth(accessToken, profile)
    return 'hydrated'
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401 || err.status === 403) return 'auth-failed'
      return 'transient'
    }
    return 'transient'
  }
}
