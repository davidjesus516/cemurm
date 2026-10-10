// @ts-check
// Supabase data layer for minor accounts + guardian consent (Hito 4).
// The backend owns every rule: consent writes go through the RPCs only, and
// profiles.date_of_birth / is_minor are never client-readable (0017 shipped no
// select grant for either column, 0030 did not add one).
// Since 0030 the app asks the server for its own age status — getAgeStatus
// returns the only two facts the UI needs (dob_known, is_minor) and the
// database decides. user_metadata.isMinor survives as a signup-time UX hint
// only; it is user-editable through GoTrue updateUser(), so nothing gates on it.
// Since 0031 consent is a two-step handshake and BOTH steps are client-driven:
// requestGuardianConsent opens a 'pending' row (it does NOT unlock anything),
// and sendGuardianConsentEmail asks the send-guardian-consent edge function to
// mail the guardian the one-shot link. Neither step may be skipped: a request
// with no email reaches no guardian, so the minor stays locked forever.
// confirmGuardianConsent is the third, GUARDIAN-driven step: it is the only way
// the row ever leaves 'pending', and it is called with no session at all.
// Public surface: getAgeStatus, setDateOfBirth, getConsentStatus,
// requestGuardianConsent, sendGuardianConsentEmail, confirmGuardianConsent,
// approvePublicSharing.
// Scenario coverage: features/minors-and-guardian-consent.feature
// (signup age gate, account activation, consent record, public-sharing gate).

import { supabase } from '../supabase.js'

/**
 * Raw guardian_consents row as the `select('*')` returns it (migration 0017):
 * identity + consent text columns are not-null; the three lifecycle
 * timestamps and the public-sharing approval are nullable.
 * @typedef {object} RawConsentRow
 * @property {string} id
 * @property {string} user_id
 * @property {string} guardian_name
 * @property {string} guardian_email
 * @property {string} consent_text
 * @property {string} consent_version
 * @property {'pending' | 'active' | 'revoked' | 'archived'} status
 * @property {boolean} public_sharing_approved
 * @property {string | null} public_sharing_approved_at
 * @property {string} revocation_token
 * @property {string} consented_at
 * @property {string | null} revoked_at
 * @property {string | null} archived_at
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * Flattened consent shape (normalizeProfile — flattenSetlist precedent):
 * snake_case columns promoted to camelCase.
 * @typedef {object} Consent
 * @property {string} id
 * @property {string} userId
 * @property {'pending' | 'active' | 'revoked' | 'archived'} status
 * @property {boolean} publicSharingApproved
 * @property {string | null} publicSharingApprovedAt
 * @property {string} guardianName
 * @property {string} guardianEmail
 * @property {string} consentText
 * @property {string} consentedAt
 * @property {string | null} revokedAt
 * @property {string | null} archivedAt
 */

/**
 * requestGuardianConsent RPC arguments — the guardian identity + the exact text
 * they will see, stored verbatim (scenario 3). Same shape the deprecated
 * recordConsent took; the name tracks the 0031 RPC it now calls.
 * @typedef {object} RequestGuardianConsentInput
 * @property {string} userId
 * @property {string} guardianName
 * @property {string} guardianEmail
 * @property {string} consentText
 */

