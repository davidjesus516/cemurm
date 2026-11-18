// Share-link state helpers: the panel's label and the copied URL. The expiry
// itself is the database's (0047 stamps now() + 7 days); these assertions are
// about reading that fact back correctly, not about enforcing it.

import { describe, expect, it } from 'vitest'

import { shareLinkDaysLeft, shareLinkState, shareLinkUrl, SHARE_LINK_TTL_DAYS } from './shareLinks.js'

const NOW = Date.parse('2026-11-18T12:00:00.000Z')
const later = (ms) => new Date(NOW + ms).toISOString()

describe('shareLinkUrl', () => {
  it('points at the redeem route on the app origin', () => {
    expect(shareLinkUrl('abc-123', 'https://app.cemurm.test')).toBe(
      'https://app.cemurm.test/share/setlists/abc-123',
    )
  })

  it('trims a trailing slash and encodes the token', () => {
    expect(shareLinkUrl('a/b', 'https://app.cemurm.test/')).toBe(
      'https://app.cemurm.test/share/setlists/a%2Fb',
    )
  })
})

describe('shareLinkState', () => {
  it('is active while there is time left', () => {
    expect(shareLinkState({ expiresAt: later(60_000) }, NOW)).toBe('active')
  })

  it('is expired at or past the expiry instant', () => {
    expect(shareLinkState({ expiresAt: later(0) }, NOW)).toBe('expired')
    expect(shareLinkState({ expiresAt: later(-1) }, NOW)).toBe('expired')
  })

  it('is revoked before it is expired, because that is why it stopped', () => {
    expect(
      shareLinkState({ expiresAt: later(-1000), revokedAt: later(-2000) }, NOW),
    ).toBe('revoked')
  })

  it('treats a missing or unparsable expiry as expired', () => {
    expect(shareLinkState({}, NOW)).toBe('expired')
    expect(shareLinkState({ expiresAt: 'not-a-date' }, NOW)).toBe('expired')
    expect(shareLinkState(null, NOW)).toBe('expired')
  })
})

describe('shareLinkDaysLeft', () => {
  it('reports the whole days remaining', () => {
    expect(shareLinkDaysLeft({ expiresAt: later(3 * 86400000) }, NOW)).toBe(3)
  })

  it('rounds a partial day up so an active link never reads 0', () => {
    expect(shareLinkDaysLeft({ expiresAt: later(60_000) }, NOW)).toBe(1)
  })

  it('is null when the link is not active', () => {
    expect(shareLinkDaysLeft({ expiresAt: later(-1000) }, NOW)).toBeNull()
    expect(
      shareLinkDaysLeft({ expiresAt: later(86400000), revokedAt: later(-1) }, NOW),
    ).toBeNull()
  })

  it('matches the 7-day lifetime the migration stamps', () => {
    expect(SHARE_LINK_TTL_DAYS).toBe(7)
    expect(shareLinkDaysLeft({ expiresAt: later(7 * 86400000) }, NOW)).toBe(7)
  })
})
