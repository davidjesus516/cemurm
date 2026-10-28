// Characterization tests — locks current behaviour before the PR 1b boundary refactor.
// Specified by: features/song-lifecycle.feature
// PR 1b will split this module. These tests must pass with ZERO edits.

import { describe, it, expect, vi, afterEach } from 'vitest'

import { computeReadiness, demo } from './readiness.js'

// ── fixtures ────────────────────────────────────────────────────────────────
// Verbatim chart bodies from supabase/seed.sql (public-library set). `key` is the
// song_versions.base_key column, which is what computeReadiness reads.
const AMAZING_GRACE = {
  key: 'G',
  body: `{title: Amazing Grace}
{artist: John Newton}
{key: G}
{section: Verse 1}
[G]Amazing [D]grace, how [G]sweet the [Em]sound
That [C]saved a [D]wretch like [G]me
[G]I once was [D]lost, but [G]now am [Em]found
Was [C]blind, but [D]now I [G]see
{section: Verse 2}
'Twas [G]grace that [D]taught my [G]heart to [Em]fear
And [C]grace my [D]fears re-[G]lieved
How [G]precious [D]did that [G]grace ap-[Em]pear
The [C]hour I [D]first be-[G]lieved`,
}

const OH_SUSANNA = {
  key: 'F',
  body: `{title: Oh! Susanna}
{artist: Stephen Foster}
{key: F}
{section: Verse 1}
[F]I came from Alabama with my [C7]banjo on my [F]knee
{section: Chorus}
Oh, [F]Susanna, oh don't you cry for [C7]me
For I [F]come from Alabama with my [C7]banjo on my [F]knee`,
}

const NOT_READY = 'Not ready: '
const DRAFT = (reason) => ({ status: 'draft', reason })
const READY = { status: 'ready', reason: null }

// ── happy path on real seed data ─────────────────────────────────────────────

describe('computeReadiness — real seeded charts', () => {
  it('reports both seeded public-library charts as ready', () => {
    expect(computeReadiness(AMAZING_GRACE)).toEqual(READY)
    expect(computeReadiness(OH_SUSANNA)).toEqual(READY)
  })

  it('reads song.key, never the {key} directive inside the body', () => {
    // FINDING: the parser already extracts meta.key from the body, but
    // computeReadiness ignores it and reads the song column. Drop that column
    // and a body carrying its own {key: G} is still "missing base key".
    expect(computeReadiness({ body: AMAZING_GRACE.body })).toEqual(DRAFT(`${NOT_READY}missing base key`))
  })
})

// ── rule 1: missing base key wins over everything ────────────────────────────

describe('computeReadiness — missing base key', () => {
  it('returns the documented reason for an absent, blank or non-string-ish key', () => {
    const reason = `${NOT_READY}missing base key`
    expect(computeReadiness({ key: '', body: '[C]Hello' })).toEqual(DRAFT(reason))
    expect(computeReadiness({ key: null, body: '[C]Hello' })).toEqual(DRAFT(reason))
    expect(computeReadiness({ key: '   ', body: '[C]Hello' })).toEqual(DRAFT(reason))
    expect(computeReadiness({ key: 0, body: '[C]Hello' })).toEqual(DRAFT(reason))
  })

  it('returns it for a null, undefined or empty song', () => {
    const reason = `${NOT_READY}missing base key`
    expect(computeReadiness(null)).toEqual(DRAFT(reason))
    expect(computeReadiness(undefined)).toEqual(DRAFT(reason))
    expect(computeReadiness({})).toEqual(DRAFT(reason))
  })

  it('beats a complete PDF scan', () => {
    expect(computeReadiness({ key: '', body: '', hasPdfChart: true, sizeBytes: 1024 })).toEqual(
      DRAFT(`${NOT_READY}missing base key`),
    )
  })

  it('treats a truthy non-string key as a missing key rather than crashing', () => {
    // The assertion this replaces asserted that both of these THROW, and said
    // the throw is why the case is recorded. A crash is the bug: readiness is
    // read on a list render, so one malformed key takes the whole page down
    // rather than one badge.
    //
    // `song_versions.base_key` is `text` (0001_init.sql), so a non-string key
    // is not a shape this schema produces — but the guard belongs to the
    // reader, and the reader is what runs first.
    for (const key of [123, {}, true, [], Symbol('k')]) {
      expect(computeReadiness({ key, body: '[C]Hello' }).status, String(key)).toBe('draft')
      expect(computeReadiness({ key, body: '[C]Hello' }).reason, String(key)).toBe(`${NOT_READY}missing base key`)
    }
    // A null song is still tolerated, as before.
    expect(computeReadiness(null).status).toBe('draft')
    expect(computeReadiness(undefined).status).toBe('draft')
  })
})

// ── rule 2: PDF scan ─────────────────────────────────────────────────────────

