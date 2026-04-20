# BeatLume Integration Plan A: API Client + Auth + Route Restructuring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the React frontend to the FastAPI backend with real JWT auth, install TanStack Query, restructure routes under `/stories/$storyId/`, slim the Zustand store to UI-only state, and update the Sidebar and Dashboard to use the new routing.

**Architecture:** TanStack Query manages server data (replaces Zustand for API data). Zustand keeps auth (persisted to localStorage) and UI state (ephemeral). A thin fetch wrapper handles auth token injection and refresh. Routes restructure from flat (`/scenes`) to story-scoped (`/stories/$storyId/scenes`).

**Tech Stack:** TanStack Query v5, zustand/middleware persist, fetch API, TanStack Router file-based routing

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `frontend/src/api/client.ts` | Fetch wrapper with auth interceptor + token refresh |
| `frontend/src/api/auth.ts` | Login, signup, refresh, logout API functions |
| `frontend/src/api/stories.ts` | Stories CRUD + TanStack Query hooks |
| `frontend/src/api/scenes.ts` | Scenes CRUD + TanStack Query hooks |
| `frontend/src/api/characters.ts` | Characters CRUD + TanStack Query hooks |
| `frontend/src/api/graph.ts` | Graph nodes/edges + TanStack Query hooks |
| `frontend/src/api/insights.ts` | Insights list/dismiss + TanStack Query hooks |
| `frontend/src/api/draft.ts` | Draft content + TanStack Query hooks |
| `frontend/src/api/core.ts` | Core tree/settings + TanStack Query hooks |
| `frontend/src/api/manuscript.ts` | Chapters + TanStack Query hooks |
| `frontend/src/api/collaboration.ts` | Collaborators, comments, activity + TanStack Query hooks |
| `frontend/src/api/analytics.ts` | Analytics + TanStack Query hooks |
| `frontend/src/components/LoadingState.tsx` | Shared loading skeleton |
| `frontend/src/components/ErrorState.tsx` | Shared error display with retry |
| `frontend/src/routes/stories.$storyId.tsx` | Story layout (Sidebar + Outlet) |
| `frontend/src/routes/stories.$storyId.index.tsx` | Overview (moved from index.tsx) |
| `frontend/src/routes/stories.$storyId.scenes.tsx` | Scene Board |
| `frontend/src/routes/stories.$storyId.scenes.$id.tsx` | Scene Detail |
| `frontend/src/routes/stories.$storyId.graph.tsx` | Graph View |
| `frontend/src/routes/stories.$storyId.timeline.tsx` | Timeline |
| `frontend/src/routes/stories.$storyId.characters.tsx` | Characters |
| `frontend/src/routes/stories.$storyId.characters.$id.tsx` | Character Detail |
| `frontend/src/routes/stories.$storyId.draft.tsx` | Draft |
| `frontend/src/routes/stories.$storyId.draft.$sceneId.tsx` | Draft scene-specific |
| `frontend/src/routes/stories.$storyId.core.tsx` | Narrative Core |
| `frontend/src/routes/stories.$storyId.manuscript.tsx` | Manuscript |
| `frontend/src/routes/stories.$storyId.ai.tsx` | AI Insights |
| `frontend/src/routes/stories.$storyId.flagship.tsx` | Flagship |
| `frontend/src/routes/stories.$storyId.export.tsx` | Export |
| `frontend/src/routes/stories.$storyId.collaboration.tsx` | Collaboration |

### Modified Files

| File | Changes |
|------|---------|
| `frontend/package.json` | Add `@tanstack/react-query` |
| `frontend/src/main.tsx` | Wrap in `QueryClientProvider` |
| `frontend/src/types.ts` | Add UUID `id` fields, new types (Story, PaginatedResponse, etc.) |
| `frontend/src/store.ts` | Slim to auth + UI state only |
| `frontend/src/routes/__root.tsx` | Auth guard uses `accessToken` instead of `isLoggedIn` |
| `frontend/src/routes/login.tsx` | Call real API, store JWT |
| `frontend/src/routes/signup.tsx` | Call real API, store JWT |
| `frontend/src/routes/dashboard.tsx` | Fetch stories from API via `useStories()` |
| `frontend/src/components/chrome/Sidebar.tsx` | Accept `storyId`, generate scoped links |

