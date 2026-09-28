// OBS overlay data layer (Hito 5 #66): server-backed session for the
// streaming overlay. An OBS Browser Source runs in a SEPARATE Chromium/CEF
// process, so BroadcastChannel and localStorage (External Display /
// Congregation Projection patterns) never cross browser instances — the
// operator's stage app instead writes the current performance snapshot to a
// supabase row (overlay_sessions, migrations 0025 + 0032), and the overlay
// polls the public capability RPC overlay_state(accessToken).
//
// Design notes:
// - ONE row per (user_id, setlist_id) (unique constraint) — a stable overlay
//   URL across streams; enable/disable only flips status
//   'active'/'inactive', the row is NEVER deleted.
// - The row's `access_token` IS the capability (0032). It is a dedicated column
//   on the 0017 `revocation_token` / 0020 `sharing_approval_token` pattern: the
//   primary key `id` is an ordinary identifier and is NOT accepted by the RPC.
//   The token is rotatable inside the row (rotateOverlayToken), which is what
//   makes a leaked URL revocable without ending the stream.
// - The token is mirrored to localStorage (cemurm:obs:token:<setlistId>) so
//   Stage Mode knows the URL immediately after a reload without a round-trip;
//   all storage access is guarded (midi.js pattern — never explodes offline).
//   The DB row remains the source of truth. The prefix deliberately changed from
//   `cemurm:obs:id:` in 0032 so a mirror left by the id-based version is
//   ignored instead of being used as a token.
// - Owner-side writes (disable/mode/push) still key on `id`: they are
//   authenticated owner operations where RLS is the gate, and the id is the
//   right key for them. They resolve it from the DB row, never from the mirror,
//   so no stale local value can address the wrong row.
// - Transpose is personal performance state and stays on the operator side:
//   the snapshot pushes the chart as resolved by the stage (song.body).

import { supabase } from '../supabase.js'

/** Overlay poll cadence (ms) — disable mid-stream reflects within one poll. */
export const STATE_POLL_MS = 2000

/** Relative overlay URL for an access token — the OBS Browser Source path. */
export const OVERLAY_URL = (token) => `/overlay/${token}`

const TOKEN_PREFIX = 'cemurm:obs:token:'

/** Local mirror of the overlay access token (null when absent/unavailable). */
export function loadOverlayToken(setlistId) {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(`${TOKEN_PREFIX}${setlistId}`) || null
  } catch {
    return null
  }
}

/** Persist the access token so the URL survives reloads (best-effort). */
export function saveOverlayToken(setlistId, token) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(`${TOKEN_PREFIX}${setlistId}`, token)
  } catch {
    // Storage is a convenience mirror, never critical — stay silent.
  }
}

/**
 * Activate (or re-activate) the overlay for a setlist and write the current
 * snapshot. Returns { id, accessToken } — accessToken is the URL credential.
 * Throws when the caller is not signed in or the write fails; the caller decides
 * how to surface that.
 *
 * The upsert payload deliberately does NOT carry access_token: re-enabling must
 * keep the same token, or the "stable overlay URL" contract would break on
 * every stream. A new row takes the column default instead.
 */
export async function enableOverlay(setlistId, snapshot) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Sign in to enable the OBS overlay.')
  }
  const { data, error } = await supabase
    .from('overlay_sessions')
    .upsert(
      {
        user_id: user.id,
        setlist_id: setlistId,
        status: 'active',
        mode: 'title',
        ...snapshot,
      },
      { onConflict: 'user_id,setlist_id' },
    )
    .select('id, access_token')
    .single()
  if (error) throw error
  saveOverlayToken(setlistId, data.access_token)
  return { id: data.id, accessToken: data.access_token }
}

/**
 * Issue a FRESH access token for the caller's own overlay row and return it.
 *
 * This is the capability 0032 adds and the id-based version could not offer:
 * revoking a leaked overlay URL without ending the stream. The old token stops
 * resolving at the next poll while the row, its setlist binding, its status and
 * the running stream are untouched. The caller re-copies the URL; anything
 * still holding the previous URL goes inactive.
 *
 * Same auth + error shape as enableOverlay: throws when the caller is not
 * signed in, when no overlay row exists for the setlist, or when the write
 * fails, and the caller surfaces that. RLS scopes the update to the owner, so a
 * foreign row is never reachable.
 */
export async function rotateOverlayToken(setlistId) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Sign in to rotate the OBS overlay token.')
  }
  const { data, error } = await supabase
    .from('overlay_sessions')
    .update({ access_token: crypto.randomUUID() })
    .eq('setlist_id', setlistId)
    .select('access_token')
    .single()
  if (error) throw error
  saveOverlayToken(setlistId, data.access_token)
  return data.access_token
}

/**
 * Flip the session to inactive; the row (and its token) stays put. The row id
 * comes from the DB — the source of truth — so a stale local value can never
 * leave the stream pretending to be off.
 */
export async function disableOverlay(setlistId) {
  const id = (await getOverlaySession(setlistId))?.id
  if (!id) return
  const { error } = await supabase
    .from('overlay_sessions')
    .update({ status: 'inactive' })
    .eq('id', id)
  if (error) throw error
}

/** Operator override: 'title' (spotlight) or 'chords' (title + chart). */
export async function setOverlayMode(setlistId, mode) {
  if (mode !== 'title' && mode !== 'chords') {
    throw new Error(`Invalid overlay mode: ${mode}`)
  }
  const id = (await getOverlaySession(setlistId))?.id
  if (!id) return
  const { error } = await supabase
    .from('overlay_sessions')
    .update({ mode })
    .eq('id', id)
  if (error) throw error
}

/**
 * Push the current song snapshot ({ song_index, song_total, song_title,
 * song_key, chart_body }). BEST-EFFORT, mirroring midi.js: failures are
 * swallowed so a hiccup never blocks the performance — the next poll simply
 * serves the last state that made it to the database.
 */
export async function pushOverlayState(setlistId, snapshot) {
  const id = (await getOverlaySession(setlistId))?.id
  if (!id) return
  try {
    const { error } = await supabase
      .from('overlay_sessions')
      .update(snapshot)
      .eq('id', id)
    if (error) return
  } catch {
    // Best-effort: silently ignore (see above).
  }
}

/** Owner read of the session row for URL recovery after a reload. */
export async function getOverlaySession(setlistId) {
  const { data, error } = await supabase
    .from('overlay_sessions')
    .select('id, access_token, status, mode')
    .eq('setlist_id', setlistId)
    .maybeSingle()
  if (error) throw error
  return data
}
