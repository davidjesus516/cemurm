// Unit tests for the drainer's failure classification (audit R6).
//
// Characterization-style: they pin the CURRENT contract of the pure module, in
// the same spirit as the rest of the domain suite. They live under src/domain
// (not src/offline) because the classification is pure and has no IndexedDB
// dependency — Vitest runs in the node environment with no jsdom, so nothing
// that touches a real `indexedDB` is reachable from here. drainer.js itself
// stays untested for that reason; the decision logic it delegates to does not.

import { describe, it, expect } from 'vitest'

import {
  classifyDrainFailure,
  decideDrainOutcome,
  quarantineNotice,
  MAPPED_GENERIC_ERROR,
  DRAIN_ACTION,
  DRAIN_KIND,
  UNKNOWN_RETRY_BUDGET,
} from './drainFailure.js'

/** The shape PostgREST actually throws: an Error subclass, no `status`. */
function pgError(message, code) {
  const e = new Error(message)
  e.name = 'PostgrestError'
  e.details = null
  e.hint = null
  e.code = code
  return e
}

// ── the rule ────────────────────────────────────────────────────────────────
// A request the server ANSWERED cannot succeed unchanged on the next drain
// (permanent); a request it never answered can (transient). That is the split.

describe('classifyDrainFailure', () => {
  it('treats a network failure as transient', () => {
    // Chrome's phrasing for a failed fetch, which is what a dropped connection
    // surfaces as mid-drain.
    const r = classifyDrainFailure(new TypeError('Failed to fetch'))
    expect(r.kind).toBe(DRAIN_KIND.OFFLINE)
    expect(r.permanent).toBe(false)
  })

  it('treats an undici/Node fetch failure as transient', () => {
    expect(classifyDrainFailure(new TypeError('fetch failed')).kind).toBe(DRAIN_KIND.OFFLINE)
  })

  it("treats supabase's own connectivity code as transient", () => {
    // The same `code === '-1'` marker the repositories' isConnectivityError
    // uses to decide to enqueue an op in the first place.
    const r = classifyDrainFailure(pgError('network error', '-1'))
    expect(r.kind).toBe(DRAIN_KIND.OFFLINE)
    expect(r.permanent).toBe(false)
  })

  it('treats a 5xx as transient', () => {
    const e = pgError('Internal Server Error', '500')
    e.status = 500
    const r = classifyDrainFailure(e)
    expect(r.kind).toBe(DRAIN_KIND.SERVER)
    expect(r.permanent).toBe(false)
  })

  it('treats 408, 425 and 429 as transient', () => {
    for (const status of [408, 425, 429]) {
      const e = pgError(`status ${status}`)
      e.status = status
      expect(classifyDrainFailure(e).permanent).toBe(false)
    }
  })

  it('treats a 409 conflict as permanent', () => {
    // Replaying the identical request re-derives the identical conflict.
    const e = pgError('duplicate key value violates unique constraint')
    e.status = 409
    const r = classifyDrainFailure(e)
    expect(r.kind).toBe(DRAIN_KIND.REJECTED)
    expect(r.reason).toBe('conflict')
    expect(r.permanent).toBe(true)
  })

  it('treats a 4xx validation rejection as permanent', () => {
    const e = pgError('invalid input syntax for type uuid')
    e.status = 422
    const r = classifyDrainFailure(e)
    expect(r.kind).toBe(DRAIN_KIND.REJECTED)
    expect(r.reason).toBe('invalid')
  })

  it('treats an RLS denial as permanent', () => {
    // 42501 is insufficient_privilege, i.e. the policy refused the write.
    const r = classifyDrainFailure(
      pgError('new row violates row-level security policy for table "songs"', '42501'),
    )
    expect(r.kind).toBe(DRAIN_KIND.REJECTED)
    expect(r.reason).toBe('rls')
    expect(r.permanent).toBe(true)
  })

  it('treats an RLS denial reported only in the message as permanent', () => {
    const r = classifyDrainFailure(new Error('Row level security denied the request'))
    expect(r.reason).toBe('rls')
  })

  it('treats an auth failure as permanent', () => {
    const r = classifyDrainFailure(pgError('JWT expired', 'PGRST301'))
    expect(r.reason).toBe('auth')
    expect(r.permanent).toBe(true)
  })

  it('treats a 403 as an RLS/permission rejection', () => {
    const e = pgError('permission denied for table setlists')
    e.status = 403
    expect(classifyDrainFailure(e).reason).toBe('rls')
  })

  it('treats a client-side guard message as permanent', () => {
    // handleError re-throws USER_ERRORS verbatim, so this is the commonest
    // permanent failure the drain actually sees.
    const r = classifyDrainFailure(new Error('Setlist name is required.'))
    expect(r.kind).toBe(DRAIN_KIND.REJECTED)
    expect(r.permanent).toBe(true)
  })

  it('treats the mapped generic message as UNKNOWN, not permanent', () => {
    // The critical case. handleError erases status and code, so this exact
    // string can be either a 503 or an RLS denial. Quarantining it would
    // discard writes on a flaky connection; retrying it forever would wedge
    // the queue. It is neither: bounded (see UNKNOWN_RETRY_BUDGET).
    const r = classifyDrainFailure(new Error(MAPPED_GENERIC_ERROR))
    expect(r.kind).toBe(DRAIN_KIND.UNKNOWN)
    expect(r.permanent).toBe(false)
  })

  it('does not throw on a malformed error', () => {
    for (const bad of [null, undefined, {}, '', 'a string', 42, [], { message: 7 }]) {
      expect(() => classifyDrainFailure(bad)).not.toThrow()
    }
    // No message at all ⇒ no evidence ⇒ UNKNOWN, retried under the budget.
    expect(classifyDrainFailure(null).kind).toBe(DRAIN_KIND.UNKNOWN)
    expect(classifyDrainFailure({}).kind).toBe(DRAIN_KIND.UNKNOWN)
  })

  it('reads a thrown string as its own message', () => {
    expect(classifyDrainFailure('Failed to fetch').kind).toBe(DRAIN_KIND.OFFLINE)
  })

  it('carries the message through as detail for the quarantine record', () => {
    expect(classifyDrainFailure(new Error('Not allowed.')).detail).toBe('Not allowed.')
  })

  it('lets connectivity win over an unrecognised error', () => {
    // Offline is checked before the fallbacks, so a blip never spends budget.
    const r = classifyDrainFailure(new Error('something odd'), false)
    expect(r.kind).toBe(DRAIN_KIND.OFFLINE)
  })

  it('does not let offline mask a verdict the server already gave', () => {
    // A guard error is a rejection even with no connection: it is thrown
    // client-side and replays to the same rejection.
    const r = classifyDrainFailure(new Error('Not allowed.'), false)
    expect(r.kind).toBe(DRAIN_KIND.REJECTED)
    expect(r.permanent).toBe(true)
  })

  it('keeps an UNRECOGNISED message retryable while offline', () => {
    // The deliberate limit of the rule above. With no connection and no
    // recognised verdict marker there is no evidence either way, and the
    // expensive mistake is the asymmetric one: quarantining a write that would
    // have landed once the connection came back destroys the user's data,
    // while retrying one that never will only costs a request. So an
    // unrecognised failure while offline stays retryable and spends no budget.
    const unrecognized = new Error('Cannot edit a completed gig.')
    const r = classifyDrainFailure(unrecognized, false)
    expect(r.kind).toBe(DRAIN_KIND.OFFLINE)
    expect(r.permanent).toBe(false)
    expect(decideDrainOutcome(unrecognized, { online: false, attempts: 999 }).action).toBe(
      DRAIN_ACTION.RETRY,
    )
  })
})

