// @ts-check
// Organization members (F1 — Membership Admin): data layer for
// src/features/orgs/pages/OrganizationMembers.jsx — thin RPC wrappers for
// add/change/remove member. RLS + SECURITY DEFINER RPCs enforce the business
// rules server-side (migration 0021). Known user-facing errors are re-thrown
// as-is; everything else maps to the generic message (orgRepertoire.js /
// songs.js convention).
//
// Public surface: getOrgMembers, addOrgMember, changeMemberRole, removeOrgMember.

import { supabase } from '../supabase.js'

/**
 * @typedef {'org_owner' | 'org_admin' | 'branch_admin' | 'instructor' | 'org_member' | 'performer' | 'substitute' | 'event_coordinator' | 'backstage_coordinator'} MemberRole
 */

/**
 * @typedef {object} OrgMember
 * @property {string} id
 * @property {string} userId
 * @property {string} orgId
 * @property {string | null} branchId
 * @property {MemberRole} role
 * @property {'active' | 'former' | 'pending'} status
 * @property {string} joinedAt
 * @property {string | null} leftAt
 * @property {string} username
 * @property {string} displayName
 * @property {string | null} avatarUrl
 */

/**
 * Exact user-facing strings raised by the 0021 RPCs (add_org_member,
 * change_member_role, remove_org_member). Surfaced verbatim so the UI can
 * render e.g. 'only org_owner can change member roles'.
 */
const USER_ERRORS = new Set([
  'not authorized',
  'org not found',
  'user not found',
  'only org_owner can appoint org_owner',
  'cannot modify org_owner',
  'membership not found',
  'cannot remove org_owner',
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

/**
 * All members of the org the caller belongs to (RLS-scoped).
 *
 * Two reads on purpose: `org_memberships.user_id` references `auth.users`,
 * not `profiles`, so PostgREST cannot embed the profile through a direct FK.
 * The second read is a single `in` query over the member ids — never N+1.
 *
 * @param {string} orgId
 * @returns {Promise<OrgMember[]>}
 */
export async function getOrgMembers(orgId) {
  return withErrorMapping(async () => {
    const { data: rows, error } = await supabase
      .from('org_memberships')
      .select('id, user_id, org_id, branch_id, role, status, joined_at, left_at')
      .eq('org_id', orgId)
      .eq('status', 'active')
    if (error) throw error

    const memberships = rows || []
    if (memberships.length === 0) return []

    const userIds = [...new Set(memberships.map((r) => r.user_id))]
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', userIds)
    if (profileError) throw profileError

    /** @type {Map<string, { display_name: string | null, username: string | null, avatar_url: string | null }>} */
    const byId = new Map((profileRows || []).map((p) => [p.id, p]))

    return memberships.map((row) => {
      const p = byId.get(row.user_id)
      return {
        id: row.id,
        userId: row.user_id,
        orgId: row.org_id,
        branchId: row.branch_id,
        role: row.role,
        status: row.status,
        joinedAt: row.joined_at,
        leftAt: row.left_at,
        username: p?.username ?? '',
        displayName: p?.display_name ?? '',
        avatarUrl: p?.avatar_url ?? null,
      }
    })
  })
}

/**
 * Add a user to an org with a role and optional branch (org_owner/org_admin only).
 * @param {string} orgId
 * @param {string} userId
 * @param {MemberRole} [role]
 * @param {string | null} [branchId]
 * @returns {Promise<void>}
 */
export function addOrgMember(orgId, userId, role = 'org_member', branchId = null) {
  return withErrorMapping(async () => {
    const { error } = await supabase.rpc('add_org_member', {
      p_org_id: orgId,
      p_user_id: userId,
      p_role: role,
      p_branch_id: branchId,
    })
    if (error) throw error
  })
}

/**
 * Change a member's role within an org (org_owner or org_admin; neither may touch
 * an org_owner, and only an org_owner can appoint one).
 * @param {string} orgId
 * @param {string} userId
 * @param {MemberRole} role
 * @param {string | null} [branchId]
 * @returns {Promise<void>}
 */
export function changeMemberRole(orgId, userId, role, branchId = null) {
  return withErrorMapping(async () => {
    const { error } = await supabase.rpc('change_member_role', {
      p_org_id: orgId,
      p_user_id: userId,
      p_role: role,
      p_branch_id: branchId,
    })
    if (error) throw error
  })
}

/**
 * Remove a member from an org (soft delete: status='former', org_owner only).
 * @param {string} orgId
 * @param {string} userId
 * @param {string | null} [branchId]
 * @returns {Promise<void>}
 */
export function removeOrgMember(orgId, userId, branchId = null) {
  return withErrorMapping(async () => {
    const { error } = await supabase.rpc('remove_org_member', {
      p_org_id: orgId,
      p_user_id: userId,
      p_branch_id: branchId,
    })
    if (error) throw error
  })
}
