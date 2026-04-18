import type { CSSProperties, ReactNode } from 'react';

type AnnoVariant = 'blue' | 'amber' | 'red';

const variantColors: Record<AnnoVariant, string> = {
  blue: 'var(--blue)',
  amber: 'oklch(0.45 0.12 75)',
  red: 'var(--red)',
};

const base: CSSProperties = {
  position: 'absolute',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  background: 'var(--paper)',
  border: '1px solid',
  padding: '2px 6px',
  letterSpacing: '0.04em',
  zIndex: 4,
};

export function Anno({
  variant = 'blue',
  children,
  style,
}: {
  variant?: AnnoVariant;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const color = variantColors[variant];
  return (
    <span className="anno" style={{ ...base, borderColor: color, color, ...style }}>
      {children}
    </span>
  );
}
