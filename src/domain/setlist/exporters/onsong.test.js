// Characterization tests — locks current behaviour before the PR 1b boundary refactor.
// Specified by: features/external-integrations.feature
// PR 1b will split this module. These tests must pass with ZERO edits.
//
// SCOPE: serializeOnSong only. downloadOnSongFile is deliberately NOT covered —
// it touches document/Blob/URL and needs a DOM environment, which is out of
// scope for this runner (node only, no jsdom).

import { describe, it, expect } from 'vitest'

import { serializeOnSong } from './onsong.js'

// ── fixtures ────────────────────────────────────────────────────────────────
// Verbatim chart bodies from the seeded public-library set (supabase/seed.sql).
const SONG_AMAZING_GRACE = {
  id: '20000000-0000-0000-0000-000000000004',
  title: 'Amazing Grace',
  artist: 'John Newton',
  key: 'G',
  body: `{title: Amazing Grace}
{artist: John Newton}
{key: G}
{section: Verse 1}
[G]Amazing [D]grace, how [G]sweet the [Em]sound
That [C]saved a [D]wretch like [G]me
{section: Verse 2}
'Twas [G]grace that [D]taught my [G]heart to [Em]fear`,
}

const SONG_SCARBOROUGH = {
  id: '20000000-0000-0000-0000-000000000005',
  title: 'Scarborough Fair',
  artist: 'Traditional',
  key: 'Em',
  body: `{title: Scarborough Fair}
{artist: Traditional}
{key: Em}
[Em]Are you going to [D]Scarborough [Em]Fair`,
}

// The flattened Setlist shape (data/repositories/setlists.js:169 flattenSetlist).
const DEMO_SETLIST = {
  name: 'Demo Setlist',
  itemIds: [SONG_AMAZING_GRACE.id, SONG_SCARBOROUGH.id],
  versionIds: {},
}

// ── setlist order ────────────────────────────────────────────────────────────

describe('serializeOnSong — setlist order', () => {
  it('emits the songs in itemIds order, whatever order `songs` is in', () => {
    // "the file … contains the songs in order with their charts and agreed keys"
    const reversed = [SONG_SCARBOROUGH, SONG_AMAZING_GRACE]
    const forward = serializeOnSong(DEMO_SETLIST, reversed)
    const backward = serializeOnSong(
      { ...DEMO_SETLIST, itemIds: [DEMO_SETLIST.itemIds[1], DEMO_SETLIST.itemIds[0]] },
      reversed,
    )
    expect(forward.indexOf('{title: Amazing Grace}')).toBeLessThan(forward.indexOf('{title: Scarborough Fair}'))
    expect(backward.indexOf('{title: Scarborough Fair}')).toBeLessThan(backward.indexOf('{title: Amazing Grace}'))
  })

  it('serialises a single-item setlist to one block', () => {
    const text = serializeOnSong({ itemIds: [SONG_AMAZING_GRACE.id] }, [SONG_AMAZING_GRACE])
    expect(text.startsWith('{title: Amazing Grace}\n')).toBe(true)
    expect(text).not.toContain('\n\n')
  })

  it('skips an item whose song is not in the library — it contributes nothing at all', () => {
    const text = serializeOnSong({ itemIds: ['gone', SONG_AMAZING_GRACE.id] }, [SONG_AMAZING_GRACE])
    expect(text).toBe(serializeOnSong({ itemIds: [SONG_AMAZING_GRACE.id] }, [SONG_AMAZING_GRACE]))
    expect(text.startsWith('{title:')).toBe(true)
  })

  it('serialises a repeated itemId twice', () => {
    // FINDING: itemIds is walked as-is, so a duplicated id duplicates the block.
    const text = serializeOnSong({ itemIds: ['s', 's'] }, [{ id: 's', title: 'T', body: 'x' }])
    expect(text).toBe('{title: T}\nx\n\n{title: T}\nx')
  })

  it('resolves duplicate `songs` rows by LAST one (Map overwrite)', () => {
    const text = serializeOnSong({ itemIds: ['dup'] }, [{ id: 'dup', title: 'First' }, { id: 'dup', title: 'Last' }])
    expect(text).toBe('{title: Last}')
  })
})

// ── block assembly ───────────────────────────────────────────────────────────

