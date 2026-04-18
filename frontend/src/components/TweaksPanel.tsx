import { useState, useCallback } from 'react'
import type { CSSProperties } from 'react'

const panelStyle: CSSProperties = {
  position: 'fixed',
  bottom: 16,
  right: 16,
  width: 260,
  zIndex: 9000,
  border: '1px solid var(--ink)',
  boxShadow: '4px 4px 0 var(--ink)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
}

const headerStyle: CSSProperties = {
  padding: '8px 12px',
  background: 'var(--ink)',
  color: 'var(--paper)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  cursor: 'pointer',
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const bodyStyle: CSSProperties = {
  padding: '12px 14px',
  background: 'var(--paper)',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const labelStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
}

function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', border: '1px solid var(--ink)', overflow: 'hidden' }}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            border: 'none',
            background: value === opt ? 'var(--ink)' : 'var(--paper)',
            color: value === opt ? 'var(--paper)' : 'var(--ink)',
            letterSpacing: '0.04em',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

export function TweaksPanel() {
  const [open, setOpen] = useState(false)
  const [density, setDensity] = useState<'Comfy' | 'Dense'>('Comfy')
  const [hue, setHue] = useState(245)
  const [annotations, setAnnotations] = useState<'On' | 'Off'>('On')
  const [grid, setGrid] = useState<'On' | 'Off'>('On')

  const handleDensity = useCallback((v: string) => {
    const val = v as 'Comfy' | 'Dense'
    setDensity(val)
    if (val === 'Dense') {
      document.body.classList.add('dense')
    } else {
      document.body.classList.remove('dense')
    }
  }, [])

  const handleHue = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const h = Number(e.target.value)
    setHue(h)
    document.documentElement.style.setProperty('--blue', `oklch(0.45 0.18 ${h})`)
    document.documentElement.style.setProperty('--blue-soft', `oklch(0.92 0.04 ${h})`)
  }, [])

  const handleAnnotations = useCallback((v: string) => {
    const val = v as 'On' | 'Off'
    setAnnotations(val)
    if (val === 'Off') {
      document.body.classList.add('no-anno')
    } else {
      document.body.classList.remove('no-anno')
    }
  }, [])

  const handleGrid = useCallback((v: string) => {
    const val = v as 'On' | 'Off'
    setGrid(val)
    if (val === 'Off') {
      document.body.classList.add('no-grid')
    } else {
      document.body.classList.remove('no-grid')
    }
  }, [])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 9000,
          padding: '6px 10px',
          border: '1px solid var(--ink)',
          background: 'var(--ink)',
          color: 'var(--paper)',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          boxShadow: '4px 4px 0 var(--ink)',
        }}
      >
        Tweaks
      </button>
    )
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle} onClick={() => setOpen(false)}>
        <span>Tweaks</span>
        <span>&#x2715;</span>
      </div>
      <div style={bodyStyle}>
        {/* Density */}
        <div>
          <div style={labelStyle}>Density</div>
          <div style={{ marginTop: 6 }}>
            <Segmented options={['Comfy', 'Dense']} value={density} onChange={handleDensity} />
          </div>
        </div>

        {/* Accent hue */}
        <div>
          <div style={{ ...rowStyle }}>
            <span style={labelStyle}>Accent hue</span>
            <span style={{ ...labelStyle, color: 'var(--ink-2)' }}>{hue}</span>
          </div>
          <input
            type="range"
            min={180}
            max={320}
            value={hue}
            onChange={handleHue}
            style={{ width: '100%', marginTop: 6 }}
          />
        </div>

        {/* Annotations */}
        <div>
          <div style={labelStyle}>Annotations</div>
          <div style={{ marginTop: 6 }}>
            <Segmented options={['On', 'Off']} value={annotations} onChange={handleAnnotations} />
          </div>
        </div>

        {/* Grid */}
        <div>
          <div style={labelStyle}>Grid</div>
          <div style={{ marginTop: 6 }}>
            <Segmented options={['On', 'Off']} value={grid} onChange={handleGrid} />
          </div>
        </div>
      </div>
    </div>
  )
}
