import type { CSSProperties } from 'react';
import { Link } from '@tanstack/react-router';

interface NavItem {
  label: string;
  to: string;
  count?: string;
}

function planningItems(storyId: string): NavItem[] {
  return [
    { label: 'Overview', to: `/stories/${storyId}`, count: '12' },
    { label: 'Scene Board', to: `/stories/${storyId}/scenes`, count: '47' },
    { label: 'Graph', to: `/stories/${storyId}/graph` },
    { label: 'Timeline', to: `/stories/${storyId}/timeline` },
    { label: 'Characters', to: `/stories/${storyId}/characters`, count: '14' },
    { label: 'Narrative Core', to: `/stories/${storyId}/core` },
  ];
}

function assistantItems(storyId: string): NavItem[] {
  return [
    { label: 'AI Insights', to: `/stories/${storyId}/ai`, count: '3' },
    { label: 'Draft', to: `/stories/${storyId}/draft`, count: '18k' },
    { label: 'Manuscript', to: `/stories/${storyId}/manuscript`, count: '72k' },
  ];
}

function publishItems(storyId: string): NavItem[] {
  return [
    { label: 'Export', to: `/stories/${storyId}/export` },
    { label: 'Collaboration', to: `/stories/${storyId}/collaboration` },
  ];
}

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

export function Sidebar({ storyId, active, title = 'A Stranger in the Orchard' }: { storyId: string; active: string; title?: string }) {
  return (
    <nav style={sidebar}>
      <Link
        to="/dashboard"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 16px',
          fontSize: 10,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
          textDecoration: 'none',
          borderBottom: '1px solid var(--line)',
        }}
      >
        &larr; Dashboard
      </Link>
      <div style={logoStyle}>BeatLume</div>
      <div style={storyTitle}>{title}</div>
      <div style={draftLabel}>Draft 3 &middot; Act II</div>
      <NavSection heading="Planning" items={planningItems(storyId)} active={active} />
      <NavSection heading="Assistant" items={assistantItems(storyId)} active={active} />
      <NavSection heading="Publish" items={publishItems(storyId)} active={active} />
      <div style={footer}>Autosaved 2 min ago</div>
    </nav>
  );
}
