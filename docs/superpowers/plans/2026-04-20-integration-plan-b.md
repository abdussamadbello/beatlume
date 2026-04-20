# BeatLume Integration Plan B: Full Data Wiring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire every story view to fetch real data from the backend API via TanStack Query hooks, replacing all remaining mock data imports and static data references.

**Architecture:** Each view uses the query hooks from `src/api/` created in Plan A. Loading states show `<LoadingState />`. Views that still import from `src/data/` get updated to use API hooks or inline fallbacks.

**Tech Stack:** TanStack Query hooks (already installed), existing API client

---

### Task 1: Wire Overview, Scenes, Characters views

**Files to modify:**
- `frontend/src/routes/stories.$storyId.index.tsx` — Overview: use `useScenes`, `useCharacters`, `useInsights` for stats. Replace `tensionData`/`sampleActs`/`samplePeaks` imports with `useTensionCurve` from analytics API. Show loading states.
- `frontend/src/routes/stories.$storyId.scenes.tsx` — Scene Board: already using `useScenes` from Plan A. Verify scene cards use `scene.id` for navigation, `useCreateScene` for "+ New scene" button.
- `frontend/src/routes/stories.$storyId.scenes.$id.tsx` — Scene Detail: use `useScene(storyId, sceneId)`. Tension bar click calls `useUpdateScene`. Prev/Next navigation uses scene list.
- `frontend/src/routes/stories.$storyId.characters.tsx` — Characters: already using `useCharacters`. Verify row click navigates to `/stories/${storyId}/characters/${char.id}`.
- `frontend/src/routes/stories.$storyId.characters.$id.tsx` — Character Detail: use `useCharacters` to find by ID. Show character profile with presence strip.

For each view: read the current file, identify remaining `useStore` or `../data` imports, replace with appropriate API hooks.

### Task 2: Wire Graph, Draft, AI Insights views

**Files to modify:**
- `frontend/src/routes/stories.$storyId.graph.tsx` — Graph: use `useGraph(storyId)` for nodes+edges. `selectNode` stays in Zustand (UI state). Node click uses `useUpdateNode` for position saves.
- `frontend/src/routes/stories.$storyId.draft.tsx` — Draft: use `useScenes` for scene rail, `useDraft(storyId, activeSceneId)` for prose content. Text editing calls `useUpdateDraft`. Scene selection stays in Zustand `activeSceneN`.
- `frontend/src/routes/stories.$storyId.ai.tsx` — AI Insights: use `useInsights(storyId)`. Dismiss button calls `useDismissInsight`. Category filter is local state.

### Task 3: Wire Timeline, Core, Manuscript, Flagship views

**Files to modify:**
- `frontend/src/routes/stories.$storyId.timeline.tsx` — Timeline: use `useTensionCurve(storyId)` for chart data. Replace `tensionData`/`sampleActs`/`samplePeaks` imports. Metric toggles stay as local state.
- `frontend/src/routes/stories.$storyId.core.tsx` — Core: use `useCoreTree(storyId)` and `useCoreSettings(storyId)`. Tree node click uses Zustand `activeCoreIndex`. Setting edit calls `useUpdateCoreSetting`.
- `frontend/src/routes/stories.$storyId.manuscript.tsx` — Manuscript: use `useChapters(storyId)`. Chapter content is now `ch.content` (string), not `ch.paras` (array). Chapter editing calls `useUpdateChapter`. Scroll tracking stays as local state.
- `frontend/src/routes/stories.$storyId.flagship.tsx` — Flagship: use `useGraph(storyId)` for graph data, `useTensionCurve(storyId)` for tension. Scrubber/play stays as local state.

### Task 4: Wire Collaboration, Export views + remove data imports

**Files to modify:**
- `frontend/src/routes/stories.$storyId.collaboration.tsx` — Collaboration: use `useCollaborators`, `useComments`, `useActivity`. Comment creation calls `useCreateComment`.
- `frontend/src/routes/stories.$storyId.export.tsx` — Export: keep mostly static UI. Wire format selection and "Export" button (placeholder — will trigger Celery task in Plan C).
- Remove any remaining `import ... from '../data'` lines across all route files.
- Clean up any remaining `useStore(s => s.scenes)` or similar server-data store access.

### Task 5: Verify TypeScript compiles and dev server runs

```bash
cd /home/abdussamadbello/beatlume/frontend
npx tsc --noEmit
npm run dev
```

All views should render (showing loading states when backend is not running, real data when it is).
