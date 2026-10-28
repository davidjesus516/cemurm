// @ts-check
// Import queue orchestration (Hito 5 #78, S4/S5/S7/S8): pure-ish data layer
// WITHOUT UI. Builds the per-file review entries, enforces the approval gates,
// and performs the ONLY song-level writes of the import flow:
//
// - buildImportEntries(files, userId): parse every file (per-entry error,
//   batch continues — S5), run duplicate detection against the user's owned
//   titles (S7 "both are flagged"), and detect year/genre conflicts against
//   each flagged candidate (S8 — only meaningful in the merge path, enforced
//   against the merge TARGET at approval).
// - validateEntryForApproval / approveEntry: the gates — parse ok, license
//   confirmed (S9), duplicate decision set when flagged (S7), conflict chosen
//   for the merge target (S8). MALFORMED ENTRIES CAN NEVER WRITE (single
//   song-level write happens only inside approveEntry).
// - approve merge → the existing song gains a chart row + version row
//   (name 'Imported from OnSong', change_note, metadata.import + .conflict
//   chosen record), conflict values land via updateSong(…, 'import')
//   provenance, and the review is audited (canonical_id = target).
// - approve separate (or unflagged) → a NEW song via addSong with the full
//   import contract (source 'Imported from OnSong', license confirmed,
//   version lineage) + the keep-separate audit row (canonical null).

import { parseSongFile } from '../../domain/chart/importers/onsong.js'
import { findDuplicateCandidates, listOwnedSongTitles, recordDuplicateDecision } from './duplicates.js'
import { computeReadiness } from '../../domain/chart/readiness.js'

/**
 * The parsed import (onsong.js parseSongFile → song): the declared metadata the
 * import contract may write, plus the normalized ChordPro body that becomes the
 * chart content. `year` is DECLARED only — null when the file carries no
 * {year:} directive, never guessed (0028). Local mirror on purpose: the parser
 * (src/domain/chart/importers/onsong.js) is untyped on this branch, and
 * duplicates.js's OwnedSongTitle is a non-exported typedef (importing it would
 * silently degrade to any).
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
 * Possible-duplicate candidate — id + title of an owned ACTIVE song whose
 * normalized title matches the import (S7 "both are flagged").
 * @typedef {object} DuplicateCandidate
 * @property {string} id
 * @property {string} title
 */

/**
 * The owned-titles row surface buildConflicts reads: id + title always come
 * back, while the declared year/genre are present only when the row carries
 * them (the owned-titles query selects id + title only).
 * @typedef {object} OwnedSongRow
 * @property {string} id
 * @property {string} title
 * @property {number | null} [year]
 * @property {string | null} [genre]
 */

/**
 * Dedupe review state on an entry. `decision` stays null while the user has
 * not resolved the flag — that is exactly what the S7 gate blocks on.
 * @typedef {object} DuplicateState
 * @property {DuplicateCandidate[]} candidates
 * @property {'merge' | 'separate' | null} decision
 * @property {string | null} targetSongId
 */

/**
 * One year/genre conflict (existing vs proposed + the user's choice). Only the
 * two declared-metadata fields that can collide participate; `chosen` is null
 * until the user picks, which the S8 gate blocks on.
 * @typedef {object} ImportConflict
 * @property {string} field
 * @property {string} songId
 * @property {string} existingTitle
 * @property {number | string} existing
 * @property {number | string} proposed
 * @property {number | string | null} chosen
 */

/**
 * The per-file review entry: what buildImportEntries fills, the UI renders, and
 * the approval gates read. `parsed`/`error` are mutually exclusive (a malformed
 * file keeps parsed null and carries the S5 error).
 * @typedef {object} ImportEntry
 * @property {string} id
 * @property {string} fileName
 * @property {ParsedImport | null} parsed
 * @property {string | null} error
 * @property {'pending' | 'approved' | 'discarded' | 'error'} status
 * @property {'public-domain' | 'CC-BY-4.0' | 'proprietary'} license
 * @property {boolean} licenseConfirmed
 * @property {DuplicateState} duplicate
 * @property {ImportConflict[]} conflicts
 */

