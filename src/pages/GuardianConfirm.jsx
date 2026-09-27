// /guardian/confirm — the guardian's approve step (scenario 5).
//
// Deliberately OUTSIDE AppLayout and outside RequireAuth (see src/App.jsx): a
// parent who has never used CEMURM and has no account is the primary reader of
// this page, and that is the entire point of the 128-bit capability token. The
// route looks the same as /overlay/:sessionId for the same reason — a public URL
// that carries its own authorization and needs nothing from the app shell.
//
// The three things this page must get right, and how:
//   · it NEVER auto-confirms. A link-scanner in a mail client, a chat preview or
//     a prefetch would spend the one-shot capability and leave the guardian
//     looking at a dead link. A real click is required.
//   · it does not treat "the link worked before" as evidence. The ledger is the
//     only authority, and the server answers every failure with one string, so
//     this page has exactly one failure message and never speculates about which
//     failure it was.
//   · it never puts the token back in the address bar — readGuardianLink scrubs
//     the query string in the same synchronous block that reads it.

import { useState } from 'react'
import { isCompleteLink, readGuardianLink } from '../lib/guardianLink.js'
import { confirmGuardianConsent } from '../lib/minors.js'

// Module scope, read once. See src/lib/guardianLink.js for why this is not an
// effect: the token must not survive the first render in the address bar.
const link = readGuardianLink()

const cardClass = 'rounded-lg bg-cem-surface p-6 shadow'

export default function GuardianConfirm() {
  // 'ready' | 'working' | 'done' | 'failed'
  const [state, setState] = useState(isCompleteLink(link) ? 'ready' : 'failed')

  async function handleApprove() {
    setState('working')
    try {
      await confirmGuardianConsent({ userId: link.userId, token: link.token })
      setState('done')
    } catch {
      // One message for every server failure, on purpose. The server will not
      // say whether the link was wrong, spent, revoked or too late, and a page
      // that guessed would be a token oracle pointed at a child's supervision
      // record. The guard throws a whitelisted message for the RPC's single
      // error string and a generic one for anything else.
      setState('failed')
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className={cardClass}>
        <h1 className="text-2xl font-bold text-cem-text">Guardian consent</h1>

        {state === 'ready' && (
          <>
            <p className="mt-2 text-sm text-cem-secondary">
              You are approving a CEMURM account for a musician under 18. Read the
              consent text they will be held to before you approve it — it is the same
              text stored with the record.
            </p>
            <p className="mt-4 rounded-md bg-cem-elevated px-3 py-2 text-sm text-cem-text">
              They will be able to take part in CEMURM activities under the academy&rsquo;s
              supervision. Public sharing of their contributions still needs a
              separate approval, which you can give later from their account.
            </p>
            <p className="mt-4 text-sm text-cem-secondary">
              This link works once. Approving unlocks their account; it does not sign
              you in and it does not give you access to their music.
            </p>
            <button
              type="button"
              onClick={handleApprove}
              className="mt-6 w-full rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90"
            >
              I approve this consent
            </button>
          </>
        )}

        {state === 'working' && (
          <p role="status" className="mt-4 text-sm text-cem-secondary">
            Recording your approval…
          </p>
        )}

        {state === 'done' && (
          <>
            <div
              role="status"
              className="mt-4 rounded-md bg-cem-emerald/10 px-3 py-2 text-sm text-cem-emerald"
            >
              Consent approved. Their account is unlocked.
            </div>
            <p className="mt-4 text-sm text-cem-secondary">
              They can start using the app now. Nothing else is needed from you, and
              you can close this page. If you change your mind, use the withdraw link
              in the same email — withdrawing locks the account again and never
              deletes the record.
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
              Either it has already been used, it was withdrawn, or the request was
              replaced by a newer one. Nothing has been changed. If you did not expect
              this message at all, do not approve anything — contact the academy
              directly.
            </p>
          </>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-cem-secondary">CEMURM</p>
    </div>
  )
}
