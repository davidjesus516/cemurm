// ChordPro exporter — features/export-and-sharing.feature:18-23.
// Node-only unit test: the serializer is pure, no DOM and no DB.

import { describe, expect, it } from 'vitest'

import { serializeChordPro } from './chordpro.js'

const SONGS = [
  {
    id: 's1',
    title: 'Amazing Grace',
    artist: 'John Newton',
    key: 'C',
    body: '[C]Amazing grace how [G]sweet',
  },
  {
    id: 's2',
    title: 'Great Is Thy Faithfulness',
    artist: 'Thomas Chisholm',
    key: 'D',
    body: '[D]Great is thy faithfulness',
  },
]

describe('serializeChordPro', () => {
  it('separates two songs with exactly one {new_song}', () => {
    const text = serializeChordPro({ name: 'Two', itemIds: ['s1', 's2'] }, SONGS)

    expect(text.match(/\{new_song\}/g)).toHaveLength(1)
  })

  it('places {new_song} between the songs, never before the first', () => {
    const text = serializeChordPro({ name: 'Two', itemIds: ['s1', 's2'] }, SONGS)

    expect(text.indexOf('{new_song}')).toBeGreaterThan(text.indexOf('{title: Amazing Grace}'))
    expect(text.indexOf('{new_song}')).toBeLessThan(
      text.indexOf('{title: Great Is Thy Faithfulness}'),
    )
  })

  it('writes no {new_song} for a single-song setlist', () => {
    const text = serializeChordPro({ name: 'One', itemIds: ['s1'] }, SONGS)

    expect(text).toContain('{title: Amazing Grace}')
    expect(text).not.toContain('{new_song}')
  })
})
