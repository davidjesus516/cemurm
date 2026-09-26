// Supabase data layer for rehearsals (Hito 4 — rehearsal workflow, 0019 backend).
// The 0019 migration owns the read scope (leader + org/event members) and every
// write RPC; this layer only maps rows to app shapes, resolves member names via
// the profiles search, and forwards RPC errors verbatim when they are known.
// No offline queueing yet (outbox is schema-only on this branch).
//
// RLS notes driving the reads:
//  - rehearsals / rehearsal_items / rehearsal_rsvps / setlist_change_log are
//    SELECT-granted for the visible scope (0019 2.2-2.5).
//  - songs / song_versions stay owner-only (0002/0003) — the embedded joins in
//    getRehearsal return null rows for members who do not own the song, so the
//    flattener falls back to the song's latest-version duration and '—' titles.
//  - organizations are deny-by-default on this branch — org names resolve
//    best-effort and render '—' when unreachable (gigs.js resolveOrgId precedent
//    for the ids; session_org_ids() is the public bridge, 0005).

import { supabase } from '../supabase.js'

// ponytail: known user-facing errors re-thrown as-is; network/PostgREST
// errors map to a safe generic message (gigs.js / songs.js convention).
const USER_ERRORS = new Set([
  'Not a member.',
  'Setlist not found.',
  'Rehearsal not found.',
  'Only the leader can publish this rehearsal.',
  'You are not invited to this rehearsal.',
  'Invalid status.',
  'Song already in the agenda.',
  'Only the leader can add songs to this rehearsal.',
  'Song not in the agenda.',
  'Invalid outcome.',
  'Only the leader can complete this rehearsal.',
  'Rehearsal not found or already completed.',
  'Only the setlist owner or the rehearsal leader can change the agreed key.',
  'Invalid key.',
  'Item not found in the setlist.',
  // client-side guards (validated before any network call)
  'Rehearsal name is required.',
  'Select an organization.',
  'Select a setlist.',
  'Timebox must be a positive number.',
])

function handleError(error) {
  if (USER_ERRORS.has(error?.message)) throw error
  throw new Error('Something went wrong. Please try again.')
}

async function withErrorMapping(fn) {
  try { return await fn() } catch (e) { handleError(e) }
}

