# BeatLume Frontend-Backend Integration Design Spec

## Goal

Wire the existing React frontend to the FastAPI backend, replacing all mock data with real API calls. The frontend transitions from a Zustand-only mock app to a TanStack Query + Zustand hybrid where server data lives in the query cache and UI state stays in Zustand.

## Tech Stack Additions (Frontend)

- **TanStack Query** — server state management (caching, refetching, optimistic updates, loading/error states)
- **Bare `fetch` wrapper** — typed API client with auth interceptor and token refresh

No new backend changes — the backend is complete from Plans 1-7.

## Architecture

### Before

```
Route → Component → useStore() → mock data (in-memory, lost on refresh)
```

### After

```
Route → Component → useQuery()/useMutation() → API client → Backend → PostgreSQL
                  → useStore() (UI-only: selections, modes, local toggles)
```

### State Ownership

| Category | Owned by | Examples |
|----------|----------|---------|
| Server data | TanStack Query cache | stories, scenes, characters, graph, insights, drafts, manuscript, core config, analytics, collaboration |
| Auth state | Zustand (persisted to localStorage) | accessToken, currentUser |
| UI state | Zustand (ephemeral) | selectedNodeId, activeSceneN, activeCoreIndex, editMode, setupCharacters |

---

## 1. API Client

### `frontend/src/api/client.ts`

A thin fetch wrapper that:
1. Prepends base URL (`http://localhost:8000`)
2. Attaches `Authorization: Bearer {token}` from Zustand auth store
3. On 401: attempts token refresh via `POST /auth/refresh`, retries the original request once
4. Throws typed errors for UI consumption
5. Handles JSON serialization/deserialization

```typescript
// Usage:
const stories = await api.get<PaginatedResponse<Story>>('/api/stories')
const scene = await api.post<Scene>(`/api/stories/${id}/scenes`, { title: 'New' })
await api.put<Scene>(`/api/stories/${id}/scenes/${sceneId}`, { tension: 8 })
await api.delete(`/api/stories/${id}/scenes/${sceneId}`)
```

Methods: `get<T>(path)`, `post<T>(path, body)`, `put<T>(path, body)`, `delete(path)`

### Per-Domain API Modules

Each domain gets its own module exporting typed functions and TanStack Query hooks:

| File | Functions | Query Hooks |
|------|-----------|-------------|
| `api/auth.ts` | `login`, `signup`, `refresh`, `logout`, `forgotPassword` | — (mutations only) |
| `api/stories.ts` | `fetchStories`, `fetchStory`, `createStory`, `updateStory`, `deleteStory` | `useStories()`, `useStory(id)`, `useCreateStory()`, `useUpdateStory(id)`, `useDeleteStory(id)` |
| `api/scenes.ts` | `fetchScenes`, `fetchScene`, `createScene`, `updateScene`, `deleteScene` | `useScenes(storyId)`, `useScene(storyId, id)`, `useCreateScene(storyId)`, `useUpdateScene(storyId)`, `useDeleteScene(storyId)` |
| `api/characters.ts` | `fetchCharacters`, `createCharacter`, `updateCharacter`, `deleteCharacter` | `useCharacters(storyId)`, `useCreateCharacter(storyId)`, `useUpdateCharacter(storyId)`, `useDeleteCharacter(storyId)` |
| `api/graph.ts` | `fetchGraph`, `updateNode`, `createEdge`, `updateEdge`, `deleteEdge` | `useGraph(storyId)`, `useUpdateNode(storyId)`, `useCreateEdge(storyId)` |
| `api/insights.ts` | `fetchInsights`, `dismissInsight`, `triggerInsightGeneration` | `useInsights(storyId)`, `useDismissInsight(storyId)` |
| `api/draft.ts` | `fetchDraft`, `updateDraft`, `triggerAIContinue` | `useDraft(storyId, sceneId)`, `useUpdateDraft(storyId)` |
| `api/core.ts` | `fetchTree`, `updateTreeNode`, `fetchSettings`, `updateSetting` | `useCoreTree(storyId)`, `useCoreSettings(storyId)` |
| `api/manuscript.ts` | `fetchChapters`, `fetchChapter`, `updateChapter` | `useChapters(storyId)`, `useChapter(storyId, num)` |
| `api/collaboration.ts` | `fetchCollaborators`, `fetchComments`, `createComment`, `fetchActivity` | `useCollaborators(storyId)`, `useComments(storyId)`, `useActivity(storyId)` |
| `api/analytics.ts` | `fetchTensionCurve`, `fetchPacing`, `fetchPresence`, `fetchArcs`, `fetchHealth`, `fetchSparkline` | `useTensionCurve(storyId)`, `usePacing(storyId)`, `usePresence(storyId)`, `useArcs(storyId)`, `useHealth(storyId)`, `useSparkline(storyId)` |
| `api/ai.ts` | `triggerInsights`, `triggerProseContinue`, `triggerRelationships`, `triggerSummarize`, `triggerScaffold` | mutation hooks only |
| `api/export.ts` | `triggerExport`, `fetchExportStatus` | `useExportStatus(storyId, jobId)` |

