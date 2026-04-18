import type { CSSProperties } from 'react';

const base: CSSProperties = {
  background: 'repeating-linear-gradient(135deg, transparent 0 6px, rgba(26,29,36,0.08) 6px 7px)',
  border: '1px dashed var(--ink-3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export function Placeholder({ label, style }: { label?: string; style?: CSSProperties }) {
  return (
    <div style={{ ...base, ...style }}>
      {label && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {label}
        </span>
      )}
    </div>
  );
}
