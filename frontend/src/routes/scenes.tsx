import { createFileRoute } from '@tanstack/react-router'
import { AppShell, Sidebar } from '../components/chrome'
import { Btn, Label } from '../components/primitives'
import { allScenes } from '../data'

export const Route = createFileRoute('/scenes')({
  component: SceneBoard,
})

function povColor(pov: string): string {
  const map: Record<string, string> = {
    Iris: 'var(--ink)',
    Jon: 'var(--blue)',
    Cole: 'var(--amber)',
    Fen: 'var(--red)',
  };
  return map[pov] || 'var(--ink-3)';
}

function ActColumn({ act, label }: { act: number; label: string }) {
  const items = allScenes.filter((s) => s.act === act);
  return (
    <div style={{ flex: 1, minWidth: 0, border: '1px solid var(--line)', background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
        <Label>ACT {label}</Label>
        <Label>{items.length} scenes</Label>
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        {items.map((s) => (
          <div key={s.n} style={{ border: '1px solid var(--ink)', background: 'var(--paper)', padding: 10, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: povColor(s.pov) }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <Label>S{String(s.n).padStart(2, '0')} {'\u00B7'} {s.pov}</Label>
              <span style={{ display: 'inline-block', padding: '2px 7px', border: '1px solid var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>T {s.tension}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, lineHeight: 1.2 }}>{s.title}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {Array.from({ length: 10 }).map((_, k) => (
                <span key={k} style={{ flex: 1, height: 3, background: k < s.tension ? 'var(--ink)' : 'var(--line-2)' }} />
              ))}
            </div>
          </div>
        ))}
        <div style={{ border: '1px dashed var(--ink-3)', padding: 10, textAlign: 'center', color: 'var(--ink-3)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
          + New scene
        </div>
      </div>
    </div>
  );
}

function SceneBoard() {
  return (
    <AppShell sidebar={<Sidebar active="/scenes" />}>
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--ink)' }}>
          <div>
            <Label>Scene Board</Label>
            <div className="title-serif" style={{ fontSize: 26 }}>47 scenes {'\u00B7'} drag to reorder</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost">Filter {'\u25BE'}</Btn>
            <Btn variant="ghost">Group: Act {'\u25BE'}</Btn>
            <Btn variant="ghost">Sort: Order {'\u25BE'}</Btn>
            <Btn variant="solid">+ Scene</Btn>
          </div>
        </div>

        {/* Kanban columns */}
        <div style={{ flex: 1, padding: 16, display: 'flex', gap: 12, overflow: 'hidden' }}>
          <ActColumn act={1} label="I" />
          <ActColumn act={2} label="II" />
          <ActColumn act={3} label="III" />
        </div>
      </div>
    </AppShell>
  )
}
