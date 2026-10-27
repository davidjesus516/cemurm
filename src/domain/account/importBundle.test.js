// importBundle characterization: a real ZIP built by buildExportZip must
// round-trip, and every damaged/foreign shape must fail with one of the three
// documented messages. No fixture files: the bundle is produced in the test.

import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'

import { buildExportZip } from './exportZip.js'
import {
  DAMAGED,
  NOT_EXPORT,
  UNSUPPORTED_VERSION,
  parseImportBundle,
} from './importBundle.js'

const envelope = {
  schema_version: 'cemurm.account-export/1',
  exported_at: '2026-10-22T00:00:00.000Z',
  user_id: '30000000-0000-0000-0000-000000000902',
  preferences: { transpose_offset: 2, capo: 1 },
  notification_preferences: { push_enabled: false },
  repertoire: {
    songs: [{ id: 'song-1', title: 'Imported Song' }],
    versions: [{ id: 'version-1', song_id: 'song-1' }],
    charts: [{ id: 'chart-1', song_id: 'song-1', content: '[G]hi' }],
    tags: [{ id: 'tag-1', name: 'worship' }],
  },
  collections: [{ id: 'collection-1', songs: [{ song_id: 'song-1', position: 1 }] }],
  setlists: [
    {
      id: 'setlist-1',
      items: [
        { song_id: 'song-1', position: 1 },
        { song_id: 'song-outside-export', position: 2 },
      ],
    },
  ],
  annotations: [{ id: 'annotation-1', song_id: 'song-1' }],
}

/**
 * @param {Record<string, Uint8Array>} entries
 * @returns {Uint8Array}
 */
function zipOf(entries) {
  return zipSync(entries)
}

describe('parseImportBundle', () => {
  it('round-trips a bundle produced by buildExportZip', () => {
    const bundle = buildExportZip(envelope)
    const result = parseImportBundle(bundle.bytes)

    expect(result.document.schema_version).toBe('cemurm.account-export/1')
    expect(result.document.repertoire.songs).toHaveLength(1)
    expect(result.document.repertoire.songs[0].title).toBe('Imported Song')
    expect(result.summaryOfWhatWillImport).toEqual({
      songs: 1,
      versions: 1,
      charts: 1,
      tags: 1,
      collections: 1,
      collectionSongs: 1,
      setlists: 1,
      setlistItems: 2,
      annotations: 1,
    })
  })

  it('accepts an ArrayBuffer as well as a Uint8Array', () => {
    const { bytes } = buildExportZip(envelope)
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    expect(parseImportBundle(buffer).document.user_id).toBe(envelope.user_id)
  })

  it('rejects a document whose schema_version is not the supported one', () => {
    const wrong = buildExportZip({ ...envelope, schema_version: 'cemurm.account-export/2' })
    expect(() => parseImportBundle(wrong.bytes)).toThrow(UNSUPPORTED_VERSION)
  })

  it('rejects a file that is not a ZIP at all', () => {
    expect(() => parseImportBundle(strToU8('this is not a zip'))).toThrow(NOT_EXPORT)
  })

  it('rejects a ZIP with no export JSON entry', () => {
    const bytes = zipOf({ 'summary.md': strToU8('# not an export') })
    expect(() => parseImportBundle(bytes)).toThrow(NOT_EXPORT)
  })

  it('rejects a ZIP whose JSON entry is not parseable', () => {
    const bytes = zipOf({ 'cemurm-export-2026-10-22.json': strToU8('{oops') })
    expect(() => parseImportBundle(bytes)).toThrow(DAMAGED)
  })

  it('rejects a ZIP carrying more than one export document', () => {
    const bytes = zipOf({
      'cemurm-export-2026-10-22.json': strToU8(JSON.stringify(envelope)),
      'cemurm-export-2026-10-23.json': strToU8(JSON.stringify(envelope)),
    })
    expect(() => parseImportBundle(bytes)).toThrow(DAMAGED)
  })

  it('rejects a document with no repertoire object', () => {
    const bytes = zipOf({
      'cemurm-export-2026-10-22.json': strToU8(JSON.stringify({
        schema_version: 'cemurm.account-export/1',
      })),
    })
    expect(() => parseImportBundle(bytes)).toThrow(DAMAGED)
  })

  it('rejects a document whose collections is not an array', () => {
    const bytes = zipOf({
      'cemurm-export-2026-10-22.json': strToU8(JSON.stringify({
        ...envelope,
        collections: 'nope',
      })),
    })
    expect(() => parseImportBundle(bytes)).toThrow(DAMAGED)
  })

  it('rejects a non-object JSON payload', () => {
    const bytes = zipOf({
      'cemurm-export-2026-10-22.json': strToU8('[]'),
    })
    expect(() => parseImportBundle(bytes)).toThrow(DAMAGED)
  })
})
