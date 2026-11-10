// Plain-text outline formatter — features/export-and-sharing.feature:38-43.
// Node-only unit test: the formatter is pure, no DOM and no DB.

import { describe, expect, it } from 'vitest'

import { serializePlainText } from './plaintext.js'

const SONGS = [
  {
    id: 's1',
    title: 'Amazing Grace',
    artist: 'John Newton',
    key: 'C',
    durationSeconds: 225,
    body: '[C]Amazing grace how [G]sweet',
  },
  {
    id: 's2',
    title: 'Great Is Thy Faithfulness',
    artist: '',
    key: 'D',
    durationSeconds: 300,
    body: '',
  },
]

const SETLIST = {
  name: 'Acoustic Night',
  itemIds: ['s1', 's2'],
  agreedKeys: { s1: 'G' },
  itemNotes: { s1: 'slow intro' },
}

describe('serializePlainText', () => {
  it('renders the outline table in setlist order', () => {
    const text = serializePlainText(SETLIST, SONGS)

    expect(text).toContain('| # | Title | Key | Duration | Notes |')
    expect(text).toContain('| 1 | Amazing Grace | G | 3:45 | slow intro |')
    expect(text).toContain('| 2 | Great Is Thy Faithfulness | D | 5:00 |  |')
  })

  it('never leaks chords, lyrics or chart bodies', () => {
    const text = serializePlainText(SETLIST, SONGS)

    expect(text).not.toContain('Amazing grace how')
    expect(text).not.toContain('[C]')
  })

  it('agreed key beats the song key', () => {
    const text = serializePlainText(SETLIST, SONGS)

    expect(text).toContain('| 1 | Amazing Grace | G |')
    expect(text).not.toContain('| 1 | Amazing Grace | C |')
  })

  it('survives an empty setlist', () => {
    const text = serializePlainText({ name: 'Empty', itemIds: [] }, [])

    expect(text).toContain('# Empty')
    expect(text).toContain('_No songs in this setlist._')
  })

  it('escapes a pipe in a note so the table keeps its columns', () => {
    const text = serializePlainText(
      { name: 'Capo', itemIds: ['s1'], itemNotes: { s1: 'capo 2 | drop D' } },
      SONGS,
    )

    expect(text).toContain('| capo 2 \\| drop D |')
    expect(text).not.toContain('| capo 2 | drop D |')
  })

  it('escapes a pipe in a title', () => {
    const text = serializePlainText(
      { name: 'Pipes', itemIds: ['s1'] },
      [{ ...SONGS[0], title: 'Intro | Outro' }],
    )

    expect(text).toContain('| Intro \\| Outro |')
  })

  it('escapes the backslash before the pipe so the pipe cannot leak back out', () => {
    const text = serializePlainText(
      { name: 'Backslash', itemIds: ['s1'], itemNotes: { s1: String.raw`capo 2 \| drop D` } },
      SONGS,
    )

    expect(text).toContain(String.raw`| capo 2 \\\| drop D |`)
  })
})