### Deleted Files

| File | Reason |
|------|--------|
| `frontend/src/routes/index.tsx` | Moved to `stories.$storyId.index.tsx` |
| `frontend/src/routes/scenes.tsx` | Moved to `stories.$storyId.scenes.tsx` |
| `frontend/src/routes/scenes.$id.tsx` | Moved to `stories.$storyId.scenes.$id.tsx` |
| `frontend/src/routes/graph.tsx` | Moved to `stories.$storyId.graph.tsx` |
| `frontend/src/routes/timeline.tsx` | Moved to `stories.$storyId.timeline.tsx` |
| `frontend/src/routes/characters.tsx` | Moved to `stories.$storyId.characters.tsx` |
| `frontend/src/routes/characters.$name.tsx` | Moved to `stories.$storyId.characters.$id.tsx` |
| `frontend/src/routes/draft.tsx` | Moved to `stories.$storyId.draft.tsx` |
| `frontend/src/routes/draft.$sceneId.tsx` | Moved to `stories.$storyId.draft.$sceneId.tsx` |
| `frontend/src/routes/core.tsx` | Moved to `stories.$storyId.core.tsx` |
| `frontend/src/routes/manuscript.tsx` | Moved to `stories.$storyId.manuscript.tsx` |
| `frontend/src/routes/ai.tsx` | Moved to `stories.$storyId.ai.tsx` |
| `frontend/src/routes/flagship.tsx` | Moved to `stories.$storyId.flagship.tsx` |
| `frontend/src/routes/export.tsx` | Moved to `stories.$storyId.export.tsx` |
| `frontend/src/routes/collaboration.tsx` | Moved to `stories.$storyId.collaboration.tsx` |

---

### Task 1: Install TanStack Query + Update Types

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Install TanStack Query**

```bash
cd /home/abdussamadbello/beatlume/frontend
npm install @tanstack/react-query
```

- [ ] **Step 2: Update types.ts with UUID IDs and new types**

Replace `frontend/src/types.ts` entirely:

```typescript
// --- Story ---
export interface Story {
  id: string
  title: string
  genres: string[]
  target_words: number
  draft_number: number
  status: 'not_started' | 'in_progress' | 'completed'
  structure_type: string
}

// --- Scene ---
export interface Scene {
  id: string
  story_id: string
  n: number
  title: string
  pov: string
  tension: number
  act: number
  location: string
  tag: string
  summary?: string
}

// --- Character ---
export interface Character {
  id: string
  story_id: string
  name: string
  role: string
  desire: string
  flaw: string
  scene_count: number
  longest_gap: number
}

// --- Graph ---
export interface SceneNode {
  id: string
  character_id: string
  x: number
  y: number
  label: string
  initials: string
  node_type?: 'hub' | 'minor'
  first_appearance_scene: number
}

export interface GraphEdge {
  id: string
  source_node_id: string
  target_node_id: string
  kind: EdgeKind
  weight: number
  provenance: 'author' | 'ai_accepted' | 'ai_pending' | 'scaffold'
  evidence: Array<{ scene_n: number; type: string }>
  first_evidenced_scene: number
}

export type EdgeKind = 'conflict' | 'alliance' | 'romance' | 'mentor' | 'secret' | 'family'

// --- Insight ---
export interface Insight {
  id: string
  severity: 'red' | 'amber' | 'blue'
  category: string
  title: string
  body: string
  refs: string[]
  dismissed: boolean
}

// --- Draft ---
export interface DraftContent {
  id: string
  scene_id: string
  content: string
  word_count: number
}

// --- Core ---
export interface CoreConfigNode {
  id: string
  depth: number
  label: string
  kind: 'story' | 'part' | 'chap' | 'scene' | 'beat'
  active: boolean
  sort_order: number
}

export interface CoreSetting {
  id: string
  key: string
  value: string
  source: string
  tag?: string
}

// --- Manuscript ---
export interface ManuscriptChapter {
  id: string
  num: number
  title: string
  content: string
  sort_order: number
}

// --- Collaboration ---
export interface Collaborator {
  id: string
  user_id: string
  role: 'author' | 'editor' | 'reader'
  invited_at: string
  accepted_at?: string
}

export interface Comment {
  id: string
  user_id: string
  scene_id?: string
  body: string
  created_at: string
}

export interface ActivityEvent {
  id: string
  user_id: string
  action: string
  detail: Record<string, unknown>
  created_at: string
}

// --- Export ---
export interface ExportJob {
  id: string
  format: 'pdf' | 'docx' | 'epub' | 'plaintext'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  file_key?: string
  error?: string
  created_at: string
  completed_at?: string
}

// --- User ---
export interface UserProfile {
  id: string
  email: string
  name: string
  avatar_url?: string
  plan: 'free' | 'pro' | 'team'
}

// --- Misc ---
export interface Act { at: number; label: string }
export interface Peak { at: number; v: number; label: string }
export interface SetupCharacter { name: string; role: string; description: string }
export type TagVariant = 'blue' | 'amber' | 'red' | 'solid'
export type BtnVariant = 'solid' | 'ghost'

// --- API Response ---
export interface PaginatedResponse<T> {
  items: T[]
  total: number
}
```

