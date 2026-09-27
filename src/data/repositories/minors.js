// @ts-check
// Supabase data layer for minor accounts + guardian consent (Hito 4).
// The backend (migration 0017) owns every rule: consent writes go through the
// RPCs only, and the app learns minor-ness ONLY from user_metadata.isMinor
// (set at signup) — profiles.date_of_birth / is_minor are never client-readable.
// Public surface: getConsentStatus, recordConsent, approvePublicSharing.
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
 * @property {'active' | 'revoked' | 'archived'} status
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
 * @property {'active' | 'revoked' | 'archived'} status
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
 * recordConsent RPC arguments — the guardian identity + the exact text they
 * saw, stored verbatim (scenario 3).
 * @typedef {object} RecordConsentInput
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
 * Record guardian consent on the caller's own account (RPC only). The exact
 * consent text the guardian saw is stored verbatim (scenario 3). Returns the
 * new consent row id.
 * @param {RecordConsentInput} input
 * @returns {Promise<string>}
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
 * @param {string} userId
 * @returns {Promise<void>}
 */
export function approvePublicSharing(userId) {
  return withErrorMapping(async () => {
    const { error } = await supabase.rpc('approve_guardian_public_sharing', {
      p_user_id: userId,
    })
    if (error) throw error
  })
}