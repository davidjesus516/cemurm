import { describe, expect, it } from 'vitest'

import {
  durationTrend,
  mostUsedSongs,
  performanceTimeline,
  repertoireGrowth,
  songPopularity,
  untouchedSongs,
} from './personalAnalytics.js'

const song = (id, over = {}) => ({
  id,
  title: `Song ${id}`,
  genre: 'gospel',
  createdAt: '2026-06-01T00:00:00.000Z',
  ...over,
})

describe('mostUsedSongs', () => {
  it('counts each setlist once, ranks descending and breaks ties by song id', () => {
    const rows = mostUsedSongs([
      { id: 's1', itemIds: ['a', 'b', 'a'] }, // repeated a counts once in this setlist
      { id: 's2', itemIds: ['b', 'c'] },
      { id: 's3', itemIds: ['b', 'a'] },
    ])
    expect(rows).toEqual([
      { songId: 'b', count: 3 },
      { songId: 'a', count: 2 },
      { songId: 'c', count: 1 },
    ])
  })

  it('returns an empty ranking when there are no setlists', () => {
    expect(mostUsedSongs([])).toEqual([])
  })
})

describe('repertoireGrowth', () => {
  it('buckets songs into weeks with a baseline and flags the peak week', () => {
    const now = new Date('2026-07-01T00:00:00.000Z')
    const rows = repertoireGrowth([
      song('old', { createdAt: '2026-05-01T00:00:00.000Z' }), // before the window → baseline
      song('a', { createdAt: '2026-06-03T00:00:00.000Z' }), // week of Jun 01
      song('b', { createdAt: '2026-06-04T00:00:00.000Z' }),
      song('c', { createdAt: '2026-06-16T00:00:00.000Z' }), // week of Jun 15
      song('bad', { createdAt: 'not-a-date' }),
    ], now, 4)

    expect(rows.map((r) => r.weekStart)).toEqual([
      '2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22',
    ])
    expect(rows.map((r) => r.added)).toEqual([2, 0, 1, 0])
    expect(rows.map((r) => r.cumulative)).toEqual([3, 3, 4, 4])
    expect(rows.map((r) => r.peak)).toEqual([true, false, false, false])
  })

  it('breaks a peak tie at the earliest week', () => {
    const now = new Date('2026-07-01T00:00:00.000Z')
    const rows = repertoireGrowth([
      song('a', { createdAt: '2026-06-02T00:00:00.000Z' }),
      song('b', { createdAt: '2026-06-20T00:00:00.000Z' }),
    ], now, 4)
    expect(rows.filter((r) => r.peak).map((r) => r.weekStart)).toEqual(['2026-06-01'])
  })
})

describe('untouchedSongs', () => {
  it('returns songs never placed on a setlist with their added date', () => {
    const songs = [song('a'), song('b'), song('c', { genre: 'classical' })]
    const rows = untouchedSongs(songs, [{ id: 's1', itemIds: ['a'] }])
    expect(rows.map((s) => s.id)).toEqual(['b', 'c'])
    expect(rows[0].createdAt).toBe('2026-06-01T00:00:00.000Z')
  })

  it('filters by genre (case-insensitive) and by age in months', () => {
    const now = new Date('2026-07-01T00:00:00.000Z')
    const songs = [
      song('old-gospel', { genre: 'Gospel', createdAt: '2025-01-01T00:00:00.000Z' }),
      song('new-gospel', { genre: 'gospel', createdAt: '2026-06-01T00:00:00.000Z' }),
      song('old-classical', { genre: 'classical', createdAt: '2025-01-01T00:00:00.000Z' }),
    ]
    expect(untouchedSongs(songs, [], { genre: 'gospel' }).map((s) => s.id))
      .toEqual(['old-gospel', 'new-gospel'])
    expect(untouchedSongs(songs, [], { olderThanMonths: 6, now }).map((s) => s.id))
      .toEqual(['old-gospel', 'old-classical'])
    expect(untouchedSongs(songs, [], { genre: 'gospel', olderThanMonths: 6, now }).map((s) => s.id))
      .toEqual(['old-gospel'])
  })
})

describe('songPopularity', () => {
  it('counts only played items across performances and ranks them', () => {
    const rows = songPopularity([
      { id: 'p1', items: [{ songId: 'a', state: 'played' }, { songId: 'b', state: 'skipped' }] },
      { id: 'p2', items: [{ songId: 'a', state: 'played' }, { songId: 'c', state: 'played' }] },
      { id: 'p3', items: [{ songId: 'b', state: 'off_setlist' }] },
    ])
    expect(rows).toEqual([
      { songId: 'a', count: 2 },
      { songId: 'c', count: 1 },
    ])
  })

  it('returns an empty chart when nothing was played', () => {
    expect(songPopularity([])).toEqual([])
  })
})

