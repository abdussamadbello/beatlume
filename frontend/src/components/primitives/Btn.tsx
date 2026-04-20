import type { CSSProperties, ReactNode, MouseEventHandler } from 'react';
import type { BtnVariant } from '../../types';

const variantStyles: Record<BtnVariant, CSSProperties> = {
  solid: { background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' },
  ghost: { background: 'transparent', borderColor: 'var(--ink-3)', color: 'var(--ink-2)' },
};

const base: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  border: '1px solid var(--ink)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  cursor: 'pointer',
};

export function Btn({
  variant = 'solid',
  children,
  style,
  onClick,
  type,
  disabled,
}: {
  variant?: BtnVariant;
  children: ReactNode;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}) {
  return (
    <button
      style={{ ...base, ...variantStyles[variant], ...style, ...(disabled ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
      onClick={onClick}
      type={type}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
