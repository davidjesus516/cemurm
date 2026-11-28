// @ts-check
// Pure onboarding progress math (S2 — progress tracked / completion / resume).
// The four steps are the product's own list from user-onboarding.feature
// ("Onboarding progress is tracked"): account creation, joining an org,
// setting the instrument and completing the dashboard tour. Keeping the order
// here is what makes "resume at the first incomplete step" deterministic and
// testable in bare node (no DOM, no network — L5: Vitest/node only).

/** @typedef {'accountCreated' | 'joinedOrg' | 'instrumentSet' | 'tourCompleted'} StepKey */

/** @type {ReadonlyArray<StepKey>} */
export const ONBOARDING_STEPS = Object.freeze([
  'accountCreated',
  'joinedOrg',
  'instrumentSet',
  'tourCompleted',
])

/**
 * @typedef {object} Progress
 * @property {number} completed
 * @property {number} total
 * @property {number} percent
 * @property {boolean} complete
 */

/**
 * @param {Partial<Record<StepKey, unknown>> | null | undefined} steps
 * @returns {Progress}
 */
export function computeProgress(steps) {
  const total = ONBOARDING_STEPS.length
  const completed = ONBOARDING_STEPS.filter((key) => steps?.[key] === true).length
  return {
    completed,
    total,
    percent: Math.round((completed / total) * 100),
    complete: completed === total,
  }
}

/**
 * The first product step still outstanding, in order — the resume target for
 * the "Complete your setup" banner. Null means nothing is left to resume.
 * @param {Partial<Record<StepKey, unknown>> | null | undefined} steps
 * @returns {StepKey | null}
 */
export function firstIncompleteStep(steps) {
  return ONBOARDING_STEPS.find((key) => steps?.[key] !== true) ?? null
}
