import type { CSSProperties } from 'react';
import { Link } from '@tanstack/react-router';

interface NavItem {
  label: string;
  to: string;
  count?: string;
}

const planningItems: NavItem[] = [
  { label: 'Overview', to: '/', count: '12' },
  { label: 'Scene Board', to: '/scenes', count: '47' },
  { label: 'Graph', to: '/graph' },
  { label: 'Timeline', to: '/timeline' },
  { label: 'Characters', to: '/characters', count: '14' },
  { label: 'Narrative Core', to: '/core' },
];

const assistantItems: NavItem[] = [
  { label: 'AI Insights', to: '/ai', count: '3' },
  { label: 'Draft', to: '/draft', count: '18k' },
  { label: 'Manuscript', to: '/manuscript', count: '72k' },
];

const sidebar: CSSProperties = {
  width: 200,
  height: '100%',
  borderRight: '1px solid var(--line)',
  background: 'var(--paper)',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  overflow: 'hidden',
};

const logoStyle: CSSProperties = {
  padding: '16px 16px 0',
  fontFamily: 'var(--font-serif)',
  fontSize: 18,
  fontStyle: 'italic',
};

const storyTitle: CSSProperties = {
  padding: '8px 16px 4px',
  fontSize: 11,
  color: 'var(--ink)',
};

const draftLabel: CSSProperties = {
  padding: '0 16px 12px',
  fontSize: 10,
  color: 'var(--ink-3)',
  letterSpacing: '0.04em',
};

const sectionHead: CSSProperties = {
  padding: '12px 16px 4px',
  fontSize: 9,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
  borderTop: '1px solid var(--line)',
};

const itemBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 16px',
  textDecoration: 'none',
  color: 'var(--ink-2)',
  fontSize: 11,
  borderLeft: '2px solid transparent',
};

const activeItem: CSSProperties = {
  borderLeftColor: 'var(--blue)',
  background: 'var(--paper-2)',
  color: 'var(--ink)',
};

const countStyle: CSSProperties = {
  fontSize: 10,
  color: 'var(--ink-3)',
};

const footer: CSSProperties = {
  marginTop: 'auto',
  padding: '12px 16px',
  fontSize: 9,
  color: 'var(--ink-3)',
  borderTop: '1px solid var(--line)',
  letterSpacing: '0.04em',
};

function NavSection({ heading, items, active }: { heading: string; items: NavItem[]; active: string }) {
  return (
    <>
      <div style={sectionHead}>{heading}</div>
      {items.map((item) => {
        const isActive = item.to === active;
        return (
          <Link
            key={item.to}
            to={item.to}
            style={{ ...itemBase, ...(isActive ? activeItem : {}) }}
          >
            <span>{item.label}</span>
            {item.count && <span style={countStyle}>{item.count}</span>}
          </Link>
        );
      })}
    </>
  );
}

export function Sidebar({ active, title = 'A Stranger in the Orchard' }: { active: string; title?: string }) {
  return (
    <nav style={sidebar}>
      <div style={logoStyle}>BeatLume</div>
      <div style={storyTitle}>{title}</div>
      <div style={draftLabel}>Draft 3 &middot; Act II</div>
      <NavSection heading="Planning" items={planningItems} active={active} />
      <NavSection heading="Assistant" items={assistantItems} active={active} />
      <div style={footer}>Autosaved 2 min ago</div>
    </nav>
  );
}
