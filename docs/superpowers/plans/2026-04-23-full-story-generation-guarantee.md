# Full story generation — detailed implementation plan

**Product reference:** [CLAUDE.md](../../../CLAUDE.md) (*Product guarantee*).  
**Related:** [2026-04-20-backend-ai-pipeline.md](./2026-04-20-backend-ai-pipeline.md) (AI plumbing), [PRD.md](../../PRD.md) if present.

This document is the **execution-oriented** breakdown: user journey, backend/frontend work, data, tests, and risks.

---

## 1. Target user journey (UI/UX, end state)

| Step | User sees | System does |
|------|------------|-------------|
| 1 | Dashboard → **New Story** → **Setup** (4 steps) | Create `Story` + optional characters |
| 2 | Redirect to **`/stories/{id}`** (Overview) | Today: stats from existing scenes; new story may have **only** setup-created data |
| 3 | **Primary CTA** (to build): “**Generate story structure**” (or “AI storyline”) | Run scaffold task → **persist** scenes/relationships from JSON |
| 4 | Scene Board / Graph show **real** scene rows and nodes | User trust: structure is not empty |
| 5 | **Primary CTA** (to write): “**Generate full draft**” | Orchestrator runs prose generation **per scene in order** (or selected acts) |
| 6 | Progress: AI panel + optional linear progress (scene 3/27) | SSE + checkpointed draft writes |
| 7 | **Draft** / **Manuscript** | Read/revise per scene |
| 8 | **Export** | PDF/DOCX/ePub from assembled content |

**UX principles for this project**

- **Never** leave Overview as a dead end after first create: show **at least one** obvious next action until the story has structure + draft path is clear.  
- **Two** big verbs: **Structure** (planning) and **Draft** (prose)—order matters: structure first unless user imported scenes.  
- **Confirm** before expensive full-draft (modal: scene count, rough cost, “Start”).  
- **Recover**: partial run → “Resume from scene N” using checkpoint state.

---

## 2. Current implementation snapshot (gap analysis)

| Component | Path | State |
|-----------|------|--------|
| Scaffold graph + prompt | `app/ai/graphs/scaffold_graph.py`, `app/ai/prompts/story_scaffolding.py` | **Runnable**; output JSON with `acts[] → scenes[]` |
| `scaffold_story` task | `app/tasks/ai_tasks.py` | **Stub** — no LLM, no DB |
| Prose for one scene | `continue_prose` → `_run_prose_stream` | **Implemented** — draft write + SSE |
| API scaffold | `POST /api/stories/{id}/ai/scaffold` | **Exists**; body: `ScaffoldRequest` |
| Scene create | `app/services/scene.py` `create_scene` | **Use** for each scaffold scene |
| Story overview | `frontend/src/routes/stories.$storyId.index.tsx` | **No** structure/full-draft CTAs |
| AI hook | `useTriggerScaffold` in `frontend/src/api/ai.ts` | **Exists**; not featured on Overview |
| Export | `app/api/export.py` | Works when `draft_contents` / chapters exist |
| Celery time limit | `app/tasks/celery_app.py` | **300s** — blocks long single tasks |

**Definition of done (engineering):** automated test path: create story → scaffold (mocked LLM) → assert `Scene` rows → trigger manuscript pass (mocked or small model) → assert all target drafts non-empty → export returns 200/artifact.

---

## 3. Phase A — Real scaffolding (persist structure)

### A.1 Design decisions (resolve before coding)

- **Idempotency:** First scaffold on empty story **inserts** scenes. Second run: **(a)** error “already scaffolded”, **(b)** “Replace all AI-generated scenes” (destructive), or **(c)** merge. **Recommendation:** **(a)** or explicit **(b)** with confirm flag `?replace=true` in API or body field.  
- **Premise source:** Task already receives `premise` in `scaffold_story.delay(...)`; ensure it matches **story.logline + title** or dedicated field from `GET /api/stories/{id}`.  
- **Scene numbering:** LLM output uses `n` per scene; must match `Scene.n` unique per story; reorder/renumber if conflicts.  
- **Character sync:** JSON may include new characters vs setup—create missing via `app/services/character` or mark as “suggested” only (smaller scope: create if name not in cast).

### A.2 Backend — task implementation

**File:** `backend/app/tasks/ai_tasks.py`

- Replace `scaffold_story` body with pattern mirroring `continue_prose`:  
  - `async def _run_scaffold(...):` with `_with_session`, `_set_org_rls`  
  - `build_prompt` from `story_scaffolding` using `premise`, `structure_type` as string (e.g. `3-act`), `target_words`, `genres`, `characters`  
  - `call_llm("story_scaffolding", ...)` (sync path like other graphs—check `llm.py` for sync)  
  - `story_scaffolding.validate_output`  
