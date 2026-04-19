import type { Scene } from '../types'
import { Tag } from './primitives/Tag'
import { TensionBar } from './primitives/TensionBar'
import { Label } from './primitives/Label'

const povColors: Record<string, string> = {
  Iris: 'var(--blue)',
  Jon: 'var(--green)',
  Fen: 'var(--red)',
  Cole: 'oklch(0.45 0.12 75)',
}

export function SceneCard({
  scene,
  active = false,
  compact = false,
  onClick,
}: {
  scene: Scene
  active?: boolean
  compact?: boolean
  onClick?: () => void
}) {
  const borderColor = active ? 'var(--blue)' : (povColors[scene.pov] || 'var(--ink)')

  if (compact) {
    return (
      <div
        onClick={onClick}
        style={{
          padding: '8px 12px',
          borderLeft: `3px solid ${borderColor}`,
          background: active ? 'var(--paper-2)' : 'var(--paper)',
          cursor: onClick ? 'pointer' : 'default',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
            S{String(scene.n).padStart(2, '0')}
          </span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 14, marginLeft: 8 }}>
            {scene.title}
          </span>
        </div>
        <Tag style={{ fontSize: 9 }}>T {scene.tension}</Tag>
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        borderLeft: `3px solid ${borderColor}`,
        background: active ? 'var(--paper-2)' : 'var(--paper)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Label style={{ fontSize: 9 }}>
          S{String(scene.n).padStart(2, '0')} &middot; {scene.pov}
        </Label>
      </div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, marginBottom: 8 }}>
        {scene.title}
      </div>
      <TensionBar value={scene.tension} />
    </div>
  )
}
