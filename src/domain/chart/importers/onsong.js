// @ts-check
// OnSong/ChordPro file importer (Hito 5 #78): pure + guarded (no DOM, no
// fetch). Parses ChordPro text AND OnSong-flavored files into the import
// contract shape for the review queue (T4):
//
//   parseSongFile(text, fileName)
//     → { ok: true, song: { title, artist, genre, year?, sections, chordpro } }
//     → { ok: false, error: 'Could not parse this file' }   (S5, EXACT message)
//
// Contract:
// - LENIENT parser: title/artist/genre/year come from {directive:} lines when
//   present (first occurrence wins); anything else is chart content preserved
//   as-is. OnSong [S:Section] section markers are mapped to their ChordPro
//   {start_of_section: Section} equivalents so the section structure survives
//   into the normalized chart. `sections` = ordered section names for the
//   queue preview; `chordpro` = the normalized chart text (the body stored on
//   import).
// - KeY is deliberately NOT parsed: the import contract declares title/artist/
//   genre/year only — a key is "declared, never guessed", so imported songs
//   land as draft until the user sets one (readiness.js rule 1).
// - MALFORMED = empty / wholly-unparseable content (no { } directive AND no
//   [chord] line AND no lyric text). Any file with chart-like content parses
//   (lenient); a corrupt/binary/empty file fails with the exact S5 message.
//   parseSongFile NEVER throws raw — always returns the ok shape.

/**
 * The parsed import contract (the same shape queue.js declares as
 * ParsedImport): the metadata DECLARED by the file — `year` is null without a
 * {year:} directive, never guessed (readiness.js rule 1) — plus the
 * normalized ChordPro body that becomes the chart content.
 * @typedef {object} ParsedImport
 * @property {string} title
 * @property {string} artist
 * @property {string} genre
 * @property {number | null} year
 * @property {string[]} sections
 * @property {string} chordpro
 */

/**
 * parseSongFile's resolved shape: the ok branch carries the parsed song, the
 * malformed branch the exact S5 error. Declared as a discriminated union so
 * buildImportEntries narrows on `result.ok` the way the S5 contract reads —
 * load-bearing, because the parser's inferred union widens `ok` to boolean and
 * therefore cannot narrow.
 * @typedef {{ ok: true, song: ParsedImport } | { ok: false, error: string }} ParseSongResult
 */

/**
 * Extract the first {name: value} directive from the source, or ''.
 * @param {string} src
 * @param {string} name
 * @returns {string}
 */
function directive(src, name) {
  const re = new RegExp(`\\{${name}\\s*:\\s*([^}]*)\\}`, 'i')
  const m = String(src || '').match(re)
  return m ? m[1].trim() : ''
}

/**
 * {year: 1998} → Number when the value is a plausible 4-digit year, else null.
 * @param {string} src
 * @returns {number | null}
 */
function yearDirective(src) {
  const raw = directive(src, 'year')
  if (!/^\d{4}$/.test(raw)) return null
  return Number(raw)
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function hasLetters(line) {
  return /[A-Za-z]/.test(line)
}

/** ChordPro directive line ({title: X}, {soc}, {start_of_chorus}, …).
 * @param {string} line
 * @returns {boolean} */
function isDirectiveLine(line) {
  return /\{[^}]+\}/.test(line)
}

/** Inline chord line: at least one bracket chord like [G], [C#m7], [B/C#].
 * @param {string} line
 * @returns {boolean} */
function isChordLine(line) {
  return /\[[A-G][#b]?[^\]]*\]/.test(line)
}

/**
 * @param {string} src
 * @returns {boolean}
 */
function looksChartLike(src) {
  if (src.includes('\0')) return false
  const lines = String(src || '').split('\n')
  return lines.some((l) => isDirectiveLine(l) || isChordLine(l) || hasLetters(l))
}

/**
 * Ordered section names for the queue preview. Recognizes the ChordPro
 * section markers ({soc}/{eoc}, {start_of_chorus}, {start_of_section:X},
 * {start_of_verse:X}, {section:X}) and OnSong [S:Section] markers. Consecutive
 * repeats of the same section collapse.
 * @param {string} src
 * @returns {string[]}
 */
function extractSections(src) {
  /** @type {string[]} */
  const names = []
  /**
   * @param {string} name
   */
  const push = (name) => {
    const trimmed = String(name || '').trim()
    const label = trimmed || 'Chorus'
    if (names[names.length - 1] !== label) names.push(label)
  }
  const re = /\{soc\}|\{start_of_chorus\}|\{start_of_(?:section|verse|bridge)\s*:\s*([^}]*)\}|\{section\s*:\s*([^}]*)\}|\[S:([^\]]+)\]/gi
  let m = re.exec(String(src || ''))
  while (m) {
    if (m[0] === '{soc}' || m[0] === '{start_of_chorus}') push('Chorus')
    else push(m[1] || m[2] || m[3] || '')
    m = re.exec(String(src || ''))
  }
  return names
}

