// Supabase data layer for minor accounts + guardian consent (Hito 4, revised by
// 0031). The backend owns every rule: consent writes go through the RPCs only,
// and profiles.date_of_birth / is_minor are never client-readable (0017 shipped
// no select grant for either column, 0030 did not add one).
// Since 0030 the app asks the server for its own age status — getAgeStatus
// returns the only two facts the UI needs (dob_known, is_minor) and the
// database decides. user_metadata.isMinor survives as a signup-time UX hint
// only; it is user-editable through GoTrue updateUser(), so nothing gates on it.
//
// SINCE 0031 a consent request is a REQUEST, not a consent: requestGuardianConsent
// opens a 'pending' row and the account stays LOCKED until the guardian follows
// the emailed link. The client therefore has three halves of the flow and no way
// to skip any of them:
//   · the minor   — requestGuardianConsent + sendGuardianConsentEmail,
//   · the guardian — confirmGuardianConsent / revokeGuardianConsent, both
//     login-less and capability-based (the 128-bit token IS the authorization),
//   · nobody      — there is no client call that turns a pending row into an
//     active one. The only path runs through 0031's anon-granted confirm RPC.
// Public surface: getAgeStatus, setDateOfBirth, getConsentStatus,
// requestGuardianConsent, sendGuardianConsentEmail, confirmGuardianConsent,
// revokeGuardianConsent, approvePublicSharing.
// Scenario coverage: features/minors-and-guardian-consent.feature
// (signup age gate, account activation, consent record, public-sharing gate).

import { supabase } from './supabase.js'

// ponytail: known user-facing errors re-thrown as-is; network/PostgREST
// errors map to a safe generic message (songs.js/publicLibrary.js pattern).
const USER_ERRORS = new Set([
  'Guardian consent required.',
  'You can only consent for your own account.',
  'Consent is only required for minors.',
  'Consent already active for this account.',
  'Consent not found or not active.',
  // 0031 request_guardian_consent
  'A guardian consent request is already open for this account.',
  'Guardian name is required.',
  'Enter a valid guardian email address.',
  'Consent text is required.',
  // 0031 confirm_guardian_consent_by_token / 0017 revoke_guardian_consent.
  // ONE string for every failure, by design: the client cannot tell a spent
  // link from a wrong one, so it must not pretend to. It is whitelisted here
  // precisely so /guardian/* can say "this link no longer works" instead of
  // collapsing the answer into a generic failure.
  'Consent not found or already finalized.',
  // 0030 set_date_of_birth / my_age_status
  'Sign in to set your date of birth.',
  'Sign in to check your age status.',
  'Enter your date of birth.',
  'Date of birth cannot be in the future.',
  'Date of birth must be after 1900.',
  'A minor account cannot declare an adult date of birth.',
  'Profile not found.',
])

// The Edge Function's typed error slugs (supabase/functions/send-guardian-consent).
// Each one is a real, named state rather than an exception, so the lock screen
// can say something TRUE: "this deployment has no mail sender" is actionable,
// "something went wrong" is not. A slug missing from this set means the function
// grew a failure mode the UI has not been taught about — which is why the
// fallback below stays deliberately boring.
const FUNCTION_ERRORS = new Set([
  'email_not_configured',
  'app_url_not_configured',
  'function_not_configured',
  'email_provider_failed',
  'no_open_request',
  'unauthenticated',
  'method_not_allowed',
])

// What the minor is told, per slug. The function never leaks the key, the
// provider's response body or any account detail, so these strings are the whole
// contract — none of them can be used to tell a wrong link from a spent one.
const FUNCTION_ERROR_COPY = {
  email_not_configured: 'Email delivery is not configured on this server yet. Ask an administrator to finish setting it up.',
  app_url_not_configured: 'Email delivery is not configured on this server yet. Ask an administrator to finish setting it up.',
  function_not_configured: 'Email delivery is not configured on this server yet. Ask an administrator to finish setting it up.',
  email_provider_failed: 'The message could not be handed to the mail service, so nothing was sent. Try again in a moment.',
}

function handleError(error) {
  if (USER_ERRORS.has(error?.message)) throw error
  throw new Error('Something went wrong. Please try again.')
}

