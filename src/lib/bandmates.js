// Bandmate invite lifecycle (Hito 3 PR#1a, bandmates R3–R5): reads/mutates
// bandmate_links under the 0006 pair-scope RLS — rows are visible to the two
// users of the pair only. Invite = INSERT with user_id fixed to the inviter;
// accept/decline = UPDATE the invitee's own side; remove = DELETE either
// side. A removed pending invite is gone, so a queued accept replay drops
// silently ("revoked-pending invalid", R6). Validation guards (no-self,
// already-active) are client-layer per 0006 header — RLS enforces the
// invariant only — so the pure guards run in demo() bare-node; network reads
// use the lazy supabase import (annotations.js pattern; offlineQueue.js has
// no browser-only module scope).

import { enqueueOp } from './offlineQueue.js'

let supabaseClient = null
async function supabase() {
  if (!supabaseClient) supabaseClient = (await import('./supabase.js')).supabase
  return supabaseClient
}

// Known user-facing errors re-thrown as-is; anything else maps to a generic
// message (setlists.js convention).
const USER_ERRORS = new Set([
  'You cannot add yourself.',
  'Already in band.',
  'Invitation already sent.',
  'This invitation is no longer valid.',
])

// ponytail: best-effort connectivity heuristic, same shape as setlists.js —
// refined if a stable fetch-failure code ever appears.
function isConnectivityError(e) {
  const msg = String(e?.message || '')
  return typeof navigator !== 'undefined' && navigator.onLine === false
    || msg.includes('Failed to fetch')
    || msg.includes('fetch failed')
    || e?.code === '-1'
}

export function handleError(error) {
  if (USER_ERRORS.has(error?.message)) throw error
  throw new Error('Something went wrong. Please try again.')
}

/**
 * Pure invite guard (bandmates R4): no-self, already-active, and any other
 * existing pair row (pending/declined) blocks a fresh invite — the inviter
 * must remove the row first. Returns an error message or null when allowed.
 */
export function guardInvite(userId, bandmateId, existingLink) {
  if (bandmateId === userId) return 'You cannot add yourself.'
  if (!existingLink) return null
  if (existingLink.status === 'active') return 'Already in band.'
  return 'Invitation already sent.'
}

/**
 * Pure row mapper: each side of the pair sees the row from their own
 * direction, with the other user's id as `userId` (profile resolved by the
 * caller after the profiles join round-trip).
 */
export function normalizeLink(row, userId) {
  const outgoing = row.user_id === userId
  return {
    id: row.id,
    userId: outgoing ? row.bandmate_id : row.user_id,
    direction: outgoing ? 'outgoing' : 'incoming',
    status: row.status,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    profile: null,
    pendingSync: false,
  }
}

// Optimistic shape for offline-queued mutations (setlists.js precedent):
// flagged pendingSync so the UI shows it, replaced on next successful read.
function optimisticLink(userId, bandmateId, status) {
  return {
    ...normalizeLink(
      { user_id: bandmateId, bandmate_id: userId, status, created_at: new Date().toISOString() },
      userId,
    ),
    pendingSync: true,
  }
}

/** All links involving the user, each with the other party's profile. */
export async function listBandmates(userId) {
  const { data, error } = await (await supabase())
    .from('bandmate_links')
    .select('*')
    .or(`user_id.eq.${userId},bandmate_id.eq.${userId}`)
  if (error) throw error

  const links = (data || []).map((row) => normalizeLink(row, userId))
  const ids = [...new Set(links.map((link) => link.userId))]
  if (ids.length) {
    const { data: profiles, error: profilesError } = await (await supabase())
      .from('profiles')
      .select('id, username, display_name')
      .in('id', ids)
    if (profilesError) throw profilesError
    const byId = new Map((profiles || []).map((profile) => [profile.id, profile]))
    for (const link of links) {
      const profile = byId.get(link.userId)
      link.profile = profile
        ? { username: profile.username, displayName: profile.display_name }
        : null
    }
  }
  return links
}

/** Invite a user to the band (pending link from me to them). */
export async function inviteBandmate(userId, bandmateId) {
  const { data: existing, error: existingError } = await (await supabase())
    .from('bandmate_links')
    .select('user_id, bandmate_id, status')
    .eq('user_id', userId)
    .eq('bandmate_id', bandmateId)
    .maybeSingle()
  if (existingError) throw existingError

  const guard = guardInvite(userId, bandmateId, existing)
  if (guard) throw new Error(guard)

  try {
    const { data, error } = await (await supabase())
      .from('bandmate_links')
      .insert({ user_id: userId, bandmate_id: bandmateId })
      .select('*')
      .single()
    if (error) throw error
    return normalizeLink(data, userId)
  } catch (e) {
    if (USER_ERRORS.has(e?.message) || !isConnectivityError(e)) throw e
    await enqueueOp(userId, { name: 'inviteBandmate', args: [userId, bandmateId] })
    return optimisticLink(userId, bandmateId, 'pending')
  }
}

