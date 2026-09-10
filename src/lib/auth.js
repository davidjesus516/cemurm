// Real auth service — Supabase GoTrue behind the unchanged mock surface.
// Consumers (useAuth, AuthGuards, pages) keep working untouched: same exports,
// same validation messages, same error.message contract. Credentials now live
// server-side; nothing is stored in localStorage.

import { supabase } from './supabase.js'

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// D1: one app-lifetime subscription keeps the session cache current across
// sign-in, sign-out, and token refresh. Handle kept for teardown (HMR/tests).
let cachedSession = null

const _unsubscribeAuth = supabase.auth
  .onAuthStateChange((_event, session) => {
    cachedSession = session
  })
  .data.subscription.unsubscribe

// D3: application user shape — flat fields mapped from user_metadata.
function mapUser(user) {
  const metadata = user.user_metadata ?? {}
  return {
    id: user.id,
    email: user.email,
    firstName: metadata.firstName ?? '',
    lastName: metadata.lastName ?? '',
    displayName: metadata.displayName || user.email,
  }
}

// D2: branch ONLY on error.code — messages/status vary by transport. Codes not
// listed (incl. network errors without a code) fall back to the generic message.
function toAuthError(error) {
  const messages = {
    user_already_exists: 'An account with this email already exists.',
    invalid_credentials: 'Invalid email or password.',
    '42501': 'You do not have permission to perform this action.',
  }
  return new Error(messages[error?.code] || 'Something went wrong. Please try again.')
}

export async function signUp({ firstName, lastName, displayName, email, password }) {
  // Same local validation and messages as the mock, kept client-side (D4).
  const normalizedEmail = email.trim().toLowerCase()
  if (!EMAIL_RE.test(normalizedEmail)) {
    throw new Error('Enter a valid email address.')
  }
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.')
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: { firstName, lastName, displayName } },
    })
    if (error) throw error
    // D1/D4: keep the session cache in sync. With email confirmation enabled,
    // signUp resolves with no session; a stale cached session from a previous
    // sign-in must not survive as the current identity.
    cachedSession = data?.session ?? null
    // D4: session user when present, else the created user (session-less signup).
    const supabaseUser = data?.session?.user ?? data?.user
    return supabaseUser ? mapUser(supabaseUser) : null
  } catch (error) {
    throw toAuthError(error)
  }
}

export async function signIn({ email, password }) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw error
    return data?.session?.user ? mapUser(data.session.user) : null
  } catch (error) {
    throw toAuthError(error)
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  } catch (error) {
    throw toAuthError(error)
  }
}

// D1: cached session when present, else the authoritative getSession read.
export async function getSession() {
  if (cachedSession) {
    return cachedSession.user ? { user: mapUser(cachedSession.user) } : null
  }
  const { data } = await supabase.auth.getSession()
  cachedSession = data.session
  return data.session?.user ? { user: mapUser(data.session.user) } : null
}

export async function getCurrentUser() {
  const session = await getSession()
  return session ? session.user : null
}