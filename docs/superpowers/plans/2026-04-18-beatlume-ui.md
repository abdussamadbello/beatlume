# BeatLume UI-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all 12 BeatLume wireframe views as a static Vite+React frontend with mock data and a FastAPI stub backend.

**Architecture:** Flat two-directory structure (`frontend/` + `backend/`). Frontend uses Vite + React 19 + TypeScript + TanStack Router. All data is hardcoded mock data extracted from the wireframe source files. No backend calls in this pass.

**Tech Stack:** Vite 6, React 19, TypeScript, TanStack Router, CSS (custom design system), FastAPI, Python 3.13

**Design reference:** The wireframe source files are in `.claude/projects/-home-abdussamadbello-beatlume/41cc7b35-1359-4038-b585-7e0a57ec6e10/tool-results/extracted/beatlume/project/`. Read these files for exact layout details, pixel values, and content when implementing each view.

**Spec:** `docs/superpowers/specs/2026-04-18-beatlume-ui-design.md`

---

## Task 1: Scaffold Frontend Project

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.app.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/vite-env.d.ts`

- [ ] **Step 1: Initialize Vite + React + TypeScript project**

```bash
cd /home/abdussamadbello/beatlume
npm create vite@latest frontend -- --template react-ts
```

- [ ] **Step 2: Install dependencies**

```bash
cd /home/abdussamadbello/beatlume/frontend
npm install @tanstack/react-router @tanstack/router-devtools
```

- [ ] **Step 3: Update `frontend/index.html` to load Google Fonts**

Replace the `<head>` content:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BeatLume</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;700&family=Inter+Tight:wght@400;500;600&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Verify the dev server starts**

```bash
cd /home/abdussamadbello/beatlume/frontend && npm run dev
```

Expected: Vite dev server starts on port 5173.

- [ ] **Step 5: Commit**

```bash
cd /home/abdussamadbello/beatlume
git add frontend/
git commit -m "scaffold: Vite + React + TypeScript + TanStack Router frontend"
```

---

## Task 2: Global Styles + CSS Tokens

**Files:**
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/global.css`

- [ ] **Step 1: Create `frontend/src/styles/tokens.css`**

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

  --grid: 8px;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --font-serif: "Instrument Serif", "Times New Roman", serif;
  --font-sans: "Inter Tight", system-ui, sans-serif;
}
```

- [ ] **Step 2: Create `frontend/src/styles/global.css`**

```css
@import './tokens.css';

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--paper); color: var(--ink); font-family: var(--font-mono); font-size: 13px; line-height: 1.45; }
html, body, #root { width: 100%; height: 100%; }

.grid-bg {
  background-image:
    linear-gradient(to right, var(--line-2) 1px, transparent 1px),
    linear-gradient(to bottom, var(--line-2) 1px, transparent 1px);
  background-size: 24px 24px;
}

.grid-bg-fine {
  background-image:
    linear-gradient(to right, rgba(201,197,182,0.35) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(201,197,182,0.35) 1px, transparent 1px);
  background-size: 8px 8px;
}

.mono { font-family: var(--font-mono); }
.serif { font-family: var(--font-serif); }
.dim { color: var(--ink-3); }
.title-serif { font-family: var(--font-serif); font-weight: 400; letter-spacing: -0.01em; }

.rule { border-top: 1px solid var(--ink); }
.rule-dash { border-top: 1px dashed var(--ink-3); }

/* Tweaks panel overrides */
body.no-anno .anno { display: none !important; }
body.no-grid .grid-bg,
body.no-grid .grid-bg-fine { background-image: none !important; }
body.dense { font-size: 12px; }
```

- [ ] **Step 3: Import global styles in `frontend/src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div>BeatLume loading...</div>
  </React.StrictMode>,
)
```

- [ ] **Step 4: Verify styles load** — Start dev server, confirm warm paper background and JetBrains Mono font render.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/ frontend/src/main.tsx
git commit -m "feat: add design system CSS tokens and global styles"
```

---

## Task 3: Shared TypeScript Types

**Files:**
- Create: `frontend/src/types.ts`

- [ ] **Step 1: Create `frontend/src/types.ts`**

```typescript
export interface SceneNode {
  id: string;
  x: number;
  y: number;
  label: string;
  initials: string;
  type?: 'hub' | 'minor';
}

export interface GraphEdge {
  a: string;
  b: string;
  kind: 'conflict' | 'alliance' | 'romance' | 'mentor' | 'secret' | 'family';
  weight: number;
}

export interface Scene {
  n: number;
  title: string;
  pov: string;
  tension: number;
  act: number;
  location: string;
  tag: string;
  summary?: string;
}

export interface Character {
  name: string;
  role: string;
  desire: string;
  flaw: string;
  sceneCount: number;
  longestGap: number;
}

export interface Insight {
  severity: 'red' | 'amber' | 'blue';
  category: string;
  title: string;
  body: string;
  refs: string[];
}

export interface Act { at: number; label: string; }
export interface Peak { at: number; v: number; label: string; }

export interface ManuscriptChapter {
  num: string;
  title: string;
  paras: string[];
}

export interface CoreConfigNode {
  depth: number;
  label: string;
  kind: 'story' | 'part' | 'chap' | 'scene' | 'beat';
  active?: boolean;
}

export interface CoreSetting {
  key: string;
  value: string;
  source: string;
  tag?: string;
}

export type EdgeKind = GraphEdge['kind'];
export type TagVariant = 'blue' | 'amber' | 'red' | 'solid';
export type BtnVariant = 'solid' | 'ghost';
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 4: Primitive Components

**Files:**
- Create: `frontend/src/components/primitives/Tag.tsx`
- Create: `frontend/src/components/primitives/Btn.tsx`
- Create: `frontend/src/components/primitives/Panel.tsx`
- Create: `frontend/src/components/primitives/Label.tsx`
- Create: `frontend/src/components/primitives/Anno.tsx`
- Create: `frontend/src/components/primitives/Placeholder.tsx`
- Create: `frontend/src/components/primitives/Sticky.tsx`
- Create: `frontend/src/components/primitives/index.ts`

- [ ] **Step 1: Create `Tag.tsx`**

```tsx
import type { TagVariant } from '../../types'
import type { ReactNode } from 'react'

const variantStyles: Record<string, React.CSSProperties> = {
  blue: { borderColor: 'var(--blue)', color: 'var(--blue)' },
  amber: { borderColor: 'var(--amber)', color: 'oklch(0.45 0.12 75)' },
  red: { borderColor: 'var(--red)', color: 'var(--red)' },
  solid: { background: 'var(--ink)', color: 'var(--paper)' },
}

export function Tag({ variant, children, style }: { variant?: TagVariant; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 7px',
        border: '1px solid var(--ink)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        background: 'var(--paper)',
        ...variantStyles[variant ?? ''],
        ...style,
      }}
    >
      {children}
    </span>
  )
}
```

- [ ] **Step 2: Create `Btn.tsx`**

```tsx
import type { BtnVariant } from '../../types'
import type { ReactNode, CSSProperties } from 'react'

export function Btn({ variant, children, style, onClick }: { variant?: BtnVariant; children: ReactNode; style?: CSSProperties; onClick?: () => void }) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    border: '1px solid var(--ink)',
    background: 'var(--paper)',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    cursor: 'pointer',
  }
  if (variant === 'solid') {
    base.background = 'var(--ink)'
    base.color = 'var(--paper)'
  }
  if (variant === 'ghost') {
    base.borderColor = 'var(--ink-3)'
    base.color = 'var(--ink-2)'
  }
  return <span style={{ ...base, ...style }} onClick={onClick}>{children}</span>
}
```

- [ ] **Step 3: Create `Panel.tsx`**

```tsx
import type { ReactNode, CSSProperties } from 'react'

