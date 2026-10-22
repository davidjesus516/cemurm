// Tests for the pure export document/summary/filename builders.
// Specified by: features/account-data-export-and-erasure.feature:10-14, :25-28
// and odd/tasks/account-data-export-and-erasure.md (WU2). No jsdom: these are
// plain functions, the component that calls them is not rendered here.

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildExportDocument,
  buildExportSummary,
  exportFileName,
} from './exportBundle.js'

const ENVELOPE = {
  schema_version: 'cemurm.account-export/1',
  exported_at: '2026-10-22T22:16:16.690Z',
  user_id: '10000000-0000-0000-0000-000000000001',
  account: { id: '10000000-0000-0000-0000-000000000001', display_name: 'Ana' },
  preferences: { transpose_offset: 2, capo: 0 },
  notification_preferences: { push_enabled: true },
  memberships: [
    { id: 'm1', org_name: 'Demo Org', role: 'owner', joined_at: '2026-01-01T00:00:00.000Z' },
  ],
  repertoire: {
    songs: [
      {
        id: 's1',
        title: 'Amazing Grace',
        artist: 'John Newton',
        year: 1779,
        created_at: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 's2',
        title: 'Great Is Thy Faithfulness',
        artist: null,
        year: null,
        created_at: '2026-09-02T00:00:00.000Z',
      },
    ],
    versions: [{ id: 'v1', song_id: 's1', number: 1 }],
    charts: [{ id: 'c1', song_id: 's1', format: 'chordpro' }],
    tags: [{ id: 't1', name: 'worship' }],
  },
  collections: [
    { id: 'col1', name: 'Sunday', songs: [{ song_id: 's1' }, { song_id: 's2' }] },
  ],
  setlists: [
    {
      id: 'sl1',
      name: 'Sunday Morning',
      created_at: '2026-10-04T09:00:00.000Z',
      items: [{ song_id: 's1' }, { song_id: 's2' }],
    },
  ],
  annotations: [{ id: 'a1' }],
  comments: [{ id: 'cm1' }],
  practice_sessions: [
    {
      id: 'p1',
      song_id: 's1',
      instrument: 'guitar',
      started_at: '2026-10-18T18:00:00.000Z',
      ended_at: '2026-10-18T18:30:00.000Z',
    },
    {
      id: 'p2',
      song_id: 's2',
      instrument: null,
      started_at: '2026-10-20T19:00:00.000Z',
      ended_at: '2026-10-20T19:15:00.000Z',
    },
  ],
  gigs: [{ id: 'g1' }],
  performances: [{ id: 'perf1' }],
  public_contributions: [{ id: 'pub1' }],
  activity: {
    follows: [{ follower_id: 'u2' }],
    notifications: [{ id: 'n1' }],
    feedback: [{ id: 'f1' }],
  },
  archive: {
    audit: [{ id: 'au1' }],
    moderation: [{ id: 'mc1' }],
  },
}

const DOCUMENT_KEY_ORDER = [
  'schema_version',
  'exported_at',
  'user_id',
  'account',
  'preferences',
  'notification_preferences',
  'memberships',
  'repertoire',
  'collections',
  'setlists',
  'annotations',
  'comments',
  'practice_sessions',
  'gigs',
  'performances',
  'public_contributions',
  'activity',
  'archive',
]

