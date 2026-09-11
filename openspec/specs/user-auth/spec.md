# User Auth Specification

## Purpose

Real Supabase authentication behind the existing `src/lib/auth.js` surface. PR #1 (S1): swap mock localStorage auth for `supabase.auth` without touching hooks, guards, or pages, and seed a demo identity. Offline-first work (S4–S7) is future, outside this contract.

## Requirements

### Requirement: Auth surface unchanged

The exported surface of `src/lib/auth.js` MUST remain compatible with today's consumers: `signUp`, `signIn`, `signOut`, `getSession`, `getCurrentUser`, and `EMAIL_RE` MUST keep their current signatures and return shapes (`getSession` → `{ user } | null`; `getCurrentUser` → `user | null`; user objects expose `id`, `firstName`, `lastName`, `displayName`, `email`). The `useAuth` hook, `AuthGuards`, and route pages MUST work without modification, and `pnpm lint` MUST stay clean.

#### Scenario: Existing consumers work unchanged

- GIVEN the current `src/lib/auth.js` surface
- WHEN a component calls `getCurrentUser()` with a persisted session
- THEN it resolves to the `{ user }` object with the documented fields
- AND `pnpm lint` passes with zero warnings

#### Scenario: Sign-in returns the session user

- GIVEN valid credentials
- WHEN `signIn({ email, password })` resolves
- THEN the returned user matches the signed-in account shape

### Requirement: Supabase-backed session

Auth state MUST be sourced from `supabase.auth`: `signUp` → `supabase.auth.signUp`, `signIn` → `signInWithPassword`, `signOut` → `signOut`, `getSession` → `getSession` mapped to the `{ user }` shape, and an `onAuthStateChange` subscription MUST keep the surfaced session current across sign-in, sign-out, and token refresh.

#### Scenario: Sign in persists a real Supabase session

- GIVEN the local Supabase backend running (`supabase start`)
- WHEN `signIn({ email, password })` resolves with valid credentials
- THEN `supabase.auth.getSession()` returns a session for that user
- AND `getCurrentUser()` returns that user

#### Scenario: Sign out clears the session

- GIVEN an active Supabase session
- WHEN `signOut()` resolves
- THEN `getCurrentUser()` returns `null`
- AND the `onAuthStateChange` subscriber observed `SIGNED_OUT`

### Requirement: Errors keyed by error.code

Failures MUST branch on Supabase `error.code`, never `error.message` or HTTP status. Known codes (`user_already_exists`, `invalid_credentials`, `42501`, …) MUST yield the app's existing user-facing errors; unknown codes MUST degrade to a generic message.

#### Scenario: Duplicate signup

- GIVEN an existing account for demo@cemurm.app
- WHEN `signUp({ email: 'demo@cemurm.app', ... })` rejects
- THEN the error code is `user_already_exists`
- AND the caller receives the mapped user-facing error

#### Scenario: Wrong password

- GIVEN a Supabase-backed session store and no active session
- WHEN `signIn` is called with a wrong password
- THEN the error code is `invalid_credentials`
- AND no session is persisted

### Requirement: Demo user seed

The seed MUST create `demo@cemurm.app` (password `password1234`) as a real `auth.users` row with an `org_owner` membership in the demo org, so `supabase db reset` leaves a usable dev login.

#### Scenario: Demo sign-in after reset

- GIVEN a fresh `supabase db reset`
- WHEN `signIn({ email: 'demo@cemurm.app', password: 'password1234' })` is called
- THEN it resolves and `getCurrentUser()` returns the demo user

#### Scenario: Demo identity anchors RLS

- GIVEN the seeded demo org with an `org_owner` membership
- WHEN the demo user queries owner-scoped tables
- THEN RLS resolves their identity as declared