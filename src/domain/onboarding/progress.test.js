import { describe, expect, it } from 'vitest'
import { ONBOARDING_STEPS, computeProgress, firstIncompleteStep } from './progress.js'

describe('onboarding progress math', () => {
  it('tracks exactly the four product steps, in order', () => {
    expect(ONBOARDING_STEPS).toEqual([
      'accountCreated',
      'joinedOrg',
      'instrumentSet',
      'tourCompleted',
    ])
  })

  it('starts at 0% with nothing complete', () => {
    expect(computeProgress({})).toEqual({
      completed: 0,
      total: 4,
      percent: 0,
      complete: false,
    })
  })

  it('reports 25% per completed step', () => {
    expect(computeProgress({ accountCreated: true }).percent).toBe(25)
    expect(computeProgress({ accountCreated: true, joinedOrg: true }).percent).toBe(50)
    expect(
      computeProgress({ accountCreated: true, joinedOrg: true, instrumentSet: true }).percent,
    ).toBe(75)
  })

  it('reaches 100% only when all four steps are complete', () => {
    const full = {
      accountCreated: true,
      joinedOrg: true,
      instrumentSet: true,
      tourCompleted: true,
    }
    expect(computeProgress(full)).toEqual({
      completed: 4,
      total: 4,
      percent: 100,
      complete: true,
    })
    // Three of four is 75%, never 100% -- the completion screen must not show early.
    expect(computeProgress({ ...full, tourCompleted: false }).complete).toBe(false)
  })

  it('ignores unrelated or false flags', () => {
    const noisy = {
      accountCreated: true,
      joinedOrg: 'yes',
      instrumentSet: false,
      tourCompleted: 1,
      someFutureStep: true,
    }
    expect(computeProgress(noisy).completed).toBe(1)
    expect(computeProgress(noisy).percent).toBe(25)
  })

  it('resumes at the first incomplete step in product order', () => {
    expect(firstIncompleteStep({})).toBe('accountCreated')
    expect(firstIncompleteStep({ accountCreated: true })).toBe('joinedOrg')
    expect(firstIncompleteStep({ accountCreated: true, joinedOrg: true })).toBe('instrumentSet')
    expect(
      firstIncompleteStep({ accountCreated: true, joinedOrg: true, instrumentSet: true }),
    ).toBe('tourCompleted')
  })

  it('resumes at the earliest missing step even if a later one is done', () => {
    expect(firstIncompleteStep({ instrumentSet: true, tourCompleted: true })).toBe('accountCreated')
  })

  it('has no resume target once everything is complete', () => {
    expect(
      firstIncompleteStep({
        accountCreated: true,
        joinedOrg: true,
        instrumentSet: true,
        tourCompleted: true,
      }),
    ).toBe(null)
  })
})
