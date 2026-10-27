import { describe, expect, it } from 'vitest'

import {
  lrclibSearchRows,
  musicBrainzSearchBody,
  spotifyFeatures,
  spotifySearchBody,
  spotifyTokenBody,
} from './schemas.js'

// These tests pin the two halves of the contract the clients rely on:
//   * absent / null stays ACCEPTED, because each client already tolerates it
//     with `?.`, a truthiness check or a `typeof` guard. A schema that rejected
//     an absence would turn a tolerated response into 'unavailable'.
//   * a wrong TYPE is REJECTED, which is the whole point — the fallbacks cannot
//     see it, so it used to travel into the database as if it were real data.

describe('musicBrainzSearchBody', () => {
  it('parses a real-shaped search envelope', () => {
    const body = {
      count: 1,
      recordings: [
        {
          id: 'abc',
          title: 'Way Maker',
          'artist-credit': [{ name: 'Sinach' }],
          releases: [{ date: '2015-01-01' }],
          tags: [{ name: 'worship' }],
        },
      ],
    }
    expect(musicBrainzSearchBody.parse(body).recordings?.[0].title).toBe('Way Maker')
  })

  it('accepts an envelope with no recordings, and a null one', () => {
    expect(musicBrainzSearchBody.parse({})).toEqual({})
    expect(musicBrainzSearchBody.parse({ recordings: null })).toEqual({ recordings: null })
  })

  it('accepts a recording that carries none of the optional fields', () => {
    expect(() => musicBrainzSearchBody.parse({ recordings: [{}] })).not.toThrow()
  })

  it('accepts null where the API omits a value', () => {
    expect(() =>
      musicBrainzSearchBody.parse({ recordings: [{ title: null, releases: [{ date: null }] }] }),
    ).not.toThrow()
  })

  it('ignores fields it does not read, so a provider addition is not a failure', () => {
    expect(() =>
      musicBrainzSearchBody.parse({ recordings: [{ score: 100, unknown: ['x'] }] }),
    ).not.toThrow()
  })

  it('rejects recordings that are not an array', () => {
    expect(() => musicBrainzSearchBody.parse({ recordings: {} })).toThrow()
  })

  it('rejects a title that is not a string', () => {
    expect(() => musicBrainzSearchBody.parse({ recordings: [{ title: 2015 }] })).toThrow()
  })
})

describe('lrclibSearchRows', () => {
  it('parses the array the API answers a successful search with', () => {
    const rows = [{ syncedLyrics: '[00:01.00] line', plainLyrics: 'line' }]
    expect(lrclibSearchRows.parse(rows)).toEqual(rows)
  })

  it('accepts a row carrying only one flavour, or neither', () => {
    expect(() => lrclibSearchRows.parse([{ syncedLyrics: 'x' }])).not.toThrow()
    expect(() => lrclibSearchRows.parse([{}])).not.toThrow()
  })

  // This is the one deliberate behaviour change in the module: the old
  // Array.isArray guard turned the API's error payload into an empty result,
  // which read as "this song has no lyrics".
  it('rejects the non-array error payload instead of reading it as no match', () => {
    expect(() => lrclibSearchRows.parse({ error: 'not found' })).toThrow()
  })

  it('rejects a lyric field that is not a string', () => {
    expect(() => lrclibSearchRows.parse([{ syncedLyrics: 42 }])).toThrow()
  })
})

describe('spotifyTokenBody', () => {
  it('parses a token response', () => {
    expect(spotifyTokenBody.parse({ access_token: 'abc' })).toEqual({ access_token: 'abc' })
  })

  it('accepts a response without a token, which the caller reports itself', () => {
    expect(() => spotifyTokenBody.parse({})).not.toThrow()
  })

  it('rejects a token that is not a string', () => {
    expect(() => spotifyTokenBody.parse({ access_token: 123 })).toThrow()
  })
})

describe('spotifySearchBody', () => {
  const track = {
    id: 't1',
    name: 'Way Maker',
    artists: [{ name: 'Sinach' }],
    album: { images: [{ url: 'https://img/1' }] },
  }

  it('parses a search envelope', () => {
    const parsed = spotifySearchBody.parse({ tracks: { items: [track] } })
    expect(parsed.tracks?.items?.[0].id).toBe('t1')
  })

  it('accepts an empty envelope and an empty page', () => {
    expect(() => spotifySearchBody.parse({})).not.toThrow()
    expect(() => spotifySearchBody.parse({ tracks: {} })).not.toThrow()
    expect(() => spotifySearchBody.parse({ tracks: null })).not.toThrow()
  })

  it('accepts a track without album or artists', () => {
    expect(() =>
      spotifySearchBody.parse({ tracks: { items: [{ id: 't1', name: 'x' }] } }),
    ).not.toThrow()
  })

  // `id` builds the /audio-features URL and `name` feeds the match score, and
  // neither read is guarded. A missing id used to fetch /audio-features/undefined.
  it('rejects a track without an id or a name', () => {
    expect(() => spotifySearchBody.parse({ tracks: { items: [{ name: 'x' }] } })).toThrow()
    expect(() => spotifySearchBody.parse({ tracks: { items: [{ id: 't1' }] } })).toThrow()
  })

  it('rejects an id that is not a string', () => {
    expect(() =>
      spotifySearchBody.parse({ tracks: { items: [{ id: 1, name: 'x' }] } }),
    ).toThrow()
  })
})

describe('spotifyFeatures', () => {
  it('parses an analysed track', () => {
    expect(spotifyFeatures.parse({ key: 4, tempo: 120.4, mode: 1 })).toEqual({
      key: 4,
      tempo: 120.4,
      mode: 1,
    })
  })

  it('accepts an unanalysed track, where the three fields are absent or null', () => {
    expect(() => spotifyFeatures.parse({})).not.toThrow()
    expect(() => spotifyFeatures.parse({ key: null, tempo: null, mode: null })).not.toThrow()
  })

  it('rejects a key that is not a number', () => {
    expect(() => spotifyFeatures.parse({ key: 'C' })).toThrow()
  })
})
