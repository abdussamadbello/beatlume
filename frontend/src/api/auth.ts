import { useStore } from '../store'
import type { UserProfile } from '../types'

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
