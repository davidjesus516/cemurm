// @ts-check
// URL metadata prefill (Hito 5 #78, S14/S15): METADATA-ONLY by design.
//
// HARD RULE: metadataOnlyFromUrl NEVER fetches the pasted URL — parsing is a
// pure `new URL()` + slug-derivation operation; no content is downloaded from
// anywhere. The only network that may happen is the optional MusicBrainz
// artist completion (searchMusicBrainzMetadata — mock by default, opt-in live
// via VITE_MUSICBRAINZ_LIVE), best-effort.
//
// Chord-site domains (documented list) are REFUSED with the exact S15 message
// and an offer to prefill the title from the URL slug:
//   "We don't import content from chord sites — paste your own chart"
// Other URLs prefill title (last meaningful path segment, decoded +
// de-slugified) and best-effort artist (MusicBrainz). Invalid URLs →
// { ok: false, error: 'Enter a valid URL.' }.

import { searchMusicBrainzMetadata } from './musicbrainz.js'

/**
 * MusicBrainz match (musicbrainz.js) — the `artist` the prefill copies is
 * always a string (the provider falls back to the queried value), the rest of
 * the record is declared-only metadata this layer does not write. Local mirror
 * on purpose: musicbrainz.js is untyped on this branch.
 * @typedef {object} MusicBrainzMatch
 * @property {string} artist
 * @property {string} [title]
 * @property {number | null} [year]
 * @property {string} [genre]
 * @property {string} [source]
 */

/**
 * searchMusicBrainzMetadata's resolved shape: the failure branches carry
 * `error` ('offline' | 'unavailable'), the success branch carries `match`
 * (null = no confident match). Declared here so the best-effort artist lookup
 * below reads one optional-`match` surface instead of the provider's union.
 * @typedef {object} MusicBrainzResult
 * @property {boolean} [ok]
 * @property {string} [error]
 * @property {MusicBrainzMatch | null} [match]
 */

/**
 * A refused chord-site URL (S15): the exact message plus the slug-derived
 * title as the only offered prefill.
 * @typedef {object} ChordSiteResult
 * @property {true} ok
 * @property {true} chordSite
 * @property {string} message
 * @property {{ title: string }} prefill
 */

/**
 * Any other http(s) URL: the slug-derived title plus the best-effort artist.
 * @typedef {object} PrefillResult
 * @property {true} ok
 * @property {false} chordSite
 * @property {{ title: string, artist: string }} prefill
 */

/**
 * metadataOnlyFromUrl's result. Discriminated on `ok` (and `chordSite` on the
 * success branches) so the `prefill`/`message` reads below narrow — note
 * metadataOnlyFromUrl NEVER throws, the invalid-URL case is `{ ok: false }`.
 * @typedef {{ ok: false, error: string } | ChordSiteResult | PrefillResult} UrlImportResult
 */

/** Chord-tab sites we refuse to scrape (documented list, S15). */
export const CHORD_SITES = [
  'ultimate-guitar.com',
  'e-chords.com',
  'chordie.com',
  'azchords.com',
  'chords.com',
  'guitaretab.com',
  'guitartabs.cc',
]

/** URL slugs that carry no title meaning ('/tab/way-maker-12345'). */
const STOP_WORDS = new Set(['tab', 'tabs', 'chords', 'chord', 'song', 'lyrics', 'guitar', 'tabs'])

/**
 * @param {string} hostname
 * @returns {boolean}
 */
function isChordSite(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^www\./, '')
  return CHORD_SITES.some((site) => host === site || host.endsWith(`.${site}`))
}

/**
 * @param {string} seg
 * @returns {boolean}
 */
function looksLikeId(seg) {
  return !/[A-Za-z]/.test(String(seg || ''))
}

/** Decode + de-slugify one path segment into a title-ish fragment. *
 * @param {string} seg
 * @returns {string}
 */