describe('serializeOnSong — block layout', () => {
  it('writes {title}, {artist}, {key} then the body, in that order', () => {
    const text = serializeOnSong({ itemIds: ['s'] }, [{ id: 's', title: 'T', artist: 'A', key: 'C', body: '[C]x' }])
    expect(text).toBe('{title: T}\n{artist: A}\n{key: C}\n[C]x')
  })

  it('joins blocks with a blank line', () => {
    const text = serializeOnSong(
      { itemIds: ['a', 'b'] },
      [{ id: 'a', title: 'A', body: 'x' }, { id: 'b', title: 'B', body: 'y' }],
    )
    expect(text).toBe('{title: A}\nx\n\n{title: B}\ny')
  })

  it('omits each header line whose value is falsy', () => {
    const text = serializeOnSong({ itemIds: ['s'] }, [{ id: 's', title: 'T', artist: '', key: null, body: '[C]x' }])
    expect(text).toBe('{title: T}\n[C]x')
    expect(text).not.toContain('{key: }')
    expect(text).not.toContain('{artist: }')
  })

  it('emits an EMPTY block for a song with no title, artist, key or body', () => {
    // FINDING: a metadata-less song still contributes a block, so the join
    // leaves a stray blank separator.
    const text = serializeOnSong({ itemIds: ['e', SONG_AMAZING_GRACE.id] }, [{ id: 'e' }, SONG_AMAZING_GRACE])
    expect(text.startsWith('\n\n{title: Amazing Grace}')).toBe(true)
  })

  it('trims the body but not title, artist or key', () => {
    // FINDING: `String(song.body || '').trim()` is the only trim in the
    // function, so padded metadata reaches the file with its padding.
    const text = serializeOnSong({ itemIds: ['s'] }, [{ id: 's', title: '  Padded  ', artist: ' A ', key: ' C ', body: '\n\n  [C]x  \n\n' }])
    expect(text).toBe('{title:   Padded  }\n{artist:  A }\n{key:  C }\n[C]x')
  })

  it('treats a null body as empty and omits it', () => {
    expect(serializeOnSong({ itemIds: ['s'] }, [{ id: 's', title: 'T', body: null }])).toBe('{title: T}')
  })

  it('passes the ChordPro body through verbatim so sections survive', () => {
    const text = serializeOnSong({ itemIds: [SONG_AMAZING_GRACE.id] }, [SONG_AMAZING_GRACE])
    expect(text).toContain('{section: Verse 1}')
    expect(text).toContain("{section: Verse 2}\n'Twas [G]grace that [D]taught my [G]heart to [Em]fear")
  })
})

// ── agreed key resolution ────────────────────────────────────────────────────

