// Account export data layer (WU2).
//
// Thin wrapper over the 0042 RPC: the SQL function owns the envelope shape and
// the security definer + uid guard; this module only turns a PostgREST failure
// into a message the settings surface can render. The caller expects an
// envelope, so a failure is thrown, never swallowed.

import { supabase } from '../supabase.js'

const EXPORT_ERROR = 'Could not export your data right now — please try again.'

/**
 * Fetch the caller's full export envelope.
 * @returns {Promise<Record<string, unknown>>}
 */
export async function exportAccountData() {
  const { data, error } = await supabase.rpc('export_account_data')
  if (error) throw new Error(EXPORT_ERROR)
  if (!data) throw new Error(EXPORT_ERROR)
  return data
}
