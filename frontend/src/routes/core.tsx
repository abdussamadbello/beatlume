import { createFileRoute } from '@tanstack/react-router'
import { AppShell, Sidebar } from '../components/chrome'
import { Tag, Btn, Label } from '../components/primitives'
import { useStore } from '../store'

const iconMap = { story: '\u25C7', part: '\u25A4', chap: '\u25AB', scene: '\u00B7', beat: '\u2219' } as const

function CorePage() {
  const coreTree = useStore(s => s.coreTree)
  const coreSettings = useStore(s => s.coreSettings)
  const activeCoreIndex = useStore(s => s.activeCoreIndex)
  const setActiveCoreIndex = useStore(s => s.setActiveCoreIndex)

  const activeNode = coreTree[activeCoreIndex]

  return (
    <AppShell sidebar={<Sidebar active="/core" />}>
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--ink)' }}>
          <div>
            <Label>Narrative Core</Label>
            <div className="title-serif" style={{ fontSize: 22 }}>Configuration hierarchy</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost">Expand all</Btn>
            <Btn>+ Override</Btn>
          </div>
        </div>

        {/* Two-panel */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '330px 1fr', overflow: 'hidden' }}>
          {/* Left tree */}
          <div style={{ borderRight: '1px solid var(--ink)', padding: 14, fontFamily: 'var(--font-mono)', fontSize: 12, overflow: 'auto' }}>
            {coreTree.map((n, i) => {
              const icon = iconMap[n.kind]
              const isActive = i === activeCoreIndex
              return (
                <div
                  key={i}
                  onClick={() => setActiveCoreIndex(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: `5px 0 5px ${n.depth * 16 + 8}px`,
                    background: isActive ? 'var(--paper-2)' : 'transparent',
                    borderLeft: isActive ? '2px solid var(--blue)' : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ color: 'var(--ink-3)', width: 10 }}>{icon}</span>
                  <span>{n.label}</span>
                  {isActive && <Label style={{ marginLeft: 'auto' }}>Editing</Label>}
                </div>
              )
            })}
          </div>

          {/* Right settings */}
          <div style={{ overflow: 'auto' }}>
            <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--ink)', background: 'var(--paper-2)' }}>
              <Label>Resolving settings for</Label>
              <div className="title-serif" style={{ fontSize: 20 }}>{activeNode ? activeNode.label : 'Select a node'}</div>
              <div className="dim" style={{ fontSize: 11, marginTop: 2 }}>
                {activeNode ? `Depth ${activeNode.depth} \u00B7 ${activeNode.kind}` : ''} &#x2933; no beat overrides
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', background: 'var(--paper-2)' }}>
                  <th style={{ padding: '8px 16px', borderBottom: '1px solid var(--ink)' }}>Setting</th>
                  <th style={{ padding: '8px 16px', borderBottom: '1px solid var(--ink)' }}>Resolved</th>
                  <th style={{ padding: '8px 16px', borderBottom: '1px solid var(--ink)' }}>Defined at</th>
                  <th style={{ padding: '8px 16px', borderBottom: '1px solid var(--ink)' }}></th>
                </tr>
              </thead>
              <tbody>
                {coreSettings.map((setting, i) => (
                  <tr key={i}>
                    <td style={{ padding: '8px 16px', borderBottom: '1px dashed var(--line-2)', color: 'var(--ink-2)' }}>{setting.key}</td>
                    <td style={{ padding: '8px 16px', borderBottom: '1px dashed var(--line-2)', fontFamily: 'var(--font-mono)' }}>{setting.value}</td>
                    <td style={{ padding: '8px 16px', borderBottom: '1px dashed var(--line-2)' }}>
                      <Tag variant={setting.source === 'AI' ? 'blue' : setting.source === 'system' ? 'amber' : undefined}>{setting.source}</Tag>
                    </td>
                    <td style={{ padding: '8px 16px', borderBottom: '1px dashed var(--line-2)', textAlign: 'right' }}>
                      {setting.tag ? (
                        <Label>{setting.tag}</Label>
                      ) : (
                        <span className="dim" style={{ fontSize: 10 }}>inherit</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export const Route = createFileRoute('/core')({
  component: CorePage,
})
