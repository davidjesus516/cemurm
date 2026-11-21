import { describe, expect, it } from 'vitest'
import { INVITE_ERROR } from '../../domain/onboarding/invite.js'
import { mapRedeemError, mergePrefsJsonb, prepareCode } from './onboardingInvites.js'

describe('onboardingInvites repository helpers', () => {
  it('prepares a typed code before sending it to the RPC', () => {
    expect(prepareCode(' acad-mad-001 ')).toBe('ACAD-MAD-001')
    expect(prepareCode(undefined)).toBe('')
  })

  it('merges onboarding state without clobbering other preference slices', () => {
    const before = { default_version: 'v2', override: { s1: 2 }, onboarding: { accountCreated: true } }
    expect(mergePrefsJsonb(before, { joinedOrg: true })).toEqual({
      default_version: 'v2',
      override: { s1: 2 },
      onboarding: { accountCreated: true, joinedOrg: true },
    })
  })

  it('creates the onboarding slice when none exists', () => {
    expect(mergePrefsJsonb(null, { tourCompleted: true })).toEqual({
      onboarding: { tourCompleted: true },
    })
  })

  it('maps every redeem failure to one generic message (no code oracle)', () => {
    const errors = [
      new Error('Invalid or expired invite code'),
      new Error('permission denied for function redeem_org_invite'),
      new Error('This invite code is invalid or has expired.'),
      { code: 'PGRST202', message: 'Could not find the function' },
      new Error('database error'),
      null,
      undefined,
    ]
    for (const error of errors) {
      expect(mapRedeemError(error)).toBe(INVITE_ERROR)
    }
  })
})