- [ ] **Step 3: Wrap app in QueryClientProvider**

Update `frontend/src/main.tsx`:

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import './styles/global.css'

const router = createRouter({ routeTree })
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
)
```

- [ ] **Step 4: Verify build**

```bash
cd /home/abdussamadbello/beatlume/frontend
npx tsc --noEmit 2>&1 | head -20
```

Note: There will be type errors because existing code references old type shapes. That's expected — we'll fix them in subsequent tasks.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/types.ts frontend/src/main.tsx
git commit -m "feat: install TanStack Query, update types with UUIDs, add QueryClientProvider"
```

---

### Task 2: API Client + Auth API

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/auth.ts`

- [ ] **Step 1: Create API client**

Create `frontend/src/api/client.ts`:

```typescript
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
```

- [ ] **Step 2: Create auth API module**

Create `frontend/src/api/auth.ts`:

```typescript
import { api } from './client'
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
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/
git commit -m "feat: add API client with auth interceptor and auth API module"
```

---

### Task 3: Slim Zustand Store

**Files:**
- Modify: `frontend/src/store.ts`

- [ ] **Step 1: Replace store with auth + UI state only**

Replace `frontend/src/store.ts` entirely:

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SetupCharacter, UserProfile } from './types'

interface AppState {
  // Auth (persisted to localStorage)
  accessToken: string | null
  currentUser: UserProfile | null
  setAuth: (token: string, user: UserProfile) => void
  clearAuth: () => void

  // UI selections (ephemeral)
  selectedNodeId: string | null
  selectNode: (id: string | null) => void
  activeSceneN: number
  setActiveSceneN: (n: number) => void
  activeCoreIndex: number
  setActiveCoreIndex: (i: number) => void
  editMode: boolean
  toggleEditMode: () => void

  // Setup wizard (ephemeral)
  setupCharacters: SetupCharacter[]
  addSetupCharacter: () => void
  updateSetupCharacter: (index: number, patch: Partial<SetupCharacter>) => void
  removeSetupCharacter: (index: number) => void
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Auth
      accessToken: null,
      currentUser: null,
      setAuth: (token, user) => set({ accessToken: token, currentUser: user }),
      clearAuth: () => set({ accessToken: null, currentUser: null }),

      // UI
      selectedNodeId: null,
      selectNode: (id) => set({ selectedNodeId: id }),
      activeSceneN: 1,
      setActiveSceneN: (n) => set({ activeSceneN: n }),
      activeCoreIndex: 0,
      setActiveCoreIndex: (i) => set({ activeCoreIndex: i }),
      editMode: false,
      toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),

      // Setup
      setupCharacters: [
        { name: '', role: 'Protagonist', description: '' },
      ],
      addSetupCharacter: () => set((s) => ({
        setupCharacters: [...s.setupCharacters, { name: '', role: 'Protagonist', description: '' }],
      })),
      updateSetupCharacter: (index, patch) => set((s) => ({
        setupCharacters: s.setupCharacters.map((c, i) => i === index ? { ...c, ...patch } : c),
      })),
      removeSetupCharacter: (index) => set((s) => ({
        setupCharacters: s.setupCharacters.filter((_, i) => i !== index),
      })),
    }),
    {
      name: 'beatlume-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        currentUser: state.currentUser,
      }),
    },
  ),
)
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/store.ts
git commit -m "feat: slim Zustand store to auth + UI state, remove server data"
```

