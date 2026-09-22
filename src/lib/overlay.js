// OBS overlay data layer (Hito 5 #66): server-backed session for the
// streaming overlay. An OBS Browser Source runs in a SEPARATE Chromium/CEF
// process, so BroadcastChannel and localStorage (External Display /
// Congregation Projection patterns) never cross browser instances — the
// operator's stage app instead writes the current performance snapshot to a
// supabase row (overlay_sessions, migration 0025), and the overlay polls the
// public capability RPC overlay_state(sessionId).
//
// Design notes:
// - ONE row per (user_id, setlist_id) (unique constraint) — a stable overlay
//   URL across streams; enable/disable only flips status
//   'active'/'inactive', the row is NEVER deleted.
// - The unguessable session uuid IS the capability: anon may call the RPC
//   but gets NOTHING unless the session is active — even the owner.
// - The session id is mirrored to localStorage (cemurm:obs:id:<setlistId>)
//   so Stage Mode knows the URL immediately after a reload without a
//   round-trip; all storage access is guarded (midi.js pattern — never
//   explodes offline). The DB row remains the source of truth.
// - Transpose is personal performance state and stays on the operator side:
//   the snapshot pushes the chart as resolved by the stage (song.body).

import { supabase } from './supabase.js'

/** Overlay poll cadence (ms) — disable mid-stream reflects within one poll. */
export const STATE_POLL_MS = 2000

/** Relative overlay URL for a session id — the OBS Browser Source path. */
export const OVERLAY_URL = (sessionId) => `/overlay/${sessionId}`

const ID_PREFIX = 'cemurm:obs:id:'

/** Local mirror of the overlay session id (null when absent/unavailable). */
export function loadOverlayId(setlistId) {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(`${ID_PREFIX}${setlistId}`) || null
  } catch {
    return null
  }
}

/** Persist the session id so the URL survives reloads (best-effort). */
export function saveOverlayId(setlistId, id) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(`${ID_PREFIX}${setlistId}`, id)
  } catch {
    // Storage is a convenience mirror, never critical — stay silent.
  }
}

/**
 * Activate (or re-activate) the overlay for a setlist and write the current
 * snapshot. Returns the session id — the stable URL token. Throws when the
 * caller is not signed in or the write fails; the caller decides how to
 * surface that.
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
    .select('id')
    .single()
  if (error) throw error
  saveOverlayId(setlistId, data.id)
  return { id: data.id }
}

/**
 * Flip the session to inactive; the row (and its URL) stays put. The local
 * mirror is the fast path; a DB read fills in when the mirror was evicted so
 * a stale mirror can never leave the stream pretending to be off.
 */
export async function disableOverlay(setlistId) {
  const id = loadOverlayId(setlistId) ?? (await getOverlaySession(setlistId))?.id
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
  const id = loadOverlayId(setlistId) ?? (await getOverlaySession(setlistId))?.id
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
  const id = loadOverlayId(setlistId)
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
    .select('id,status,mode')
    .eq('setlist_id', setlistId)
    .maybeSingle()
  if (error) throw error
  return data
}