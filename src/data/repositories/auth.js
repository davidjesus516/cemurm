// @ts-check
// Real auth service — Supabase GoTrue behind the unchanged mock surface.
// Consumers (useAuth, AuthGuards, pages) keep working untouched: same exports,
// same validation messages, same error.message contract. Credentials now live
// server-side; nothing is stored in localStorage.

import { supabase } from '../supabase.js'

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// D1: one app-lifetime subscription keeps the session cache current across
// sign-in, sign-out, and token refresh. Handle kept for teardown (HMR/tests).
/** @type {import('@supabase/supabase-js').Session | null} */
let cachedSession = null

const _unsubscribeAuth = supabase.auth
  .onAuthStateChange((_event, session) => {
    cachedSession = session
  })
  .data.subscription.unsubscribe

/**
 * D3: application user shape — flat fields mapped from user_metadata.
 * `email` stays optional because GoTrue's User.email is optional (a
 * phone-only account has none) and the mapping passes it straight through.
 * @typedef {object} AuthUser
 * @property {string} id
 * @property {string | undefined} email
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} displayName
 * @property {boolean} isMinor
 */

/**
 * D3: application user shape — flat fields mapped from user_metadata.
 * isMinor is the ONLY signal for minor-ness the app can see (date_of_birth /
 * is_minor stay server-side per migration 0017); metadata missing → false,
 * so pre-existing accounts pass straight through.
 * @param {import('@supabase/supabase-js').User} user
 * @returns {AuthUser}
 */
function mapUser(user) {
  const metadata = user.user_metadata ?? {}
  return {
    id: user.id,
    email: user.email,
    firstName: metadata.firstName ?? '',
    lastName: metadata.lastName ?? '',
    displayName: metadata.displayName || user.email,
    isMinor: metadata.isMinor === true,
  }
}

// D2: branch ONLY on error.code — messages/status vary by transport. Codes not
// listed (incl. network errors without a code) fall back to the generic message.
/**
 * @param {unknown} error
 * @returns {Error}
 */
function toAuthError(error) {
  /** @type {Record<string, string>} */
  const messages = {
    user_already_exists: 'An account with this email already exists.',
    invalid_credentials: 'Invalid email or password.',
    '42501': 'You do not have permission to perform this action.',
  }
  // Supabase transport errors always carry a string `code`; the `?.` below
  // stays as the runtime guard for a thrown non-error.
  const err = /** @type {{ code: string }} */ (error)
  return new Error(messages[err?.code] || 'Something went wrong. Please try again.')
}

/**
 * @typedef {object} SignUpInput
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} displayName
 * @property {string} email
 * @property {string} password
 * @property {string} ageDeclaration
 */

/**
 * @typedef {object} SignInInput
 * @property {string} email
 * @property {string} password
 */

/**
 * @param {SignUpInput} input
 * @returns {Promise<AuthUser | null>}
 */
export async function signUp({ firstName, lastName, displayName, email, password, ageDeclaration }) {
  // Same local validation and messages as the mock, kept client-side (D4).
  const normalizedEmail = email.trim().toLowerCase()
  if (!EMAIL_RE.test(normalizedEmail)) {
    throw new Error('Enter a valid email address.')
  }
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.')
  }
  if (ageDeclaration !== 'minor' && ageDeclaration !== 'adult') {
    throw new Error('Please tell us your age to continue.')
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          firstName,
          lastName,
          displayName,
          // Hito 4: minor-ness lives in user_metadata — the DB keeps
          // date_of_birth server-side and never exposes is_minor.
          isMinor: ageDeclaration === 'minor',
        },
      },
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

/**
 * @param {SignInInput} input
 * @returns {Promise<AuthUser | null>}
 */
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

/**
 * @returns {Promise<void>}
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  } catch (error) {
    throw toAuthError(error)
  }
}

// D1: cached session when present, else the authoritative getSession read.
/**
 * @returns {Promise<{ user: AuthUser } | null>}
 */
export async function getSession() {
  if (cachedSession) {
    return cachedSession.user ? { user: mapUser(cachedSession.user) } : null
  }
  const { data } = await supabase.auth.getSession()
  cachedSession = data.session
  return data.session?.user ? { user: mapUser(data.session.user) } : null
}

/**
 * @returns {Promise<AuthUser | null>}
 */
export async function getCurrentUser() {
  const session = await getSession()
  return session ? session.user : null
}