describe('durationTrend', () => {
  it('averages known setlist durations per month and keeps empty months', () => {
    const now = new Date('2026-06-15T00:00:00.000Z')
    const rows = durationTrend([
      { id: 's1', createdAt: '2026-04-01T00:00:00.000Z', songs: [{ durationSeconds: 200 }, { durationSeconds: 100 }] },
      { id: 's2', createdAt: '2026-04-10T00:00:00.000Z', songs: [{ durationSeconds: 300 }] },
      { id: 's3', createdAt: '2026-06-01T00:00:00.000Z', songs: [{ durationSeconds: null }] },
    ], now, 3)

    expect(rows.map((r) => r.month)).toEqual(['2026-04', '2026-05', '2026-06'])
    expect(rows[0]).toMatchObject({ averageSeconds: 300, sampleSize: 2 }) // (300 + 300) / 2
    expect(rows[1]).toMatchObject({ averageSeconds: 0, sampleSize: 0 })
    expect(rows[2]).toMatchObject({ averageSeconds: 0, sampleSize: 0 })
  })

  it('rounds the average setlist total to the nearest second', () => {
    const now = new Date('2026-06-15T00:00:00.000Z')
    const rows = durationTrend([
      { id: 's1', createdAt: '2026-06-01T00:00:00.000Z', songs: [{ durationSeconds: 100 }] },
      { id: 's2', createdAt: '2026-06-02T00:00:00.000Z', songs: [{ durationSeconds: 101 }] },
    ], now, 1)
    expect(rows[0].averageSeconds).toBe(101) // 100.5 rounded
  })
})

describe('performanceTimeline', () => {
  const gigs = [
    { id: 'g1', name: 'Old', orgId: 'o1', venueId: 'v1', scheduledAt: '2026-01-01T00:00:00.000Z', performance: { performedAt: '2026-01-02T00:00:00.000Z', items: [{ songId: 'a', state: 'played' }, { songId: 'b', state: 'skipped' }] } },
    { id: 'g2', name: 'New', orgId: 'o2', venueId: 'v2', scheduledAt: '2026-05-01T00:00:00.000Z', performance: { performedAt: '2026-05-02T00:00:00.000Z', items: [{ songId: 'a', state: 'played' }] } },
    { id: 'g3', name: 'Planned', orgId: 'o1', venueId: 'v1', scheduledAt: '2026-06-01T00:00:00.000Z', performance: null },
  ]

  it('keeps performed gigs only, newest first, with a song count', () => {
    const rows = performanceTimeline(gigs)
    expect(rows.map((g) => g.id)).toEqual(['g2', 'g1'])
    expect(rows[0].songCount).toBe(1)
    expect(rows[1].songCount).toBe(2)
  })

  it('filters by org, venue and month', () => {
    expect(performanceTimeline(gigs, { orgId: 'o1' }).map((g) => g.id)).toEqual(['g1'])
    expect(performanceTimeline(gigs, { venueId: 'v2' }).map((g) => g.id)).toEqual(['g2'])
    expect(performanceTimeline(gigs, { month: '2026-05' }).map((g) => g.id)).toEqual(['g2'])
  })

  // features/analytics-and-insights.feature:58 — "filter by org, venue type,
  // or month". The venue type is joined from venues[].type by the page; the
  // filter itself is pure. A gig whose venue has no type must stay visible in
  // the unfiltered timeline, and simply not match a named type.
  it('filters by venue type without dropping untyped venues under the default filter', () => {
    const typed = [
      { ...gigs[0], venueType: 'Church' },
      { ...gigs[1], venueType: 'Concert Hall' },
      {
        id: 'g4', name: 'Untyped', orgId: 'o1', venueId: null, venueType: '',
        performance: { performedAt: '2025-12-01T00:00:00.000Z', items: [] },
      },
    ]
    expect(performanceTimeline(typed).map((g) => g.id)).toEqual(['g2', 'g1', 'g4'])
    expect(performanceTimeline(typed, { venueType: 'Church' }).map((g) => g.id)).toEqual(['g1'])
    expect(performanceTimeline(typed, { venueType: 'Concert Hall' }).map((g) => g.id)).toEqual(['g2'])
  })
})
