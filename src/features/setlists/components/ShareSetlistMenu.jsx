// Setlist share panel (features/export-and-sharing.feature:55-132).
//
// Tier 2 surface: the panel borrows the Collaboration card's vocabulary
// (raised surface, hairline border, no material) instead of introducing a
// dialog. Copy Link is the scenario's primary action; the three integrated
// targets open the channel's own share sheet with the summary and deep link
// already in it.
//
// What is not here, on purpose: view-only link tokens, the 7-day expiry, QR,
// embed, proximity codes and the chord-chart PNG. Those need a share-token
// table (and, for the PNG, a canvas renderer) that this build does not have —
// see the header of src/domain/setlist/share.js and the ODD log entry.

/* eslint-disable react/prop-types */

import { useState } from 'react'

import { setlistDeepLink, shareTargets } from '../../../domain/setlist/share.js'

/**
 * @param {{
 *   setlist: { id: string, name?: string },
 *   songs: import('../../../domain/setlist/exporters/shared.js').ExportSong[],
 *   onNotice?: (message: string) => void,
 *   onError?: (message: string) => void,
 * }} props
 */
export default function ShareSetlistMenu({ setlist, songs, onNotice, onError }) {
  const [busy, setBusy] = useState(false)
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const link = setlistDeepLink(setlist.id, origin)
  const targets = shareTargets(setlist, songs, origin)

  async function copyLink() {
    setBusy(true)
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard is not available in this browser.')
      }
      await navigator.clipboard.writeText(link)
      onNotice?.('Link copied to the clipboard')
    } catch (err) {
      onError?.(err.message)
    } finally {
      setBusy(false)
    }
  }

  function openTarget(target) {
    window.open(target.href, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="mt-3 rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-xs">
      <h2 className="text-sm font-semibold text-cem-text">Share setlist</h2>
      <p className="mt-1 text-xs text-cem-secondary">
        The link opens this setlist for bandmates who already have access. Anyone else is
        stopped by access control.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copyLink}
          disabled={busy}
          className="rounded-md bg-cem-amber px-3 py-1 text-xs font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
        >
          Copy link
        </button>
        {targets.map((target) => (
          <button
            key={target.value}
            type="button"
            onClick={() => openTarget(target)}
            disabled={busy}
            className="rounded-md border border-cem-elevated px-3 py-1 text-xs font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
          >
            {target.label}
          </button>
        ))}
      </div>

      <p className="mt-3 border-t border-cem-elevated pt-2 font-mono text-xs break-all text-cem-secondary">
        {link}
      </p>
    </div>
  )
}