---

### Task 4: Update Auth Guard + Login + Signup Pages

**Files:**
- Modify: `frontend/src/routes/__root.tsx`
- Modify: `frontend/src/routes/login.tsx`
- Modify: `frontend/src/routes/signup.tsx`

- [ ] **Step 1: Update root auth guard**

Replace `frontend/src/routes/__root.tsx`:

```typescript
import { createRootRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useStore } from '../store'
import { useEffect } from 'react'

function RootComponent() {
  const accessToken = useStore(s => s.accessToken)
  const navigate = useNavigate()

  useEffect(() => {
    const publicRoutes = ['/login', '/signup', '/forgot-password', '/welcome']
    const currentPath = window.location.pathname

    if (!accessToken && !publicRoutes.includes(currentPath)) {
      navigate({ to: '/login' })
    } else if (accessToken && publicRoutes.includes(currentPath)) {
      navigate({ to: '/dashboard' })
    }
  }, [accessToken, navigate])

  return <Outlet />
}

export const Route = createRootRoute({
  component: RootComponent,
})
```

- [ ] **Step 2: Update login page**

Replace `frontend/src/routes/login.tsx` — keep all existing JSX/styling but change the submit handler:

Read the current file first, then update only the submit logic and imports. The key changes:
- Import `login` from `../api/auth` instead of `useStore`
- Add `const [error, setError] = useState('')` and `const [loading, setLoading] = useState(false)`
- Change `handleSubmit` to:
  ```typescript
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      navigate({ to: '/dashboard' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }
  ```
- Show `error` message in the UI below the form
- Disable submit button when `loading`

- [ ] **Step 3: Update signup page**

Same pattern as login — import `signup` from `../api/auth`, add loading/error state, async submit handler that calls `signup(name, email, password)` then navigates to `/welcome`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/__root.tsx frontend/src/routes/login.tsx frontend/src/routes/signup.tsx
git commit -m "feat: wire login/signup to real API, update auth guard to use JWT"
```

---

### Task 5: API Query Hooks for All Domains

**Files:**
- Create: `frontend/src/api/stories.ts`
- Create: `frontend/src/api/scenes.ts`
- Create: `frontend/src/api/characters.ts`
- Create: `frontend/src/api/graph.ts`
- Create: `frontend/src/api/insights.ts`
- Create: `frontend/src/api/draft.ts`
- Create: `frontend/src/api/core.ts`
- Create: `frontend/src/api/manuscript.ts`
- Create: `frontend/src/api/collaboration.ts`
- Create: `frontend/src/api/analytics.ts`

Each module exports typed fetch functions and TanStack Query hooks.

- [ ] **Step 1: Create stories API**

Create `frontend/src/api/stories.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Story, PaginatedResponse } from '../types'

export function useStories() {
  return useQuery({
    queryKey: ['stories'],
    queryFn: () => api.get<PaginatedResponse<Story>>('/api/stories'),
  })
}

export function useStory(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId],
    queryFn: () => api.get<Story>(`/api/stories/${storyId}`),
    enabled: !!storyId,
  })
}

export function useCreateStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; genres?: string[]; target_words?: number; structure_type?: string }) =>
      api.post<Story>('/api/stories', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories'] }),
  })
}

export function useUpdateStory(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Story>) => api.put<Story>(`/api/stories/${storyId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stories', storyId] })
      qc.invalidateQueries({ queryKey: ['stories'] })
    },
  })
}

export function useDeleteStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (storyId: string) => api.delete(`/api/stories/${storyId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories'] }),
  })
}
```

- [ ] **Step 2: Create scenes API**

Create `frontend/src/api/scenes.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Scene, PaginatedResponse } from '../types'

export function useScenes(storyId: string, params?: { act?: number; pov?: string; sort?: string }) {
  const searchParams = new URLSearchParams()
  if (params?.act) searchParams.set('act', String(params.act))
  if (params?.pov) searchParams.set('pov', params.pov)
  if (params?.sort) searchParams.set('sort', params.sort)
  const qs = searchParams.toString()
  return useQuery({
    queryKey: ['stories', storyId, 'scenes', params],
    queryFn: () => api.get<PaginatedResponse<Scene>>(`/api/stories/${storyId}/scenes${qs ? `?${qs}` : ''}`),
    enabled: !!storyId,
  })
}

