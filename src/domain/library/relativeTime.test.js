// Characterization tests for the notifications-feed relative-time formatter.
// The clock is injected (`relativeTime(iso, now)`), so every bucket boundary
// below is a fixed instant and nothing here races real time.

import { describe, it, expect, vi } from 'vitest'

import { relativeTime } from './relativeTime.js'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

// One fixed "now" for the whole file.
const NOW = Date.parse('2026-11-14T12:00:00Z')
const ago = (ms) => new Date(NOW - ms).toISOString()

describe('relativeTime', () => {
  it('reads "just now" under a minute, and clamps the future to it', () => {
    expect(relativeTime(ago(0), NOW)).toBe('just now')
    expect(relativeTime(ago(MINUTE - 1), NOW)).toBe('just now')
    expect(relativeTime(new Date(NOW + 5000).toISOString(), NOW)).toBe('just now')
  })

  it('counts minutes under an hour', () => {
    expect(relativeTime(ago(MINUTE), NOW)).toBe('1m ago')
    expect(relativeTime(ago(59 * MINUTE), NOW)).toBe('59m ago')
  })

  it('counts hours under a day', () => {
    expect(relativeTime(ago(HOUR), NOW)).toBe('1h ago')
    expect(relativeTime(ago(DAY - 1), NOW)).toBe('23h ago')
  })

  it('counts days under a week', () => {
    expect(relativeTime(ago(DAY), NOW)).toBe('1d ago')
    expect(relativeTime(ago(WEEK - 1), NOW)).toBe('6d ago')
  })

  it('falls back to the ISO date once a week old', () => {
    expect(relativeTime(ago(WEEK), NOW)).toBe(new Date(NOW - WEEK).toISOString().slice(0, 10))
    expect(relativeTime(ago(8 * DAY), NOW)).toBe(new Date(NOW - 8 * DAY).toISOString().slice(0, 10))
  })

  it('returns an empty string for unparseable input', () => {
    expect(relativeTime('not-a-date', NOW)).toBe('')
    expect(relativeTime('', NOW)).toBe('')
  })

  it('never reads the clock itself — the caller injects `now`', () => {
    // The formatter used to read Date.now() internally, so a bucket assertion
    // was a race against real time. What this pins is the ABSENCE of that read:
    // a default reappearing would call Date.now() and fail here.
    const spy = vi.spyOn(Date, 'now')
    try {
      expect(relativeTime(ago(MINUTE), NOW)).toBe('1m ago')
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
})