describe('computeReadiness — PDF scan', () => {
  it('is ready when a scan is present and non-empty', () => {
    expect(computeReadiness({ key: 'G major', body: '', hasPdfChart: true, sizeBytes: 1024 })).toEqual(READY)
  })

  it('treats sizeBytes 0, negative, null, missing and NaN as "no PDF scan"', () => {
    // FINDING: "Not ready: no PDF scan" appears nowhere in
    // features/song-lifecycle.feature — the reason string is undocumented.
    const reason = `${NOT_READY}no PDF scan`
    for (const sizeBytes of [0, -1, null, undefined, NaN]) {
      expect(computeReadiness({ key: 'C major', body: '', hasPdfChart: true, sizeBytes })).toEqual(DRAFT(reason))
    }
  })

  it('coerces sizeBytes with `> 0`, so a numeric string counts as present', () => {
    // FINDING: relational coercion means a stringified byte count from a JSON
    // round-trip still reads as a scan, while the string "0" does not.
    expect(computeReadiness({ key: 'C major', hasPdfChart: true, sizeBytes: '1024' })).toEqual(READY)
    expect(computeReadiness({ key: 'C major', hasPdfChart: true, sizeBytes: '0' })).toEqual(
      DRAFT(`${NOT_READY}no PDF scan`),
    )
    expect(computeReadiness({ key: 'C major', hasPdfChart: true, sizeBytes: 'abc' })).toEqual(
      DRAFT(`${NOT_READY}no PDF scan`),
    )
  })

  it('ignores the ChordPro body completely on the PDF branch', () => {
    // FINDING: a scan of a blank page plus a key reports "ready" — the body is
    // never read once hasPdfChart is truthy.
    expect(computeReadiness({ key: 'C major', body: '', hasPdfChart: true, sizeBytes: 5 })).toEqual(READY)
    expect(computeReadiness({ key: 'C major', body: null, hasPdfChart: true, sizeBytes: 5 })).toEqual(READY)
  })

  it('treats any truthy hasPdfChart as the PDF branch, not just `true`', () => {
    expect(computeReadiness({ key: 'C major', hasPdfChart: 'yes', sizeBytes: 1 })).toEqual(READY)
  })

  it('falls through to the ChordPro path when hasPdfChart is false', () => {
    expect(computeReadiness({ key: 'A major', body: '[C][G][Am]', hasPdfChart: false })).toEqual(
      DRAFT(`${NOT_READY}missing lyrics section`),
    )
  })
})

// ── rule 3: no chord chart ───────────────────────────────────────────────────

describe('computeReadiness — no chord chart', () => {
  it('is the reason for an empty, null or whitespace-only body', () => {
    const reason = `${NOT_READY}no chord chart`
    expect(computeReadiness({ key: 'G major', body: '' })).toEqual(DRAFT(reason))
    expect(computeReadiness({ key: 'G major', body: null })).toEqual(DRAFT(reason))
    expect(computeReadiness({ key: 'G major', body: undefined })).toEqual(DRAFT(reason))
    expect(computeReadiness({ key: 'G major', body: '  \n\n ' })).toEqual(DRAFT(reason))
  })

  it('is the reason for a body with lyrics but no chord line', () => {
    // "Missing chord chart blocks the ready state" scenario.
    expect(computeReadiness({ key: 'C', body: 'Just words here' })).toEqual(DRAFT(`${NOT_READY}no chord chart`))
  })

  it('is the reason for a body made only of directives (no lyrics section at all)', () => {
    expect(computeReadiness({ key: 'C', body: '{title: X}' })).toEqual(DRAFT(`${NOT_READY}no chord chart`))
  })

  it('is the reason when the only chords live inside a non-lyrics section', () => {
    // FINDING: {comment}/{section}/{unknown} directives produce their own
    // section types, and only 'lyrics' sections are scanned for chords.
    expect(computeReadiness({ key: 'C', body: '{comment: [C]hello}' })).toEqual(DRAFT(`${NOT_READY}no chord chart`))
    expect(computeReadiness({ key: 'C', body: '{section: [C]Chorus}' })).toEqual(DRAFT(`${NOT_READY}no chord chart`))
    expect(computeReadiness({ key: 'C', body: '{foo: [C]hello}' })).toEqual(DRAFT(`${NOT_READY}no chord chart`))
  })

  it('accepts a whitespace-padded body, because only the outer trim is checked', () => {
    expect(computeReadiness({ key: 'C', body: ' [C]x ' })).toEqual(READY)
  })
})

// ── rule 4: no lyric text ────────────────────────────────────────────────────

describe('computeReadiness — missing lyrics section', () => {
  it('is the reason for a chart of chords with no lyric text', () => {
    // "Incomplete chart is flagged as not ready" scenario.
    expect(computeReadiness({ key: 'A major', body: '[C][G][Am]' })).toEqual(
      DRAFT(`${NOT_READY}missing lyrics section`),
    )
  })

  it('is the reason when the only lyric text is whitespace', () => {
    expect(computeReadiness({ key: 'A major', body: '[C]   ' })).toEqual(DRAFT(`${NOT_READY}missing lyrics section`))
  })

  it('takes precedence over nothing — a chord line must already exist', () => {
    // The two ChordPro rules are ordered: chords are checked first.
    expect(computeReadiness({ key: 'A major', body: '   [C]   ' })).toEqual(DRAFT(`${NOT_READY}missing lyrics section`))
    expect(computeReadiness({ key: 'A major', body: '   ' })).toEqual(DRAFT(`${NOT_READY}no chord chart`))
  })
})