export function useScene(storyId: string, sceneId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'scenes', sceneId],
    queryFn: () => api.get<Scene>(`/api/stories/${storyId}/scenes/${sceneId}`),
    enabled: !!storyId && !!sceneId,
  })
}

export function useCreateScene(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; pov?: string; tension?: number; act?: number; location?: string; tag?: string }) =>
      api.post<Scene>(`/api/stories/${storyId}/scenes`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'scenes'] }),
  })
}

export function useUpdateScene(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sceneId, ...data }: { sceneId: string } & Partial<Scene>) =>
      api.put<Scene>(`/api/stories/${storyId}/scenes/${sceneId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'scenes'] }),
  })
}

export function useDeleteScene(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sceneId: string) => api.delete(`/api/stories/${storyId}/scenes/${sceneId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'scenes'] }),
  })
}
```

- [ ] **Step 3: Create characters API**

Create `frontend/src/api/characters.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Character, PaginatedResponse } from '../types'

export function useCharacters(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'characters'],
    queryFn: () => api.get<PaginatedResponse<Character>>(`/api/stories/${storyId}/characters`),
    enabled: !!storyId,
  })
}

export function useCreateCharacter(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; role?: string; desire?: string; flaw?: string }) =>
      api.post<Character>(`/api/stories/${storyId}/characters`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'characters'] }),
  })
}

export function useUpdateCharacter(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ characterId, ...data }: { characterId: string } & Partial<Character>) =>
      api.put<Character>(`/api/stories/${storyId}/characters/${characterId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'characters'] }),
  })
}

export function useDeleteCharacter(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (characterId: string) => api.delete(`/api/stories/${storyId}/characters/${characterId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'characters'] }),
  })
}
```

- [ ] **Step 4: Create graph API**

Create `frontend/src/api/graph.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { SceneNode, GraphEdge } from '../types'

interface GraphResponse {
  nodes: SceneNode[]
  edges: GraphEdge[]
}

export function useGraph(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'graph'],
    queryFn: () => api.get<GraphResponse>(`/api/stories/${storyId}/graph`),
    enabled: !!storyId,
  })
}

export function useUpdateNode(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, ...data }: { nodeId: string; x?: number; y?: number }) =>
      api.put<SceneNode>(`/api/stories/${storyId}/graph/nodes/${nodeId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'graph'] }),
  })
}

export function useCreateEdge(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { source_node_id: string; target_node_id: string; kind: string; weight?: number }) =>
      api.post<GraphEdge>(`/api/stories/${storyId}/graph/edges`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'graph'] }),
  })
}

export function useDeleteEdge(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (edgeId: string) => api.delete(`/api/stories/${storyId}/graph/edges/${edgeId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'graph'] }),
  })
}
```

- [ ] **Step 5: Create insights API**

Create `frontend/src/api/insights.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Insight, PaginatedResponse } from '../types'

export function useInsights(storyId: string, params?: { category?: string; severity?: string }) {
  const searchParams = new URLSearchParams()
  if (params?.category) searchParams.set('category', params.category)
  if (params?.severity) searchParams.set('severity', params.severity)
  const qs = searchParams.toString()
  return useQuery({
    queryKey: ['stories', storyId, 'insights', params],
    queryFn: () => api.get<PaginatedResponse<Insight>>(`/api/stories/${storyId}/insights${qs ? `?${qs}` : ''}`),
    enabled: !!storyId,
  })
}

