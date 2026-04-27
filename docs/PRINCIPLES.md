# BeatLume — Engineering & AI Principles

This document captures the *why* behind BeatLume's architecture. [ARCHITECTURE.md](./ARCHITECTURE.md) describes *what* the system does and how the algorithms work; this document captures the design rules that should outlive any single feature.

If you're adding a new domain or AI workflow, the goal is that you can read this once and make decisions consistent with the rest of the codebase.

---

## Architecture at a glance

```
Browser (React + TanStack)
  │
  │  HTTP (JSON, JWT)         SSE (per-story event stream)
  ▼                            ▲
FastAPI ────────────────────── │
  │   routes → services → SQLAlchemy → PostgreSQL (org-scoped RLS)
  │                                              │
  │   202 + task_id                              │
  ▼                                              │
Celery (queues: ai_fast, ai_heavy, export)       │
  │                                              │
  │   AI: context assembler → LangGraph → LiteLLM
  │   Export: ReportLab / docx / epub / plaintext
  │                                              │
  └──────► Redis pub/sub ───────────────────────┘
```

Three things to notice:

1. **The HTTP cycle never blocks on AI or export.** Slow work goes to Celery and reports back over SSE.
2. **PostgreSQL is the source of truth.** Caches (TanStack Query, Redis) are invalidated by events, not by polling.
3. **One SSE stream per story workspace** carries every async event the user could care about: AI progress, export progress, comments, activity. Subscribers filter by event type.

---

## Engineering principles

### 1. Direct route → service → model. No repository layer.

Routes own request validation. Services own business logic and orchestration. SQLAlchemy sessions are passed into services directly — there is no abstraction over the ORM, because the ORM is already an abstraction over SQL. Adding another layer would just be ceremony.

When a service grows past ~300 lines or starts handling multiple concerns, split it by domain (e.g. `insight_apply.py` is split out from `insight.py`), not by introducing a "repository."

### 2. Server data lives in TanStack Query. Auth and UI ephemera live in Zustand.

Two stores, two purposes. The rule is binary:

- If the data came from the API, it goes into TanStack Query.
- If the data is local UI state (selections, modes, draft form fields, the auth token), it goes into Zustand.

Mixing these creates duplicate sources of truth. We'd have to invalidate both stores on every mutation, and one of them would inevitably drift.

### 3. Defense in depth at the data layer (RLS, not just app code).

Every org-scoped table has Row-Level Security policies (`backend/migrations/versions/2b2c323bea26_initial_schema_from_models.py`). The application sets `app.current_org_id` per request and trusts the database to enforce isolation.

If an app-layer query forgets to filter by `org_id`, RLS still returns only the current org's rows. The application is the second line, not the first.

> **Open caveat:** legacy org-scoped tables enable RLS without `FORCE`, so the `beatlume` superuser role bypasses them. Newer chat tables use `FORCE ROW LEVEL SECURITY`. Hardening the legacy tables is a known follow-up.

### 4. Cross-org access returns `404`, not `403`.

If a thread or resource exists but belongs to another org, the API returns `404 Not Found`. See `backend/app/api/chat.py:67-69` for the pattern.

`403` would leak the existence of the resource. `404` is uniform with "doesn't exist," so an attacker can't probe for valid IDs across tenants.

### 5. Async-by-default for slow work.

Anything that takes longer than ~1 second goes through Celery. The HTTP route returns `202 Accepted` with a `task_id`, the worker reports progress over SSE, and the frontend invalidates the relevant Query cache when the task completes.

Three queues, by characteristic:

- `ai_fast` — prose continuation, summarization (user is waiting)
- `ai_heavy` — insights, scaffolding (can take a minute)
- `export` — CPU-bound rendering

Mixing them would let a long insight job starve a user's prose continuation request.

### 6. Migrations are SQL contracts, not implementation details.

Alembic revisions are the single source of truth for schema. RLS policies, indexes, and check constraints all live in migrations — not in conventions, runtime hooks, or seed scripts. If it isn't in a migration, a fresh environment won't have it.

### 7. Fail fast at startup in production.

`backend/app/main.py` refuses to start if `JWT_SECRET_KEY` is the dev default or `DATABASE_URL` contains dev credentials in `ENVIRONMENT=production`. A misconfigured prod deploy should crash on boot, not run with degraded security.

### 8. *(Open)* Testing depth — when integration > unit, when E2E > integration.

> **TODO — your call.** What's the team's heuristic for picking a test layer? Pick the rule you actually apply and codify it here. A starting point: "anything that touches RLS gets an integration test against real Postgres; analytics functions get unit tests with synthetic input; user-visible flows get one Playwright happy-path." Edit this section to match what you actually do.

---

## AI principles

### 1. Context engineering, not prompt engineering.

A 90,000-word novel cannot fit in a prompt. The model only sees what was deliberately selected. Every AI task runs the same five-step pipeline (`backend/app/ai/context/assembler.py`):

