// Pure readiness logic — no DOM, no localStorage, safe in Node.
// ponytail: split from songs.js so computeReadiness is importable in Node.

import { parseChordPro } from './chordpro/parser.js'

/**
 * Compute readiness for a song from its key + body.
 * Returns { status: 'ready'|'draft', reason: string|null }.
 *
 * Readiness rules (BDD order of precedence):
 *   1. No key → "Not ready: missing base key"
 *   2. No body or no chord line → "Not ready: no chord chart"
 *   3. No lyric text → "Not ready: missing lyrics section"
 *   4. All present → ready
 *
 * NOTE (Hito 1): readiness is computed from the single current chart (body + key).
 * Versioned readiness is Hito 3 — no version table here.
 */
export function computeReadiness(song) {
  if (!song || !song.key || !song.key.trim()) {
    return { status: 'draft', reason: 'Not ready: missing base key' }
  }

  if (!song.body || !song.body.trim()) {
    return { status: 'draft', reason: 'Not ready: no chord chart' }
  }

  const parsed = parseChordPro(song.body)
  const lyricsSections = parsed.sections.filter((s) => s.type === 'lyrics')

  // At least one chord line
  const hasChordLine = lyricsSections.some((s) =>
    s.lines.some((l) => l.chords.length > 0),
  )
  if (!hasChordLine) {
    return { status: 'draft', reason: 'Not ready: no chord chart' }
  }

  // At least one lyric text line
  const hasLyricText = lyricsSections.some((s) =>
    s.lines.some((l) => l.text.trim().length > 0),
  )
  if (!hasLyricText) {
    return { status: 'draft', reason: 'Not ready: missing lyrics section' }
  }

  return { status: 'ready', reason: null }
}

// Self-check: node -e "import('./src/lib/readiness.js').then(m => m.demo())"
export function demo() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`readiness demo FAILED: ${msg}`)
  }

  // 1. Complete song → ready
  const complete = computeReadiness({
    key: 'C major',
    body: '{key: C}\n[C]Hello [G]world\n[C]Goodbye',
  })
  assert(complete.status === 'ready', 'complete song should be ready')
  assert(complete.reason === null, 'complete reason should be null')

  // 2. No key → draft
  const noKey = computeReadiness({
    key: '',
    body: '[C]Hello',
  })
  assert(noKey.status === 'draft', 'no key should be draft')
  assert(noKey.reason === 'Not ready: missing base key', 'no key reason')

  // 3. No body → draft
  const noBody = computeReadiness({ key: 'G major', body: '' })
  assert(noBody.status === 'draft', 'no body should be draft')
  assert(noBody.reason === 'Not ready: no chord chart', 'no body reason')

  // 4. Chords but no lyrics → draft
  const chordsOnly = computeReadiness({
    key: 'A major',
    body: '[C][G][Am]',
  })
  assert(chordsOnly.status === 'draft', 'chords-only should be draft')
  assert(chordsOnly.reason === 'Not ready: missing lyrics section', 'chords-only reason')

  // 5. null song
  const missing = computeReadiness(null)
  assert(missing.status === 'draft', 'null song should be draft')

  console.log('readiness demo OK')
}
