/* eslint-disable react/prop-types */
import { useNavigate } from 'react-router-dom'
import {
  COMPLETION_HEADLINE,
  INCOMPLETE_BANNER_TEXT,
} from '../../../domain/onboarding/content.js'

// Exact feature copy lives in the domain content module; this component only
// wires it to the resume target and the celebration. Tier 1, token-only.
export function IncompleteBanner({ resumeStep }) {
  const navigate = useNavigate()
  if (!resumeStep) return null

  return (
    <button
      type="button"
      onClick={() => navigate(`/onboarding/setup?step=${resumeStep}`)}
      className="mb-5 flex w-full items-center justify-between gap-3 rounded-lg border border-cem-amber bg-cem-surface px-4 py-3 text-left text-sm font-medium text-cem-text hover:bg-cem-elevated"
    >
      <span>{INCOMPLETE_BANNER_TEXT}</span>
      <span aria-hidden="true" className="text-cem-amber">Continue →</span>
    </button>
  )
}

export function CompletionScreen({ onDismiss }) {
  return (
    <div
      role="dialog"
      aria-label="Onboarding complete"
      className="fixed inset-0 z-50 flex items-center justify-center bg-cem-base/95 p-4"
    >
      <div className="max-w-sm rounded-xl border border-cem-amber bg-cem-surface p-8 text-center shadow-xl">
        <div aria-hidden="true" className="mx-auto flex h-14 w-14 animate-pulse items-center justify-center rounded-full bg-cem-amber text-2xl font-bold text-cem-base">
          ✓
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-cem-text">{COMPLETION_HEADLINE}</h2>
        <p className="mt-2 text-sm text-cem-secondary-elevated">
          Your setup is complete. Your personalized dashboard is ready.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 w-full rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90"
        >
          Go to my dashboard
        </button>
      </div>
    </div>
  )
}
