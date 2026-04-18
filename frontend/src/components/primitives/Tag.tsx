import type { CSSProperties, ReactNode } from 'react';
import type { TagVariant } from '../../types';

const variantStyles: Record<TagVariant, CSSProperties> = {
  blue: { borderColor: 'var(--blue)', color: 'var(--blue)' },
  amber: { borderColor: 'oklch(0.45 0.12 75)', color: 'oklch(0.45 0.12 75)' },
  red: { borderColor: 'var(--red)', color: 'var(--red)' },
  solid: { background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' },
};

const base: CSSProperties = {
  display: 'inline-block',
  padding: '2px 7px',
  border: '1px solid var(--ink)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

export function Tag({ variant, children, style }: { variant?: TagVariant; children: ReactNode; style?: CSSProperties }) {
  return (
    <span style={{ ...base, ...(variant ? variantStyles[variant] : {}), ...style }}>
      {children}
    </span>
  );
}
