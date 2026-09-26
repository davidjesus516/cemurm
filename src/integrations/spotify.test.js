// Characterization tests — locks current behaviour before the PR 1b boundary refactor.
// Specified by: features/external-autotagging.feature
// PR 1b will split this module. These tests must pass with ZERO edits.
//
// SCOPE: the three sync exports. canonicalKeyLabel and searchSpotifyMatch are
// deliberately NOT covered — canonicalKeyLabel is async and reads the Supabase
// scale_catalog (data/repositories/scaleCatalog.js), and searchSpotifyMatch
// performs network calls. PR 1b injects the scales; see the report.

import { describe, it, expect, vi, afterEach } from 'vitest'

import { spotifyKeyToLabel, isSpotifyConfigured, isOnline } from './spotify.js'

// ── spotifyKeyToLabel ────────────────────────────────────────────────────────

describe('spotifyKeyToLabel', () => {
  it('maps a 0-based Spotify key index to the app sharp spelling', () => {
    // Spotify keyIndex: 0 = C … 11 = B.
    expect(spotifyKeyToLabel(0, 'major')).toBe('C major')
    expect(spotifyKeyToLabel(1, 'major')).toBe('C# major')
    expect(spotifyKeyToLabel(4, 'major')).toBe('E major')
    expect(spotifyKeyToLabel(11, 'major')).toBe('B major')
  })

  it('appends the mode', () => {
    expect(spotifyKeyToLabel(4, 'major')).toBe('E major')
    expect(spotifyKeyToLabel(4, 'minor')).toBe('E minor')
    expect(spotifyKeyToLabel(0, 'minor')).toBe('C minor')
  })

  it('wraps modulo 12 in both directions', () => {
    expect(spotifyKeyToLabel(12, 'major')).toBe('C major')
    expect(spotifyKeyToLabel(14, 'major')).toBe('D major')
    expect(spotifyKeyToLabel(24, 'major')).toBe('C major')
    expect(spotifyKeyToLabel(-1, 'major')).toBe('B major')
    expect(spotifyKeyToLabel(-13, 'major')).toBe('B major')
    expect(spotifyKeyToLabel(-0, 'major')).toBe('C major')
  })

  it('is sharp-only — a flat key is unreachable from it', () => {
    // FINDING: the table is transpose.js NOTES_SHARP, so keyIndex 1 renders
    // "C# major" and 10 renders "A# major". features/external-autotagging
    // .feature says "The key suggestion follows the equal-spelling model … the
    // stored value still renders in the chart's canonical spelling" — that
    // equalisation lives in canonicalKeyLabel, never here.
    expect(spotifyKeyToLabel(1, 'major')).toBe('C# major')
    expect(spotifyKeyToLabel(3, 'major')).toBe('D# major')
    expect(spotifyKeyToLabel(8, 'major')).toBe('G# major')
    expect(spotifyKeyToLabel(10, 'major')).toBe('A# major')
    for (const label of [spotifyKeyToLabel(1, 'major'), spotifyKeyToLabel(10, 'major')]) {
      expect(label).not.toMatch(/\b(Db|Eb|Gb|Ab|Bb) /)
    }
  })

  it('returns "" for a null or undefined keyIndex', () => {
    expect(spotifyKeyToLabel(null, 'major')).toBe('')
    expect(spotifyKeyToLabel(undefined, 'major')).toBe('')
  })

  it('returns "" for a keyIndex that does not index the table', () => {
    // FINDING: NaN and fractional indices miss the array lookup, and the
    // `if (!note) return ''` guard swallows it.
    expect(spotifyKeyToLabel('abc', 'major')).toBe('')
    expect(spotifyKeyToLabel(NaN, 'major')).toBe('')
    expect(spotifyKeyToLabel(4.7, 'major')).toBe('')
    expect(spotifyKeyToLabel(1.5, 'major')).toBe('')
  })

  it('coerces a numeric string keyIndex', () => {
    expect(spotifyKeyToLabel('4', 'major')).toBe('E major')
    expect(spotifyKeyToLabel('0', 'major')).toBe('C major')
  })

  it('labels minor ONLY for the exact string "minor" — everything else is major', () => {
    // FINDING: the check is `mode === 'minor'`, so a capitalised, spaced or
    // numeric mode silently becomes major. A caller passing Spotify's raw
    // mode int (0 = minor) gets a wrong label with no error.
    for (const mode of ['Minor', 'MINOR', 'minor ', ' minor', 'm', 1, 0, '', null, undefined, true, false]) {
      expect(spotifyKeyToLabel(4, mode)).toBe('E major')
    }
    expect(spotifyKeyToLabel(4, 'minor')).toBe('E minor')
  })

  it('does not vary with the mode when the keyIndex is absent', () => {
    expect(spotifyKeyToLabel(null, 'minor')).toBe('')
    expect(spotifyKeyToLabel(undefined, 'minor')).toBe('')
  })
})

