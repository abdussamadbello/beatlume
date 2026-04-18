import type { CSSProperties, ReactNode } from 'react';

const base: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
};

export function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ ...base, ...style }}>{children}</span>;
}
