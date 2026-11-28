import { describe, expect, it } from 'vitest'
import { rolesAssignableBy } from './orgRoles.js'

describe('rolesAssignableBy', () => {
  it('lets an org owner assign every role, including org_admin', () => {
    expect(rolesAssignableBy(true).map((r) => r.value)).toEqual([
      'instructor',
      'branch_admin',
      'org_admin',
      'org_member',
      'performer',
    ])
  })

  it('hides org_admin from an org admin', () => {
    expect(rolesAssignableBy(false).map((r) => r.value)).toEqual([
      'instructor',
      'branch_admin',
      'org_member',
      'performer',
    ])
  })
})
