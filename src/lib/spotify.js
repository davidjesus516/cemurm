// @ts-check
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

/**
 * The track lookup query. `artist` is OPTIONAL on purpose: a title-only lookup
 * is the documented "no confident match" case (the demo asserts it), so callers
 * may omit either half of the pair.
 * @typedef {object} SpotifyQuery
 * @property {string} title
 * @property {string} [artist]
 */

/**
 * The provider match as the LIVE search produces it: `name`/`artist`/`trackId`
 * mirror whatever the picked track carries (an artistless track falls back to
 * the queried artist, which may itself be absent), `albumArtUrl` is null when
 * the track has no art, and `bpm`/`keyIndex` are null when Spotify has no
 * audio-features for it. `mode` is 'major' unless the features say minor.
 * @typedef {object} SpotifyMatch
 * @property {string | undefined} name
 * @property {string | undefined} artist
 * @property {string | null} albumArtUrl
 * @property {number | null} bpm
 * @property {number | null} keyIndex
 * @property {string} mode
 * @property {string | undefined} trackId
 */

/**
 * searchSpotifyMatch's resolved shape, discriminated on `ok`: the failure branch
 * carries 'offline' | 'unavailable', the success branches carry the match
 * (null = no confident match, nothing is written).
 * @typedef {{ ok: false, error: string } | { ok: true, match: null } | { ok: true, match: SpotifyMatch }} SpotifyResult
 */

/**
 * The MOCK provider's match (see header): the same record with the canned art
 * URL and the hash-derived 60–179 bpm always resolved, which is what the demo
 * compares numerically.
 * @typedef {SpotifyMatch & { bpm: number, albumArtUrl: string }} SpotifyMockMatch
 */

/**
 * A credited artist of a search row — only `name` is read, first entry wins.
 * @typedef {object} SpotifyArtistCredit
 * @property {string} [name]
 */

/**
 * One track of a search row: `id`/`name` are always present per the API, the
 * artist and album credits are read defensively (first entry wins) and the
 * image sizes are not read at all.
 * @typedef {object} SpotifyTrack
 * @property {string} id
 * @property {string} name
 * @property {SpotifyArtistCredit[]} [artists]
 * @property {{ images?: Array<{ url?: string }> }} [album]
 */

/**
 * The /search `tracks` page — `items` is omitted when the query returns nothing.
 * @typedef {object} SpotifyTracksPage
 * @property {SpotifyTrack[]} [items]
 */

/**
 * The /search envelope.
 * @typedef {object} SpotifySearchBody
 * @property {SpotifyTracksPage} [tracks]
 */

/**
 * The /audio-features entry, read for the key profile (`key` 0 = C … 11 = B,
 * `mode` 0 = minor / 1 = major) and `tempo` (the BPM). All three are absent on
 * a track without an analysis, which is why the reads below guard on type.
 * @typedef {object} SpotifyFeatures
 * @property {number} [key]
 * @property {number} [tempo]
 * @property {number} [mode]
 */

/**
 * The client-credentials token response — only `access_token` is read, and its
 * absence is the 'Spotify token missing' throw.
 * @typedef {object} SpotifyTokenBody
 * @property {string} [access_token]
 */

/**
 * One `scale_catalog` row as resolveCanonicalQuality reads it: the canonical
 * name plus the nullable jsonb `aliases` array.
 * @typedef {object} ScaleCatalogRow
 * @property {string} name
 * @property {string[] | null} [aliases]
 */

/**
 * The equal-spelling verdict canonicalKeyLabel resolves: the label as the user
 * wrote it plus its scale_catalog-canonical form.
 * @typedef {object} KeyLabel
 * @property {string} label
 * @property {string} canonical
 */

/**
 * True when real Spotify credentials are configured (dev mock otherwise).
 * @returns {boolean}
 */
export function isSpotifyConfigured() {
  const { clientId, clientSecret } = spotifyCredentials()
  return Boolean(clientId && clientSecret)
}

/**
 * Online check (guarded for node — no navigator ⇒ online).
 * @returns {boolean}
 */
