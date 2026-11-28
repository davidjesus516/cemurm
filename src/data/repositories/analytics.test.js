import { describe, expect, it } from 'vitest'

import { branchOptions, selectPrimaryOrg } from './analytics.js'

const membership = (id, over = {}) => ({
  id,
  orgId: 'o1',
  branchId: null,
  role: 'org_member',
  status: 'active',
  joinedAt: '2026-01-01T00:00:00.000Z',
  leftAt: null,
  org: { id: 'o1', name: 'Academia Musical', orgType: null, logoUrl: null, status: 'active' },
  branch: null,
  ...over,
})

describe('selectPrimaryOrg', () => {
  it('prefers an active owner/admin membership over a plain member membership', () => {
    const rows = [
      membership('m1', { orgId: 'o1' }),
      membership('m2', {
        orgId: 'o2',
        role: 'org_admin',
        org: { id: 'o2', name: 'Second Org', orgType: null, logoUrl: null, status: 'active' },
      }),
    ]
    expect(selectPrimaryOrg(rows)).toMatchObject({ orgId: 'o2', role: 'org_admin' })
  })

  it('skips former and org-less memberships, and returns null when none qualify', () => {
    expect(selectPrimaryOrg([
      membership('m1', { status: 'former' }),
      membership('m2', { org: null }),
    ])).toBe(null)
    expect(selectPrimaryOrg([])).toBe(null)
  })
})

describe('branchOptions', () => {
  it('uses known branch names and gives unknown branch ids an honest fallback label', () => {
    const rows = branchOptions(
      [membership('m1', { branchId: 'b1', branch: { id: 'b1', name: 'Madrid', city: null } })],
      [
        { id: 'u1', branchId: 'b1' },
        { id: 'u2', branchId: 'b2' },
      ],
    )
    expect(rows).toEqual([
      { id: 'b1', name: 'Madrid' },
      { id: 'b2', name: 'Branch b2' },
    ])
  })
})
