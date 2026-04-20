# BeatLume API Reference

Base URL: `http://localhost:8000`

All endpoints return JSON. Authenticated endpoints require `Authorization: Bearer {token}` header.

## Authentication

### POST /auth/signup

Create a new account. Returns access token + sets refresh cookie.

**Request:**
```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "securepass123"
}
```

**Validation:** Password 8-72 chars. Email must contain `@`. Name cannot be empty.

**Response (201):**
```json
{
  "access_token": "eyJhbG...",
  "token_type": "bearer"
}
```

Also sets `refresh_token` httpOnly cookie.

**Errors:** `409` email already registered.

**Rate limited:** 5 requests/minute per IP.

---

### POST /auth/login

**Request:**
```json
{
  "email": "ada@example.com",
  "password": "securepass123"
}
```

**Response (200):** Same as signup.

**Errors:** `401` invalid email or password.

**Rate limited:** 5 requests/minute per IP.

---

### POST /auth/refresh

Rotate access token using the refresh cookie.

**Request:** No body. Refresh token sent automatically via cookie.

**Response (200):** New access token + new refresh cookie.

---

### POST /auth/logout

Clear refresh cookie.

**Response:** `204 No Content`

---

### GET /auth/oauth/{provider}

Get OAuth redirect URL. Provider: `google` or `github`.

**Response (200):**
```json
{
  "redirect_url": "https://accounts.google.com/o/oauth2/..."
}
```

**Errors:** `501` provider not configured.

---

### GET /auth/callback/{provider}?code={code}

Exchange OAuth code for tokens. Called by OAuth provider redirect.

**Response (200):** Same as login.

---

### POST /auth/forgot-password

```json
{ "email": "ada@example.com" }
```

**Response (200):** Always returns success (prevents email enumeration).

---

### POST /auth/reset-password

```json
{ "token": "reset-jwt-token", "new_password": "newpass123" }
```

---

## Users

### GET /api/users/me

**Auth required.**

**Response (200):**
```json
{
  "id": "uuid",
  "email": "ada@example.com",
  "name": "Ada Lovelace",
  "avatar_url": null,
  "plan": "free"
}
```

---

### PUT /api/users/me

**Auth required.**

```json
{ "name": "Ada Byron Lovelace", "avatar_url": "https://..." }
```

---

### GET /api/users/me/organizations

**Auth required.** Returns list of organizations the user belongs to.

---

## Stories

### GET /api/stories?offset=0&limit=50

**Auth required.** List stories in the user's organization.

