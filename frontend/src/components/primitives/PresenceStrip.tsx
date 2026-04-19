export function PresenceStrip({
  characterIndex,
  sceneCount: _sceneCount,
  barCount = 47,
}: {
  characterIndex: number
  sceneCount: number
  barCount?: number
}) {
  return (
    <div style={{ display: 'flex', gap: 1 }}>
      {Array.from({ length: barCount }).map((_, k) => {
        const active = (Math.sin((k + characterIndex * 3) * 0.6) + Math.cos((k + characterIndex * 2) * 0.4)) > -0.2 - characterIndex * 0.15
        return (
          <span
            key={k}
            style={{
              flex: 1,
              height: 10,
              background: active ? 'var(--ink)' : 'var(--line-2)',
            }}
          />
        )
      })}
    </div>
  )
}
