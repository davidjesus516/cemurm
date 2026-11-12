// Export history — features/export-and-sharing.feature:158-178.
//
// Pure and node-safe: the page owns rendering and the repository owns
// IndexedDB. This module owns the record shape, its ordering, the size the
// entry reports, and the rule that an entry outlives the file it describes.
//
// The record is deliberately metadata-only. The bytes live under their own kv
// key (`fileKey`) so "Delete export" can drop the file while the history keeps
// saying the export happened — that is the scenario's "the export history
// entry is marked as no longer available offline", and collapsing both into one
// row would make the history disappear instead.
//
// Ordering is newest-first. The scenario says "chronological list"; a history
// read top-down is a list of what just happened, so the most recent export is
// the first row. `sortByRecency` is the single place that decides this.

import { EXPORT_FORMATS } from './exporters/setlistFile.js'

/** Newest 100 exports. Older entries fall off; the cached files do not. */
export const EXPORT_HISTORY_LIMIT = 100

/**
 * One export the user produced, as the history surface renders it.
 * @typedef {object} ExportHistoryEntry
 * @property {string} id
 * @property {string} setlistId
 * @property {string} setlistName
 * @property {string} format dispatcher key (`chordpro`, `onsong`, `abc`, `txt`)
 * @property {string} filename
 * @property {string} mimeType
 * @property {string} savedAt ISO timestamp
 * @property {number} bytes
 * @property {boolean} availableOffline false once the cached file was deleted
 */

/**
 * @param {string} userId
 * @returns {string}
 */
export function historyKey(userId) {
  return `export-history:v1:${userId}`
}

/**
 * The cached bytes of one export, keyed separately from its history entry.
 * @param {string} userId
 * @param {string} entryId
 * @returns {string}
 */
export function fileKey(userId, entryId) {
  return `export-file:v1:${userId}:${entryId}`
}

/**
 * UTF-8 byte length, which is what a downloaded file weighs and what the
 * history reports. `String.length` would undercount every accented title.
 * @param {string} text
 * @returns {number}
 */
export function byteLength(text) {
  return new TextEncoder().encode(String(text ?? '')).length
}

/**
 * The menu label for a stored dispatcher key. A key this build no longer
 * offers (an older history row) renders as itself rather than vanishing.
 * @param {string} format
 * @returns {string}
 */
export function formatLabel(format) {
  const match = EXPORT_FORMATS.find((option) => option.value === format)
  return match ? match.label : String(format ?? '')
}

/**
 * Build the history record for one export.
 * @param {{
 *   id: string,
 *   setlistId: string,
 *   setlistName?: string,
 *   format: string,
 *   file: { filename?: string, text?: string, mimeType?: string },
 *   savedAt?: string,
 * }} input
 * @returns {ExportHistoryEntry}
 */
export function createEntry({ id, setlistId, setlistName, format, file, savedAt }) {
  return {
    id: String(id),
    setlistId: String(setlistId ?? ''),
    setlistName: String(setlistName ?? '').trim() || 'Untitled setlist',
    format: String(format ?? ''),
    filename: String(file?.filename ?? ''),
    mimeType: String(file?.mimeType ?? 'text/plain'),
    savedAt: savedAt ?? new Date().toISOString(),
    bytes: byteLength(file?.text),
    availableOffline: true,
  }
}

/**
 * @param {{ savedAt?: string }} entry
 * @returns {number}
 */
function timeOf(entry) {
  const parsed = Date.parse(String(entry?.savedAt ?? ''))
  // An unreadable timestamp sorts last instead of jumping to the top: a
  // corrupt row must not outrank a real export.
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}

/**
 * Newest first, without mutating the input.
 * @param {ExportHistoryEntry[]} [entries]
 * @returns {ExportHistoryEntry[]}
 */
export function sortByRecency(entries = []) {
  return [...(Array.isArray(entries) ? entries : [])].sort((a, b) => timeOf(b) - timeOf(a))
}

/**
 * Add an export, or replace the entry that shares its id (a regeneration).
 * The cap keeps the history bounded; the oldest record falls off.
 * @param {ExportHistoryEntry[] | null | undefined} entries
 * @param {ExportHistoryEntry} entry
 * @returns {ExportHistoryEntry[]}
 */
export function appendEntry(entries, entry) {
  const withoutSame = (Array.isArray(entries) ? entries : []).filter(
    (existing) => existing?.id !== entry?.id,
  )
  return sortByRecency([...withoutSame, entry]).slice(0, EXPORT_HISTORY_LIMIT)
}

/**
 * Mark one entry as no longer available offline. The record stays: deleting a
 * cached file does not un-export it.
 * @param {ExportHistoryEntry[] | null | undefined} entries
 * @param {string} entryId
 * @returns {ExportHistoryEntry[]}
 */
export function markUnavailable(entries, entryId) {
  return (Array.isArray(entries) ? entries : []).map((entry) =>
    entry?.id === entryId ? { ...entry, availableOffline: false } : entry,
  )
}

/**
 * Whether the cached file is still there. A row written before the flag
 * existed has one, so the absence of the flag means available.
 * @param {{ availableOffline?: boolean } | null | undefined} entry
 * @returns {boolean}
 */
export function isAvailableOffline(entry) {
  return entry?.availableOffline !== false
}
