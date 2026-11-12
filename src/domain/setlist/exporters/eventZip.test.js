import { unzipSync, strFromU8 } from 'fflate'
import { describe, expect, it } from 'vitest'

import { buildEventSetlistsZip } from './eventZip.js'
import { buildSetlistFile } from './setlistFile.js'

// features/export-and-sharing.feature:181-186 — "a ZIP archive is generated
// containing all 5 setlists" and "the archive is named
// 'Weekend-Festival-2025-setlists.zip'".

const FILES = [
  { filename: 'Friday-Gig-setlist.chordpro', text: '{title: Way Maker}\n' },
  { filename: 'Saturday-Gig-setlist.chordpro', text: '{title: Oceans}\n' },
]

function entriesOf(bytes) {
  const unzipped = unzipSync(bytes)
  return Object.keys(unzipped).sort().map((name) => [name, strFromU8(unzipped[name])])
}

describe('buildEventSetlistsZip', () => {
  it('names the archive after the event, keeping the author casing', () => {
    const { name } = buildEventSetlistsZip('Weekend Festival 2025', FILES)

    expect(name).toBe('Weekend-Festival-2025-setlists.zip')
  })

  it('holds one readable entry per setlist', () => {
    const { bytes } = buildEventSetlistsZip('Weekend Festival 2025', FILES)

    expect(entriesOf(bytes)).toEqual([
      ['Friday-Gig-setlist.chordpro', '{title: Way Maker}\n'],
      ['Saturday-Gig-setlist.chordpro', '{title: Oceans}\n'],
    ])
  })

  it('disambiguates two setlists that serialize to the same filename', () => {
    const duplicate = [
      { filename: 'Friday-Gig-setlist.chordpro', text: 'first' },
      { filename: 'Friday-Gig-setlist.chordpro', text: 'second' },
      { filename: 'Friday-Gig-setlist.chordpro', text: 'third' },
    ]

    const { bytes } = buildEventSetlistsZip('Weekend', duplicate)
    const names = entriesOf(bytes).map(([n]) => n)

    expect(names).toEqual([
      'Friday-Gig-setlist-2.chordpro',
      'Friday-Gig-setlist-3.chordpro',
      'Friday-Gig-setlist.chordpro',
    ])
  })

  it('falls back to a usable archive name for an unnamed event', () => {
    expect(buildEventSetlistsZip('', FILES).name).toBe('untitled-setlists.zip')
    expect(buildEventSetlistsZip(undefined, FILES).name).toBe('untitled-setlists.zip')
  })

  it('refuses to build an empty archive instead of shipping a hollow file', () => {
    expect(() => buildEventSetlistsZip('Weekend Festival 2025', [])).toThrow(
      'Select at least one setlist to export.',
    )
    expect(() => buildEventSetlistsZip('Weekend Festival 2025')).toThrow(
      'Select at least one setlist to export.',
    )
  })
})

// The seam this feature actually lives on: the archive must carry the very
// bytes the single-setlist export would have written, not a re-serialization
// that could drift from it.
describe('buildEventSetlistsZip with the real serializers', () => {
  it('archives the exact ChordPro text the single-setlist export writes', () => {
    const setlist = { name: 'Friday Gig', itemIds: ['s1'] }
    const songs = [
      {
        id: 's1',
        title: 'Way Maker',
        artist: 'Sinach',
        key: 'G',
        format: 'chordpro',
        body: 'Way [G]maker',
      },
    ]

    const file = buildSetlistFile(setlist, songs, 'chordpro')
    const { bytes, name } = buildEventSetlistsZip('Weekend Festival 2025', [file])

    expect(name).toBe('Weekend-Festival-2025-setlists.zip')
    expect(entriesOf(bytes)).toEqual([['Friday-Gig-setlist.chordpro', file.text]])
  })
})
