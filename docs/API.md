# BeatLume API Guide

This document describes the current HTTP API shape, the async task pattern, and the SSE event model used by the frontend.

For implementation details, read [ARCHITECTURE.md](./ARCHITECTURE.md). For day-to-day contributor workflow, read [DEVELOPMENT.md](./DEVELOPMENT.md).

## Base URL

Local development:

```text
http://localhost:8000
```

## Authentication Model

BeatLume uses:

- bearer access tokens for authenticated API calls
- refresh tokens via `httpOnly` cookie
- short-lived story-scoped SSE tokens for browser `EventSource` connections

Authenticated requests send:

```http
Authorization: Bearer <access-token>
```

## Common API Conventions

### IDs

All primary entities use UUIDs.

### Response Shapes

Common patterns:

- single resource: JSON object
- paginated list: `{ "items": [...], "total": 123 }`
- async task trigger: `{ "task_id": "<celery-task-id>" }`
- delete: `204 No Content`

### Errors

Typical error shape:

```json
{
  "detail": "Human-readable explanation",
  "code": "internal_error"
}
```

Some endpoints only return `detail`.

### Story Scoping

Most product routes are story-scoped:

```text
/api/stories/{story_id}/...
```

The backend resolves the story through request dependencies and relies on org-scoped RLS for data isolation.

## Async Task Pattern

AI and export work do not complete in the request/response cycle. The API returns `202 Accepted` and a `task_id`, then progress and completion are delivered through SSE.

Main async trigger routes:

- `POST /api/stories/{story_id}/insights/generate`
- `POST /api/stories/{story_id}/insights/{insight_id}/apply`
- `POST /api/stories/{story_id}/draft/{scene_id}/ai-continue`
- `POST /api/stories/{story_id}/ai/relationships`
- `POST /api/stories/{story_id}/ai/summarize/{scene_id}`
- `POST /api/stories/{story_id}/ai/scaffold`
- `POST /api/stories/{story_id}/ai/generate-manuscript`
- `POST /api/stories/{story_id}/export`

Standard response:

```json
{
  "task_id": "6f6f2511-8d1e-4901-97a1-9e78d8b3f149"
}
```

## SSE Event Model

### Get A Story-Scoped SSE Token

```http
POST /api/stories/{story_id}/events/token
Authorization: Bearer <access-token>
```

Response:

```json
{
  "token": "<short-lived-sse-token>",
  "expires_in": 3600
}
```

### Open The Event Stream

Browser clients connect with:

```text
GET /api/stories/{story_id}/events?sse_token=<token>
```

Non-browser clients can use the bearer token in the `Authorization` header instead.

### Event Types

The frontend currently listens for:

- `ai.progress`
- `ai.chunk`
- `ai.complete`
- `ai.error`
- `export.complete`
- `activity`
- `comment`

Example event frame:

```text
event: ai.progress
data: {"task_id":"...","type":"full_manuscript","status":"running","current":3,"total":12}
```

The SSE endpoint also emits keepalive comments when idle.

## Route Groups

### Auth

