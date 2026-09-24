// LRCLIB lyrics provider (Hito 5 #78): pure + guarded, spotify.js pattern —
// DOM/env access is guarded so this module never explodes in node.
//
// MOCK PROVIDER (default): deterministic dev-contract. Title containing
// 'unconfident'/'nomatch' (case-insensitive) or a missing title/artist →
// { ok: true, match: null } ("no confident match"). Otherwise a deterministic
// template lyric block with the title embedded (dev mock — set
// VITE_LRCLIB_LIVE=true for the real API).
//
// LIVE PATH (opt-in): the lrclib.net API needs NO credentials — only an
// explicit opt-in (VITE_LRCLIB_LIVE=true) for rate-limit/CORS control during
// development. Gated by isOnline() like spotify.js; any network/CORS/HTTP
// failure resolves to { ok: false, error: 'unavailable' } — NO silent mock
// fallback.
//
// Failure policy: the provider NEVER throws. Offline / any real-API failure
// resolve to { ok: false, error: 'offline'|'unavailable' } or
// { ok: true, match: null } — callers branch on `ok` + `error`.

import { isOnline } from './spotify.js'

/** True when the real LRCLIB API is opted in (dev mock otherwise). */
export const LRCLIB_LIVE = Boolean(import.meta.env?.VITE_LRCLIB_LIVE)

/**
 * Look up synced lyrics on LRCLIB by title + artist. Resolves:
 *   { ok: true, match: { lyrics, source: 'lrclib' } }
 *   { ok: true, match: null }  — no confident match (nothing is written)
 *   { ok: false, error: 'offline' | 'unavailable' }  — provider unreachable
 */
export async function fetchLrclibLyrics({ title, artist }) {
  if (!isOnline()) return { ok: false, error: 'offline' }
  if (LRCLIB_LIVE) {
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

function searchMockProvider(title, artist) {
  const t = String(title || '').trim()
  const a = String(artist || '').trim()
  if (!t || !a || /unconfident|nomatch/i.test(t)) return { ok: true, match: null }
  return {
    ok: true,
    match: {
      lyrics: [
        `[00:00.00]${t}`,
        `[00:04.00]${a} — dev mock lyrics (VITE_LRCLIB_LIVE=true for the real API)`,
        `[00:08.00]First line of ${t}`,
        `[00:12.00]Second line of ${t}`,
        `[00:16.00]Final line of ${t}`,
      ].join('\n'),
      source: 'lrclib',
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Real provider (lrclib.net search; VITE_LRCLIB_LIVE)
// ─────────────────────────────────────────────────────────────────────────────

const LRCLIB_API = 'https://lrclib.net/api'

async function searchRealProvider(title, artist) {
  const params = new URLSearchParams({
    track_name: String(title || '').trim(),
    artist_name: String(artist || '').trim(),
  })
  const res = await fetch(`${LRCLIB_API}/search?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error('LRCLIB search failed')
  const body = await res.json()
  const hit = (Array.isArray(body) ? body : []).find((r) => r.syncedLyrics || r.plainLyrics)
  if (!hit) return { ok: true, match: null }
  return {
    ok: true,
    match: {
      lyrics: hit.syncedLyrics || hit.plainLyrics || '',
      source: 'lrclib',
    },
  }
}

// Self-check: node -e "import('./src/lib/lrclib.js').then(m => m.demo())"
export async function demo() {
  const assert = (actual, expected, label) => {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) {
      throw new Error(`lrclib demo FAILED: ${label} — got ${a}, expected ${e}`)
    }
  }

  // Mock determinism + noConfident gates.
  const miss = await fetchLrclibLyrics({ title: 'Song unconfident', artist: 'X' })
  assert(miss, { ok: true, match: null }, 'unconfident title → no match')
  const noMatch = await fetchLrclibLyrics({ title: 'Mystery nomatch', artist: 'X' })
  assert(noMatch, { ok: true, match: null }, 'nomatch title → no match')
  const noArtist = await fetchLrclibLyrics({ title: 'Song' })
  assert(noArtist, { ok: true, match: null }, 'missing artist → no match')
  const hit = await fetchLrclibLyrics({ title: 'Way Maker', artist: 'Sinach' })
  assert(hit.ok, true, 'mock match resolves ok')
  assert(hit.match.source, 'lrclib', 'source is lrclib')
  assert(hit.match.lyrics.includes('Way Maker'), true, 'lyrics embed the title')
  assert(hit.match.lyrics.includes('\n'), true, 'lyrics are a multiline block')
  const again = await fetchLrclibLyrics({ title: 'Way Maker', artist: 'Sinach' })
  assert(again.match.lyrics, hit.match.lyrics, 'mock is deterministic for the same input')

  console.log('lrclib demo: all asserts passed')
}