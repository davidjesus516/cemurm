// Spotify enrichment provider (Hito 5 #69): pure + guarded, bandmates.js/midi.js
// pattern — DOM/env access is guarded so this module never explodes in node.
//
// MOCK PROVIDER (default, no credentials): deterministic dev-contract. Title
// containing 'unconfident' (case-insensitive) or a missing title/artist →
// { ok: true, match: null } ("No confident match — refine title or artist").
// Otherwise a plausible canned match derived from a hash of the title: the
// album-art URL is a fake i.scdn.co-style path (the UI has an onError
// placeholder and never fetches it), bpm 60–179, keyIndex 0–11, mode 'major'.
// The REAL Spotify Web API path (client-credentials token → /search → pick
// best track → /audio-features) exists and runs when
// VITE_SPOTIFY_CLIENT_ID + VITE_SPOTIFY_CLIENT_SECRET are configured
// (docs/local-dev.md); the full OAuth connect UX lands with #78 — connection
// here is implicit on first enrichment.
//
// Failure policy: the provider NEVER throws. Offline / missing title+artist /
// any real-API failure resolve to { ok: false, error: 'offline'|'unavailable' }
// or { ok: true, match: null } — callers branch on `ok` + `error`.

import { NOTES_SHARP } from './transpose.js'
import { fetchScales } from './scaleCatalog.js'

/** True when real Spotify credentials are configured (dev mock otherwise). */
export function isSpotifyConfigured() {
  const { clientId, clientSecret } = spotifyCredentials()
  return Boolean(clientId && clientSecret)
}