### Query Key Convention

```typescript
['stories']                                    // list all stories
['stories', storyId]                           // single story
['stories', storyId, 'scenes']                 // scenes list
['stories', storyId, 'scenes', sceneId]        // single scene
['stories', storyId, 'characters']             // characters list
['stories', storyId, 'graph']                  // graph nodes + edges
['stories', storyId, 'insights']               // insights list
['stories', storyId, 'draft', sceneId]         // draft content
['stories', storyId, 'core', 'tree']           // core config tree
['stories', storyId, 'core', 'settings']       // core settings
['stories', storyId, 'manuscript']             // chapters list
['stories', storyId, 'analytics', metric]      // analytics by metric
['stories', storyId, 'collaborators']          // collaborators
['stories', storyId, 'comments']               // comments
['stories', storyId, 'activity']               // activity feed
['user', 'me']                                 // current user
['user', 'orgs']                               // user's orgs
```

### Cross-Domain Cache Invalidation

| Action | Invalidate |
|--------|-----------|
| Add/update/delete scene | `scenes`, `analytics/tension-curve`, `analytics/health`, `analytics/pacing` |
| Add/update/delete character | `characters`, `analytics/presence`, `analytics/arcs`, `analytics/health` |
| Update/create/delete edge | `graph`, `analytics/health` |
| Dismiss insight | `insights`, `analytics/health` |
| Update draft | `draft/{sceneId}`, `analytics/health` |
| AI insight generation complete | `insights`, `analytics/health` |
| AI prose continuation complete | `draft/{sceneId}` |
| AI relationship inference complete | `graph` |

### Optimistic Updates

For interactive features where latency matters:
- **Tension bar click** (scene detail) — optimistically update scene tension in cache, POST in background
- **Draft text editing** — debounced PUT (500ms), no optimistic update needed (user sees their own typing)
- **Node position drag** (graph) — optimistically update position, PUT on drag end

Pattern: `onMutate` snapshots previous data, `onError` rolls back, `onSettled` invalidates.

---

## 2. Auth Flow

### Signup

1. Frontend POSTs `POST /auth/signup` with `{name, email, password}`
2. Backend creates user + org, returns `{access_token, token_type}` + sets `refresh_token` httpOnly cookie
3. Frontend stores `access_token` in Zustand auth slice (persisted to localStorage)
4. Frontend fetches `GET /api/users/me` → stores `currentUser` in Zustand
5. Navigate to `/welcome`

### Login

1. Frontend POSTs `POST /auth/login` with `{email, password}`
2. Same token + user fetch flow
3. Navigate to `/dashboard`

### Token Refresh

1. API client catches 401 on any request
2. POSTs `POST /auth/refresh` (httpOnly cookie sends automatically)
3. Gets new `access_token`, updates Zustand
4. Retries original request with new token

### Logout

1. POSTs `POST /auth/logout` (server clears cookie)
2. Clears `accessToken` + `currentUser` from Zustand (and localStorage)
3. Clears TanStack Query cache
4. Navigate to `/login`

### Route Guard

`__root.tsx` checks `accessToken` from Zustand:
- `null` + non-public route → redirect to `/login`
- Present + public route (login/signup) → redirect to `/dashboard`

---

## 3. Route Restructuring

### New Route File Layout

Story-level routes move under `stories.$storyId` prefix:

