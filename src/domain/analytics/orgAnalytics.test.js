import { describe, expect, it } from 'vitest'

import { memberTenure, membersByBranch, repertoireByBranch } from './orgAnalytics.js'

const member = (id, over = {}) => ({
  id,
  userId: id,
  orgId: 'o1',
  branchId: 'b1',
  role: 'org_member',
  status: 'active',
  joinedAt: '2026-01-01T00:00:00.000Z',
  leftAt: null,
  ...over,
})

const song = (id, over = {}) => ({
  id,
  title: `Song ${id}`,
  orgId: 'o1',
  branchId: 'b1',
  sourceOrgId: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  ...over,
})

describe('membersByBranch', () => {
  it('counts members per branch, includes empty branches and an unassigned bucket', () => {
    const rows = membersByBranch([
      member('u1', { branchId: 'b1' }),
      member('u2', { branchId: 'b1' }),
      member('u3', { branchId: null }),
    ], [
      { id: 'b1', name: 'Madrid' },
      { id: 'b2', name: 'Lima' },
    ])

    expect(rows).toEqual([
      { branchId: 'b1', name: 'Madrid', count: 2 },
      { branchId: null, name: 'Unassigned', count: 1 },
      { branchId: 'b2', name: 'Lima', count: 0 },
    ])
  })
})

describe('memberTenure', () => {
  it('computes average tenure in days and joins in the current month', () => {
    const now = new Date('2026-06-30T00:00:00.000Z')
    const stats = memberTenure([
      member('u1', { joinedAt: '2026-06-20T00:00:00.000Z' }), // 11 days, this month
      member('u2', { joinedAt: '2026-06-10T00:00:00.000Z' }), // 21 days, this month
      member('u3', { joinedAt: '2025-12-31T00:00:00.000Z' }), // older
    ], now)

    expect(stats.total).toBe(3)
    expect(stats.joinedThisMonth).toBe(2)
    expect(stats.averageTenureDays).toBeGreaterThan(0)
    expect(stats.averageTenureDays).toBeLessThan(400)
  })

  it('returns zeros for an empty roster', () => {
    expect(memberTenure([], new Date('2026-07-01T00:00:00.000Z'))).toEqual({
      total: 0,
      joinedThisMonth: 0,
      averageTenureDays: 0,
    })
  })
})

describe('repertoireByBranch', () => {
  it('groups songs by branch and splits org-specific from system-level songs', () => {
    const result = repertoireByBranch([
      song('s1', { branchId: 'b1', orgId: 'o1' }),
      song('s2', { branchId: 'b2', orgId: 'o1' }),
      song('s3', { branchId: null, orgId: null }),
    ], [
      { id: 'b1', name: 'Madrid' },
      { id: 'b2', name: 'Lima' },
    ])

    expect(result.byBranch).toEqual([
      { branchId: 'b2', name: 'Lima', count: 1 },
      { branchId: 'b1', name: 'Madrid', count: 1 },
      { branchId: null, name: 'Unassigned', count: 1 },
    ])
    expect(result.orgSpecific).toBe(2)
    expect(result.systemSongs).toBe(1)
    expect(result.total).toBe(3)
  })

  it('returns zeroed totals with no songs', () => {
    const result = repertoireByBranch([], [{ id: 'b1', name: 'Madrid' }])
    expect(result.total).toBe(0)
    expect(result.byBranch[0].count).toBe(0)
  })
})
