// @ts-check
// Pure search helpers for the repertoire — no DOM, no localStorage, safe in Node.
// Composes title, chord, key, and tempo filters (AND). Mirrors the future
// Supabase query surface so chunk C8 can swap the implementation without
// touching the hook or UI.
//
// Scenario coverage: features/search-and-discovery.feature (BASIC SEARCH),
// features/public-library-community.feature (catalog search + license filter).

import { parseChordPro } from '../chart/parser.js'

/**
 * The song fields the search layer actually reads: title/body for the
 * free-text and chord match, key for the exact key filter, bpm for the
 * inclusive range. A full songs.js `Song` row satisfies it structurally, so
 * filterSongs returns the caller's own song type rather than a projection.
 * @typedef {object} SearchableSong
 * @property {string} title
 * @property {string} body
 * @property {string | null} [key]
 * @property {number | null} [bpm]
 */

/**
 * Inclusive bpm window, as produced by parseTempoRange.
 * @typedef {object} TempoRange
 * @property {number} min
 * @property {number} max
 */

/**
 * filterSongs filter bag. Every field is optional and an absent field means
 * "no filter"; `tempo` is either a raw "70-100" string (parsed here) or an
 * already-parsed range (Songs.jsx holds whichever it was given).
 * @typedef {object} SongFilters
 * @property {string} [query]
 * @property {string} [key]
 * @property {string | TempoRange | null} [tempo]
 */

/**
 * The public_library_entries (0010 view) fields the catalog filter reads. The
 * demo fixtures and publicLibrary.js rows both satisfy it.
 * @typedef {object} CatalogEntry
 * @property {string} id
 * @property {string} title
 * @property {string | null} [artist]
 * @property {string | null} [genre]
 * @property {string} license
 */

/**
 * filterPublicEntries filter bag. Both fields optional, absent means "all".
 * @typedef {object} CatalogFilters
 * @property {string} [query]
 * @property {string} [license]
 */

/**
 * Extract unique chord names from a ChordPro body, in document order.
 * Parses the body and collects bare chord tokens from [Chord] markers
 * (e.g. body with [G] [C] [Em] → ["G", "C", "Em"]).
 * @param {string | null | undefined} body
 * @returns {string[]}
 */
export function extractChords(body) {
  /** @type {string[]} */
  const seen = []
  const parsed = parseChordPro(body ?? '')
  for (const section of parsed.sections) {
    for (const line of section.lines) {
      for (const { chord } of line.chords) {
        const name = chord.trim()
        if (name && !seen.includes(name)) seen.push(name)
      }
    }
  }
  return seen
}

/**
 * "70-100" → {min:70, max:100}; "70 - 100" → same; "70" → {min:70, max:70};
 * empty or unparseable input → null (callers treat null as "no filter").
 * Non-numeric segments (e.g. "70-abc") are rejected, not clamped.
 * @param {string | number | null | undefined} value
 * @returns {TempoRange | null}
 */
export function parseTempoRange(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const parts = text.split('-').map((p) => p.trim())
  if (parts.some((p) => !/^\d+$/.test(p))) return null
  const nums = parts.map(Number)
  return { min: Math.min(...nums), max: Math.max(...nums) }
}

/**
 * Strip a " major"/" minor" qualifier from a chord query ("G major" → "g").
 * Pragmatic normalization: chart chords are bare tokens ("G", "Em", "G7",
 * "F#m"), so the qualifier only matters for prefix matching below.
 * @param {string | null | undefined} query
 * @returns {string}
 */
function chordPrimitive(query) {
  return String(query ?? '').trim().toLowerCase().replace(/\s+(major|minor)$/, '')
}

/**
 * Free-text match over title AND extracted chord names (case-insensitive).
 * - Title: substring match ("Amazing" hits "Amazing Grace").
 * - Chords: the query's primitive must equal a chord name or be a prefix of
 *   it — "G" matches G and G7; "G major" matches G (qualifier stripped).
 *   Pragmatic, documented ceiling: "G" also prefixes Gm/Gb; exact chord
 *   spelling is a later hito.
 * Empty query matches everything.
 * @param {SearchableSong} song
 * @param {string | null | undefined} query
 * @returns {boolean}
 */