export function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ border: '1px solid var(--line)', background: 'var(--paper)', ...style }}>
      {children}
    </div>
  )
}

export function PanelHead({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--ink-3)',
      }}
    >
      <span>{left}</span>
      {right && <span>{right}</span>}
    </div>
  )
}
```

- [ ] **Step 4: Create `Label.tsx`**

```tsx
import type { ReactNode, CSSProperties } from 'react'

export function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--ink-3)',
        ...style,
      }}
    >
      {children}
    </span>
  )
}
```

- [ ] **Step 5: Create `Anno.tsx`**

```tsx
import type { ReactNode, CSSProperties } from 'react'

const colorMap: Record<string, string> = {
  blue: 'var(--blue)',
  amber: 'oklch(0.45 0.12 75)',
  red: 'var(--red)',
}

export function Anno({ variant, children, style }: { variant?: 'blue' | 'amber' | 'red'; children: ReactNode; style?: CSSProperties }) {
  const color = variant ? colorMap[variant] : 'var(--ink)'
  return (
    <div
      className="anno"
      style={{
        position: 'absolute',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        background: 'var(--paper)',
        border: `1px solid ${variant ? color : 'var(--ink)'}`,
        color,
        padding: '2px 6px',
        letterSpacing: '0.04em',
        zIndex: 4,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 6: Create `Placeholder.tsx`**

```tsx
import type { CSSProperties } from 'react'

export function Placeholder({ label, style }: { label?: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: 'repeating-linear-gradient(135deg, transparent 0 6px, rgba(26,29,36,0.08) 6px 7px)',
        border: '1px dashed var(--ink-3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--ink-3)',
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {label}
    </div>
  )
}
```

- [ ] **Step 7: Create `Sticky.tsx`**

```tsx
import type { ReactNode, CSSProperties } from 'react'

const variantStyles: Record<string, CSSProperties> = {
  amber: { background: 'var(--amber-soft)', borderColor: 'oklch(0.45 0.12 75)' },
  blue: { background: 'var(--blue-soft)', borderColor: 'var(--blue)' },
  red: { background: 'var(--red-soft)', borderColor: 'var(--red)' },
}

export function Sticky({ variant, children, style }: { variant?: 'amber' | 'blue' | 'red'; children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--ink)',
        padding: '8px 10px',
        fontSize: 11,
        position: 'relative',
        ...variantStyles[variant ?? ''],
        ...style,
      }}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 8: Create barrel export `index.ts`**

```typescript
export { Tag } from './Tag'
export { Btn } from './Btn'
export { Panel, PanelHead } from './Panel'
export { Label } from './Label'
export { Anno } from './Anno'
export { Placeholder } from './Placeholder'
export { Sticky } from './Sticky'
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/primitives/
git commit -m "feat: add primitive components (Tag, Btn, Panel, Label, Anno, Placeholder, Sticky)"
```

---

## Task 5: Chrome Components (AppShell, Sidebar, ChromeTop, CmdInput)

**Files:**
- Create: `frontend/src/components/chrome/Sidebar.tsx`
- Create: `frontend/src/components/chrome/AppShell.tsx`
- Create: `frontend/src/components/chrome/ChromeTop.tsx`
- Create: `frontend/src/components/chrome/CmdInput.tsx`
- Create: `frontend/src/components/chrome/index.ts`

- [ ] **Step 1: Create `Sidebar.tsx`**

Reference: wireframe file `views/00-primitives.js` lines 81-109 for the `BL.sidebar` function. Replicate the exact structure: logo, title, "Planning" section (Overview, Scene Board, Graph, Timeline, Characters, Narrative Core), "Assistant" section (AI Insights, Draft, Manuscript), autosaved footer.

```tsx
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

interface SidebarItem {
  key: string;
  label: string;
  count: string;
  to: string;
}

const planningItems: SidebarItem[] = [
  { key: 'overview', label: 'Overview', count: '12', to: '/' },
  { key: 'scenes', label: 'Scene Board', count: '47', to: '/scenes' },
  { key: 'graph', label: 'Graph', count: '', to: '/graph' },
  { key: 'timeline', label: 'Timeline', count: '', to: '/timeline' },
  { key: 'characters', label: 'Characters', count: '14', to: '/characters' },
  { key: 'core', label: 'Narrative Core', count: '', to: '/core' },
]

const assistantItems: SidebarItem[] = [
  { key: 'ai', label: 'AI Insights', count: '3', to: '/ai' },
  { key: 'draft', label: 'Draft', count: '18k', to: '/draft' },
  { key: 'manuscript', label: 'Manuscript', count: '72k', to: '/manuscript' },
]

export function Sidebar({ active, title = 'A Stranger in the Orchard' }: { active: string; title?: string }) {
  const renderItem = (item: SidebarItem) => (
    <Link
      key={item.key}
      to={item.to}
      style={{
        padding: '8px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        cursor: 'pointer',
        fontSize: 12,
        borderLeft: `2px solid ${item.key === active ? 'var(--blue)' : 'transparent'}`,
        background: item.key === active ? 'var(--paper-2)' : 'transparent',
        fontWeight: item.key === active ? 500 : 400,
        color: 'var(--ink)',
        textDecoration: 'none',
      }}
    >
      {item.label}
      <span style={{ color: 'var(--ink-3)', fontSize: 10 }}>{item.count}</span>
    </Link>
  )

  return (
    <div style={{
      borderRight: '1px solid var(--ink)',
      padding: '16px 0',
      background: 'var(--paper)',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      height: '100%',
    }}>
      <div style={{ padding: '0 16px 12px', borderBottom: '1px solid var(--line)' }}>
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 18,
          letterSpacing: '-0.01em',
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
        }}>
          BeatLume
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 6 }}>{title}</div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
          marginTop: 4,
        }}>
          Draft 3 · Act II
        </div>
      </div>
      <div style={{ padding: '6px 16px', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 12 }}>Planning</div>
      {planningItems.map(renderItem)}
      <div style={{ padding: '6px 16px', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 12 }}>Assistant</div>
      {assistantItems.map(renderItem)}
      <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid var(--line)', fontSize: 10, color: 'var(--ink-3)' }}>
        Autosaved · 14:02
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `AppShell.tsx`**

```tsx
import type { ReactNode } from 'react'

export function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '200px 1fr',
      height: '100vh',
      width: '100%',
    }}>
      {sidebar}
      <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `ChromeTop.tsx`**

Reference: wireframe `00-primitives.js` lines 33-78.

```tsx
import type { ReactNode } from 'react'

export function ChromeTop({ title, crumbs, actions }: { title: string; crumbs: string; actions?: ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 24px',
      borderBottom: '1px solid var(--ink)',
      background: 'var(--paper)',
    }}>
      <div style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 22,
        letterSpacing: '-0.01em',
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
      }}>
        BeatLume{' '}
        <small style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.08em',
          color: 'var(--ink-3)',
          textTransform: 'uppercase',
        }}>
          {title}
        </small>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}>
          {crumbs}
        </span>
        {actions}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `CmdInput.tsx`**

```tsx
export function CmdInput({ placeholder = 'Jump to scene, character, or ask AI...' }: { placeholder?: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 14px',
      border: '1px solid var(--ink)',
      background: 'var(--paper)',
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      minWidth: 460,
    }}>
      <span style={{ color: 'var(--ink-3)' }}>{placeholder}</span>
      <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>⌘K</span>
    </div>
  )
}
```

- [ ] **Step 5: Create barrel export `index.ts`**

```typescript
export { Sidebar } from './Sidebar'
export { AppShell } from './AppShell'
export { ChromeTop } from './ChromeTop'
export { CmdInput } from './CmdInput'
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/chrome/
git commit -m "feat: add chrome components (AppShell, Sidebar, ChromeTop, CmdInput)"
```

---

## Task 6: TensionCurve Chart Component