describe('serializeOnSong — agreed key', () => {
  it('uses the pinned version base_key over the song key', () => {
    const song = {
      id: 's2',
      title: 'Oceans',
      key: 'F major',
      versions: [{ id: 'v2a', key: 'F major' }, { id: 'v2b', key: 'E major' }],
      body: '[D]A [G]B',
    }
    const text = serializeOnSong({ itemIds: ['s2'], versionIds: { s2: 'v2b' } }, [song])
    expect(text).toContain('{key: E major}')
    expect(text).not.toContain('{key: F major}')
  })

  it('falls back to the song key when the pinned version is not found', () => {
    const song = { id: 's2', key: 'F major', versions: [{ id: 'v2a', key: 'F major' }], body: 'x' }
    expect(serializeOnSong({ itemIds: ['s2'], versionIds: { s2: 'nope' } }, [song])).toContain('{key: F major}')
  })

  it('falls back to the song key when versions is not an array', () => {
    const song = { id: 's2', key: 'F major', versions: 'nope', body: 'x' }
    expect(serializeOnSong({ itemIds: ['s2'], versionIds: { s2: 'v2' } }, [song])).toContain('{key: F major}')
  })

  it('falls back to the song key when the selected version has an empty key', () => {
    const song = { id: 's2', key: 'F major', versions: [{ id: 'v2', key: '' }], body: 'x' }
    expect(serializeOnSong({ itemIds: ['s2'], versionIds: { s2: 'v2' } }, [song])).toContain('{key: F major}')
  })

  it('ignores a versionIds entry keyed to a different song', () => {
    const song = { id: 's1', key: 'C', versions: [{ id: 'v', key: 'D' }], body: 'x' }
    expect(serializeOnSong({ itemIds: ['s1'], versionIds: { s2: 'v' } }, [song])).toBe('{key: C}\nx')
  })

  it('emits the setlist item agreed_key, which is the one the spec asks for', () => {
    // The assertion this replaces read "NEVER emits the setlist item
    // agreed_key" and asserted the output did NOT contain it. That was the
    // bug, pinned: the feature file says the export "contains the songs in
    // order with their charts and agreed keys", and the only key the exporter
    // could reach was the pinned version's base_key.
    //
    // Eb is the agreed key while G is the chart's own — the case the whole
    // finding is about, since those are different keys for the same song.
    //
    // Note the body's own {key: G} line. The header comment says the body
    // "passes through VERBATIM so ChordPro sections survive", so G is still in
    // the output; that duplication is the second half of finding C and is not
    // addressed here. What is asserted is that the EXPORTED key is the agreed
    // one, which is the line the exporter chose rather than the one the body
    // happened to carry.
    const text = serializeOnSong(
      { name: 'Demo Setlist', itemIds: [SONG_AMAZING_GRACE.id], agreedKeys: { [SONG_AMAZING_GRACE.id]: 'Eb' } },
      [SONG_AMAZING_GRACE],
    )
    const emitted = text.match(/^\{key: ([^}]*)\}/m)
    expect(emitted, 'exactly one exporter-authored key line').toBeTruthy()
    expect(emitted[1]).toBe('Eb')
  })

  it('still carries the chart own key from the body — a known duplication, not a fix', () => {
    // Recorded so the gap is visible rather than forgotten. Folding this into
    // the agreed-key change would mean rewriting the body contract, which is a
    // separate decision: strip it, or teach the exporter precedence.
    const text = serializeOnSong(
      { itemIds: [SONG_AMAZING_GRACE.id], agreedKeys: { [SONG_AMAZING_GRACE.id]: 'Eb' } },
      [SONG_AMAZING_GRACE],
    )
    expect(text).toContain('{key: G}')
    expect(text.match(/\{key: /g)).toHaveLength(2)
  })

  it('lets the agreed key outrank a pinned version, and the song key', () => {
    const song = { id: 's', title: 'T', artist: 'A', key: 'C', versions: [{ id: 'v', key: 'D' }], body: '[C]x' }
    // Pinned version says D, song says C, the band agreed Eb. The agreement is
    // the answer the spec names.
    const text = serializeOnSong({ itemIds: ['s'], versionIds: { s: 'v' }, agreedKeys: { s: 'Eb' } }, [song])
    expect(text).toContain('{key: Eb}')
  })

  it('falls back to the pinned version, then the song key, when nothing was agreed', () => {
    const song = { id: 's', title: 'T', artist: 'A', key: 'C', versions: [{ id: 'v', key: 'D' }], body: '[C]x' }
    // A setlist where nobody agreed a key is an ordinary state, not an error,
    // and the old precedence is preserved for it exactly.
    expect(serializeOnSong({ itemIds: ['s'], versionIds: { s: 'v' } }, [song])).toContain('{key: D}')
    expect(serializeOnSong({ itemIds: ['s'] }, [song])).toContain('{key: C}')
    // An agreed key for a DIFFERENT song must not leak into this one.
    expect(serializeOnSong({ itemIds: ['s'], agreedKeys: { other: 'Eb' } }, [song])).toContain('{key: C}')
  })

  it('treats an empty agreed key as absent rather than emitting nothing', () => {
    const song = { id: 's', title: 'T', artist: 'A', key: 'C', body: '[C]x' }
    const text = serializeOnSong({ itemIds: ['s'], agreedKeys: { s: '' } }, [song])
    expect(text).toContain('{key: C}')
    expect(text).not.toContain('{key: }')
  })
})

// ── S17: nothing per-item leaks ──────────────────────────────────────────────

describe('serializeOnSong — exclusion of per-item state', () => {
  it('emits only title/artist/key/body and nothing else from the song row', () => {
    // S17: "exports order + agreed keys, no projections/annotations".
    const song = {
      id: 's',
      title: 'T',
      artist: 'A',
      key: 'C',
      body: '[C]x',
      projection: 'vocals-who-leads',
      projections: { melody: 'Juan' },
      vocalParts: [{ label: 'Harmony (Pedro)' }],
      annotations: 'private rehearsal notes',
      notes: 'n',
      bpm: 90,
      midiProgram: 24,
      durationSeconds: 210,
      versions: [{ id: 'v9', key: 'D' }],
    }
    const text = serializeOnSong({ itemIds: ['s'] }, [song])
    expect(text).toBe('{title: T}\n{artist: A}\n{key: C}\n[C]x')
    for (const leak of ['vocals', 'Juan', 'Pedro', 'private', '90', '24', '210', 'D']) {
      expect(text).not.toContain(leak)
    }
  })
})

