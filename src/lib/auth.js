// Mock auth service.
// Mirrors the future Supabase client surface so chunk C8 can swap the
// implementation without touching the hook, guards, or UI.
// Mock only: plaintext "passwords" in localStorage are fine for development.

const SESSION_KEY = 'cemurm.session'
const USERS_KEY = 'cemurm.users'

// Demo account — sign in with demo@cemurm.app / password1234
const DEMO_USER = {
  id: 'demo-user',
  firstName: 'Demo',
  lastName: 'User',
  displayName: 'Demo User',
  email: 'demo@cemurm.app',
  password: 'password1234',
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function readUsers() {
  const raw = localStorage.getItem(USERS_KEY)
  if (!raw) {
    localStorage.setItem(USERS_KEY, JSON.stringify([DEMO_USER]))
    return [DEMO_USER]
  }
  return JSON.parse(raw)
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function readSession() {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  const session = JSON.parse(raw)
  return session && session.user ? session : null
}

function toPublicUser(user) {
  const { password: _password, ...publicUser } = user
  return publicUser
}

function persistSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ user: toPublicUser(user) }))
}

export async function signUp({ firstName, lastName, displayName, email, password }) {
  await delay(400)

  const normalizedEmail = email.trim().toLowerCase()
  if (!EMAIL_RE.test(normalizedEmail)) {
    throw new Error('Enter a valid email address.')
  }
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.')
  }

  const users = readUsers()
  if (users.some((user) => user.email === normalizedEmail)) {
    throw new Error('An account with this email already exists.')
  }

  const user = {
    id: crypto.randomUUID(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    displayName: displayName.trim(),
    email: normalizedEmail,
    // Mock only — Supabase stores credentials server-side (chunk C8).
    password,
  }
  writeUsers([...users, user])
  // Registration signs the user in immediately, per the auth spec.
  persistSession(user)
  return toPublicUser(user)
}

export async function signIn({ email, password }) {
  await delay(400)

  const normalizedEmail = email.trim().toLowerCase()
  const user = readUsers().find(
    (u) => u.email === normalizedEmail && u.password === password,
  )
  if (!user) {
    throw new Error('Invalid email or password.')
  }
  persistSession(user)
  return toPublicUser(user)
}

export async function signOut() {
  await delay(150)
  localStorage.removeItem(SESSION_KEY)
}

// Returns the persisted session ({ user }) or null, mirroring Supabase getSession.
export async function getSession() {
  return readSession()
}

export async function getCurrentUser() {
  const session = await getSession()
  return session ? session.user : null
}