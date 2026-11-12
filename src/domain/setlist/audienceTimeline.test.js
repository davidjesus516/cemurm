import { describe, expect, it } from 'vitest'

import { buildAudienceTimeline, formatOffset } from './audienceTimeline.js'

// features/export-and-sharing.feature:137 — "I see song titles and performance
// times in order". The payload from 0049 carries a duration per song, so the
// performance time of each row is the running sum of the durations before it.
describe('buildAudienceTimeline', () => {
  it('accumulates start times in setlist order', () => {
    const { rows, totalSeconds, exact } = buildAudienceTimeline([
      { position: 1, title: 'Way Maker', artist: 'Sinach', durationSeconds: 240 },
      { position: 2, title: 'Oceans', artist: 'Hillsong UNITED', durationSeconds: 300 },
    ])

    expect(rows.map((r) => r.startSeconds)).toEqual([0, 240])
    expect(totalSeconds).toBe(540)
    expect(exact).toBe(true)
  })

  it('keeps the start of a row whose own duration is unknown, and marks later rows inexact', () => {
    const { rows, totalSeconds, exact } = buildAudienceTimeline([
      { position: 1, title: 'A', durationSeconds: 120 },
      { position: 2, title: 'B', durationSeconds: null },
      { position: 3, title: 'C', durationSeconds: 60 },
    ])

    expect(rows.map((r) => r.startSeconds)).toEqual([0, 120, 120])
    expect(rows.map((r) => r.exact)).toEqual([true, true, false])
    expect(totalSeconds).toBe(180)
    expect(exact).toBe(false)
  })

  it('treats non-numeric, zero and negative durations as unknown', () => {
    const { rows } = buildAudienceTimeline([
      { position: 1, title: 'A', durationSeconds: '240' },
      { position: 2, title: 'B', durationSeconds: 0 },
      { position: 3, title: 'C', durationSeconds: -30 },
    ])

    expect(rows.every((r) => r.durationSeconds === null)).toBe(true)
  })

  it('returns an empty timeline for an empty setlist', () => {
    expect(buildAudienceTimeline([])).toEqual({ rows: [], totalSeconds: 0, exact: true })
    expect(buildAudienceTimeline()).toEqual({ rows: [], totalSeconds: 0, exact: true })
  })

  it('preserves the position the server sent, not the array index', () => {
    const { rows } = buildAudienceTimeline([
      { position: 4, title: 'A', durationSeconds: 60 },
      { position: 7, title: 'B', durationSeconds: 60 },
    ])

    expect(rows.map((r) => r.position)).toEqual([4, 7])
  })
})

describe('formatOffset', () => {
  it('renders under an hour as m:ss', () => {
    expect(formatOffset(0)).toBe('0:00')
    expect(formatOffset(240)).toBe('4:00')
    expect(formatOffset(65)).toBe('1:05')
  })

  it('renders an hour or more as h:mm:ss', () => {
    expect(formatOffset(3600)).toBe('1:00:00')
    expect(formatOffset(3930)).toBe('1:05:30')
  })

  it('renders an unknown or negative offset as a dash, never as 0:00', () => {
    expect(formatOffset(null)).toBe('—')
    expect(formatOffset(undefined)).toBe('—')
    expect(formatOffset(-1)).toBe('—')
  })
})
