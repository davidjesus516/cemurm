// Share surface for one setlist or one song (Hito 6 N3, T2).
//
// It is a button plus a panel, not a dialog: the sharing scenarios
// (features/export-and-sharing.feature:53-71, :106-125) ask for a link, a
// summary and a channel, and every one of those is visible in place.
//
// The panel carries `w-full` so it drops onto its own line inside the
// `flex-wrap` action rows of the setlist and song pages instead of squeezing
// the buttons beside it.
//
// Honest limits, recorded in odd/tasks/hito6-n3-product-slice.md: the link is
// an ordinary in-app deep link — access is whatever RLS already grants, so
// there is no expiring token here and no read-only audience link (that is the
// audience view, T3). The email scenario's default PDF attachment is absent
// (no PDF writer); mailto carries the summary and the link.

/* eslint-disable react/prop-types */

import { useState } from 'react'
import { SHARE_CHANNELS, shareUrl } from '../../../domain/setlist/sharing.js'
import QrCode from '../../../ui/patterns/QrCode.jsx'

export default function ShareMenu({ label = 'Share', text, url, subject, note }) {
  const [open, setOpen] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  async function copyLink() {
    setError('')
    setStatus('')
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable — copy the link from the list below.')
      }
      await navigator.clipboard.writeText(url)
      setStatus('Link copied')
    } catch (err) {
      setError(err.message)
    }
  }

  async function openChannel(channel) {
    setError('')
    setStatus('')
    // "A share sheet opens with the setlist summary" (:109, :116): prefer the
    // OS sheet when the browser has one, and fall back to the provider URL for
    // the email compose screen (:122) and wherever Web Share is missing.
    if (channel !== 'email' && typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: subject, text, url })
        setStatus('Shared')
        return
      } catch {
        // Dismissed, or the sheet refused the payload — open the channel URL.
      }
    }
    window.open(shareUrl(channel, { url, text, subject }), '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-md border border-cem-elevated px-4 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated"
      >
        {open ? 'Hide share' : label}
      </button>
      {open && (
        <div className="mt-3 w-full rounded-lg border border-cem-elevated bg-cem-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="rounded-md bg-cem-amber px-3 py-1.5 text-sm font-medium text-cem-base hover:bg-cem-amber/90"
            >
              Copy link
            </button>
            {SHARE_CHANNELS.map((channel) => (
              <button
                key={channel.value}
                type="button"
                onClick={() => openChannel(channel.value)}
                className="rounded-md border border-cem-elevated px-3 py-1.5 text-sm font-medium text-cem-text hover:bg-cem-elevated"
              >
                {channel.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowQr((value) => !value)}
              className="rounded-md border border-cem-elevated px-3 py-1.5 text-sm font-medium text-cem-text hover:bg-cem-elevated"
            >
              {showQr ? 'Hide QR code' : 'QR code'}
            </button>
          </div>
          <p className="mt-2 break-all text-xs text-cem-secondary">{url}</p>
          {showQr && (
            <div className="mt-2 flex flex-col items-start gap-1">
              <QrCode value={url} label={`QR code for ${url}`} />
              <p className="text-xs text-cem-secondary">Scan to open the same link.</p>
            </div>
          )}
          {note && <p className="mt-1 text-xs text-cem-secondary">{note}</p>}
          {status && <p className="mt-2 text-xs font-medium text-cem-amber">{status}</p>}
          {/* Rule 02 is a ratchet at its ceiling (240 occurrences), so new
              code spends no accent on an error line. The message reads on text. */}
          {error && <p className="mt-2 text-xs font-medium text-cem-text">{error}</p>}
        </div>
      )}
    </>
  )
}
