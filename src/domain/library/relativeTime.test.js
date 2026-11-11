// Characterization tests for the notifications feed's relative-time formatter.
// Specified by: features/notifications.feature (reverse-chronological feed).
//
// Every assertion runs against a fixed clock: `relativeTime` once read
// Date.now() internally, which made the bucket boundaries unassertable and the
// module a flake source. `now` is now an argument with a production default.

import { describe, it, expect } from 'vitest'

import { relativeTime } from './relativeTime.js'

const NOW = Date.parse('2026-11-11T12:00:00.000Z')
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** ISO stamp `ms` before NUM. */
const ago = (ms) => new Date(NOW - ms).toISOString()

describe('relativeTime', () => {
  it('formats each bucket against the supplied clock', () => {
    expect(relativeTime(ago(0), NOW)).toBe('just now')
    expect(relativeTime(ago(1 * MINUTE), NOW)).toBe('1m ago')
    expect(relativeTime(ago(59 * MINUTE), NOW)).toBe('59m ago')
    expect(relativeTime(ago(1 * HOUR), NOW)).toBe('1h ago')
    expect(relativeTime(ago(2 * HOUR), NOW)).toBe('2h ago')
    expect(relativeTime(ago(3 * DAY), NOW)).toBe('3d ago')
  })

  it('falls back to the ISO date past a week', () => {
    expect(relativeTime(ago(8 * DAY), NOW)).toBe(new Date(NOW - 8 * DAY).toISOString().slice(0, 10))
  })

  it('clamps a future timestamp to "just now"', () => {
    expect(relativeTime(new Date(NOW + 5000).toISOString(), NOW)).toBe('just now')
  })

  it('returns an empty string for unparseable input', () => {
    expect(relativeTime('not-a-date', NOW)).toBe('')
    expect(relativeTime('', NOW)).toBe('')
  })

  it('is not a function of the wall clock when `now` is supplied', () => {
    // The same input and clock give the same answer regardless of when the
    // suite runs — the property the injected clock exists to guarantee.
    const iso = new Date(NOW - 2 * HOUR).toISOString()
    expect(relativeTime(iso, NOW)).toBe('2h ago')
    expect(relativeTime(iso, NOW)).toBe('2h ago')
  })

  it('defaults `now` to Date.now()', () => {
    expect(relativeTime(new Date().toISOString())).toBe('just now')
  })
})
