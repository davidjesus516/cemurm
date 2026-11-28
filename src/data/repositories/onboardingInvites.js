// @ts-check
// Onboarding data layer (S2): org invite codes, the redemption RPC, and the
// onboarding flags / instrument that live in the existing preferences kv and
// profiles.instrument column. No new tables or columns: the code is the
// authorization, the 0050 SECURITY DEFINER RPC is the only membership writer,
// and `preferences.onboarding` is the progress store (preferences.js pattern).
//
// Lazy supabase import so the pure helpers below stay runnable in bare node
// (supabase.js reads import.meta.env at eval time — preferences.js precedent).

import {
  INVITE_ERROR,
  normalizeInviteCode,
  inviteExpiryISO,
} from '../../domain/onboarding/invite.js'

/** @type {typeof import('../supabase.js').supabase | null} */
let supabaseClient = null
/** @returns {Promise<import('@supabase/supabase-js').SupabaseClient>} */
async function supabase() {
  if (!supabaseClient) supabaseClient = (await import('../supabase.js')).supabase
  return supabaseClient
}

export { INVITE_ERROR }

/** @param {unknown} code @returns {string} */
export function prepareCode(code) {
  return normalizeInviteCode(code)
}

/**
 * Merge a progress patch into the prefs jsonb `onboarding` slice without
 * touching transpose/override/practice slices. Pure for testing.
 * @param {Record<string, any> | null | undefined} prefs
 * @param {Record<string, unknown>} patch
 * @returns {Record<string, any>}
 */
export function mergePrefsJsonb(prefs, patch) {
  const base = prefs && typeof prefs === 'object' ? prefs : {}
  const onboarding = base.onboarding && typeof base.onboarding === 'object' ? base.onboarding : {}
  return { ...base, onboarding: { ...onboarding, ...patch } }
}

/**
 * Any RPC error (or none) maps to the same generic message. The argument is
 * intentionally ignored: distinguishing errors would make this a code oracle.
 * @param {unknown} error
 * @returns {string}
 */
export function mapRedeemError(error) {
  // Never surface the RPC message: missing / expired / used codes would be
  // distinguishable, turning the function into a code oracle.
  void error
  return INVITE_ERROR
}

/**
 * @typedef {object} RedeemedOrg
 * @property {string} orgId
 * @property {string} orgName
 * @property {string} role
 * @property {string | null} branchId
 * @property {string | null} branchName
 */

/**
 * Redeem a typed invite code. The RPC atomically joins the org and consumes
 * the code; any failure maps to one generic message.
 * @param {string} code
 * @returns {Promise<RedeemedOrg>}
 */
export async function redeemInvite(code) {
  const { data, error } = await (await supabase())
    .rpc('redeem_org_invite', { p_code: prepareCode(code) })
  if (error || !data) throw new Error(mapRedeemError(error))
  const row = /** @type {Record<string, any>} */ (data)
  return {
    orgId: row.org_id,
    orgName: row.org_name,
    role: row.role,
    branchId: row.branch_id ?? null,
    branchName: row.branch_name ?? null,
  }
}

/**
 * Create an invite code as the current user. invite_codes is own-row RLS
 * (0006:145-181), so `created_by` must be the caller.
 * @param {{ orgId: string, code: string, role?: string, expiresInDays?: number }} input
 * @returns {Promise<void>}
 */
export async function createOrgInvite({ orgId, code, role = 'org_member', expiresInDays }) {
  const { data: session } = await (await supabase()).auth.getUser()
  const userId = session?.user?.id
  if (!userId) throw new Error('You must be signed in to create an invite code.')
  const { error } = await (await supabase())
    .from('invite_codes')
    .insert({
      org_id: orgId,
      code: prepareCode(code),
      kind: 'org_invite',
      role,
      created_by: userId,
      expires_at: inviteExpiryISO(expiresInDays),
    })
  if (error) throw error
}