async function withErrorMapping(fn) {
  try { return await fn() } catch (e) { handleError(e) }
}

// snake_case → camelCase, matching the app's flatten conventions (songs.js).
function flattenConsent(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    publicSharingApproved: row.public_sharing_approved,
    publicSharingApprovedAt: row.public_sharing_approved_at,
    guardianName: row.guardian_name,
    guardianEmail: row.guardian_email,
    consentText: row.consent_text,
    consentedAt: row.consented_at,
    revokedAt: row.revoked_at,
    archivedAt: row.archived_at,
  }
}

/**
 * Latest consent row for the user (created_at desc, limit 1) or null when
 * none exists. The row's status tells the caller whether the request is still
 * 'pending' (waiting on a guardian), 'active' (approved), or a finalized
 * 'revoked'/'archived' record. RLS self-select only.
 */
export function getConsentStatus(userId) {
  return withErrorMapping(async () => {
    const { data, error } = await supabase
      .from('guardian_consents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return flattenConsent(data)
  })
}

/**
 * OPEN a guardian consent request on the caller's own account (RPC only, 0031).
 * The exact consent text the guardian will see is stored verbatim (scenario 3),
 * because the emailed body is rendered FROM this row — what the record holds is
 * what the guardian reads, by construction.
 *
 * This no longer unlocks anything. It creates a 'pending' row and returns its
 * id; the account stays locked until the guardian follows the emailed link
 * (WU4, D4). The old name, recordConsent, is gone on purpose — it promised an
 * outcome the function cannot produce, and 0031's SQL alias exists only so the
 * 0029 regression smoke can still call the pre-0031 signature.
 *
 * Returns the new pending row id. Re-read the ledger afterwards to see it.
 */
export function requestGuardianConsent({ userId, guardianName, guardianEmail, consentText }) {
  return withErrorMapping(async () => {
    const { data, error } = await supabase.rpc('request_guardian_consent', {
      p_user_id: userId,
      p_guardian_name: guardianName,
      p_guardian_email: guardianEmail,
      p_consent_text: consentText,
    })
    if (error) throw error
    return data
  })
}

/**
 * Ask the server to email the guardian their confirm/revoke links
 * (supabase/functions/send-guardian-consent, T4.3). The function needs the
 * caller's JWT (config.toml sets verify_jwt = true) and derives the account from
 * it, so there is nothing to pass here and nothing a caller could tamper with.
 *
 * It is a COURIER: the pending row already exists and the function never creates
 * one, so a retry cannot turn one request into two approval emails. The Resend
 * key lives in Vault and is never in the client bundle.
 *
 * Resolves to one of:
 *   'sent'            — Resend accepted the message. The ONLY success, and the
 *                       only value that means an email really left the building.
 *   'already_active'  — the account is already unlocked, so there is nothing to
 *                       ask the guardian for.
 *   'no_open_request' — the request was already finalized (revoked/archived).
 *
 * Rejects with a FUNCTION_ERROR_COPY message on a typed failure. The asymmetry
 * is the whole point: nothing but 'sent' may ever be rendered as a success.
 */
export function sendGuardianConsentEmail() {
  return withErrorMapping(async () => {
    let payload = null
    try {
      const { data, error } = await supabase.functions.invoke('send-guardian-consent', {
        method: 'POST',
        body: {},
      })
      if (error) throw error
      payload = data
    } catch (error) {
      // supabase-js raises FunctionsHttpError for a non-2xx and hangs the raw
      // Response off `.context`; the typed slug is that response's JSON. The
      // provider's own body is deliberately NOT surfaced (it can echo request
      // headers) and neither is the raw message.
      const slug = await readFunctionErrorSlug(error)
      if (slug && FUNCTION_ERRORS.has(slug)) {
        throw new Error(FUNCTION_ERROR_COPY[slug] || FUNCTION_ERROR_COPY.email_provider_failed)
      }
      handleError(error)
    }
    return payload?.status ?? null
  })
}

/**
 * Pull the function's typed `{ error: slug }` out of a FunctionsHttpError.
 * Returns null when the failure was not an HTTP error from our handler (a
 * network drop, a relay problem), which the caller treats as unknown — and an
 * unknown failure must never be reported as a send.
 */
async function readFunctionErrorSlug(error) {
  const response = error?.context
  if (!response || typeof response.json !== 'function') return null
  try {
    const body = await response.json()
    return typeof body?.error === 'string' ? body.error : null
  } catch {
    return null
  }
}

/**
 * THE GUARDIAN'S HALF, part 1 — approve (scenario 5). Login-less: the caller is
 * whoever holds the emailed link, and the 128-bit revocation_token IS the
 * authorization. No account, no password — which is the point: a parent who has
 * never heard of CEMURM can still unblock their child.
 *
 * One-shot. A second call with the same token fails. Every failure — a wrong
 * token, an unknown account, an already-confirmed consent, an account that has
 * since turned 18 — raises the same server string, and this function does not
 * pretend otherwise (see USER_ERRORS): the caller must not try to tell them
 * apart, because the server will not let it.
 */
export function confirmGuardianConsent({ userId, token }) {
  return withErrorMapping(async () => {
    const { error } = await supabase.rpc('confirm_guardian_consent_by_token', {
      p_user_id: userId,
      p_revocation_token: token,
    })
    if (error) throw error
  })
}

/**
 * THE GUARDIAN'S HALF, part 2 — withdraw (scenario 9). Reuses the login-less
 * capability 0017 lines 361-417 already shipped; WU4 added no second revocation
 * path. The guardian's email travels with the link as the WITNESS to the token
 * (0017's own design: the token is the secret, the email is the witness), which
 * is why the caller passes guardianEmail rather than the function looking it up
 * — an anonymous guardian has no RLS access to the ledger to read it from.
 *
 * Revoking never deletes the row. The account re-locks immediately and the
 * record stays as evidence.
 */
export function revokeGuardianConsent({ userId, guardianEmail, token }) {
  return withErrorMapping(async () => {
    const { error } = await supabase.rpc('revoke_guardian_consent', {
      p_user_id: userId,
      p_guardian_email: guardianEmail,
      p_revocation_token: token,
    })
    if (error) throw error
  })
}

/**
 * Mark public sharing as guardian-approved on the caller's ACTIVE consent
 * (RPC only, scenario 4). Void on success — publishing becomes allowed.
 */
export function approvePublicSharing(userId) {
  return withErrorMapping(async () => {
    const { error } = await supabase.rpc('approve_guardian_public_sharing', {
      p_user_id: userId,
    })
    if (error) throw error
  })
}

/**
 * The caller's own age status (RPC public.my_age_status, 0030). Returns
 * { dobKnown, isMinor } — two booleans and never the date itself, because the
 * birth date is not client-readable by design (0017 lines 37-38, 68-70).
 *
 * Fail-closed reading, which is the whole point: dobKnown false means UNKNOWN,
 * never "adult". A missing profile row comes back as { false, false } too, so an
 * account that has not finished onboarding is never mistaken for a grown-up.
 * Callers must treat a rejected read as dobKnown: false — see
 * RequireGuardianConsent in src/components/auth/AuthGuards.jsx.
 */
export function getAgeStatus() {
  return withErrorMapping(async () => {
    const { data, error } = await supabase.rpc('my_age_status')
    if (error) throw error
    // PostgREST returns a single-row function as a one-element array.
    const row = Array.isArray(data) ? data[0] : data
    return {
      dobKnown: Boolean(row?.dob_known),
      isMinor: Boolean(row?.is_minor),
    }
  })
}

/**
 * Declare (or correct) the caller's date of birth — the ONLY write path
 * (RPC public.set_date_of_birth, 0030). The direct column grant 0017 shipped
 * is revoked, so a bypass is not possible even by hand: the RPC validates the
 * value, refuses a minor re-declaring themselves as an adult, and lets the
 * profiles_minor_flag trigger recompute is_minor from whatever date lands.
 *
 * `date` is an ISO 'YYYY-MM-DD' string (what <input type="date"> gives us).
 * Void on success — re-read getAgeStatus() to see the resulting state.
 */
export function setDateOfBirth(date) {
  return withErrorMapping(async () => {
    const { error } = await supabase.rpc('set_date_of_birth', {
      p_date_of_birth: date,
    })
    if (error) throw error
  })
}