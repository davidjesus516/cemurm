// Hito 4 — the GUARDIAN'S half of the public-sharing approval handshake
// (features/minors-and-guardian-consent.feature scenario 4).
//
// Migration 0034 mails the guardian a one-shot link
//   `${siteUrl}/guardian/approve?user=…&token=…&email=…`
// (supabase/functions/send-guardian-consent/index.ts:220) and grants
// public.approve_guardian_public_sharing_by_token to `anon`, so the transition
// from public_sharing_approved=false to true is the GUARDIAN's to make with no
// account and no session. Before this page existed the email had no approve link:
// the minor could self-approve via the deprecated RPC, which was the defect.
//
// Three obligations are load-bearing here, not decoration:
//
//   1. STRIP THE CAPABILITY. The token+email pair is read once into component
//      state and then removed from the address bar, so it survives neither a
//      bookmark nor a Referer header. The edge function's comment (:215-218)
//      states this obligation; this file is the other half of it.
//   2. ONE MESSAGE FOR EVERY FAILURE. The server raises a single string for a
//      wrong token, an unknown account, a wrong email, an already-approved
//      consent, a revoked one and a no-longer-active consent alike
//      (0034:32-40). This page must not turn that back into distinguishable
//      states, or the URL becomes an oracle for "does this account exist" /
//      "was this consent already used".
//   3. NO AUTO-SUBMIT. This flips a supervision record for a child on the
//      strength of a link in an inbox. It is a deliberate click or it is
//      nothing — a page that approved on render would let anything that can
//      prefetch a URL (a mail client, a chat client, a security scanner) spend a
//      child's public-sharing approval without a human ever seeing the words.

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { approveGuardianPublicSharingByToken } from '../../../data/repositories/minors.js'

// Where the link strips itself to. Kept as a constant because the raw
// `window.history.replaceState` would leave react-router's own location object
// still holding the query string, and the next relative navigation would then
// put the token back in the address bar.
const APPROVE_PATH = '/guardian/approve'

// Plain-language restatement of what the guardian is agreeing to. NOT a quote:
// the exact consent_text lives in the ledger, the email rendered it, and this
// page cannot re-read it — guardian_consents has no anon select grant and the
// RPC returns void, so there is nothing here to quote from. The email is the
// record of the wording that was actually shown; this screen only says what
// kind of decision the button below is.
const APPROVE_SUMMARY =
  'This allows your child to publish their contributions publicly in the CEMURM library. ' +
  'It does not affect their account access — only public sharing. This approval can be ' +
  'withdrawn at any time using the revoke link in the same email.'

// ready       → the explainer and the approve button
// submitting  → the RPC is in flight
// approved    → the consent row has public_sharing_approved = true
// failed      → the RPC refused or the call never completed
export default function GuardianApprove() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Snapshot of the emailed capability, taken ONCE on mount and then owned by
  // this component. Reading it from the hook on every render would be wrong:
  // the hook reflects the address bar, and the whole point is to empty the
  // address bar. A snapshot is what survives obligation 1.
  const [link] = useState(() => ({
    userId: searchParams.get('user') ?? '',
    token: searchParams.get('token') ?? '',
    email: searchParams.get('email') ?? '',
  }))
  const [phase, setPhase] = useState('ready')
  const [failure, setFailure] = useState('')

  // Obligation 1. Runs on mount, before anything can be sent: the page makes
  // no network call until the guardian clicks, so by the time this page's own
  // button exists the address bar is already clean. `replace` and not `push`,
  // so the token URL never enters session history and Back cannot return to
  // it. `navigate(…, { replace: true })` IS react-router's history.replace, a
  // window.history.replaceState call under the hood — but it additionally
  // updates the router's in-memory location, which the raw DOM API does not.
  useEffect(() => {
    if (window.location.search) navigate(APPROVE_PATH, { replace: true })
  }, [navigate])

  // A link missing any of the three parts cannot be completed, and guessing the
  // other parts is not an option. Decided from the URL alone, so it reveals
  // nothing about the server: no call is made.
  const linkIncomplete = !link.userId || !link.token || !link.email

  async function handleApprove() {
    if (linkIncomplete || phase === 'submitting') return
    setPhase('submitting')
    setFailure('')
    try {
      await approveGuardianPublicSharingByToken({
        userId: link.userId,
        token: link.token,
        email: link.email,
      })
      setPhase('approved')
    } catch (error) {
      // ⚠ Obligation 2. The repository re-throws the server's own single
      // string verbatim ('Consent not found or already finalized.') and maps
      // every transport-level fault to the one generic sentence. Both are
      // independent of whether the account or the token exists, so rendering
      // error.message cannot tell a caller more than the server already did.
      // The page must NOT branch on the text, and must not add a second,
      // more specific message: a wrong link and an already-used link are the
      // same outcome here, and saying otherwise would hand out exactly the
      // signal 0034 refuses to emit.
      setFailure(error.message)
      setPhase('failed')
    }
  }

  if (linkIncomplete) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-bold text-cem-text">This link is incomplete</h1>
        <div role="alert" className="mt-4 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">
          <p className="font-medium">This link is missing part of what it needs to work.</p>
          <p className="mt-1 text-cem-secondary">
            Ask your child to resend the request from their account, and open the newest email
            directly — a link copied by hand can lose the part that identifies the request.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-cem-text">Approve public sharing</h1>
      <p className="mt-1 text-sm text-cem-secondary">
        Your child has asked to share their contributions publicly in the CEMURM library.
        This page is the only step that grants that approval.
      </p>

      {phase === 'approved' && (
        <div
          role="status"
          className="mt-4 rounded-md bg-cem-emerald/10 px-3 py-2 text-sm text-cem-emerald"
        >
          <p className="font-medium">Public sharing is approved.</p>
          <p className="mt-1 text-cem-secondary">
            Your child can now publish contributions publicly. You can close this page. You
            do not need to sign in, and the link cannot be used again.
          </p>
        </div>
      )}

      {phase === 'failed' && (
        <div role="alert" className="mt-4 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">
          <p className="font-medium">{failure}</p>
          <p className="mt-1 text-cem-secondary">
            Public sharing approval is recorded once and cannot be approved a second time.
            If you did not open this page yourself, or you have already approved, there is
            nothing further to do here.
          </p>
        </div>
      )}

      {/* The decision is spelled out before the button, and the button is gone
          afterwards: there is deliberately no retry, because a retried
          one-shot token reports the same refusal as a used one and would only
          contradict an approval that had in fact been recorded. */}
      {phase !== 'approved' && phase !== 'failed' && (
        <>
          <div className="mt-4 rounded-md bg-cem-elevated px-3 py-2 text-sm text-cem-text">
            {APPROVE_SUMMARY}
          </div>

          <button
            type="button"
            onClick={handleApprove}
            disabled={phase === 'submitting'}
            className="mt-6 w-full rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
          >
            {phase === 'submitting' ? 'Recording your approval…' : 'I approve public sharing'}
          </button>

          <p className="mt-4 text-center text-xs text-cem-secondary">
            Only press this if you recognise the request. This approval can be withdrawn at
            any time using the revoke link in the same email.
          </p>
        </>
      )}
    </div>
  )
}