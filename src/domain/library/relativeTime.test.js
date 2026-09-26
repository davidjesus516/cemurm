// Unit tests for relativeTime, made deterministic by ADR 0002 refactor 5
// (inject the clock).
//
// Specified by: this task (PR 1b) as the source of truth for the assertions
// below. features/notifications.feature describes the FEED behaviour
// ("reverse-chronological relative time") but pins no threshold, and every
// other reference (analytics-and-insights, authentication-and-profiles,
// repertoire-mgmt, user-onboarding) only mentions relative time in passing.
// Before the split the function read Date.now() inside its own body, so no
// assertion at a bucket boundary was reproducible.
//
// Every call passes an explicit `now`. The thresholds below are read off the
// implementation: MINUTE_MS / HOUR_MS / DAY_MS / WEEK_MS with STRICT `<`
// comparisons, which puts each boundary instant in the NEXT bucket.

import { describe, it, expect } from 'vitest'

import { relativeTime } from './relativeTime.js'

// ── fixtures ────────────────────────────────────────────────────────────────

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS

// A fixed clock, so every assertion is reproducible. 2033-05-18T07:33:20Z.
const NOW = 2_000_000_000_000

/** An ISO timestamp `ms` milliseconds BEFORE the fixed clock. */
const ago = (ms) => new Date(NOW - ms).toISOString()

/** The YYYY-MM-DD slice the older-than-a-week branch returns. */
const dateOf = (ms) => new Date(NOW - ms).toISOString().slice(0, 10)

// ── the "just now" bucket: diff < 1 minute ───────────────────────────────────

describe('relativeTime — under a minute', () => {
  it('reads anything inside the first minute as "just now"', () => {
    expect(relativeTime(ago(0), NOW)).toBe('just now')
    expect(relativeTime(ago(1), NOW)).toBe('just now')
    expect(relativeTime(ago(59_000), NOW)).toBe('just now')
  })

  it('switches to "1m ago" at exactly one minute, not one millisecond before', () => {
    // Strict `<`: 59_999 is still "just now", 60_000 is "1m ago".
    expect(relativeTime(ago(MINUTE_MS - 1), NOW)).toBe('just now')
    expect(relativeTime(ago(MINUTE_MS), NOW)).toBe('1m ago')
  })

  it('clamps a FUTURE timestamp to "just now"', () => {
    // `Math.max(0, now - then)` floors the diff at 0 for clock skew.
    expect(relativeTime(new Date(NOW + 5_000).toISOString(), NOW)).toBe('just now')
    expect(relativeTime(new Date(NOW + 10 * 365 * DAY_MS).toISOString(), NOW)).toBe('just now')
  })
})

// ── the minutes bucket: 1 minute <= diff < 1 hour ───────────────────────────

describe('relativeTime — minutes', () => {
  it('floors the elapsed minutes', () => {
    expect(relativeTime(ago(1 * MINUTE_MS), NOW)).toBe('1m ago')
    expect(relativeTime(ago(2 * MINUTE_MS), NOW)).toBe('2m ago')
    expect(relativeTime(ago(45 * MINUTE_MS), NOW)).toBe('45m ago')
  })

  it('never rolls over to 60m, because the hour branch catches it first', () => {
    expect(relativeTime(ago(59 * MINUTE_MS), NOW)).toBe('59m ago')
    expect(relativeTime(ago(HOUR_MS - 1), NOW)).toBe('59m ago')
  })

  it('switches to "1h ago" at exactly one hour', () => {
    expect(relativeTime(ago(HOUR_MS), NOW)).toBe('1h ago')
  })
})

// ── the hours bucket: 1 hour <= diff < 1 day ────────────────────────────────

describe('relativeTime — hours', () => {
  it('floors the elapsed hours', () => {
    expect(relativeTime(ago(1 * HOUR_MS), NOW)).toBe('1h ago')
    expect(relativeTime(ago(2 * HOUR_MS), NOW)).toBe('2h ago')
    expect(relativeTime(ago(12 * HOUR_MS), NOW)).toBe('12h ago')
  })

  it('never rolls over to 24h, because the day branch catches it first', () => {
    expect(relativeTime(ago(23 * HOUR_MS), NOW)).toBe('23h ago')
    expect(relativeTime(ago(DAY_MS - 1000), NOW)).toBe('23h ago')
  })

  it('switches to "1d ago" at exactly one day', () => {
    expect(relativeTime(ago(DAY_MS), NOW)).toBe('1d ago')
  })
})

// ── the days bucket: 1 day <= diff < 7 days ─────────────────────────────────