- Call new **service** (below) to persist: `await apply_scaffold_to_story(db, story_id, org_id, validated_dict)`  
- `publish_event` for granular steps optional (`ai.progress` with `scene_count`, `act_index`)  
- On success: `ai.complete` with `type: story_scaffolding`  
- On failure: `ai.error`, retry policy same as other tasks

**File (new):** `backend/app/services/story_scaffold.py`

- `async def apply_scaffold_to_story(db, story_uuid, org_id, data: dict) -> None`  
- **Delete or skip** if story already has scenes: follow idempotency rule.  
- For each scene in JSON (flatten `acts` → list ordered by `n`): call existing `create_scene` / bulk insert with correct `act`, `tension`, `pov`, `location`, `tag`, `summary` (map to `Scene` columns—check `app/models/scene.py`).  
- Character rows: create or link per policy.  
- **Relationships / graph edges:** if API exists in `app/services` for `character_edges`, insert with `provenance=scaffold`.  
- Single transaction or batched commits per N scenes (memory).

**File:** `backend/app/schemas/story.py` (optional) — `ScaffoldResult` for logging only.

### A.3 Backend — API

**File:** `backend/app/api/ai.py`

- Add optional `replace_existing: bool = False` to `ScaffoldRequest`.  
- Pass through to task.  
- Document **409** or **400** if scaffold exists and `replace_existing` is false.

### A.4 Tests

- **Unit:** `test_story_scaffold_apply.py` — `apply_scaffold_to_story` with fake JSON, assert `Scene` count (no LLM).  
- **Task integration:** mock `call_llm` to return fixed JSON, run task, assert DB (pattern from `test_ai_api.py` stubs).

### A.5 Frontend

**File:** `frontend/src/routes/stories.$storyId.index.tsx` (Overview)

- If `scenes.length === 0` (or below threshold): show **callout** panel: title “Start with a storyline”, body one line, primary **Btn** “Generate story structure” → `useTriggerScaffold` mutation with body built from `useStory(storyId)`: `premise: [story.title, story.logline].filter(Boolean).join('\n\n')`, `genres: story.genres`, `target_words: story.target_words`, `structure_type: story.structure_type`, `characters: []` or from `useCharacters`.  
- `onSuccess`: `registerAITask` already via `onSuccess` in `useTriggerScaffold`; ensure invalidation: `queryClient.invalidateQueries({ queryKey: ['stories', storyId, 'scenes'] })` (and graph).  
- Loading: disable button + show “Scaffolding…” tied to `story_scaffolding` in AI panel (already in `AIPanel.tsx` / `useSSE` for type).

**File:** `frontend/src/api/ai.ts` — extend `useTriggerScaffold` payload to match `ScaffoldRequest` if new fields.

### A.6 Phase A exit criteria

- [ ] Running scaffold on a **new** story **creates** at least one `Scene` with correct `story_id` and RLS.  
- [ ] Overview shows new stats and Scene Board is populated.  
- [ ] No “success” without DB rows.

---

## 4. Phase B — Full draft orchestrator (guarantee core)

### B.1 Design

- **Name:** e.g. Celery task `generate_full_manuscript` in `app/tasks/ai_tasks.py` (or `orchestrate_prose`).

**Input (API body):**

```text
{
  "skip_non_empty": true,
  "max_scenes": null,
  "act": null
}
```

- `skip_non_empty`: if draft already has text, skip (save tokens).  
- `max_scenes`: safety for dev/staging.  
- `act`: optional filter `1|2|3`.

**Core loop (sequential v1):**

1. `SELECT` scenes for `story_id` order by `n` ASC.  
2. For each scene: if `skip_non_empty` and `draft` has content → skip.  
3. Call **shared** async function extracted from current `_run_prose_stream` (e.g. `_write_prose_for_scene(story_id, scene_id, org_id, task_id)`) so **one** implementation for single-scene and batch.  
4. After each scene: **commit** (draft already in service), emit `ai.progress` with `{"current": i, "total": N, "scene_n": scene.n}`.  
5. Final `ai.complete` with `type: "full_manuscript"`.

**Celery limits:**

- Do **not** use one 60-minute monolith: either  
  - **Option 1:** increase `time_limit` only for this task class in decorator `@celery_app.task(time_limit=3600)`, or  
  - **Option 2 (preferred for scale):** parent task enqueues **child** tasks one scene per `generate_scene_prose.apply_async(args=[...], countdown=0)` with a **chord** or state in Redis to track completion (more work).  
- **V1:** sequential in one task + raised `time_limit` + `soft_time_limit` to match worst case (e.g. 30 scenes × ~60s = 30 min for slow model—document that product caps scene count in beta).

**SSE / types:** Add `full_manuscript` to frontend `AITaskKind` in `frontend/src/types.ts` and AIPanel labels; ensure `useSSE` shows progress.

### B.2 API

**File:** `backend/app/api/ai.py`

- `POST /api/stories/{story_id}/ai/generate-manuscript`  
- Pydantic model `GenerateManuscriptRequest`  
- `task = generate_full_manuscript.delay(...)` → `202` + `TaskResponse`