/**
 * One picked conflict as it lands in the version metadata (metadata.conflict).
 * @typedef {object} ImportConflictRecord
 * @property {number | string} existing
 * @property {number | string} proposed
 * @property {number | string | null} chosen
 */

/**
 * Import lineage on the version row (metadata.import) — the source, the file it
 * came from, when, and the song it merged into (the separate path records no
 * mergedInto, so this typedef describes the merge lineage specifically).
 * @typedef {object} ImportLineage
 * @property {string} source
 * @property {string} file
 * @property {string} importedAt
 * @property {string} mergedInto
 */

/**
 * song_versions.metadata as the merge path writes it: the lineage plus the
 * chosen conflict values (absent when nothing was picked).
 * @typedef {object} VersionMetadata
 * @property {ImportLineage} import
 * @property {Record<string, ImportConflictRecord>} [conflict]
 */

/**
 * The gate result — `error` rides only the failing branch (it holds one of the
 * exact LICENSE/DUPLICATE/CONFLICT messages).
 * @typedef {object} ValidationResult
 * @property {boolean} ok
 * @property {string} [error]
 */

/**
 * approveEntry's resolved outcome (the single song-level write already done).
 * @typedef {{ ok: true, mode: 'merge' | 'separate', songId: string }} ImportApproval
 */

/**
 * One file handed to buildImportEntries by the picker ({name, text}); both keys
 * are optional because the read is defensive (a File without a name falls back
 * to 'song').
 * @typedef {object} ImportFile
 * @property {string | null} [name]
 * @property {string | null} [text]
 */

// supabase.js and songs.js need Vite env vars at module load — lazy-import
// them so this module graph evaluates in Node (the demo proves the pure gates;
// DB writes are E2E-only). House pattern: load on first use.
/** @type {typeof import('../supabase.js').supabase | null} */
let supabaseClient = null

/**
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient>}
 */
async function getSupabase() {
  if (!supabaseClient) supabaseClient = (await import('../supabase.js')).supabase
  return supabaseClient
}
/** @type {typeof import('./songs.js') | null} */
let songsLib = null

/**
 * @returns {Promise<typeof import('./songs.js')>}
 */
async function getSongs() {
  if (!songsLib) songsLib = await import('./songs.js')
  return songsLib
}

export const LICENSE_MESSAGE = 'Confirm the license to import.'
export const DUPLICATE_MESSAGE = 'Resolve the possible duplicate first.'
export const CONFLICT_MESSAGE = 'Resolve the conflicting values first.'

/** Empty entry (pre-approval state) — the shape buildImportEntries fills. */
/**
 * @param {string} fileName
 * @returns {ImportEntry}
 */
function emptyEntry(fileName) {
  return {
    id: crypto.randomUUID(),
    fileName,
    parsed: null,
    error: null,
    status: 'pending', // 'pending' | 'approved' | 'discarded' | 'error'
    license: 'CC-BY-4.0',
    licenseConfirmed: false,
    duplicate: { candidates: [], decision: null, targetSongId: null },
    conflicts: [],
  }
}

/**
 * Year/genre conflicts of each flagged candidate vs the parsed import (S8) —
 * existing vs proposed; the user chooses which wins (default existing). Only
 * year/genre participate (the declared-metadata fields that can collide).
 * @param {ParsedImport | null} parsed
 * @param {DuplicateCandidate[]} candidates
 * @param {OwnedSongRow[]} ownedRows
 * @returns {ImportConflict[]}
 */
function buildConflicts(parsed, candidates, ownedRows) {
  /** @type {ImportConflict[]} */
  const conflicts = []
  if (!parsed) return conflicts
  for (const cand of candidates) {
    // A candidate with no matching owned row compares as "nothing declared",
    // which is what the empty fallback states.
    const row = ownedRows.find((r) => r.id === cand.id) || /** @type {OwnedSongRow} */ ({})
    const existingYear = row.year ?? null
    const existingGenre = String(row.genre || '')
    if (existingYear !== null && parsed.year !== null && existingYear !== parsed.year) {
      conflicts.push({
        field: 'year',
        songId: cand.id,
        existingTitle: cand.title,
        existing: existingYear,
        proposed: parsed.year,
        chosen: null,
      })
    }
    if (existingGenre && parsed.genre && existingGenre !== parsed.genre) {
      conflicts.push({
        field: 'genre',
        songId: cand.id,
        existingTitle: cand.title,
        existing: existingGenre,
        proposed: parsed.genre,
        chosen: null,
      })
    }
  }
  return conflicts
}

