/* eslint-disable react/prop-types */
import { DASHBOARD_TOUR_STEPS } from '../../../domain/onboarding/content.js'

// Tier 1 controlled overlay. Home owns the step index so it can paint the
// pulsing ring on the matching card; this component is only the instruction
// card. CSS-native animate-pulse supplies the ring motion (no animation lib).
function DashboardTour({ index, onNext, onSkip }) {
  const step = DASHBOARD_TOUR_STEPS[index]
  if (!step) return null

  return (
    <div
      role="dialog"
      aria-label="Dashboard guided tour"
      className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md rounded-xl border border-cem-amber bg-cem-surface p-5 shadow-xl"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-cem-amber">
        Tour step {step.step} of {DASHBOARD_TOUR_STEPS.length} · {step.element}
      </p>
      <p className="mt-2 text-base font-semibold text-cem-text">{step.instruction}</p>
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onSkip}
          className="rounded-md px-3 py-2 text-sm font-medium text-cem-secondary-elevated hover:bg-cem-elevated"
        >
          Skip Tour
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90"
        >
          {index === DASHBOARD_TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
        </button>
      </div>
    </div>
  )
}

export default DashboardTour
