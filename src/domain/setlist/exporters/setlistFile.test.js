// Setlist file dispatcher — one entry point for the formats the setlist page
// offers, with the file names the feature scenarios spell out:
//   "Sunday-Worship-setlist.chordpro"  (features/export-and-sharing.feature:23)
//   "setlist-name.abc"                 (features/export-and-sharing.feature:36)
//
// PDF and MusicXML are named as unsupported instead of producing a file that
// pretends to be one: their charts are storage objects (chart_files.object_key
// with content NULL), and there is no PDF writer in this build.

import { describe, expect, it } from 'vitest'

import { buildSetlistFile, EXPORT_FORMATS } from './setlistFile.js'

const SONGS = [
  {
    id: 's1',
    title: 'Amazing Grace',
    artist: 'John Newton',
    key: 'G',
    format: 'chordpro',
    body: 'Amazing [G]grace\nhow [C]sweet',
  },
  {
    id: 's2',
    title: 'Great Is Thy Faithfulness',
    artist: '',
    key: 'D',
    format: 'chordpro',
    body: 'Great is thy [D]faithfulness',
  },
]

const SETLIST = { name: 'Sunday Worship', itemIds: ['s1', 's2'] }

describe('buildSetlistFile', () => {
  it('names the ChordPro file after the setlist', () => {
    const res = buildSetlistFile(SETLIST, SONGS, 'chordpro')

    expect(res.ok).toBe(true)
    expect(res.filename).toBe('Sunday-Worship-setlist.chordpro')
    expect(res.mimeType).toBe('text/plain')
  })

  it('separates ChordPro songs with {new_song}', () => {
    const text = buildSetlistFile(SETLIST, SONGS, 'chordpro').text

    expect(text).toContain('{title: Amazing Grace}')
    expect(text).toContain('{new_song}')
    expect(text).toContain('{title: Great Is Thy Faithfulness}')
  })

  it('names the ABC and plain-text files with their own extensions', () => {
    expect(buildSetlistFile(SETLIST, SONGS, 'abc').filename).toBe(
      'Sunday-Worship-setlist.abc',
    )
    expect(buildSetlistFile(SETLIST, SONGS, 'txt').filename).toBe(
      'Sunday-Worship-setlist.txt',
    )
  })

  it('keeps the shipped OnSong export reachable and untouched', () => {
    const res = buildSetlistFile(SETLIST, SONGS, 'onsong')

    expect(res.ok).toBe(true)
    expect(res.filename).toBe('sunday-worship.cho')
    expect(res.text).toContain('{title: Amazing Grace}')
  })

  it('refuses PDF and MusicXML by name instead of faking a file', () => {
    expect(() => buildSetlistFile(SETLIST, SONGS, 'pdf')).toThrow(/pdf/i)
    expect(() => buildSetlistFile(SETLIST, SONGS, 'musicxml')).toThrow(/musicxml/i)
  })

  it('publishes exactly the formats it can produce', () => {
    expect(EXPORT_FORMATS.map((f) => f.value)).toEqual([
      'onsong',
      'chordpro',
      'abc',
      'txt',
    ])
  })

  it('falls back to untitled when the setlist has no name', () => {
    expect(buildSetlistFile({ itemIds: [] }, [], 'txt').filename).toBe(
      'untitled-setlist.txt',
    )
  })
})
