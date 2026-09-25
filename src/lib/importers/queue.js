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

import { parseSongFile } from './onsong.js'
import { findDuplicateCandidates, listOwnedSongTitles, recordDuplicateDecision } from './duplicates.js'
import { computeReadiness } from '../readiness.js'

// supabase.js and songs.js need Vite env vars at module load — lazy-import
// them so this module graph evaluates in Node (the demo proves the pure gates;
// DB writes are E2E-only). House pattern: load on first use.
let supabaseClient
async function getSupabase() {
  if (!supabaseClient) supabaseClient = (await import('../supabase.js')).supabase
  return supabaseClient
}
let songsLib
async function getSongs() {
  if (!songsLib) songsLib = await import('../songs.js')
  return songsLib
}

export const LICENSE_MESSAGE = 'Confirm the license to import.'
export const DUPLICATE_MESSAGE = 'Resolve the possible duplicate first.'
export const CONFLICT_MESSAGE = 'Resolve the conflicting values first.'

/** Empty entry (pre-approval state) — the shape buildImportEntries fills. */
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
 */
function buildConflicts(parsed, candidates, ownedRows) {
  const conflicts = []
  if (!parsed) return conflicts
  for (const cand of candidates) {
    const row = ownedRows.find((r) => r.id === cand.id) || {}
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
export function conflictsForTarget(entry) {
  const target = entry?.duplicate?.targetSongId
  if (!target) return []
  return (entry.conflicts || []).filter((c) => c.songId === target)
}

/**
 * Parse + flag every file. `files` = [{ name, text }]; detection runs against
 * ONE owned-titles query (skipped gracefully when the read fails — flagging
 * is offline-degraded, parsing is not: S5 continues regardless).
 */
export async function buildImportEntries(files, userId) {
  const list = Array.isArray(files) ? files : []
  let ownedRows = []
  try {
    ownedRows = await listOwnedSongTitles(userId)
  } catch {
    ownedRows = [] // offline/down: flagging skipped, parsing still works
  }

  const entries = []
  for (const file of list) {
    const fileName = file?.name || 'song'
    const result = parseSongFile(file?.text ?? '', fileName)
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

async function approveMerge(userId, entry, targetId) {
  const { getSong, updateSong, invalidateSongs } = await getSongs()
  const supabase = await getSupabase()
  const parsed = entry.parsed
  const target = await getSong(userId, targetId) // throws 'Song not found.' — never approved into a missing song
  const maxNumber = target.versions.reduce((m, v) => Math.max(m, v.number || 0), 0)

  const picked = conflictsForTarget(entry).filter(
    (c) => c.chosen !== null && c.chosen !== undefined,
  )
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
  const metadata = {
    import: {
      source: 'OnSong',
      file: entry.fileName,
      importedAt: new Date().toISOString(),
      mergedInto: targetId,
    },
  }
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
    await updateSong(userId, targetId, { [c.field]: c.chosen }, 'import')
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

async function approveSeparate(userId, entry) {
  const { addSong } = await getSongs()
  const parsed = entry.parsed
  const dup = entry.duplicate || { candidates: [], decision: null, targetSongId: null }
  const existingId = dup.targetSongId || dup.candidates[0]?.id || null

  const created = await addSong(userId, {
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
  })

  // Keep-separate still audits the review (canonical NULL) when flagged.
  if (existingId) {
    await recordDuplicateDecision(userId, { songIds: [existingId, created.id], canonicalId: null })
  }
  return { ok: true, mode: 'separate', songId: created.id }
}

// Self-check: node -e "import('./src/lib/importers/queue.js').then(m => m.demo())"
export function demo() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`import queue demo FAILED: ${msg}`)
  }

  const base = {
    fileName: 'song.txt',
    parsed: { title: 'Song', chordpro: '{title: Song}\n[G]Hi' },
    error: null,
    license: 'CC-BY-4.0',
    licenseConfirmed: false,
    duplicate: { candidates: [], decision: null, targetSongId: null },
    conflicts: [],
  }

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
    duplicate: { candidates: [{ id: 'a', title: 'Existing Song' }], decision: 'merge', targetSongId: 'a' },
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