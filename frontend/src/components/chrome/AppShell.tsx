import type { CSSProperties, ReactNode } from 'react';

const shell: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '200px 1fr',
  height: '100vh',
};

export function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div style={shell}>
      {sidebar}
      {children}
    </div>
  );
}