```
frontend/src/routes/
├── __root.tsx                              # Auth guard
├── login.tsx                               # /login
├── signup.tsx                              # /signup
├── forgot-password.tsx                     # /forgot-password
├── welcome.tsx                             # /welcome
├── dashboard.tsx                           # /dashboard
├── setup.tsx                               # /setup
├── settings.tsx                            # /settings
├── pricing.tsx                             # /pricing
├── templates.tsx                           # /templates
├── stories.$storyId.tsx                    # Story layout (Sidebar + Outlet)
├── stories.$storyId.index.tsx              # Overview
├── stories.$storyId.scenes.tsx             # Scene Board
├── stories.$storyId.scenes.$id.tsx         # Scene Detail
├── stories.$storyId.graph.tsx              # Graph View
├── stories.$storyId.timeline.tsx           # Timeline
├── stories.$storyId.characters.tsx         # Characters List
├── stories.$storyId.characters.$id.tsx     # Character Detail
├── stories.$storyId.draft.tsx              # Draft Editor
├── stories.$storyId.draft.$sceneId.tsx     # Draft for specific scene
├── stories.$storyId.core.tsx               # Narrative Core
├── stories.$storyId.manuscript.tsx         # Manuscript
├── stories.$storyId.ai.tsx                 # AI Insights
├── stories.$storyId.flagship.tsx           # Flagship View
├── stories.$storyId.export.tsx             # Export
└── stories.$storyId.collaboration.tsx      # Collaboration
```

### Story Layout (`stories.$storyId.tsx`)

Layout wrapper that:
1. Extracts `storyId` from `Route.useParams()`
2. Fetches story via `useStory(storyId)` to validate existence
3. Connects SSE via `useSSE(storyId)`
4. Renders `AppShell` + `Sidebar` (with `storyId` for scoped links) + `<Outlet />`
5. Shows `<LoadingState />` while fetching, `<ErrorState />` on 404

### Sidebar Update

Sidebar receives `storyId: string` prop. All nav links become scoped:

```typescript
// Before: { label: 'Scene Board', to: '/scenes' }
// After:  { label: 'Scene Board', to: `/stories/${storyId}/scenes` }
```

Dashboard link stays absolute: `to="/dashboard"`.

### Dashboard Story Cards

Replace hardcoded `mockStories` array with `useStories()` query:
- Each card links to `/stories/${story.id}`
- "New Story" button navigates to `/setup`
- Filter/sort controls work on the query data

---

## 4. SSE Integration

### `hooks/useSSE.ts`

A React hook used in the story layout:

```typescript
function useSSE(storyId: string) {
  // EventSource doesn't support Authorization headers.
  // Pass token as query param: /api/stories/{storyId}/events?token={accessToken}
  // Backend SSE endpoint must accept ?token= as alternative to Bearer header.
  // Opens connection on mount, closes on unmount.
  // Listens for typed events, invalidates TanStack Query cache accordingly.
  // Auto-reconnects on disconnect with exponential backoff.
}
```

**Backend SSE change required:** The `app/api/sse.py` endpoint needs a `token: str | None = Query(None)` parameter. If present, validate it instead of reading the `Authorization` header. This is a small backend modification needed for SSE auth since `EventSource` cannot set custom headers.

Event handling:

| SSE Event | Action |
|-----------|--------|
| `ai.progress` | Update AI progress toast/banner. For prose: append chunk to streaming buffer. |
| `ai.complete` | Dismiss progress toast. Invalidate relevant query cache. |
| `ai.error` | Show error toast. |
| `export.progress` | Update export progress indicator. |
| `export.complete` | Trigger download via presigned URL. |
| `activity` | Invalidate `activity` query cache. |
| `comment` | Invalidate `comments` query cache. |

### AI Progress UI

A `<AIProgressToast />` component in the story layout. Shows when any AI task is running:
- Task type label ("Generating insights...", "Continuing prose...")
- Progress indicator if available
- Dismisses on `ai.complete` or `ai.error`

### Prose Streaming

For `ai.progress` events with `type: "prose_continuation"`:
- Chunks accumulate in a React ref/state
- Draft view reads the streaming buffer and appends to the displayed prose
- On `ai.complete`, the draft query cache is invalidated to fetch the full persisted text