export function useDismissInsight(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (insightId: string) => api.put(`/api/stories/${storyId}/insights/${insightId}/dismiss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'insights'] }),
  })
}
```

- [ ] **Step 6: Create draft API**

Create `frontend/src/api/draft.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { DraftContent } from '../types'

export function useDraft(storyId: string, sceneId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'draft', sceneId],
    queryFn: () => api.get<DraftContent>(`/api/stories/${storyId}/draft/${sceneId}`),
    enabled: !!storyId && !!sceneId,
  })
}

export function useUpdateDraft(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sceneId, content }: { sceneId: string; content: string }) =>
      api.put<DraftContent>(`/api/stories/${storyId}/draft/${sceneId}`, { content }),
    onSuccess: (_, { sceneId }) => qc.invalidateQueries({ queryKey: ['stories', storyId, 'draft', sceneId] }),
  })
}
```

- [ ] **Step 7: Create core API**

Create `frontend/src/api/core.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { CoreConfigNode, CoreSetting } from '../types'

export function useCoreTree(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'core', 'tree'],
    queryFn: () => api.get<CoreConfigNode[]>(`/api/stories/${storyId}/core/tree`),
    enabled: !!storyId,
  })
}

export function useCoreSettings(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'core', 'settings'],
    queryFn: () => api.get<CoreSetting[]>(`/api/stories/${storyId}/core/settings`),
    enabled: !!storyId,
  })
}

export function useUpdateCoreSetting(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api.put<CoreSetting>(`/api/stories/${storyId}/core/settings/${key}`, { value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'core', 'settings'] }),
  })
}
```

- [ ] **Step 8: Create manuscript API**

Create `frontend/src/api/manuscript.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { ManuscriptChapter } from '../types'

export function useChapters(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'manuscript'],
    queryFn: () => api.get<ManuscriptChapter[]>(`/api/stories/${storyId}/manuscript`),
    enabled: !!storyId,
  })
}

export function useUpdateChapter(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ num, ...data }: { num: number; title?: string; content?: string }) =>
      api.put<ManuscriptChapter>(`/api/stories/${storyId}/manuscript/${num}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'manuscript'] }),
  })
}
```

- [ ] **Step 9: Create collaboration API**

Create `frontend/src/api/collaboration.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Collaborator, Comment, ActivityEvent } from '../types'

export function useCollaborators(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'collaborators'],
    queryFn: () => api.get<Collaborator[]>(`/api/stories/${storyId}/collaborators`),
    enabled: !!storyId,
  })
}

export function useComments(storyId: string, sceneId?: string) {
  const qs = sceneId ? `?scene_id=${sceneId}` : ''
  return useQuery({
    queryKey: ['stories', storyId, 'comments', sceneId],
    queryFn: () => api.get<Comment[]>(`/api/stories/${storyId}/comments${qs}`),
    enabled: !!storyId,
  })
}

export function useCreateComment(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { body: string; scene_id?: string }) =>
      api.post<Comment>(`/api/stories/${storyId}/comments`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stories', storyId, 'comments'] }),
  })
}

export function useActivity(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'activity'],
    queryFn: () => api.get<ActivityEvent[]>(`/api/stories/${storyId}/activity`),
    enabled: !!storyId,
  })
}
```

- [ ] **Step 10: Create analytics API**

Create `frontend/src/api/analytics.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { api } from './client'

export function useTensionCurve(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'analytics', 'tension-curve'],
    queryFn: () => api.get(`/api/stories/${storyId}/analytics/tension-curve`),
    enabled: !!storyId,
  })
}

export function usePacing(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'analytics', 'pacing'],
    queryFn: () => api.get(`/api/stories/${storyId}/analytics/pacing`),
    enabled: !!storyId,
  })
}

export function usePresence(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'analytics', 'presence'],
    queryFn: () => api.get(`/api/stories/${storyId}/analytics/presence`),
    enabled: !!storyId,
  })
}

export function useArcs(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'analytics', 'arcs'],
    queryFn: () => api.get(`/api/stories/${storyId}/analytics/arcs`),
    enabled: !!storyId,
  })
}

export function useHealth(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'analytics', 'health'],
    queryFn: () => api.get(`/api/stories/${storyId}/analytics/health`),
    enabled: !!storyId,
  })
}

export function useSparkline(storyId: string) {
  return useQuery({
    queryKey: ['stories', storyId, 'analytics', 'sparkline'],
    queryFn: () => api.get(`/api/stories/${storyId}/analytics/sparkline`),
    enabled: !!storyId,
  })
}
```

- [ ] **Step 11: Commit**

```bash
git add frontend/src/api/
git commit -m "feat: add TanStack Query hooks for all API domains"
```

---

### Task 6: Loading + Error Components

**Files:**
- Create: `frontend/src/components/LoadingState.tsx`
- Create: `frontend/src/components/ErrorState.tsx`

- [ ] **Step 1: Create LoadingState**

Create `frontend/src/components/LoadingState.tsx`:

```typescript
import type { CSSProperties } from 'react'