export function songMatchesQuery(song, query) {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return true
  if (song.title.toLowerCase().includes(q)) return true
  const primitive = chordPrimitive(q)
  return extractChords(song.body).some((chord) => {
    const name = chord.toLowerCase()
    return name === primitive || name.startsWith(primitive)
  })
}

/**
 * Exact case-insensitive key match; empty/undefined key filter → true.
 * @param {SearchableSong} song
 * @param {string | null | undefined} key
 * @returns {boolean}
 */
export function songMatchesKey(song, key) {
  const k = String(key ?? '').trim().toLowerCase()
  if (!k) return true
  return String(song.key ?? '').trim().toLowerCase() === k
}

/**
 * Inclusive bpm range check. Songs without a bpm never match when a range
 * is set. range = null → no filter.
 * @param {SearchableSong} song
 * @param {TempoRange | null | undefined} range
 * @returns {boolean}
 */
export function songMatchesTempo(song, range) {
  if (!range) return true
  if (song.bpm == null) return false
  return song.bpm >= range.min && song.bpm <= range.max
}

/**
 * Chords in the song's body that match a chord query — used to tag results
 * ("matched chord: G"). Returns [] for title-only matches or empty query.
 * @param {SearchableSong} song
 * @param {string | null | undefined} query
 * @returns {string[]}
 */
export function matchedChords(song, query) {
  const primitive = chordPrimitive(query)
  if (!primitive) return []
  return extractChords(song.body).filter((chord) => {
    const name = chord.toLowerCase()
    return name === primitive || name.startsWith(primitive)
  })
}

/**
 * Compose query + key + tempo filters (AND).
 * `tempo` may be a raw string ("70-100") or a parsed {min, max} range;
 * invalid raw strings → null → no tempo filter.
 * Generic over the caller's song type (the withReadThrough precedent in
 * songs.js): a songs.js `Song[]` comes back as `Song[]`, not as the
 * SearchableSong projection the predicates read.
 * @template {SearchableSong} S
 * @param {S[] | null | undefined} songs
 * @param {SongFilters} [filters]
 * @returns {S[]}
 */
export function filterSongs(songs, { query = '', key = '', tempo } = {}) {
  const range = typeof tempo === 'string' ? parseTempoRange(tempo) : tempo
  return (songs || []).filter(
    (s) => songMatchesQuery(s, query) && songMatchesKey(s, key) && songMatchesTempo(s, range),
  )
}

/**
 * Public library catalog filter (AND): free-text over title/artist/genre +
 * exact license match. S4.1 — mirrors the client-side "ponytail" used in
 * Songs.jsx: bounded catalog, no server-side composition yet.
 * @template {CatalogEntry} T
 * @param {T[] | null | undefined} entries
 * @param {CatalogFilters} [filters]
 * @returns {T[]}
 */
export function filterPublicEntries(entries, { query = '', license = '' } = {}) {
  const q = String(query ?? '').trim().toLowerCase()
  return (entries || []).filter((entry) => {
    if (license && entry.license !== license) return false
    if (!q) return true
    return [entry.title, entry.artist, entry.genre]
      .some((v) => String(v || '').toLowerCase().includes(q))
  })
}

