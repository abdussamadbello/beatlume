# BeatLume UI-First Implementation — Design Spec

**Date:** 2026-04-18
**Scope:** All 12 wireframe views as static frontend with mock data
**Stack:** Vite + React 19 + TypeScript + TanStack Router (frontend), FastAPI stub (backend)

---

## 1. Project Structure

```
beatlume/
  frontend/
    src/
      components/
        chrome/            # AppShell, Sidebar, TopNav, ChromeTop, CmdInput
        primitives/        # Tag, Btn, Panel, PanelHead, Label, Anno, Placeholder, Sticky
        charts/            # GraphRenderer, TensionCurve
      views/               # 12 view pages
      data/                # Mock data modules
      styles/              # Global CSS tokens + grid backgrounds + typography
      App.tsx              # TanStack Router setup + layout shell
      main.tsx             # Entry point
    index.html
    vite.config.ts
    tsconfig.json
    package.json
  backend/
    app/
      main.py              # Health check endpoint only
    requirements.txt
```

No monorepo tooling. Two flat directories: `frontend/` and `backend/`.

## 2. Design System

### 2.1 CSS Tokens

```css
:root {
  --paper: #F5F3EC;
  --paper-2: #EDEAE0;
  --ink: #1A1D24;
  --ink-2: #3B4049;
  --ink-3: #7B8089;
  --line: #C9C5B6;
  --line-2: #DDD9CB;
  --blue: oklch(0.55 0.12 245);
  --blue-soft: oklch(0.88 0.04 245);
  --amber: oklch(0.72 0.14 75);
  --amber-soft: oklch(0.92 0.05 75);
  --red: oklch(0.58 0.17 25);
  --red-soft: oklch(0.92 0.05 25);
  --green: oklch(0.58 0.12 150);

  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --font-serif: "Instrument Serif", "Times New Roman", serif;
  --font-sans: "Inter Tight", system-ui, sans-serif;
}
```

### 2.2 Fonts

Loaded from Google Fonts:
- JetBrains Mono (400, 500, 700) — labels, data, mono text
- Instrument Serif (normal, italic) — display headings, prose
- Inter Tight (400, 500, 600) — body sans-serif

### 2.3 Grid Backgrounds

Two blueprint grid patterns applied via CSS classes:
- `.grid-bg` — 24px grid, `var(--line-2)` lines
- `.grid-bg-fine` — 8px grid, subtle `rgba(201,197,182,0.35)` lines

### 2.4 Component Library (15 primitives)

| Component | Props | Description |
|-----------|-------|-------------|
| `AppShell` | `sidebar: ReactNode`, `children: ReactNode` | `display: grid; grid-template-columns: 200px 1fr` |
| `Sidebar` | `active: string`, `title?: string` | Planning + Assistant sections, items with badge counts, auto-save footer |
| `TopNav` | `active: string`, `title: string`, `crumbs: string` | Horizontal tab nav with logo + actions |
| `ChromeTop` | `title: string`, `crumbs: string`, `actions?: ReactNode` | Logo bar with diamond icon `::before` |
| `CmdInput` | `placeholder: string` | Command palette input with `⌘K` hint |
| `Panel` | `children: ReactNode` | `border: 1px solid var(--line); background: var(--paper)` |
| `PanelHead` | `left: ReactNode`, `right?: ReactNode` | Flex row header for panels |
| `Tag` | `variant?: 'blue' \| 'amber' \| 'red' \| 'solid'`, `children` | Inline label pill |
| `Btn` | `variant?: 'solid' \| 'ghost'`, `children` | Button with hover invert |
| `Label` | `children` | 10px uppercase mono, `color: var(--ink-3)` |
| `Anno` | `variant?: 'blue' \| 'amber' \| 'red'`, `style`, `children` | Absolute-positioned annotation pill with dot `::before` |
| `Placeholder` | `label?: string`, `aspect?: string` | Diagonal-stripe placeholder box |
| `Sticky` | `variant?: 'amber' \| 'blue' \| 'red'`, `children` | Sticky note card |
| `GraphRenderer` | `nodes: Node[]`, `edges: Edge[]`, `width: number`, `height: number` | SVG graph with hub/minor/default node types, edge styles by relationship kind (alliance=solid blue, conflict=dashed red, romance=solid pink, mentor=solid ink, secret=dotted gray, family=solid green) |
| `TensionCurve` | `data: number[]`, `acts?: Act[]`, `peaks?: Peak[]`, `fill?: string`, `stroke?: string`, `label?: string`, `width: number`, `height: number` | SVG line/area chart with horizontal gridlines, act dividers, peak markers |

### 2.5 Shared Types