/**
 * @typedef {object} CreatedOrg
 * @property {string} orgId
 * @property {string} orgName
 * @property {string} role
 * @property {string} branchId
 * @property {string} branchName
 */

/**
 * Create a new organization with its primary branch, making the caller owner.
 * The 0051 SECURITY DEFINER RPC is the only write path (authenticated has no
 * INSERT grant on organizations/branches). Every RPC error maps to one generic
 * message so the form never distinguishes backend reasons.
 * @param {{ name: string, type: string, branch: string, city: string }} input
 * @returns {Promise<CreatedOrg>}
 */
export async function createOrganization({ name, type, branch, city }) {
  const rpc = await supabase()
  const { data, error } = await rpc.rpc('create_organization', {
    p_name: name,
    p_org_type: type,
    p_branch_name: branch,
    p_city: city,
  })
  if (error || !data) throw new Error('Organization details are invalid.')
  const row = /** @type {Record<string, any>} */ (data)
  return {
    orgId: row.org_id,
    orgName: row.org_name,
    role: row.role,
    branchId: row.branch_id,
    branchName: row.branch_name,
  }
}

/**
 * Add a branch to an org the caller owns/administers (0051 RPC, guarded by
 * private.session_role_in). Any failure maps to one generic message.
 * @param {{ orgId: string, name: string, city: string }} input
 * @returns {Promise<{ orgId: string, branchId: string, branchName: string }>}
 */
export async function addOrgBranch({ orgId, name, city }) {
  const rpc = await supabase()
  const { data, error } = await rpc.rpc('add_org_branch', {
    p_org_id: orgId,
    p_name: name,
    p_city: city,
  })
  if (error || !data) throw new Error('Branch details are invalid.')
  const row = /** @type {Record<string, any>} */ (data)
  return { orgId: row.org_id, branchId: row.branch_id, branchName: row.branch_name }
}

/**
 * Invite codes created by the current user (RLS-scoped).
 * @param {string} orgId
 * @returns {Promise<Array<Record<string, any>>>}
 */
export async function listOrgInvites(orgId) {
  const { data, error } = await (await supabase())
    .from('invite_codes')
    .select('id, code, role, expires_at, used_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * Revoke a code. RLS filters to own rows, so confirm a row was actually
 * deleted instead of trusting PostgREST's 204 (audience-view B3 precedent).
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function revokeOrgInvite(id) {
  const { data, error } = await (await supabase())
    .from('invite_codes')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Invite code not found.')
}

/**
 * Read the onboarding flags from `preferences.onboarding` (defaults to {}).
 * @param {string} userId
 * @returns {Promise<Record<string, any>>}
 */
export async function getOnboardingState(userId) {
  const { data, error } = await (await supabase())
    .from('user_preferences')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  const onboarding = data?.preferences?.onboarding
  return onboarding && typeof onboarding === 'object' ? onboarding : {}
}

/**
 * Persist an onboarding flag patch with a read-merge-upsert on the kv row.
 * @param {string} userId
 * @param {Record<string, unknown>} patch
 * @returns {Promise<void>}
 */
export async function saveOnboardingState(userId, patch) {
  const { data: current, error: readError } = await (await supabase())
    .from('user_preferences')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle()
  if (readError) throw readError
  const merged = mergePrefsJsonb(current?.preferences, patch)
  const { error } = await (await supabase())
    .from('user_preferences')
    .upsert(
      { user_id: userId, preferences: merged, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (error) throw error
}

/**
 * Save the primary instrument (profiles.instrument, self-writable per 0006)
 * and its skill level (preferences.onboarding.skillLevel — no such column).
 * @param {string} userId
 * @param {string} instrument
 * @param {string} skillLevel
 * @returns {Promise<void>}
 */
export async function saveInstrumentAndLevel(userId, instrument, skillLevel) {
  const { error } = await (await supabase())
    .from('profiles')
    .update({ instrument })
    .eq('id', userId)
  if (error) throw error
  await saveOnboardingState(userId, { instrument, skillLevel, instrumentSet: true })
}
