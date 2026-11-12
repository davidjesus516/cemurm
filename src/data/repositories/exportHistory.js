// @ts-check
// Export history data layer (Hito 6 N3, T3).
//
// Two kv keys per export, deliberately separate:
//   `export-history:v1:<user>`  the metadata index (one row per export)
//   `export-file:v1:<user>:<id>` the cached bytes the browser wrote
//
// Splitting them is what makes "Delete export" mean something. The scenario
// (features/export-and-sharing.feature:174-178) says the file is removed from
// local storage AND the history entry is marked as no longer available offline
// — one row cannot express both states, and deleting the row would erase the
// fact that the export ever happened.
//
// `offline/cache.js` is best-effort by contract: with IndexedDB unavailable it
// silently does nothing. That is the right behaviour here too — the download
// already happened, and a browser in private mode should not fail the export
// because it cannot remember it.

import { offlineGet, offlineRemove, offlineSet } from '../../offline/cache.js'
import {
  appendEntry,
  createEntry,
  fileKey,
  historyKey,
  markUnavailable,
  sortByRecency,
} from '../../domain/setlist/exportHistory.js'

/**
 * @typedef {import('../../domain/setlist/exportHistory.js').ExportHistoryEntry} ExportHistoryEntry
 * @typedef {{ filename: string, mimeType: string, text: string }} CachedExportFile
 */

/**
 * A uuid when the platform has one, a timestamp+counter otherwise. The id only
 * has to be unique inside one user's history.
 * @returns {string}
 */
function newId() {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * @param {string} userId
 * @returns {Promise<ExportHistoryEntry[]>}
 */
async function readEntries(userId) {
  const row = await offlineGet(historyKey(userId))
  const entries = row?.data?.entries
  return Array.isArray(entries) ? entries : []
}

/**
 * @param {string} userId
 * @param {ExportHistoryEntry[]} entries
 * @returns {Promise<void>}
 */
async function writeEntries(userId, entries) {
  await offlineSet(historyKey(userId), { entries })
}

/**
 * @param {string} userId
 * @param {ExportHistoryEntry} entry
 * @param {{ text?: string }} file
 * @returns {Promise<void>}
 */
async function writeFile(userId, entry, file) {
  /** @type {CachedExportFile} */
  const cached = {
    filename: entry.filename,
    mimeType: entry.mimeType,
    text: String(file?.text ?? ''),
  }
  await offlineSet(fileKey(userId, entry.id), cached)
}

/**
 * The whole history, newest first.
 * @param {string} userId
 * @returns {Promise<ExportHistoryEntry[]>}
 */
export async function listExports(userId) {
  return sortByRecency(await readEntries(userId))
}

/**
 * Remember one export and keep its bytes, so it can be downloaded again
 * offline.
 * @param {string} userId
 * @param {{ setlistId: string, setlistName?: string, format: string,
 *   file: { filename?: string, text?: string, mimeType?: string } }} input
 * @returns {Promise<ExportHistoryEntry>}
 */
export async function recordExport(userId, { setlistId, setlistName, format, file }) {
  const entry = createEntry({ id: newId(), setlistId, setlistName, format, file })
  await writeFile(userId, entry, file)
  await writeEntries(userId, appendEntry(await readEntries(userId), entry))
  return entry
}

/**
 * Re-record an existing export after regenerating it against the current
 * setlist. The id is preserved on purpose: the history row is the same export,
 * with today's date and today's bytes.
 * @param {string} userId
 * @param {string} entryId
 * @param {{ setlistId: string, setlistName?: string, format: string,
 *   file: { filename?: string, text?: string, mimeType?: string } }} input
 * @returns {Promise<ExportHistoryEntry>}
 */
export async function replaceExportFile(userId, entryId, { setlistId, setlistName, format, file }) {
  const entry = createEntry({ id: entryId, setlistId, setlistName, format, file })
  await writeFile(userId, entry, file)
  await writeEntries(userId, appendEntry(await readEntries(userId), entry))
  return entry
}

/**
 * The cached bytes of one export, or null when they are gone (deleted, or the
 * browser never stored them).
 * @param {string} userId
 * @param {string} entryId
 * @returns {Promise<CachedExportFile | null>}
 */
export async function loadExportFile(userId, entryId) {
  const row = await offlineGet(fileKey(userId, entryId))
  const cached = row?.data
  if (!cached || typeof cached.text !== 'string') return null
  return cached
}

/**
 * Drop the cached bytes and mark the entry as no longer available offline.
 * The history row survives; only the file is gone.
 * @param {string} userId
 * @param {string} entryId
 * @returns {Promise<ExportHistoryEntry[]>}
 */
export async function deleteExportFile(userId, entryId) {
  await offlineRemove(fileKey(userId, entryId))
  const entries = markUnavailable(await readEntries(userId), entryId)
  await writeEntries(userId, entries)
  return sortByRecency(entries)
}