**Files:**
- Create: `frontend/src/components/charts/TensionCurve.tsx`

Reference: wireframe `00-primitives.js` lines 159-177 for the `BL.curve` function. Exact SVG rendering logic.

- [ ] **Step 1: Create `TensionCurve.tsx`**

```tsx
import type { Act, Peak } from '../../types'

interface TensionCurveProps {
  data: number[];
  acts?: Act[];
  peaks?: Peak[];
  fill?: string;
  stroke?: string;
  label?: string;
  width?: number;
  height?: number;
}

export function TensionCurve({
  data,
  acts = [],
  peaks = [],
  fill = 'none',
  stroke = 'var(--ink)',
  label = '',
  width: w = 800,
  height: h = 200,
}: TensionCurveProps) {
  const n = data.length
  const xAt = (i: number) => (i / (n - 1)) * (w - 40) + 30
  const yAt = (v: number) => h - 20 - (v / 10) * (h - 40)
  const path = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(v)}`).join(' ')
  const area = `${path} L ${xAt(n - 1)},${h - 20} L ${xAt(0)},${h - 20} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: 'block' }}>
      {/* Horizontal gridlines */}
      {[0, 2, 4, 6, 8, 10].map(v => (
        <g key={v}>
          <line x1={30} x2={w - 10} y1={yAt(v)} y2={yAt(v)} stroke="#DDD9CB" strokeWidth={1} />
          <text x={22} y={yAt(v) + 3} textAnchor="end" fontFamily="var(--font-mono)" fontSize={9} fill="var(--ink-3)">{v}</text>
        </g>
      ))}
      {/* Act dividers */}
      {acts.map((a, i) => (
        <g key={i}>
          <line x1={xAt(a.at)} x2={xAt(a.at)} y1={10} y2={h - 20} stroke="var(--ink)" strokeDasharray="2 3" strokeWidth={1} />
          <text x={xAt(a.at) + 4} y={18} fontFamily="var(--font-mono)" fontSize={10} fill="var(--ink)">{a.label}</text>
        </g>
      ))}
      {/* Fill area */}
      {fill !== 'none' && <path d={area} fill={fill} opacity={0.25} />}
      {/* Main line */}
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} />
      {/* Peak markers */}
      {peaks.map((p, i) => (
        <g key={i}>
          <circle cx={xAt(p.at)} cy={yAt(p.v)} r={4} fill="var(--paper)" stroke={stroke} strokeWidth={1.5} />
          <text x={xAt(p.at)} y={yAt(p.v) - 8} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9} fill={stroke}>{p.label}</text>
        </g>
      ))}
      {/* Label */}
      {label && (
        <text x={30} y={14} fontFamily="var(--font-mono)" fontSize={9} fill="var(--ink-3)" letterSpacing={1}>
          {label.toUpperCase()}
        </text>
      )}
    </svg>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/charts/TensionCurve.tsx
git commit -m "feat: add TensionCurve SVG chart component"
```

---

## Task 7: GraphRenderer Chart Component

**Files:**
- Create: `frontend/src/components/charts/GraphRenderer.tsx`
- Create: `frontend/src/components/charts/index.ts`

Reference: wireframe `00-primitives.js` lines 113-156 for the `BL.graph` function.

- [ ] **Step 1: Create `GraphRenderer.tsx`**

```tsx
import type { SceneNode, GraphEdge, EdgeKind } from '../../types'

interface GraphRendererProps {
  nodes: SceneNode[];
  edges: GraphEdge[];
  width?: number;
  height?: number;
}

const edgeColorMap: Record<EdgeKind, string> = {
  conflict: 'var(--red)',
  alliance: 'var(--blue)',
  romance: 'oklch(0.62 0.14 350)',
  mentor: 'var(--ink)',
  secret: 'var(--ink-3)',
  family: 'var(--green)',
}

const edgeDash: Record<EdgeKind, string> = {
  conflict: '6 3',
  alliance: 'none',
  romance: 'none',
  mentor: 'none',
  secret: '3 3',
  family: 'none',
}

export function GraphRenderer({ nodes, edges, width: w = 640, height: h = 460 }: GraphRendererProps) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: 'block' }}>
      <defs>
        <pattern id="dot-grid" x={0} y={0} width={16} height={16} patternUnits="userSpaceOnUse">
          <circle cx={1} cy={1} r={0.8} fill="#C9C5B6" />
        </pattern>
      </defs>
      <rect width={w} height={h} fill="url(#dot-grid)" />
      {/* Edges */}
      {edges.map((e, i) => {
        const a = byId[e.a]
        const b = byId[e.b]
        if (!a || !b) return null
        return (
          <path
            key={i}
            d={`M${a.x},${a.y} L${b.x},${b.y}`}
            stroke={edgeColorMap[e.kind]}
            strokeWidth={Math.max(1, e.weight)}
            strokeDasharray={edgeDash[e.kind]}
            fill="none"
          />
        )
      })}
      {/* Nodes */}
      {nodes.map(n => {
        const r = n.type === 'hub' ? 22 : n.type === 'minor' ? 12 : 17
        const fill = n.type === 'hub' ? 'var(--ink)' : 'var(--paper)'
        const nodeStroke = n.type === 'minor' ? 'var(--ink-3)' : 'var(--ink)'
        const textColor = n.type === 'hub' ? 'var(--paper)' : 'var(--ink)'
        return (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={r} fill={fill} stroke={nodeStroke} strokeWidth={1.5} />
            <text x={n.x} y={n.y + 3} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9} fill={textColor} fontWeight={500}>
              {n.initials}
            </text>
            <text x={n.x} y={n.y + r + 12} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} fill="var(--ink-2)">
              {n.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
```

- [ ] **Step 2: Create barrel export `index.ts`**

```typescript
export { TensionCurve } from './TensionCurve'
export { GraphRenderer } from './GraphRenderer'
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/charts/
git commit -m "feat: add GraphRenderer SVG chart component"
```

---

## Task 8: Mock Data Modules

**Files:**
- Create: `frontend/src/data/scenes.ts`
- Create: `frontend/src/data/characters.ts`
- Create: `frontend/src/data/graph.ts`
- Create: `frontend/src/data/tension.ts`
- Create: `frontend/src/data/chapters.ts`
- Create: `frontend/src/data/insights.ts`
- Create: `frontend/src/data/core.ts`
- Create: `frontend/src/data/index.ts`

- [ ] **Step 1: Create `scenes.ts`**

Extract from wireframe `00-primitives.js` lines 211-221 for the 8 sample scenes. Generate the remaining 39 with the same fields.

```typescript
import type { Scene } from '../types'

export const sampleScenes: Scene[] = [
  { n: 1, title: 'Orchard at dawn', pov: 'Iris', tension: 3, act: 1, location: 'Orchard', tag: 'Setup' },
  { n: 2, title: 'The letter from Col.', pov: 'Iris', tension: 5, act: 1, location: 'Kitchen', tag: 'Inciting' },
  { n: 3, title: 'Wren returns, uninvited', pov: 'Iris', tension: 6, act: 1, location: 'Porch', tag: 'Conflict' },
  { n: 4, title: 'Mara dismisses the rumor', pov: 'Iris', tension: 4, act: 1, location: 'Barn', tag: 'Quiet' },
  { n: 5, title: 'Jon watches from the ridge', pov: 'Jon', tension: 5, act: 2, location: 'Ridge', tag: 'Shift' },
  { n: 6, title: "Kai's warning", pov: 'Iris', tension: 7, act: 2, location: 'Cellar', tag: 'Escalation' },
  { n: 7, title: 'Fen lies to Doc', pov: 'Fen', tension: 6, act: 2, location: 'Clinic', tag: 'Deception' },
  { n: 8, title: 'Night — the first fire', pov: 'Iris', tension: 9, act: 2, location: 'Orchard', tag: 'Turn' },
]

// Extended scene list used by Scene Board kanban
export const allScenes: Scene[] = [
  ...sampleScenes.slice(0, 4),
  ...sampleScenes.slice(4, 8),
  { n: 9, title: 'Morning ashes', pov: 'Iris', tension: 6, act: 2, location: 'Orchard', tag: 'Aftermath' },
  { n: 10, title: 'Cole at the court', pov: 'Cole', tension: 5, act: 2, location: 'Court', tag: 'Subplot' },
  { n: 11, title: 'Root cellar', pov: 'Iris', tension: 8, act: 2, location: 'Cellar', tag: 'Escalation' },
  { n: 12, title: 'Confession', pov: 'Iris', tension: 10, act: 3, location: 'Kitchen', tag: 'Climax' },
  { n: 13, title: 'The orchard emptied', pov: 'Iris', tension: 5, act: 3, location: 'Orchard', tag: 'Resolution' },
]
```

