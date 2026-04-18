import type { CSSProperties, ReactNode } from 'react';

type StickyVariant = 'amber' | 'blue' | 'red';

const variantStyles: Record<StickyVariant, CSSProperties> = {
  amber: { background: 'var(--amber-soft)', borderColor: 'var(--amber)' },
  blue: { background: 'var(--blue-soft)', borderColor: 'var(--blue)' },
  red: { background: 'var(--red-soft)', borderColor: 'var(--red)' },
};

const base: CSSProperties = {
  background: 'var(--paper)',
  border: '1px solid var(--ink)',
  padding: '8px 10px',
  fontSize: 11,
};

export function Sticky({
  variant,
  children,
  style,
}: {
  variant?: StickyVariant;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ ...base, ...(variant ? variantStyles[variant] : {}), ...style }}>
      {children}
    </div>
  );
}