// ── input coercion and hostile values ────────────────────────────────────────

describe('serializeOnSong — input coercion', () => {
  it('returns "" for a missing setlist, missing songs or a non-array itemIds', () => {
    expect(serializeOnSong(null, null)).toBe('')
    expect(serializeOnSong(undefined, undefined)).toBe('')
    expect(serializeOnSong({}, [SONG_AMAZING_GRACE])).toBe('')
    expect(serializeOnSong({ itemIds: 'ab' }, [SONG_AMAZING_GRACE])).toBe('')
    expect(serializeOnSong({ itemIds: [SONG_AMAZING_GRACE.id] }, null)).toBe('')
    expect(serializeOnSong({ itemIds: [SONG_AMAZING_GRACE.id] }, undefined)).toBe('')
  })

  it('handles titles with punctuation, colons and non-ASCII characters', () => {
    const text = serializeOnSong(
      { itemIds: ['a', 'b', 'c'] },
      [
        { id: 'a', title: 'Oh! Susanna', artist: 'Stephen Foster', key: 'F', body: 'x' },
        { id: 'b', title: 'Oceans: Where Feet May Fail', key: 'F', body: 'x' },
        { id: 'c', title: 'Café de la Música — Canción', key: 'Am', body: 'x' },
      ],
    )
    expect(text).toContain('{title: Oh! Susanna}')
    expect(text).toContain('{title: Oceans: Where Feet May Fail}')
    expect(text).toContain('{title: Café de la Música — Canción}')
  })

  it('does NOT escape a brace or newline in a title, so the directive is corrupted', () => {
    // FINDING: title/artist/key are interpolated raw. A newline splits the
    // directive across two lines, and a '}' makes parseDirective() reject the
    // line, so a hostile title injects directives or drops the header.
    expect(serializeOnSong({ itemIds: ['s'] }, [{ id: 's', title: 'A\n{key: Gb}', body: 'x' }])).toBe(
      '{title: A\n{key: Gb}}\nx',
    )
    expect(serializeOnSong({ itemIds: ['s'] }, [{ id: 's', title: 'A } B', body: 'x' }])).toBe('{title: A } B}\nx')
  })

  it('never mutates the setlist or the songs array', () => {
    const songs = [{ id: 's', title: 'T', key: 'C', body: 'x' }]
    const setlist = { itemIds: ['s'], versionIds: { s: 'v' } }
    const songsBefore = JSON.stringify(songs)
    const setlistBefore = JSON.stringify(setlist)
    serializeOnSong(setlist, songs)
    expect(JSON.stringify(songs)).toBe(songsBefore)
    expect(JSON.stringify(setlist)).toBe(setlistBefore)
  })
})

// ── the real seeded Demo Setlist, end to end ─────────────────────────────────

describe('serializeOnSong — the seeded Demo Setlist', () => {
  it('emits each real chart body, and DUPLICATES the three header directives', () => {
    // FINDING: a seeded chart body already opens with its own {title}/{artist}/
    // {key} directives, and the exporter prepends the same three from the song
    // row. Every real export therefore carries each directive twice.
    const text = serializeOnSong(DEMO_SETLIST, [SONG_AMAZING_GRACE, SONG_SCARBOROUGH])
    const titleCount = (text.match(/^\{title: Amazing Grace\}$/gm) || []).length
    const artistCount = (text.match(/^\{artist: John Newton\}$/gm) || []).length
    const keyCount = (text.match(/^\{key: G\}$/gm) || []).length
    expect(titleCount).toBe(2)
    expect(artistCount).toBe(2)
    expect(keyCount).toBe(2)
  })

  it('produces the exact payload for the two seeded charts', () => {
    expect(serializeOnSong(DEMO_SETLIST, [SONG_AMAZING_GRACE, SONG_SCARBOROUGH])).toBe(
      `{title: Amazing Grace}
{artist: John Newton}
{key: G}
{title: Amazing Grace}
{artist: John Newton}
{key: G}
{section: Verse 1}
[G]Amazing [D]grace, how [G]sweet the [Em]sound
That [C]saved a [D]wretch like [G]me
{section: Verse 2}
'Twas [G]grace that [D]taught my [G]heart to [Em]fear

{title: Scarborough Fair}
{artist: Traditional}
{key: Em}
{title: Scarborough Fair}
{artist: Traditional}
{key: Em}
[Em]Are you going to [D]Scarborough [Em]Fair`,
    )
  })
})