- [ ] **Step 2: Create `characters.ts`**

```typescript
import type { Character } from '../types'

export const characters: Character[] = [
  { name: 'Iris', role: 'Protagonist', desire: 'To prove her sister didn\'t leave', flaw: 'Cannot trust easily', sceneCount: 40, longestGap: 0 },
  { name: 'Wren', role: 'Foil', desire: 'To reopen the case', flaw: 'Obsession', sceneCount: 24, longestGap: 3 },
  { name: 'Cole', role: 'Antagonist', desire: 'To keep the orchard bound to his name', flaw: 'Pride', sceneCount: 22, longestGap: 5 },
  { name: 'Jon', role: 'Mirror', desire: 'To belong somewhere', flaw: 'Silence', sceneCount: 18, longestGap: 4 },
  { name: 'Mara', role: 'Family', desire: 'To keep peace', flaw: 'Denial', sceneCount: 12, longestGap: 9 },
  { name: 'Kai', role: 'Mentor', desire: 'To be believed', flaw: 'Fatigue', sceneCount: 9, longestGap: 8 },
  { name: 'Fen', role: 'Ward', desire: 'To be forgiven', flaw: 'Deception', sceneCount: 8, longestGap: 12 },
  { name: 'Doc', role: 'Witness', desire: 'To retire quietly', flaw: 'Avoidance', sceneCount: 6, longestGap: 15 },
  { name: 'Sib', role: 'Pawn', desire: 'To survive the family', flaw: 'Compliance', sceneCount: 6, longestGap: 11 },
  { name: 'Old Man', role: 'Ghost', desire: 'To be remembered', flaw: 'Absence', sceneCount: 4, longestGap: 18 },
]
```

- [ ] **Step 3: Create `graph.ts`**

```typescript
import type { SceneNode, GraphEdge } from '../types'

export const sampleNodes: SceneNode[] = [
  { id: 'iris', x: 320, y: 230, label: 'Iris', initials: 'IR', type: 'hub' },
  { id: 'wren', x: 180, y: 140, label: 'Wren', initials: 'WR' },
  { id: 'cole', x: 480, y: 140, label: 'Col.', initials: 'CL' },
  { id: 'mara', x: 180, y: 320, label: 'Mara', initials: 'MA' },
  { id: 'jon', x: 480, y: 320, label: 'Jon', initials: 'JN' },
  { id: 'doc', x: 80, y: 230, label: 'Doc', initials: 'DC', type: 'minor' },
  { id: 'sib', x: 560, y: 230, label: 'Sib', initials: 'SB', type: 'minor' },
  { id: 'kai', x: 320, y: 80, label: 'Kai', initials: 'KA' },
  { id: 'fen', x: 320, y: 400, label: 'Fen', initials: 'FN', type: 'minor' },
]

export const sampleEdges: GraphEdge[] = [
  { a: 'iris', b: 'wren', kind: 'alliance', weight: 3 },
  { a: 'iris', b: 'cole', kind: 'conflict', weight: 3 },
  { a: 'iris', b: 'mara', kind: 'family', weight: 2 },
  { a: 'iris', b: 'jon', kind: 'romance', weight: 2 },
  { a: 'iris', b: 'kai', kind: 'mentor', weight: 2 },
  { a: 'iris', b: 'fen', kind: 'secret', weight: 1 },
  { a: 'wren', b: 'cole', kind: 'conflict', weight: 2 },
  { a: 'cole', b: 'jon', kind: 'alliance', weight: 2 },
  { a: 'mara', b: 'doc', kind: 'family', weight: 1 },
  { a: 'jon', b: 'sib', kind: 'alliance', weight: 1 },
  { a: 'kai', b: 'wren', kind: 'secret', weight: 1 },
  { a: 'cole', b: 'sib', kind: 'mentor', weight: 1 },
]
```

- [ ] **Step 4: Create `tension.ts`**

```typescript
import type { Act, Peak } from '../types'

export const tensionData: number[] = [3,4,3,5,4,6,5,4,5,6,7,5,4,6,7,8,6,5,7,8,9,7,5,4,6,8,9,8,7,6,5,4,6,7,8,9,10,8,5,3]

export const sampleActs: Act[] = [
  { at: 8, label: 'ACT I' },
  { at: 26, label: 'ACT II' },
  { at: 36, label: 'ACT III' },
]

export const samplePeaks: Peak[] = [
  { at: 20, v: 9, label: 'Midpoint' },
  { at: 36, v: 10, label: 'Climax' },
]
```

- [ ] **Step 5: Create `chapters.ts`**

Copy the full prose from wireframe `12-manuscript.js` lines 3-84 (`BL.manuscriptChapters`).