// ── isSpotifyConfigured ──────────────────────────────────────────────────────

describe('isSpotifyConfigured', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns a boolean', () => {
    expect(typeof isSpotifyConfigured()).toBe('boolean')
  })

  it('mirrors the two VITE_SPOTIFY_* env vars it reads', () => {
    // Derived rather than hard-coded, so the assertion holds whatever
    // credentials a given checkout happens to have. The boolean logic is the
    // characterisation: both must be truthy.
    expect(isSpotifyConfigured()).toBe(
      Boolean(import.meta.env.VITE_SPOTIFY_CLIENT_ID && import.meta.env.VITE_SPOTIFY_CLIENT_SECRET),
    )
  })

  it('is false in this repository, which ships no Spotify credentials', () => {
    // .env.local defines only VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, so
    // the mock provider is the default. This is environment-dependent by
    // nature — a developer who adds the vars will see it flip.
    expect(isSpotifyConfigured()).toBe(false)
  })

  it('is false when only one half of the pair is present', () => {
    vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', 'test-client-id')
    expect(isSpotifyConfigured()).toBe(false)
    vi.stubEnv('VITE_SPOTIFY_CLIENT_SECRET', 'test-client-secret')
    expect(isSpotifyConfigured()).toBe(true)
  })

  it('is false for an empty string on either side', () => {
    vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', '')
    vi.stubEnv('VITE_SPOTIFY_CLIENT_SECRET', 'test-client-secret')
    expect(isSpotifyConfigured()).toBe(false)
    vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', 'test-client-id')
    vi.stubEnv('VITE_SPOTIFY_CLIENT_SECRET', '')
    expect(isSpotifyConfigured()).toBe(false)
  })

  it('re-reads the environment on every call — nothing is memoised', () => {
    // The credential read happens inside the function body, so flipping the env
    // takes effect immediately with no cache to invalidate.
    expect(isSpotifyConfigured()).toBe(false)
    vi.stubEnv('VITE_SPOTIFY_CLIENT_ID', 'a')
    vi.stubEnv('VITE_SPOTIFY_CLIENT_SECRET', 'b')
    expect(isSpotifyConfigured()).toBe(true)
    vi.unstubAllEnvs()
    expect(isSpotifyConfigured()).toBe(false)
  })
})

// ── isOnline ─────────────────────────────────────────────────────────────────

describe('isOnline', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a boolean', () => {
    expect(typeof isOnline()).toBe('boolean')
  })

  it('is true in this node environment', () => {
    // FINDING: the source comment says "no navigator ⇒ online", but node ≥ 21
    // DOES define a global navigator. It has no `onLine` property, so the
    // `navigator.onLine !== false` branch is taken and still yields true.
    expect(isOnline()).toBe(true)
  })

  it('is false only when navigator.onLine is exactly false', () => {
    // "A song enriched from Spotify stays offline-first … no new Spotify call
    // is made while offline" hangs off this single `!== false` comparison.
    vi.stubGlobal('navigator', { onLine: false })
    expect(isOnline()).toBe(false)
    vi.stubGlobal('navigator', { onLine: true })
    expect(isOnline()).toBe(true)
  })

  it('is true for a navigator with no onLine property at all', () => {
    // FINDING: `undefined !== false`, so a navigator without onLine (node, or a
    // bare stub) reads as ONLINE rather than unknown.
    vi.stubGlobal('navigator', {})
    expect(isOnline()).toBe(true)
    vi.stubGlobal('navigator', { onLine: null })
    expect(isOnline()).toBe(true)
    vi.stubGlobal('navigator', { onLine: 0 })
    expect(isOnline()).toBe(true)
    vi.stubGlobal('navigator', { onLine: 'false' })
    expect(isOnline()).toBe(true)
  })

  it('is true when there is no navigator global at all', () => {
    vi.stubGlobal('navigator', undefined)
    expect(isOnline()).toBe(true)
  })
})
