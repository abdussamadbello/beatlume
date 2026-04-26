# AI Slideout — Story Chat with Action Tools

## Overview

Add a **Chat tab** to the existing AI slideout panel, alongside the current Tasks tab. The slideout is already mounted only inside the story-scoped layout (`/stories/$storyId`), so it is structurally story-scoped today.

Chat threads are persistent per-story, auto-aware of the active scene, and the AI gets a curated tool surface: **read tools** (auto-executed, no approval) plus **write tools** (always rendered as inline approval cards in the thread, never auto-applied).

This is a single combined design covering both the chat infrastructure (persistent threads, message streaming, history) and the action layer (tool-calling with preview/approval). Both ship together.

## Decisions on file

These were settled during brainstorming and are intentionally fixed; revisiting them changes the shape of the design.

| Decision | Choice |
|---|---|
| Thread scoping | **Story-level only**, auto-aware of active scene |
| Tool surface | **Curated writes + read tools** (no deletes, no destructive ops) |
| Approval pattern | Reads silent; writes always preview as inline cards; rejected cards stay visible to the AI on its next turn |
| Initial context | **Adaptive**: medium tier (premise + scene flat list + character roster) refreshed each turn + active scene draft if `active_scene_id` set |

## Frontend

### Slideout layout

`AIPanel` becomes a tabbed shell, defaulting to **Chat** on open:

```
[ Chat · 2 | Tasks · 3 ]              ×
──────────────────────────────────────
( story-level chat · also using scene 7 )
──────────────────────────────────────
... messages stream ...
──────────────────────────────────────
[ composer textarea ]              [send]
```

- Width: bumped from 360 → **420px** for both tabs.
- Tabs persist across story navigation (Zustand state).
- FAB badge unifies: in-flight tasks + unseen completed tasks + unread assistant messages across all threads in the current story.

### State (Zustand)

Add to the existing UI slice in `frontend/src/store.ts`:

- `aiPanelTab: 'chat' | 'tasks'` (default `'chat'`)
- `setAIPanelTab(tab)`

Chat threads and messages live in the **TanStack Query cache**, not Zustand. Only ephemeral UI state (selected thread id, composer draft text per thread) lives in Zustand.

### New components

All under `frontend/src/components/ai/chat/`:

- `ChatTab.tsx` — orchestrator; renders empty state / thread list / active thread based on selection
- `ChatThreadList.tsx` — compact thread list (title, last message preview, last activity time)
- `ChatThread.tsx` — active thread shell (header + message stream + composer)
- `ChatMessage.tsx` — user / assistant message rendering
- `ChatToolCard.tsx` — tool-call cards with Apply / Reject for writes; rejected cards stay visible
- `ChatComposer.tsx` — textarea + send button + active-scene indicator
- `frontend/src/api/chat.ts` — TanStack Query hooks (threads, messages, send, apply, reject)

Empty state: CTA "Start a chat about this story" + 3 suggested prompts (e.g., "Find plot inconsistencies", "Suggest a midpoint twist", "Help me develop a character").

### Streaming

Extend `frontend/src/hooks/useSSE.ts` with new event types:

- `chat.user.persisted` — confirms the user's message landed in the DB (payload includes the canonical message id)
- `chat.message.delta` — assistant token delta for an in-flight assistant message
- `chat.tool_call.proposed` — write tool proposed; renders as approval card
- `chat.tool.executed` — read tool finished (silent; for telemetry / debug only)
- `chat.message.complete` — assistant turn finalized

The frontend reconstructs the assistant message from the event stream and writes it into the TanStack Query cache. On disconnect, the frontend re-fetches the thread to recover state.

### Active scene awareness

`ChatThread.tsx` header shows: `Story-level chat — also using **scene 7** as context` when `activeSceneId` is set in the Zustand UI slice. This is purely visual; the actual context injection happens server-side in the chat service.

## Backend

### Database

Two new tables, both inheriting `OrgScopedMixin` and `TimestampMixin`:

Both inherit `created_at` and `updated_at` from `TimestampMixin` and `org_id` (with RLS) from `OrgScopedMixin`. Only the table-specific columns are shown below.

