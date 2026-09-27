// /guardian/revoke — the guardian's withdraw step (scenario 9).
//
// Deliberately OUTSIDE AppLayout and outside RequireAuth, for the same reason
// as /guardian/confirm and with the same constraint: a parent with no account and
// no password is the intended caller, and the 128-bit revocation_token plus the
// emailed address are the whole authorization.
//
// This page calls 0017's revoke_guardian_consent (lines 361-417) unchanged.
// WU4 did not add a second revocation path: the capability shipped in Hito 4, it
// simply had no link to travel on until the Edge Function started sending one.
//
// The WITNESS. 0017's revoke requires the guardian's email alongside the token —
// "the token is the secret, the email is the witness". So the link carries the
// address it was sent to, and this page passes it through untouched. That is
// 0017's design, not a convenience: a leaked token on its own still cannot
// revoke somebody else's consent, because the address is not guessable from it.
// It is also why the page will NOT offer a field to type the address in — a
// typed-in witness is a guessable one, which would turn a second factor into
// decoration.
//
// WHY THERE IS NO CONFIRMATION DIALOG: the guardian is one click from re-locking
// a child's account, and the browser's own confirm() is the right weight for it.
// The button below states the consequence in its label so the choice is informed
// rather than reflexive.

import { useState } from 'react'
import { isCompleteLink, readGuardianLink } from '../lib/guardianLink.js'
import { revokeGuardianConsent } from '../lib/minors.js'

// Module scope, read once, scrubbed immediately. See src/lib/guardianLink.js.
const link = readGuardianLink()

const cardClass = 'rounded-lg bg-cem-surface p-6 shadow'

export default function GuardianRevoke() {
  // 'ready' | 'working' | 'done' | 'failed'
  const [state, setState] = useState(
    isCompleteLink(link, { needsEmail: true }) ? 'ready' : 'failed',
  )

  async function handleRevoke() {
    setState('working')
    try {
      await revokeGuardianConsent({
        userId: link.userId,
        guardianEmail: link.guardianEmail,
        token: link.token,
      })
      setState('done')
    } catch {
      // One message for every failure, matching the confirm page and for the
      // same reason: the server refuses to distinguish a wrong token from a
      // spent one, and this page will not guess on its behalf.
      setState('failed')
    }
  }

  function handleConfirmClick() {
    // State the consequence before the irreversible half of it. A guardian
    // withdrawing a child's consent is a legitimate, expected action — it just
    // should never be a reflex.
    if (!window.confirm(
      'Withdraw this consent? Their CEMURM account will be locked again straight away. '
      + 'The record of the consent is kept and is not deleted.',
    )) {
      setState('ready')
      return
    }
    handleRevoke()
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className={cardClass}>
        <h1 className="text-2xl font-bold text-cem-text">Withdraw consent</h1>

        {state === 'ready' && (
          <>
            <p className="mt-2 text-sm text-cem-secondary">
              You are withdrawing the guardian consent for a CEMURM account belonging to
              a musician under 18.
            </p>
            <p className="mt-4 rounded-md bg-cem-elevated px-3 py-2 text-sm text-cem-text">
              Their account locks immediately and they lose access to every feature,
              including publishing anything publicly. The record of the consent stays
              in the academy&rsquo;s ledger — withdrawing is not deletion.
            </p>
            <button
              type="button"
              onClick={handleConfirmClick}
              className="mt-6 w-full rounded-md bg-cem-rose px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-rose/90"
            >
              Withdraw this consent now
            </button>
            <p className="mt-3 text-center text-xs text-cem-secondary">
              Changed your mind? You can close this page and nothing is affected.
            </p>
          </>
        )}

        {state === 'working' && (
          <p role="status" className="mt-4 text-sm text-cem-secondary">
            Withdrawing the consent…
          </p>
        )}

        {state === 'done' && (
          <>
            <div
              role="status"
              className="mt-4 rounded-md bg-cem-emerald/10 px-3 py-2 text-sm text-cem-emerald"
            >
              Consent withdrawn. Their account is locked again.
            </div>
            <p className="mt-4 text-sm text-cem-secondary">
              The record of the consent remains in the academy&rsquo;s ledger, and
              anything they published publicly is a separate question — contact the
              academy if you need that reviewed. You can close this page.
            </p>
          </>
        )}

        {state === 'failed' && (
          <>
            <div
              role="alert"
              className="mt-4 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose"
            >
              This link no longer works.
            </div>
            <p className="mt-4 text-sm text-cem-secondary">
              Either it has already been used, or the consent it belonged to was
              already withdrawn or replaced. Nothing has been changed. Use the link in
              the original email if you have it, or contact the academy.
            </p>
          </>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-cem-secondary">CEMURM</p>
    </div>
  )
}
