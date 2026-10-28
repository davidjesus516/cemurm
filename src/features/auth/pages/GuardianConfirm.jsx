// Hito 4 — the GUARDIAN'S half of the consent handshake
// (features/minors-and-guardian-consent.feature scenario 2).
//
// Migration 0031 mails the guardian a one-shot link
//   `${siteUrl}/guardian/confirm?user=…&token=…`
// (supabase/functions/send-guardian-consent/index.ts:219) and grants
// public.confirm_guardian_consent_by_token to `anon`, so the transition from
// 'pending' to 'active' is the GUARDIAN's to make with no account and no
// session. Before this page existed the email was a dead end: the minor could
// open a request and the row could never leave 'pending'.
//
// Three obligations are load-bearing here, not decoration:
//
//   1. STRIP THE CAPABILITY. The token is read once into component state and
//      then removed from the address bar, so it survives neither a bookmark nor
//      a Referer header. The edge function's comment (:216-218) states this
//      obligation; this file is the other half of it.
//   2. ONE MESSAGE FOR EVERY FAILURE. The server raises a single string for a
//      wrong token, an unknown account, an already-confirmed consent, a revoked
//      one and a no-longer-minor account alike (0031:252-261). This page must
//      not turn that back into distinguishable states, or the URL becomes an
//      oracle for "does this account exist" / "was this consent already used".
//   3. NO AUTO-SUBMIT. This flips a supervision record for a child on the
//      strength of a link in an inbox. It is a deliberate click or it is
//      nothing — a page that confirmed on render would let anything that can
//      prefetch a URL (a mail client, a chat client, a security scanner) spend a
//      child's consent without a human ever seeing the words.
//
// ONE THING THIS PAGE DELIBERATELY DOES NOT SAY: the email also carries a
// revoke link, and that link does not work. private.revoke_guardian_consent
// (0017:361) needs p_guardian_email as part of its witness, and the emailed URL
// carries only `user` and `token`. So the copy below says consent "can be
// withdrawn at any time" and stops there, instead of pointing a parent at a
// dead link. The fix is one line in the edge function that builds the link, not
// a change to 0017 — see odd/tasks/guardian-consent-app-flow.md, "The revoke
// defect".

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { confirmGuardianConsent } from '../../../data/repositories/minors.js'

// Where the link strips itself to. Kept as a constant because the raw
// `window.history.replaceState` would leave react-router's own location object
// still holding the query string, and the next relative navigation would then
// put the token back in the address bar.
const CONFIRM_PATH = '/guardian/confirm'

// Plain-language restatement of what the guardian is agreeing to. NOT a quote:
// the exact consent_text lives in the ledger, the email rendered it, and this
// page cannot re-read it — guardian_consents has no anon select grant and the
// RPC returns void, so there is nothing here to quote from. The email is the
// record of the wording that was actually shown; this screen only says what
// kind of decision the button below is.
const CONSENT_SUMMARY =
  'Your child may take part in CEMURM activities under the academy’s supervision. It does not ' +
  'publish anything publicly — sharing contributions publicly needs a separate approval, and this ' +
  'page does not give it.'

// ready       → the explainer and the confirm button
// submitting  → the RPC is in flight
// confirmed   → the row is 'active'
// failed      → the RPC refused or the call never completed
export default function GuardianConfirm() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Snapshot of the emailed capability, taken ONCE on mount and then owned by
  // this component. Reading it from the hook on every render would be wrong:
  // the hook reflects the address bar, and the whole point is to empty the
  // address bar. A snapshot is what survives obligation 1.
  const [link] = useState(() => ({
    userId: searchParams.get('user') ?? '',
    token: searchParams.get('token') ?? '',
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
    if (window.location.search) navigate(CONFIRM_PATH, { replace: true })
  }, [navigate])

  // A link missing either half cannot be completed, and guessing the other
  // half is not an option. Decided from the URL alone, so it reveals nothing
  // about the server: no call is made.
  const linkIncomplete = !link.userId || !link.token

  async function handleConfirm() {
    if (linkIncomplete || phase === 'submitting') return
    setPhase('submitting')
    setFailure('')
    try {
      await confirmGuardianConsent({ userId: link.userId, token: link.token })
      setPhase('confirmed')
    } catch (error) {
      // ⚠ Obligation 2. The repository re-throws the server's own single
      // string verbatim ('Consent not found or already finalized.') and maps
      // every transport-level fault to the one generic sentence. Both are
      // independent of whether the account or the token exists, so rendering
      // error.message cannot tell a caller more than the server already did.
      // The page must NOT branch on the text, and must not add a second,
      // more specific message: a wrong link and an already-used link are the
      // same outcome here, and saying otherwise would hand out exactly the
      // signal 0031 refuses to emit.
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
      <h1 className="text-2xl font-bold text-cem-text">Confirm your consent</h1>
      <p className="mt-1 text-sm text-cem-secondary">
        Your child has asked to use CEMURM and is waiting for you to confirm. This page is the
        only step that unlocks their account.
      </p>

      {phase === 'confirmed' && (
        <div
          role="status"
          className="mt-4 rounded-md bg-cem-emerald/10 px-3 py-2 text-sm text-cem-emerald"
        >
          <p className="font-medium">Your consent is recorded.</p>
          <p className="mt-1 text-cem-secondary">
            Your child&rsquo;s account unlocks the next time it loads. You can close this page. You
            do not need to sign in, and the link cannot be used again.
          </p>
        </div>
      )}

      {phase === 'failed' && (
        <div role="alert" className="mt-4 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">
          <p className="font-medium">{failure}</p>
          <p className="mt-1 text-cem-secondary">
            Consent is recorded once and cannot be confirmed a second time. If you did not open this
            page yourself, or you have already confirmed, there is nothing further to do here.
          </p>
        </div>
      )}

      {/* The decision is spelled out before the button, and the button is gone
          afterwards: there is deliberately no retry, because a retried
          one-shot token reports the same refusal as a used one and would only
          contradict a consent that had in fact been recorded. */}
      {phase !== 'confirmed' && phase !== 'failed' && (
        <>
          <div className="mt-4 rounded-md bg-cem-elevated px-3 py-2 text-sm text-cem-text">
            {CONSENT_SUMMARY}
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={phase === 'submitting'}
            className="mt-6 w-full rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
          >
            {phase === 'submitting' ? 'Recording your consent…' : 'I consent, confirm this'}
          </button>

          <p className="mt-4 text-center text-xs text-cem-secondary">
            Only press this if you recognise the request. Consent is recorded against your
            child&rsquo;s account and can be withdrawn at any time.
          </p>
        </>
      )}
    </div>
  )
}
