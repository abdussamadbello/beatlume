import type { CSSProperties, ReactNode } from 'react';

const shell: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '200px 1fr',
  height: '100vh',
};

const main: CSSProperties = {
  minHeight: 0,
  minWidth: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
};

export function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div style={shell}>
      {sidebar}
      <main style={main}>{children}</main>
    </div>
  );
}
