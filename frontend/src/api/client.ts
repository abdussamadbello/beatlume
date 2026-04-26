import { useStore } from '../store'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.'

// Substrings that mean a string is leaking server internals — drop the message.
// Mirrors backend's _PYTHONIC_NEEDLES for defense-in-depth: if a future careless
// `detail=str(e)` slips past backend sanitization, the user still sees clean text.
const PYTHONIC_NEEDLES = [
  'Traceback',
  'object at 0x',
  'psycopg',
  'sqlalchemy',
  'AttributeError',
  'KeyError',
  'TypeError',
  'RuntimeError',
  'OperationalError',
  'IntegrityError',
  '/site-packages/',
  'File "',
  "<class '",
  'litellm.',
]

function sanitizeServerMessage(raw: unknown): string {
  if (typeof raw !== 'string') return GENERIC_ERROR_MESSAGE
  const trimmed = raw.trim()
  if (!trimmed) return GENERIC_ERROR_MESSAGE
  if (trimmed.length > 200 || trimmed.includes('\n') || trimmed.includes('\t')) {
    return GENERIC_ERROR_MESSAGE
  }
  if (PYTHONIC_NEEDLES.some((needle) => trimmed.includes(needle))) {
    return GENERIC_ERROR_MESSAGE
  }
  // SQL fragments
  const upper = ` ${trimmed.toUpperCase()} `
  if (
    upper.includes(' INSERT ') ||
    upper.includes(' SELECT ') ||
    upper.includes(' UPDATE ') ||
    upper.includes(' DELETE ') ||
    upper.includes(' VALUES ') ||
    upper.includes(' WHERE ')
  ) {
    return GENERIC_ERROR_MESSAGE
  }
  return trimmed
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText, code: 'unknown' }))
    const safeMessage = sanitizeServerMessage(body.detail) || response.statusText || GENERIC_ERROR_MESSAGE
    throw new ApiError(response.status, body.code || 'unknown', safeMessage)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}

async function fetchWithAuth<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { accessToken } = useStore.getState()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  let response = await fetch(`${BASE_URL}${path}`, { ...options, headers, credentials: 'include' })

  if (response.status === 401 && accessToken) {
    const result = await refreshAccessToken()
    if (result.kind === 'ok') {
      headers['Authorization'] = `Bearer ${result.accessToken}`
      response = await fetch(`${BASE_URL}${path}`, { ...options, headers, credentials: 'include' })
    } else if (result.kind === 'auth-failed') {
      // Refresh token genuinely invalid (expired, revoked, never existed) — log out.
      useStore.getState().clearAuth()
      throw new ApiError(401, 'auth_expired', 'Session expired. Please log in again.')
    } else {
      // Transient: don't log out. Surface as 503 so TanStack Query's default retry
      // policy will retry the original call. Once the backend recovers, refresh succeeds.
      throw new ApiError(
        503,
        'auth_transient',
        'Connection problem. Please try again in a moment.',
      )
    }
  }

  return handleResponse<T>(response)
}

type RefreshResult =
  | { kind: 'ok'; accessToken: string }
  | { kind: 'auth-failed' }    // 401/403 from refresh — refresh token is invalid
  | { kind: 'transient' }      // network error / 5xx — don't clear auth, retryable

// Module-level single-flight: when many requests 401 in parallel (typical on first load
// after the access token expires), they all await the same in-flight refresh instead of
// stampeding the backend. Cleared in the finally so the next refresh window starts fresh.
let inFlightRefresh: Promise<RefreshResult> | null = null

function refreshAccessToken(): Promise<RefreshResult> {
  if (inFlightRefresh) return inFlightRefresh
  inFlightRefresh = (async (): Promise<RefreshResult> => {
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (response.ok) {
        const data = await response.json()
        if (typeof data?.access_token === 'string') {
          useStore.getState().setAccessToken(data.access_token)
          return { kind: 'ok', accessToken: data.access_token }
        }
        return { kind: 'transient' }
      }
      if (response.status === 401 || response.status === 403) {
        return { kind: 'auth-failed' }
      }
      // 5xx, 502, 504, gateway errors — backend hiccup, not an auth failure.
      return { kind: 'transient' }
    } catch {
      // Network error, CORS error, fetch threw — never the user's fault.
      return { kind: 'transient' }
    } finally {
      inFlightRefresh = null
    }
  })()
  return inFlightRefresh
}

export const api = {
  get: <T>(path: string) => fetchWithAuth<T>(path),
  post: <T>(path: string, body?: unknown) =>
    fetchWithAuth<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    fetchWithAuth<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    fetchWithAuth<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) => fetchWithAuth<void>(path, { method: 'DELETE' }),
}

export { ApiError }
