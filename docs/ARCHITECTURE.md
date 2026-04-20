# BeatLume Architecture & Algorithms

Deep dive into BeatLume's AI pipeline, analytics engine, and system architecture. This document explains the math, algorithms, and design decisions behind every computed feature.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [AI Pipeline](#2-ai-pipeline)
   - [Model Routing](#21-model-routing)
   - [Context Engine](#22-context-engine)
   - [LangGraph Workflows](#23-langgraph-workflows)
   - [Prompt Engineering](#24-prompt-engineering)
3. [Analytics Engine](#3-analytics-engine)
   - [Tension Curve Analysis](#31-tension-curve-analysis)
   - [Pacing Analysis](#32-pacing-analysis)
   - [Character Presence Matrix](#33-character-presence-matrix)
   - [Character Arc Classification](#34-character-arc-classification)
   - [Story Health Score](#35-story-health-score)
   - [Sparkline Downsampling (LTTB)](#36-sparkline-downsampling-lttb)
4. [Graph System](#4-graph-system)
5. [Real-time Events (SSE)](#5-real-time-events-sse)
6. [Security Architecture](#6-security-architecture)

---

## 1. System Architecture

### Request Flow

```
Browser
  → React (TanStack Router)
    → TanStack Query (cache layer)
      → fetch API client (auth interceptor)
        → FastAPI (routes → services → SQLAlchemy → PostgreSQL)
          → Celery (async: AI workflows, exports)
            → Redis (pub/sub)
              → SSE (EventSource back to browser)
```

### Data Flow for AI Features

```
User clicks "Generate Insights"
  → POST /api/stories/{id}/insights/generate
    → FastAPI returns 202 { task_id }
    → Celery task dispatched to ai_heavy queue
      → ContextAssembler gathers data from PostgreSQL
        → Retriever fetches scenes, characters, edges
        → Ranker scores by relevance
        → Truncator fits to token budget
        → Formatter converts to prompt-ready text
      → LangGraph workflow executes
        → Per-act analysis (3 parallel LLM calls)
        → Synthesis (1 LLM call to merge findings)
      → Results persisted to insights table
      → Redis PUBLISH story:{id}:events { ai.complete }
        → SSE endpoint forwards to browser
          → TanStack Query cache invalidated
            → UI re-renders with new insights
```

### Layer Boundaries

| Layer | Responsibility | Talks To |
|-------|---------------|----------|
| **API Routes** (`app/api/`) | HTTP handling, request validation, response serialization | Services |
| **Services** (`app/services/`) | Business logic, orchestration | Models (SQLAlchemy), AI |
| **Models** (`app/models/`) | ORM, database schema, constraints | PostgreSQL |
| **AI Context** (`app/ai/context/`) | Data retrieval, relevance ranking, token budgeting | Models |
| **AI Prompts** (`app/ai/prompts/`) | Prompt construction, output validation | LLM client |
| **AI Graphs** (`app/ai/graphs/`) | Multi-step workflow orchestration | Context, Prompts, LLM |
| **Tasks** (`app/tasks/`) | Async job execution, progress reporting | AI Graphs, Redis |
| **Analytics** (`app/services/analytics/`) | Mathematical computations on story data | numpy, scipy |

---

## 2. AI Pipeline

### 2.1 Model Routing

BeatLume routes LLM calls to different models based on task complexity. This optimizes cost (cheap model for simple tasks) and quality (powerful model for complex analysis).

```
Task Type                  → Model Tier  → Default Model
─────────────────────────────────────────────────────────
Scene summarization        → FAST        → gpt-4o-mini
Prose continuation         → STANDARD    → gpt-4o
Relationship inference     → STANDARD    → gpt-4o
Insight generation         → POWERFUL    → claude-sonnet-4-6
Insight synthesis          → POWERFUL    → claude-sonnet-4-6
Story scaffolding          → SCAFFOLD    → claude-sonnet-4-6
```

All models are configurable via environment variables (`AI_MODEL_FAST`, `AI_MODEL_STANDARD`, `AI_MODEL_POWERFUL`). LiteLLM abstracts the provider, so swapping from OpenAI to Anthropic (or a local model) requires only an env var change.

**Why separate tiers?**
- Scene summarization is a simple extraction task — gpt-4o-mini handles it well at 1/30th the cost of Claude
- Prose continuation needs voice matching and creative output — requires a mid-tier model
- Insight generation requires deep structural reasoning across the entire story — needs the most capable model

### 2.2 Context Engine

The context engine is BeatLume's most important subsystem. It determines what data the LLM sees for each task. A 90,000-word novel can't fit in a prompt — the engine must select, rank, and truncate the most relevant context.

#### Architecture

```
app/ai/context/
├── assembler.py      # Orchestrates the pipeline
├── retrievers.py     # Fetches data from PostgreSQL
├── rankers.py        # Scores items by relevance
├── formatters.py     # Converts DB objects to prompt text
└── token_budget.py   # Counts tokens, allocates budget, truncates
```

#### Pipeline

```
1. BUDGET     Define total token budget based on model tier
              ─────────────────────────────────────────────
              fast:     16,000 tokens
              standard: 128,000 tokens
              powerful: 200,000 tokens

              Available = Total - Output Reserve (2,000) - System Prompt

2. RETRIEVE   Fetch candidate data from PostgreSQL
              ─────────────────────────────────────
              Retrievers use targeted queries — not "load everything"
              Each retriever fetches exactly what a task needs

3. RANK       Score candidates by relevance to the task
              ──────────────────────────────────────────
              Different rankers for different tasks
              Scored items sorted descending

4. TRUNCATE   Fit ranked items into the token budget
              ──────────────────────────────────────
              Smart sentence-boundary truncation
              Keep-end mode for continuation (preserve recent text)

5. FORMAT     Convert structured data to prompt-ready text
              ────────────────────────────────────────────
              Consistent formatting across all prompts
              Human-readable, LLM-parseable
```

#### Token Budget Allocation

Each task type defines proportional budget allocations:

**Prose Continuation:**
```
story_skeleton:    10%  ← lightweight structural overview
character_profile:  ~   ← not truncated (small)
prior_scene_prose: 35%  ← last 2 scenes for voice + continuity
current_scene_prose: 30% ← what's written so far (keep_end=True)
[remaining]:       25%  ← buffer
```

**Insight Analysis:**
```
story_skeleton:    ~    ← full overview (usually < 2000 tokens)
act_scenes:        ~    ← all scenes in the target act (metadata only)
```

**Story Scaffolding:**
```
premise:           ~    ← user's input (small)
characters:        ~    ← user's character descriptions (small)
genres:            ~    ← comma-separated list
```

#### Token Counting

```python
count_tokens(text, model="gpt-4o")
  → tiktoken.encoding_for_model(model)
  → fallback: cl100k_base encoding
  → returns len(encoder.encode(text))
```

#### Smart Truncation

The truncator respects sentence boundaries:

```
Mode: keep_start (default)
──────────────────────────
"The orchard was quiet at dawn. Birds stirred in the upper branches.
 Iris walked the row of pear trees, counting blossoms. The gate..."
                                                            ↑ truncate here
 → "The orchard was quiet at dawn. Birds stirred in the upper branches.
    Iris walked the row of pear trees, counting blossoms..."

Mode: keep_end (for prose continuation)
───────────────────────────────────────
"...early chapters of setup. The orchard was quiet at dawn.
 Birds stirred in the upper branches. She reached for the gate."
  ↑ truncate here
 → "...The orchard was quiet at dawn. Birds stirred in the upper
    branches. She reached for the gate."
```

**Why keep_end matters:** For prose continuation, the LLM needs to see what was written most recently — the last few paragraphs determine voice, tense, and what happens next. Older text is less relevant.

#### Ranking Algorithms

**Scenes for Continuation — Proximity Decay:**

```
score(scene) = e^(-0.5 × |scene.n - target_n|)

Scene 5 (target=5): e^0     = 1.000  ← current scene
Scene 4 (target=5): e^-0.5  = 0.607  ← previous scene
Scene 3 (target=5): e^-1.0  = 0.368  ← two scenes back
Scene 1 (target=5): e^-2.0  = 0.135  ← distant scene
```

This exponential decay ensures nearby scenes dominate the context. A scene 10 positions away scores 0.007 — effectively excluded.

**Scenes for Insights — Category-Aware:**

```
category = "Pacing":
  score(scene) = |tension - 5.5| / 4.5
  → Extreme tensions (1 or 10) score 1.0
  → Middle tensions (5-6) score ~0.1
  → Insight analysis needs to see the extremes

category = "Characters":
  score(scene) = 1.0 if has POV character, else 0.5
  → POV scenes are more informative for character analysis
```

### 2.3 LangGraph Workflows

Each AI feature is a LangGraph `StateGraph` — a directed graph of async functions with typed state. LangGraph provides:
- State persistence across nodes
- Conditional branching
- Automatic retry on failure
- Typed input/output contracts

#### Workflow 1: Insight Generation

The most complex workflow — analyzes the entire story structure.

```
                    ┌─────────────────┐
                    │  analyze_acts   │
                    │                 │
                    │ For each act:   │
                    │  1. Assemble    │
                    │     context     │
                    │  2. Build       │
                    │     prompt      │
                    │  3. Call LLM    │
                    │     (POWERFUL)  │
                    │  4. Validate    │
                    │     JSON output │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   synthesize    │
                    │                 │
                    │ 1. Merge all    │
                    │    act findings │
                    │ 2. Deduplicate  │
                    │ 3. Promote/     │
                    │    demote       │
                    │    severity     │
                    │ 4. Add cross-   │
                    │    act insights │
                    │ 5. Rank by      │
                    │    impact       │
                    └────────┬────────┘
                             │
                           [END]
                    final_insights[]
```

**State:** `{story_id, story_context, act_contexts, chunk_findings, final_insights, error}`

**Why two stages?** Per-act analysis limits context to one act at a time (fits in token budget). Synthesis sees all findings together to detect cross-act patterns the per-act analysis can't see.

#### Workflow 2: Prose Continuation

```
    ┌──────────────────┐
    │  gather_context   │
    │                   │
    │  Validate context │
    │  sections exist   │
    └────────┬──────────┘
             │
    ┌────────▼──────────┐     ┌───────┐
    │  should_end?      │────→│  END  │  (if error)
    └────────┬──────────┘     └───────┘
             │ (continue)
    ┌────────▼──────────┐
    │  generate_prose   │
    │                   │
    │  1. Build prompt  │
    │     with voice +  │
    │     scene context │
    │  2. Call LLM      │
    │     (STANDARD)    │
    │     temp=0.8      │
    │  3. Validate      │
    │     (min 50 chars)│
    └────────┬──────────┘
             │
           [END]
         result: str
```

**Key detail:** Temperature is set to 0.8 (higher than analysis tasks at 0.3) because prose generation needs creativity, not determinism.

#### Workflow 3: Story Scaffolding

```
    ┌───────────────────┐
    │ generate_scaffold  │
    │                    │
    │ Single LLM call    │
    │ (SCAFFOLD tier)    │
    │ max_tokens=4000    │
    │ temp=0.7           │
    │                    │
    │ Generates:         │
    │  - Act structure   │
    │  - Scene outlines  │
    │  - Characters      │
    │  - Relationships   │
    │  - Themes          │
    └────────┬───────────┘
             │
           [END]
         result: {acts, characters, relationships}
```

**Why a single call?** Scaffolding is a creative generation task where the LLM needs to see the full structure holistically. Splitting it into separate calls (structure → scenes → characters) loses coherence.

#### Workflow 4: Relationship Inference

```
    ┌───────────────────┐
    │  analyze_pairs     │
    │                    │
    │ For each pair:     │
    │  (char_a, char_b)  │
    │                    │
    │  1. Build prompt   │
    │     with shared    │
    │     scene prose    │
    │  2. Call LLM       │
    │     (STANDARD)     │
    │     temp=0.3       │
    │  3. Classify:      │
    │     kind, weight,  │
    │     direction      │
    └────────┬───────────┘
             │
           [END]
         results: [{kind, weight, direction, reasoning}]
```

**Relationship types and what they mean:**

| Type | Description | Layout Effect |
|------|-------------|---------------|
| `conflict` | Opposition, rivalry, antagonism | Nodes spread apart |
| `alliance` | Cooperation, shared goals, trust | Nodes cluster together |
| `romance` | Attraction, love, longing | Moderate attraction |
| `mentor` | Teaching, guidance (directional) | Moderate attraction |
| `secret` | Hidden knowledge, deception | Very weak attraction (hidden) |
| `family` | Blood or found family bonds | Strong clustering |

#### Workflow 5: Scene Summarization

```
    ┌───────────────────┐
    │ generate_summary   │
    │                    │
    │ Single LLM call    │
    │ (FAST tier)        │
    │ temp=0.3           │
    │                    │
    │ Produces:          │
    │  - 1-2 sentence    │
    │    summary          │
    │  - 3-5 beats       │
    └────────┬───────────┘
             │
           [END]
         {summary, beats[]}
```

### 2.4 Prompt Engineering

Every prompt follows the same structure:

```
SYSTEM MESSAGE
├── Role assignment ("You are a senior developmental editor...")
├── Context injection (story metadata, character profiles)
├── Task specification (exactly what to produce)
├── Output format (JSON schema with examples)
├── Rules (constraints, what NOT to do)
└── Severity/quality guidelines

USER MESSAGE
├── Data sections (formatted by context engine)
└── Action trigger ("Analyze this act and return findings as JSON.")
```

**Key design decisions:**

1. **Chain-of-thought for analysis:** Insight prompts say "Think step by step: 1. Check pacing, 2. Check characters..." This produces more thorough analysis than a direct "find problems" instruction.

2. **Negative constraints for prose:** "Never use: 'a sense of', 'couldn't help but', 'it was as if'" — LLMs default to these clichés. Explicit exclusion produces better fiction.

3. **Voice matching via context:** The prose continuation prompt includes prior scene prose so the LLM can match the author's existing style — sentence rhythm, vocabulary level, paragraph length.

4. **JSON output with validation:** Every prompt requests JSON output. Every prompt module has a `validate_output()` function that parses and validates the response. On validation failure, the system retries once with the error appended.

---

## 3. Analytics Engine

Pure mathematical computations on story data. No LLM calls — these are deterministic algorithms.

### 3.1 Tension Curve Analysis

**Input:** Array of scene tension values (integers 1-10)

**Algorithm:**

**Step 1 — Interpolation:**

For `n ≥ 4` scenes, fit a **cubic spline** (scipy `CubicSpline` with `bc_type="natural"`):

```
Given points: (0, t₀), (1, t₁), ..., (n-1, tₙ₋₁)
Cubic spline S(x) satisfies:
  - S(xᵢ) = tᵢ for all data points
  - S''(x₀) = S''(xₙ₋₁) = 0 (natural boundary)
  - S(x) is C² continuous (smooth second derivative)

Generate 200 evenly spaced points along the curve.
```

For `n = 2-3` scenes: linear interpolation.
For `n = 1`: constant line at that tension.

**Step 2 — Smoothing:**

When `n ≥ 7`, apply **Savitzky-Golay filter** (`window=min(7, n)`, `polyorder=3`):

```
The SG filter fits a polynomial of degree 3 to each sliding window
of 7 points, using the polynomial's center value as the smoothed output.

This preserves peaks and valleys while removing noise — critical for
a tension curve where peaks represent story climaxes.
```

Clamp output to [1, 10].

**Step 3 — Peak Detection:**

Using `scipy.signal.find_peaks` with:
- `prominence ≥ 2` — peak must stand out by at least 2 tension points from surrounding baseline
- `distance ≥ max(1, min(3, n//3))` — peaks must be at least 3 scenes apart (prevents false peaks from noisy data)

**Peak labeling by position in story:**

```
position = peak_index / (n_scenes - 1)

position ≤ 0.25    → "Inciting incident"  (first quarter)
0.40 ≤ pos ≤ 0.60  → "Midpoint"           (middle)
position ≥ 0.70    → "Climax"             (final third)
else               → "Crisis"             (rising action)
```

**Valley detection:** Same algorithm applied to negated signal (`-tension`).

**Metrics computed:**
- `mean`: average tension across all scenes
- `std`: standard deviation (higher = more dynamic story)
- `max`, `min`: extremes
- `range`: `max - min`
- `climax_position`: normalized position (0-1) of the highest tension point

### 3.2 Pacing Analysis

Pacing measures the *rhythm* of tension changes, not the absolute values.

**Velocity (First Derivative):**

```
For adjacent scenes (i, i+1):
  delta = tension[i+1] - tension[i]

  |delta| > 4   → "spike" (positive) or "drop" (negative)
  delta > 0     → "rising"
  delta < 0     → "falling"
  delta = 0     → "flat"
```

Good pacing alternates between rising and falling. Constant rising is exhausting; constant flat is boring.

**Flatline Detection:**

```
A flatline is a run of 3+ consecutive scenes where tension varies by ≤ 1.

Algorithm:
  run_start = 0
  for i in range(1, n):
    if |tension[i] - tension[run_start]| > 1:
      if (i - run_start) >= 3:
        record flatline(start, end, avg_tension)
      run_start = i
```

**Why this matters:** Flatlines signal pacing problems. Three scenes at tension 5, 5, 5 feel static — nothing is changing. The reader disengages.

**Whiplash Detection:**

```
For adjacent scenes where |tension[i+1] - tension[i]| > 4:
  Record whiplash(from_scene, to_scene, delta)
```

**Why this matters:** A jump from tension 2 to tension 8 in one scene transition is jarring. Unless it's a deliberate twist, it disorients the reader.

**Breathing Room Analysis:**

```
For each scene with tension ≥ 7:
  Check the next 3 scenes for any with tension ≤ 4
  has_relief = True if found

Report: {peak_scene, peak_tension, has_relief}
```

**Why this matters:** After high-tension scenes (chase, argument, revelation), readers need a breather — a quieter scene to process what happened. Stories without breathing room feel relentless.

### 3.3 Character Presence Matrix

A binary matrix tracking which characters appear in which scenes.

```
              Scene 1  Scene 2  Scene 3  Scene 4  Scene 5
Iris            2        2        2        0        2
Cole            0        1        0        2        1
Wren            0        0        2        0        0

Values: 0 = absent, 1 = mentioned, 2 = POV character
```

**Detection rules:**
- `2 (POV)`: `scene.pov` matches character name (case-insensitive)
- `1 (mentioned)`: character name appears in scene summary (substring match)
- `0 (absent)`: neither condition met

**Per-character stats:**
- `scene_count`: scenes where value > 0
- `pov_count`: scenes where value = 2
- `coverage`: `scene_count / total_scenes` (0.0 to 1.0)
- `longest_gap`: maximum consecutive absent scenes

**Gap calculation:**

```
last_seen = -1
longest_gap = 0
for i, value in enumerate(row):
  if value > 0:
    gap = i - last_seen - 1
    longest_gap = max(longest_gap, gap)
    last_seen = i
```

**Why this matters:** A protagonist disappearing for 8 scenes is usually a structural problem. The presence matrix makes this instantly visible.

### 3.4 Character Arc Classification

Each character has a personal tension arc — their emotional journey through the story.

**Algorithm:**

1. **Extract**: Filter tension values to only scenes where the character is present
2. **Fit**: Linear regression to determine overall trajectory (`numpy.polyfit` degree 1)
3. **Detect**: Find peaks and valleys in the filtered tensions

**Classification logic:**

```
slope > 0.3 and few peaks/valleys      → "rise"        (character gains power/confidence)
slope < -0.3 and few peaks/valleys     → "fall"        (character declines/loses)
peak followed by valley                → "rise-fall"   (classic hero arc)
valley followed by peak                → "fall-rise"   (redemption arc)
4+ direction changes                   → "wave"        (turbulent journey)
slope ≈ 0 and low variance             → "flat"        (static character)
```

**Arc shapes and their narrative meaning:**

| Shape | Visual | Narrative |
|-------|--------|-----------|
| `rise` | ╱ | Character gains power, knowledge, or confidence. Common for mentors being validated. |
| `fall` | ╲ | Character loses status, hope, or agency. Common for tragic figures. |
| `rise-fall` | ∧ | The classic arc. Character rises to a peak then faces consequences. Hero's journey. |
| `fall-rise` | ∨ | Redemption arc. Character hits bottom then recovers. |
| `wave` | ∿ | Turbulent, unpredictable journey. Multiple reversals. |
| `flat` | — | Static character. May be intentional (witness) or a problem (underdeveloped). |

### 3.5 Story Health Score

A composite 0-100 score from six weighted components. Not a quality judgment — measures structural completeness and balance.

```
SCORE = Σ (component_score × weight)

┌────────────────────────┬────────┬───────────────────────────────────────┐
│ Component              │ Weight │ Scoring                               │
├────────────────────────┼────────┼───────────────────────────────────────┤
│ Completion             │  0.20  │ word_count / target_words × 100       │
│                        │        │ (capped at 100)                       │
├────────────────────────┼────────┼───────────────────────────────────────┤
│ Pacing                 │  0.20  │ Average of:                           │
│                        │        │  - std_score: tension variance        │
│                        │        │    (reward moderate, penalize extreme) │
│                        │        │  - range_score: tension range / 6     │
│                        │        │    (wider range = more dynamic)       │
├────────────────────────┼────────┼───────────────────────────────────────┤
│ Character Coverage     │  0.20  │ Characters with POV scenes /          │
│                        │        │ total characters × 100                │
├────────────────────────┼────────┼───────────────────────────────────────┤
│ Relationship Density   │  0.15  │ edges / max_possible_edges × 100      │
│                        │        │ max = n×(n-1)/2 for n characters      │
├────────────────────────┼────────┼───────────────────────────────────────┤
│ Structural Integrity   │  0.15  │ Act balance score:                    │
│                        │        │  - 3+ acts: 1 - std(proportions)      │
│                        │        │  - 2 acts: 50                         │
│                        │        │  - 1 act: 25                          │
├────────────────────────┼────────┼───────────────────────────────────────┤
│ Issue Load             │  0.10  │ 100 - (open_issues × 10)              │
│                        │        │ (undismissed insights penalize)       │
└────────────────────────┴────────┴───────────────────────────────────────┘

Grade: A (≥90), B (≥75), C (≥60), D (≥40), F (<40)
```

**Pacing score detail:**

```
tension_std = standard deviation of all scene tensions

std_score:
  if std ≤ 2.5:  (std / 2.5) × 100     — reward increasing variation
  if std > 2.5:  100 - (std - 2.5) × 20 — penalize excessive variation

range_score:
  (tension_range / 6.0) × 100           — a range of 6+ gets full marks

pacing = (std_score + range_score) / 2
```

The sweet spot is moderate variation (std around 2-2.5) with a wide range (using most of the 1-10 scale). A story that stays at 5-6 the whole time scores low; one that swings wildly from 1 to 10 every scene also scores low.

### 3.6 Sparkline Downsampling (LTTB)

Dashboard story cards show tiny tension previews. A 60-scene story needs to be reduced to 12 points while preserving the visual shape.

**Algorithm: Largest-Triangle-Three-Buckets**

LTTB is a visually-aware downsampling algorithm. Unlike simple averaging (which smooths out peaks), LTTB preserves the most visually significant points.

```
Input:  [2, 3, 5, 4, 7, 6, 8, 9, 7, 8, 6, 9, 3, 4, 5, ...]  (40 points)
Output: [2, 5, 7, 9, 8, 9, 4, ...]                             (12 points)

Algorithm:
1. Always keep first and last points
2. Divide remaining data into (target - 2) equal buckets
3. For each bucket:
   a. Calculate average of NEXT bucket (look-ahead)
   b. For each point in current bucket, compute triangle area:
      area = |(p.x - prev.x)(avg.y - prev.y) - (avg.x - prev.x)(p.y - prev.y)|
   c. Select the point with maximum triangle area

The triangle area measures "how much this point deviates from a straight
line between the previous selected point and the next bucket's average."
Points with large triangles are visually significant — peaks, valleys,
and sharp changes. Points on a straight line have zero area and are skipped.
```

**Why not simple averaging?**

```
Data:   [2, 3, 3, 3, 9, 3, 3, 3, 2]    ← spike at position 4
Average: [2.7, 5.0, 2.7]                ← spike becomes 5.0 (lost)
LTTB:    [2, 9, 2]                       ← spike preserved as 9
```

The sparkline should look like a miniature version of the full tension curve. LTTB ensures the climax shows up as a peak, not a smoothed-out bump.

---

## 4. Graph System

The character relationship graph is both a data model and a visualization.

### Force-Directed Layout

Node positions are computed server-side using the Fruchterman-Reingold algorithm. The layout engine applies different forces based on edge types:

```
Force             | Effect                              | Applied To
──────────────────┼─────────────────────────────────────┼──────────────
Repulsion         | All nodes push each other away      | All node pairs
Attraction        | Connected nodes pull together       | Edge endpoints
Edge-kind scaling | Relationship type adjusts attraction | Each edge
Hub gravity       | Central pull for important nodes    | type="hub"
Minor repulsion   | Push less important nodes to edges  | type="minor"
Pinned nodes      | Author-positioned nodes stay fixed  | Manual positions
```

**Edge-kind force scaling:**

| Edge Kind | Attraction Strength | Why |
|-----------|-------------------|-----|
| alliance | Strong | Allies cluster together visually |
| family | Strong | Family groups together |
| romance | Moderate (with offset) | Side by side, not overlapping |
| mentor | Moderate | Connected but not fused |
| conflict | Weak | Opponents spread to opposite sides |
| secret | Very weak | Hidden connections don't visually cluster |

### Edge Provenance

Every edge tracks how it was created:

| Provenance | Meaning | UI Treatment |
|------------|---------|-------------|
| `author` | Manually created by user | Solid line, never auto-modified |
| `ai_accepted` | AI suggested, user approved | Solid line |
| `ai_pending` | AI suggested, not yet reviewed | Dashed/ghosted line with accept/reject buttons |
| `scaffold` | Generated during story setup | Solid line, treated like author |

**Merge rules (AI never overrides the author):**
1. `author` edges — never touched by AI
2. `ai_accepted` edges — AI can suggest updates (marks as `ai_pending` for re-review)
3. `ai_pending` edges — AI can update in place
4. New inference → created as `ai_pending`
5. AI finds no relationship for existing `ai_pending` → removes suggestion

### Temporal Graph

The time scrubber shows the graph at any point in the story. At Scene N:
- Only characters who have appeared in scenes 1..N are shown
- Only edges with evidence from scenes 1..N are shown

This is computed from `first_appearance_scene` on nodes and `evidence[].scene_n` on edges.

---

## 5. Real-time Events (SSE)

BeatLume uses Server-Sent Events for real-time updates. When a user enters a story workspace, the frontend opens a single `EventSource` connection.

```
Browser                          Backend                          Celery Worker
  │                                │                                │
  │  GET /events?token=jwt         │                                │
  │──────────────────────────────→ │                                │
  │                                │  Subscribe to                  │
  │                                │  story:{id}:events             │
  │                                │  (Redis pub/sub)               │
  │                                │                                │
  │                                │                                │  AI task running...
  │                                │                                │  PUBLISH progress
  │                                │  ←──── Redis message ──────── │
  │  ←── event: ai.progress ────  │                                │
  │                                │                                │  Task complete
  │                                │                                │  PUBLISH complete
  │                                │  ←──── Redis message ──────── │
  │  ←── event: ai.complete ────  │                                │
  │                                │                                │
  │  (TanStack Query invalidates   │                                │
  │   cache, UI re-renders)        │                                │
```

**Event types:**

| Event | Trigger | Frontend Action |
|-------|---------|----------------|
| `ai.progress` | Celery task sends update | Show progress toast |
| `ai.complete` | Celery task finishes | Invalidate relevant query cache |
| `ai.error` | Celery task fails | Show error toast |
| `export.progress` | Export job progress | Update progress bar |
| `export.complete` | Export file ready | Auto-open download URL |
| `activity` | Collaborator action | Refresh activity feed |
| `comment` | New comment posted | Refresh comments list |

**Auth for SSE:** `EventSource` cannot set HTTP headers. The token is passed as a query parameter (`?token=jwt`). The SSE endpoint validates it identically to the `Authorization: Bearer` header.

---

## 6. Security Architecture

### Multi-Tenancy (RLS)

```
┌─────────────────────────────────────────────────────┐
│ PostgreSQL                                           │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ RLS Policy (on every org-scoped table):      │    │
│  │                                               │    │
│  │  USING (org_id = current_setting(             │    │
│  │    'app.current_org_id')::uuid)               │    │
│  │                                               │    │
│  │ Set per-request:                              │    │
│  │  SELECT set_config('app.current_org_id',      │    │
│  │    :org_id, true)                             │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  Even if application code has a bug:                 │
│  SELECT * FROM scenes;  ← returns ONLY current org  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Auth Token Flow

```
                    Access Token (15 min)
Signup/Login  ────→ stored in Zustand (memory)
                    sent as Authorization: Bearer

                    Refresh Token (7 days)
              ────→ httpOnly cookie (not accessible to JS)
                    sent automatically with credentials: include

Token expired?
  → API returns 401
  → Client POSTs /auth/refresh (cookie sent automatically)
  → New access token returned
  → Original request retried

Logout?
  → POST /auth/logout clears server-side cookie
  → Client clears Zustand state
  → All TanStack Query caches cleared
```

### Rate Limiting

```
/auth/login  ─── 5 requests/minute per IP (slowapi)
/auth/signup ─── 5 requests/minute per IP
```

### CSRF Protection

Origin header validation on all state-changing requests (POST/PUT/DELETE/PATCH). If the `Origin` header doesn't match `CORS_ORIGINS`, the request is rejected with 403.

### Production Startup Validation

In non-development environments, the app refuses to start if:
- `JWT_SECRET_KEY` is the default dev value
- `DATABASE_URL` contains dev credentials
