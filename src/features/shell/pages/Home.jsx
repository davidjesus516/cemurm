import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../app/providers/useAuth.jsx'
import { DASHBOARD_TOUR_STEPS } from '../../../domain/onboarding/content.js'
import DashboardTour from '../../onboarding/components/DashboardTour.jsx'
import { CompletionScreen, IncompleteBanner } from '../../onboarding/components/OnboardingStatus.jsx'
import WelcomeWalkthrough from '../../onboarding/components/WelcomeWalkthrough.jsx'
import { walkthroughDone } from '../../onboarding/localFlags.js'
import { useOnboarding } from '../../onboarding/useOnboarding.js'

// The four highlighted dashboard elements. Targets are the existing routes;
// "Performance mode" links to the setlists list where a musician picks a
// setlist to perform — the same target the guided tour's step 4 uses.
const CARDS = [
  { key: 'repertoire', to: '/songs', label: 'Repertoire', detail: 'Your song library' },
  { key: 'setlists', to: '/setlists', label: 'Setlists', detail: 'Plans for every gig' },
  { key: 'bandmates', to: '/bandmates', label: 'Bandmates', detail: 'Your collaborators' },
  { key: 'performance', to: '/setlists', label: 'Performance mode', detail: 'Ready for the stage' },
]

function VisitorHome() {
  if (!walkthroughDone()) return <WelcomeWalkthrough />
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-cem-elevated bg-cem-surface p-8 shadow-lg">
      <h1 className="text-2xl font-semibold text-cem-text">Welcome to CEMURM</h1>
      <p className="mt-2 text-sm text-cem-secondary-elevated">
        Organize your repertoire, build setlists and perform with your band.
      </p>
      <Link
        to="/auth"
        className="mt-6 inline-block rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90"
      >
        Get Started
      </Link>
    </div>
  )
}

function MemberDashboard() {
  const { steps, loading, progress, resumeStep, update } = useOnboarding()
  const [tourStep, setTourStep] = useState(null)
  const [showCompletion, setShowCompletion] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const autoStarted = useRef(false)

  useEffect(() => {
    if (autoStarted.current || loading) return
    if (steps.joinedOrg && !steps.tourCompleted) {
      autoStarted.current = true
      setTourStep(0)
    }
  }, [loading, steps.joinedOrg, steps.tourCompleted])

  async function finishTour() {
    setTourStep(null)
    await update({ tourCompleted: true })
    setShowCompletion(true)
  }

  function reopenTour() {
    setHelpOpen(false)
    setTourStep(0)
  }

  return (
    <div>
      {!progress.complete && <IncompleteBanner resumeStep={resumeStep} />}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cem-text">Your dashboard</h1>
          <p className="mt-1 text-sm text-cem-secondary">Pick up where you left off.</p>
        </div>
        <div className="relative">
          <button
            type="button"
            aria-label="Help"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen((v) => !v)}
            className="rounded-full border border-cem-elevated px-3 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated"
          >
            ?
          </button>
          {helpOpen && (
            <div className="absolute right-0 z-40 mt-2 w-40 rounded-lg border border-cem-elevated bg-cem-surface p-1 shadow-lg">
              <button
                type="button"
                onClick={reopenTour}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-cem-text hover:bg-cem-elevated"
              >
                Take a Tour
              </button>
            </div>
          )}
        </div>
      </div>

      {progress.completed > 0 && (
        <p className="mt-3 text-xs font-medium text-cem-amber">{progress.percent}% complete</p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {CARDS.map((card, index) => (
          <Link
            key={card.key}
            to={card.to}
            data-tour-step={index}
            className={`rounded-lg border bg-cem-surface p-5 ${
              tourStep === index
                ? 'animate-pulse border-cem-amber ring-2 ring-cem-amber'
                : 'border-cem-elevated'
            }`}
          >
            <h2 className="text-base font-semibold text-cem-text">{card.label}</h2>
            <p className="mt-1 text-xs text-cem-secondary-elevated">{card.detail}</p>
          </Link>
        ))}
      </div>

      {tourStep !== null && (
        <DashboardTour
          index={tourStep}
          onSkip={finishTour}
          onNext={() => {
            if (tourStep === DASHBOARD_TOUR_STEPS.length - 1) finishTour()
            else setTourStep((i) => i + 1)
          }}
        />
      )}
      {showCompletion && (
        <CompletionScreen steps={steps} onDismiss={() => setShowCompletion(false)} />
      )}
    </div>
  )
}

function Home() {
  const { user } = useAuth()
  return user ? <MemberDashboard /> : <VisitorHome />
}

export default Home
