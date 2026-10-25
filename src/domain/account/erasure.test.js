import { describe, expect, it } from 'vitest'

import { erasureStatus, formatScheduledFor } from './erasure.js'

describe('erasureStatus', () => {
  it('treats a missing request as idle', () => {
    expect(erasureStatus(null)).toBe('idle')
    expect(erasureStatus(undefined)).toBe('idle')
  })

  it('treats a live pending row as scheduled', () => {
    expect(
      erasureStatus({
        requested_at: '2026-10-22T00:00:00Z',
        scheduled_for: '2026-11-21T00:00:00Z',
        cancelled_at: null,
        completed_at: null,
      }),
    ).toBe('scheduled')
  })

  it('treats a cancelled row as idle — nothing is pending', () => {
    expect(
      erasureStatus({
        scheduled_for: '2026-11-21T00:00:00Z',
        cancelled_at: '2026-10-23T00:00:00Z',
        completed_at: null,
      }),
    ).toBe('idle')
  })

  it('treats a completed row as idle', () => {
    expect(
      erasureStatus({
        scheduled_for: '2026-11-21T00:00:00Z',
        cancelled_at: null,
        completed_at: '2026-11-21T00:00:00Z',
      }),
    ).toBe('idle')
  })
})

describe('formatScheduledFor', () => {
  it('returns an empty string for a missing value', () => {
    expect(formatScheduledFor(null)).toBe('')
    expect(formatScheduledFor(undefined)).toBe('')
    expect(formatScheduledFor('')).toBe('')
  })

  it('formats a parseable ISO timestamp into a local string', () => {
    const iso = '2026-11-21T12:00:00Z'
    const result = formatScheduledFor(iso)
    expect(result).toBe(new Date(iso).toLocaleString())
    expect(result).not.toBe(iso)
  })

  it('falls back to the raw string when the value cannot be parsed', () => {
    expect(formatScheduledFor('not-a-date')).toBe('not-a-date')
  })
})