/** Online check (guarded for node — no navigator ⇒ online). */
export function isOnline() {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

function spotifyCredentials() {
  return {
    clientId: import.meta.env?.VITE_SPOTIFY_CLIENT_ID || '',
    clientSecret: import.meta.env?.VITE_SPOTIFY_CLIENT_SECRET || '',
  }
}

/**
 * Look up a song on Spotify by title + artist. Resolves:
 *   { ok: true, match: { name, artist, albumArtUrl, bpm, keyIndex, mode, trackId } }
 *   { ok: true, match: null }  — no confident match (nothing is written)
 *   { ok: false, error: 'offline' | 'unavailable' }  — provider unreachable
 */
export async function searchSpotifyMatch({ title, artist }) {
  if (!isOnline()) return { ok: false, error: 'offline' }
  if (isSpotifyConfigured()) {
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
  if (!t || !a || /unconfident/i.test(t)) return { ok: true, match: null }
  const h = hashTitle(t.toLowerCase())
  const token = h.toString(36)
  return {
    ok: true,
    match: {
      name: t,
      artist: a,
      albumArtUrl: `https://i.scdn.co/image/cemurm-mock-${token}`,
      bpm: 60 + (h % 120),
      keyIndex: h % 12,
      mode: 'major',
      trackId: `cemurm-mock-${token}`,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Real provider (client-credentials flow; only with configured credentials)
// ─────────────────────────────────────────────────────────────────────────────

const SPOTIFY_API = 'https://api.spotify.com/v1'

async function fetchSpotifyToken(clientId, clientSecret) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error('Spotify token failed')
  const body = await res.json()
  if (!body.access_token) throw new Error('Spotify token missing')
  return body.access_token
}

function normalize(s) {
  return String(s || '').toLowerCase().trim()
}

/** Confidence 0..1 — exact title match is strong; artist match boosts. */
function trackScore(track, title, artist) {
  const t = normalize(track.name)
  const a = normalize(track.artists?.[0]?.name || '')
  const q = normalize(title)
  const qa = normalize(artist)
  let score = 0
  if (t === q) score += 1
  else if (t.includes(q) || q.includes(t)) score += 0.7
  if (a === qa) score += 0.3
  else if (a.includes(qa) || qa.includes(a)) score += 0.15
  return score
}

const MATCH_THRESHOLD = 0.7

async function searchRealProvider(title, artist) {
  const { clientId, clientSecret } = spotifyCredentials()
  const token = await fetchSpotifyToken(clientId, clientSecret)
  const q = encodeURIComponent(`${String(title || '').trim()} ${String(artist || '').trim()}`)
  const searchRes = await fetch(`${SPOTIFY_API}/search?type=track&q=${q}&limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!searchRes.ok) throw new Error('Spotify search failed')
  const searchBody = await searchRes.json()

  const track = (searchBody.tracks?.items || []).find(
    (item) => trackScore(item, title, artist) >= MATCH_THRESHOLD,
  )
  if (!track) return { ok: true, match: null }

  const featsRes = await fetch(`${SPOTIFY_API}/audio-features/${track.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!featsRes.ok) throw new Error('Spotify audio-features failed')
  const feats = await featsRes.json()

  const keyIndex = typeof feats.key === 'number' ? feats.key : null
  return {
    ok: true,
    match: {
      name: track.name,
      artist: track.artists?.[0]?.name || artist,
      albumArtUrl: track.album?.images?.[0]?.url || null,
      bpm: typeof feats.tempo === 'number' ? Math.round(feats.tempo) : null,
      // Spotify key: 0 = C … 11 = B; mode: 0 = minor, 1 = major.
      keyIndex: keyIndex === null ? null : ((keyIndex % 12) + 12) % 12,
      mode: feats.mode === 1 ? 'major' : 'minor',
      trackId: track.id,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Key labelling + equal-spelling canonicalization (scale_catalog model)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Spotify keyIndex (0–11, 0 = C) + mode → 'E major' / 'E minor' label, using
 * the app's NOTES_SHARP spelling (transpose.js). Returns '' when absent.
 * Normalization/canonicalization goes through canonicalKeyLabel().
 */
export function spotifyKeyToLabel(keyIndex, mode) {
  if (keyIndex === null || keyIndex === undefined) return ''
  const note = NOTES_SHARP[((Number(keyIndex) % 12) + 12) % 12]
  if (!note) return ''
  return `${note} ${mode === 'minor' ? 'minor' : 'major'}`
}

/**
 * Equal-spelling model (scenario 6): 'E' ≡ 'E major' (major), 'Em' ≡
 * 'E minor', 'E Ionian' ≡ 'E major'. Collapses aliases + quality shorthands
 * into the scale_catalog's CANONICAL scale name (Major, Natural Minor, …),
 * returning `{ label, canonical }`. NEVER silently conflicts: the enrichment
 * UI compares canonicalKeyLabel(declared base_key) vs the suggestion's
 * canonical and surfaces a warning when they differ — applying a suggestion
 * NEVER writes base_key. Unknown labels pass through with a lowercase
 * canonical so comparisons stay deterministic.
 */
export async function canonicalKeyLabel(label) {
  const raw = String(label || '').trim()
  if (!raw) return { label: '', canonical: '' }
  const m = raw.match(/^([A-G][#b]?)\s*(.*)$/)
  if (!m) return { label: raw, canonical: raw.toLowerCase() }

  const root = m[1]
  const qualityRaw = m[2].trim().toLowerCase()
  if (!qualityRaw) {
    // Bare 'E' reads as major ('E' ≡ 'E major' for major).
    return { label: raw, canonical: `${root} Major` }
  }

  const scales = await fetchScales()
  const canonical = resolveCanonicalQuality(qualityRaw, scales)
  return { label: raw, canonical: canonical ? `${root} ${canonical}` : `${root} ${qualityRaw}` }
}

function resolveCanonicalQuality(quality, scales) {
  // Shorthands already carry the catalog's canonical capitalization so the
  // canonical form is identical with or without a reachable catalog.
  const shorthands = {
    maj: 'Major',
    major: 'Major',
    ionian: 'Major',
    m: 'Natural Minor',
    min: 'Natural Minor',
    minor: 'Natural Minor',
    aeolian: 'Natural Minor',
  }
  const cleaned = shorthands[quality] || quality
  const row = scales.find(
    (s) => s.name.toLowerCase() === cleaned.toLowerCase()
      || (s.aliases || []).some((a) => a.toLowerCase() === cleaned.toLowerCase()),
  )
  return row ? row.name : (shorthands[quality] || null)
}

// Self-check: node -e "import('./src/lib/spotify.js').then(m => m.demo())"
export async function demo() {
  const assert = (actual, expected, label) => {
    if (actual !== expected) {
      throw new Error(`spotify demo FAILED: ${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
    }
  }

  // Mock determinism + gate (node: navigator absent ⇒ online).
  assert(isOnline(), true, 'node is online (no navigator)')
  const miss = await searchSpotifyMatch({ title: 'Something unconfident', artist: 'X' })
  assert(JSON.stringify(miss), JSON.stringify({ ok: true, match: null }), 'unconfident title → no match')
  const noArtist = await searchSpotifyMatch({ title: 'Song' })
  assert(JSON.stringify(noArtist), JSON.stringify({ ok: true, match: null }), 'missing artist → no match')
  const hit = await searchSpotifyMatch({ title: 'Way Maker', artist: 'Sinach' })
  assert(hit.ok, true, 'mock match resolves ok')
  assert(hit.match.bpm >= 60 && hit.match.bpm < 180, true, 'mock bpm in range')
  assert(hit.match.albumArtUrl.startsWith('https://i.scdn.co/image/cemurm-mock-'), true, 'mock art url')
  const again = await searchSpotifyMatch({ title: 'way maker', artist: 'sinach' })
  assert(again.match.bpm, hit.match.bpm, 'mock is deterministic across case')

  // Key label + equal-spelling canonicalization.
  assert(spotifyKeyToLabel(4, 'major'), 'E major', 'keyIndex 4 major → E major')
  assert(spotifyKeyToLabel(4, 'minor'), 'E minor', 'keyIndex 4 minor → E minor')
  assert(spotifyKeyToLabel(0, 'major'), 'C major', 'keyIndex 0 major → C major')
  assert(spotifyKeyToLabel(14, 'major'), 'D major', 'keyIndex wraps mod 12')
  assert(spotifyKeyToLabel(null, 'major'), '', 'null keyIndex → empty')
  const e1 = await canonicalKeyLabel('E major')
  const e2 = await canonicalKeyLabel('E')
  const e3 = await canonicalKeyLabel('E Ionian')
  assert(e1.canonical, 'E Major', 'E major canonical')
  assert(e2.canonical, e1.canonical, 'bare E ≡ E major')
  assert(e3.canonical, e1.canonical, 'Ionian alias ≡ E major')
  const em = await canonicalKeyLabel('Em')
  assert(em.canonical, 'E Natural Minor', 'Em → E Natural Minor (catalog canonical)')
  const gm = await canonicalKeyLabel('G major')
  assert(gm.canonical !== e1.canonical, true, 'G major ≠ E major (never silent conflict)')

  console.log('spotify demo: all asserts passed')
}