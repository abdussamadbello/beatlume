import { createFileRoute } from '@tanstack/react-router'
import { AppShell, Sidebar } from '../components/chrome'
import { Tag, Btn, Label } from '../components/primitives'
import { sampleCharacters } from '../data'

export const Route = createFileRoute('/characters')({
  component: CharactersView,
})

const charMeta = [
  { initials: 'IR', scenes: 40, gap: 0, arc: 'Protag' },
  { initials: 'WR', scenes: 24, gap: 3, arc: 'Foil' },
  { initials: 'CO', scenes: 22, gap: 5, arc: 'Antag' },
  { initials: 'JN', scenes: 18, gap: 4, arc: 'Mirror' },
  { initials: 'MA', scenes: 12, gap: 9, arc: 'Family' },
  { initials: 'KA', scenes: 9, gap: 8, arc: 'Mentor' },
  { initials: 'FN', scenes: 8, gap: 12, arc: 'Ward' },
  { initials: 'DC', scenes: 6, gap: 15, arc: 'Witness' },
  { initials: 'SB', scenes: 6, gap: 11, arc: 'Pawn' },
  { initials: 'OM', scenes: 4, gap: 18, arc: 'Ghost' },
] as const;

const charNames = ['Iris', 'Wren', 'Cole', 'Jon', 'Mara', 'Kai', 'Fen', 'Doc', 'Sib', 'Old Man'] as const;

function CharactersView() {
  return (
    <AppShell sidebar={<Sidebar active="/characters" />}>
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid var(--ink)' }}>
          <div className="title-serif" style={{ fontSize: 24 }}>Cast {'\u00B7'} 14 characters</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost">Filter {'\u25BE'}</Btn>
            <Btn variant="solid">+ Character</Btn>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '48px 140px 110px 1fr 80px 80px 100px',
            gap: 10,
            padding: '10px 24px',
            borderBottom: '1px solid var(--ink)',
            fontSize: 10,
            letterSpacing: '0.08em',
            color: 'var(--ink-3)',
            textTransform: 'uppercase' as const,
          }}>
            <span />
            <span>Name</span>
            <span>Role</span>
            <span>Presence</span>
            <span>Scenes</span>
            <span>Longest gap</span>
            <span>Arc</span>
          </div>

          {/* Rows */}
          {charNames.map((name, i) => {
            const meta = charMeta[i];
            return (
              <div key={name} style={{
                display: 'grid',
                gridTemplateColumns: '48px 140px 110px 1fr 80px 80px 100px',
                gap: 10,
                padding: '12px 24px',
                borderBottom: '1px dashed var(--line-2)',
                alignItems: 'center',
              }}>
                {/* Avatar */}
                <div style={{
                  width: 32,
                  height: 32,
                  border: '1.5px solid var(--ink)',
                  background: i === 0 ? 'var(--ink)' : 'var(--paper)',
                  color: i === 0 ? 'var(--paper)' : 'var(--ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                }}>
                  {name.slice(0, 2).toUpperCase()}
                </div>

                {/* Name */}
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16 }}>{name}</div>

                {/* Role */}
                <div><Tag>{meta.arc}</Tag></div>

                {/* Presence strip */}
                <div style={{ display: 'flex', gap: 1 }}>
                  {Array.from({ length: 47 }).map((_, k) => {
                    const active = (Math.sin((k + i * 3) * 0.6) + Math.cos((k + i * 2) * 0.4)) > -0.2 - i * 0.15;
                    return (
                      <span key={k} style={{ flex: 1, height: 10, background: active ? 'var(--ink)' : 'var(--line-2)' }} />
                    );
                  })}
                </div>

                {/* Scene count */}
                <div className="mono" style={{ fontSize: 12 }}>{meta.scenes}</div>

                {/* Longest gap */}
                <div className="mono" style={{ fontSize: 12, color: meta.gap > 10 ? 'var(--red)' : 'var(--ink)' }}>
                  {meta.gap || '\u2014'}
                </div>

                {/* Arc sparkline */}
                <div style={{ display: 'flex', gap: 2, height: 18, alignItems: 'flex-end' }}>
                  {Array.from({ length: 8 }).map((_, k) => (
                    <span key={k} style={{
                      flex: 1,
                      background: 'var(--ink)',
                      height: `${20 + k * 10 + Math.sin(i + k) * 20}%`,
                    }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  )
}
