/* eslint-disable react/prop-types */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import * as auth from '../lib/auth.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore the persisted session on mount. Async so chunk C8 can swap in
  // Supabase's getSession without changing this hook's callers.
  useEffect(() => {
    auth.getCurrentUser().then((currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      async signUp(userData) {
        const newUser = await auth.signUp(userData)
        setUser(newUser)
        return newUser
      },
      async signIn(credentials) {
        const signedInUser = await auth.signIn(credentials)
        setUser(signedInUser)
        return signedInUser
      },
      async signOut() {
        await auth.signOut()
        setUser(null)
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}