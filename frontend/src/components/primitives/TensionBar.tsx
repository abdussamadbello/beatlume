export function TensionBar({
  value,
  max = 10,
  color = 'var(--ink)',
  height = 3,
  onClick,
}: {
  value: number
  max?: number
  color?: string
  height?: number
  onClick?: (value: number) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: max }).map((_, k) => (
        <span
          key={k}
          onClick={onClick ? () => onClick(k + 1) : undefined}
          style={{
            flex: 1,
            height,
            background: k < value ? color : 'var(--line-2)',
            cursor: onClick ? 'pointer' : 'default',
          }}
        />
      ))}
    </div>
  )
}
