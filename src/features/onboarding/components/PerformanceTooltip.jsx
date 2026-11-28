/* eslint-disable react/prop-types */
import { useState } from 'react'
import { FEATURE_TOOLTIP_TEXT, FEATURE_TOOLTIP_TITLE } from '../../../domain/onboarding/content.js'
import { markPerformanceTooltipSeen, performanceTooltipSeen } from '../localFlags.js'

// Feature-update tooltip for "Live Performance Mode". The stage page itself is
// outside this unit's edit surface, so the route wrapper shows the highlight
// above it the first time a user opens it (the exact interaction copy lives in
// domain/onboarding/content.js and is guarded there).
function PerformanceTooltip({ children }) {
  const [seen, setSeen] = useState(() => performanceTooltipSeen())

  function dismiss() {
    markPerformanceTooltipSeen()
    setSeen(true)
  }

  return (
    <div className="relative">
      {!seen && (
        <div
          role="status"
          className="mx-auto mb-3 max-w-2xl rounded-lg border border-cem-amber bg-cem-surface p-4"
        >
          <p className="text-sm font-semibold text-cem-amber">{FEATURE_TOOLTIP_TITLE}</p>
          <p className="mt-1 text-xs text-cem-secondary-elevated">{FEATURE_TOOLTIP_TEXT}</p>
          <button
            type="button"
            onClick={dismiss}
            className="mt-3 rounded-md border border-cem-elevated px-3 py-1.5 text-xs font-medium text-cem-text hover:bg-cem-elevated"
          >
            Got it
          </button>
        </div>
      )}
      {children}
    </div>
  )
}

export default PerformanceTooltip
