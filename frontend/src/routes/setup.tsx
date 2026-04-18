import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Tag, Label, Btn, Placeholder } from '../components/primitives'

const steps: [string, string, boolean][] = [
  ['01', 'Premise', true],
  ['02', 'Structure', true],
  ['03', 'Characters', false],
  ['04', 'Scaffold & preview', false],
]

const characters = [
  { n: 'Iris', r: 'Protagonist', d: "A widow returning to her family's orchard." },
  { n: 'Cole', r: 'Antagonist', d: 'Her brother-in-law. Wants to sell the land.' },
  { n: 'Wren', r: 'Foil', d: 'Childhood friend who vanished eleven years ago.' },
  { n: 'Kai', r: 'Mentor', d: 'Orchard hand. Keeper of small truths.' },
]

function StepContent({ step }: { step: number }) {
  if (step === 1) {
    return (
      <div>
        <Label>Step 01 of 04</Label>
        <div className="title-serif" style={{ fontSize: 38, margin: '4px 0 8px' }}>What&rsquo;s your story about?</div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', maxWidth: '58ch', lineHeight: 1.6 }}>
          Write a short logline or premise. Just a sentence or two is fine.
        </div>
        <Placeholder label="Logline input" style={{ height: 120, marginTop: 24, maxWidth: 720 }} />
      </div>
    )
  }
  if (step === 2) {
    return (
      <div>
        <Label>Step 02 of 04</Label>
        <div className="title-serif" style={{ fontSize: 38, margin: '4px 0 8px' }}>Structure</div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', maxWidth: '58ch', lineHeight: 1.6 }}>
          Choose an act structure and approximate length.
        </div>
        <Placeholder label="Structure options" style={{ height: 200, marginTop: 24, maxWidth: 720 }} />
      </div>
    )
  }
  if (step === 4) {
    return (
      <div>
        <Label>Step 04 of 04</Label>
        <div className="title-serif" style={{ fontSize: 38, margin: '4px 0 8px' }}>Scaffold &amp; preview</div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', maxWidth: '58ch', lineHeight: 1.6 }}>
          Review the scaffolded workspace before you begin.
        </div>
        <Placeholder label="Preview workspace" style={{ height: 300, marginTop: 24, maxWidth: 720 }} />
      </div>
    )
  }
  // Step 3 — Characters (fully implemented)
  return (
    <div>
      <Label>Step 03 of 04</Label>
      <div className="title-serif" style={{ fontSize: 38, margin: '4px 0 8px' }}>Who&rsquo;s in this story?</div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', maxWidth: '58ch', lineHeight: 1.6 }}>
        Add the people you know about now. We&rsquo;ll build their first relationship edges from what you type;
        you can ignore any auto-suggestion.
      </div>
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
        {characters.map((c) => (
          <div
            key={c.n}
            style={{
              border: '1px solid var(--ink)',
              background: 'var(--paper)',
              padding: '12px 14px',
              display: 'grid',
              gridTemplateColumns: '40px 160px 100px 1fr 20px',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                background: 'repeating-linear-gradient(135deg, transparent 0 6px, rgba(26,29,36,0.08) 6px 7px)',
                border: '1px dashed var(--ink-3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--ink-3)',
              }}
            >
              {c.n.slice(0, 2).toUpperCase()}
            </div>
            <input
              defaultValue={c.n}
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 18,
                border: 'none',
                background: 'transparent',
                borderBottom: '1px solid var(--line)',
                padding: '4px 0',
                outline: 'none',
              }}
            />
            <select
              defaultValue={c.r}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                border: '1px solid var(--line)',
                padding: 4,
                background: 'var(--paper)',
              }}
            >
              <option>{c.r}</option>
            </select>
            <input
              defaultValue={c.d}
              style={{
                fontSize: 12,
                border: 'none',
                background: 'transparent',
                borderBottom: '1px solid var(--line)',
                padding: '4px 0',
                color: 'var(--ink-2)',
                outline: 'none',
              }}
            />
            <span className="dim" style={{ textAlign: 'center' }}>&#x2715;</span>
          </div>
        ))}
        <div
          style={{
            border: '1px dashed var(--ink-3)',
            padding: 12,
            textAlign: 'center',
            color: 'var(--ink-3)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          + Add a character
        </div>
      </div>
      <div
        style={{
          marginTop: 24,
          border: '1px solid var(--blue)',
          background: 'var(--blue-soft)',
          padding: '12px 16px',
          fontSize: 12,
          maxWidth: 720,
        }}
      >
        <Label style={{ color: 'var(--blue)' }}>Suggested relationships</Label>
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Tag variant="blue">Iris &harr; Cole &middot; conflict</Tag>
          <Tag variant="blue">Iris &harr; Wren &middot; unresolved</Tag>
          <Tag variant="blue">Iris &harr; Kai &middot; mentor</Tag>
          <Tag>Add your own</Tag>
        </div>
      </div>
    </div>
  )
}

function SetupPage() {
  const [currentStep, setCurrentStep] = useState(3)

  const getStepDone = (stepIndex: number) => {
    return stepIndex + 1 < currentStep
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Logo header */}
      <div style={{ padding: '16px 28px', borderBottom: '1.5px solid var(--ink)', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontStyle: 'italic' }}>
          BeatLume <small style={{ fontStyle: 'normal', fontSize: 11, color: 'var(--ink-2)' }}>New story</small>
        </div>
        <Label>Exit &middot; saves draft</Label>
      </div>

      {/* Stepper + content */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr', overflow: 'hidden' }}>
        {/* Steps sidebar */}
        <div
          style={{
            borderRight: '1px solid var(--ink)',
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            background: 'var(--paper-2)',
          }}
        >
          {steps.map(([num, label], i) => {
            const done = getStepDone(i)
            const isCurrent = i + 1 === currentStep
            return (
              <div
                key={num}
                onClick={() => setCurrentStep(i + 1)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  ...(isCurrent
                    ? { background: 'var(--paper)', border: '1.5px solid var(--ink)' }
                    : {}),
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    border: '1.5px solid var(--ink)',
                    background: done ? 'var(--ink)' : 'var(--paper)',
                    color: done ? 'var(--paper)' : 'var(--ink)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {done ? '\u2713' : num}
                </span>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16 }}>{label}</span>
              </div>
            )
          })}
          <div
            style={{
              marginTop: 20,
              borderTop: '1px dashed var(--ink-3)',
              paddingTop: 12,
              fontSize: 11,
              color: 'var(--ink-2)',
              lineHeight: 1.5,
            }}
          >
            Tell us as little or as much as you want. You can always edit everything later, and BeatLume does not
            lock decisions.
          </div>
        </div>

        {/* Step content */}
        <div style={{ padding: '40px 60px', overflow: 'auto' }}>
          <StepContent step={currentStep} />
          <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', maxWidth: 720 }}>
            <Btn
              variant="ghost"
              onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
            >
              &larr; {currentStep > 1 ? steps[currentStep - 2][1] : 'Back'}
            </Btn>
            <Btn
              variant="solid"
              onClick={() => setCurrentStep((s) => Math.min(4, s + 1))}
            >
              Continue &rarr; {currentStep < 4 ? steps[currentStep][1] : 'Finish'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/setup')({
  component: SetupPage,
})
