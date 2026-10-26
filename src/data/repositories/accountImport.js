// Account import data layer (WU5).
//
// Thin wrapper over the 0044 RPC. The server owns identity (auth.uid()), id
// remapping and the summary counts; this module only turns a PostgREST failure
// into a message the settings surface can render.

import { supabase } from '../supabase.js'

const IMPORT_ERROR = 'Could not import this export — please try again.'

/**
 * @typedef {object} ImportSummary
 * @property {number} songs
 * @property {number} versions
 * @property {number} charts
 * @property {number} tags
 * @property {number} reused_tags
 * @property {number} collections
 * @property {number} collection_songs
 * @property {number} setlists
 * @property {number} setlist_items
 * @property {number} annotations
 * @property {number} skipped_setlist_items
 * @property {number} skipped_collection_songs
 * @property {number} skipped_annotations
 * @property {number} skipped_versions
 * @property {number} skipped_charts
 */

/**
 * Import the core working set of a validated export document.
 * @param {Record<string, unknown>} document
 * @returns {Promise<ImportSummary>}
 */
export async function importAccountData(document) {
  const { data, error } = await supabase.rpc('import_account_data', { p_document: document })
  if (error) throw new Error(error.message || IMPORT_ERROR)
  if (!data) throw new Error(IMPORT_ERROR)
  return /** @type {ImportSummary} */ (data)
}