// Self-check: node -e "import('./src/domain/library/search.js').then(m => m.demo())"
export function demo() {
  /**
   * @param {unknown} cond
   * @param {string} msg
   */
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`search demo FAILED: ${msg}`)
  }

  // Fixtures mirror the 4 BDD scenarios (search-and-discovery.feature).
  const songs = [
    { id: '1', title: 'Amazing Grace', key: 'G major', bpm: 80, durationSeconds: 180, body: '[G]Amazing [C]grace, how [D]sweet the sound' },
    { id: '2', title: 'Grace of My Mind', key: 'D major', bpm: 120, durationSeconds: 210, body: '[D]Grace [A]of my [Em]mind' },
    { id: '3', title: 'Amazing Day', key: 'G major', bpm: 95, durationSeconds: 200, body: '[C]What a [F]day, what a [G]day' },
    { id: '4', title: 'Hymn of Grace', key: 'C major', bpm: 65, durationSeconds: 150, body: '[C]Every [Am]morning, [F]every night' },
  ]

  // 1. Free-text title search (case-insensitive substring)
  const byTitle = filterSongs(songs, { query: 'Amazing' })
  assert(byTitle.map((s) => s.id).join(',') === '1,3',
    'query "Amazing" matches Amazing Grace + Amazing Day, excludes Grace of My Mind')

  // 2. Chord-name search; results tagged with the matched chord
  const byChord = filterSongs(songs, { query: 'G major' })
  assert(byChord.map((s) => s.id).join(',') === '1,3',
    'chord query "G major" finds both songs containing chord G')
  assert(matchedChords(byChord[0], 'G major').join(',') === 'G',
    'result tagged with the matched chord')
  assert(matchedChords(songs[1], 'Em').join(',') === 'Em',
    'chord query "Em" matches chord Em')
  assert(songMatchesQuery({ title: 'X', body: '[G7]one [G]two' }, 'G'),
    'prefix rule: query "G" matches chord G7')

  // 3. Key-signature filter + count badge
  const byKey = filterSongs(songs, { key: 'G major' })
  assert(byKey.map((s) => s.id).join(',') === '1,3',
    'key filter "G major" shows only G major songs')
  assert(songs.filter((s) => songMatchesKey(s, 'G major')).length === 2,
    'count badge: 2 songs in G major')
  assert(songMatchesKey(songs[0], 'g MAJOR'),
    'key match is case-insensitive')

  // 4. Tempo range (70-100) + parse tolerance
  const byTempo = filterSongs(songs, { tempo: '70-100' })
  assert(byTempo.map((s) => s.id).join(',') === '1,3',
    'tempo range 70-100 shows only songs in range')
  assert(JSON.stringify(parseTempoRange('70 - 100')) === JSON.stringify({ min: 70, max: 100 }),
    'tolerant of spaces around the dash')
  assert(JSON.stringify(parseTempoRange('90')) === JSON.stringify({ min: 90, max: 90 }),
    'single value → exact bpm')
  assert(parseTempoRange('') === null && parseTempoRange('abc') === null,
    'empty/invalid input → null (no filter)')

  // 5. Public library catalog filter (S4.1): free-text + license (AND)
  const catalog = [
    { id: 'c1', title: 'Amazing Grace', artist: 'John Newton', genre: 'hymn', license: 'public-domain' },
    { id: 'c2', title: 'Scarborough Fair', artist: 'Traditional', genre: 'folk', license: 'public-domain' },
    { id: 'c3', title: 'Down to the River', artist: 'Traditional', genre: 'gospel', license: 'CC-BY-4.0' },
  ]
  assert(filterPublicEntries(catalog, { query: 'amazing' }).map((e) => e.id).join(',') === 'c1',
    'catalog query is case-insensitive on title')
  assert(filterPublicEntries(catalog, { query: 'traditional' }).map((e) => e.id).join(',') === 'c2,c3',
    'catalog query matches artist')
  assert(filterPublicEntries(catalog, { license: 'public-domain' }).map((e) => e.id).join(',') === 'c1,c2',
    'license filter hides licensed entries')
  assert(filterPublicEntries(catalog, { query: 'gospel', license: 'CC-BY-4.0' }).map((e) => e.id).join(',') === 'c3',
    'query + license compose with AND')
  assert(filterPublicEntries(catalog).length === 3 && filterPublicEntries(null).length === 0,
    'empty filter returns all; null list returns empty')

  console.log('search demo OK')
}