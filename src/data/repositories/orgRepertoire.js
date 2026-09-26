// @ts-check
// Organizational repertoire (Hito 4, org-repertoire-model): data layer for
// src/pages/Organizations.jsx — my org memberships (org + branch nested) and
// thin RPC wrappers for promote/demote/leave. RLS is the source of truth:
// reads just query and render what comes back, and the RPCs enforce the
// business rules server-side (migration 0016). Known user-facing errors are
// re-thrown as-is; everything else maps to the generic message (songs.js /
// setlists.js convention).
//
// Public surface: getMyOrganizations, promoteSong, demoteSong, leaveOrganization.

import { supabase } from '../supabase.js'

/**
 * org_memberships.status — the 0001 `member_status` enum; 'former' rows are
 * read-only history kept after leave_organization.
 * @typedef {'active' | 'former' | 'pending'} MemberStatus
 */

/**
 * Raw organizations row (0001) as the `organizations(*)` embed returns it —
 * every column comes back; org_type/logo_url are nullable.
 * @typedef {object} OrganizationRow
 * @property {string} id
 * @property {string} name
 * @property {string | null} org_type
 * @property {string | null} logo_url
 * @property {string} status
 */

/**
 * Raw branches row (0001) as the `branches(*)` embed returns it — every
 * column comes back; city is nullable.
 * @typedef {object} BranchRow
 * @property {string} id
 * @property {string} org_id
 * @property {string} name
 * @property {string | null} city
 * @property {string} status
 */

/**
 * Raw org_memberships row with the embedded organizations + branches objects.
 * branch_id goes null when a branch is archived (ON DELETE SET NULL).
 * @typedef {object} RawOrgMembership
 * @property {string} id
 * @property {string} user_id
 * @property {string} org_id
 * @property {string | null} branch_id
 * @property {string} role
 * @property {MemberStatus} status
 * @property {string} joined_at
 * @property {string | null} left_at
 * @property {OrganizationRow | null} organizations
 * @property {BranchRow | null} branches
 */

/**
 * Nested organization summary (normalizeMembership flattens the embed).
 * @typedef {object} OrgSummary
 * @property {string} id
 * @property {string} name
 * @property {string | null} orgType
 * @property {string | null} logoUrl
 * @property {string} status
 */

/**
 * Nested branch summary.
 * @typedef {object} BranchSummary
 * @property {string} id
 * @property {string} name
 * @property {string | null} city
 */

/**
 * Flattened app shape: camelCase membership plus the nested org/branch
 * (either embed is null when the row is absent or filtered by RLS).
 * @typedef {object} OrgMembership
 * @property {string} id
 * @property {string} orgId
 * @property {string | null} branchId
 * @property {string} role
 * @property {MemberStatus} status
 * @property {string} joinedAt
 * @property {string | null} leftAt
 * @property {OrgSummary | null} org
 * @property {BranchSummary | null} branch
 */

// ponytail: exact strings raised by the 0016 RPCs (promote_song_to_system,
// demote_song_to_org, leave_organization) — surfaced verbatim so the UI can
// render e.g. 'You can only promote songs from your own organization.'
const USER_ERRORS = new Set([
  // promote_song_to_system
  'Song not found.',
  'Song is already at system level.',
  'You can only promote songs from your own organization.',
  // demote_song_to_org
  'Song is not at system level.',
  'Song has no source organization.',
  'You can only demote songs owned by your organization.',
  // leave_organization
  'Not a member.',
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
 * Flatten one raw org_memberships row (with embedded organizations +
 * branches) into the app shape: camelCase membership + nested org/branch.
 * @param {RawOrgMembership} row
 * @returns {OrgMembership}
 */
function normalizeMembership(row) {
  const org = row.organizations
  const branch = row.branches
  return {
    id: row.id,
    orgId: row.org_id,
    branchId: row.branch_id,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
    org: org
      ? { id: org.id, name: org.name, orgType: org.org_type, logoUrl: org.logo_url, status: org.status }
      : null,
    branch: branch
      ? { id: branch.id, name: branch.name, city: branch.city }
      : null,
  }
}

/**
 * My own memberships (incl. 'former' history), each with its organization
 * and branch. RLS scopes the read; the self-row filter is explicit because
 * the 0016 roster policy also exposes full org rosters to owners/admins —
 * this page only wants MY rows.
 * @returns {Promise<OrgMembership[]>} empty when signed out
 */
export function getMyOrganizations() {
  return withErrorMapping(async () => {
    const { data: session } = await supabase.auth.getUser()
    const userId = session?.user?.id
    if (!userId) return []

    const { data, error } = await supabase
      .from('org_memberships')
      .select('*, organizations(*), branches(*)')
      .eq('user_id', userId)
    if (error) throw error

    return (data || []).map(normalizeMembership)
  })
}

/** Promote an org/branch-level song of my org to system level (RLS + RPC gated). */
/**
 * @param {string} songId
 * @returns {Promise<void>}
 */
export function promoteSong(songId) {
  return withErrorMapping(async () => {
    const { error } = await supabase.rpc('promote_song_to_system', { p_song_id: songId })
    if (error) throw error
  })
}

/** Return a system song to its source org (RLS + RPC gated). */
/**
 * @param {string} songId
 * @returns {Promise<void>}
 */
export function demoteSong(songId) {
  return withErrorMapping(async () => {
    const { error } = await supabase.rpc('demote_song_to_org', { p_song_id: songId })
    if (error) throw error
  })
}

/** Flip MY active membership to 'former' (row stays readable via self RLS). */
/**
 * @param {string} orgId
 * @returns {Promise<void>}
 */
export function leaveOrganization(orgId) {
  return withErrorMapping(async () => {
    const { error } = await supabase.rpc('leave_organization', { p_org_id: orgId })
    if (error) throw error
  })
}