// Supabase data layer for minor accounts + guardian consent (Hito 4).
// The backend (migration 0017) owns every rule: consent writes go through the
// RPCs only, and the app learns minor-ness ONLY from user_metadata.isMinor
// (set at signup) — profiles.date_of_birth / is_minor are never client-readable.
// Public surface: getConsentStatus, recordConsent, approveGuardianSharing.
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
  'Consent not found or already finalized.',
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
    // Capability tuple for the guardian's login-less approval link (0020):
    // readable through the minor's self-select RLS (0017:115), used only to
    // BUILD the shareable /guardian-approve URL — never to approve here.
    sharingApprovalToken: row.sharing_approval_token,
  }
}

/**
 * Latest consent row for the user (created_at desc, limit 1) or null when
 * none exists. The row's status tells the caller whether consent is 'active'
 * (vs older revoked/archived records), publicSharingApproved carries the
 * guardian's approval state, and sharingApprovalToken backs the guardian
 * link. RLS self-select only.
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
 * Record the GUARDIAN's approval of public sharing via the login-less
 * capability path (anon-granted `approve_guardian_sharing` RPC, 0020 §5):
 * (user_id, guardian_email, sharing_approval_token) IS the witness, and the
 * RPC's entire reach is one flag flip on one ACTIVE consent row. Replaces the
 * dropped self-approval RPC — the minor can no longer approve themselves.
 * Called from the PUBLIC /guardian-approve page; no session required.
 * Void on success — publishing becomes allowed.
 */
export function approveGuardianSharing({ userId, guardianEmail, token }) {
  return withErrorMapping(async () => {
    const { error } = await supabase.rpc('approve_guardian_sharing', {
      p_user_id: userId,
      p_guardian_email: guardianEmail,
      p_sharing_approval_token: token,
    })
    if (error) throw error
  })
}