// ponytail: known user-facing errors re-thrown as-is; network/PostgREST
// errors map to a safe generic message (songs.js/publicLibrary.js pattern).
const USER_ERRORS = new Set([
  'Guardian consent required.',
  'You can only consent for your own account.',
  'Consent is only required for minors.',
  'Consent already active for this account.',
  'Consent not found or not active.',
  // 0031 confirm_guardian_consent_by_token — ONE string for FIVE causes (wrong
  // token, unknown account, already-confirmed, revoked, no longer a minor). It
  // must survive handleError untouched: collapsing it into the generic message
  // would still be safe, but re-throwing it is what lets the page show the
  // server's own non-enumerating wording instead of a second guess at it.
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

/**
 * @param {Error} error
 * @returns {never}
 */
function handleError(error) {
  if (USER_ERRORS.has(error?.message)) throw error
  throw new Error('Something went wrong. Please try again.')
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withErrorMapping(fn) {
  try { return await fn() } catch (e) { handleError(/** @type {Error} */ (e)) }
}

// snake_case → camelCase, matching the app's flatten conventions (songs.js).
/**
 * @param {RawConsentRow | null | undefined} row
 * @returns {Consent | null}
 */
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
 * none exists. The row's status tells the caller whether consent is 'active'
 * (vs older revoked/archived records). RLS self-select only.
 * @param {string} userId
 * @returns {Promise<Consent | null>}
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
 * OPEN a consent request on the caller's own account (RPC only).
 *
 * This does not grant consent. Since 0031 the row is created 'pending' and the
 * account stays locked until the GUARDIAN clicks the emailed link — the server
 * owns that transition, so `record` would have been a lie. It therefore calls
 * `request_guardian_consent`, not 0031's deprecated `record_guardian_consent`
 * alias, which is kept only so pre-0031 bundles keep working.
 *
 * The exact consent text the guardian will see is stored verbatim (scenario 3).
 * Returns the new pending row id. Follow it with sendGuardianConsentEmail().
 * @param {RequestGuardianConsentInput} input
 * @returns {Promise<string>}
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
 * Ask the send-guardian-consent edge function to mail the guardian the
 * one-shot confirm/revoke link for the caller's open request.
 *
 * The function reads the pending row itself and derives both links from
 * SITE_URL + the row's 128-bit revocation_token, so the only thing the browser
 * sends is the session bearer. verify_jwt is on, so the function authenticates
 * as the minor and re-checks that the row is theirs.
 *
 * NEVER throws for a delivery failure: a mail that did not go out is a normal
 * outcome the UI has to be able to state honestly, not an exception. Returns
 * one of:
 *   'sent'            — Resend accepted the message
 *   'already_active'  — consent was confirmed while this page was open
 *   'no_open_request' — no pending row to send for (stale page)
 *   'unavailable'     — the call could not complete (offline, 5xx, bad config)
 * @returns {Promise<'sent' | 'already_active' | 'no_open_request' | 'unavailable'>}
 */
export async function sendGuardianConsentEmail() {
  let result
  try {
    result = await supabase.functions.invoke('send-guardian-consent', { body: {} })
  } catch {
    return 'unavailable'
  }
  if (result.error) return 'unavailable'
  const status = result.data?.status
  return status === 'sent' || status === 'already_active' || status === 'no_open_request'
    ? status
    : 'unavailable'
}

/**
 * THE GUARDIAN'S HALF of the 0031 handshake (RPC
 * public.confirm_guardian_consent_by_token, `anon`-granted, `security
 * definer`). Called from /guardian/confirm with NO session: the emailed
 * `?user=…&token=…` pair IS the authority, and the RPC flips exactly one
 * 'pending' row to 'active'. There is no other write path to that column, so
 * this call is the whole of what a token can do.
 *
 * ⚠ ONE MESSAGE FOR EVERY FAILURE. The server raises the single string
 * 'Consent not found or already finalized.' for a wrong token, an unknown
 * account, an already-confirmed consent, a revoked one and a no-longer-minor
 * account alike (0031:252-261), so the endpoint cannot be used to learn
 * whether a token, an account or a consent exists. That string is in
 * USER_ERRORS and therefore re-thrown verbatim; callers must render it as
 * written and must NOT add a branch that guesses a more specific cause.
 *
 * The token is a one-shot secret. It is passed to the RPC and nowhere else —
 * never logged, never interpolated into an error, never returned.
 *
 * Void on success. The minor's next ledger read (getConsentStatus, which
 * RequireGuardianConsent re-runs on every mount) is what unlocks the app —
 * there is nothing to refresh on this side.
 * @param {{ userId: string, token: string }} input
 * @returns {Promise<void>}
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
 * THE GUARDIAN'S HALF of the 0034 handshake (RPC
 * public.approve_guardian_public_sharing_by_token, `anon`-granted, `security
 * definer`). Called from /guardian/approve with NO session: the emailed
 * `?user=…&token=…&email=…` triple IS the authority, and the RPC flips exactly
 * one 'active' consent's public_sharing_approved to true. There is no other
 * write path to that column, so this call is the whole of what a token can do.
 *
 * ⚠ ONE MESSAGE FOR EVERY FAILURE. The server raises the single string
 * 'Consent not found or already finalized.' for a wrong token, an unknown
 * account, a wrong email, an already-approved consent, a revoked one and a
 * no-longer-active consent alike (0034:32-40), so the endpoint cannot be used
 * to learn whether a token, an account, an email or a consent exists. That
 * string is in USER_ERRORS and therefore re-thrown verbatim; callers must
 * render it as written and must NOT add a branch that guesses a more specific
 * cause.
 *
 * The token+email pair is a one-shot secret. It is passed to the RPC and
 * nowhere else — never logged, never interpolated into an error, never
 * returned.
 *
 * Void on success. The minor's next ledger read (getConsentStatus, which
 * RequireGuardianConsent re-runs on every mount) is what unlocks public
 * sharing — there is nothing to refresh on this side.
 * @param {{ userId: string, token: string, email: string }} input
 * @returns {Promise<void>}
 */
export function approveGuardianPublicSharingByToken({ userId, token, email }) {
  return withErrorMapping(async () => {
    const { error } = await supabase.rpc('approve_guardian_public_sharing_by_token', {
      p_user_id: userId,
      p_revocation_token: token,
      p_guardian_email: email,
    })
    if (error) throw error
  })
}

/**
 * Mark public sharing as guardian-approved on the caller's ACTIVE consent
 * (RPC only, scenario 4). DEPRECATED: this is the minor self-approval path that
 * 0017 shipped and 0034 supersedes. It will raise "Consent is only required for
 * minors" when called by a minor, because the minor is not a guardian and
 * cannot provide the guardian_email witness. Kept only for the transition
 * window so pre-0034 bundles don't fail on a dropped function. New code should
 * use the guardian-driven approveGuardianPublicSharingByToken instead.
 * @param {string} userId
 * @returns {Promise<void>}
 * @deprecated Use approveGuardianPublicSharingByToken (guardian-driven)
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
 * @returns {Promise<{ dobKnown: boolean, isMinor: boolean }>}
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
 * @param {string} date
 * @returns {Promise<void>}
 */
export function setDateOfBirth(date) {
  return withErrorMapping(async () => {
    const { error } = await supabase.rpc('set_date_of_birth', {
      p_date_of_birth: date,
    })
    if (error) throw error
  })
}