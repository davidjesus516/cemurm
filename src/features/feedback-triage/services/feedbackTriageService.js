import { supabase } from '../../../data/supabase'

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
  return data || []
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
