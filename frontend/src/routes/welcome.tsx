import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Btn, Label, Panel, PanelHead } from '../components/primitives'

const labelStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-3)',
  display: 'block',
  marginBottom: 4,
}

const radioLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  color: 'var(--ink-2)',
  cursor: 'pointer',
  padding: '8px 12px',
  border: '1px solid var(--line)',
  background: 'var(--paper)',
}

const radioLabelActiveStyle = {
  ...radioLabelStyle,
  border: '1.5px solid var(--ink)',
  background: 'var(--paper-2)',
}

const selectStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  border: '1px solid var(--ink)',
  background: 'var(--paper)',
  padding: '6px 10px',
  width: '100%',
}

const steps = [
  { num: '01', label: 'Welcome' },
  { num: '02', label: 'How you write' },
  { num: '03', label: 'Ready to begin' },
]

const genres = ['Literary', 'Mystery', 'Sci-Fi', 'Fantasy', 'Romance', 'Thriller', 'Horror', 'Historical'] as const

function StepContent({
  step,
  writerType,
  setWriterType,
  storyLength,
  setStoryLength,
  selectedGenres,
  toggleGenre,
  navigate,
}: {
  step: number
  writerType: string
  setWriterType: (v: string) => void
  storyLength: string
  setStoryLength: (v: string) => void
  selectedGenres: string[]
  toggleGenre: (g: string) => void
  navigate: ReturnType<typeof useNavigate>
}) {
  if (step === 1) {
    return (
      <div>
        <Label>Step 01 of 03</Label>
        <div
          className="title-serif"
          style={{ fontSize: 38, margin: '4px 0 8px' }}
        >
          Welcome to BeatLume
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--ink-2)',
            maxWidth: '58ch',
            lineHeight: 1.6,
            marginBottom: 32,
          }}
        >
          BeatLume is a graph-driven story planner that helps you see the shape of your narrative
          before you write it. Here is what you can do:
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
          <Panel>
            <PanelHead left="Graph-Driven Planning" />
            <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Visualize character relationships, plot threads, and scene connections as an
              interactive graph. See how every element connects.
            </div>
          </Panel>

          <Panel>
            <PanelHead left="AI Insights" />
            <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Get intelligent suggestions about pacing, character arcs, plot holes, and structural
              balance. Powered by analysis of your story graph.
            </div>
          </Panel>

          <Panel>
            <PanelHead left="Tension Tracking" />
            <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Map the emotional trajectory of your story with scene-by-scene tension curves.
              Identify lulls and peaks before they surprise your readers.
            </div>
          </Panel>
        </div>
      </div>
    )
  }

  if (step === 2) {
    return (
      <div>
        <Label>Step 02 of 03</Label>
        <div
          className="title-serif"
          style={{ fontSize: 38, margin: '4px 0 8px' }}
        >
          How do you write?
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--ink-2)',
            maxWidth: '58ch',
            lineHeight: 1.6,
            marginBottom: 32,
          }}
        >
          Tell us a bit about your writing style so we can tailor your experience.
        </div>

        {/* Writer type */}
        <div style={{ marginBottom: 24, maxWidth: 400 }}>
          <label style={labelStyle}>Writing Style</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {(['Pantser', 'Plotter', 'Hybrid'] as const).map((type) => (
              <label
                key={type}
                style={writerType === type ? radioLabelActiveStyle : radioLabelStyle}
              >
                <input
                  type="radio"
                  name="writerType"
                  value={type}
                  checked={writerType === type}
                  onChange={() => setWriterType(type)}
                  style={{ accentColor: 'var(--ink)' }}
                />
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--ink)' }}>{type}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                    {type === 'Pantser' && 'Discovery writer. You find the story as you write.'}
                    {type === 'Plotter' && 'You outline extensively before drafting.'}
                    {type === 'Hybrid' && 'A mix of planning and discovery.'}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Story length */}
        <div style={{ marginBottom: 24, maxWidth: 400 }}>
          <label style={labelStyle}>Typical Story Length</label>
          <select
            value={storyLength}
            onChange={(e) => setStoryLength(e.target.value)}
            style={selectStyle}
          >
            <option value="short">Short Story (under 20k words)</option>
            <option value="novel">Novel (40k - 100k words)</option>
            <option value="epic">Epic (100k+ words)</option>
          </select>
        </div>

        {/* Genre preferences */}
        <div style={{ maxWidth: 400 }}>
          <label style={labelStyle}>Genres you enjoy writing</label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              marginTop: 8,
            }}
          >
            {genres.map((genre) => (
              <label
                key={genre}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 12,
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedGenres.includes(genre)}
                  onChange={() => toggleGenre(genre)}
                  style={{ accentColor: 'var(--ink)' }}
                />
                {genre}
              </label>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Step 3
  return (
    <div>
      <Label>Step 03 of 03</Label>
      <div
        className="title-serif"
        style={{ fontSize: 38, margin: '4px 0 8px' }}
      >
        Ready to begin
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--ink-2)',
          maxWidth: '58ch',
          lineHeight: 1.6,
          marginBottom: 32,
        }}
      >
        You are all set. Choose how you want to start:
      </div>

      <div style={{ display: 'flex', gap: 20, maxWidth: 600 }}>
        <div
          style={{
            flex: 1,
            border: '1.5px solid var(--ink)',
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20 }}>
            Create your first story
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, flex: 1 }}>
            Start from scratch with our guided setup wizard. Define your premise, characters,
            and structure step by step.
          </div>
          <Btn variant="solid" onClick={() => navigate({ to: '/setup' })}>
            Start creating
          </Btn>
        </div>

        <div
          style={{
            flex: 1,
            border: '1px solid var(--line)',
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20 }}>
            Explore a sample
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, flex: 1 }}>
            See BeatLume in action with a fully built-out sample story. Browse scenes, characters,
            and the tension curve.
          </div>
          <Btn variant="ghost" onClick={() => navigate({ to: '/' })}>
            Open sample
          </Btn>
        </div>
      </div>
    </div>
  )
}

