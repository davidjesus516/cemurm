// Organization-owner predicate — pure so the rule is testable without a browser.
//
// The /dashboard surface is the organization owner's console, not a general
// manager surface. "Owner" is the org_memberships.role value defined by
// migration 0001; an org_admin, branch_admin, instructor or platform
// system_admin is NOT the owner and does not pass. 'former' and 'pending'
// memberships are historical or unconfirmed, so only status === 'active'
// counts. No role or column is invented here.
export const ORG_OWNER_ROLE = 'org_owner'

/**
 * @param {Array<{ role?: string, status?: string }> | null | undefined} memberships
 * @returns {boolean}
 */
export function isOrgOwner(memberships) {
  return (memberships || []).some(
    (membership) =>
      membership?.status === 'active' && membership?.role === ORG_OWNER_ROLE,
  )
}
