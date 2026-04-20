# BeatLume Integration Plan C: SSE + AI + Export + Seed + Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire SSE real-time events, AI trigger buttons, export download flow, create the backend seed script for sample data, and clean up any remaining mock data references.

**Architecture:** SSE hook connects to backend event stream, auto-invalidates query cache on AI/export completion. AI buttons trigger Celery tasks via POST endpoints. Seed script populates the database with "A Stranger in the Orchard" sample story data.

**Tech Stack:** EventSource API, TanStack Query invalidation, Celery tasks (backend), Python seed script

---

### Task 1: SSE Hook

**Files:**
- Create: `frontend/src/hooks/useSSE.ts`
- Modify: `frontend/src/routes/stories.$storyId.tsx` — call `useSSE(storyId)` in the story layout

The hook:
1. Opens `EventSource` to `/api/stories/${storyId}/events?token=${accessToken}`
2. Listens for events: `ai.progress`, `ai.complete`, `ai.error`, `export.progress`, `export.complete`, `activity`, `comment`
3. On `ai.complete` → `queryClient.invalidateQueries` for the relevant domain
4. Auto-reconnect on disconnect
5. Cleanup on unmount

Also modify the backend SSE endpoint (`backend/app/api/sse.py`) to accept `?token=` query parameter as auth alternative since EventSource can't set headers.

### Task 2: AI Trigger Buttons + Progress Toast

**Files:**
- Create: `frontend/src/api/ai.ts` — mutation hooks for each AI endpoint (triggerInsights, triggerProseContinue, triggerRelationships, triggerSummarize, triggerScaffold)
- Create: `frontend/src/components/AIProgressToast.tsx` — fixed-position toast showing AI task progress
- Modify: `frontend/src/routes/stories.$storyId.ai.tsx` — add "Generate Insights" button calling `useTriggerInsights`
- Modify: `frontend/src/routes/stories.$storyId.draft.tsx` — add "AI Continue" button calling `useTriggerProseContinue`
- Modify: `frontend/src/routes/stories.$storyId.graph.tsx` — add "Suggest Relationships" button calling `useTriggerRelationships`

### Task 3: Export Download Flow

**Files:**
- Create: `frontend/src/api/export.ts` — `useTriggerExport` mutation, `useExportStatus` query
- Modify: `frontend/src/routes/stories.$storyId.export.tsx` — "Export" button triggers Celery task, shows progress, downloads on completion via presigned URL

### Task 4: Backend Seed Script

**Files:**
- Create: `backend/app/seeds/__init__.py`
- Create: `backend/app/seeds/sample_story.py`

The seed script:
1. Creates user "Elena Marsh" (elena@beatlume.io, password: beatlume123)
2. Creates personal org
3. Creates "A Stranger in the Orchard" story
4. Inserts scenes, characters, graph nodes/edges, insights, draft content, core config, manuscript chapters
5. Uses the existing data from `frontend/src/data/` modules as reference for content

Run: `cd backend && PYTHONPATH=. uv run python -m app.seeds.sample_story`

### Task 5: Cleanup + Final Verification

- Remove any remaining `import ... from '../data'` in route files
- Remove unused exports from `frontend/src/data/index.ts` (keep the module but note it's only used by seed script reference)
- Verify `npx tsc --noEmit` passes
- Verify `npm run dev` starts
- Verify backend `PYTHONPATH=. uv run pytest tests/ -v` still passes (94 tests)
- Run seed script against local PostgreSQL
- Start both frontend + backend, test the full flow: login → dashboard → click story → scene board