```typescript
import type { ManuscriptChapter } from '../types'

export const manuscriptChapters: ManuscriptChapter[] = [
  {
    num: 'One',
    title: 'The Orchard at First Light',
    paras: [
      'There was a time, Iris thought, when the orchard had belonged to nobody in particular and therefore to her. Her father had walked it that way; her mother, at the end, had spoken of it that way, in the long slow sentences the morphine had given her. Now the orchard was a matter of paper, and the paper was in a drawer in Helena, and the paper had begun, quietly, to write itself.',
      'She was forty-three the morning the letter came. The woman from the rural route left it in the box with a catalogue and a flyer for a new church, as if the three things were all of one weight. Iris read it standing in the gravel, in the wind that always came off the foothills at that hour, and when she had finished reading it she read it again, because she had understood it perfectly the first time and wanted the sentence to be the other kind of sentence instead.',
      'The orchard, the letter said, would be sold. There was a buyer. The buyer was patient but not, in the lawyer\'s phrasing, <em>infinitely</em> patient. There was a date. The date was in April.',
      'Iris folded the letter along the seam the envelope had given it, put it in the pocket of her apron, and walked into the trees.',
    ],
  },
  {
    num: 'Two',
    title: 'Wren',
    paras: [
      'The porch boards complained under his boots before she saw him, which meant she had ten seconds to pretend the letter had never come. Iris folded it twice along a seam already tired from folding, slid it into the pocket of her apron, and wiped her hands on the same apron as if flour, not paper, were the thing she needed to get rid of.',
      '"You\'re early," she said, without turning.',
      '"I\'m not early, Iris. You\'ve just been expecting me for eleven years."',
      'She turned then, because not turning would have been the louder answer. Wren looked older in the unkind way men sometimes did \u2014 not weathered, exactly, but <em>used</em>, as if the intervening years had handled him roughly and put him back in a different order. He was still tall. He still stood with one shoulder forward, as if listening for a door he did not trust.',
      '"You shouldn\'t be on this porch."',
      '"I know." He did not move. "I read about Cole."',
      'The name, said aloud by him, landed somewhere below her ribs. She waited for it to finish landing.',
      '"Read where."',
      '"A paper in Billings. A small one. I wouldn\'t have seen it except a woman I used to \u2014 " he stopped, decided against the sentence, and tried a different one. "Someone sent it to me. I came as soon as I could, which wasn\'t soon."',
      '"He\'s been gone four months."',
      '"I know that too." He looked past her, at the orchard, and the old habit of his face \u2014 the small tightening at the jaw before a truth he didn\'t want to tell \u2014 arrived exactly where she remembered it. "Iris. The orchard."',
      '"Don\'t."',
      '"The lawyer in Helena has been writing to the wrong address for months. That\'s why you haven\'t had the letters. They\'ve been going to <em>my</em> mother, because my father\'s name is on the deed and nobody bothered to update it in 1974. She kept them. All of them. I have them in the truck."',
      'The wind moved in the apple trees, and for a second the whole yard seemed to tilt toward the road.',
      '"How many letters."',
      '"Fourteen."',
    ],
  },
  {
    num: 'Three',
    title: 'Fourteen Letters',
    paras: [
      'They laid them on the kitchen table in the order Wren\'s mother had kept them, which was no order at all. Iris sorted them by postmark while Wren made coffee the way her mother used to make it, one heaping spoon and a pinch of salt, as if he had never left the house.',
      'The earliest letter was from August. The most recent had been written nine days ago. She read them in sequence. The lawyer\'s sentences tightened as they went; by the tenth letter the word <em>options</em> had disappeared and the word <em>deadline</em> had moved to the first paragraph.',
      '"There\'s a number here," Wren said, from the stove. "A man in Bozeman. It says he\'s prepared to close in thirty days."',
      '"I see it."',
      '"Iris, the reason he\'s prepared to close in thirty days is that he has already been told he can."',
      'She set the eleventh letter down on top of the tenth. Outside the window the orchard was doing what it did in November, which was nothing, which was everything.',
      '"Who told him he could, Wren."',
      'He poured the coffee into the two cups she had set out without thinking, and when he turned back to her he was holding the cups like evidence.',
      '"I don\'t know yet," he said. "But I think we should find out before the thirty days do."',
    ],
  },
  {
    num: 'Four',
    title: 'The Cellar',
    paras: [
      'Kai had always known when to keep his distance and when the distance itself became the tell. Tonight he stood close enough that Iris could smell the cellar on him \u2014 the old apples, the kerosene, the cold-stone smell that the house carried in its bones no matter what season pretended to run above it.',
      '"Your sister wrote to me," he said.',
      '"My sister is dead, Kai."',
      '"Yes," he said, "but she wrote to me <em>after</em>."',
      'Iris set the lamp down on the shelf where the preserves had been, back when there were preserves. The glass caught the wick and threw a yellow shape against the far wall that looked, for a confusing second, like a person sitting down.',
      '"Show me."',
      'He didn\'t reach into his coat the way a man would for a wallet or a gun. He reached carefully, the way you reach for something that might still be alive. The envelope was thin, its corners soft from being carried. The hand on the front was her sister\'s \u2014 the looping <em>I</em>, the pressed-down <em>r</em>, the little comma after her name that Mara had put there since she was nine and had never grown out of.',
      '"Where was it."',
      '"Inside a book she sent my mother the Christmas before. My mother only found it last month. She thought I\'d want to bring it to you myself instead of mailing, and I thought she was wrong about that, but here I am anyway."',
      'Iris did not open it. She held the envelope flat against her palm and felt the weight of the paper inside \u2014 two sheets, maybe three, folded the way Mara had always folded, lengthwise first and then across, so the creases made a cross you could feel with your thumb.',
      '"Kai. When did she write this."',
      'He looked at her, and the thing in his face was not pity, which she could have refused, but something older and harder to send away.',
      '"Three days before."',
    ],
  },
  {
    num: 'Five',
    title: 'What the Letter Said',
    paras: [
      'She read it twice before she let herself understand it, and then a third time to be sure the understanding was not a wish. Mara had written in the voice she used for hard things, which was the voice of someone else \u2014 a lawyer, a priest, a woman on the radio. The handwriting was Mara\'s. The sentences were not.',
      '<em>If you are reading this,</em> the letter began, <em>then I have given the orchard away by mistake, and you will need to take it back.</em>',
      'There was an address. There was a name Iris had never seen written down. There was a line, near the end, that she would remember later as the line the rest of the year was trying to explain:',
      '<em>Do not let Cole know I wrote. He believes I agreed.</em>',
      'Kai was standing at the foot of the cellar stairs with his hands in his pockets, looking at nothing in particular, which was how he looked at the things he most wanted to see.',
      '"Iris."',
      '"One minute, Kai."',
      'She folded the letter back along its creases. Upstairs the house made the small settling sounds it made at this hour, the sounds her mother used to call <em>the house thinking</em>. Iris listened to them for a moment and then, quietly, began to think back.',
    ],
  },
]
```

- [ ] **Step 6: Create `insights.ts`**

```typescript
import type { Insight } from '../types'

export const insights: Insight[] = [
  {
    severity: 'red',
    category: 'Pacing',
    title: 'Flat middle: scenes 18\u201323',
    body: 'Six consecutive scenes hold tension between 3 and 4. The same two characters (Iris, Mara) argue variations on the same topic. Consider pulling the cellar reveal (S32) earlier, or inserting an aftermath after S08 fire.',
    refs: ['S18', 'S19', 'S20', 'S21', 'S22', 'S23'],
  },
  {
    severity: 'amber',
    category: 'Characters',
    title: 'Mara disappears for 9 scenes',
    body: 'Mara is present in S01\u2013S12, then absent until S22. Longest character absence. Her last appearance (S12) does not read as an off-screen exit.',
    refs: ['Mara', 'S12', 'S22'],
  },
  {
    severity: 'amber',
    category: 'Relationships',
    title: "Fen\u2019s secret edge never pays off",
    body: 'Edge Iris \u2194 Fen is typed "secret" but no scene discharges it. A reveal slot between S26\u2013S30 would match the rising curve and align with the stream.',
    refs: ['Iris\u2194Fen', 'S26', 'S30'],
  },
  {
    severity: 'blue',
    category: 'Climax',
    title: 'Climax feels earned',
    body: 'S37 peak is supported by 4 consecutive scenes escalating tension 6\u219210 and two new graph edges forming at S32 and S35. No suggested change.',
    refs: ['S32', 'S35', 'S37'],
  },
  {
    severity: 'amber',
    category: 'Subplots',
    title: 'Court subplot disconnects at Ch. 9',
    body: "Cole\u2019s court thread has no shared scenes with the main plot after S18. Either bring Iris to court or cut Cole\u2019s scene S15.",
    refs: ['Cole', 'Court', 'S15', 'S18'],
  },
]
```

- [ ] **Step 7: Create `core.ts`**