// ── the action ──────────────────────────────────────────────────────────────

describe('decideDrainOutcome', () => {
  it('retries a transient failure', () => {
    const r = decideDrainOutcome(new TypeError('Failed to fetch'), { online: true })
    expect(r.action).toBe(DRAIN_ACTION.RETRY)
  })

  it('quarantines a permanent failure on the FIRST attempt', () => {
    // No retry budget for a verdict: the outcome cannot change.
    const r = decideDrainOutcome(
      pgError('new row violates row-level security policy', '42501'),
      { online: true, attempts: 0 },
    )
    expect(r.action).toBe(DRAIN_ACTION.QUARANTINE)
    expect(r.reason).toBe('rls')
  })

  it('retries an UNKNOWN failure while budget remains', () => {
    for (let attempts = 0; attempts < UNKNOWN_RETRY_BUDGET; attempts += 1) {
      expect(decideDrainOutcome(new Error(MAPPED_GENERIC_ERROR), { online: true, attempts }).action)
        .toBe(DRAIN_ACTION.RETRY)
    }
  })

  it('sets aside an UNKNOWN failure once the budget is spent', () => {
    // This cap is what makes "fail open" safe: user data is never discarded on
    // a guess, but an unclassifiable op also cannot block the queue forever.
    const r = decideDrainOutcome(new Error(MAPPED_GENERIC_ERROR), {
      online: true,
      attempts: UNKNOWN_RETRY_BUDGET,
    })
    expect(r.action).toBe(DRAIN_ACTION.QUARANTINE)
    expect(r.kind).toBe(DRAIN_KIND.UNKNOWN)
  })

  it('never lets connectivity failures exhaust the unknown budget', () => {
    // A long outage must not strand writes that would still land later.
    const r = decideDrainOutcome(new TypeError('Failed to fetch'), {
      online: false,
      attempts: 999,
    })
    expect(r.action).toBe(DRAIN_ACTION.RETRY)
  })

  it('defaults to online and no prior attempts', () => {
    expect(decideDrainOutcome(new Error(MAPPED_GENERIC_ERROR)).action).toBe(DRAIN_ACTION.RETRY)
    expect(decideDrainOutcome(new Error('Not found.')).action).toBe(DRAIN_ACTION.QUARANTINE)
  })
})

// ── the user-facing line ────────────────────────────────────────────────────

describe('quarantineNotice', () => {
  it('uses the singular for one op', () => {
    expect(quarantineNotice(1)).toContain('A change you made offline')
  })

  it('counts the rest', () => {
    expect(quarantineNotice(3)).toContain('3 changes you made offline')
  })

  it('always says the changes were set aside, never that they were lost', () => {
    // The op is moved to the quarantine, not dropped; the copy must not imply
    // the data is gone.
    for (const n of [1, 2, 5]) expect(quarantineNotice(n)).toContain('set aside')
  })
})
