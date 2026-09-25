// Planning Center integration data layer (Hito 5 #78): plans list + import +
// export under the external_connections contract (migration 0026 — the row is
// shared with Spotify, provider 'planningcenter', unique(user_id, provider),
// revoke = status flip, row persists). The connection state is mirrored to
// localStorage (cemurm:pco:connection:<userId>, enrichments.js pattern) so the
// Settings page and the Setlists/SetlistDetail gates render offline.
//
// MOCK PROVIDER (dev default): real Planning Center OAuth requires a
// server-side callback — a documented limitation (docs/local-dev.md). The dev
// mock is a deterministic contract (dev mock — real Planning Center OAuth
// requires a server-side callback, documented in docs/local-dev.md): two plans
// whose song sets are designed so ≥1 title matches the SEEDED demo library
// ('Way Maker' = seed 20000000-…-001, 'Oceans (Where Feet May Fail)' = …-002)
// and ≥1 has no chart → the missing-chart flag in SetlistDetail (S12).
//
// Gates (S13): every plan read/import/export first checks the connection row;
// status 'revoked' → { ok:false, error:'integration revoked' } — imported
// SETLISTS stay ordinary rows (revoke never deletes anything).
//
// Node-safety: supabase AND the songs/setlists data layers are lazy-imported
// (supabase.js throws at eval without env vars, and songs.js/setlists.js pull
// it in at top level) — the module graph stays import-safe in node so the
// pure demo runs without Vite env vars.

import { normalizeTitle } from './importers/duplicates.js'

const CONNECTION_PREFIX = 'cemurm:pco:connection:'

// Lazy imports (house pattern): the DB layers only load on first use, keeping
// this module import-safe in node.
let supabaseClient = null
async function supabase() {
  if (!supabaseClient) supabaseClient = (await import('./supabase.js')).supabase
  return supabaseClient
}
let songsModule = null
async function songsLib() {
  if (!songsModule) songsModule = await import('./songs.js')
  return songsModule
}
let setlistsModule = null
async function setlistsLib() {
  if (!setlistsModule) setlistsModule = await import('./setlists.js')
  return setlistsModule
}

// ─────────────────────────────────────────────────────────────────────────────
// localStorage mirror (guarded, best-effort — enrichments.js/overlay.js pattern)
// ─────────────────────────────────────────────────────────────────────────────