```
chat_threads
  id (UUID, PK)
  story_id (UUID, FK stories, ON DELETE CASCADE)
  title (TEXT, nullable — auto-generated from first turn)
  archived_at (TIMESTAMPTZ, nullable)

chat_messages
  id (UUID, PK)
  thread_id (UUID, FK chat_threads, ON DELETE CASCADE)
  role (ENUM 'user' | 'assistant' | 'tool')
  content (TEXT, nullable for pure tool messages)
  tool_calls (JSONB, nullable — for assistant messages with tool calls)
  tool_call_status (ENUM 'proposed' | 'applied' | 'rejected', nullable)
  tool_call_result (JSONB, nullable — diff preview, applied result, or error)
```

Note: `chat_messages.updated_at` advances when `tool_call_status` transitions from `proposed` → `applied` / `rejected`, so it doubles as the approval timestamp.

Both get RLS policies based on `app.current_org_id` following the existing `OrgScopedMixin` pattern. Indexes: `(thread_id, created_at)` for message ordering, `(story_id, archived_at)` for thread listing.

### API routes

New file `backend/app/api/chat.py`, registered in `backend/app/api/router.py`:

```
POST   /api/v1/stories/{story_id}/chat/threads          create
GET    /api/v1/stories/{story_id}/chat/threads          list (paginated)
GET    /api/v1/chat/threads/{thread_id}                 detail
DELETE /api/v1/chat/threads/{thread_id}                 soft-archive

GET    /api/v1/chat/threads/{thread_id}/messages        history (paginated)
POST   /api/v1/chat/threads/{thread_id}/messages        send user message → SSE response
       body: { content: str, active_scene_id: UUID | null }

POST   /api/v1/chat/tool_calls/{message_id}/apply       execute the proposed write
POST   /api/v1/chat/tool_calls/{message_id}/reject      mark rejected (with optional reason)
```

The send-message endpoint streams SSE rather than returning JSON, matching the existing per-task streaming pattern in the codebase.

### Service

New file `backend/app/services/chat_service.py`:

- `create_thread(story_id, org_id) -> ChatThread`
- `list_threads(story_id, org_id, ...)` and `archive_thread(thread_id)`
- `send_message(thread_id, user_text, active_scene_id) -> AsyncIterator[ChatEvent]` — orchestrates the LangGraph agent, yields stream events
- `apply_tool_call(message_id)` — executes the write by calling the existing service path (e.g., `scene_service.update_draft`); does **not** introduce parallel mutation logic
- `reject_tool_call(message_id, reason?)` — marks the card rejected; the rejection becomes part of the next-turn context so the AI sees it

### LangGraph chat agent

New file `backend/app/ai/graphs/chat_agent.py`. Tool-calling loop:

1. Build system prompt from adaptive context (medium tier + active scene if provided)
2. Append message history (last N turns within token budget)
3. Call model with tool registry attached
4. If model produces tool calls:
   - Read tools → execute, append result as role=tool message, loop back to step 3
   - Write tools → persist as proposed assistant message, yield `chat.tool_call.proposed`, **do not loop** (turn ends pending approval)
5. If model produces a final assistant message → persist, yield `chat.message.complete`

Per-turn budget: ~4k input tokens, ~1k output tokens, configurable via env. Tool errors surface as tool messages so the agent can recover.

### Tool registry

New file `backend/app/ai/tools/chat_tools.py`.

**Read tools (auto-executed, no approval):**

- `get_scene(scene_id)` — scene metadata + draft
- `list_characters()` — full roster
- `get_character(character_id)` — character + notes
- `get_scene_summaries(start, end)` — flat list of summaries within range
- `find_inconsistencies()` — calls existing insight engine in read-only mode

**Write tools (always proposed, never auto-applied):**

- `edit_scene_draft(scene_id, new_text)` → preview = unified diff against current draft (line-level, mono-rendered in the card)
- `propose_scene(after_id, summary, scene_n)` → preview = structured fields
- `update_character_note(character_id, note_text, append=True)` → preview = before/after note
- `summarize_scene(scene_id)` → reuses existing summarization service; preview = generated summary

**Architectural rule:** every write tool's apply path must call an existing service. The chat does not introduce parallel mutation logic. Anything the AI can do, the human can already do via the existing UI. This gives chat the same RLS, audit, and validation as the rest of the app for free.

**No deletes, no destructive ops** at the schema level. Constraint enforced by simply not registering those tools.

### Model tier

Add a `chat` tier to `backend/app/ai/llm.py`'s tier router. Default to a cheap tool-calling-capable model (e.g., haiku or 4o-mini), env-configurable. Insights / manuscript / scaffold continue to use their existing tiers.

### Adaptive context loading

Reuse `backend/app/ai/context/assembler.py`. Extract a reusable medium-tier loader:

