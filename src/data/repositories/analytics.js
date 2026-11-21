// @ts-check
// Read-only assembly for the analytics org/offline surface (S3, T7/T8). Reuses
// the existing org repositories — it does NOT add a second RLS path or a new
// RPC. Both org reads are lazy so the pure helpers below stay importable in the
// node test tier, where supabase.js has no env and throws at module eval.
//
// Scope honesty: getMyOrganizations() returns only the signed-in user's
// memberships, and getOrgMembers() is RLS-scoped. The org dashboard therefore
// reports the rows this user can actually read; it never claims org-wide totals
// the schema/RLS cannot give it.

/**
 * @typedef {import('./orgRepertoire.js').Membership} Membership
 * @typedef {import('./orgMembers.js').OrgMember} OrgMember
 */

/**
 * The membership whose org the admin view should show. Owner/admin memberships
 * win over a plain member membership; inactive and org-less rows never qualify.
 * @param {Membership[]} memberships
 * @returns {Membership | null}
 */
export function selectPrimaryOrg(memberships) {
  const eligible = (memberships || []).filter((m) => m?.status === 'active' && m.org?.id)
  const privileged = eligible.filter((m) => m.role === 'org_owner' || m.role === 'org_admin')
  return privileged[0] || eligible[0] || null
}

/**
 * Branch display options: names from my own memberships, plus an honest
 * fallback label for branch ids seen only on other members' rows.
 * @param {Membership[]} memberships
 * @param {Pick<OrgMember, 'id' | 'branchId'>[]} members
 * @returns {{ id: string, name: string }[]}
 */
export function branchOptions(memberships, members) {
  /** @type {Map<string, string>} */
  const names = new Map()
  for (const membership of memberships || []) {
    if (membership?.org?.id && membership.branch?.id) {
      names.set(membership.branch.id, membership.branch.name || `Branch ${membership.branch.id}`)
    }
  }
  for (const member of members || []) {
    if (member?.branchId && !names.has(member.branchId)) {
      names.set(member.branchId, `Branch ${member.branchId}`)
    }
  }
  return [...names.entries()].map(([id, name]) => ({ id, name }))
}

/**
 * The org dashboard payload: chosen org, branch options and visible members.
 * Returns null when the user has no usable membership — the page then shows an
 * honest "no organization" state rather than an empty admin chart.
 * @returns {Promise<{ org: NonNullable<Membership['org']>, role: string, branches: { id: string, name: string }[], members: OrgMember[] } | null>}
 */
export async function getOrgAnalytics() {
  const { getMyOrganizations } = await import('./orgRepertoire.js')
  const { getOrgMembers } = await import('./orgMembers.js')
  const memberships = await getMyOrganizations()
  const primary = selectPrimaryOrg(memberships)
  if (!primary?.org) return null

  const members = await getOrgMembers(primary.org.id)
  return {
    org: primary.org,
    role: primary.role,
    branches: branchOptions(memberships, members),
    members,
  }
}

/**
 * Outbox depth for the offline card. pendingOps is IDB-backed and swallows its
 * own failures, so this is offline-safe and never throws to the page.
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function getPendingWriteCount(userId) {
  const { pendingOps } = await import('../../offline/queue.js')
  const ops = await pendingOps(userId)
  return Array.isArray(ops) ? ops.length : 0
}
