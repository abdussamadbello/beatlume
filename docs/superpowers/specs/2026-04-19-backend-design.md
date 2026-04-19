# BeatLume Backend Design Spec

## Goal

Build the complete BeatLume backend: a FastAPI application that replaces the frontend's mock data with a persistent, AI-powered backend. The system provides CRUD APIs for all story data, AI-driven story analysis and generation via LangGraph + LiteLLM, background task processing via Celery, manuscript export in four formats, and full observability via OpenTelemetry.

## Tech Stack

- **Runtime:** Python 3.12, UV package manager
- **Framework:** FastAPI (async)
- **Database:** PostgreSQL 16 + SQLAlchemy 2 (async) + Alembic migrations
- **Cache/Broker:** Redis 7 (Celery broker + result backend + pub/sub for SSE + analytics cache)
- **AI:** LangGraph (workflow orchestration) + LiteLLM (multi-provider LLM abstraction)
- **Tasks:** Celery 5 with queue routing (ai_fast, ai_heavy, export, maintenance)
- **Export:** ReportLab (PDF), python-docx (DOCX), ebooklib (ePub), plain text
- **Storage:** S3-compatible (MinIO local, real S3 in production)
- **Auth:** JWT (access + refresh) + OAuth2 (Google, GitHub)
- **Telemetry:** OpenTelemetry SDK + Jaeger + structlog
- **Infrastructure:** Docker Compose (API + workers + PostgreSQL + Redis + MinIO + Jaeger)

## Architecture

Layered monolith. Single FastAPI codebase with clear internal boundaries:

```
API Routes → Services (business logic) → Models (SQLAlchemy)
                  ↓
            AI Graphs (LangGraph) → LiteLLM
                  ↓
            Celery Tasks (async jobs)
```

One process for the API, separate processes for Celery workers (per queue), shared codebase. Services work directly with SQLAlchemy sessions — no repository layer.

---

## 1. Project Structure

```
backend/
├── pyproject.toml
├── alembic.ini
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── migrations/
│   ├── env.py
│   ├── init_rls.sql
│   └── versions/
└── app/
    ├── __init__.py
    ├── main.py                     # FastAPI app factory, lifespan, middleware
    ├── config.py                   # Pydantic Settings
    ├── deps.py                     # Dependency injection (get_db, get_current_user, get_s3)
    │
    ├── models/
    │   ├── __init__.py
    │   ├── base.py                 # Declarative base, OrgScopedMixin, common columns
    │   ├── user.py                 # User, Organization, Membership
    │   ├── story.py                # Story
    │   ├── scene.py                # Scene
    │   ├── character.py            # Character
    │   ├── graph.py                # CharacterNode, CharacterEdge
    │   ├── insight.py              # Insight
    │   ├── draft.py                # DraftContent
    │   ├── core.py                 # CoreConfigNode, CoreSetting
    │   ├── manuscript.py           # ManuscriptChapter
    │   └── collaboration.py        # Collaborator, Comment, ActivityEvent, ExportJob
    │
    ├── schemas/
    │   ├── __init__.py
    │   ├── auth.py
    │   ├── user.py
    │   ├── story.py
    │   ├── scene.py
    │   ├── character.py
    │   ├── graph.py
    │   ├── insight.py
    │   ├── draft.py
    │   ├── core.py
    │   ├── manuscript.py
    │   ├── collaboration.py
    │   └── export.py
    │
    ├── services/
    │   ├── __init__.py
    │   ├── auth.py
    │   ├── story.py
    │   ├── scene.py
    │   ├── character.py
    │   ├── graph.py
    │   ├── insight.py
    │   ├── draft.py
    │   ├── collaboration.py
    │   ├── export.py
    │   └── analytics/
    │       ├── __init__.py
    │       ├── tension.py
    │       ├── presence.py
    │       ├── arcs.py
    │       ├── pacing.py
    │       ├── health.py
    │       ├── sparkline.py
    │       └── export_charts.py
    │
    ├── api/
    │   ├── __init__.py
    │   ├── router.py
    │   ├── auth.py
    │   ├── users.py
    │   ├── stories.py
    │   ├── scenes.py
    │   ├── characters.py
    │   ├── graph.py
    │   ├── insights.py
    │   ├── draft.py
    │   ├── core.py
    │   ├── manuscript.py
    │   ├── collaboration.py
    │   ├── export.py
    │   ├── analytics.py
    │   └── sse.py
    │
    ├── ai/
    │   ├── __init__.py
    │   ├── llm.py
    │   ├── prompts/
    │   │   ├── __init__.py
    │   │   ├── insight_analysis.py
    │   │   ├── insight_synthesis.py
    │   │   ├── prose_continuation.py
    │   │   ├── relationship_inference.py
    │   │   ├── scene_summarization.py
    │   │   └── story_scaffolding.py
    │   ├── context/
    │   │   ├── __init__.py
    │   │   ├── assembler.py
    │   │   ├── retrievers.py
    │   │   ├── rankers.py
    │   │   ├── formatters.py
    │   │   └── token_budget.py
    │   ├── graphs/
    │   │   ├── __init__.py
    │   │   ├── insight_graph.py
    │   │   ├── prose_graph.py
    │   │   ├── relationship_graph.py
    │   │   ├── summary_graph.py
    │   │   └── scaffold_graph.py
    │   └── graph/
    │       ├── __init__.py
    │       ├── layout.py
    │       ├── temporal.py
    │       ├── evolution.py
    │       └── generator.py
    │
    ├── tasks/
    │   ├── __init__.py
    │   ├── celery_app.py
    │   ├── ai_tasks.py
    │   ├── export_tasks.py
    │   └── maintenance.py
    │
    ├── export/
    │   ├── __init__.py
    │   ├── base.py
    │   ├── pdf.py
    │   ├── docx.py
    │   ├── epub.py
    │   └── plaintext.py
    │
    ├── storage/
    │   ├── __init__.py
    │   └── s3.py
    │
    └── telemetry/
        ├── __init__.py
        ├── setup.py
        ├── traces.py
        ├── metrics.py
        └── logging.py
```