```
budget → retrieve → rank → truncate → format
```

Each step is replaceable per task: a continuation task ranks scenes by proximity decay; an insight task ranks by category; a scaffold task uses no ranking at all. The pipeline is the discipline — the steps are the variables.

### 2. Tiered model routing.

`backend/app/config.py:41-44` defines four tiers — FAST, STANDARD, POWERFUL, SCAFFOLD — backed by environment variables. Every AI feature picks a tier based on the cognitive demand of the task, not the user's preference:

| Task | Tier | Reason |
|------|------|--------|
| Scene summarization | FAST | Pure extraction, mini-models handle it |
| Prose continuation | STANDARD | Voice + creativity, mid-tier |
| Insight generation | POWERFUL | Cross-act structural reasoning |
| Story scaffold | SCAFFOLD | One-shot creative generation |

LiteLLM abstracts the provider. Switching from OpenAI to Anthropic to a local model is an env var change.

### 3. Explainability over judgment.

No "this is weak." Every recommendation cites the data basis: which scenes, which characters, which metric range. The insight prompt explicitly asks for chain-of-thought, and the output format requires `evidence` fields tied to scene numbers.

If a future feature returns a score without an explanation, it doesn't ship.

### 4. AI proposes; the user disposes.

The default for any AI mutation is *propose then approve*. This shows up in three places:

- **Insights** — `generate` writes to the insights table; `apply` is a separate endpoint the user invokes after review.
- **Graph edges** — `backend/app/models/graph.py:26-28` defines four provenance values: `author`, `ai_accepted`, `ai_pending`, `scaffold`. AI inferences land as `ai_pending` and need explicit acceptance. AI never overrides an `author` edge.
- **Chat tool calls** — the agent emits proposed edits as messages; `tool_calls/{message_id}/apply` and `tool_calls/{message_id}/reject` are separate endpoints.

> **Exception:** the full-manuscript pass (`/ai/generate-manuscript`) drives scenes autonomously. That's intentional — it's the product guarantee. See the next principle.

### 5. *(Open)* Where AI autonomy ends and user agency begins.

> **TODO — your call.** The full-manuscript pass is autonomous. Insight `apply`, graph edges, and chat tool calls are gated. Why is that line drawn where it is, and how should a new AI feature decide which side to land on? A starting frame: "structural mutations are gated; structural *suggestions* are not." Edit this section with the framing you actually want the team to use.

### 6. Provenance tracking on every AI-touched artifact.

If AI wrote it, the artifact records that. Graph edges have a `provenance` enum. AI-generated insights have a `source` field. Drafted prose tracks whether a scene's `draft_contents` came from `ai-continue`.

This is what makes principle 4 enforceable. Without provenance, "AI never overrides author edges" is just a hope.

### 7. JSON output, validate, retry once.

Every prompt module exposes a `build_prompt()` and a `validate_output()` (7 modules in `backend/app/ai/prompts/`). The LLM is told to return JSON. The output is parsed and validated against an explicit schema.

On validation failure, the system retries *once* with the validation error appended to the prompt. Most LLM "failures" are formatting drift, not capability gaps — a single retry recovers them cheaply. If the second attempt also fails, the task surfaces an error rather than fabricating a result.

### 8. Voice matching via context, not instructions.

Don't tell the LLM to "match the author's voice." Show it the last two scenes of prose and let it pattern-match. The continuation task uses `keep_end=True` truncation specifically so the most recent paragraphs survive the token budget.

Instructions about style are weaker than examples of style.

### 9. Negative constraints in prompts.

Prose prompts include explicit "never use" lists ("a sense of," "couldn't help but," "it was as if"). LLMs default to these clichés; explicit exclusion produces noticeably better fiction. The same pattern works for analysis prompts ("don't return scores without evidence").

### 10. Per-tier temperature, not per-call.

Analysis tasks run at `temperature=0.3` (deterministic, factual). Prose generation runs at `0.8` (creative). Scaffolding sits in between at `0.7`. Temperature is a property of the *kind* of task, not a per-call hyperparameter to tune.

---

## How to apply these principles

When adding a new feature, walk the list:

1. **Where does this live in the layers?** Route handler, service, or task?
2. **Whose state is this?** TanStack Query (server) or Zustand (UI)?
3. **Does it cross orgs?** RLS coverage + cross-org `404` test.
4. **Is it slow?** Celery queue + SSE event + Query invalidation.
5. **Does it call an LLM?** Pick a tier, define context retrieval, write `validate_output`, decide whether the output mutates state directly or proposes-then-approves.
6. **Does the artifact need provenance?** If the user can't tell whether AI or a human wrote it, it does.

If a new feature can't answer one of these cleanly, that's a signal to either revise the feature or update this document. Both are valid; silently doing neither is not.