function deSlugify(seg) {
  let cleaned = ''
  try {
    cleaned = decodeURIComponent(String(seg || ''))
  } catch {
    cleaned = String(seg || '')
  }
  cleaned = cleaned
    .replace(/\.(html?|htm|php)$/i, '')
    .replace(/[-_+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  const words = cleaned.split(' ').filter((w) => !STOP_WORDS.has(w.toLowerCase()))
  if (!words.length) return ''
  return words
    .map((w) => (w.toLowerCase() === w ? w.replace(/^([^a-z]*)([a-z])/, (_, pre, ch) => pre + ch.toUpperCase()) : w))
    .join(' ')
}

/**
 * Title from the LAST meaningful path segment (decoded + de-slugified) —
 * numeric-id segments and formatting words are skipped backwards.
 * @param {string} pathname
 * @returns {string}
 */
export function titleFromPathname(pathname) {
  const segs = String(pathname || '').split('/').filter(Boolean)
  for (let i = segs.length - 1; i >= 0; i -= 1) {
    if (looksLikeId(segs[i])) continue
    // Trailing numeric id inside the last segment ('way-maker-chords-4819203').
    const t = deSlugify(String(segs[i]).replace(/-\d+$/, ''))
    if (t) return t
  }
  return ''
}

/**
 * Metadata-only prefill from a pasted URL. NEVER fetches the URL itself.
 *   { ok: true, chordSite: true,  message: '<S15 exact message>', prefill: { title } }
 *   { ok: true, chordSite: false, prefill: { title, artist } }
 *   { ok: false, error: 'Enter a valid URL.' }
 * @param {string} rawUrl
 * @returns {Promise<UrlImportResult>}
 */
export async function metadataOnlyFromUrl(rawUrl) {
  let url
  try {
    url = new URL(String(rawUrl || '').trim())
  } catch {
    return { ok: false, error: 'Enter a valid URL.' }
  }
  if (!/^https?:$/.test(url.protocol)) {
    return { ok: false, error: 'Enter a valid URL.' }
  }

  const title = titleFromPathname(url.pathname)

  if (isChordSite(url.hostname)) {
    return {
      ok: true,
      chordSite: true,
      message: "We don't import content from chord sites — paste your own chart",
      prefill: { title },
    }
  }

  // Best-effort artist completion via MusicBrainz (mock by default; empty
  // when unavailable — a missing artist never fails the prefill).
  let artist = ''
  try {
    const mb = /** @type {MusicBrainzResult} */ (await searchMusicBrainzMetadata({ title, artist: '' }))
    artist = mb.ok && mb.match ? mb.match.artist : ''
  } catch {
    artist = ''
  }

  return { ok: true, chordSite: false, prefill: { title, artist } }
}

// Self-check: node -e "import('./src/integrations/urlImport.js').then(m => m.demo())"
export async function demo() {
  /**
   * @param {unknown} cond
   * @param {string} msg
   */
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`url import demo FAILED: ${msg}`)
  }

  // Any real fetch would mean the rule broke — prove NO network occurs while
  // running the whole demo (the MusicBrainz completion is mock-by-default and
  // performs no fetch either).
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => { throw new Error('url import MUST NOT fetch') }
  try {
    // 1. Chord-site URL → exact S15 message + slug-derived title prefill.
    const chord = await metadataOnlyFromUrl('https://tabs.ultimate-guitar.com/tab/way-maker-chords-4819203')
    assert(chord.ok === true, 'chord-site URL resolves ok')
    assert(/** @type {ChordSiteResult} */ (chord).chordSite === true, 'chord-site flagged')
    assert(/** @type {ChordSiteResult} */ (chord).message === "We don't import content from chord sites — paste your own chart",
      'exact S15 message')
    assert(/** @type {ChordSiteResult} */ (chord).prefill.title === 'Way Maker',
      'title prefilled from URL slug')

    // 2. Normal URL → title prefill (decoded + de-slugified; parenthesized
    // title parts survive as part of the title).
    const normal = await metadataOnlyFromUrl('https://www.example.com/songs/oceans-(where-feet-may-fail)')
    assert(normal.ok === true && normal.chordSite === false, 'normal URL resolves ok')
    assert(/** @type {PrefillResult} */ (normal).prefill.title === 'Oceans (Where Feet May Fail)', 'slug decoded + de-slugified')
    assert(typeof /** @type {PrefillResult} */ (normal).prefill.artist === 'string', 'artist is best-effort string')

    // 3. Root-ish URL → empty title (nothing derivable, still ok).
    const bare = await metadataOnlyFromUrl('https://example.com/')
    assert(bare.ok === true && /** @type {PrefillResult} */ (bare).prefill.title === '', 'no derivable slug → empty prefill')
    assert(/** @type {PrefillResult} */ (bare).prefill.artist === '', 'no artist when nothing to complete from')

    // 4. Invalid URLs → exact error, no throw.
    const bad = await metadataOnlyFromUrl('not a url at all')
    assert(bad.ok === false && bad.error === 'Enter a valid URL.', 'invalid URL → exact error')
    const otherProto = await metadataOnlyFromUrl('ftp://example.com/file')
    assert(otherProto.ok === false && otherProto.error === 'Enter a valid URL.', 'non-http(s) → exact error')
  } finally {
    globalThis.fetch = originalFetch
  }

  console.log('url import demo OK')
}