---

## 2. Database Models & RLS

### Multi-tenancy Strategy

Organization-based multi-tenancy with PostgreSQL Row-Level Security (RLS). Every data table (except `user` and `organization`) has an `org_id` column. RLS policies enforce that queries only return rows matching the current session's org.

Per-request, the FastAPI dependency sets `SET app.current_org_id = '<uuid>'` on the database session before any query runs.

### OrgScopedMixin

```python
class OrgScopedMixin:
    """Mixin for all org-scoped tables. Adds org_id + FK + index."""
    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id"), index=True
    )
```

All models below (except User, Organization, Membership) inherit this mixin.

### Models

**Organization**
- `id`: UUID (pk)
- `name`: str
- `slug`: str (unique)
- `created_at`, `updated_at`: timestamp

**User**
- `id`: UUID (pk)
- `email`: str (unique)
- `name`: str
- `password_hash`: str (nullable, null for OAuth-only users)
- `avatar_url`: str (nullable)
- `plan`: enum(free, pro, team)
- `oauth_provider`: str (nullable, 'google' | 'github')
- `oauth_id`: str (nullable)
- `active_org_id`: FK → Organization (nullable, tracks which org the user is currently working in; set on login, switchable)
- `created_at`, `updated_at`: timestamp

**Membership**
- `id`: UUID (pk)
- `user_id`: FK → User
- `org_id`: FK → Organization
- `role`: enum(owner, admin, editor, viewer)
- `created_at`: timestamp
- unique(user_id, org_id)

**Story**
- `id`: UUID (pk)
- `org_id`: FK → Organization (RLS)
- `title`: str
- `genres`: str[] (PostgreSQL ARRAY)
- `target_words`: int
- `draft_number`: int
- `status`: enum(not_started, in_progress, completed)
- `structure_type`: str ('3-act', '5-act', 'freeform')
- `created_at`, `updated_at`: timestamp

**Scene**
- `id`: UUID (pk)
- `org_id`: FK → Organization
- `story_id`: FK → Story
- `n`: int (sequence number)
- `title`: str
- `pov`: str
- `tension`: int (1-10)
- `act`: int
- `location`: str
- `tag`: str
- `summary`: text (nullable)
- `created_at`, `updated_at`: timestamp
- unique(story_id, n)

**Character**
- `id`: UUID (pk)
- `org_id`: FK → Organization
- `story_id`: FK → Story
- `name`: str
- `role`: str
- `desire`: text
- `flaw`: text
- `scene_count`: int
- `longest_gap`: int
- `created_at`, `updated_at`: timestamp

**CharacterNode**
- `id`: UUID (pk)
- `org_id`: FK → Organization
- `story_id`: FK → Story
- `character_id`: FK → Character
- `x`: float
- `y`: float
- `label`: str
- `initials`: str
- `node_type`: enum(hub, minor) nullable
- `first_appearance_scene`: int

**CharacterEdge**
- `id`: UUID (pk)
- `org_id`: FK → Organization
- `story_id`: FK → Story
- `source_node_id`: FK → CharacterNode
- `target_node_id`: FK → CharacterNode
- `kind`: enum(conflict, alliance, romance, mentor, secret, family)
- `weight`: float
- `provenance`: enum(author, ai_accepted, ai_pending, scaffold)
- `evidence`: JSONB (list of `{scene_n, type}`)
- `first_evidenced_scene`: int
- unique(story_id, source_node_id, target_node_id)

**Insight**
- `id`: UUID (pk)
- `org_id`: FK → Organization
- `story_id`: FK → Story
- `severity`: enum(red, amber, blue)
- `category`: str
- `title`: str
- `body`: text
- `refs`: str[]
- `dismissed`: bool (default false)
- `generated_at`: timestamp
- `created_at`: timestamp

**DraftContent**
- `id`: UUID (pk)
- `org_id`: FK → Organization
- `story_id`: FK → Story
- `scene_id`: FK → Scene
- `content`: text
- `word_count`: int (computed on save)
- `updated_at`: timestamp

**CoreConfigNode**
- `id`: UUID (pk)
- `org_id`: FK → Organization
- `story_id`: FK → Story
- `depth`: int
- `label`: str
- `kind`: enum(story, part, chap, scene, beat)
- `active`: bool (default false)
- `sort_order`: int