Routes under `/auth`:

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/oauth/{provider}`
- `GET /auth/callback/{provider}`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

Notes:

- login and signup are rate-limited
- OAuth providers currently include `google` and `github`
- refresh rotates the access token using the refresh cookie

### Users

Routes under `/api/users`:

- `GET /api/users/me`
- `PUT /api/users/me`
- `GET /api/users/me/organizations`

### Stories

Routes under `/api/stories`:

- `GET /api/stories`
- `POST /api/stories`
- `GET /api/stories/{story_id}`
- `PUT /api/stories/{story_id}`
- `DELETE /api/stories/{story_id}`
- `POST /api/stories/{story_id}/duplicate`

List query params:

- `offset`
- `limit`
- `include_archived`
- `only_archived`

Create/update fields include:

- `title`
- `logline`
- `genres`
- `subgenre`
- `themes`
- `target_words`
- `structure_type`
- `story_type`
- `archived`
- `draft_number`
- `status`

Example create payload:

```json
{
  "title": "The Orchard Keeps Its Secrets",
  "logline": "A grieving archivist returns home and finds the town rewriting its own history.",
  "genres": ["Literary", "Mystery"],
  "subgenre": "Gothic",
  "themes": ["memory", "grief", "inheritance"],
  "target_words": 80000,
  "structure_type": "3-act",
  "story_type": "novel"
}
```

### Scenes

Routes under `/api/stories/{story_id}/scenes`:

- `GET /api/stories/{story_id}/scenes`
- `POST /api/stories/{story_id}/scenes`
- `PATCH /api/stories/{story_id}/scenes/reorder`
- `GET /api/stories/{story_id}/scenes/{scene_id}`
- `PUT /api/stories/{story_id}/scenes/{scene_id}`
- `DELETE /api/stories/{story_id}/scenes/{scene_id}`

Common scene fields:

- `title`
- `summary`
- `pov`
- `tension`
- `act`
- `location`
- `tag`
- analytic facets such as `emotional`, `stakes`, `mystery`, `romance`, `danger`, `hope`

List query params include:

- `act`
- `pov`
- `sort`
- `offset`
- `limit`

### Beats

Routes under `/api/stories/{story_id}/scenes/{scene_id}/beats`:

- `GET`
- `POST`
- `PATCH /reorder`
- `GET /{beat_id}`
- `PUT /{beat_id}`
- `DELETE /{beat_id}`

Beats are optional micro-structure inside a scene. Reorder is explicit instead of inferred from array order in the client.

### Characters

Routes under `/api/stories/{story_id}/characters`:

- `GET`
- `POST`
- `GET /{character_id}`
- `PUT /{character_id}`
- `DELETE /{character_id}`

Character fields commonly include:

- `name`
- `role`
- `desire`
- `flaw`
- `arc_summary`

### Graph

Routes under `/api/stories/{story_id}/graph`:

- `GET`
- `PUT /nodes/{node_id}`
- `POST /edges`
- `PUT /edges/{edge_id}`
- `DELETE /edges/{edge_id}`

The graph API manages relationship nodes and edges, including edge kinds such as conflict, alliance, romance, mentor, family, and secret depending on story state.

### Insights

Routes under `/api/stories/{story_id}/insights`:

- `GET`
- `POST /generate`
- `POST /{insight_id}/apply`
- `PUT /{insight_id}/dismiss`
- `PUT /{insight_id}/restore`

List query params:

- `category`
- `severity`
- `offset`
- `limit`
- `include_dismissed`
- `only_dismissed`

The insight flow is intentionally split:

1. generate explainable recommendations
2. inspect them in the UI
3. optionally apply a recommendation back into scenes, draft, or manuscript data

### Draft

Routes under `/api/stories/{story_id}/draft`:

- `GET /{scene_id}`
- `PUT /{scene_id}`
- `POST /{scene_id}/ai-continue`

This is the scene-level prose surface. `ai-continue` is async and streams partial text over SSE through `ai.chunk` events.

### Core Configuration

Routes under `/api/stories/{story_id}/core`:

- `GET /tree`
- `PUT /tree/{node_id}`
- `GET /settings`
- `GET /settings/raw`
- `POST /settings`
- `PUT /settings/{key}`
- `DELETE /settings/{key}`

This API supports story-level defaults and inherited settings across the story tree. It is the continuity/configuration layer used by AI prompt assembly and editor-facing configuration.

### Manuscript

Routes under `/api/stories/{story_id}/manuscript`:

- `GET`
- `GET /{num}`
- `PUT /{num}`

The manuscript API is chapter-oriented. It sits above per-scene drafts and is what export uses first when chapters are present.

### Collaboration

Story collaboration routes:

- `GET /api/stories/{story_id}/collaborators`
- `POST /api/stories/{story_id}/collaborators`
- `DELETE /api/stories/{story_id}/collaborators/{collaborator_id}`
- `GET /api/stories/{story_id}/comments`
- `POST /api/stories/{story_id}/comments`
- `PUT /api/stories/{story_id}/comments/{comment_id}`
- `DELETE /api/stories/{story_id}/comments/{comment_id}`
- `GET /api/stories/{story_id}/activity`

### Analytics

Routes under `/api/stories/{story_id}/analytics`:

- `GET /tension-curve`
- `GET /pacing`
- `GET /presence`
- `GET /arcs`
- `GET /health`
- `GET /sparkline`

Facet-aware endpoints accept a `facet` query param where supported. Current facet options come from scene-level metrics:

- `emotional`
- `stakes`
- `mystery`
- `romance`
- `danger`
- `hope`

Health aggregates manuscript completion and structural signals rather than returning only a chart primitive.

### AI

Routes:

- `POST /api/stories/{story_id}/insights/generate`
- `POST /api/stories/{story_id}/draft/{scene_id}/ai-continue`
- `POST /api/stories/{story_id}/ai/relationships`
- `POST /api/stories/{story_id}/ai/summarize/{scene_id}`
- `POST /api/stories/{story_id}/ai/scaffold`
- `POST /api/stories/{story_id}/ai/generate-manuscript`

#### Scaffold Request

```json
{
  "premise": "A mapmaker discovers her city has been redrawn around erased crimes.",
  "structure_type": "3-act",
  "target_words": 80000,
  "genres": ["Fantasy", "Mystery"],
  "characters": [
    {
      "name": "Mara",
      "role": "Protagonist"
    }
  ],
  "replace_existing": false
}
```

Behavior:

- returns `409` if scenes already exist and `replace_existing` is false
- can replace prior scaffolded scene structure
- persists scenes, characters, and relationship edges

#### Generate Manuscript Request

```json
{
  "skip_non_empty": true,
  "max_scenes": null,
  "act": null,
  "min_scene_n": null
}
```

Behavior:

- drafts scenes in order
- can resume long runs from a scene number
- can scope to a specific act
- can leave existing prose untouched

### Export

Routes under `/api/stories/{story_id}/export`:

- `POST /api/stories/{story_id}/export`
- `GET /api/stories/{story_id}/export/{job_id}`

Supported formats:

- `pdf`
- `docx`
- `epub`
- `plaintext`

Example request:

```json
{
  "format": "docx",
  "options": {}
}
```

The export service prefers chapter data from `manuscript_chapters`; if no manuscript chapters exist, it assembles exportable chapter content from scene drafts.

## Health Endpoint

```http
GET /health
```

Returns:

- `200` when database and Redis checks pass
- `503` when one or more dependencies are degraded

Example response:

```json
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

## Frontend Integration Notes

The frontend mirrors the API by domain:

- `frontend/src/api/stories.ts`
- `frontend/src/api/scenes.ts`
- `frontend/src/api/beats.ts`
- `frontend/src/api/characters.ts`
- `frontend/src/api/graph.ts`
- `frontend/src/api/insights.ts`
- `frontend/src/api/ai.ts`
- `frontend/src/api/draft.ts`
- `frontend/src/api/core.ts`
- `frontend/src/api/manuscript.ts`
- `frontend/src/api/collaboration.ts`
- `frontend/src/api/analytics.ts`
- `frontend/src/api/export.ts`

If you add or change an endpoint, update the corresponding hook module and cache invalidation logic.
