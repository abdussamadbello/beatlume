export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--ink)' }}>
      {options.map((opt, i) => {
        const isActive = opt === value
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              padding: '6px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              cursor: 'pointer',
              border: 'none',
              borderRight: i < options.length - 1 ? '1px solid var(--ink)' : 'none',
              background: isActive ? 'var(--ink)' : 'var(--paper)',
              color: isActive ? 'var(--paper)' : 'var(--ink)',
            }}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}
