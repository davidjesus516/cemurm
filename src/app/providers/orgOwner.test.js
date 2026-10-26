import { describe, it, expect } from 'vitest'
import { isOrgOwner, ORG_OWNER_ROLE } from './orgOwner.js'

describe('isOrgOwner', () => {
  it('admits an active organization owner', () => {
    expect(isOrgOwner([{ role: ORG_OWNER_ROLE, status: 'active' }])).toBe(true)
  })

  it('rejects every other organization role', () => {
    for (const role of ['org_admin', 'branch_admin', 'instructor', 'org_member']) {
      expect(isOrgOwner([{ role, status: 'active' }])).toBe(false)
    }
  })

  it('rejects a platform administrator who is not an organization owner', () => {
    expect(isOrgOwner([{ role: 'system_admin', status: 'active' }])).toBe(false)
  })

  it('rejects former and pending owner memberships', () => {
    expect(isOrgOwner([{ role: ORG_OWNER_ROLE, status: 'former' }])).toBe(false)
    expect(isOrgOwner([{ role: ORG_OWNER_ROLE, status: 'pending' }])).toBe(false)
  })

  it('rejects empty or unreadable memberships', () => {
    expect(isOrgOwner(null)).toBe(false)
    expect(isOrgOwner(undefined)).toBe(false)
    expect(isOrgOwner([])).toBe(false)
  })
})