### B.3 Backend — refactor

- Extract from `_run_prose_stream` the “after messages built, stream LLM, write draft” into callable used by `continue_prose` and by orchestrator (no duplicated prompt logic).

### B.4 Manuscript / export (optional in v1)

- If export code reads `manuscript_chapters` only: add service `sync_chapters_from_drafts(story_id)` at end of orchestrator.  
- Else: verify `export` pulls from `draft_contents` ordered by scene—if yes, **skip** chapter table for v1.

### B.5 Tests

- Mock `call_llm` / `_write_prose` to return fast; two scenes; assert two draft rows.  
- Test skip_non_empty when first scene filled.

### B.6 Phase B exit criteria

- [ ] API returns 202; task fills every targeted scene with non-empty draft in test.  
- [ ] Export on that story returns a non-empty file (integration).

---

## 5. Phase C — UX: discoverability and trust

### C.1 Overview states (matrix)

| Condition | Primary CTA | Secondary |
|-----------|-------------|----------|
| 0 scenes | “Generate story structure” | Link to optional manual add (Scene Board) |
| ≥1 scene, 0 filled drafts (or all empty) | “Generate full draft” (disabled until scaffold? optional) | “Generate story structure” hidden or “Regenerate (destructive)” |
| Partial draft | “Resume full draft” + progress | “Export” enabled when at least one scene has text |

**Files:** primarily `stories.$storyId.index.tsx`; possibly small `components/story/GenerationCallout.tsx`.

### C.2 Modals

- **Confirm full draft:** `Modal` with scene count, rough token estimate, checkbox “I understand this uses AI and may take several minutes.”  
- **Error / partial:** Toast + persistent banner “Stopped at scene 12” + **Resume**.

### C.3 AIPanel

- Ensure `full_manuscript` and `story_scaffolding` show human-readable progress (reuse `TaskRow`).

**Files:** `frontend/src/components/ai/AIPanel.tsx`, `frontend/src/types.ts`, `frontend/src/hooks/useSSE.ts` (if new event fields).

### C.4 New hook

- `useTriggerGenerateManuscript(storyId)` in `frontend/src/api/ai.ts` mirroring other triggers.

### C.5 Phase C exit criteria

- [ ] New user can find **structure** and **full draft** without reading docs.  
- [ ] Confirm before long job.

---

## 6. Phase D — Verification and CI

| Test | Where | What |
|------|--------|------|
| Scaffold persistence | `backend/tests/` | Mock LLM → N scenes in DB |
| Manuscript orchestrator | `backend/tests/` | 2 scenes, mock prose → 2 drafts |
| Simulation | `test_simulation/test_full_writing_flow.py` | Extend to export |
| E2E | `frontend/tests/e2e/` | New spec or extend: mock API or feature flag; **CI without real OpenAI** |

**E2E strategy for CI:** run against backend with `call_llm` stubbed in test settings, or skip E2E in default CI and run nightly.

---

## 7. Rollout order (strict)

1. **A.2 + A.3 + A.4** — real scaffold (backend first).  
2. **A.5** — Overview CTA.  
3. **B.2 + B.3 + B.4 (minimal)** — orchestrator + API.  
4. **C** — modals and resume UX.  
5. **D** — harden tests.

Do **not** block Phase B on perfect graph edges from scaffold; **scenes + drafts** are enough for export guarantee. Relationship edges from scaffold can be a fast follow.

---

## 8. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| 300s Celery cap | Per-task `time_limit`; or chunked tasks; document beta scene cap |
| Runaway cost | `max_scenes`, confirm modal, org-level quota (future) |
| RLS / org_id wrong in task | Reuse same `_set_org_rls` as `continue_prose` |
| Duplicate scene `n` | Single transaction + deterministic renumbering from scaffold JSON |
| Stale LLM output | `validate_output` already; version prompt in `story_scaffolding` |

---

## 9. Checklist (copy for project board)

**Phase A**
- [ ] `apply_scaffold_to_story` service + tests  
- [ ] Implement `scaffold_story` Celery body  
- [ ] `ScaffoldRequest` optional `replace_existing` + errors  
- [ ] Overview: empty state + `useTriggerScaffold`  
- [ ] Invalidate scenes/graph queries on success  

**Phase B**  
- [ ] Extract shared prose writer from `_run_prose_stream`  
- [ ] `generate_full_manuscript` task + checkpointing  
- [ ] `POST .../ai/generate-manuscript`  
- [ ] `time_limit` / chunking decision documented  
- [ ] `useTriggerGenerateManuscript` + types + SSE copy  

**Phase C**  
- [ ] State matrix + CTAs  
- [ ] Confirm + resume modals/banners  
- [ ] AIPanel progress for full manuscript  

**Phase D**  
- [ ] Integration tests  
- [ ] E2E or smoke script  

---

*Last updated: 2026-04-23. Adjust file paths if the repo structure changes.*
