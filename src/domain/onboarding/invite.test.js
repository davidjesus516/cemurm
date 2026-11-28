import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INVITE_EXPIRY_DAYS,
  INVITE_ERROR,
  inviteExpiryISO,
  normalizeInviteCode,
  validateInviteState,
} from './invite.js'

const NOW = Date.parse('2026-11-21T12:00:00.000Z')
const ORG_ID = '10000000-0000-0000-0000-0000000000a1'

describe('invite state validation (mirrors redeem_org_invite)', () => {
  it('defaults to a 7-day expiry and honours a configurable override', () => {
    expect(DEFAULT_INVITE_EXPIRY_DAYS).toBe(7)
    expect(inviteExpiryISO(undefined, NOW)).toBe('2026-11-28T12:00:00.000Z')
    expect(inviteExpiryISO(14, NOW)).toBe('2026-12-05T12:00:00.000Z')
  })

  it('falls back to 7 days for a non-positive or non-finite override', () => {
    expect(inviteExpiryISO(0, NOW)).toBe('2026-11-28T12:00:00.000Z')
    expect(inviteExpiryISO(Number.NaN, NOW)).toBe('2026-11-28T12:00:00.000Z')
  })

  it('normalizes a typed code to trimmed uppercase', () => {
    expect(normalizeInviteCode('  acad-mad-001  ')).toBe('ACAD-MAD-001')
    expect(normalizeInviteCode(null)).toBe('')
  })

  it('accepts a live, unused, org_invite code', () => {
    const row = {
      kind: 'org_invite',
      org_id: ORG_ID,
      role: 'org_member',
      used_at: null,
      expires_at: '2026-11-28T12:00:00.000Z',
    }
    expect(validateInviteState(row, NOW)).toEqual({ ok: true, orgId: ORG_ID, role: 'org_member' })
  })

  it('returns the SAME generic error for a missing, used, expired or wrong-kind code', () => {
    const valid = {
      kind: 'org_invite',
      org_id: ORG_ID,
      role: 'org_member',
      used_at: null,
      expires_at: '2026-11-28T12:00:00.000Z',
    }
    const cases = [
      null,
      { ...valid, used_at: '2026-11-20T10:00:00.000Z' },
      { ...valid, expires_at: '2026-11-21T11:59:59.000Z' },
      { ...valid, expires_at: 'not-a-date' },
      { ...valid, kind: 'proximity' },
      { ...valid, org_id: null },
    ]
    for (const row of cases) {
      expect(validateInviteState(row, NOW)).toEqual({ ok: false, error: INVITE_ERROR })
    }
  })

  it('treats an expiry exactly equal to now as expired', () => {
    const row = {
      kind: 'org_invite',
      org_id: ORG_ID,
      role: 'org_member',
      used_at: null,
      expires_at: '2026-11-21T12:00:00.000Z',
    }
    expect(validateInviteState(row, NOW).ok).toBe(false)
  })
})