**Response (200):**
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "A Stranger in the Orchard",
      "genres": ["Literary", "Mystery"],
      "target_words": 90000,
      "draft_number": 3,
      "status": "in_progress",
      "structure_type": "3-act"
    }
  ],
  "total": 1
}
```

---

### POST /api/stories

**Auth required.**

```json
{
  "title": "My Novel",
  "genres": ["Literary"],
  "target_words": 80000,
  "structure_type": "3-act"
}
```

**Response:** `201` with created story.

---

### GET /api/stories/{storyId}

### PUT /api/stories/{storyId}

### DELETE /api/stories/{storyId}

Standard CRUD. DELETE returns `204`.

---

## Scenes

All scoped under `/api/stories/{storyId}/scenes`.

### GET /api/stories/{storyId}/scenes?act=1&pov=Iris&sort=tension&offset=0&limit=50

Filter by `act` (int), `pov` (string), sort by `tension`/`pov`/default (scene number).

**Response (200):**
```json
{
  "items": [
    {
      "id": "uuid",
      "story_id": "uuid",
      "n": 1,
      "title": "Orchard at dawn",
      "pov": "Iris",
      "tension": 3,
      "act": 1,
      "location": "The Orchard",
      "tag": "setup",
      "summary": null
    }
  ],
  "total": 13
}
```

---

### POST /api/stories/{storyId}/scenes

Scene number `n` auto-increments.

```json
{
  "title": "New Scene",
  "pov": "Iris",
  "tension": 5,
  "act": 2,
  "location": "Town square",
  "tag": "rising"
}
```

---

### GET /PUT /DELETE /api/stories/{storyId}/scenes/{sceneId}

Standard CRUD by UUID.

---

## Characters

All scoped under `/api/stories/{storyId}/characters`.

### GET /api/stories/{storyId}/characters?offset=0&limit=50

**Response (200):**
```json
{
  "items": [
    {
      "id": "uuid",
      "story_id": "uuid",
      "name": "Iris",
      "role": "Protagonist",
      "desire": "To understand why Wren left",
      "flaw": "Cannot trust anyone fully",
      "scene_count": 12,
      "longest_gap": 2
    }
  ],
  "total": 10
}
```

---

### POST /PUT /DELETE — standard CRUD

---

## Graph

### GET /api/stories/{storyId}/graph

**Response (200):**
```json
{
  "nodes": [
    {
      "id": "uuid",
      "character_id": "uuid",
      "x": 400.0,
      "y": 300.0,
      "label": "Iris",
      "initials": "IR",
      "node_type": "hub",
      "first_appearance_scene": 1
    }
  ],
  "edges": [
    {
      "id": "uuid",
      "source_node_id": "uuid",
      "target_node_id": "uuid",
      "kind": "conflict",
      "weight": 0.8,
      "provenance": "author",
      "evidence": [{"scene_n": 3, "type": "dialogue"}],
      "first_evidenced_scene": 3
    }
  ]
}
```

---

### PUT /api/stories/{storyId}/graph/nodes/{nodeId}

Update node position (drag and drop).

```json
{ "x": 450.0, "y": 280.0 }
```

---

### POST /api/stories/{storyId}/graph/edges

```json
{
  "source_node_id": "uuid",
  "target_node_id": "uuid",
  "kind": "alliance",
  "weight": 0.6
}
```

---

### PUT /DELETE /api/stories/{storyId}/graph/edges/{edgeId}

---

## Insights

### GET /api/stories/{storyId}/insights?category=Pacing&severity=red&offset=0&limit=50

**Response (200):**
```json
{
  "items": [
    {
      "id": "uuid",
      "severity": "red",
      "category": "Pacing",
      "title": "Tension flatline in Act 2",
      "body": "Scenes 6-9 have nearly identical tension levels...",
      "refs": ["S06", "S07", "S08", "S09"],
      "dismissed": false
    }
  ],
  "total": 5
}
```

---

### PUT /api/stories/{storyId}/insights/{insightId}/dismiss

---

## Draft

### GET /api/stories/{storyId}/draft/{sceneId}

**Response (200):**
```json
{
  "id": "uuid",
  "scene_id": "uuid",
  "content": "The orchard was quiet at dawn...",
  "word_count": 342
}
```

---

### PUT /api/stories/{storyId}/draft/{sceneId}

```json
{ "content": "Updated prose text..." }
```

Word count computed automatically on save.

---

## Core Config

### GET /api/stories/{storyId}/core/tree

Returns story structure tree (acts, chapters, scenes, beats).

### PUT /api/stories/{storyId}/core/tree/{nodeId}

### GET /api/stories/{storyId}/core/settings

Returns story metadata settings (title, author, genre, POV, tense, etc.).

### PUT /api/stories/{storyId}/core/settings/{key}

```json
{ "value": "new value" }
```

---

## Manuscript

### GET /api/stories/{storyId}/manuscript

Returns all chapters ordered by sort_order.

### GET /PUT /api/stories/{storyId}/manuscript/{num}

---

## Collaboration

### GET /api/stories/{storyId}/collaborators

### GET /api/stories/{storyId}/comments?scene_id={sceneId}

### POST /api/stories/{storyId}/comments

```json
{ "body": "This pacing feels off", "scene_id": "uuid-or-null" }
```

### GET /api/stories/{storyId}/activity

Returns last 50 activity events.

---

## Analytics

### GET /api/stories/{storyId}/analytics/tension-curve

Cubic-spline interpolated tension curve with peak detection.

### GET /api/stories/{storyId}/analytics/pacing

Pacing analysis: velocity, flatlines, whiplash, breathing room.

### GET /api/stories/{storyId}/analytics/presence

Character x scene presence matrix.

### GET /api/stories/{storyId}/analytics/arcs

Per-character tension arcs with shape classification.

### GET /api/stories/{storyId}/analytics/health

Composite 0-100 health score with A-F grade.

### GET /api/stories/{storyId}/analytics/sparkline

LTTB-downsampled tension sparkline (12 points).

---

## AI Triggers

All return `202 Accepted` with `{ "task_id": "celery-task-id" }`. Results delivered via SSE.

### POST /api/stories/{storyId}/insights/generate

Trigger full story insight analysis.

### POST /api/stories/{storyId}/draft/{sceneId}/ai-continue

Trigger AI prose continuation for a scene.

### POST /api/stories/{storyId}/ai/relationships

Trigger relationship inference across all character pairs.

### POST /api/stories/{storyId}/ai/summarize/{sceneId}

Trigger scene summarization.

### POST /api/stories/{storyId}/ai/scaffold

```json
{
  "premise": "A woman returns to her hometown orchard...",
  "structure_type": "3-act",
  "target_words": 80000,
  "genres": ["Literary"],
  "characters": [{"name": "Iris", "role": "Protagonist", "description": "..."}]
}
```

---

## Export

### POST /api/stories/{storyId}/export

```json
{
  "format": "pdf",
  "options": {
    "include_title_page": true,
    "include_chapter_headers": true,
    "font_family": "serif"
  }
}
```

**Response (202):** `{ "task_id": "..." }`

### GET /api/stories/{storyId}/export/{jobId}

Poll export status. Returns download URL when complete.

---

## SSE (Server-Sent Events)

### GET /api/stories/{storyId}/events?token={accessToken}

Real-time event stream. Token passed as query param (EventSource can't set headers).

**Event types:**

```
event: ai.progress
data: {"task_id": "...", "type": "prose_continuation", "status": "running"}

event: ai.complete
data: {"task_id": "...", "type": "insight_generation"}

event: ai.error
data: {"task_id": "...", "error": "Rate limit exceeded"}

event: export.progress
data: {"job_id": "...", "percent": 65}

event: export.complete
data: {"job_id": "...", "download_url": "..."}

event: activity
data: {"user": "Wren", "action": "added_scene"}

event: comment
data: {"user": "Kai", "body": "..."}
```

---

## Response Conventions

| Operation | Status | Body |
|-----------|--------|------|
| List | 200 | `{ items: [...], total: int }` |
| Create | 201 | Created resource |
| Update | 200 | Updated resource |
| Delete | 204 | No body |
| Async trigger | 202 | `{ task_id: "..." }` |
| Error | 4xx/5xx | `{ detail: "message", code: "error_code" }` |

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| POST /auth/login | 5/minute per IP |
| POST /auth/signup | 5/minute per IP |
| All other endpoints | No limit (add in production) |

## Health Check

### GET /health

Returns `200` if all dependencies are healthy, `503` if degraded.

```json
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```
