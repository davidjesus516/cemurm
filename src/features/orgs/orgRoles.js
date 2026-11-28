// Roles the members admin page may assign. The server (0021 change_member_role_core)
// allows org_owner to appoint any role, but its documented policy reserves org_admin
// appointments for owners. Keep that separation here so an org_admin cannot promote
// themselves or another member through this page.
export const ASSIGNABLE_ROLES = [
  { value: 'instructor', label: 'Instructor' },
  { value: 'branch_admin', label: 'Branch admin' },
  { value: 'org_admin', label: 'Org admin' },
  { value: 'org_member', label: 'Member' },
  { value: 'performer', label: 'Performer' },
]

export function rolesAssignableBy(isOwner) {
  return isOwner
    ? ASSIGNABLE_ROLES
    : ASSIGNABLE_ROLES.filter((role) => role.value !== 'org_admin')
}
