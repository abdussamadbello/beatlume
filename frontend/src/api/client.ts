import { useStore } from '../store'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText, code: 'unknown' }))
    throw new ApiError(response.status, body.code || 'unknown', body.detail || response.statusText)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

async function fetchWithAuth<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { accessToken, clearAuth } = useStore.getState()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  let response = await fetch(`${BASE_URL}${path}`, { ...options, headers, credentials: 'include' })

  // If 401 and we have a token, try refresh
  if (response.status === 401 && accessToken) {
    const refreshed = await tryRefreshToken()
    if (refreshed) {
      // Retry with new token
      const newToken = useStore.getState().accessToken
      headers['Authorization'] = `Bearer ${newToken}`
      response = await fetch(`${BASE_URL}${path}`, { ...options, headers, credentials: 'include' })
    } else {
      clearAuth()
      throw new ApiError(401, 'auth_expired', 'Session expired. Please log in again.')
    }
  }

  return handleResponse<T>(response)
}

async function tryRefreshToken(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) return false
    const data = await response.json()
    useStore.getState().setAuth(data.access_token, useStore.getState().currentUser!)
    return true
  } catch {
    return false
  }
}

export const api = {
  get: <T>(path: string) => fetchWithAuth<T>(path),
  post: <T>(path: string, body?: unknown) =>
    fetchWithAuth<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    fetchWithAuth<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) => fetchWithAuth<void>(path, { method: 'DELETE' }),
}

export { ApiError }
