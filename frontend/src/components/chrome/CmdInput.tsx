import type { CSSProperties } from 'react';

const wrapper: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  border: '1px solid var(--line)',
  background: 'var(--paper)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--ink-3)',
};

const input: CSSProperties = {
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  color: 'var(--ink)',
  flex: 1,
};

export function CmdInput({ placeholder = 'Type a command or ask AI...' }: { placeholder?: string }) {
  return (
    <div style={wrapper}>
      <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Cmd</span>
      <input style={input} placeholder={placeholder} />
    </div>
  );
}