```typescript
interface SceneNode {
  id: string;
  x: number;
  y: number;
  label: string;
  initials: string;
  type?: 'hub' | 'minor';
}

interface Edge {
  a: string;
  b: string;
  kind: 'conflict' | 'alliance' | 'romance' | 'mentor' | 'secret' | 'family';
  weight: number;
}

interface Scene {
  n: number;
  title: string;
  pov: string;
  tension: number;
  act: number;
  location: string;
  tag: string;
  summary?: string;
}

interface Character {
  name: string;
  role: string;
  desire: string;
  flaw: string;
  sceneCount: number;
  longestGap: number;
}

interface Insight {
  severity: 'red' | 'amber' | 'blue';
  category: string;
  title: string;
  body: string;
  refs: string[];
}

interface Act { at: number; label: string; }
interface Peak { at: number; v: number; label: string; }

interface ManuscriptChapter {
  num: string;
  title: string;
  paras: string[];
}

interface CoreConfigNode {
  depth: number;
  label: string;
  kind: 'story' | 'part' | 'chap' | 'scene' | 'beat';
  active?: boolean;
}

interface CoreSetting {
  key: string;
  value: string;
  source: string;
  tag?: string;
}
```

## 3. Views

All 12 views implement Variation A (sidebar layout) only. Variation B is not built in this pass.

### 3.1 Overview (`/`)
- Story title, logline, genre tags, word count target
- Tension curve (full story, 47 scenes) in a `Panel`
- "Next AI flag" card with title, body, Inspect/Dismiss buttons
- 4 stat tiles: Scenes (47), Characters (14), Subplots (3), Relationships (9)
- Recent scenes list (5 items) with scene number, title, POV, location, tension tag
- Character presence heatmap (7 characters x 40 scene columns)

### 3.2 Scene Board (`/scenes`)
- Header: title + filter/group/sort buttons + "+ Scene" button
- Three kanban columns: Act I, Act II, Act III
- Scene cards: POV color left-border, scene number, POV label, title (serif), tension bar (10-segment), "+ New scene" dashed card at bottom

### 3.3 Graph (`/graph`)
- Mode toggle tabs: Characters / Scenes / Subplots / Mixed
- Force-directed SVG graph (920x560) with 9 nodes, 12 edges
- Annotation pills: "hub - Iris - degree 6", "conflict triangle", "disconnected - Doc"
- Right panel: edge kind legend (6 types with line samples), filter checkboxes, selected node info
- Bottom: time scrubber bar with act dividers and draggable position indicator

### 3.4 Timeline (`/timeline`)
- Large tension curve (960x360) with 4 annotation pills (FLAT, MIDPOINT spike, CLIMAX, SETUP plateau)
- Scene heatmap strip below the curve (40 cells colored by tension)
- Emotional intensity overlay curve below
- Right panel: 7 metric layer toggles with color swatches, source mode segmented control (Manual/AI/Hybrid), inferred structural markers list

### 3.5 Graph x Timeline — Flagship (`/flagship`)
- Top toolbar: title + "Linked" tag + metric/graph dropdowns + Play button
- Upper region (flex 1.4): graph (920x430) with annotations + time marker badge + right inspector panel showing selected edge details, appearance map, history, AI suggestion
- Lower region (flex 1): tension curve (1140x220) with brush selection overlay (translucent blue rectangle) + scrubber line + AI annotation

### 3.6 Characters (`/characters`)
- Header: "Cast - 14 characters" + filter/add buttons
- Table with columns: avatar (initials circle), name (serif), role (tag), presence strip (47 bars), scene count, longest gap (red if >10), arc sparkline (8 mini-bars)
- 10 character rows

### 3.7 Narrative Core (`/core`)
- Header: "Configuration hierarchy" + `Reset` / `+ Setting` / `+ Override` buttons (the add button label depends on the selected node: `+ Setting` at the story root, `+ Override` anywhere else).
- Left panel (330px): structural tree — indented nodes with icons (diamond, grid, square, dot) for Story → Part → Chapter → Scene → Beat. Selecting a node drives what the right panel shows. Scene and chapter nodes also expose an `Open` button that navigates to the Scene Detail view or scrolls the Manuscript to that chapter.
- Right panel: resolved-settings editor for the selected node. Columns: Setting, Resolved value, Source (`USER` / `SYSTEM` / `AI` colored tag plus optional `tag` label like `inferred`/`primary`), **Defined at** (either `Story`, the ancestor node label like `Ch 5 — The Ridge`, or an `override` pill when defined on the current node), and a per-row actions column.
- Inheritance: every ancestor value cascades downward. A child node overrides by defining its own row — the resolver walks from the selected node up through parents and picks the nearest-defined value per key. Story-root rows (`config_node_id IS NULL`) are the final fallback.
- Editing an inherited value on a descendant node creates an override on that node. Editing a row that is already defined on the current node updates it in place.
- `Revert` on an override deletes just that override so the node re-inherits from its ancestor chain.
- `Accept` on an AI row flips `source → user` and clears the inferred tag — codifying the "author is always right; AI suggestions are proposals" principle. System-derived story-level rows are read-only; node-level system copies can be freely removed.
- Empty-state copy (story level): "No settings yet. Click **+ Setting** to add one." / (node level): "No settings yet. Click **+ Override** to add one."

**Data model.** `core_settings.config_node_id` is a nullable FK to `core_config_nodes`. Uniqueness is enforced by two partial indexes (one for `config_node_id IS NULL`, one for non-null) so a key can appear once per node plus once at story root. Node parentage is explicit via `core_config_nodes.parent_id` (self-referential FK, `ON DELETE CASCADE`). See `backend/app/models/core.py` and migration `3c7a4e91d2a1_core_per_node_overrides.py`.

