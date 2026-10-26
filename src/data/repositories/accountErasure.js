// Account erasure data layer (WU4).
//
// Thin wrappers over the 0043 RPCs: request/cancel go through security-definer
// RPCs (no client insert/update/delete on account_erasure_requests). Status is
// read directly from account_erasure_requests (RLS allows select own rows).

import { supabase } from '../supabase.js'

const ERASURE_ERROR = 'Could not update account deletion request — please try again.'

/**
 * Request account erasure. Idempotent on server; returns the live request row.
 * @returns {Promise<Record<string, unknown>>}
 */
export async function requestAccountErasure() {
  const { data, error } = await supabase.rpc('request_account_erasure')
  if (error) throw new Error(error.message || ERASURE_ERROR)
  if (!data) throw new Error(ERASURE_ERROR)
  return data
}

/**
 * Cancel a pending account erasure request.
 * @returns {Promise<Record<string, unknown>>}
 */
export async function cancelAccountErasure() {
  const { data, error } = await supabase.rpc('cancel_account_erasure')
  if (error) throw new Error(error.message || ERASURE_ERROR)
  if (!data) throw new Error(ERASURE_ERROR)
  return data
}

/**
 * Fetch the current user's live (pending) erasure request, if any.
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function getAccountErasureStatus() {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user?.id) return null
  const userId = userData.user.id

  const { data, error } = await supabase
    .from('account_erasure_requests')
    .select('*')
    .eq('user_id', userId)
    .is('cancelled_at', null)
    .is('completed_at', null)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message || ERASURE_ERROR)
  return data || null
}