// ── rule 5: global, not per-section ──────────────────────────────────────────

describe('computeReadiness — scope of the scan', () => {
  it('is satisfied by chords in one section and text in a DIFFERENT section', () => {
    // FINDING: hasChordLine and hasLyricText are two independent `.some` scans
    // over all lyrics sections, so they never have to be the same line or even
    // the same section. A chart with a chord-only verse and a text-only chorus
    // reports "ready".
    expect(computeReadiness({ key: 'C', body: '{section: V}\n[C]\n{section: Cho}\nsung words' })).toEqual(READY)
    expect(computeReadiness({ key: 'C', body: '[C][G][Am]\nsome text' })).toEqual(READY)
  })

  it('only ever inspects sections of type "lyrics"', () => {
    expect(computeReadiness({ key: 'C', body: '[C]Has both' })).toEqual(READY)
    expect(computeReadiness({ key: 'C', body: '{comment: [C]a}\n{comment: text}' })).toEqual(
      DRAFT(`${NOT_READY}no chord chart`),
    )
  })

  it('handles a non-ASCII lyric line', () => {
    expect(computeReadiness({ key: 'C', body: '[C]Canción Café' })).toEqual(READY)
  })
})

// ── return shape ─────────────────────────────────────────────────────────────

describe('computeReadiness — return contract', () => {
  it('returns exactly { status, reason } and never mutates the song', () => {
    const song = { key: 'C', body: '[C]x' }
    const before = JSON.stringify(song)
    const result = computeReadiness(song)
    expect(Object.keys(result)).toEqual(['status', 'reason'])
    expect(JSON.stringify(song)).toBe(before)
  })

  it('only ever produces status "ready" or "draft" — never retired or deleted', () => {
    // FINDING: features/song-lifecycle.feature opens with "songs move through
    // clear states — draft, ready, retired, and deleted", but this function is
    // the only readiness entry point and has no vocabulary for retired/deleted.
    const seen = new Set()
    for (const song of [
      { key: 'C', body: '[C]x' },
      { key: 'C', body: '[C]' },
      { key: 'C', body: 'words' },
      { key: '', body: '[C]x' },
      { key: 'C', hasPdfChart: true, sizeBytes: 0 },
      null,
    ]) {
      seen.add(computeReadiness(song).status)
    }
    expect([...seen].sort()).toEqual(['draft', 'ready'])
  })

  it('is per version: two versions of one song answer independently', () => {
    // The assertion this replaces was named "is version-blind: it takes one flat
    // song, so per-version readiness is not here" and said the scenario could not
    // be exercised through this signature. song-lifecycle.feature:34 requires
    // per-version readiness, and song_versions.is_ready exists for it, so the
    // signature moved instead of the requirement.
    //
    // The spec's own example: "Original (artist)" is ready, "Pedro's
    // arrangement" is missing its bridge.
    const original = { id: 'v1', name: 'Original (artist)', key: 'C', body: '[C]Amazing grace' }
    const pedros = { id: 'v2', name: "Pedro's arrangement", key: 'C', body: 'no chords here' }
    expect(computeReadiness(original)).toEqual(READY)
    expect(computeReadiness(pedros)).toEqual(DRAFT(`${NOT_READY}no chord chart`))
  })

  it('reads only the version it is given, never a sibling', () => {
    // Two versions that differ ONLY in key, so a per-song implementation could
    // not tell them apart and would have to blend them.
    const withKey = { id: 'v1', key: 'C', body: '[C]x' }
    const withoutKey = { id: 'v2', key: '', body: '[C]x' }
    expect(computeReadiness(withKey)).toEqual(READY)
    expect(computeReadiness(withoutKey)).toEqual(DRAFT(`${NOT_READY}missing base key`))
  })

  it('reads the version own PDF scan, not the song current chart', () => {
    // Per-version chart identity (#76): one version scanned, one still
    // ChordPro. A per-song implementation answered for both from one chart.
    const scanned = { id: 'v1', key: 'C', body: '', hasPdfChart: true, sizeBytes: 4096 }
    const text = { id: 'v2', key: 'C', body: '', hasPdfChart: false, sizeBytes: 0 }
    expect(computeReadiness(scanned)).toEqual(READY)
    expect(computeReadiness(text)).toEqual(DRAFT(`${NOT_READY}no chord chart`))
  })
})

// ── demo() (the module's own self-check) ─────────────────────────────────────

describe('demo()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runs every internal assert without throwing, and logs one line', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    expect(() => demo()).not.toThrow()
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0][0]).toContain('readiness demo OK')
  })
})
