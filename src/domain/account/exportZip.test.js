// Tests for the ZIP assembly: exactly two entries, and the JSON entry must
// round-trip to the very document the builder produces.
// Specified by: features/account-data-export-and-erasure.feature:10-14, :25-28.

import { describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'

import { buildExportDocument, buildExportSummary } from './exportBundle.js'
import { buildExportZip } from './exportZip.js'

const ENVELOPE = {
  schema_version: 'cemurm.account-export/1',
  exported_at: '2026-10-22T22:16:16.690Z',
  user_id: '10000000-0000-0000-0000-000000000001',
  account: { id: '10000000-0000-0000-0000-000000000001', display_name: 'Ana' },
  repertoire: {
    songs: [{ id: 's1', title: 'Amazing Grace', artist: 'John Newton' }],
    versions: [{ id: 'v1', song_id: 's1', number: 1 }],
    charts: [{ id: 'c1', song_id: 's1', format: 'chordpro' }],
    tags: [],
  },
  setlists: [{ id: 'sl1', name: 'Sunday Morning', created_at: '2026-10-04T09:00:00.000Z', items: [] }],
  activity: { follows: [], notifications: [], feedback: [] },
  archive: { audit: [], moderation: [] },
}

const JSON_ENTRY = 'cemurm-export-2026-10-22.json'
const SUMMARY_ENTRY = 'summary.md'

describe('buildExportZip', () => {
  it('names the bundle after the export date', () => {
    expect(buildExportZip(ENVELOPE).name).toBe('cemurm-export-2026-10-22.zip')
  })

  it('contains exactly the JSON document and the Markdown summary', () => {
    const entries = unzipSync(buildExportZip(ENVELOPE).bytes)
    expect(Object.keys(entries).sort()).toEqual([JSON_ENTRY, SUMMARY_ENTRY].sort())
  })

  it('round-trips the JSON entry to the exported document', () => {
    const entries = unzipSync(buildExportZip(ENVELOPE).bytes)
    const parsed = JSON.parse(strFromU8(entries[JSON_ENTRY]))
    expect(parsed).toEqual(buildExportDocument(ENVELOPE))
    expect(parsed.repertoire.songs[0].title).toBe('Amazing Grace')
  })

  it('stores the readable summary as summary.md', () => {
    const entries = unzipSync(buildExportZip(ENVELOPE).bytes)
    expect(strFromU8(entries[SUMMARY_ENTRY])).toBe(buildExportSummary(ENVELOPE))
  })

  it('builds a valid bundle for an empty account', () => {
    const bundle = buildExportZip({})
    const entries = unzipSync(bundle.bytes)
    expect(Object.keys(entries)).toHaveLength(2)
    // The empty envelope carries no exported_at, so the JSON entry is named
    // after the current day. Derive the key from the bundle instead of pinning
    // a date, which would make this test fail every day after it was written.
    const jsonEntry = bundle.name.replace(/\.zip$/, '.json')
    expect(JSON.parse(strFromU8(entries[jsonEntry])).repertoire.songs).toEqual([])
    expect(strFromU8(entries[SUMMARY_ENTRY])).toContain('| Songs | 0 |')
  })
})
