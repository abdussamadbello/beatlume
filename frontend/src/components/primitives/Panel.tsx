import type { CSSProperties, ReactNode } from 'react';

const panelBase: CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--paper)',
};

export function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...panelBase, ...style }}>{children}</div>;
}

const headBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  borderBottom: '1px solid var(--line)',
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
};

export function PanelHead({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div style={headBase}>
      <span>{left}</span>
      {right && <span>{right}</span>}
    </div>
  );
}