// Online-only mutation: flips MY incoming pending link to the target status.
// Zero rows updated → the invite was revoked/removed/already resolved.
async function respondToInvite(userId, bandmateId, status, patch) {
  const { data, error } = await (await supabase())
    .from('bandmate_links')
    .update({ status, ...patch })
    .eq('user_id', bandmateId)
    .eq('bandmate_id', userId)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('This invitation is no longer valid.')
  return normalizeLink(data, userId)
}

export async function acceptInvite(userId, bandmateId) {
  try {
    return await respondToInvite(userId, bandmateId, 'active', { accepted_at: new Date().toISOString() })
  } catch (e) {
    if (USER_ERRORS.has(e?.message) || !isConnectivityError(e)) throw e
    await enqueueOp(userId, { name: 'respondInvite', args: [userId, bandmateId, 'active'] })
    return optimisticLink(userId, bandmateId, 'active')
  }
}

export async function declineInvite(userId, bandmateId) {
  try {
    return await respondToInvite(userId, bandmateId, 'declined', {})
  } catch (e) {
    if (USER_ERRORS.has(e?.message) || !isConnectivityError(e)) throw e
    await enqueueOp(userId, { name: 'respondInvite', args: [userId, bandmateId, 'declined'] })
    return optimisticLink(userId, bandmateId, 'declined')
  }
}

/**
 * Queue-safe respond used by offlineSync WRITE_OPS (1.3, R6): a revoked
 * invite (row deleted before the queued response drained) drops silently
 * instead of erroring — idempotent replay.
 */
export async function respondInvite(userId, bandmateId, status) {
  try {
    return status === 'active'
      ? await acceptInvite(userId, bandmateId)
      : await declineInvite(userId, bandmateId)
  } catch (e) {
    if (e?.message === 'This invitation is no longer valid.') return null
    throw e
  }
}

/** Remove the band link (either side). Revokes a pending invite, too. */
export async function removeBandmate(userId, bandmateId) {
  const { error } = await (await supabase())
    .from('bandmate_links')
    .delete()
    .or(`and(user_id.eq.${userId},bandmate_id.eq.${bandmateId}),and(user_id.eq.${bandmateId},bandmate_id.eq.${userId})`)
  if (error) throw error
}

// Self-check: node -e "import('./src/lib/bandmates.js').then(m => m.demo())"
export function demo() {
  const assert = (actual, expected, label) => {
    if (actual !== expected) {
      throw new Error(`bandmates demo FAILED: ${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
    }
  }

  // Invite guards (R4): no-self, already-active, any existing row blocks.
  assert(guardInvite('me', 'me', null), 'You cannot add yourself.', 'no-self invite rejected')
  assert(guardInvite('me', 'lu', { status: 'active' }), 'Already in band.', 'active invite rejected')
  assert(guardInvite('me', 'lu', { status: 'pending' }), 'Invitation already sent.', 'pending re-invite rejected')
  assert(guardInvite('me', 'lu', null), null, 'no link → allowed')

  // Direction mapping: each side reads the shared row from their own side.
  const outgoing = normalizeLink(
    { id: 'l1', user_id: 'me', bandmate_id: 'lu', status: 'pending', created_at: 't' },
    'me',
  )
  assert(outgoing.direction, 'outgoing', 'inviter sees outgoing')
  assert(outgoing.userId, 'lu', 'outgoing targets the bandmate id')
  const incoming = normalizeLink(
    { id: 'l1', user_id: 'lu', bandmate_id: 'me', status: 'active', created_at: 't', accepted_at: 'a' },
    'me',
  )
  assert(incoming.direction, 'incoming', 'invitee sees incoming')
  assert(incoming.acceptedAt, 'a', 'accepted_at preserved')

  // Offline optimistic rows carry the pendingSync flag (1.3 queue surface).
  const optimistic = optimisticLink('me', 'lu', 'active')
  assert(optimistic.pendingSync, true, 'optimistic row flagged pendingSync')
  assert(optimistic.direction, 'incoming', 'offline accept still reads incoming')

  console.log('bandmates demo OK: 8 asserts (guards, direction mapping, offline optimism)')
}