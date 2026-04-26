/**
 * Auth lifecycle hooks: boot hydration, proactive refresh scheduling,
 * cross-tab logout sync. Mounted once at the root of the app.
 */
import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { hydrateCurrentUser } from './auth'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
// Refresh this many seconds before the token's exp. Far enough that an in-flight
// retry can complete before expiry; close enough that we don't refresh wastefully.
const REFRESH_LEAD_SECONDS = 60
// Floor — never schedule a refresh sooner than this, even if exp is closer.
const MIN_REFRESH_DELAY_MS = 5_000

/** Decode the exp claim from a JWT. Pure timing read — no signature check. */
function decodeJwtExpSeconds(token: string): number | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    // base64url → base64
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    const json = JSON.parse(atob(padded))
    return typeof json.exp === 'number' ? json.exp : null
  } catch {
    return null
  }
}

async function callRefresh(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) return false
    const data = await response.json()
    if (typeof data?.access_token === 'string') {
      useStore.getState().setAccessToken(data.access_token)
      return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * Boot hydration: if we have a token but no user (e.g. localStorage half-cleared,
 * persisted state corrupted, OAuth callback returned only a token), fetch /me.
 */
export function useAuthBootHydration() {
  const accessToken = useStore((s) => s.accessToken)
  const currentUser = useStore((s) => s.currentUser)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    if (!accessToken) return
    if (currentUser) return  // already hydrated from localStorage
    ranRef.current = true
    void hydrateCurrentUser().then((result) => {
      if (result === 'auth-failed') {
        useStore.getState().clearAuth()
      }
      // 'transient' → leave state alone; user is still logged in by token,
      // their name will populate next time hydration runs.
    })
  }, [accessToken, currentUser])
}

/**
 * Proactive refresh: schedule a refresh ~60s before the access token expires.
 * Reschedules whenever the token changes (login, refresh, logout).
 */
export function useProactiveRefresh() {
  const accessToken = useStore((s) => s.accessToken)

  useEffect(() => {
    if (!accessToken) return
    const expSec = decodeJwtExpSeconds(accessToken)
    if (!expSec) return
    const nowMs = Date.now()
    const expMs = expSec * 1000
    const delayMs = Math.max(MIN_REFRESH_DELAY_MS, expMs - nowMs - REFRESH_LEAD_SECONDS * 1000)
    // If the token is already past exp, fire immediately.
    if (expMs <= nowMs) {
      void callRefresh()
      return
    }
    const handle = window.setTimeout(() => {
      void callRefresh()
    }, delayMs)
    return () => window.clearTimeout(handle)
  }, [accessToken])
}

/**
 * Cross-tab logout sync: when localStorage clears the auth slice in another tab
 * (logout in tab A → tab B should also drop in-memory state), reflect it locally.
 */
export function useCrossTabAuthSync() {
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== 'beatlume-auth') return
      // Re-read from localStorage. If it now lacks a token, drop our in-memory copy.
      try {
        const raw = e.newValue ? JSON.parse(e.newValue) : null
        const newToken: string | null = raw?.state?.accessToken ?? null
        const currentToken = useStore.getState().accessToken
        if (!newToken && currentToken) {
          useStore.getState().clearAuth()
        }
      } catch {
        // Malformed storage — ignore; the user's session in this tab is unchanged.
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])
}
