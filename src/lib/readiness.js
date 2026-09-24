// Pure readiness logic — no DOM, no localStorage, safe in Node.
// ponytail: split from songs.js so computeReadiness is importable in Node.

import { parseChordPro } from './chordpro/parser.js'

/**
 * Compute readiness for a song from its key + body.
 * Returns { status: 'ready'|'draft', reason: string|null }.
 *
 * Readiness rules (BDD order of precedence):
 *   1. No key → "Not ready: missing base key"
 *   2. PDF scan (hasPdfChart, Hito 5 #76): the scan IS the chart — ready when
 *      a non-empty scan exists (sizeBytes > 0). "Legible" = non-empty scan;
 *      visual legibility of the scan is human QA (documented limitation).
 *   3. (ChordPro) No body or no chord line → "Not ready: no chord chart"
 *   4. (ChordPro) No lyric text → "Not ready: missing lyrics section"
 *   5. All present → ready
 *
 * NOTE (Hito 1): readiness is computed from the single current chart (body + key).
 * Versioned readiness is Hito 3 — no version table here.
 */
export function computeReadiness(song) {
  if (!song || !song.key || !song.key.trim()) {
    return { status: 'draft', reason: 'Not ready: missing base key' }
  }

  if (song.hasPdfChart) {
    return (song.sizeBytes ?? 0) > 0
      ? { status: 'ready', reason: null }
      : { status: 'draft', reason: 'Not ready: no PDF scan' }
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

  // ── Hito 5 #76: PDF scan branch ─────────────────────────────────────────
  // 6. PDF with key + non-empty scan → ready ("legible" = non-empty scan)
  const pdfReady = computeReadiness({
    key: 'G major',
    body: '',
    hasPdfChart: true,
    sizeBytes: 1024,
  })
  assert(pdfReady.status === 'ready', 'pdf with key + scan should be ready')
  assert(pdfReady.reason === null, 'pdf ready reason should be null')

  // 7. PDF without key → draft (missing base key wins)
  const pdfNoKey = computeReadiness({ key: '', body: '', hasPdfChart: true, sizeBytes: 1024 })
  assert(pdfNoKey.status === 'draft', 'pdf without key should be draft')
  assert(pdfNoKey.reason === 'Not ready: missing base key', 'pdf no-key reason')

  // 8. PDF with key but empty scan → draft
  const pdfEmpty = computeReadiness({ key: 'C major', body: '', hasPdfChart: true, sizeBytes: 0 })
  assert(pdfEmpty.status === 'draft', 'pdf with empty scan should be draft')
  assert(pdfEmpty.reason === 'Not ready: no PDF scan', 'pdf empty-scan reason')

  // 9. ChordPro path untouched by the pdf flag
  const chordProWithPdfFlag = computeReadiness({ key: 'A major', body: '[C][G][Am]', hasPdfChart: false })
  assert(chordProWithPdfFlag.reason === 'Not ready: missing lyrics section', 'chordpro path unchanged')

  console.log('readiness demo OK')
}