describe('relativeTime — days', () => {
  it('floors the elapsed days', () => {
    expect(relativeTime(ago(1 * DAY_MS), NOW)).toBe('1d ago')
    expect(relativeTime(ago(3 * DAY_MS), NOW)).toBe('3d ago')
    expect(relativeTime(ago(6 * DAY_MS), NOW)).toBe('6d ago')
  })

  it('stays in days right up to the week boundary', () => {
    expect(relativeTime(ago(WEEK_MS - HOUR_MS), NOW)).toBe('6d ago')
    expect(relativeTime(ago(WEEK_MS - 1), NOW)).toBe('6d ago')
  })

  it('switches to the ISO date at exactly seven days', () => {
    expect(relativeTime(ago(WEEK_MS), NOW)).toBe(dateOf(WEEK_MS))
  })
})

// ── the older bucket: diff >= 7 days ────────────────────────────────────────

describe('relativeTime — older than a week', () => {
  it('returns the YYYY-MM-DD slice of the TIMESTAMP, not of now', () => {
    // The slice comes from `then`, not `now` — so an old row shows its own
    // date. This is the "old rows stop pretending to be recent" rule.
    expect(relativeTime(ago(8 * DAY_MS), NOW)).toBe(dateOf(8 * DAY_MS))
    expect(relativeTime(ago(30 * DAY_MS), NOW)).toBe(dateOf(30 * DAY_MS))
    expect(relativeTime(ago(400 * DAY_MS), NOW)).toBe(dateOf(400 * DAY_MS))
  })

  it('ignores the clock entirely past a week', () => {
    // Same timestamp, three different clocks: only the timestamp can matter.
    const old = ago(10 * DAY_MS)
    expect(relativeTime(old, NOW)).toBe(dateOf(10 * DAY_MS))
    expect(relativeTime(old, NOW + DAY_MS)).toBe(dateOf(10 * DAY_MS))
    expect(relativeTime(old, NOW + 5 * DAY_MS)).toBe(dateOf(10 * DAY_MS))
  })
})

// ── unparseable and coerced input ───────────────────────────────────────────

describe('relativeTime — unparseable input', () => {
  it('returns an empty string for a date the platform cannot parse', () => {
    expect(relativeTime('not-a-date', NOW)).toBe('')
    expect(relativeTime('', NOW)).toBe('')
    expect(relativeTime(undefined, NOW)).toBe('')
    expect(relativeTime('2026-13-45T99:99:99Z', NOW)).toBe('')
  })

  it('returns the epoch date for null, because new Date(null) is a real date', () => {
    // FINDING: the NaN guard only catches an INVALID date. `new Date(null)` is
    // the epoch, which is perfectly parseable, so a null timestamp renders as
    // "1970-01-01" instead of the empty string. `undefined` DOES hit the guard,
    // because `new Date(undefined)` is an Invalid Date.
    expect(relativeTime(null, NOW)).toBe('1970-01-01')
    expect(relativeTime(undefined, NOW)).toBe('')
  })

  it('accepts a date-only string and a bare epoch number by coercion', () => {
    // `new Date(...)` is given the value directly, so both are legal input and
    // neither is a documented case.
    expect(relativeTime('2026-09-20', NOW)).toBe('2026-09-20')
    expect(relativeTime(NOW, NOW)).toBe('just now')
  })
})

// ── the injected clock is required by convention, not by validation ─────────

describe('relativeTime — the injected clock', () => {
  it('returns the ISO date for a parseable timestamp when `now` is omitted', () => {
    // FINDING: there is no guard on `now`. Omitting it makes
    // `now - then` NaN, every `NaN < x` comparison is false, and control falls
    // through to the FINAL return — the oldest bucket. So a caller that
    // forgets the new argument silently renders every row as a bare date
    // instead of failing loudly. The signature is required by convention only.
    expect(relativeTime(ago(0))).toBe(dateOf(0))
    expect(relativeTime(ago(10 * DAY_MS))).toBe(dateOf(10 * DAY_MS))
    expect(relativeTime(ago(0), undefined)).toBe(dateOf(0))
    expect(relativeTime(ago(0), 'not-a-number')).toBe(dateOf(0))
  })

  it('reads a null clock as "just now", for a different reason', () => {
    // FINDING: `null - then` is a large NEGATIVE number, `Math.max(0, …)`
    // floors it to 0, and 0 is the first bucket. Same missing-argument class,
    // opposite symptom from the NaN case above.
    expect(relativeTime(ago(0), null)).toBe('just now')
  })

  it('is fully determined by its two arguments, with no other input', () => {
    // The point of the refactor: same inputs, same output, every time.
    const stamp = ago(3 * HOUR_MS + 17 * MINUTE_MS)
    expect(relativeTime(stamp, NOW)).toBe('3h ago')
    expect(relativeTime(stamp, NOW)).toBe(relativeTime(stamp, NOW))
  })

  it('does not mutate or memoize anything', () => {
    // Advancing the clock a day advances the reading a day — there is no
    // cached result between calls.
    const stamp = ago(2 * DAY_MS)
    const first = relativeTime(stamp, NOW)
    expect(first).toBe('2d ago')
    expect(relativeTime(stamp, NOW + DAY_MS)).toBe('3d ago')
    expect(relativeTime(stamp, NOW)).toBe(first)
  })
})
