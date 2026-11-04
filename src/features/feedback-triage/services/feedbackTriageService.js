import { supabase } from '../../../data/supabase'

// Resolves each report's user_id to a human-readable submitter label.
// profiles is RLS self-read only (0006), so a direct join would silently
// return nothing for anyone else's row; private.display_name_for is the
// security-definer function that reads display_name/username for any id.
async function resolveSubmitters(items) {
  const ids = [...new Set((items || []).map((i) => i.user_id).filter(Boolean))]
  if (ids.length === 0) return items
  const names = await Promise.all(
    ids.map((id) =>
      supabase
        .rpc('display_name_for', { p_user_id: id })
        .then((r) => r.data ?? 'Someone')
        .catch(() => 'Someone'),
    ),
  )
  const byId = Object.fromEntries(ids.map((id, i) => [id, names[i]]))
  return (items || []).map((i) => ({ ...i, submitter: byId[i.user_id] || 'Someone' }))
}

export async function fetchFeedback({ kind, status } = {}) {
  let query = supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })

  if (kind && kind !== 'all') {
    query = query.eq('kind', kind)
  }
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error
  return resolveSubmitters(data)
}

export async function updateFeedbackStatus(id, status, userId) {
  const { data, error } = await supabase
    .from('feedback')
    .update({ status, updated_by: userId })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function promoteToGitHub(feedbackId) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('No session')

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/feedback-to-issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ feedback_id: feedbackId }),
  })

  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error || 'Failed to promote')
  }
  return json
}
