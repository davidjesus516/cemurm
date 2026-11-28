/* eslint-disable react/prop-types */
import { useState } from 'react'
import { SETLIST_TOOLTIP_TEXT } from '../../../domain/onboarding/content.js'
import { useOnboarding } from '../useOnboarding.js'

// Tier-2 transient control: no material, no decorative shadow on the row. The
// tooltip itself is a small callout rendered above the setlist page via a route
// wrapper (Setlists.jsx is outside this unit's edit surface). Shown once, then
// the `setlistTooltipSeen` flag is persisted with the preferences kv helper.
function SetlistTooltip({ children }) {
  const { steps, update } = useOnboarding()
  const seen = steps.setlistTooltipSeen === true
  const [dismissed, setDismissed] = useState(false)

  function dismiss() {
    setDismissed(true)
    void update({ setlistTooltipSeen: true })
  }

  const show = !seen && !dismissed

  return (
    <div className="relative">
      {show && (
        <div
          role="status"
          className="mb-3 flex items-center justify-between gap-3 rounded-md border border-cem-amber bg-cem-elevated px-3 py-2 text-sm text-cem-text"
        >
          <span>{SETLIST_TOOLTIP_TEXT}</span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss tip"
            className="rounded px-2 py-1 text-xs font-medium text-cem-amber hover:bg-cem-hover"
          >
            Got it
          </button>
        </div>
      )}
      {children}
    </div>
  )
}

export default SetlistTooltip
