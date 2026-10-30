import { useEffect, useState } from 'react'
import { supabase } from '../../../data/supabase'

export function useSystemAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function check() {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const user = sessionData?.session?.user
        if (!user) {
          if (mounted) {
            setIsAdmin(false)
            setLoading(false)
          }
          return
        }

        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'system_admin')
          .maybeSingle()

        if (mounted) {
          setIsAdmin(!error && !!data)
          setLoading(false)
        }
      } catch {
        if (mounted) {
          setIsAdmin(false)
          setLoading(false)
        }
      }
    }

    check()
    return () => {
      mounted = false
    }
  }, [])

  return { isAdmin, loading }
}
