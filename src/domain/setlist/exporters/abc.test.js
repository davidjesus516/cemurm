// ABC notation exporter — features/export-and-sharing.feature:32-36.
//
// Inline ABC bodies are printed verbatim: they are already complete tunes, so
// rewriting the author's X:/T:/K: headers would corrupt them. A song without
// notation still gets a metadata stanza so setlist order survives the export.

import { describe, expect, it } from 'vitest'

import { serializeAbc } from './abc.js'

const SONGS = [
  {
    id: 's1',
    title: 'Wonderwall',
    artist: 'Oasis',
    key: 'Em',
    format: 'abc',
    body: 'X:7\nT:Wonderwall (arr. band)\nK:Em\nE F# G A',
  },
  {
    id: 's2',
    title: 'Amazing Grace',
    artist: 'John Newton',
    key: 'G',
    format: 'chordpro',
    body: '{title: Amazing Grace}\n[G]Amazing grace',
  },
]

describe('serializeAbc', () => {
  it('prints an inline ABC body verbatim', () => {
    const text = serializeAbc({ name: 'Gig', itemIds: ['s1'] }, SONGS)

    expect(text).toContain('X:7')
    expect(text).toContain('T:Wonderwall (arr. band)')
    expect(text).toContain('E F# G A')
  })

  it('emits a metadata stanza when the song has no ABC notation', () => {
    const text = serializeAbc({ name: 'Gig', itemIds: ['s2'] }, SONGS)

    expect(text).toContain('X:1')
    expect(text).toContain('T:Amazing Grace')
    expect(text).toContain('C:John Newton')
    expect(text).toContain('K:G')
    expect(text).not.toContain('[G]Amazing grace')
  })

  it('keeps setlist order and numbers metadata stanzas from 1', () => {
    const text = serializeAbc({ name: 'Gig', itemIds: ['s2', 's1'] }, SONGS)

    const amazing = text.indexOf('T:Amazing Grace')
    const wonderwall = text.indexOf('X:7')
    expect(amazing).toBeGreaterThan(-1)
    expect(wonderwall).toBeGreaterThan(-1)
    expect(amazing).toBeLessThan(wonderwall)
    expect(text).toContain('% Gig')
  })

  it('survives an empty setlist', () => {
    expect(serializeAbc({ name: 'Empty', itemIds: [] }, [])).toContain('% Empty')
  })
})