---

## 5. Type Alignment

### Updated `frontend/src/types.ts`

All types add UUID `id` fields and `story_id` where applicable:

```typescript
// Core types aligned with backend schemas
interface Story {
  id: string          // UUID
  title: string
  genres: string[]
  target_words: number
  draft_number: number
  status: 'not_started' | 'in_progress' | 'completed'
  structure_type: string
}

interface Scene {
  id: string          // UUID (NEW — was identified by n only)
  story_id: string    // UUID (NEW)
  n: number           // kept for display/ordering
  title: string
  pov: string
  tension: number
  act: number
  location: string
  tag: string
  summary?: string
}

interface Character {
  id: string          // UUID (NEW — was identified by name only)
  story_id: string    // UUID (NEW)
  name: string
  role: string
  desire: string
  flaw: string
  scene_count: number
  longest_gap: number
}

interface SceneNode {
  id: string          // UUID (was semantic string like "iris")
  character_id: string // UUID (NEW)
  x: number
  y: number
  label: string
  initials: string
  node_type?: 'hub' | 'minor'
  first_appearance_scene: number  // NEW
}

interface GraphEdge {
  id: string               // UUID (NEW)
  source_node_id: string   // UUID (was "a")
  target_node_id: string   // UUID (was "b")
  kind: EdgeKind
  weight: number
  provenance: 'author' | 'ai_accepted' | 'ai_pending' | 'scaffold'  // NEW
  evidence: Array<{scene_n: number, type: string}>                   // NEW
  first_evidenced_scene: number                                      // NEW
}

interface Insight {
  id: string          // UUID (NEW)
  severity: 'red' | 'amber' | 'blue'
  category: string
  title: string
  body: string
  refs: string[]
  dismissed: boolean  // NEW
}

interface DraftContent {
  id: string          // UUID (NEW)
  scene_id: string    // UUID (NEW)
  content: string
  word_count: number
}

interface ManuscriptChapter {
  id: string          // UUID (NEW)
  story_id: string    // UUID (NEW)
  num: number
  title: string
  content: string
  sort_order: number  // NEW
}

interface CoreConfigNode {
  id: string          // UUID (NEW)
  story_id: string    // UUID (NEW)
  depth: number
  label: string
  kind: 'story' | 'part' | 'chap' | 'scene' | 'beat'
  active: boolean
  sort_order: number  // NEW
}

interface CoreSetting {
  id: string          // UUID (NEW)
  story_id: string    // UUID (NEW)
  key: string
  value: string
  source: string
  tag?: string
}

interface UserProfile {
  id: string          // UUID (NEW)
  email: string
  name: string
  avatar_url?: string // NEW
  plan: 'free' | 'pro' | 'team'
}

// New types
interface PaginatedResponse<T> {
  items: T[]
  total: number
}

interface Collaborator {
  id: string
  user_id: string
  role: 'author' | 'editor' | 'reader'
  invited_at: string
  accepted_at?: string
}

interface Comment {
  id: string
  user_id: string
  scene_id?: string
  body: string
  created_at: string
}

interface ActivityEvent {
  id: string
  user_id: string
  action: string
  detail: Record<string, unknown>
  created_at: string
}

interface ExportJob {
  id: string
  format: 'pdf' | 'docx' | 'epub' | 'plaintext'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  file_key?: string
  error?: string
  created_at: string
  completed_at?: string
}
```

### GraphRenderer Prop Updates

`GraphRenderer` currently expects `SceneNode[]` with `id` as semantic strings and `GraphEdge[]` with `a`/`b` fields. After type changes:
- Node `id` becomes UUID
- Edge fields change from `a`/`b` to `source_node_id`/`target_node_id`
- Internal rendering logic updates to use new field names

---

## 6. Zustand Store Slimdown

### New Store Shape