/** Flatten a raw Supabase rehearsal row into the app shape. */
function flattenRehearsal(row, orgName) {
  return {
    id: row.id,
    orgId: row.org_id,
    orgName: orgName || null,
    branchId: row.branch_id,
    eventId: row.event_id,
    scope: row.scope,
    name: row.name,
    setlistId: row.setlist_id,
    timeboxMinutes: row.timebox_minutes,
    status: row.status,
    plannedFor: row.planned_for,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

/**
 * Best-effort org name lookup (organizations are deny-by-default on this
 * branch — a failed read yields null, and callers render '—').
 */
async function fetchOrgNames(orgIds) {
  const unique = [...new Set((orgIds || []).filter(Boolean))]
  if (unique.length === 0) return new Map()
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', unique)
    if (error) return new Map()
    return new Map((data || []).map((o) => [o.id, o.name]))
  } catch {
    return new Map()
  }
}

/**
 * The session's org ids via the public session_org_ids() bridge (0005).
 * No helper is importable from gigs.js (resolveOrgId is private there), so
 * the RPC is called directly here.
 */
export function getSessionOrgIds() {
  return withErrorMapping(async () => {
    const { data, error } = await supabase.rpc('session_org_ids')
    if (error) throw error
    return Array.isArray(data) ? data : []
  })
}

/**
 * Session orgs with best-effort display names (for the "New rehearsal" form);
 * id-only labels when the names are unreachable.
 */
export async function getSessionOrgs() {
  const ids = await getSessionOrgIds()
  if (ids.length === 0) return []
  const names = await fetchOrgNames(ids)
  return ids.map((id) => ({ id, name: names.get(id) || null }))
}

/**
 * List rehearsals visible to the session, newest first. Org name join is
 * best-effort (null on this branch — the list renders '—'); item count comes
 * from the embedded rehearsal_items(count) aggregate (RLS-capped, 0019 2.3).
 */
export function listRehearsals() {
  return withErrorMapping(async () => {
    const { data, error } = await supabase
      .from('rehearsals')
      .select('*, rehearsal_items(count)')
      .order('created_at', { ascending: false })
    if (error) throw error

    const rows = data || []
    const orgNames = await fetchOrgNames(rows.map((r) => r.org_id))
    return rows.map((row) => ({
      ...flattenRehearsal(row, orgNames.get(row.org_id)),
      itemCount: row.rehearsal_items?.[0]?.count ?? 0,
    }))
  })
}

/**
 * Latest version duration of a song from the nested songs.song_versions embed
 * (sorted by created_at desc — DB rows come unsorted). null when unreachable.
 */
function latestVersionDuration(versions) {
  const rows = (versions || [])
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  return rows.find((v) => v.duration_seconds != null)?.duration_seconds ?? null
}

/**
 * Fetch one rehearsal with its agenda, rsvps and setlist change log.
 * Agenda ordering: the rehearsal's setlist items first (by position), then
 * extra songs not in the setlist. Member names (rsvps / vocal_parts /
 * created_by / change-log actors) resolve through the profiles search —
 * profiles carries only id/username/display_name on this branch (0006).
 * Throws 'Rehearsal not found.' when the row is invisible/absent.
 */
export function getRehearsal(id) {
  return withErrorMapping(async () => {
    const { data: rehearsalRow, error: rehearsalErr } = await supabase
      .from('rehearsals')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (rehearsalErr) throw rehearsalErr
    if (!rehearsalRow) throw new Error('Rehearsal not found.')

    const orgNames = await fetchOrgNames([rehearsalRow.org_id])
    const rehearsal = flattenRehearsal(rehearsalRow, orgNames.get(rehearsalRow.org_id))

    const { data: itemRows, error: itemsErr } = await supabase
      .from('rehearsal_items')
      .select('*, songs(title, artist, song_versions(created_at, duration_seconds)), song_versions(is_ready, duration_seconds)')
      .eq('rehearsal_id', id)
    if (itemsErr) throw itemsErr

    // ONE extra query on setlist_items for the rehearsal's setlist — attaches
    // inSetlist / agreedKey / parts (vocal_parts) / position to each item.
    // Client-readable for owner/accepted collaborator (0002 setlist_items
    // select_member); a caller outside that scope sees every item as an extra.
    let setlistItems = []
    if (rehearsal.setlistId) {
      const { data: siRows, error: siErr } = await supabase
        .from('setlist_items')
        .select('id, song_id, agreed_key, vocal_parts, position')
        .eq('setlist_id', rehearsal.setlistId)
        .order('position', { ascending: true })
      if (siErr) throw siErr
      setlistItems = siRows || []
    }
    const setlistBySong = new Map(setlistItems.map((si) => [
      si.song_id,
      {
        setlistItemId: si.id,
        agreedKey: si.agreed_key,
        position: si.position,
        parts: (si.vocal_parts || []).map((vp) => ({
          part: vp.part || '',
          userId: vp.user_id || null,
        })),
      },
    ]))

    const { data: rsvpRows, error: rsvpErr } = await supabase
      .from('rehearsal_rsvps')
      .select('*')
      .eq('rehearsal_id', id)
    if (rsvpErr) throw rsvpErr

    // Change log is visible to the setlist audience only (0019 2.5) — a
    // caller outside it reads zero rows, not an error.
    let logRows = []
    if (rehearsal.setlistId) {
      const { data, error: logErr } = await supabase
        .from('setlist_change_log')
        .select('*')
        .eq('setlist_id', rehearsal.setlistId)
        .order('created_at', { ascending: false })
      if (logErr) throw logErr
      logRows = data || []
    }

    // Resolve display names for every referenced user in ONE profiles query
    // (listCollaborators precedent — no FK from the new tables to profiles).
    const ids = new Set([
      rehearsal.createdBy,
      ...(rsvpRows || []).map((r) => r.user_id),
      ...setlistItems.flatMap((si) => (si.vocal_parts || []).map((vp) => vp.user_id)),
      ...logRows.map((l) => l.actor_id),
    ].filter(Boolean))
    let byId = new Map()
    if (ids.size > 0) {
      const { data: profiles, error: profilesErr } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', [...ids])
      if (profilesErr) throw profilesErr
      byId = new Map((profiles || []).map((p) => [p.id, p]))
    }
    const nameOf = (userId) => {
      if (!userId) return 'Unassigned'
      const profile = byId.get(userId)
      return profile?.display_name || profile?.username || 'Someone'
    }

    const items = (itemRows || []).map((it) => {
      const attached = setlistBySong.get(it.song_id)
      return {
        id: it.id,
        songId: it.song_id,
        title: it.songs?.title || '',
        artist: it.songs?.artist || '',
        versionId: it.version_id,
        isReady: it.song_versions?.is_ready ?? null,
        durationSeconds: it.song_versions?.duration_seconds ?? null,
        latestVersionDurationSeconds: latestVersionDuration(it.songs?.song_versions),
        outcome: it.outcome || '',
        runCount: it.run_count ?? 0,
        notes: it.notes || '',
        carryOverTo: it.carry_over_to || null,
        inSetlist: !!attached,
        agreedKey: attached?.agreedKey ?? null,
        parts: (attached?.parts || []).map((p) => ({ ...p, name: nameOf(p.userId) })),
        position: attached?.position ?? null,
        setlistItemId: attached?.setlistItemId ?? null,
      }
    })

    // Order: setlist items by position first, then extra songs (query order).
    const orderedItems = [
      ...items.filter((i) => i.inSetlist).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
      ...items.filter((i) => !i.inSetlist),
    ]

    return {
      rehearsal,
      items: orderedItems,
      rsvps: (rsvpRows || []).map((r) => ({
        id: r.id,
        rehearsalId: r.rehearsal_id,
        userId: r.user_id,
        status: r.status,
        respondedAt: r.responded_at,
        name: nameOf(r.user_id),
      })),
      changeLog: logRows.map((l) => ({
        id: l.id,
        setlistId: l.setlist_id,
        actorId: l.actor_id,
        actorName: nameOf(l.actor_id),
        action: l.action,
        detail: l.detail || {},
        createdAt: l.created_at,
      })),
    }
  })
}

/**
 * Create an org-scope rehearsal mirroring a setlist's agenda. Returns the new
 * rehearsal id. Client guards run before the RPC; backend errors surface
 * verbatim ('Not a member.', 'Setlist not found.').
 */
export function createRehearsal({ orgId, name, setlistId, timeboxMinutes, plannedFor }) {
  return withErrorMapping(async () => {
    const trimmed = name?.trim()
    if (!trimmed) throw new Error('Rehearsal name is required.')
    if (!orgId) throw new Error('Select an organization.')
    if (!setlistId) throw new Error('Select a setlist.')
    const timebox = Number(timeboxMinutes)
    if (!Number.isFinite(timebox) || timebox <= 0) throw new Error('Timebox must be a positive number.')
    const iso = plannedFor instanceof Date ? plannedFor.toISOString() : plannedFor

    const { data, error } = await supabase.rpc('create_rehearsal', {
      p_org_id: orgId,
      p_name: trimmed,
      p_setlist_id: setlistId,
      p_timebox_minutes: Math.round(timebox),
      p_planned_for: iso || null,
    })
    if (error) throw error
    return data
  })
}

/** Publish the agenda: flips the status and invites every assigned member. */
export function publishRehearsal(rehearsalId) {
  return withErrorMapping(async () => {
    const { data, error } = await supabase.rpc('publish_rehearsal', { p_rehearsal_id: rehearsalId })
    if (error) throw error
    return data ?? 0
  })
}

/**
 * Answer my own invitation. Status vocabulary validated here (before the RPC,
 * per the contract) so 'Invalid status.' never runs a network call.
 */
const RSVP_STATUSES = new Set(['confirmed', 'declined', 'undecided'])
export function rsvpRehearsal(rehearsalId, status) {
  return withErrorMapping(async () => {
    if (!RSVP_STATUSES.has(status)) throw new Error('Invalid status.')
    const { error } = await supabase.rpc('rsvp_rehearsal', {
      p_rehearsal_id: rehearsalId,
      p_status: status,
    })
    if (error) throw error
  })
}

/** Leader adds an extra song to the agenda (setlist untouched). */
export function addRehearsalSong({ rehearsalId, songId }) {
  return withErrorMapping(async () => {
    const { data, error } = await supabase.rpc('add_rehearsal_song', {
      p_rehearsal_id: rehearsalId,
      p_song_id: songId,
    })
    if (error) throw error
    return data
  })
}

/** Record one run-through: rehearsal_items.run_count + 1. */
export function recordRun({ rehearsalId, itemId }) {
  return withErrorMapping(async () => {
    const { error } = await supabase.rpc('record_rehearsal_run', {
      p_rehearsal_id: rehearsalId,
      p_item_id: itemId,
    })
    if (error) throw error
  })
}

/** Mark an outcome: polished | needs_work | quick_review (vocabulary checked first). */
const OUTCOMES = new Set(['polished', 'needs_work', 'quick_review'])
export function markOutcome({ rehearsalId, itemId, outcome }) {
  return withErrorMapping(async () => {
    if (!OUTCOMES.has(outcome)) throw new Error('Invalid outcome.')
    const { error } = await supabase.rpc('mark_rehearsal_outcome', {
      p_rehearsal_id: rehearsalId,
      p_item_id: itemId,
      p_outcome: outcome,
    })
    if (error) throw error
  })
}

/** Attach a rehearsal note to the agenda item (NULL clears it). */
export function updateNote({ rehearsalId, itemId, note }) {
  return withErrorMapping(async () => {
    const { error } = await supabase.rpc('update_rehearsal_note', {
      p_rehearsal_id: rehearsalId,
      p_item_id: itemId,
      p_note: note,
    })
    if (error) throw error
  })
}

/** Leader closes the rehearsal; afterwards every role reads it only. */
export function completeRehearsal(rehearsalId) {
  return withErrorMapping(async () => {
    const { error } = await supabase.rpc('complete_rehearsal', { p_rehearsal_id: rehearsalId })
    if (error) throw error
  })
}

/**
 * Change the agreed key on the SETLIST item (p_item_id is the setlist item,
 * not the rehearsal item). Other devices pick the change up by re-fetching
 * the setlist — this layer only re-fetches on behalf of the caller's UI.
 */
export function changeSetlistItemKey({ setlistId, itemId, agreedKey }) {
  return withErrorMapping(async () => {
    const key = String(agreedKey ?? '').trim()
    if (!key) throw new Error('Invalid key.')
    const { error } = await supabase.rpc('change_setlist_item_key', {
      p_setlist_id: setlistId,
      p_item_id: itemId,
      p_agreed_key: key,
    })
    if (error) throw error
  })
}

/**
 * Extend the timebox: a plain leader-only UPDATE on rehearsals
 * (0019 rehearsals_update_leader — created_by + status <> 'completed').
 */
export function updateTimebox(rehearsalId, minutes) {
  return withErrorMapping(async () => {
    const timebox = Number(minutes)
    if (!Number.isFinite(timebox) || timebox <= 0) throw new Error('Timebox must be a positive number.')
    const { error } = await supabase
      .from('rehearsals')
      .update({ timebox_minutes: Math.round(timebox) })
      .eq('id', rehearsalId)
    if (error) throw error
  })
}

/**
 * Estimated agenda duration in TOTAL SECONDS (the contract's name says
 * "minutes"; the value is seconds for exact BDD math). Each item's slot
 * comes from its chosen version's duration, falling back to the song's
 * latest-version duration, and 0 when unreachable. A 'quick_review' outcome
 * TRIMS the slot — the item is excluded entirely (scenario 8).
 */
export function estimateMinutes(items) {
  return (items || []).reduce((sum, item) => {
    if (item.outcome === 'quick_review') return sum
    return sum + (item.durationSeconds ?? item.latestVersionDurationSeconds ?? 0)
  }, 0)
}

/**
 * Format total seconds as words — '15 minutes and 30 seconds' (BDD scenario 6
 * exact shape). Total is rounded to whole seconds and clamped at zero.
 */
export function formatDuration(totalSeconds) {
  const total = Math.max(0, Math.round(Number(totalSeconds) || 0))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  const minutesWord = `${minutes} minute${minutes === 1 ? '' : 's'}`
  const secondsWord = `${seconds} second${seconds === 1 ? '' : 's'}`
  return `${minutesWord} and ${secondsWord}`
}