```typescript
import type { CoreConfigNode, CoreSetting } from '../types'

export const configTree: CoreConfigNode[] = [
  { depth: 0, label: 'Story \u00b7 A Stranger in the Orchard', kind: 'story' },
  { depth: 1, label: 'Part I', kind: 'part' },
  { depth: 2, label: 'Chapter 1 \u00b7 Arrival', kind: 'chap' },
  { depth: 3, label: 'S01 Orchard at dawn', kind: 'scene' },
  { depth: 3, label: 'S02 The letter', kind: 'scene' },
  { depth: 4, label: 'Beat \u00b7 Iris opens the envelope', kind: 'beat' },
  { depth: 4, label: 'Beat \u00b7 decides to answer', kind: 'beat' },
  { depth: 3, label: 'S03 Wren returns', kind: 'scene' },
  { depth: 2, label: 'Chapter 2 \u00b7 Rumors', kind: 'chap' },
  { depth: 3, label: 'S04 Mara dismisses', kind: 'scene', active: true },
  { depth: 3, label: 'S05 Jon on the ridge', kind: 'scene' },
  { depth: 1, label: 'Part II', kind: 'part' },
  { depth: 2, label: 'Chapter 3 \u00b7 Fire', kind: 'chap' },
]

export const configSettings: CoreSetting[] = [
  { key: 'Genre', value: 'Literary / Mystery', source: 'Story' },
  { key: 'Default POV', value: 'Close third', source: 'Story' },
  { key: 'POV', value: 'Iris', source: 'Scene', tag: 'override' },
  { key: 'Location', value: 'Barn', source: 'Scene' },
  { key: 'Tone', value: 'Restrained, elegiac', source: 'Chapter' },
  { key: 'World rules', value: 'No supernatural', source: 'Story' },
  { key: 'Target tension band', value: '4\u20136', source: 'Chapter' },
  { key: 'Tension score', value: '4', source: 'Scene (manual)' },
  { key: 'Subplot link', value: 'Sister disappearance', source: 'Scene' },
  { key: 'Goal', value: 'Put Wren off the scent', source: 'Scene' },
  { key: 'Conflict', value: "Mara's denial vs Iris' doubt", source: 'Scene' },
  { key: 'Outcome', value: 'Tension unresolved', source: 'Scene' },
  { key: 'Metrics enabled', value: 'Tension, Emotional, Mystery', source: 'Story' },
  { key: 'Beat structure', value: 'Optional', source: 'Story' },
]
```

- [ ] **Step 8: Create barrel export `index.ts`**

```typescript
export { sampleScenes, allScenes } from './scenes'
export { characters } from './characters'
export { sampleNodes, sampleEdges } from './graph'
export { tensionData, sampleActs, samplePeaks } from './tension'
export { manuscriptChapters } from './chapters'
export { insights } from './insights'
export { configTree, configSettings } from './core'
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/data/
git commit -m "feat: add mock data modules (scenes, characters, graph, tension, chapters, insights, core)"
```

---

## Task 9: TanStack Router Setup + App Shell

**Files:**
- Create: `frontend/src/routes/__root.tsx`
- Create: `frontend/src/routes/index.tsx` (placeholder)
- Modify: `frontend/src/main.tsx`
- Create: `frontend/src/routeTree.gen.ts` (or manual route tree)

- [ ] **Step 1: Set up TanStack Router with file-based routing**

Install the Vite plugin:

```bash
cd /home/abdussamadbello/beatlume/frontend
npm install @tanstack/router-plugin
```

- [ ] **Step 2: Update `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    TanStackRouterVite({ quoteStyle: 'single' }),
    react(),
  ],
})
```

- [ ] **Step 3: Create `frontend/src/routes/__root.tsx`**

```tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => <Outlet />,
})
```

- [ ] **Step 4: Create `frontend/src/routes/index.tsx`** (placeholder Overview)

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => <div>Overview — coming soon</div>,
})
```

- [ ] **Step 5: Update `frontend/src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './styles/global.css'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
```

- [ ] **Step 6: Start dev server and verify route generation works**

```bash
cd /home/abdussamadbello/beatlume/frontend && npm run dev
```

Expected: Vite starts, `routeTree.gen.ts` auto-generated, homepage shows "Overview — coming soon".

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: set up TanStack Router with file-based routing"
```

---

## Task 10: Overview View

**Files:**
- Modify: `frontend/src/routes/index.tsx`

Reference: wireframe `views/01-overview.js` — Variation A (sidebar mosaic).

- [ ] **Step 1: Implement the Overview page**

Replace `frontend/src/routes/index.tsx` with the full Overview view. This uses `AppShell`, `Sidebar`, `TensionCurve`, `Panel`, `PanelHead`, `Tag`, `Label`. Displays: story title, logline, genre tags, tension curve, AI flag card, 4 stat tiles, recent scenes list, character presence heatmap.

Read the wireframe source (`views/01-overview.js` Variation A render function, lines 10-106) for exact layout, spacing, and content. Translate the inline HTML strings to React JSX, using the primitive components.

- [ ] **Step 2: Verify in browser** — Start dev server, navigate to `/`. Confirm layout matches wireframe Variation A.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/index.tsx
git commit -m "feat: add Overview dashboard view"
```

---

## Task 11: Scene Board View

**Files:**
- Create: `frontend/src/routes/scenes.tsx`

Reference: wireframe `views/02-scene-board.js` — Variation A (kanban by act).

- [ ] **Step 1: Create the Scene Board route**

Implements the kanban layout with three Act columns. Each scene card has a POV-colored left border, scene number, POV label, serif title, 10-segment tension bar. Uses `AppShell`, `Sidebar`, `Btn`, `Label`.

Read wireframe source (`views/02-scene-board.js` Variation A, lines 10-77) for exact scene data, card layout, column structure, and the `povColor` helper. The `allScenes` mock data provides 13 scenes across 3 acts.

- [ ] **Step 2: Verify in browser** — Navigate to `/scenes`. Confirm kanban columns, card styling, tension bars.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/scenes.tsx
git commit -m "feat: add Scene Board kanban view"
```

---

## Task 12: Graph View

**Files:**
- Create: `frontend/src/routes/graph.tsx`

Reference: wireframe `views/03-graph.js` — Variation A (force layout + inline legends).

- [ ] **Step 1: Create the Graph route**

Implements: mode toggle tabs (Characters/Scenes/Subplots/Mixed), `GraphRenderer` (920x560, nodes scaled by `x*1.4+40, y*1.22`), right panel with edge kind legend (6 types with colored line samples), filter checkboxes, selected node info. Bottom time scrubber with act dividers. Three `Anno` pills.

Read wireframe source (`views/03-graph.js` Variation A, lines 10-80) for exact node scaling, legend entries, filter labels, and time scrubber layout.

- [ ] **Step 2: Verify in browser** — Navigate to `/graph`. Confirm graph renders with correct nodes/edges, legend, annotations.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/graph.tsx
git commit -m "feat: add Graph relationship view"
```

---

## Task 13: Timeline View

**Files:**
- Create: `frontend/src/routes/timeline.tsx`

Reference: wireframe `views/04-timeline.js` — Variation A (classic line + AI annotations).

- [ ] **Step 1: Create the Timeline route**

Implements: large `TensionCurve` (960x360) with 4 `Anno` pills, scene heatmap strip (40 cells), emotional intensity overlay curve, right panel with 7 metric layer toggles, source mode segmented control, inferred markers list.

Read wireframe source (`views/04-timeline.js` Variation A, lines 10-76) for exact layout, annotation positions, metric toggle labels with colors, and marker list entries.

- [ ] **Step 2: Verify in browser** — Navigate to `/timeline`. Confirm curve renders with annotations, heatmap, and side panel.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/timeline.tsx
git commit -m "feat: add Timeline tension/pacing view"
```

---

## Task 14: Flagship Graph x Timeline View

**Files:**
- Create: `frontend/src/routes/flagship.tsx`

Reference: wireframe `views/05-flagship.js` — Variation A (split workspace + scrub/brush).

- [ ] **Step 1: Create the Flagship route**

This is the most complex view. Implements:
- Top toolbar with title, "Linked" tag, metric/graph dropdowns, Play button
- Upper region (flex 1.4): `GraphRenderer` (920x430), 3 `Anno` pills, "NOW · SCENE 23 / 47" badge, right inspector panel (260px) with edge details, appearance map (47-bar heatmap), history entries, AI suggestion
- Lower region (flex 1): `TensionCurve` (1140x220), brush selection rectangle (translucent blue, positioned at left 520px), scrubber line, `Anno` pill

Read wireframe source (`views/05-flagship.js` Variation A, lines 10-93) for exact layout, inspector panel content, appearance map data, history entries.