```typescript
interface AuthSlice {
  accessToken: string | null
  currentUser: UserProfile | null
  setAuth: (token: string, user: UserProfile) => void
  clearAuth: () => void
}

interface UISlice {
  selectedNodeId: string | null
  selectNode: (id: string | null) => void
  activeSceneN: number
  setActiveSceneN: (n: number) => void
  activeCoreIndex: number
  setActiveCoreIndex: (i: number) => void
  editMode: boolean
  toggleEditMode: () => void
}

interface SetupSlice {
  setupCharacters: SetupCharacter[]
  addSetupCharacter: () => void
  updateSetupCharacter: (index: number, patch: Partial<SetupCharacter>) => void
  removeSetupCharacter: (index: number) => void
}

type AppState = AuthSlice & UISlice & SetupSlice
```

Auth slice uses `zustand/middleware` `persist` with `localStorage`.

**Removed from store** (now in TanStack Query cache): scenes, characters, nodes, edges, insights, draftContent, coreTree, coreSettings, chapters, and all their actions (addScene, updateScene, deleteScene, addCharacter, etc.).

---

## 7. Shared UI Components

### `<LoadingState />`

Blueprint-styled skeleton placeholder. Uses the same `var(--paper-2)` background with subtle shimmer animation. One component used across all views.

### `<ErrorState error={error} />`

Blueprint-styled error display with:
- Error message
- "Retry" button that calls `queryClient.invalidateQueries()`
- "Go Back" link

### `<AIProgressToast />`

Fixed-position toast in bottom-right. Shows during AI task execution:
- Task type label
- Animated progress indicator
- Auto-dismisses on completion
- Error state with "Dismiss" button

---

## 8. Backend Seed Script

### `backend/app/seeds/sample_story.py`

A one-time script that seeds "A Stranger in the Orchard" into the database from the existing mock data:

1. Creates default user ("Elena Marsh", `elena@beatlume.io`, password: `beatlume123`)
2. Creates personal organization
3. Creates story with all metadata
4. Inserts 13 scenes, 10 characters, 9 graph nodes, 12 edges
5. Inserts 5 insights, draft content for 8 scenes
6. Inserts core config tree (13 nodes) and settings (14 items)
7. Inserts manuscript chapters

Run: `cd backend && PYTHONPATH=. uv run python -m app.seeds.sample_story`

This gives new users a demo story to explore immediately after the backend starts.

---

## 9. Implementation Order

Each phase produces a working app:

| Phase | Scope | Key Files |
|-------|-------|-----------|
| 1 | API client + auth flow | `api/client.ts`, `api/auth.ts`, `hooks/useAuth.ts`, update `store.ts`, update `login.tsx`, `signup.tsx`, `__root.tsx` |
| 2 | TanStack Query setup + route restructuring | Install `@tanstack/react-query`, create `stories.$storyId.tsx` layout, move all story routes, update Sidebar |
| 3 | Dashboard + Stories wiring | `api/stories.ts`, update `dashboard.tsx` to use `useStories()` |
| 4 | Scenes + Characters wiring | `api/scenes.ts`, `api/characters.ts`, update scene board, character list, scene detail, character detail |
| 5 | Graph + Insights + Draft wiring | `api/graph.ts`, `api/insights.ts`, `api/draft.ts`, update graph view, AI page, draft editor |
| 6 | Core + Manuscript + Collaboration wiring | `api/core.ts`, `api/manuscript.ts`, `api/collaboration.ts`, update remaining views |
| 7 | Analytics wiring | `api/analytics.ts`, update timeline, overview stats, dashboard sparklines |
| 8 | SSE + AI features | `hooks/useSSE.ts`, `api/ai.ts`, `<AIProgressToast />`, wire AI buttons |
| 9 | Export wiring | `api/export.ts`, update export page |
| 10 | Type cleanup + seed script + remove mock imports | Update `types.ts`, create seed script, remove `src/data/` imports from components |
| 11 | Loading/error states + polish | `<LoadingState />`, `<ErrorState />`, error boundaries |

---

## 10. What Stays Unchanged

- All component styling (blueprint aesthetic, CSS custom properties, tokens)
- Component structure and layout (AppShell, ChromeTop, CmdInput)
- Chart/visualization components (TensionCurve, GraphRenderer, TensionBar, PresenceStrip, TimeScrubber)
- Primitive components (Tag, Btn, Label, Panel, Placeholder, Anno, Sticky)
- Setup wizard UI flow (just wire "Create Story" to API)
- Settings, pricing, templates pages (remain mock/static for now)
- `main.tsx` root render (just add QueryClientProvider)