**AI integration.** When the context assembler builds prose-continuation prompts, it resolves settings at the scene's config node — so a chapter-level POV override or a scene-level tense override is what the LLM sees. See `backend/app/ai/context/retrievers.py::get_resolved_settings_for_scene`.

### 3.8 AI Insights (`/ai`)
- Left nav (220px): category filter list (All 12, Pacing 3, Relationships 4, Characters 2, Subplots 2, Climax 1) + status summary (Flags/Suggestions/Resolved)
- Main area: 5 insight cards, each with severity tag (FLAG/REVIEW/OK), category label, title (serif), body text, reference tags, action buttons (Inspect/Apply/Dismiss)

### 3.9 Draft (`/draft`)
- Three-column layout: scene rail (240px) + prose editor (flex) + memory panel (300px)
- Scene rail: 14 scene items with number, POV, title, tension tag; active scene highlighted
- Editor: scene header (number, POV, location, title, goal/conflict/outcome), prose body (serif 17px, 1.75 line-height) with full paragraphs from the wireframe, AI continuation prompt (gray italic), graph update suggestion (blue background), word count footer
- Memory panel: participants with descriptions, active relationships, prior scene summary, targets

### 3.10 Scene Detail (`/scenes/:id`)
- Modal overlay: blurred background, centered 1080px dialog with box-shadow
- Header: scene number, act, title (serif 26px), tag, prev/next navigation, close
- Left column: 10 field key-value pairs (POV, Location, Time, etc.), summary paragraph, 3 beats with type tags
- Right column: 6 scoring bars (Tension/Emotional/Stakes/Mystery/Danger/Hope, each 10-segment), mini graph showing scene's character subgraph with edge impact note
- Footer: Open in Draft / Linked AI + Delete / Save buttons

### 3.11 Setup (`/setup`)
- No sidebar — standalone wizard layout with logo header
- Left stepper panel (280px): 4 steps with checkmark/number indicators, currently on step 3
- Main area: step title (serif 38px), description, 4 character input rows (avatar, name input, role select, description input), "+ Add a character" dashed row, suggested relationships strip (blue tags), prev/next buttons

### 3.12 Manuscript (`/manuscript`)
- Reader bar header: draft label, title (italic serif), word count, reading time, export buttons
- Main area: centered 640px page with paper background + shadow, title page (novel title + author), 5 chapters with chapter headers + full prose paragraphs
- Footer: page number, chapters visible, progress percentage

## 4. Mock Data

All mock data is extracted directly from the wireframe source files:

- **47 scenes** — 8 fully detailed scenes from `BL.sampleScenes`, remaining 39 generated with the same structure
- **14 characters** — name, role, desire, flaw, scene count, longest gap, arc data
- **9 graph nodes** — Iris (hub), Wren, Cole, Mara, Jon, Doc, Sib, Kai, Fen with exact x/y positions
- **12 graph edges** — with relationship kinds and weights
- **40-point tension array** — `[3,4,3,5,4,6,5,4,5,6,7,5,4,6,7,8,6,5,7,8,9,7,5,4,6,8,9,8,7,6,5,4,6,7,8,9,10,8,5,3]`
- **3 act markers** — Act I (scene 8), Act II (scene 26), Act III (scene 36)
- **2 peaks** — Midpoint (scene 20, tension 9), Climax (scene 36, tension 10)
- **5 manuscript chapters** — full prose from the wireframe (The Orchard at First Light, Wren, Fourteen Letters, The Cellar, What the Letter Said)
- **5 AI insights** — flat middle, Mara disappearance, Fen's secret, climax earned, court subplot disconnect
- **Narrative core config** — 13-node inheritance tree + 14-row settings table

## 5. Interactions

### Client-side (implemented)
- **View navigation** — TanStack Router, sidebar highlights active route
- **Tweaks panel** — floating bottom-right panel toggled by button; density switch, accent hue slider (remaps `--blue`), annotations on/off, grid on/off
- **Scene Detail modal** — opens on scene card click, navigable with prev/next
- **Setup wizard** — step navigation (back/continue)
- **Graph mode tabs** — Characters/Scenes/Subplots/Mixed switches displayed node set
- **Timeline metric toggles** — checkboxes show/hide curve layers
- **AI Insights category filter** — left nav filters the insight card list

### Not implemented (future passes)
- No drag-and-drop on Scene Board
- No real-time graph animation or time scrubber playback
- No prose editing or AI text generation
- No form submission on Setup wizard
- No authentication, persistence, or API calls
- No brush selection interaction on flagship timeline

## 6. Backend Stub

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="BeatLume API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}
```

`requirements.txt`: `fastapi` and `uvicorn[standard]`

## 7. Development

- Frontend dev server: `cd frontend && npm run dev` (Vite on port 5173)
- Backend dev server: `cd backend && uvicorn app.main:app --reload --port 8000`
- No build step needed for backend in this pass