- [ ] **Step 2: Verify in browser** — Navigate to `/flagship`. Confirm split layout, graph + timeline, inspector panel.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/flagship.tsx
git commit -m "feat: add flagship Graph x Timeline workspace view"
```

---

## Task 15: Characters View

**Files:**
- Create: `frontend/src/routes/characters.tsx`

Reference: wireframe `views/06-characters.js` — Variation A (table + inline presence strips).

- [ ] **Step 1: Create the Characters route**

Implements: header with title + filter/add buttons, table with columns: 32px avatar circle (initials, hub=filled), name (serif 16px), role (Tag), presence strip (47 bars using sin/cos pattern from wireframe), scene count, longest gap (red if >10), arc sparkline (8 mini-bars).

Read wireframe source (`views/06-characters.js` Variation A, lines 10-49) for exact grid-template-columns, presence strip generation formula, arc sparkline heights.

- [ ] **Step 2: Verify in browser** — Navigate to `/characters`. Confirm table renders with all 10 characters, presence strips, sparklines.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/characters.tsx
git commit -m "feat: add Characters cast directory view"
```

---

## Task 16: Narrative Core View

**Files:**
- Create: `frontend/src/routes/core.tsx`

Reference: wireframe `views/07-narrative-core.js` — Variation A (inheritance tree + settings table).

- [ ] **Step 1: Create the Narrative Core route**

Implements: header, two-panel layout. Left (330px): indented tree with icons (◇ story, ▤ part, ▫ chap, · scene, ∙ beat), active node has blue left border. Right: resolution header ("Resolving settings for S04"), settings table with columns: Setting, Resolved (mono), Defined at (Tag with color based on source), inherit/override indicator.

Read wireframe source (`views/07-narrative-core.js` Variation A, lines 10-97) for exact tree structure, table data, icon mapping, and tag coloring logic (`source.startsWith('Scene')` → blue, `'Chapter'` → amber).

- [ ] **Step 2: Verify in browser** — Navigate to `/core`. Confirm tree and table render correctly.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/core.tsx
git commit -m "feat: add Narrative Core configuration hierarchy view"
```

---

## Task 17: AI Insights View

**Files:**
- Create: `frontend/src/routes/ai.tsx`

Reference: wireframe `views/08-ai-insights.js` — Variation A (categorized feed).

- [ ] **Step 1: Create the AI Insights route**

Implements: two-panel layout. Left nav (220px): category filter list with counts (All 12, Pacing 3, Relationships 4, Characters 2, Subplots 2, Climax placement 1), active item has blue left border, status summary below. Main area: 5 insight cards, each with severity Tag (FLAG red / REVIEW amber / OK blue), category Label, title (serif 20px), body text, reference Tags, action buttons (Inspect/Apply/Dismiss).

Add `useState` for active category filter. Filter the `insights` array when a category is selected.

Read wireframe source (`views/08-ai-insights.js` Variation A, lines 10-69) for exact card layout, grid-template-columns, and button placement.

- [ ] **Step 2: Verify in browser** — Navigate to `/ai`. Confirm insight cards render, category filter highlights.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/ai.tsx
git commit -m "feat: add AI Insights categorized feed view"
```

---

## Task 18: Draft View

**Files:**
- Create: `frontend/src/routes/draft.tsx`

Reference: wireframe `views/09-draft.js` — Variation A (scene-locked editor + memory panel).

- [ ] **Step 1: Create the Draft route**

Implements three-column layout:
1. Scene rail (240px): 14 scene items (number, POV, title, tension tag), active scene (S03) highlighted with blue left border
2. Prose editor (flex): scene header (S03 · Iris · Porch, "Wren returns, uninvited", goal/conflict/outcome), prose body (serif 17px, line-height 1.75) with full paragraphs from `views/09-draft.js`, AI continuation prompt (gray italic with left border), graph update suggestion (blue-soft background), word count footer ("847 words · autosaved 14:02")
3. Memory panel (300px, paper-2 background): participants with descriptions, active relationships, prior scene summary, targets

Read wireframe source (`views/09-draft.js` Variation A, lines 10-99) for exact prose content, memory panel entries, and layout details.

- [ ] **Step 2: Verify in browser** — Navigate to `/draft`. Confirm three-column layout, prose renders, memory panel shows.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/draft.tsx
git commit -m "feat: add Draft scene-bound editor view"
```

---

## Task 19: Scene Detail Modal

**Files:**
- Create: `frontend/src/routes/scenes_.$id.tsx` (TanStack Router dynamic route)
- Create: `frontend/src/components/SceneDetailModal.tsx`

Reference: wireframe `views/10-scene-modal.js` — Variation A (centered modal).

- [ ] **Step 1: Create `SceneDetailModal.tsx`**

Implements: full-screen overlay with blurred background, centered 1080px dialog with `8px 8px 0 var(--ink)` box-shadow. Header: scene number, act, title (serif 26px), tag, prev/next navigation, close button. Two-column body:
- Left (1.4fr): 10 key-value field pairs (POV, Location, Time, Participants, Goal, Conflict, Outcome, Emotional turn, Tags, Subplot), summary paragraph, 3 beats with type Tags
- Right (1fr): 6 scoring bars (Tension 9, Emotional 8, Stakes 9, Mystery 6, Danger 9, Hope 3, each 10-segment with colored fills), mini `GraphRenderer` (360x200) showing scene's character subgraph

Footer: Open in Draft / Linked AI + Delete / Save buttons.

The modal uses hardcoded data for Scene 08 ("Night — the first fire").

Read wireframe source (`views/10-scene-modal.js` Variation A, lines 10-105) for exact field values, scoring data, and mini graph nodes/edges.

- [ ] **Step 2: Create the route file `scenes_.$id.tsx`**

This renders the Scene Board in the background (dimmed) with the modal overlay.

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SceneDetailModal } from '../components/SceneDetailModal'

export const Route = createFileRoute('/scenes/$id')({
  component: SceneDetailPage,
})

function SceneDetailPage() {
  const navigate = useNavigate()
  return <SceneDetailModal onClose={() => navigate({ to: '/scenes' })} />
}
```

- [ ] **Step 3: Update Scene Board to link scene cards to `/scenes/$id`**

Wrap each scene card in the Scene Board view with a `<Link to={'/scenes/' + scene.n}>`.

- [ ] **Step 4: Verify in browser** — Navigate to `/scenes/8`. Confirm modal renders over dimmed background.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SceneDetailModal.tsx frontend/src/routes/scenes_.\$id.tsx frontend/src/routes/scenes.tsx
git commit -m "feat: add Scene Detail modal with scoring and mini graph"
```

---

## Task 20: Setup / Onboarding View

**Files:**
- Create: `frontend/src/routes/setup.tsx`

Reference: wireframe `views/11-setup.js` — Variation A (stepper wizard).

- [ ] **Step 1: Create the Setup route**

This view does NOT use `AppShell`/`Sidebar` — it's a standalone wizard layout. Implements:
- Logo header ("BeatLume · New story" + "Exit · saves draft" label)
- Left stepper panel (280px, paper-2 background): 4 steps (Premise ✓, Structure ✓, Characters [active], Scaffold & preview), each with 22px numbered/checkmark circle
- Main area: step 3 title ("Who's in this story?", serif 38px), description, 4 character input rows (36px avatar placeholder, name input, role select, description input, ✕ button), "+ Add a character" dashed row, suggested relationships strip (3 blue Tags), prev/next buttons

Add `useState` for current step index. Only step 3 content is fully implemented; others show placeholder text.

Read wireframe source (`views/11-setup.js` Variation A, lines 10-65) for exact stepper layout, character data (Iris/Cole/Wren/Kai), and suggested relationships.

- [ ] **Step 2: Verify in browser** — Navigate to `/setup`. Confirm wizard renders without sidebar, stepper highlights step 3.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/setup.tsx
git commit -m "feat: add Setup onboarding wizard view"
```

---

## Task 21: Manuscript View

**Files:**
- Create: `frontend/src/routes/manuscript.tsx`

