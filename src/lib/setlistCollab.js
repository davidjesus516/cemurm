// Pure guards + activity labels for shared-setlist collaboration (Hito 3
// PR#2a, tasks 2.1/2.3). Zero imports, so this module is bare-node safe and
// the demo runs under node directly (setlists.js is not: it statically
// imports songs.js → supabase.js, which evaluates import.meta.env at module
// scope — undefined in bare node). The network ops that wrap these guards
// live in setlists.js (2.1); the broadcast helpers and feed panel are the
// 2.3 surface.

/**
 * Visibility values the spec allows: 'private' | 'shared' | 'public'
 * ('org'/'branch' are reserved for Hito 4). Returns an error message or
 * null when valid.
 */
export function guardVisibility(value) {
  return ['private', 'shared', 'public'].includes(value)
    ? null
    : 'Visibility must be private, shared, or public.'
}

/**
 * Bandmate ids eligible for a fresh share: excludes the owner (a setlist
 * owner is not a collaborator of their own setlist) and users who already
 * hold a collaborator row, then dedupes (setlist_collaborators is PK
 * (setlist_id, user_id) — a duplicate insert would 23505).
 */
export function shareTargets(ownerId, bandmateIds, collaborators) {
  const existing = new Set((collaborators || []).map((c) => c.userId))
  return [...new Set(bandmateIds || [])].filter((id) => id !== ownerId && !existing.has(id))
}

/**
 * Transfer guard (setlists R9): the new owner must already be an ACCEPTED
 * collaborator — a pending invitee has no setlist access yet (0002
 * setlists_select_member requires accepted_at), so flipping owner_id would
 * hand the setlist to someone who cannot even open it. Accepts lib rows
 * ({user_id, accepted_at}) and normalized rows ({userId, ...}).
 */
export function guardTransfer(collaborators, candidateId) {
  const row = (collaborators || []).find((c) => (c.user_id || c.userId) === candidateId)
  if (!row) return 'Only an accepted collaborator can take ownership.'
  if (!row.accepted_at) return 'The new owner must accept the invitation first.'
  return null
}

const ACTIVITY_LABELS = {
  share: (actor) => `${actor} shared with the band`,
  'reorder': (actor) => `${actor} reordered the setlist`,
  'transfer-ownership': (actor) => `Ownership transferred to ${actor}`,
}

/**
 * Feed row {actor, action, ts} → "who did what" line (S11/S12). Unknown
 * actions degrade gracefully to "actor action".
 */
export function describeActivity(event) {
  const label = ACTIVITY_LABELS[event.action]
  return label ? label(event.actor) : `${event.actor} ${event.action}`
}

// Self-check: node -e "import('./src/lib/setlistCollab.js').then(m => m.demo())"
export function demo() {
  const assert = (actual, expected, label) => {
    if (actual !== expected) {
      throw new Error(`setlistCollab demo FAILED: ${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
    }
  }

  assert(guardVisibility('shared'), null, 'shared is a valid visibility')
  assert(guardVisibility('private'), null, 'private is a valid visibility')
  assert(guardVisibility('org'), 'Visibility must be private, shared, or public.', 'org reserved for Hito 4, rejected')

  assert(
    JSON.stringify(shareTargets('me', ['a', 'b', 'a', 'me'], [{ userId: 'b' }])),
    JSON.stringify(['a']),
    'share targets: dedupe, exclude owner and current collaborators',
  )

  const collabs = [
    { user_id: 'jul', accepted_at: '2026-01-01T00:00:00Z' },
    { userId: 'luc', acceptedAt: null },
  ]
  assert(guardTransfer(collabs, 'jul'), null, 'accepted collaborator may take ownership')
  assert(guardTransfer(collabs, 'luc'), 'The new owner must accept the invitation first.', 'pending invitee rejected')
  assert(guardTransfer(collabs, 'ann'), 'Only an accepted collaborator can take ownership.', 'non-collaborator rejected')

  assert(describeActivity({ actor: 'Julian', action: 'reorder', ts: 't' }), 'Julian reordered the setlist', 'reorder label (S11)')
  assert(describeActivity({ actor: 'Julian', action: 'transfer-ownership', ts: 't' }), 'Ownership transferred to Julian', 'transfer label (S12/R9)')
  assert(describeActivity({ actor: 'Julian', action: 'share', ts: 't' }), 'Julian shared with the band', 'share label')
  assert(describeActivity({ actor: 'X', action: 'mystery', ts: 't' }), 'X mystery', 'unknown action falls back to actor + action')

  console.log('setlistCollab demo OK: 11 asserts (visibility, share targets, transfer guard, feed labels)')
}