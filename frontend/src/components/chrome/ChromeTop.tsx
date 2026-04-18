import type { CSSProperties, ReactNode } from 'react';

const bar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 20px',
  borderBottom: '1px solid var(--line)',
  background: 'var(--paper)',
};

const logoStyle: CSSProperties = {
  fontFamily: 'var(--font-serif)',
  fontSize: 16,
  fontStyle: 'italic',
  marginRight: 16,
};

const titleStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--ink)',
};

const crumbStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  color: 'var(--ink-3)',
  letterSpacing: '0.04em',
};

export function ChromeTop({
  title,
  crumbs,
  actions,
}: {
  title: string;
  crumbs: string[];
  actions?: ReactNode;
}) {
  return (
    <div style={bar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={logoStyle}>BeatLume</span>
        <span style={crumbStyle}>{crumbs.join(' / ')}</span>
        <span style={titleStyle}>{title}</span>
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}