export function isOnline() {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

/**
 * The client-credentials pair, ''-defaulted when the env vars are absent.
 * @returns {{ clientId: string, clientSecret: string }}
 */
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
 * @param {SpotifyQuery} query
 * @returns {Promise<SpotifyResult>}
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

/**
 * djb2-flavoured title hash — the deterministic seed of the mock contract.
 * @param {string} title
 * @returns {number}
 */
function hashTitle(title) {
  let h = 5381
  const s = String(title || '')
  for (let i = 0; i < s.length; i += 1) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
  return h
}

/**
 * The deterministic dev match (see header): no title+artist, or a title marked
 * 'unconfident', resolves to the no-match branch.
 * @param {string} title
 * @param {string} [artist]
 * @returns {SpotifyResult}
 */
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

/**
 * Exchange the client-credentials pair for a bearer token. Throws when the
 * response is not ok or carries no token — the caller's catch turns either into
 * { ok: false, error: 'unavailable' }.
 * @param {string} clientId
 * @param {string} clientSecret
 * @returns {Promise<string>}
 */
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
  const body = /** @type {SpotifyTokenBody} */ (await res.json())
  if (!body.access_token) throw new Error('Spotify token missing')
  return body.access_token
}

/**
 * Case-folded comparison key — an absent field compares as ''.
 * @param {string | null | undefined} s
 * @returns {string}
 */
function normalize(s) {
  return String(s || '').toLowerCase().trim()
}

/**
 * Confidence 0..1 — exact title match is strong; artist match boosts.
 * @param {SpotifyTrack} track
 * @param {string} title
 * @param {string} [artist]
 * @returns {number}
 */
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

/**
 * The client-credentials search → /audio-features walk. Throws on any
 * transport/HTTP failure — the caller's catch turns that into
 * { ok: false, error: 'unavailable' }, so there is deliberately NO mock fallback
 * here.
 * @param {string} title
 * @param {string} [artist]
 * @returns {Promise<SpotifyResult>}
 */
async function searchRealProvider(title, artist) {
  const { clientId, clientSecret } = spotifyCredentials()
  const token = await fetchSpotifyToken(clientId, clientSecret)
  const q = encodeURIComponent(`${String(title || '').trim()} ${String(artist || '').trim()}`)
  const searchRes = await fetch(`${SPOTIFY_API}/search?type=track&q=${q}&limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!searchRes.ok) throw new Error('Spotify search failed')
  const searchBody = /** @type {SpotifySearchBody} */ (await searchRes.json())

  const track = (searchBody.tracks?.items || []).find(
    (item) => trackScore(item, title, artist) >= MATCH_THRESHOLD,
  )
  if (!track) return { ok: true, match: null }

  const featsRes = await fetch(`${SPOTIFY_API}/audio-features/${track.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!featsRes.ok) throw new Error('Spotify audio-features failed')
  const feats = /** @type {SpotifyFeatures} */ (await featsRes.json())

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
 * @param {number | null | undefined} keyIndex
 * @param {string | null | undefined} [mode]
 * @returns {string}
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
 * @param {string | null | undefined} label
 * @returns {Promise<KeyLabel>}
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

/**
 * The catalog's canonical scale name for a parsed quality word, or null when
 * neither the shorthands nor a reachable catalog row names it.
 * @param {string} quality
 * @param {ScaleCatalogRow[]} scales
 * @returns {string | null}
 */
function resolveCanonicalQuality(quality, scales) {
  // Shorthands already carry the catalog's canonical capitalization so the
  // canonical form is identical with or without a reachable catalog.
  /** @type {Record<string, string>} */
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
  /**
   * @param {unknown} actual
   * @param {unknown} expected
   * @param {string} label
   */
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
  // The two casts state the ok + match branch the mock contract guarantees for
  // this input (the asserts below read through `match`).
  const hit = /** @type {{ ok: boolean, match: SpotifyMockMatch }} */ (await searchSpotifyMatch({ title: 'Way Maker', artist: 'Sinach' }))
  assert(hit.ok, true, 'mock match resolves ok')
  assert(hit.match.bpm >= 60 && hit.match.bpm < 180, true, 'mock bpm in range')
  assert(hit.match.albumArtUrl.startsWith('https://i.scdn.co/image/cemurm-mock-'), true, 'mock art url')
  const again = /** @type {{ ok: boolean, match: SpotifyMockMatch }} */ (await searchSpotifyMatch({ title: 'way maker', artist: 'sinach' }))
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