/** The conflicts that apply once the user picked a merge target. */
/**
 * @param {ImportEntry | null | undefined} entry
 * @returns {ImportConflict[]}
 */
export function conflictsForTarget(entry) {
  const target = entry?.duplicate?.targetSongId
  if (!target) return []
  return (entry.conflicts || []).filter((c) => c.songId === target)
}

/**
 * Parse + flag every file. `files` = [{ name, text }]; detection runs against
 * ONE owned-titles query (skipped gracefully when the read fails — flagging
 * is offline-degraded, parsing is not: S5 continues regardless).
 * @param {ImportFile[] | null | undefined} files
 * @param {string} userId
 * @returns {Promise<ImportEntry[]>}
 */
export async function buildImportEntries(files, userId) {
  const list = Array.isArray(files) ? files : []
  /** @type {OwnedSongRow[]} */
  let ownedRows = []
  try {
    ownedRows = await listOwnedSongTitles(userId)
  } catch {
    ownedRows = [] // offline/down: flagging skipped, parsing still works
  }

  const entries = []
  for (const file of list) {
    const fileName = file?.name || 'song'
    const result = /** @type {ParseSongResult} */ (parseSongFile(file?.text ?? '', fileName))
    const entry = emptyEntry(fileName)
    if (!result.ok) {
      entry.error = result.error
      entry.status = 'error'
    } else {
      entry.parsed = result.song
      const candidates = await findDuplicateCandidates(userId, result.song.title, null, ownedRows)
      entry.duplicate.candidates = candidates
      entry.conflicts = buildConflicts(result.song, candidates, ownedRows)
    }
    entries.push(entry)
  }
  return entries
}

/**
 * The approval gates (S5/S7/S8/S9) — pure, UI calls it to render gating
 * messages and approveEntry enforces it before ANY write.
 * @param {ImportEntry | null | undefined} entry
 * @returns {ValidationResult}
 */
export function validateEntryForApproval(entry) {
  if (!entry?.parsed || entry.error) {
    return { ok: false, error: entry?.error || 'Could not parse this file' }
  }
  if (!entry.licenseConfirmed) return { ok: false, error: LICENSE_MESSAGE }
  const dup = entry.duplicate || { candidates: [], decision: null, targetSongId: null }
  if (dup.candidates.length && !dup.decision) {
    return { ok: false, error: DUPLICATE_MESSAGE }
  }
  if (dup.decision === 'merge') {
    if (!dup.targetSongId) return { ok: false, error: DUPLICATE_MESSAGE }
    const pending = conflictsForTarget(entry).filter(
      (c) => c.chosen === null || c.chosen === undefined,
    )
    if (pending.length) return { ok: false, error: CONFLICT_MESSAGE }
  }
  return { ok: true }
}

/**
 * Apply a reviewed entry — the ONLY song-level write in the import flow.
 *   merge    → chart + version rows on the existing TARGET (lineage
 *              metadata.import with mergedInto), conflict values applied via
 *              updateSong(…, 'import'), audit row canonical = target.
 *   separate (or unflagged) → NEW song via addSong with the import contract,
 *              audit row canonical NULL (keep-separate still audits).
 * Returns { ok: true, mode: 'merge'|'separate', songId }.
 * @param {string} userId
 * @param {ImportEntry} entry
 * @returns {Promise<ImportApproval>}
 */
export async function approveEntry(userId, entry) {
  const check = validateEntryForApproval(entry)
  if (!check.ok) throw new Error(check.error)

  const dup = entry.duplicate || { candidates: [], decision: null, targetSongId: null }
  if (dup.decision === 'merge' && dup.targetSongId) {
    return approveMerge(userId, entry, dup.targetSongId)
  }
  return approveSeparate(userId, entry)
}

/**
 * @param {string} userId
 * @param {ImportEntry} entry
 * @param {string} targetId
 * @returns {Promise<ImportApproval>}
 */
