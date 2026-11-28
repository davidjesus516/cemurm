import { describe, expect, it } from 'vitest'

import {
  distributionBy,
  hasUsableCreatedAt,
  recentAdditions,
  songsInDateRange,
  trendingSongs,
} from './repertoireInsights.js'

const song = (id, over = {}) => ({
  id,
  title: `Song ${id}`,
  key: 'G',
  genre: 'gospel',
  branchId: 'b1',
  createdAt: '2026-06-01T00:00:00.000Z',
  ...over,
})

describe('distributionBy', () => {
  it('counts, sorts descending and computes percentages', () => {
    const rows = distributionBy(['gospel', 'classical', 'gospel', 'folk', ''])
    expect(rows).toEqual([
      { label: 'gospel', count: 2, percent: 40 },
      { label: 'classical', count: 1, percent: 20 },
      { label: 'folk', count: 1, percent: 20 },
      { label: 'Unknown', count: 1, percent: 20 },
    ])
  })

  it('returns an empty distribution for no values', () => {
    expect(distributionBy([])).toEqual([])
  })
})

describe('recentAdditions', () => {
  it('sorts newest first, limits to the last N and keeps the added date', () => {
    const rows = recentAdditions([
      song('a', { createdAt: '2026-01-01T00:00:00.000Z' }),
      song('c', { createdAt: '2026-06-01T00:00:00.000Z' }),
      song('b', { createdAt: '2026-03-01T00:00:00.000Z' }),
    ], 2)
    expect(rows.map((s) => s.id)).toEqual(['c', 'b'])
    expect(rows[0].createdAt).toBe('2026-06-01T00:00:00.000Z')
  })
})

describe('trendingSongs', () => {
  it('groups additions by title since a date and lists distinct branches', () => {
    const rows = trendingSongs([
      song('s1', { title: 'Amazing Grace', branchId: 'b1', createdAt: '2026-06-03T00:00:00.000Z' }),
      song('s2', { title: 'Amazing Grace', branchId: 'b2', createdAt: '2026-06-05T00:00:00.000Z' }),
      song('s3', { title: 'Amazing Grace', branchId: 'b1', createdAt: '2026-06-09T00:00:00.000Z' }),
      song('s4', { title: 'Wonderwall', branchId: 'b3', createdAt: '2026-06-10T00:00:00.000Z' }),
      song('s5', { title: 'Old Song', branchId: 'b1', createdAt: '2025-01-01T00:00:00.000Z' }),
    ], { since: '2026-06-01T00:00:00.000Z', limit: 10 })

    expect(rows).toEqual([
      { songId: 's1', title: 'Amazing Grace', count: 3, branches: ['b1', 'b2'] },
      { songId: 's4', title: 'Wonderwall', count: 1, branches: ['b3'] },
    ])
  })

  it('returns an empty list when there are no recent additions', () => {
    expect(trendingSongs([], { since: '2026-06-01T00:00:00.000Z' })).toEqual([])
  })
})

// features/analytics-and-insights.feature:90 — "filter by date range to see
// growth trends per branch". The page has songs[].createdAt already; this pure
// helper applies an inclusive from/to day boundary. An undated song stays in
// the all-dates default and is simply not placeable in a named range — never
// a crash, never a silent drop of the entire library.
describe('songsInDateRange', () => {
  it('filters by inclusive from/to days, keeps undated songs under the all-dates default, and never crashes', () => {
    const songs = [
      song('before', { createdAt: '2026-05-31T23:00:00.000Z' }),
      song('onFrom', { createdAt: '2026-06-01T00:00:00.000Z' }),
      song('inside', { createdAt: '2026-06-15T12:00:00.000Z' }),
      song('onTo', { createdAt: '2026-06-30T23:59:59.000Z' }),
      song('after', { createdAt: '2026-07-01T00:00:00.000Z' }),
      song('undated', { createdAt: '' }),
    ]

    // Default / all dates: nothing dropped, including the undated row.
    expect(songsInDateRange(songs, {}).map((s) => s.id))
      .toEqual(['before', 'onFrom', 'inside', 'onTo', 'after', 'undated'])

    // Inclusive boundaries on both ends; the undated song cannot be placed.
    expect(songsInDateRange(songs, { from: '2026-06-01', to: '2026-06-30' }).map((s) => s.id))
      .toEqual(['onFrom', 'inside', 'onTo'])

    // Open-ended from range: the undated song is still excluded honestly.
    expect(songsInDateRange(songs, { from: '2026-06-01' }).map((s) => s.id))
      .toEqual(['onFrom', 'inside', 'onTo', 'after'])

    // hasUsableCreatedAt distinguishes the genuinely undated row for the UI note.
    expect(hasUsableCreatedAt(songs[5])).toBe(false)
    expect(hasUsableCreatedAt(songs[1])).toBe(true)
  })
})