Reference: wireframe `views/12-manuscript.js` — Variation A (reader mode, typeset pages).

- [ ] **Step 1: Create the Manuscript route**

Implements: `AppShell` + `Sidebar` with `active='manuscript'`. Three sections:
- Reader bar header: draft label, title (italic serif "A Stranger in the Orchard"), word count (72,340), scene count, reading time, export buttons (PDF, DOCX), edit mode button
- Main area: warm background (#F3EEDF), centered 640px page with paper background + box-shadow, title page (novel title serif 42px + author "by Elena Marsh"), 5 chapters from `manuscriptChapters` data (chapter number uppercase label, title italic serif 28px, prose paragraphs with first-paragraph no-indent, subsequent paragraphs indented 1.6em)
- Footer: page/progress info

Read wireframe source (`views/12-manuscript.js` Variation A, lines 94-143) for exact page styling, box-shadow value, title page layout, and chapter break spacing.

- [ ] **Step 2: Verify in browser** — Navigate to `/manuscript`. Confirm typeset page renders with all 5 chapters.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/manuscript.tsx
git commit -m "feat: add Manuscript reader mode view"
```

---

## Task 22: Tweaks Panel

**Files:**
- Create: `frontend/src/components/TweaksPanel.tsx`
- Modify: `frontend/src/routes/__root.tsx`

Reference: wireframe `Wireframes.html` lines 94-116, `app.js` lines 62-125.

- [ ] **Step 1: Create `TweaksPanel.tsx`**

Implements: fixed-position bottom-right panel (260px wide), toggleable. Contains:
- Header: "Tweaks" on ink background
- Density select: Comfy / Dense
- Accent hue range slider (180-320, default 245) — updates `--blue` and `--blue-soft` CSS custom properties
- Annotations segmented control: On / Off — toggles `.no-anno` class on body
- Grid segmented control: On / Off — toggles `.no-grid` class on body

```tsx
import { useState } from 'react'

export function TweaksPanel() {
  const [open, setOpen] = useState(false)
  const [density, setDensity] = useState('comfy')
  const [hue, setHue] = useState(245)
  const [annotations, setAnnotations] = useState(true)
  const [grid, setGrid] = useState(true)

  const apply = (d: string, h: number, a: boolean, g: boolean) => {
    document.documentElement.style.setProperty('--blue', `oklch(0.55 0.12 ${h})`)
    document.documentElement.style.setProperty('--blue-soft', `oklch(0.88 0.04 ${h})`)
    document.body.classList.toggle('dense', d === 'dense')
    document.body.classList.toggle('no-anno', !a)
    document.body.classList.toggle('no-grid', !g)
  }

  const updateHue = (h: number) => { setHue(h); apply(density, h, annotations, grid) }
  const updateDensity = (d: string) => { setDensity(d); apply(d, hue, annotations, grid) }
  const updateAnnotations = (a: boolean) => { setAnnotations(a); apply(density, hue, a, grid) }
  const updateGrid = (g: boolean) => { setGrid(g); apply(density, hue, annotations, g) }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', right: 20, bottom: open ? 290 : 20, zIndex: 101,
          padding: '4px 10px', fontSize: 10, fontFamily: 'var(--font-mono)',
          border: '1px solid var(--ink)', background: open ? 'var(--ink)' : 'var(--paper)',
          color: open ? 'var(--paper)' : 'var(--ink)', cursor: 'pointer',
        }}
      >
        Tweaks
      </button>
      {open && (
        <div style={{
          position: 'fixed', right: 20, bottom: 20, zIndex: 100,
          background: 'var(--paper)', border: '1.5px solid var(--ink)',
          width: 260, fontFamily: 'var(--font-mono)', fontSize: 11,
          boxShadow: '4px 4px 0 var(--ink)',
        }}>
          <div style={{
            margin: 0, padding: '10px 12px', background: 'var(--ink)', color: 'var(--paper)',
            fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500,
          }}>
            Tweaks
          </div>
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>
              Density
              <select value={density} onChange={e => updateDensity(e.target.value)} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 6px', border: '1px solid var(--ink)', background: 'var(--paper)' }}>
                <option value="comfy">Comfy</option>
                <option value="dense">Dense</option>
              </select>
            </label>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>
              Accent hue
              <input type="range" min={180} max={320} value={hue} step={5} onChange={e => updateHue(Number(e.target.value))} style={{ width: 110 }} />
            </label>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>
              Annotations
              <div style={{ display: 'flex', border: '1px solid var(--ink)' }}>
                {['On', 'Off'].map(v => (
                  <button key={v} onClick={() => updateAnnotations(v === 'On')}
                    style={{ flex: 1, padding: 5, fontFamily: 'var(--font-mono)', fontSize: 10, background: (v === 'On') === annotations ? 'var(--ink)' : 'var(--paper)', color: (v === 'On') === annotations ? 'var(--paper)' : 'var(--ink)', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {v}
                  </button>
                ))}
              </div>
            </label>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>
              Grid
              <div style={{ display: 'flex', border: '1px solid var(--ink)' }}>
                {['On', 'Off'].map(v => (
                  <button key={v} onClick={() => updateGrid(v === 'On')}
                    style={{ flex: 1, padding: 5, fontFamily: 'var(--font-mono)', fontSize: 10, background: (v === 'On') === grid ? 'var(--ink)' : 'var(--paper)', color: (v === 'On') === grid ? 'var(--paper)' : 'var(--ink)', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {v}
                  </button>
                ))}
              </div>
            </label>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Add `TweaksPanel` to root layout**

Update `frontend/src/routes/__root.tsx`:

```tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TweaksPanel } from '../components/TweaksPanel'

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <TweaksPanel />
    </>
  ),
})
```

- [ ] **Step 3: Verify in browser** — Click "Tweaks" button. Confirm panel opens, hue slider changes accent color, annotations/grid toggles work.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/TweaksPanel.tsx frontend/src/routes/__root.tsx
git commit -m "feat: add Tweaks panel with density, hue, annotations, and grid toggles"
```

---

## Task 23: FastAPI Backend Stub

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/requirements.txt`

- [ ] **Step 1: Create `backend/app/__init__.py`**

Empty file.

- [ ] **Step 2: Create `backend/app/main.py`**

```python
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

- [ ] **Step 3: Create `backend/requirements.txt`**

```
fastapi
uvicorn[standard]
```

- [ ] **Step 4: Verify backend starts**

```bash
cd /home/abdussamadbello/beatlume/backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Expected: Server starts. `curl http://localhost:8000/health` returns `{"status":"ok"}`.

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: add FastAPI backend stub with health endpoint"
```

---

## Task 24: Final Integration Verification

**Files:** None created. This is a verification pass.

- [ ] **Step 1: Start frontend dev server**

```bash
cd /home/abdussamadbello/beatlume/frontend && npm run dev
```

- [ ] **Step 2: Open browser and verify all 12 routes**

Navigate to each route and confirm it renders:
1. `/` — Overview dashboard
2. `/scenes` — Scene Board kanban
3. `/graph` — Graph view
4. `/timeline` — Timeline view
5. `/flagship` — Graph x Timeline
6. `/characters` — Characters table
7. `/core` — Narrative Core tree + table
8. `/ai` — AI Insights feed
9. `/draft` — Draft editor
10. `/scenes/8` — Scene Detail modal
11. `/setup` — Setup wizard
12. `/manuscript` — Manuscript reader

- [ ] **Step 3: Verify sidebar navigation** — Click each sidebar item, confirm route changes and active item highlights.

- [ ] **Step 4: Verify Tweaks panel** — Toggle density, hue, annotations, grid. Confirm CSS changes apply globally.

- [ ] **Step 5: Run TypeScript type check**

```bash
cd /home/abdussamadbello/beatlume/frontend && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A && git commit -m "fix: integration fixes from final verification pass"
```