async function approveMerge(userId, entry, targetId) {
  const { getSong, updateSong, invalidateSongs } = await getSongs()
  const supabase = await getSupabase()
  // The gate already rejected a null parse, so the cast states that invariant
  // instead of re-checking it.
  const parsed = /** @type {ParsedImport} */ (entry.parsed)
  const target = await getSong(userId, targetId) // throws 'Song not found.' — never approved into a missing song
  const maxNumber = target.versions.reduce((m, v) => Math.max(m, v.number || 0), 0)

  const picked = conflictsForTarget(entry).filter(
    (c) => c.chosen !== null && c.chosen !== undefined,
  )
  /** @type {Record<string, ImportConflictRecord>} */
  const conflictRecord = {}
  for (const c of picked) conflictRecord[c.field] = { existing: c.existing, proposed: c.proposed, chosen: c.chosen }

  // 1. Chart row — the imported chart attaches to the EXISTING song.
  const { data: chartRow, error: chartErr } = await supabase
    .from('chart_files')
    .insert({
      song_id: targetId,
      format: 'chordpro',
      object_key: crypto.randomUUID(), // placeholder: content is inline; not-null constraint
      content: parsed.chordpro,
      size_bytes: parsed.chordpro.length,
    })
    .select()
    .single()
  if (chartErr) throw chartErr

  // 2. Version row — number = max+1, lineage rides name/change_note/metadata.
  const metadata = /** @type {VersionMetadata} */ ({
    import: {
      source: 'OnSong',
      file: entry.fileName,
      importedAt: new Date().toISOString(),
      mergedInto: targetId,
    },
  })
  if (Object.keys(conflictRecord).length) metadata.conflict = conflictRecord
  const { error: verErr } = await supabase
    .from('song_versions')
    .insert({
      song_id: targetId,
      name: 'Imported from OnSong',
      number: maxNumber + 1,
      chart_file_id: chartRow.id,
      base_key: null, // declared, never guessed — the import lands as draft
      base_tempo: null,
      is_ready: computeReadiness({ key: '', body: parsed.chordpro }).status === 'ready',
      metadata,
      change_note: `Imported from ${entry.fileName}`,
      owner_id: userId,
      created_by: userId,
    })
  if (verErr) throw verErr

  // 3. Conflict values land on the target with import provenance (S8).
  for (const c of picked) {
    // `field` is 'year' | 'genre' by construction (buildConflicts only pushes
    // those two), but it is a plain string here — the computed key widens the
    // payload to an index signature. The cast states that runtime field
    // without widening songs.js's SongInput. NOTE: it is not load-bearing —
    // an index-signature object is already assignable to the all-optional
    // SongInput (the weak-type check is waived) — so it is kept as intent
    // documentation; the parameter IS otherwise checked (title: 42 → TS2322).
    await updateSong(userId, targetId,
      /** @type {Parameters<typeof import('./songs.js').updateSong>[2]} */ ({ [c.field]: c.chosen }), 'import')
  }

  // 4. Audit the review — merge: canonical = target, group covers the flagged
  // set so the trail records exactly what was resolved.
  const group = [...new Set([
    targetId,
    ...(entry.duplicate.candidates || []).map((c) => c.id),
  ])]
  await recordDuplicateDecision(userId, { songIds: group, canonicalId: targetId })

  invalidateSongs(userId, [targetId])
  return { ok: true, mode: 'merge', songId: targetId }
}

/**
 * @param {string} userId
 * @param {ImportEntry} entry
 * @returns {Promise<ImportApproval>}
 */