- Premise (story title, logline, genres, structure type, target words)
- Flat list of all scenes (numbers, titles, one-line summaries)
- Character roster (names + roles only)
- Active scene draft (if `active_scene_id` provided in the request)

Refresh medium-tier context **every turn** (it is small) so the AI sees fresh scene titles / character roster as the user edits. Active scene draft is also fetched fresh per turn.

Existing token-budget truncation in the assembler applies; chat just becomes another consumer.

### Event flow (send-message endpoint)

1. Persist user message (role=user) → yield `chat.user.persisted`
2. Load adaptive context
3. Run agent loop:
   - Stream model tokens → yield `chat.message.delta` per token
   - Read tool call → execute, persist as role=tool, yield `chat.tool.executed`
   - Write tool call → persist as role=assistant with `tool_call_status='proposed'`, yield `chat.tool_call.proposed`
4. Persist final assistant message
5. Yield `chat.message.complete`

## Error handling

- **Tool execution failure** → tool message with `error: <code>`, agent informed and asked to recover
- **Token budget exceeded** → assembler truncates with telemetry event; the AI does not see truncation directly
- **Model rate limit** → 429 to client; frontend retries with exponential backoff
- **Apply tool call after underlying entity changed** (race) → 409 conflict; frontend re-fetches and renders a "stale preview — entity was edited" banner on the affected card
- **RLS violation on any chat resource** → 404, never 403 (don't leak existence across orgs)

## Testing

- `backend/tests/test_chat_service.py` — thread CRUD, message persistence, tool-call lifecycle (propose → apply, propose → reject), apply-after-change race
- `backend/tests/test_chat_api.py` — auth, RLS, SSE event shape, pagination
- `backend/tests/test_chat_tools.py` — each tool's read path or preview generation, invalid args, error surface
- Frontend: no component tests this round; the project does not have a frontend component test pattern yet, and adding one is out of scope for this design

## Out of scope (explicit)

- Scene-anchored threads (deferred per thread-scoping decision)
- Batch tool-call approval (deferred per approval-pattern decision)
- Mobile / narrow-viewport adaptation of the slideout
- Voice input
- Cross-story chat (would require re-architecting the context assembler)
- Streaming the diff *as* the AI generates it (preview is final-text only for v1)
- Auto-archival of old threads
- Per-user cost cap UI (cost tracked server-side; surfaced later)

## Files

**New (backend):**

- `backend/app/api/chat.py`
- `backend/app/services/chat_service.py`
- `backend/app/ai/graphs/chat_agent.py`
- `backend/app/ai/tools/chat_tools.py`
- `backend/app/models/chat_thread.py`
- `backend/app/models/chat_message.py`
- `backend/alembic/versions/<hash>_add_chat_tables.py`
- `backend/tests/test_chat_service.py`
- `backend/tests/test_chat_api.py`
- `backend/tests/test_chat_tools.py`

**New (frontend):**

- `frontend/src/components/ai/chat/ChatTab.tsx`
- `frontend/src/components/ai/chat/ChatThreadList.tsx`
- `frontend/src/components/ai/chat/ChatThread.tsx`
- `frontend/src/components/ai/chat/ChatMessage.tsx`
- `frontend/src/components/ai/chat/ChatToolCard.tsx`
- `frontend/src/components/ai/chat/ChatComposer.tsx`
- `frontend/src/api/chat.ts`

**Modified:**

- `backend/app/api/router.py` — register chat routes
- `backend/app/ai/llm.py` — add chat tier
- `backend/app/ai/context/assembler.py` — extract reusable medium-tier loader
- `frontend/src/components/ai/AIPanel.tsx` — add tabs, mount `ChatTab`, widen panel to 420px
- `frontend/src/store.ts` — `aiPanelTab` state, composer-draft-per-thread map
- `frontend/src/hooks/useSSE.ts` — handle new chat event types
- `frontend/src/types.ts` — `ChatThread`, `ChatMessage`, `ChatToolCall` types

## Alignment with project guarantee

CLAUDE.md states the non-negotiable guarantee: every user must be able to go from setup through to a complete, exportable story. This design's curated write tools (`edit_scene_draft`, `propose_scene`, `summarize_scene`) compose toward that path — the agent could in principle drive a "fill missing scenes via chat" flow alongside the existing manuscript trigger. That composition is **not** scoped here, but the tool surface is chosen so it remains a future possibility rather than something the design forecloses.
