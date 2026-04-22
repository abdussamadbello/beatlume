import { useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { Tag, Label, Btn, Placeholder } from '../components/primitives'
import { useStore } from '../store'
import { useCreateStory } from '../api/stories'
import { api } from '../api/client'
import type { Character } from '../types'

interface Premise {
  title: string
  logline: string
  genres: string
  subgenre: string
  themes: string
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--ink)',
  background: 'var(--paper)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--ink)',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: 'var(--font-serif)',
  fontSize: 15,
  lineHeight: 1.5,
  resize: 'vertical',
  minHeight: 90,
}

const steps: [string, string, boolean][] = [
  ['01', 'Premise', true],
  ['02', 'Structure', true],
  ['03', 'Characters', false],
  ['04', 'Scaffold & preview', false],
]

const roleOptions = ['Protagonist', 'Antagonist', 'Foil', 'Mentor', 'Mirror', 'Family', 'Ward', 'Witness'] as const

function StepContent({
  step,
  premise,
  setPremise,
}: {
  step: number
  premise: Premise
  setPremise: (patch: Partial<Premise>) => void
}) {
  const setupCharacters = useStore(s => s.setupCharacters)
  const addSetupCharacter = useStore(s => s.addSetupCharacter)
  const updateSetupCharacter = useStore(s => s.updateSetupCharacter)
  const removeSetupCharacter = useStore(s => s.removeSetupCharacter)

  if (step === 1) {
    return <StepPremise premise={premise} setPremise={setPremise} />
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
    const charCount = setupCharacters.filter(c => c.name.trim()).length
    return (
      <div>
        <Label>Step 04 of 04</Label>
        <div className="title-serif" style={{ fontSize: 38, margin: '4px 0 8px' }}>Scaffold &amp; preview</div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', maxWidth: '58ch', lineHeight: 1.6 }}>
          BeatLume will create your workspace with the following structure. You can change everything later.
        </div>
        <div style={{ marginTop: 24, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={{ border: '1px solid var(--ink)', padding: '14px 16px' }}>
              <Label>Characters</Label>
              <div className="title-serif" style={{ fontSize: 28, lineHeight: 1 }}>{charCount}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                {setupCharacters.filter(c => c.name.trim()).map(c => c.name).join(', ') || 'None yet'}
              </div>
            </div>
            <div style={{ border: '1px solid var(--ink)', padding: '14px 16px' }}>
              <Label>Structure</Label>
              <div className="title-serif" style={{ fontSize: 28, lineHeight: 1 }}>3 Acts</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>~40 scenes estimated</div>
            </div>
            <div style={{ border: '1px solid var(--ink)', padding: '14px 16px' }}>
              <Label>Workspace</Label>
              <div className="title-serif" style={{ fontSize: 28, lineHeight: 1 }}>Ready</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>Graph, Timeline, Draft</div>
            </div>
          </div>
          {/* What will be created */}
          <div style={{ border: '1px solid var(--line)', padding: '16px 20px' }}>
            <Label>Your workspace will include</Label>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Relationship graph</span>
                <span style={{ color: 'var(--ink-3)' }}>{charCount} nodes, auto-edges</span>
              </div>
              <div style={{ borderTop: '1px dashed var(--line-2)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Tension timeline</span>
                <span style={{ color: 'var(--ink-3)' }}>Empty, ready to score</span>
              </div>
              <div style={{ borderTop: '1px dashed var(--line-2)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Scene board</span>
                <span style={{ color: 'var(--ink-3)' }}>3 act columns</span>
              </div>
              <div style={{ borderTop: '1px dashed var(--line-2)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Draft editor</span>
                <span style={{ color: 'var(--ink-3)' }}>Scene-locked, AI-assisted</span>
              </div>
              <div style={{ borderTop: '1px dashed var(--line-2)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>AI Insights</span>
                <span style={{ color: 'var(--ink-3)' }}>Pacing, continuity, structure</span>
              </div>
            </div>
          </div>
          <div style={{ border: '1px solid var(--blue)', background: 'var(--blue-soft)', padding: '12px 16px', fontSize: 12 }}>
            <Label style={{ color: 'var(--blue)' }}>Nothing is locked</Label>
            <div style={{ marginTop: 4, color: 'var(--ink-2)' }}>
              You can add characters, change structure, and adjust everything from inside the workspace.
            </div>
          </div>
        </div>
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
        {setupCharacters.map((c, i) => (
          <div
            key={i}
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
              {(c.name || '??').slice(0, 2).toUpperCase()}
            </div>
            <input
              value={c.name}
              onChange={(e) => updateSetupCharacter(i, { name: e.target.value })}
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
              value={c.role}
              onChange={(e) => updateSetupCharacter(i, { role: e.target.value })}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                border: '1px solid var(--line)',
                padding: 4,
                background: 'var(--paper)',
              }}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <input
              value={c.description}
              onChange={(e) => updateSetupCharacter(i, { description: e.target.value })}
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
            <span
              className="dim"
              onClick={() => removeSetupCharacter(i)}
              style={{ textAlign: 'center', cursor: 'pointer' }}
            >
              &#x2715;
            </span>
          </div>
        ))}
        <div
          onClick={() => addSetupCharacter()}
          style={{
            border: '1px dashed var(--ink-3)',
            padding: 12,
            textAlign: 'center',
            color: 'var(--ink-3)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
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

function StepPremise({ premise, setPremise }: { premise: Premise; setPremise: (patch: Partial<Premise>) => void }) {
  const { title, logline, genres, subgenre, themes } = premise
  return (
    <div>
      <Label>Step 01 of 04</Label>
      <div className="title-serif" style={{ fontSize: 38, margin: '4px 0 8px' }}>What&rsquo;s your story about?</div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', maxWidth: '58ch', lineHeight: 1.6 }}>
        Start with a title and a logline. You can refine everything from inside the workspace.
      </div>
      <div style={{ marginTop: 24, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <Label>Title *</Label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setPremise({ title: e.target.value })}
            style={{ ...inputStyle, marginTop: 6, fontFamily: 'var(--font-serif)', fontSize: 22 }}
            placeholder="A Stranger in the Orchard"
          />
        </div>
        <div>
          <Label>Logline</Label>
          <textarea
            value={logline}
            onChange={(e) => setPremise({ logline: e.target.value })}
            style={{ ...textareaStyle, marginTop: 6 }}
            placeholder="A widow returning to her family's failing orchard discovers the stranger who appears at harvest may be the one who buried her sister."
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <Label>Genres (comma-separated)</Label>
            <input
              value={genres}
              onChange={(e) => setPremise({ genres: e.target.value })}
              style={{ ...inputStyle, marginTop: 6 }}
              placeholder="Literary, Mystery"
            />
          </div>
          <div>
            <Label>Subgenre</Label>
            <input
              value={subgenre}
              onChange={(e) => setPremise({ subgenre: e.target.value })}
              style={{ ...inputStyle, marginTop: 6 }}
              placeholder="Domestic noir"
            />
          </div>
        </div>
        <div>
          <Label>Themes (comma-separated)</Label>
          <input
            value={themes}
            onChange={(e) => setPremise({ themes: e.target.value })}
            style={{ ...inputStyle, marginTop: 6 }}
            placeholder="Grief, inheritance, return"
          />
        </div>
      </div>
    </div>
  )
}

function SetupPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [premise, setPremiseState] = useState<Premise>({
    title: '',
    logline: '',
    genres: '',
    subgenre: '',
    themes: '',
  })
  const setPremise = (patch: Partial<Premise>) => setPremiseState((p) => ({ ...p, ...patch }))

  const setupCharacters = useStore((s) => s.setupCharacters)
  const createStory = useCreateStory()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const getStepDone = (stepIndex: number) => {
    return stepIndex + 1 < currentStep
  }

  const parseList = (s: string): string[] =>
    s.split(',').map((x) => x.trim()).filter(Boolean)

  const canCreate = premise.title.trim().length > 0 && !submitting

  const handleCreate = async () => {
    if (!canCreate) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      const story = await createStory.mutateAsync({
        title: premise.title.trim(),
        logline: premise.logline.trim(),
        genres: parseList(premise.genres),
        subgenre: premise.subgenre.trim(),
        themes: parseList(premise.themes),
      })
      const namedCharacters = setupCharacters.filter((c) => c.name.trim())
      await Promise.all(
        namedCharacters.map((c) =>
          api.post<Character>(`/api/stories/${story.id}/characters`, {
            name: c.name.trim(),
            role: c.role,
            description: c.description,
          }),
        ),
      )
      navigate({ to: '/stories/$storyId', params: { storyId: story.id } })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create story')
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Logo header */}
      <div style={{ padding: '16px 28px', borderBottom: '1.5px solid var(--ink)', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontStyle: 'italic' }}>
          BeatLume <small style={{ fontStyle: 'normal', fontSize: 11, color: 'var(--ink-2)' }}>New story</small>
        </div>
        <Link to="/dashboard" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)', textDecoration: 'none' }}>Exit &middot; back to dashboard</Link>
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
          <StepContent step={currentStep} premise={premise} setPremise={setPremise} />
          {submitError && (
            <div style={{ marginTop: 16, maxWidth: 720, border: '1px solid var(--red)', background: 'var(--red-soft, #fce8e8)', padding: '10px 14px', fontSize: 12, color: 'var(--red)' }}>
              {submitError}
            </div>
          )}
          <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', maxWidth: 720 }}>
            <Btn
              variant="ghost"
              onClick={() => currentStep === 1 ? navigate({ to: '/dashboard' }) : setCurrentStep((s) => s - 1)}
              disabled={submitting}
            >
              &larr; {currentStep > 1 ? steps[currentStep - 2][1] : 'Dashboard'}
            </Btn>
            {currentStep < 4 ? (
              <Btn
                variant="solid"
                onClick={() => setCurrentStep((s) => s + 1)}
                disabled={currentStep === 1 && !premise.title.trim()}
              >
                Continue &rarr; {steps[currentStep][1]}
              </Btn>
            ) : (
              <Btn
                variant="solid"
                onClick={handleCreate}
                disabled={!canCreate}
              >
                {submitting ? 'Creating…' : 'Create Story →'}
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/setup')({
  component: SetupPage,
})
