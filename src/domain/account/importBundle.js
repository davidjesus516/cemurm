// Account import bundle: read a CEMURM export ZIP back into a document.
//
// Requirement source:
//   features/account-data-export-and-erasure.feature:29/:75 — the bundle can be
//     re-imported into a fresh account.
//   ODD record D2 — only the core working set is importable; everything else in
//     the document is ignored by the server-side importer.
//
// Pure module: no DOM, no Supabase, no browser globals (the file picker lives in
// the settings component). `unzipSync`/`strFromU8` are synchronous, so the whole
// path is testable in the node Vitest environment.

import { strFromU8, unzipSync } from 'fflate'

export const EXPORT_SCHEMA_VERSION = 'cemurm.account-export/1'

export const NOT_EXPORT = 'This file is not a CEMURM export.'
export const UNSUPPORTED_VERSION = 'Unsupported export version.'
export const DAMAGED = 'The export file is damaged.'

const JSON_ENTRY = /^cemurm-export-[^/]*\.json$/

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Count the rows the importer will attempt, so the UI can say what is coming
 * before anything is written. Mirrors the core working set of D2.
 * @param {Record<string, unknown>} document
 * @returns {{ songs: number, versions: number, charts: number, tags: number,
 *   collections: number, collectionSongs: number, setlists: number,
 *   setlistItems: number, annotations: number }}
 */
function summarize(document) {
  const repertoire = isObject(document.repertoire) ? document.repertoire : {}
  const collections = Array.isArray(document.collections) ? document.collections : []
  const setlists = Array.isArray(document.setlists) ? document.setlists : []

  return {
    songs: Array.isArray(repertoire.songs) ? repertoire.songs.length : 0,
    versions: Array.isArray(repertoire.versions) ? repertoire.versions.length : 0,
    charts: Array.isArray(repertoire.charts) ? repertoire.charts.length : 0,
    tags: Array.isArray(repertoire.tags) ? repertoire.tags.length : 0,
    collections: collections.length,
    collectionSongs: collections.reduce(
      (total, collection) => total + (isObject(collection) && Array.isArray(collection.songs)
        ? collection.songs.length
        : 0),
      0,
    ),
    setlists: setlists.length,
    setlistItems: setlists.reduce(
      (total, setlist) => total + (isObject(setlist) && Array.isArray(setlist.items)
        ? setlist.items.length
        : 0),
      0,
    ),
    annotations: Array.isArray(document.annotations) ? document.annotations.length : 0,
  }
}

/**
 * Read the ZIP bytes and validate the document well enough to hand it to the
 * RPC. Throws one of the exported messages (never a parser internal).
 * @param {Uint8Array | ArrayBuffer} bytes
 * @returns {{ document: Record<string, unknown>, summaryOfWhatWillImport: ReturnType<typeof summarize> }}
 */
export function parseImportBundle(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)

  /** @type {Record<string, Uint8Array>} */
  let entries
  try {
    entries = unzipSync(input)
  } catch {
    throw new Error(NOT_EXPORT)
  }

  const jsonEntries = Object.keys(entries).filter((name) => JSON_ENTRY.test(name))
  if (jsonEntries.length === 0) throw new Error(NOT_EXPORT)
  // A well-formed bundle carries exactly one JSON document; more than one means
  // the archive was assembled or edited elsewhere.
  if (jsonEntries.length > 1) throw new Error(DAMAGED)

  /** @type {unknown} */
  let parsed
  try {
    parsed = JSON.parse(strFromU8(entries[jsonEntries[0]]))
  } catch {
    throw new Error(DAMAGED)
  }

  if (!isObject(parsed)) throw new Error(DAMAGED)

  const document = /** @type {Record<string, unknown>} */ (parsed)
  if (document.schema_version !== EXPORT_SCHEMA_VERSION) throw new Error(UNSUPPORTED_VERSION)

  // Minimal structure: a document without a repertoire object is not something
  // buildExportDocument could have produced.
  if (!isObject(document.repertoire)) throw new Error(DAMAGED)

  const repertoire = /** @type {Record<string, unknown>} */ (document.repertoire)
  for (const key of ['songs', 'versions', 'charts', 'tags']) {
    if (Object.prototype.hasOwnProperty.call(repertoire, key)
      && !Array.isArray(repertoire[key])) {
      throw new Error(DAMAGED)
    }
  }
  for (const key of ['collections', 'setlists', 'annotations']) {
    if (Object.prototype.hasOwnProperty.call(document, key) && !Array.isArray(document[key])) {
      throw new Error(DAMAGED)
    }
  }

  return { document, summaryOfWhatWillImport: summarize(document) }
}