**CoreSetting**
- `id`: UUID (pk)
- `org_id`: FK → Organization
- `story_id`: FK → Story
- `key`: str
- `value`: str
- `source`: str
- `tag`: str (nullable)
- unique(story_id, key)

**ManuscriptChapter**
- `id`: UUID (pk)
- `org_id`: FK → Organization
- `story_id`: FK → Story
- `num`: int
- `title`: str
- `content`: text
- `sort_order`: int

**Collaborator**
- `id`: UUID (pk)
- `org_id`: FK → Organization
- `story_id`: FK → Story
- `user_id`: FK → User
- `role`: enum(author, editor, reader)
- `invited_at`, `accepted_at`: timestamp

**Comment**
- `id`: UUID (pk)
- `org_id`: FK → Organization
- `story_id`: FK → Story
- `scene_id`: FK → Scene (nullable)
- `user_id`: FK → User
- `body`: text
- `created_at`: timestamp

**ActivityEvent**
- `id`: UUID (pk)
- `org_id`: FK → Organization
- `story_id`: FK → Story
- `user_id`: FK → User
- `action`: str
- `detail`: JSONB
- `created_at`: timestamp

**ExportJob**
- `id`: UUID (pk)
- `org_id`: FK → Organization
- `story_id`: FK → Story
- `format`: enum(pdf, docx, epub, plaintext)
- `status`: enum(pending, processing, completed, failed)
- `options`: JSONB
- `file_key`: str (nullable, S3 key)
- `error`: text (nullable)
- `created_at`, `completed_at`: timestamp

### RLS Policy

Applied to every org-scoped table:

```sql
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON scenes
  USING (org_id = current_setting('app.current_org_id')::uuid);
```

Bootstrap SQL (`migrations/init_rls.sql`):

```sql
ALTER DATABASE beatlume SET app.current_org_id = '00000000-0000-0000-0000-000000000000';
CREATE OR REPLACE FUNCTION current_org_id() RETURNS uuid AS $$
  SELECT current_setting('app.current_org_id', true)::uuid;
$$ LANGUAGE SQL STABLE;
```

---

## 3. Authentication & Authorization

### JWT Token Pair

- **Access token**: 15 min TTL, sent in `Authorization: Bearer` header
- **Refresh token**: 7 day TTL, httpOnly cookie, refresh rotation
- Payload: `user_id`, `org_id`, `role`, `exp`
- Revocation: refresh tokens blacklisted in Redis with TTL on logout

### Auth Endpoints

```
POST /auth/signup          → create user + personal org → tokens
POST /auth/login           → email + password → tokens
POST /auth/refresh         → refresh cookie → new access token
POST /auth/logout          → blacklist refresh token

GET  /auth/oauth/google    → redirect to Google consent
GET  /auth/oauth/github    → redirect to GitHub consent
GET  /auth/callback/google → exchange code → find/create user → tokens
GET  /auth/callback/github → exchange code → find/create user → tokens

POST /auth/forgot-password → queue reset email (Celery task)
POST /auth/reset-password  → token + new password → update
```

### OAuth Flow

1. Frontend redirects to `/auth/oauth/google`
2. Backend redirects to Google with `client_id`, `redirect_uri`, `scope`
3. Google calls back `/auth/callback/google?code=...`
4. Backend exchanges code for user info, finds/creates `User` with `oauth_provider='google'`
5. Issues JWT pair, redirects frontend to `/dashboard` with tokens

### Password Hashing

`passlib[bcrypt]` for password hashing.

### Authorization Layers

1. **Authentication** — `get_current_user` dependency validates JWT. Returns `User` or 401.
2. **Organization membership** — `get_current_org` sets `app.current_org_id` on DB session for RLS. 403 if no membership.
3. **Story-level permissions** — `Collaborator` table defines per-story roles:
   - **author**: full CRUD
   - **editor**: CRUD on scenes, characters, draft, comments. No story deletion or collaborator management.
   - **viewer**: read-only + comments

### Signup Flow

1. Signup → create `User` + `Organization` (personal org, user is owner)
2. Return tokens → frontend redirects to `/welcome`
3. Welcome wizard → `PUT /api/users/me` updates profile
4. "Create first story" → `POST /api/stories` → redirect to `/setup`

---

## 4. API Design & SSE

### URL Structure

All story data nested under `/api/stories/{story_id}/` for story-level scoping. Combined with RLS on `org_id`, two-level isolation.

