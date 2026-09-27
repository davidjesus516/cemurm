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
// isMinor is the ONLY signal for minor-ness the app can see (date_of_birth /
// is_minor stay server-side per migration 0017); metadata missing → false,
// so pre-existing accounts pass straight through.
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
function toAuthError(error) {
  const messages = {
    user_already_exists: 'An account with this email already exists.',
    invalid_credentials: 'Invalid email or password.',
    '42501': 'You do not have permission to perform this action.',
  }
  return new Error(messages[error?.code] || 'Something went wrong. Please try again.')
}

// WU3: the only social providers this app offers. Guarded here, not passed
// through to the SDK, so a typo or a future caller cannot ask GoTrue for a
// provider that was never configured.
const OAUTH_PROVIDERS = new Set(['google', 'github'])

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

// WU3 social sign-in. Navigates the browser away to the provider and RESOLVES as
// soon as the SDK has the authorize URL — there is deliberately no callback
// handler here:
//   * supabase-js runs with detectSessionInUrl at its default (true), so the
//     tokens/code on the return URL are consumed automatically on arrival. Reading
//     a hash or a `code` query param by hand here would duplicate (and eventually
//     disagree with) the SDK.
//   * nothing may be read after this call: there is no user yet. The session only
//     exists once the browser comes back, and useAuth/AuthProvider pick it up on
//     mount (src/hooks/useAuth.jsx).
//   * on return, RequireGuardianConsent (src/components/auth/AuthGuards.jsx) sees
//     a brand-new account with no date_of_birth and renders DateOfBirthRequired.
//     That is the intended net and the reason compliance shipped before OAuth
//     (decision D6) — this path used to have NO age gate at all, because the
//     ageDeclaration radio below only exists on the email form. An OAuth user is
//     asked for a real date instead of self-declaring a flag, which is strictly
//     stronger evidence; the radio stays for email signups and is not refactored.
// Returns void; surfaces failures through the same toAuthError mapping as every
// other call in this file.
export async function signInWithOAuth({ provider }) {
  if (!OAUTH_PROVIDERS.has(provider)) {
    throw new Error('That sign-in method is not available.')
  }
  // Built from the live origin so the same call works on localhost:5173 in dev and
  // on whatever host the app is deployed to. It must be allow-listed in
  // supabase/config.toml → [auth] additional_redirect_urls. The bare origin (not
  // /auth) is the destination the email flow lands on too — see Auth.jsx handleSubmit.
  const redirectTo = window.location.origin
  try {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })
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