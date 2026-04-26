import type { CSSProperties } from 'react';
import { Link } from '@tanstack/react-router';
import type { Story } from '../../types';

interface NavItem {
  label: string;
  to: string;
  count?: string;
}

type SidebarStory = Pick<
  Story,
  | 'title'
  | 'draft_number'
  | 'target_words'
  | 'scene_count'
  | 'character_count'
  | 'active_insight_count'
  | 'draft_word_count'
  | 'manuscript_word_count'
>;

const compactNumber = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function formatCount(value: number): string {
  return value >= 1000 ? compactNumber.format(value).toLowerCase() : String(value);
}

function planningItems(storyId: string, story?: SidebarStory | null): NavItem[] {
  return [
    { label: 'Overview', to: `/stories/${storyId}` },
    { label: 'Scene Board', to: `/stories/${storyId}/scenes`, count: formatCount(story?.scene_count ?? 0) },
    { label: 'Graph', to: `/stories/${storyId}/graph` },
    { label: 'Timeline', to: `/stories/${storyId}/timeline` },
    { label: 'Characters', to: `/stories/${storyId}/characters`, count: formatCount(story?.character_count ?? 0) },
  ];
}

function assistantItems(storyId: string, story?: SidebarStory | null): NavItem[] {
  return [
    { label: 'AI Insights', to: `/stories/${storyId}/ai`, count: formatCount(story?.active_insight_count ?? 0) },
    { label: 'Draft', to: `/stories/${storyId}/draft`, count: formatCount(story?.draft_word_count ?? 0) },
    { label: 'Manuscript', to: `/stories/${storyId}/manuscript`, count: formatCount(story?.manuscript_word_count ?? 0) },
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
  borderLeftWidth: 2,
  borderLeftStyle: 'solid',
  borderLeftColor: 'transparent',
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

export function Sidebar({ storyId, active, story }: { storyId: string; active: string; story?: SidebarStory | null }) {
  const storyTitleText = story?.title ?? 'Loading...';
  const draftLabelText = `Draft ${story?.draft_number ?? '—'} · ${formatCount(story?.draft_word_count ?? 0)} drafted`;
  const footerText = `Target ${formatCount(story?.target_words ?? 0)} words`;

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
      <div style={storyTitle}>{storyTitleText}</div>
      <div style={draftLabel}>{draftLabelText}</div>
      <NavSection heading="Planning" items={planningItems(storyId, story)} active={active} />
      <NavSection heading="Assistant" items={assistantItems(storyId, story)} active={active} />
      <NavSection heading="Publish" items={publishItems(storyId)} active={active} />
      <div style={footer}>{footerText}</div>
    </nav>
  );
}
