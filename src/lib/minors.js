// Supabase data layer for minor accounts + guardian consent (Hito 4).
// The backend owns every rule: consent writes go through the RPCs only, and
// profiles.date_of_birth / is_minor are never client-readable (0017 shipped no
// select grant for either column, 0030 did not add one).
// Since 0030 the app asks the server for its own age status — getAgeStatus
// returns the only two facts the UI needs (dob_known, is_minor) and the
// database decides. user_metadata.isMinor survives as a signup-time UX hint
// only; it is user-editable through GoTrue updateUser(), so nothing gates on it.
// Public surface: getAgeStatus, setDateOfBirth, getConsentStatus, recordConsent,
// approvePublicSharing.
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
  // 0030 set_date_of_birth / my_age_status
  'Sign in to set your date of birth.',
  'Sign in to check your age status.',
  'Enter your date of birth.',
  'Date of birth cannot be in the future.',
  'Date of birth must be after 1900.',
  'A minor account cannot declare an adult date of birth.',
  'Profile not found.',
])

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
 * none exists. The row's status tells the caller whether consent is 'active'
 * (vs older revoked/archived records). RLS self-select only.
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
 * Record guardian consent on the caller's own account (RPC only). The exact
 * consent text the guardian saw is stored verbatim (scenario 3). Returns the
 * new consent row id.
 */
export function recordConsent({ userId, guardianName, guardianEmail, consentText }) {
  return withErrorMapping(async () => {
    const { data, error } = await supabase.rpc('record_guardian_consent', {
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