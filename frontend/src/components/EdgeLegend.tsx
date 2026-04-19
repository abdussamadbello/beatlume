const edgeTypes = [
  { label: 'Alliance', color: 'var(--blue)', dasharray: '' },
  { label: 'Conflict', color: 'var(--red)', dasharray: '4 2' },
  { label: 'Romance', color: 'oklch(0.65 0.15 350)', dasharray: '' },
  { label: 'Mentor', color: 'var(--ink)', dasharray: '' },
  { label: 'Secret', color: 'var(--ink-3)', dasharray: '2 2' },
  { label: 'Family', color: 'var(--green)', dasharray: '' },
] as const

export function EdgeLegend() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
      {edgeTypes.map((et) => (
        <div key={et.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={24} height={6}>
            <line
              x1={0}
              y1={3}
              x2={24}
              y2={3}
              stroke={et.color}
              strokeWidth={2}
              strokeDasharray={et.dasharray || undefined}
            />
          </svg>
          <span>{et.label}</span>
        </div>
      ))}
    </div>
  )
}