/**
 * Normalize OnSong-flavored input into ChordPro: [S:Section] → the
 * {start_of_section: Section} equivalent. Everything else is preserved as-is
 * (the chart body is stored verbatim + section mapping).
 * @param {string} src
 * @returns {string}
 */
function normalizeOnSong(src) {
  return String(src || '')
    .replace(/\[S:([^\]]+)\]/gi, (m, name) => `{start_of_section: ${name.trim()}}`)
    .trim()
}

/**
 * Parse an imported chart file (ChordPro or OnSong-flavored).
 *   { ok: true, song: { title, artist, genre, year?, sections, chordpro } }
 *   { ok: false, error: 'Could not parse this file' }          — malformed
 * @param {string} text
 * @param {string} fileName
 * @returns {ParseSongResult}
 */
// eslint-disable-next-line no-unused-vars -- fileName kept for signature parity; import lineage uses the queue's file object name
export function parseSongFile(text, fileName) {
  const src = String(text ?? '')
  if (!looksChartLike(src)) {
    return { ok: false, error: 'Could not parse this file' }
  }

  const title = directive(src, 'title')
  const artist = directive(src, 'artist')
  const genre = directive(src, 'genre')
  const year = yearDirective(src)
  const sections = extractSections(src)
  const chordpro = normalizeOnSong(src)

  return {
    ok: true,
    song: {
      title,
      artist,
      genre,
      year,
      sections,
      chordpro,
    },
  }
}

// Self-check: node -e "import('./src/domain/chart/importers/onsong.js').then(m => m.demo())"
export function demo() {
  /**
   * @param {unknown} cond
   * @param {string} msg
   */
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`onsong import demo FAILED: ${msg}`)
  }

  // 1. Valid OnSong file → sections mapped + chords preserved.
  const onsong = [
    '{title: Way Maker}',
    '{artist: Sinach}',
    '{genre: worship}',
    '{year: 2019}',
    '[S:Verse 1]',
    '[G]Amazing [D]grace, how [G]sweet the [Em]sound',
    '[S:Chorus]',
    '[C]Light of the [G]world',
    '[C]You overcame, [D]it is done',
  ].join('\n')
  // The cast states the branch the first assert already established: a parsed
  // file resolves the ok branch, so `song` is present.
  const ok = /** @type {{ ok: boolean, song: ParsedImport }} */ (parseSongFile(onsong, 'way-maker.onsong'))
  assert(ok.ok === true, 'valid OnSong file parses')
  assert(ok.song.title === 'Way Maker', 'title directive parsed')
  assert(ok.song.artist === 'Sinach', 'artist directive parsed')
  assert(ok.song.genre === 'worship', 'genre directive parsed')
  assert(ok.song.year === 2019, 'year directive parsed to Number')
  assert(JSON.stringify(ok.song.sections) === JSON.stringify(['Verse 1', 'Chorus']),
    'sections ordered ([S:] markers)')
  assert(ok.song.chordpro.includes('{start_of_section: Verse 1}'), '[S:] mapped to start_of_section')
  assert(ok.song.chordpro.includes('[G]Amazing [D]grace'), 'chord lines preserved as-is')

  // 2. Plain ChordPro (seed-style) → title/sections work too.
  const chordpro = [
    '{title: Amazing Grace}',
    '{artist: John Newton}',
    '{section: Verse 1}',
    '[G]Amazing [D]grace, how [G]sweet the [Em]sound',
    '{start_of_chorus}',
    '[C]Praise the [G]Lord',
    '{end_of_chorus}',
  ].join('\n')
  const plain = /** @type {{ ok: boolean, song: ParsedImport }} */ (parseSongFile(chordpro, 'amazing.chordpro'))
  assert(plain.ok === true, 'plain ChordPro parses')
  assert(plain.song.title === 'Amazing Grace', 'title from {title:}')
  assert(plain.song.year === null, 'absent year directive → null')
  assert(plain.song.sections.includes('Verse 1') && plain.song.sections.includes('Chorus'),
    '{section:} + {soc} both map to sections')

  // 3. Chords-only file still parses (lenient) — no directives needed.
  const chordsOnly = /** @type {{ ok: boolean, song: ParsedImport }} */ (
    parseSongFile('[G]Hello [C]world\n[D]Goodbye', 'riffs.txt')
  )
  assert(chordsOnly.ok === true, 'chords-only chart parses leniently')
  assert(chordsOnly.song.title === '', 'no title directive → empty title')

  // 4. Malformed → EXACT S5 message, never a throw. The casts state the
  //    failing branch both files take: no song, just the S5 error.
  const empty = /** @type {{ ok: boolean, error: string }} */ (parseSongFile('', 'empty.txt'))
  assert(empty.ok === false && empty.error === 'Could not parse this file', 'empty file → exact error')
  const noise = /** @type {{ ok: boolean, error: string }} */ (parseSongFile('=!=-=?%%$§', 'noise.bin'))
  assert(noise.ok === false && noise.error === 'Could not parse this file', 'binary-ish noise → exact error')

  console.log('onsong import demo OK')
}