function WelcomePage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [writerType, setWriterType] = useState('Hybrid')
  const [storyLength, setStoryLength] = useState('novel')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Logo header */}
      <div
        style={{
          padding: '16px 28px',
          borderBottom: '1.5px solid var(--ink)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontStyle: 'italic' }}>
          BeatLume{' '}
          <small style={{ fontStyle: 'normal', fontSize: 11, color: 'var(--ink-2)' }}>
            Welcome
          </small>
        </div>
        <Label>Step {currentStep} of 3</Label>
      </div>

      {/* Stepper + content */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          overflow: 'hidden',
        }}
      >
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
          {steps.map((s, i) => {
            const done = i + 1 < currentStep
            const isCurrent = i + 1 === currentStep
            return (
              <div
                key={s.num}
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
                  {done ? '\u2713' : s.num}
                </span>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16 }}>{s.label}</span>
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
            You can change any of these preferences later in Settings.
          </div>
        </div>

        {/* Step content */}
        <div style={{ padding: '40px 60px', overflow: 'auto' }}>
          <StepContent
            step={currentStep}
            writerType={writerType}
            setWriterType={setWriterType}
            storyLength={storyLength}
            setStoryLength={setStoryLength}
            selectedGenres={selectedGenres}
            toggleGenre={toggleGenre}
            navigate={navigate}
          />
          <div
            style={{
              marginTop: 32,
              display: 'flex',
              justifyContent: 'space-between',
              maxWidth: 600,
            }}
          >
            <Btn
              variant="ghost"
              onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
              style={{
                visibility: currentStep > 1 ? 'visible' : 'hidden',
              }}
            >
              &larr; Back
            </Btn>
            {currentStep < 3 && (
              <Btn
                variant="solid"
                onClick={() => setCurrentStep((s) => Math.min(3, s + 1))}
              >
                Continue &rarr;
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/welcome')({
  component: WelcomePage,
})