const container: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  minHeight: 200,
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--ink-3)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return <div style={container}>{label}</div>
}
```

- [ ] **Step 2: Create ErrorState**

Create `frontend/src/components/ErrorState.tsx`:

```typescript
import type { CSSProperties } from 'react'
import { Btn } from './primitives'

const container: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  minHeight: 200,
  gap: 12,
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--ink-2)',
}

const messageStyle: CSSProperties = {
  maxWidth: 400,
  textAlign: 'center',
  lineHeight: 1.5,
}

export function ErrorState({ error, onRetry }: { error: Error | null; onRetry?: () => void }) {
  return (
    <div style={container}>
      <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--red)' }}>
        Error
      </div>
      <div style={messageStyle}>
        {error?.message || 'Something went wrong'}
      </div>
      {onRetry && (
        <Btn variant="ghost" onClick={onRetry}>
          Retry
        </Btn>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/LoadingState.tsx frontend/src/components/ErrorState.tsx
git commit -m "feat: add LoadingState and ErrorState shared components"
```

---

### Task 7: Route Restructuring — Story Layout + Move Routes

**Files:**
- Create: `frontend/src/routes/stories.$storyId.tsx`
- Move: All 15 story-level route files to `stories.$storyId.*` naming
- Delete: Old flat route files
- Modify: `frontend/src/components/chrome/Sidebar.tsx`

- [ ] **Step 1: Create story layout**

Create `frontend/src/routes/stories.$storyId.tsx`:

```typescript
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AppShell, Sidebar } from '../components/chrome'
import { LoadingState } from '../components/LoadingState'
import { ErrorState } from '../components/ErrorState'
import { useStory } from '../api/stories'

export const Route = createFileRoute('/stories/$storyId')({
  component: StoryLayout,
})

function StoryLayout() {
  const { storyId } = Route.useParams()
  const { data: story, isLoading, error, refetch } = useStory(storyId)

  if (isLoading) {
    return (
      <AppShell sidebar={<Sidebar storyId={storyId} active="" title="Loading..." />}>
        <LoadingState />
      </AppShell>
    )
  }

  if (error || !story) {
    return (
      <AppShell sidebar={<Sidebar storyId={storyId} active="" title="Error" />}>
        <ErrorState error={error as Error} onRetry={refetch} />
      </AppShell>
    )
  }

  return (
    <AppShell sidebar={<Sidebar storyId={storyId} active="" title={story.title} />}>
      <Outlet />
    </AppShell>
  )
}
```

- [ ] **Step 2: Update Sidebar to accept storyId**

Modify `frontend/src/components/chrome/Sidebar.tsx`:

Change the props and nav items to use `storyId`:

```typescript
// Change the interface and items to use storyId:
interface SidebarProps {
  storyId: string
  active: string
  title?: string
}

// Nav items become functions of storyId:
function getNavItems(storyId: string) {
  return {
    planning: [
      { label: 'Overview', to: `/stories/${storyId}`, count: '' },
      { label: 'Scene Board', to: `/stories/${storyId}/scenes`, count: '' },
      { label: 'Graph', to: `/stories/${storyId}/graph` },
      { label: 'Timeline', to: `/stories/${storyId}/timeline` },
      { label: 'Characters', to: `/stories/${storyId}/characters`, count: '' },
      { label: 'Narrative Core', to: `/stories/${storyId}/core` },
    ],
    assistant: [
      { label: 'AI Insights', to: `/stories/${storyId}/ai`, count: '' },
      { label: 'Draft', to: `/stories/${storyId}/draft`, count: '' },
      { label: 'Manuscript', to: `/stories/${storyId}/manuscript`, count: '' },
    ],
    publish: [
      { label: 'Export', to: `/stories/${storyId}/export` },
      { label: 'Collaboration', to: `/stories/${storyId}/collaboration` },
    ],
  }
}

export function Sidebar({ storyId, active, title = 'Untitled Story' }: SidebarProps) {
  const items = getNavItems(storyId)
  // ... rest of render using items.planning, items.assistant, items.publish
}
```

- [ ] **Step 3: Move all story route files**

For each of the 15 story-level routes, create the new file under `stories.$storyId.*` naming. Each file:
1. Changes `createFileRoute('/<old-path>')` to `createFileRoute('/stories/$storyId/<path>')`
2. Removes `AppShell` and `Sidebar` wrapping (the layout handles it now)
3. Gets `storyId` from `Route.useParams()` instead of hardcoding
4. Replaces `useStore()` data selectors with API query hooks (or keeps `useStore()` for UI-only state)

The key pattern for each moved route:

```typescript
// Before (e.g., scenes.tsx):
export const Route = createFileRoute('/scenes')({ component: SceneBoard })
function SceneBoard() {
  const scenes = useStore(s => s.scenes)
  return <AppShell sidebar={<Sidebar active="/scenes" />}>...</AppShell>
}

// After (stories.$storyId.scenes.tsx):
export const Route = createFileRoute('/stories/$storyId/scenes')({ component: SceneBoard })
function SceneBoard() {
  const { storyId } = Route.useParams()
  const { data, isLoading } = useScenes(storyId)
  if (isLoading) return <LoadingState />
  const scenes = data?.items ?? []
  return <div>...</div>  // No AppShell wrapper — layout handles it
}
```

**IMPORTANT:** For this initial migration, views that reference complex mock data relationships (like graph, timeline, draft) can temporarily return a placeholder with `<LoadingState label="Coming soon — wiring in progress" />` if the data shape change is too complex for a single task. The priority is getting the routing structure correct.

The overview page (`stories.$storyId.index.tsx`) should work with basic story data + scene count from `useScenes`.

- [ ] **Step 4: Delete old flat route files**

Delete: `index.tsx`, `scenes.tsx`, `scenes.$id.tsx`, `graph.tsx`, `timeline.tsx`, `characters.tsx`, `characters.$name.tsx`, `draft.tsx`, `draft.$sceneId.tsx`, `core.tsx`, `manuscript.tsx`, `ai.tsx`, `flagship.tsx`, `export.tsx`, `collaboration.tsx`

- [ ] **Step 5: Regenerate route tree**

```bash
cd /home/abdussamadbello/beatlume/frontend
npx vite --force  # or just start dev server to trigger TanStack Router codegen
```

- [ ] **Step 6: Update dashboard story card links**

In `frontend/src/routes/dashboard.tsx`:
- Replace `useStore` data with `useStories()` query hook
- Change story card click handler: `navigate({ to: '/stories/$storyId', params: { storyId: story.id } })`
- Keep filter/sort as local `useState` operating on `data.items`

- [ ] **Step 7: Verify the app starts**

```bash
cd /home/abdussamadbello/beatlume/frontend
npm run dev
```

Navigate to `http://localhost:5173/login` → login → should redirect to `/dashboard` → clicking a story should navigate to `/stories/{id}`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/routes/ frontend/src/components/chrome/Sidebar.tsx
git commit -m "feat: restructure routes under stories/\$storyId, add story layout"
```

---

## Verification Checklist

1. `npm install` succeeds, TanStack Query installed
2. Types updated with UUID `id` fields on all models
3. `QueryClientProvider` wraps the app
4. Login page calls `POST /auth/login`, stores JWT, navigates to `/dashboard`
5. Signup page calls `POST /auth/signup`, stores JWT, navigates to `/welcome`
6. Auth guard checks `accessToken` (not `isLoggedIn` boolean)
7. Token refresh works on 401
8. Logout clears token + navigates to `/login`
9. Dashboard fetches stories from `GET /api/stories`
10. Story cards link to `/stories/{id}`
11. Story layout at `/stories/$storyId` renders Sidebar + Outlet
12. Sidebar generates story-scoped links (`/stories/{id}/scenes`, etc.)
13. All 15 story sub-routes exist under `stories.$storyId.*`
14. `LoadingState` and `ErrorState` components render correctly
15. All API hooks exist for: stories, scenes, characters, graph, insights, draft, core, manuscript, collaboration, analytics
16. Dev server starts without crashes