```
# Auth
POST   /auth/signup
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/oauth/{provider}
GET    /auth/callback/{provider}
POST   /auth/forgot-password
POST   /auth/reset-password

# User
GET    /api/users/me
PUT    /api/users/me
GET    /api/users/me/organizations

# Stories
GET    /api/stories
POST   /api/stories
GET    /api/stories/{story_id}
PUT    /api/stories/{story_id}
DELETE /api/stories/{story_id}

# Scenes
GET    /api/stories/{story_id}/scenes              ?act=&pov=&sort=
POST   /api/stories/{story_id}/scenes
GET    /api/stories/{story_id}/scenes/{id}
PUT    /api/stories/{story_id}/scenes/{id}
DELETE /api/stories/{story_id}/scenes/{id}

# Characters
GET    /api/stories/{story_id}/characters
POST   /api/stories/{story_id}/characters
GET    /api/stories/{story_id}/characters/{id}
PUT    /api/stories/{story_id}/characters/{id}
DELETE /api/stories/{story_id}/characters/{id}

# Graph
GET    /api/stories/{story_id}/graph                ?at_scene=N
GET    /api/stories/{story_id}/graph/suggestions
POST   /api/stories/{story_id}/graph/suggestions/{edge_id}/accept
POST   /api/stories/{story_id}/graph/suggestions/{edge_id}/reject
PUT    /api/stories/{story_id}/graph/nodes/{id}
POST   /api/stories/{story_id}/graph/edges
PUT    /api/stories/{story_id}/graph/edges/{id}
DELETE /api/stories/{story_id}/graph/edges/{id}
POST   /api/stories/{story_id}/graph/re-layout

# Insights
GET    /api/stories/{story_id}/insights             ?category=&severity=
POST   /api/stories/{story_id}/insights/generate    → async, returns task_id
PUT    /api/stories/{story_id}/insights/{id}/dismiss

# Draft
GET    /api/stories/{story_id}/draft/{scene_id}
PUT    /api/stories/{story_id}/draft/{scene_id}
POST   /api/stories/{story_id}/draft/{scene_id}/ai-continue  → async, returns task_id

# Core Config
GET    /api/stories/{story_id}/core/tree
PUT    /api/stories/{story_id}/core/tree/{id}
GET    /api/stories/{story_id}/core/settings
PUT    /api/stories/{story_id}/core/settings/{key}

# Manuscript
GET    /api/stories/{story_id}/manuscript
GET    /api/stories/{story_id}/manuscript/{num}
PUT    /api/stories/{story_id}/manuscript/{num}

# Collaboration
GET    /api/stories/{story_id}/collaborators
POST   /api/stories/{story_id}/collaborators/invite
DELETE /api/stories/{story_id}/collaborators/{id}
GET    /api/stories/{story_id}/activity
GET    /api/stories/{story_id}/comments              ?scene_id=
POST   /api/stories/{story_id}/comments

# Export
POST   /api/stories/{story_id}/export                → async, returns task_id
GET    /api/stories/{story_id}/export/{job_id}

# AI
POST   /api/stories/{story_id}/ai/scaffold           → async
POST   /api/stories/{story_id}/ai/relationships       → async
POST   /api/stories/{story_id}/ai/summarize/{scene_id} → async

# Analytics
GET    /api/stories/{story_id}/analytics/tension-curve
GET    /api/stories/{story_id}/analytics/pacing
GET    /api/stories/{story_id}/analytics/presence
GET    /api/stories/{story_id}/analytics/arcs
GET    /api/stories/{story_id}/analytics/arcs/{character_id}/compare/{other_id}
GET    /api/stories/{story_id}/analytics/health
GET    /api/stories/{story_id}/analytics/heatmap
GET    /api/stories/{story_id}/analytics/sparkline

# SSE
GET    /api/stories/{story_id}/events
```

### SSE Event Stream

Single SSE endpoint per story. Frontend opens one `EventSource` when entering a story workspace.

Event types:

```
event: ai.progress
data: {"task_id": "...", "type": "prose_continuation", "status": "running", "chunk": "..."}

event: ai.complete
data: {"task_id": "...", "type": "insight_generation", "result": [...]}

event: ai.error
data: {"task_id": "...", "error": "Rate limit exceeded"}

event: export.progress
data: {"job_id": "...", "percent": 65}

event: export.complete
data: {"job_id": "...", "download_url": "..."}

event: activity
data: {"user": "Wren", "action": "added_scene", "detail": {"scene_n": 14}}

event: comment
data: {"user": "Kai", "scene_id": "...", "body": "This pacing feels off"}
```

Implementation: Celery tasks publish to Redis pub/sub channel `story:{story_id}:events`. SSE endpoint subscribes and yields events. Cleanup on client disconnect.

### Response Conventions

- Lists: `{ items: [...], total: int }` with `?offset=&limit=` pagination
- Create: `201` with created resource
- Update: `200` with updated resource
- Delete: `204` no body
- Async: `202` with `{ task_id: "..." }`
- Errors: `{ detail: str, code: str }`

---

## 5. AI Pipeline

### Model Routing

LiteLLM abstracts the provider. Each task type maps to a model tier via environment variables:

| Task | Tier | Default Model |
|------|------|---------------|
| Scene summarization | fast | gpt-4o-mini |
| Prose continuation | standard | gpt-4o |
| Relationship inference | standard | gpt-4o |
| Insight generation | powerful | claude-sonnet-4-6 |
| Story scaffolding | powerful | claude-sonnet-4-6 |

All configurable via `AI_MODEL_FAST`, `AI_MODEL_STANDARD`, `AI_MODEL_POWERFUL` env vars.

### LangGraph Workflows

All graphs follow: `gather_context → validate → execute (LLM) → parse_output → persist_results`

#### Insight Generation Graph

```
[gather_story_context] → [chunk_analysis] → [synthesize_insights] → [persist_insights]
```

- Chunks story by act, runs parallel LLM calls per chunk
- Synthesis merges findings, deduplicates, assigns severity
- State: `InsightState { story_id, scenes, characters, edges, chunks, raw_findings, insights }`