async function approveSeparate(userId, entry) {
  const { addSong } = await getSongs()
  // The gate already rejected a null parse, so the cast states that invariant
  // instead of re-checking it.
  const parsed = /** @type {ParsedImport} */ (entry.parsed)
  const dup = entry.duplicate || { candidates: [], decision: null, targetSongId: null }
  const existingId = dup.targetSongId || dup.candidates[0]?.id || null

  // The double cast states the two deliberate divergences from songs.js's
  // SongInput: `key` is sent as null (addSong's `key?.trim() || ''` folds it
  // to '' — an import never declares a base key) and `license` is the 0028
  // songs_license_check vocabulary. A single cast cannot express either
  // against the now-typed SongInput (`key?: string | undefined`), hence the
  // hop through unknown.
  const created = await addSong(userId,
    /** @type {Parameters<typeof import('./songs.js').addSong>[1]} */ (/** @type {unknown} */ ({
    title: parsed.title,
    key: null,
    body: parsed.chordpro,
    meta: {
      artist: parsed.artist || null,
      genre: parsed.genre || null,
      year: parsed.year ?? null,
      source: 'Imported from OnSong',
      license: entry.license || 'CC-BY-4.0',
      licenseConfirmed: true, // the approval gate already enforced S9
      importMeta: { source: 'OnSong', file: entry.fileName, importedAt: new Date().toISOString() },
      versionName: 'Imported from OnSong',
      changeNote: `Imported from ${entry.fileName}`,
    },
  })))

  // Keep-separate still audits the review (canonical NULL) when flagged.
  if (existingId) {
    await recordDuplicateDecision(userId, { songIds: [existingId, created.id], canonicalId: null })
  }
  return { ok: true, mode: 'separate', songId: created.id }
}

// Self-check: node -e "import('./src/data/repositories/importQueue.js').then(m => m.demo())"
export function demo() {
  /**
   * @param {unknown} cond
   * @param {string} msg
   */
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`import queue demo FAILED: ${msg}`)
  }

  // The cast states what the gates actually read: the demo's `parsed` is a
  // minimal stub (no artist/genre/year/sections — only title + body matter
  // here), and the stub also omits the entry's id/status, so the 2-hop idiom
  // is required against the full ImportEntry.
  const base = /** @type {ImportEntry} */ (/** @type {unknown} */ ({
    fileName: 'song.txt',
    parsed: { title: 'Song', chordpro: '{title: Song}\n[G]Hi' },
    error: null,
    license: 'CC-BY-4.0',
    licenseConfirmed: false,
    duplicate: { candidates: [], decision: null, targetSongId: null },
    conflicts: [],
  }))

  // 1. Malformed → never approved, exact S5 message.
  const malformed = { ...base, parsed: null, error: 'Could not parse this file' }
  assert(validateEntryForApproval(malformed).error === 'Could not parse this file',
    'malformed never approved (exact S5 message)')

  // 2. License not confirmed → exact S9 message.
  assert(validateEntryForApproval(base).error === 'Confirm the license to import.',
    'license confirmation enforced')

  // 3. Flagged but no decision → exact S7 message.
  const noDecision = {
    ...base,
    licenseConfirmed: true,
    duplicate: { candidates: [{ id: 'a', title: 'Existing Song' }], decision: null, targetSongId: null },
  }
  assert(validateEntryForApproval(noDecision).error === 'Resolve the possible duplicate first.',
    'duplicate decision enforced when flagged')

  // 4. Merge without chosen conflict values → S8 message.
  const conflictPending = {
    ...base,
    licenseConfirmed: true,
    // The cast pins `decision` to the S7 vocabulary ('merge' | 'separate'),
    // which a bare object literal would widen to string.
    duplicate: /** @type {DuplicateState} */ ({ candidates: [{ id: 'a', title: 'Existing Song' }], decision: 'merge', targetSongId: 'a' }),
    conflicts: [{ field: 'year', songId: 'a', existingTitle: 'Existing Song', existing: 1990, proposed: 2000, chosen: null }],
  }
  assert(validateEntryForApproval(conflictPending).error === 'Resolve the conflicting values first.',
    'merge conflicts must be chosen')

  // 5. Merge with chosen conflicts → valid.
  const conflictChosen = {
    ...conflictPending,
    conflicts: [{ field: 'year', songId: 'a', existingTitle: 'Existing Song', existing: 1990, proposed: 2000, chosen: 2000 }],
  }
  assert(validateEntryForApproval(conflictChosen).ok === true, 'chosen conflicts validate')

  // 6. Complete separate entry → valid.
  assert(validateEntryForApproval({ ...base, licenseConfirmed: true }).ok === true,
    'complete separate entry validates')

  console.log('import queue demo OK')
}