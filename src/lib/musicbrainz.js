// MusicBrainz enrichment provider (Hito 5 #78): pure + guarded, spotify.js
// pattern — DOM/env access is guarded so this module never explodes in node.
//
// MOCK PROVIDER (default): deterministic dev-contract. Title containing
// 'unconfident'/'nomatch' (case-insensitive) or a missing title/artist →
// { ok: true, match: null } ("no confident match"). Otherwise a plausible
// canned match derived from a hash of the title: year 1970–2020, genre from a
// fixed list, artist echoes the query — all deterministic. Comment: dev mock —
// set VITE_MUSICBRAINZ_LIVE=true for the real API.
//
// LIVE PATH (opt-in): the MusicBrainz WS/2 recording search needs NO
// credentials — only an explicit opt-in (VITE_MUSICBRAINZ_LIVE=true) for
// rate-limit/CORS control during development. Gated by isOnline() like
// spotify.js; any network/CORS/HTTP failure resolves to
// { ok: false, error: 'unavailable' } — NO silent mock fallback (mock ↦ live
// would silently change results in production).
//
// Failure policy: the provider NEVER throws. Offline / any real-API failure
// resolve to { ok: false, error: 'offline'|'unavailable' } or
// { ok: true, match: null } — callers branch on `ok` + `error`.

import { isOnline } from './spotify.js'

/** True when the real MusicBrainz API is opted in (dev mock otherwise). */
export const MB_LIVE = Boolean(import.meta.env?.VITE_MUSICBRAINZ_LIVE)

/**
 * Look up declared metadata on MusicBrainz by title + artist. Resolves:
 *   { ok: true, match: { title, artist, year, genre, source: 'musicbrainz' } }
 *   { ok: true, match: null }  — no confident match (nothing is written)
 *   { ok: false, error: 'offline' | 'unavailable' }  — provider unreachable
 */
export async function searchMusicBrainzMetadata({ title, artist }) {
  if (!isOnline()) return { ok: false, error: 'offline' }
  if (MB_LIVE) {
    try {
      return await searchRealProvider(title, artist)
    } catch {
      return { ok: false, error: 'unavailable' }
    }
  }
  return searchMockProvider(title, artist)
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock provider (deterministic dev contract; see header)
// ─────────────────────────────────────────────────────────────────────────────

function hashTitle(title) {
  let h = 5381
  const s = String(title || '')
  for (let i = 0; i < s.length; i += 1) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
  return h
}

function searchMockProvider(title, artist) {
  const t = String(title || '').trim()
  const a = String(artist || '').trim()
  if (!t || !a || /unconfident|nomatch/i.test(t)) return { ok: true, match: null }
  const h = hashTitle(t.toLowerCase())
  const GENRES = ['worship', 'rock', 'pop', 'folk', 'gospel', 'hymn', 'jazz', 'blues', 'country', 'soul']
  return {
    ok: true,
    match: {
      title: t,
      artist: a,
      // 1970–2020, deterministic per title (declared-only; the import flow
      // still asks before writing year into a song).
      year: 1970 + (h % 51),
      genre: GENRES[h % GENRES.length],
      source: 'musicbrainz',
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Real provider (MusicBrainz WS/2 recording search; VITE_MUSICBRAINZ_LIVE)
// ─────────────────────────────────────────────────────────────────────────────

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2'

async function searchRealProvider(title, artist) {
  const q = `recording:"${String(title || '').trim()}" AND artist:"${String(artist || '').trim()}"`
  const res = await fetch(
    `${MUSICBRAINZ_API}/recording?query=${encodeURIComponent(q)}&fmt=json&limit=5`,
    { headers: { Accept: 'application/json', 'User-Agent': 'CEMURM/0.1 (dev)' } },
  )
  if (!res.ok) throw new Error('MusicBrainz search failed')
  const body = await res.json()
  const rec = body.recordings?.[0]
  if (!rec) return { ok: true, match: null }

  const release = rec.releases?.[0]
  const dateMatch = release?.date ? String(release.date).match(/^(\d{4})/) : null
  return {
    ok: true,
    match: {
      title: rec.title || String(title || '').trim(),
      artist: rec['artist-credit']?.[0]?.name || String(artist || '').trim(),
      year: dateMatch ? Number(dateMatch[1]) : null,
      genre: rec.tags?.[0]?.name || '',
      source: 'musicbrainz',
    },
  }
}

// Self-check: node -e "import('./src/lib/musicbrainz.js').then(m => m.demo())"
export async function demo() {
  const assert = (actual, expected, label) => {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) {
      throw new Error(`musicbrainz demo FAILED: ${label} — got ${a}, expected ${e}`)
    }
  }

  // Mock determinism + noConfident gates.
  const miss = await searchMusicBrainzMetadata({ title: 'Something unconfident', artist: 'X' })
  assert(miss, { ok: true, match: null }, 'unconfident title → no match')
  const noMatch = await searchMusicBrainzMetadata({ title: 'Whomsoever nomatch', artist: 'X' })
  assert(noMatch, { ok: true, match: null }, 'nomatch title → no match')
  const noArtist = await searchMusicBrainzMetadata({ title: 'Song' })
  assert(noArtist, { ok: true, match: null }, 'missing artist → no match')
  const hit = await searchMusicBrainzMetadata({ title: 'Way Maker', artist: 'Sinach' })
  assert(hit.ok, true, 'mock match resolves ok')
  assert(hit.match.source, 'musicbrainz', 'source is musicbrainz')
  assert(hit.match.year >= 1970 && hit.match.year <= 2020, true, 'mock year in 1970–2020')
  assert(typeof hit.match.genre === 'string' && hit.match.genre.length > 0, true, 'mock genre from fixed list')
  assert(hit.match.title, 'Way Maker', 'mock echoes the queried title')
  assert(hit.match.artist, 'Sinach', 'mock echoes the queried artist')
  const again = await searchMusicBrainzMetadata({ title: 'way maker', artist: 'sinach' })
  assert(again.match.year, hit.match.year, 'mock is deterministic across case')
  assert(again.match.genre, hit.match.genre, 'mock genre deterministic across case')

  console.log('musicbrainz demo: all asserts passed')
}