#### Prose Continuation Graph

```
[gather_scene_context] → [generate_prose] → [post_process]
```

- Streams tokens via Redis pub/sub → SSE
- State includes voice sample, prior scenes, current prose, POV character

#### Relationship Inference Graph

```
[gather_character_scenes] → [analyze_pairs] → [diff_with_existing] → [persist_suggestions]
```

- Batches character pairs (3-5 per LLM call)
- Produces suggestions, not auto-applied — frontend shows accept/reject

#### Scene Summarization Graph

```
[gather_prose] → [generate_summary] → [persist_summary]
```

- Single LLM call, produces summary + 3-5 beats

#### Story Scaffolding Graph

```
[parse_premise] → [generate_structure] → [generate_scenes] → [generate_characters] → [assemble_story]
```

- Multiple sequential LLM calls
- Creates Story + Scene + Character + Node/Edge + empty DraftContent rows

### Prompts

Each prompt module exports a `build_prompt()` function and a `validate_output()` function.

#### Prose Continuation Prompt

System prompt provides:
- Story context (genre, tense, tone, themes)
- POV character profile (name, role, desire, flaw)
- Current scene metadata (title, location, act, tension level)
- Rules: match author's voice exactly, stay in POV, honor tension level, advance the scene, show don't tell, no clichés, no meta-commentary, output prose only