describe('buildExportDocument', () => {
  it('keeps the identity fields unchanged', () => {
    const doc = buildExportDocument(ENVELOPE)
    expect(doc.schema_version).toBe('cemurm.account-export/1')
    expect(doc.exported_at).toBe('2026-10-22T22:16:16.690Z')
    expect(doc.user_id).toBe('10000000-0000-0000-0000-000000000001')
    expect(doc.account).toEqual(ENVELOPE.account)
  })

  it('orders the top-level keys canonically', () => {
    expect(Object.keys(buildExportDocument(ENVELOPE))).toEqual(DOCUMENT_KEY_ORDER)
  })

  it('orders the nested repertoire, activity and archive groups', () => {
    const doc = buildExportDocument(ENVELOPE)
    expect(Object.keys(doc.repertoire)).toEqual(['songs', 'versions', 'charts', 'tags'])
    expect(Object.keys(doc.activity)).toEqual(['follows', 'notifications', 'feedback'])
    expect(Object.keys(doc.archive)).toEqual(['audit', 'moderation'])
  })

  it('preserves the RPC array order', () => {
    const doc = buildExportDocument(ENVELOPE)
    expect(doc.repertoire.songs.map((song) => song.id)).toEqual(['s1', 's2'])
    expect(doc.setlists[0].items).toHaveLength(2)
  })

  it('never mutates the input envelope', () => {
    const snapshot = JSON.stringify(ENVELOPE)
    const deepFreeze = (value) => {
      if (value && typeof value === 'object') {
        Object.freeze(value)
        for (const key of Object.keys(value)) deepFreeze(value[key])
      }
      return value
    }
    deepFreeze(ENVELOPE)

    const doc = buildExportDocument(ENVELOPE)
    doc.repertoire.songs[0].title = 'Changed'

    expect(JSON.stringify(ENVELOPE)).toBe(snapshot)
    expect(ENVELOPE.repertoire.songs[0].title).toBe('Amazing Grace')
  })

  it('yields a well-formed document for an empty account', () => {
    const doc = buildExportDocument({})
    expect(Object.keys(doc)).toEqual(DOCUMENT_KEY_ORDER)
    for (const key of ['memberships', 'collections', 'setlists', 'annotations', 'comments',
      'practice_sessions', 'gigs', 'performances', 'public_contributions']) {
      expect(doc[key]).toEqual([])
    }
    expect(doc.repertoire).toEqual({ songs: [], versions: [], charts: [], tags: [] })
    expect(doc.activity).toEqual({ follows: [], notifications: [], feedback: [] })
    expect(doc.archive).toEqual({ audit: [], moderation: [] })
    expect(doc.schema_version).toBeNull()
  })
})

describe('buildExportSummary', () => {
  it('states the counts for every collection', () => {
    const summary = buildExportSummary(ENVELOPE)
    expect(summary).toContain('| Songs | 2 |')
    expect(summary).toContain('| Versions | 1 |')
    expect(summary).toContain('| Charts | 1 |')
    expect(summary).toContain('| Tags | 1 |')
    expect(summary).toContain('| Collections | 1 |')
    expect(summary).toContain('| Collection entries | 2 |')
    expect(summary).toContain('| Setlists | 1 |')
    expect(summary).toContain('| Setlist items | 2 |')
    expect(summary).toContain('| Practice sessions | 2 |')
    expect(summary).toContain('| Notifications | 1 |')
    expect(summary).toContain('| Audit events | 1 |')
    expect(summary).toContain('| Moderation cases | 1 |')
  })

  it('lists songs with their artist', () => {
    const summary = buildExportSummary(ENVELOPE)
    expect(summary).toContain('- Amazing Grace — John Newton (1779)')
    expect(summary).toContain('- Great Is Thy Faithfulness')
  })

  it('lists setlists with dates', () => {
    expect(buildExportSummary(ENVELOPE)).toContain('- Sunday Morning — 2026-10-04 (2 items)')
  })

  it('lists the latest practice sessions newest first', () => {
    const summary = buildExportSummary(ENVELOPE)
    const newest = summary.indexOf('2026-10-20 — Great Is Thy Faithfulness')
    const older = summary.indexOf('2026-10-18 — Amazing Grace (guitar) — 30 min')
    expect(newest).toBeGreaterThan(-1)
    expect(older).toBeGreaterThan(-1)
    expect(newest).toBeLessThan(older)
  })

  it('describes an empty account without throwing', () => {
    const summary = buildExportSummary({})
    expect(summary).toContain('| Songs | 0 |')
    expect(summary).toContain('_No songs in this export._')
    expect(summary).toContain('_No setlists in this export._')
    expect(summary).toContain('_No practice sessions in this export._')
  })

  it('keeps user titles on one line', () => {
    const summary = buildExportSummary({
      repertoire: { songs: [{ id: 's1', title: 'Line one\nLine two' }] },
    })
    expect(summary).toContain('- Line one Line two')
  })
})

describe('exportFileName', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('derives the calendar date from exported_at', () => {
    expect(exportFileName(ENVELOPE)).toBe('cemurm-export-2026-10-22.json')
  })

  it('falls back to today when exported_at is missing', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-04T12:00:00.000Z'))
    expect(exportFileName({})).toBe('cemurm-export-2026-05-04.json')
  })

  it('falls back to today when exported_at is unparseable', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-04T12:00:00.000Z'))
    expect(exportFileName({ exported_at: 'not-a-date' })).toBe('cemurm-export-2026-05-04.json')
  })
})