function loadConnectionMirror(userId) {
  if (typeof localStorage === 'undefined' || !userId) return null
  try {
    const raw = localStorage.getItem(`${CONNECTION_PREFIX}${userId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveConnectionMirror(userId, row) {
  if (typeof localStorage === 'undefined' || !userId) return
  try {
    localStorage.setItem(`${CONNECTION_PREFIX}${userId}`, JSON.stringify(row))
  } catch {
    // Storage is a convenience mirror, never critical — stay silent.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection lifecycle (provider 'planningcenter' — mirrors the Spotify trio
// in enrichments.js, byte-compatible shape, separate mirror key)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The user's Planning Center connection row, or null. Offline-safe: the DB
 * read is the source of truth; a mirror fill-in only happens when the read
 * FAILS (network down) — a successful read that finds no row wins over a
 * stale mirror so a revoked/absent connection never comes back to life.
 */
export async function getPcoConnection(userId) {
  const mirrored = loadConnectionMirror(userId)
  try {
    const { data, error } = await (await supabase())
      .from('external_connections')
      .select('id, user_id, provider, status, created_at')
      .eq('user_id', userId)
      .eq('provider', 'planningcenter')
      .maybeSingle()
    if (error) throw error
    if (data) saveConnectionMirror(userId, data)
    return data
  } catch {
    return mirrored
  }
}

/**
 * Upsert the connection row to 'connected' — the mock provider's connect
 * (real OAuth arrives with the server-side callback; local-dev.md). Mirrors
 * the row; throws only on a hard write failure.
 */
export async function ensurePcoConnected(userId) {
  const { data, error } = await (await supabase())
    .from('external_connections')
    .upsert(
      { user_id: userId, provider: 'planningcenter', status: 'connected' },
      { onConflict: 'user_id,provider' },
    )
    .select('id, user_id, provider, status, created_at')
    .single()
  if (error) throw error
  saveConnectionMirror(userId, data)
  return data
}

/**
 * Revoke: UPDATE status='revoked' — the row persists and imported setlists
 * REMAIN (ordinary setlists rows; nothing is deleted). The mirror is updated
 * so the offline Settings page renders Revoked.
 */
export async function disconnectPco(userId) {
  const { data, error } = await (await supabase())
    .from('external_connections')
    .update({ status: 'revoked' })
    .eq('user_id', userId)
    .eq('provider', 'planningcenter')
    .select('id, user_id, provider, status, created_at')
    .maybeSingle()
  if (error) throw error
  saveConnectionMirror(userId, data || { user_id: userId, provider: 'planningcenter', status: 'revoked' })
  return data
}

/**
 * S13 gate: revoked stops every plan read/import/export with the EXACT
 * message. Pure so the demo can assert it without a DB; every DB-facing
 * entry point resolves its own connection row and runs this before touching
 * anything. No row (never connected) or 'connected' passes — the UI only
 * exposes the import surface when the row says connected.
 */
export function connectionGate(connection) {
  if (connection?.status === 'revoked') {
    return { ok: false, error: 'integration revoked' }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock plans (deterministic dev contract)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The deterministic plan fixture. Plan 1 ('Sunday 10am') carries FOUR songs in
 * order (S12 acceptance shape): 'Way Maker' and 'Oceans (Where Feet May Fail)'
 * match the SEEDED demo library (20000000-…-001/…-002 → linked), 'Goodness of
 * God' and 'Kingdom' have no chart (→ created as missing-chart drafts). Plan 2
 * exercises the multi-plan picker. Pure + stable across calls.
 */
export function buildMockPlans() {
  return [
    {
      id: 'pco-sunday-10am',
      name: 'Sunday 10am',
      songs: [
        { title: 'Way Maker', artist: 'Sinach' },
        { title: 'Oceans (Where Feet May Fail)', artist: 'Hillsong UNITED' },
        { title: 'Goodness of God', artist: 'Bethel Music' },
        { title: 'Kingdom', artist: 'Maverick City Music' },
      ],
    },
    {
      id: 'pco-wednesday-rehearsal',
      name: 'Wednesday Rehearsal',
      songs: [
        { title: 'Way Maker', artist: 'Sinach' },
        { title: 'Kingdom', artist: 'Maverick City Music' },
      ],
    },
  ]
}

/**
 * The plan list, gated on the user's connection. `connection` is an OPTIONAL
 * injected row (enrichments-style test seam — duplicates.js
 * findDuplicateCandidates precedent): the demo asserts the gate + determinism
 * without a DB; the UI path omits it and resolves the row itself.
 */
export async function listPlans(userId, connection = null) {
  const conn = connection || (await getPcoConnection(userId))
  const gate = connectionGate(conn)
  if (gate) return gate
  return { ok: true, plans: buildMockPlans() }
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan import (S12)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pure title matching for plan→library linking. CONSERVATIVE on purpose:
 * exact normalized-equality only — unlike the queue's dedupe containment
 * (which asks a human), an auto-link must never guess ('Happy' ≠ 'Happy
 * Birthday'). No chart → the song is created as a draft (S12 missing-chart
 * flag) and a human can merge later.
 */
export function matchPlanSong(planSong, librarySongs) {
  const q = normalizeTitle(planSong?.title)
  if (!q) return null
  return (librarySongs || []).find((s) => q === normalizeTitle(s.title)) || null
}

/**
 * Import ONE plan as a new setlist `<name> (from Planning Center)`, plan-song
 * order preserved by sequential append. Each plan song links to its exact
 * library match; a chart-less plan song is created as a DRAFT song (title +
 * artist only, no body, no source — it carries no chart to attribute) and then
 * appended. `librarySongs` is optional (the lib loads the user's repertoire
 * when omitted — the UI does not need a songs read of its own). Revoked →
 * { ok:false, error:'integration revoked' } before ANY write (S13).
 *
 * Intended for online use: the hook gates on navigator.onLine, and a mid-import
 * drop fails on the first addSong (addSong has no offline queue path) while
 * createSetlist/addSongToSetlist would enqueue — the UI gate prevents that
 * split; the lib documents the boundary.
 */
export async function importPlanToSetlist(userId, plan, { librarySongs } = {}) {
  const conn = await getPcoConnection(userId)
  const gate = connectionGate(conn)
  if (gate) return gate
  if (!Array.isArray(plan?.songs) || !plan.songs.length) {
    return { ok: false, error: 'This plan has no songs.' }
  }

  const setlists = await setlistsLib()
  const songs = await songsLib()
  const library = librarySongs || (await songs.listSongs(userId))

  const setlist = await setlists.createSetlist(userId, {
    name: `${String(plan.name || 'Plan').trim()} (from Planning Center)`,
  })

  let linked = 0
  let createdMissing = 0
  for (const planSong of plan.songs) {
    const match = matchPlanSong(planSong, library)
    if (match) {
      await setlists.addSongToSetlist(userId, setlist.id, match.id)
      linked += 1
    } else {
      const created = await songs.addSong(userId, {
        title: String(planSong.title || '').trim(),
        meta: { artist: planSong.artist || '' },
      })
      await setlists.addSongToSetlist(userId, setlist.id, created.id)
      createdMissing += 1
    }
  }

  return { ok: true, setlistId: setlist.id, linked, createdMissing }
}

// ─────────────────────────────────────────────────────────────────────────────
// Setlist export (S17 — T8 wires the UI)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialize ONLY title/key per song — never projections, annotations or chart
 * bodies go to Planning Center (S17). Pure: the export payload is derivable
 * and assertable in the demo; the mock push simply counts it.
 */
export function serializeExportSongs(songs) {
  return (songs || []).map((song) => ({
    title: song?.title || '',
    key: song?.key || '',
  }))
}

/**
 * Mock push of a setlist to a plan: { ok:true, pushed, planId }. Revoked →
 * { ok:false, error:'integration revoked' }. `connection` is the same optional
 * injected-row seam as listPlans (demo-assertable gate); the UI omits it.
 */
export async function exportSetlistToPlan(userId, planId, songs, connection = null) {
  const conn = connection || (await getPcoConnection(userId))
  const gate = connectionGate(conn)
  if (gate) return gate
  const payload = serializeExportSongs(songs)
  return { ok: true, pushed: payload.length, planId }
}

// Self-check: node -e "import('./src/lib/planningcenter.js').then(m => m.demo())"
export async function demo() {
  const assert = (actual, expected, label) => {
    const a = JSON.stringify(actual)
    const e = JSON.stringify(expected)
    if (a !== e) {
      throw new Error(`pco demo FAILED: ${label} — got ${a}, expected ${e}`)
    }
  }

  // 1. Plans are deterministic + shaped for S12 (4 songs in order,
  //    ≥1 seeded match, ≥1 no-chart).
  const plansA = buildMockPlans()
  const plansB = buildMockPlans()
  assert(plansA, plansB, 'plans deterministic across calls')
  assert(plansA[0].name, 'Sunday 10am', 'plan 1 name')
  assert(plansA[0].songs.length, 4, 'plan 1 has 4 songs')
  assert(plansA[0].songs.map((s) => s.title), ['Way Maker', 'Oceans (Where Feet May Fail)', 'Goodness of God', 'Kingdom'], 'plan 1 song order')
  assert(plansA[1].name, 'Wednesday Rehearsal', 'plan 2 name')

  // 2. S13 gate: pure helper + the REAL listPlans/exportSetlistToPlan async
  //    paths with an injected revoked row — exact message, nothing else.
  assert(connectionGate({ status: 'revoked' }), { ok: false, error: 'integration revoked' }, 'gate blocks revoked')
  assert(connectionGate({ status: 'connected' }), null, 'gate passes connected')
  assert(connectionGate(null), null, 'gate passes never-connected (mock reads plans)')
  const plansRevoked = await listPlans('u1', { status: 'revoked' })
  assert(plansRevoked, { ok: false, error: 'integration revoked' }, 'listPlans revoked gate')
  const plansOk = await listPlans('u1', { status: 'connected' })
  assert(plansOk.ok, true, 'connected listPlans resolves ok')
  assert(plansOk.plans.length, 2, 'connected listPlans returns both plans')

  // 3. Conservative plan→library matching: equality links, near-miss does not.
  const seededLibrary = [
    { id: '20000000-0000-0000-0000-000000000001', title: 'Way Maker' },
    { id: '20000000-0000-0000-0000-000000000002', title: 'Oceans (Where Feet May Fail)' },
  ]
  assert(matchPlanSong({ title: 'Way Maker' }, seededLibrary)?.id, '20000000-0000-0000-0000-000000000001', 'exact match links the seeded song')
  assert(matchPlanSong({ title: 'Kingdom' }, seededLibrary), null, 'no library chart → created missing (no match)')
  assert(matchPlanSong({ title: 'way maker' }, seededLibrary)?.id, '20000000-0000-0000-0000-000000000001', 'case-insensitive match')

  // 4. Export payload: title/key ONLY, no projections/annotations (S17).
  const exportSongs = [
    { title: 'Way Maker', key: 'E major', body: '{title: Way Maker}\n[Verse]', annotations: 'personal notes' },
    { title: 'Oceans (Where Feet May Fail)', key: 'D major', body: '{title: Oceans}\n[Chorus]' },
  ]
  assert(serializeExportSongs(exportSongs), [
    { title: 'Way Maker', key: 'E major' },
    { title: 'Oceans (Where Feet May Fail)', key: 'D major' },
  ], 'serializer keeps only title/key')
  const push = await exportSetlistToPlan('u1', 'pco-sunday-10am', exportSongs, { status: 'connected' })
  assert(push, { ok: true, pushed: 2, planId: 'pco-sunday-10am' }, 'connected export pushes song count')
  const pushRevoked = await exportSetlistToPlan('u1', 'pco-sunday-10am', exportSongs, { status: 'revoked' })
  assert(pushRevoked, { ok: false, error: 'integration revoked' }, 'export revoked gate')

  console.log('pco demo OK')
}