User prompt provides:
- Voice reference (author's best prose from other scenes, ~2000 words)
- Preceding context (last 2 scenes' prose)
- Current scene prose (continue from here)

Output: 150-250 words of continuation prose, no formatting or labels.

#### Insight Analysis Prompt (per-act)

System prompt instructs senior developmental editor to:
1. Check pacing (tension monotony, rhythm)
2. Check character presence (disappearances, POV balance)
3. Check relationships (edges tested in scenes?)
4. Check structural beats (inciting incident, midpoint, climax)
5. Check continuity (location/character/plot tracking)

Severity guide:
- red: structural problem, must fix (protagonist absent 8 scenes, climax lower than midpoint)
- amber: craft issue, should fix (3 scenes same tension, character introduced then dropped)
- blue: opportunity (untested relationship, cuttable location)

Output: JSON array of 3-7 findings per act with `{severity, category, title, body, refs}`.

#### Insight Synthesis Prompt

Takes per-act findings, deduplicates, promotes/demotes severity across acts, adds cross-act findings, ranks by impact.

Output: JSON array of 5-10 final insights.

#### Relationship Inference Prompt

System prompt instructs literary analyst to:
1. Read prose excerpts, note power dynamics, emotions, subtext
2. Consider what's NOT said
3. Report current state (latest scene) if relationship evolved

Relationship types: conflict, alliance, romance, mentor, secret, family.

Output: JSON `{kind, weight (0.1-1.0), direction, reasoning, changed}` or `{kind: null}` if insufficient evidence.

#### Scene Summarization Prompt

Produces:
- Summary: 1-2 sentences capturing what changes in the scene
- Beats: 3-5 present-tense action bullet points

Output: JSON `{summary, beats}`.

#### Story Scaffolding Prompt

From premise, generates complete structure:
- Act breakdown with scene outlines (title, POV, location, tension, tag, summary)
- Character profiles (name, role, desire, flaw, arc)
- Initial relationships (source, target, kind, weight)

Tension curve guide provided: Act 1 tensions 1-4, Act 2 first half 3-6, midpoint 7-8, Act 2 second half 5-8, Act 3 climax 9-10, denouement 2-4.

Output: JSON with `{title_suggestion, genre, themes, acts[{scenes}], characters, relationships}`.

#### Validation

Each prompt module exports `validate_output(raw: str) -> parsed_data` that:
- Parses JSON
- Validates schema (correct fields, valid enums, length limits)
- On failure: retries LLM once with error appended
- On second failure: publishes `ai.error` event

### Context Engine

Dedicated `app/ai/context/` module that assembles, ranks, truncates, and formats context for each AI task.

#### Pipeline

```
Define token budget → Retrieve candidates → Rank by relevance → Truncate to budget → Format for prompt
```

#### Token Budget

Each task gets a total budget (model context window minus output reserve). Budget is allocated proportionally across sections (e.g., prose continuation: voice_sample 15%, prior_scenes 35%, current_prose 30%, character 10%, skeleton 10%).

Token counting via `tiktoken` for OpenAI, `litellm.token_counter()` for others.

#### Retrievers

- `get_scene_with_prose(scene_id)` — single scene + draft
- `get_scene_window(story_id, center_n, radius=2)` — nearby scenes with prose
- `get_act_scenes(story_id, act)` — all scenes in act (metadata, optional prose)
- `get_character_profile(character_id)` — character + appearances + edges
- `get_shared_scenes(story_id, char_a, char_b)` — scenes where both appear
- `get_story_skeleton(story_id)` — lightweight full-story overview (~2000 tokens for 60 scenes)
- `get_voice_sample(story_id, pov, max_words=3000)` — representative prose for voice matching

#### Rankers

- `rank_scenes_for_continuation`: proximity (exponential decay), POV match (2x), causal tags, same location
- `rank_scenes_for_insights`: category-aware (pacing → extreme tensions, characters → POV switches, relationships → multi-character scenes, structure → act boundaries)
- `rank_prose_excerpts_for_relationships`: interaction density (both named in paragraph, dialogue between them, one thinking about other)

Ranking uses simple heuristics (name co-occurrence, dialogue attribution), not LLM calls.

#### Truncation

- `top_k`: highest-scored items until budget exhausted
- `spread`: top item from each category, then fill remaining
- `summary_fallback`: if very tight, summarize low-ranked items into one paragraph
- Smart prose truncation: keep END for continuation, keep START for summarization

#### Assembled Output

```python
AssembledContext {
    sections: dict[str, str]       # named text blocks, formatted and truncated
    token_counts: dict[str, int]
    total_tokens: int
    budget_remaining: int
    dropped_items: list[str]       # for debugging/telemetry
}
```

#### Telemetry

Every assembly traced: span `context.assemble`, metrics for tokens used, items dropped, retrieval time.

---

## 6. Graph Generation & Evolution

### Layout Engine

Server-side Fruchterman-Reingold force-directed layout (`app/ai/graph/layout.py`).

Forces:
- **Repulsion**: all nodes repel (Coulomb's law)
- **Attraction**: connected nodes attract (Hooke's law), scaled by weight
- **Edge-kind clustering**:
  - conflict → WEAKER attraction (opponents spread apart)
  - alliance/family → STRONGER attraction (allies cluster)
  - romance → MODERATE with offset (side by side)
  - secret → VERY WEAK (hidden connections don't cluster)
- **Hub gravity**: `type="hub"` nodes get center-pull
- **Minor repulsion**: `type="minor"` nodes get edge-push to periphery
- **Pinned nodes**: author-positioned nodes are immovable anchors

`compute(nodes, edges, pinned)` → full layout (300 iterations).
`incremental_update(existing, nodes, edges, changed_ids, pinned)` → minimal disruption (50 iterations, only changed nodes + neighbors free to move).

### Temporal Graph

Graph state at any point in the timeline. At Scene N, includes only characters who have appeared and edges whose evidence comes from scenes 1..N.

Each edge has `evidence` JSONB tracking which scenes support it. Each node has `first_appearance_scene`.

Pre-computed timeline cache in Redis (`graph:{story_id}:timeline`). Invalidated from changed scene_n onward.

### Graph Evolution & Merge

Core principle: **the author is always right**. AI suggestions are proposals, not overrides.

Edge provenance: `author`, `ai_accepted`, `ai_pending`, `scaffold`.

Merge rules:
1. `provenance=author` → NEVER touch. Log AI's opinion as metadata.
2. `provenance=ai_accepted` → suggest update if AI analysis differs significantly (kind changed or weight shifted >0.3). Mark `ai_pending` for re-review.
3. `provenance=ai_pending` → update in place (fresher analysis).
4. No edge exists → create with `ai_pending`. Frontend shows dashed/ghosted with accept/reject.
5. AI finds NO relationship for existing `ai_pending` edge → remove suggestion. Never remove `author` or `ai_accepted`.

Merge result: `{added, updated, removed, skipped, conflicts}`.

### Graph Generator

- `from_scaffold(characters, relationships)` → nodes + edges (provenance=scaffold) + layout
- `from_characters_only(characters)` → nodes, no edges, even spread
- `add_character_to_graph(character)` → least crowded area + incremental update
- `remove_character_from_graph(character_id)` → remove node + edges + incremental update

### Graph API Endpoints

```
GET  /api/stories/{id}/graph                    ?at_scene=N
GET  /api/stories/{id}/graph/suggestions
POST /api/stories/{id}/graph/suggestions/{id}/accept
POST /api/stories/{id}/graph/suggestions/{id}/reject
PUT  /api/stories/{id}/graph/nodes/{id}         (position update)
POST /api/stories/{id}/graph/edges
PUT  /api/stories/{id}/graph/edges/{id}
DELETE /api/stories/{id}/graph/edges/{id}
POST /api/stories/{id}/graph/re-layout
POST /api/stories/{id}/ai/relationships         (trigger AI inference)
```

### Caching

- Full graph: `graph:{story_id}:current` in Redis. Invalidated on node/edge mutation.
- Temporal timeline: `graph:{story_id}:timeline`. Invalidated from changed scene onward.
- Positions: persisted in DB. Only recomputed on explicit request or structure change.

---

## 7. Visualization Computation Engine

### Tension Curve Engine (`services/analytics/tension.py`)

- Cubic spline interpolation between scene tension values
- Savitzky-Golay smoothing (window=7, polyorder=3) for noise reduction
- Peak detection via `scipy.signal.find_peaks` (prominence >= 2.0, distance >= 3)
- Peak labeling by position: first 25% → "Inciting incident", 40-60% → "Midpoint", last 30% highest → "Climax", secondary → "Crisis"
- Valley detection (inverted peak finding)
- Act boundary computation from scene groupings
- Tension metrics: mean, std, max, min, range, climax_position, monotonicity (Pearson correlation of tension vs scene index)

### Pacing Analyzer (`services/analytics/pacing.py`)

- **Velocity**: first derivative (rate of tension change per scene). Labels: rising, falling, flat, spike (>=3), drop (<=-3)
- **Acceleration**: second derivative (is change accelerating?)
- **Flatline detection**: consecutive scenes with tension varying <= 1, minimum 3 scenes
- **Whiplash detection**: adjacent scenes with tension jumps > 4 points
- **Breathing room**: after each peak (>=7), check for valley (<=4) within 3 scenes
- **Act pacing**: average tension and range per act
- **Scene length variance**: word count distribution across scenes

### Character Presence Matrix (`services/analytics/presence.py`)

- Binary matrix: characters × scenes. Values: 0=absent, 1=mentioned, 2=POV
- Presence determined by: POV match, name substring in prose, scene metadata
- Per-character stats: scene_count, pov_count, coverage (0-1), longest_gap, gap_positions, first/last appearance, act_distribution, concentration (Gini coefficient of inter-appearance intervals)
- POV balance: distribution, dominant_pov, balance_score, longest_streak, alternation_rate

### Character Arc Computation (`services/analytics/arcs.py`)

- Filter scenes where character is present, extract tension values
- Interpolate to smooth curve
- Alignment: Pearson correlation with overall tension curve
- Arc shape classification via linear regression + peak analysis: "rise", "fall", "rise-fall", "fall-rise", "flat", "wave"
- Arc comparison: correlation between two characters' arcs, divergence points

### Story Health Score (`services/analytics/health.py`)

Composite 0-100 score from weighted components:

| Component | Weight | Scoring |
|-----------|--------|---------|
| Completion | 0.20 | word_progress * 0.6 + scene_coverage * 0.4 |
| Pacing | 0.20 | 100 - flatline penalties - whiplash penalties + breathing bonuses |
| Character coverage | 0.20 | pov_balance * 0.4 + coverage * 0.4 + gap_bonus * 0.2 |
| Relationship density | 0.15 | density * 0.5 + variety * 0.3 + orphan_bonus * 0.2 |
| Structural integrity | 0.15 | checks_passed / 4 (inciting incident, midpoint, climax, resolution) |
| Issue load | 0.10 | 100 - (20 * red_count) - (10 * amber_count) - (5 * blue_count) |

Grade: A (90+), B (75+), C (60+), D (40+), F (<40).

### Sparkline Downsampling (`services/analytics/sparkline.py`)

Largest-Triangle-Three-Buckets (LTTB) algorithm for downsampling to fixed-length arrays (default 12 points). Preserves visual peaks better than averaging.

### Timeline Heatmap

Multi-metric grid, each normalized 0-1:
1. Tension: scene.tension / 10
2. Word density: word count / max
3. Character density: characters present / max
4. POV freshness: 1.0 if POV unused for 3+ scenes, decay for repeated POV
5. Dialogue ratio: lines with quotes / total lines
6. Location variety: 1.0 if new location, 0.0 if same as previous

### Analytics Caching

```
Redis key: analytics:{story_id}:{metric_name}
TTL: none (explicit invalidation)

Invalidation:
  Scene change → tension-curve, pacing, heatmap, presence, arcs, health, sparkline
  Character change → presence, arcs, health
  Edge change → health
  Draft change → heatmap, presence, health
  Insight change → health

Lazy recompute on first request after invalidation.
```

---

## 8. Celery Tasks & Background Jobs

### Task Categories

- **Immediate** (sync in request): simple CRUD, < 100ms
- **Deferred** (Celery task): AI generation, export, email
- **Scheduled** (Celery Beat): periodic re-analysis, cache warming

### AI Tasks (`tasks/ai_tasks.py`)

- `generate_insights(story_id, org_id)` — full story analysis, 30-90s
- `continue_prose(story_id, scene_id, org_id)` — streaming prose, 5-15s
- `infer_relationships(story_id, org_id)` — all character pairs, 15-60s
- `summarize_scene(story_id, scene_id, org_id)` — single scene, 3-8s
- `scaffold_story(story_id, premise, structure, target_words, genres, characters, org_id)` — full scaffold, 30-120s

All tasks: `bind=True, max_retries=3, retry_backoff=True`.

### Export Tasks (`tasks/export_tasks.py`)

- `generate_export(job_id, story_id, format, options, org_id)` — load data, run exporter, upload to S3, 5-30s

### Maintenance Tasks (`tasks/maintenance.py`)

- `warm_analytics_cache()` — re-compute for recently edited stories, every 30 min
- `cleanup_expired_exports()` — delete S3 files older than 7 days, daily at 3 AM

### Queue Routing

| Queue | Tasks | Concurrency |
|-------|-------|-------------|
| ai_fast | continue_prose, summarize_scene | 4 |
| ai_heavy | generate_insights, infer_relationships, scaffold_story | 2 |
| export | generate_export | 2 |
| maintenance | warm_analytics_cache, cleanup_expired_exports | 1 |

### Celery Config

- `task_track_started: True`
- `task_time_limit: 300` (hard kill 5 min)
- `task_soft_time_limit: 240` (SoftTimeLimitExceeded at 4 min)
- `worker_prefetch_multiplier: 1` (fair scheduling for long tasks)
- `task_acks_late: True` (crash safety)

### Error Handling

- `RateLimitError` → retry with 60s countdown
- `SoftTimeLimitExceeded` → publish partial results if available, `ai.error` event
- Unexpected errors → log with trace context, publish `ai.error`, retry if under max_retries

### Progress Pattern

All tasks publish to Redis pub/sub:

```python
redis.publish(f"story:{story_id}:events", json.dumps({"type": event_type, "data": data}))
```

---

## 9. Export Engine

### Interface

```python
class BaseExporter(ABC):
    def export(self, story, chapters, settings, options, on_progress=None) -> ExportResult:
        ...

class ExportOptions:
    include_title_page: bool = True
    include_chapter_headers: bool = True
    include_scene_breaks: bool = True
    include_author_bio: bool = False
    page_size: str = "letter"        # letter | a4
    font_family: str = "serif"       # serif | sans | mono
    font_size: int = 12
    line_spacing: float = 1.5
    margins: dict = None

class ExportResult:
    file_bytes: bytes
    filename: str
    content_type: str
    page_count: int | None
    word_count: int
```

### PDF Exporter (ReportLab)

Standard manuscript format: title page (title, author, word count), chapter starts on new page, 12pt serif double-spaced, 1-inch margins, `# # #` scene breaks, running header with "Author / TITLE / Page N".

### DOCX Exporter (python-docx)

Word styles for body, chapter number, chapter title, scene break. Standard manuscript page setup. Editors can modify in Word/Google Docs.

### ePub Exporter (ebooklib)

ePub 3 with metadata, table of contents, CSS-styled HTML chapters, scene break markers.

### Plain Text Exporter

Title + author header, `CHAPTER N: TITLE` headers, `* * *` scene breaks, clean UTF-8 text.

### Registry

```python
EXPORTERS = {"pdf": PDFExporter, "docx": DOCXExporter, "epub": EPUBExporter, "plaintext": PlainTextExporter}
```

---

## 10. Docker Compose & Infrastructure

### Services

| Service | Image | Ports | Purpose |
|---------|-------|-------|---------|
| api | backend Dockerfile (api target) | 8000 | FastAPI app |
| worker-fast | backend Dockerfile (worker target) | — | Celery ai_fast queue |
| worker-heavy | backend Dockerfile (worker target) | — | Celery ai_heavy queue |
| worker-export | backend Dockerfile (worker target) | — | Celery export queue |
| worker-maintenance | backend Dockerfile (worker target) | — | Celery maintenance queue |
| beat | backend Dockerfile (worker target) | — | Celery Beat scheduler |
| postgres | postgres:16-alpine | 5432 | Database |
| redis | redis:7-alpine | 6379 | Cache/broker |
| minio | minio/minio:latest | 9000, 9001 | S3-compatible storage |
| minio-setup | minio/mc:latest | — | Create buckets on first run |
| jaeger | jaegertracing/all-in-one:latest | 16686, 4317, 4318 | Trace collector + UI |

### Dockerfile

Multi-stage build with UV:
- Base: python:3.12-slim, install UV, `uv sync --frozen`
- API target: expose 8000, run uvicorn
- Worker target: run celery

### Configuration

All via environment variables, loaded by `pydantic-settings` from `.env`.

Categories: Database, Redis, S3, Auth (JWT + OAuth), AI (model config + API keys), Telemetry, App (CORS, environment).

### Dependencies (`pyproject.toml`)

Core: fastapi, uvicorn, sqlalchemy[asyncio], asyncpg, alembic, python-jose, passlib[bcrypt], httpx, langgraph, litellm, tiktoken, celery[redis], redis, reportlab, python-docx, ebooklib, boto3, opentelemetry-*, structlog, pydantic-settings, numpy, scipy.

Dev: pytest, pytest-asyncio, pytest-cov, httpx, factory-boy, faker, ruff, mypy.

---

## 11. Telemetry & Observability

### Setup

OpenTelemetry SDK initialized during FastAPI lifespan. Auto-instruments: FastAPI, SQLAlchemy, httpx, Celery.

### Traces

Custom spans via `@traced` decorator. Pre-built helpers: `trace_ai_call(model, task_type, tokens_in, tokens_out)`, `trace_db_query(table, operation, row_count)`.

### Metrics

| Metric | Type | Purpose |
|--------|------|---------|
| http.request.duration | histogram | API latency |
| sse.connections.active | up_down_counter | Open SSE connections |
| ai.task.duration | histogram | AI execution time |
| ai.tokens.total | counter | Total LLM tokens |
| ai.tokens.cost | counter | Estimated cost in USD |
| ai.task.errors | counter | AI failures by type |
| context.assembly.duration | histogram | Context building time |
| context.tokens.used | histogram | Tokens in assembled context |
| context.items.dropped | counter | Context dropped by budget |
| export.duration | histogram | Export generation time |
| export.file.size | histogram | Export file size |
| graph.layout.duration | histogram | Layout computation time |
| graph.nodes | histogram | Nodes in computed graph |
| analytics.compute.duration | histogram | Analytics computation time |
| analytics.cache.hit | counter | Cache hits |
| analytics.cache.miss | counter | Cache misses |

### Structured Logging

structlog with JSON output. OpenTelemetry `trace_id` and `span_id` injected into every log entry for trace-log correlation.

### Local Dev

Jaeger at `http://localhost:16686` for viewing traces. Logs to stdout in JSON format.
