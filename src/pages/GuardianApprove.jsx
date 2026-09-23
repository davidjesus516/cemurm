// Public, login-less guardian approval page (Hito 4 — minors/consent, H10).
// The guardian opens the shareable link from the minor's song page
// (/guardian-approve?user=…&email=…&token=…) WITHOUT a session — the route
// sits outside RequireAuth, mirroring the login-less revocation capability
// (0017 §6.3). The anon-granted `approve_guardian_sharing(user_id,
// guardian_email, sharing_approval_token)` RPC (0020 §5) treats that tuple as
// the capability witness and flips exactly one flag on one ACTIVE consent
// row; the server deliberately collapses wrong token / wrong guardian /
// non-active row into ONE error (no oracle), so invalid and expired links
// render the same honest message here.

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { approveGuardianSharing } from '../lib/minors.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Exact server string (minors.js USER_ERRORS passes it through verbatim).
const INVALID_LINK_ERROR = 'Consent not found or already finalized.'

function StatePanel({ tone, children }) {
  const tones = {
    pending: 'text-cem-secondary',
    success: 'text-cem-emerald',
    error: 'text-cem-rose',
  }
  return (
    <p className={`mt-4 rounded-md bg-cem-elevated px-3 py-2 text-sm ${tones[tone] || tones.pending}`}>
      {children}
    </p>
  )
}

export default function GuardianApprove() {
  const [searchParams] = useSearchParams()
  // 'approving' → 'success' | 'invalid' | 'missing' | 'error'
  const [status, setStatus] = useState('approving')
  const [errorMessage, setErrorMessage] = useState('')
  const started = useRef(false)

  const userId = searchParams.get('user') || ''
  const guardianEmail = searchParams.get('email') || ''
  const token = searchParams.get('token') || ''

  useEffect(() => {
    // Single-shot: strict-mode double-invocation and param re-reads must not
    // fire the capability RPC twice (the second call would report the row
    // "already finalized" and mask a first-call success).
    if (started.current) return undefined
    started.current = true

    // Missing or garbage params never reach the RPC: a non-UUID token would
    // only produce a PostgREST cast error, so validate and render the honest
    // invalid state directly.
    if (!userId || !guardianEmail || !token) {
      setStatus('missing')
      return undefined
    }
    if (!UUID_RE.test(userId) || !UUID_RE.test(token)) {
      setStatus('invalid')
      return undefined
    }

    approveGuardianSharing({ userId, guardianEmail, token })
      .then(() => setStatus('success'))
      .catch((err) => {
        if (err?.message === INVALID_LINK_ERROR) {
          setStatus('invalid')
        } else {
          setErrorMessage(err?.message || 'Something went wrong. Please try again.')
          setStatus('error')
        }
      })
    return undefined
  }, [userId, guardianEmail, token])

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-cem-text">Guardian approval</h1>

      {status === 'approving' && (
        <StatePanel tone="pending">Recording your approval…</StatePanel>
      )}

      {status === 'success' && (
        <StatePanel tone="success">
          Public sharing has been approved. The minor&apos;s account can now
          contribute their songs to the public library.
        </StatePanel>
      )}

      {status === 'invalid' && (
        <StatePanel tone="error">
          This approval link is invalid, expired, or has already been used.
          Ask the minor&apos;s account to generate a new link from their song
          page and open that one instead.
        </StatePanel>
      )}

      {status === 'missing' && (
        <StatePanel tone="error">
          This approval link is incomplete — it is missing the user, email, or
          token parameter. Open the full link shared with the guardian.
        </StatePanel>
      )}

      {status === 'error' && (
        <StatePanel tone="error">
          {errorMessage || 'Something went wrong. Please try again.'}
        </StatePanel>
      )}
    </div>
  )
}
