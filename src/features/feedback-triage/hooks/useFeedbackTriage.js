import { useCallback, useEffect, useState } from 'react'
import { fetchFeedback, updateFeedbackStatus, promoteToGitHub } from '../services/feedbackTriageService'
import { supabase } from '../../../data/supabase'

export function useFeedbackTriage(filters = {}) {
  const { kind, status } = filters
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchFeedback({ kind, status })
      setItems(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [kind, status])

  useEffect(() => {
    load()
  }, [load])

  async function setStatus(id, status) {
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData?.session?.user?.id
      // Without a user id the UPDATE reaches the with-check clause with NULL and
      // comes back as a raw RLS violation. Say what actually happened instead.
      if (!userId) throw new Error('Sign in again to change a report status.')
      const updated = await updateFeedbackStatus(id, status, userId)
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...updated } : it)))
      return updated
    } catch (e) {
      setError(e.message)
      return null
    }
  }

  async function promote(id) {
    const res = await promoteToGitHub(id)
    await load()
    return res
  }

  return { items, loading, error, reload: load, setStatus, promote }
}
