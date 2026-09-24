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

import { searchMusicBrainzMetadata } from '../musicbrainz.js'

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

function isChordSite(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^www\./, '')
  return CHORD_SITES.some((site) => host === site || host.endsWith(`.${site}`))
}

function looksLikeId(seg) {
  return !/[A-Za-z]/.test(String(seg || ''))
}

/** Decode + de-slugify one path segment into a title-ish fragment. */
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
    const mb = await searchMusicBrainzMetadata({ title, artist: '' })
    artist = mb.ok && mb.match ? mb.match.artist : ''
  } catch {
    artist = ''
  }

  return { ok: true, chordSite: false, prefill: { title, artist } }
}

// Self-check: node -e "import('./src/lib/importers/urlImport.js').then(m => m.demo())"
export async function demo() {
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
    assert(chord.chordSite === true, 'chord-site flagged')
    assert(chord.message === "We don't import content from chord sites — paste your own chart",
      'exact S15 message')
    assert(chord.prefill.title === 'Way Maker', 'title prefilled from URL slug')

    // 2. Normal URL → title prefill (decoded + de-slugified; parenthesized
    // title parts survive as part of the title).
    const normal = await metadataOnlyFromUrl('https://www.example.com/songs/oceans-(where-feet-may-fail)')
    assert(normal.ok === true && normal.chordSite === false, 'normal URL resolves ok')
    assert(normal.prefill.title === 'Oceans (Where Feet May Fail)', 'slug decoded + de-slugified')
    assert(typeof normal.prefill.artist === 'string', 'artist is best-effort string')

    // 3. Root-ish URL → empty title (nothing derivable, still ok).
    const bare = await metadataOnlyFromUrl('https://example.com/')
    assert(bare.ok === true && bare.prefill.title === '', 'no derivable slug → empty prefill')
    assert(bare.prefill.artist === '', 'no artist when nothing to complete from')

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