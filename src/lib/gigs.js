// Supabase data layer for gigs — CRUD + lifecycle (PR#1a-lifecycle, hito-2-remainder).
// Offline read-through/enqueue machinery is deferred: it lands with task 2a.6
// (offlineSync.js WRITE_OPS owns drain-side membership anyway).
//
// RLS (0004) scopes reads by owner (direct for gigs/venues, via the gig
// for performances/items). Org (D2a) is deny-by-default → createGig uses
// the PUBLIC session_org_ids() bridge (0005); real org enforcement Hito 4.

// ponytail: lazy import — supabase.js reads import.meta.env at eval
// (Vite-only) and would crash the node demo() test. Runtime unchanged.
let supabaseClient = null
async function getSupabase() {
  if (!supabaseClient) supabaseClient = (await import('./supabase.js')).supabase
  return supabaseClient
}

// ponytail: user-facing errors re-thrown as-is; the rest map to a generic one.
const USER_ERRORS = new Set([
  'Gig not found.',
  'Gig name is required.',
  'Scheduled date and time are required.',
  'Venue name is required.',
  'Cannot edit a completed gig.',
  'Invalid gig status transition.',
  'Cannot complete a gig without songs.',
  'Invalid performance item.',
  'Organization could not be resolved.',
])

function handleError(error) {
  if (USER_ERRORS.has(error?.message)) throw error
  throw new Error('Something went wrong. Please try again.')
}

async function withErrorMapping(fn) {
  try { return await fn() } catch (e) { handleError(e) }
}

/** Flatten a raw Supabase venue row into the suggestion shape. */
function flattenVenue(row) {
  return {
    id: row.id,
    userId: row.owner_id,
    name: row.name,
    location: row.location || '',
    type: row.type || '',
  }
}

/** Flatten one performance row; items ordered by position. Absent embed → []. */
function flattenPerformance(row) {
  const items = (row.performance_items || [])
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((i) => ({
      id: i.id,
      songId: i.song_id,
      versionId: i.version_id,
      state: i.state,
      position: i.position ?? null,
    }))
  return {
    id: row.id,
    gigId: row.gig_id,
    venueId: row.venue_id,
    performedAt: row.performed_at,
    items,
  }
}

/** Flatten a raw Supabase gig row (with embedded performances) into app shape. */
function flattenGig(row) {
  const performances = (row.performances || [])
    .sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at))
  return {
    id: row.id,
    orgId: row.org_id,
    branchId: row.branch_id,
    userId: row.owner_id,
    name: row.name,
    venueId: row.venue_id,
    scheduledAt: row.scheduled_at,
    setlistId: row.setlist_id,
    status: row.status,
    sharedToBranch: row.shared_to_branch,
    createdAt: row.created_at,
    performance: performances.length > 0 ? flattenPerformance(performances[0]) : null,
  }
}

const DETAIL_SELECT = '*, performances(*, performance_items(*))'
const LIST_SELECT = '*, performances(id, performed_at, venue_id)'

async function fetchGigById(userId, id) {
  const supabase = await getSupabase()
  const { data, error } = await supabase
    .from('gigs')
    .select(DETAIL_SELECT)
    .eq('id', id)
    .eq('owner_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Gig not found.')
  return flattenGig(data)
}

/**
 * Lifecycle transitions (spec): planned → confirmed → completed,
 * planned/confirmed → cancelled, cancelled → planned (reopen).
 * completed is terminal.
 */
export const GIG_TRANSITIONS = {
  planned: ['confirmed', 'cancelled'],
  confirmed: ['cancelled', 'completed'],
  cancelled: ['planned'],
  completed: [],
}

export function validTransition(currentStatus, nextStatus) {
  return GIG_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false
}

/**
 * Setlist/date/venue/name stay editable until completion (spec scenarios).
 * Status-only patches never count as edits.
 */
export function canEditGig(currentStatus, patch) {
  if (currentStatus !== 'completed') return true
  const EDITABLE_FIELDS = ['name', 'scheduledAt', 'venueId', 'setlistId', 'branchId', 'sharedToBranch']
  return !EDITABLE_FIELDS.some((f) => patch[f] !== undefined)
}

/**
 * Normalize a completion payload: non-empty items, each with a songId and a
 * valid play_state. Returns rows ready for performance_items insert.
 */
export function validateCompletion(payload) {
  const items = payload?.items
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Cannot complete a gig without songs.')
  }
  const PLAY_STATES = new Set(['played', 'skipped', 'off_setlist'])
  return items.map((item) => {
    if (!item?.songId || !PLAY_STATES.has(item.state)) {
      throw new Error('Invalid performance item.')
    }
    return {
      song_id: item.songId,
      version_id: item.versionId ?? null,
      state: item.state,
      position: item.position ?? null,
    }
  })
}

/**
 * Case-insensitive venue lookup for the suggestion/reuse scenario:
 * returns the saved venue if a name already matches, else undefined.
 */
export function findVenueByName(venues, name) {
  const needle = String(name ?? '').trim().toLowerCase()
  if (!needle) return undefined
  return venues.find((v) => v.name.toLowerCase() === needle)
}

export function listGigs(userId) {
  return withErrorMapping(async () => {
    const supabase = await getSupabase()
    const { data, error } = await supabase
      .from('gigs')
      .select(LIST_SELECT)
      .eq('owner_id', userId)
      .order('scheduled_at', { ascending: true })

    if (error) throw error
    return (data || []).map(flattenGig)
  })
}

export function getGig(userId, id) {
  return withErrorMapping(() => fetchGigById(userId, id))
}

export async function createGig(userId, { name, scheduledAt, venueId, setlistId, branchId, sharedToBranch }) {
  return withErrorMapping(async () => {
    const trimmed = name?.trim()
    if (!trimmed) throw new Error('Gig name is required.')
    const iso = scheduledAt instanceof Date ? scheduledAt.toISOString() : scheduledAt
    if (!iso) throw new Error('Scheduled date and time are required.')

    const supabase = await getSupabase()
    const orgId = await resolveOrgId(supabase)
    const { data, error } = await supabase
      .from('gigs')
      .insert({
        org_id: orgId,
        branch_id: branchId ?? null,
        owner_id: userId,
        name: trimmed,
        venue_id: venueId ?? null,
        scheduled_at: iso,
        setlist_id: setlistId ?? null,
        status: 'planned',
        shared_to_branch: !!sharedToBranch,
      })
      .select(DETAIL_SELECT)
      .single()
    if (error) throw error
    return flattenGig(data)
  })
}

/** Caller's first active org id via the public session_org_ids() bridge (0005). */
async function resolveOrgId(supabase) {
  const { data, error } = await supabase.rpc('session_org_ids')
  if (error) throw error
  const orgIds = Array.isArray(data) ? data : []
  if (orgIds.length === 0) throw new Error('Organization could not be resolved.')
  return orgIds[0]
}

/**
 * Edit name/schedule/venue/setlist/branch/sharing/status. Input guards run
 * before any network call (demo-safe). Completed gigs lock content fields;
 * status transitions are validated; status:'completed' is rejected here —
 * completion is the composite completeGig chain (a completed gig MUST have
 * exactly one performance record, spec).
 */
export async function updateGig(userId, id, patch = {}) {
  return withErrorMapping(async () => {
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim()
      if (!trimmed) throw new Error('Gig name is required.')
      patch = { ...patch, name: trimmed }
    }
    if (patch.scheduledAt !== undefined && !patch.scheduledAt) {
      throw new Error('Scheduled date and time are required.')
    }
    if (patch.status === 'completed') throw new Error('Invalid gig status transition.')

    const update = {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.scheduledAt !== undefined
        ? { scheduled_at: patch.scheduledAt instanceof Date ? patch.scheduledAt.toISOString() : patch.scheduledAt }
        : {}),
      ...(patch.venueId !== undefined ? { venue_id: patch.venueId } : {}),
      ...(patch.setlistId !== undefined ? { setlist_id: patch.setlistId } : {}),
      ...(patch.branchId !== undefined ? { branch_id: patch.branchId } : {}),
      ...(patch.sharedToBranch !== undefined ? { shared_to_branch: !!patch.sharedToBranch } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    }

    const current = await fetchGigById(userId, id)
    if (!canEditGig(current.status, patch)) throw new Error('Cannot edit a completed gig.')
    if (patch.status !== undefined && patch.status !== current.status
        && !validTransition(current.status, patch.status)) {
      throw new Error('Invalid gig status transition.')
    }

    const supabase = await getSupabase()
    const { error } = await supabase
      .from('gigs')
      .update(update)
      .eq('id', id)
      .eq('owner_id', userId)
    if (error) throw error
    return fetchGigById(userId, id)
  })
}

export function confirmGig(userId, id) {
  return updateGig(userId, id, { status: 'confirmed' })
}

export function cancelGig(userId, id) {
  // Cancel never writes a performance record nor played tags (spec).
  return updateGig(userId, id, { status: 'cancelled' })
}

export function reopenGig(userId, id) {
  return updateGig(userId, id, { status: 'planned' })
}

/**
 * Complete a gig: writes exactly ONE performances row plus its
 * performance_items (played|skipped|off_setlist), then marks the gig
 * completed. Idempotent: if a performance already exists for the gig, the
 * status is re-set and the existing record is returned — never a duplicate
 * (D6 replay safety; "exactly one" is app-enforced, unconstrained in 0001).
 */
export async function completeGig(userId, gigId, { performedAt, items }) {
  return withErrorMapping(async () => {
    const perfIso = performedAt instanceof Date ? performedAt.toISOString() : performedAt
    if (!perfIso) throw new Error('Invalid performance item.')
    const rows = validateCompletion({ performedAt: perfIso, items })

    const current = await fetchGigById(userId, gigId)
    const supabase = await getSupabase()
    const { data: existing } = await supabase
      .from('performances')
      .select('id')
      .eq('gig_id', gigId)
      .maybeSingle()
    if (existing) {
      // Replay/duplicate guard: status may lag, record never duplicates.
      if (current.status !== 'completed') {
        await supabase
          .from('gigs')
          .update({ status: 'completed' })
          .eq('id', gigId)
          .eq('owner_id', userId)
      }
      return fetchGigById(userId, gigId)
    }

    const { data: perfRow, error: perfErr } = await supabase
      .from('performances')
      .insert({
        gig_id: gigId,
        venue_id: current.venueId,
        performed_at: perfIso,
      })
      .select('id')
      .single()
    if (perfErr) throw perfErr

    const itemRows = rows.map((r) => ({ performance_id: perfRow.id, ...r }))
    const { error: itemsErr } = await supabase
      .from('performance_items')
      .insert(itemRows)
    if (itemsErr) throw itemsErr

    const { error: statusErr } = await supabase
      .from('gigs')
      .update({ status: 'completed' })
      .eq('id', gigId)
      .eq('owner_id', userId)
    if (statusErr) throw statusErr

    return fetchGigById(userId, gigId)
  })
}

export async function deleteGig(userId, id) {
  return withErrorMapping(async () => {
    await fetchGigById(userId, id)
    const supabase = await getSupabase()
    const { error } = await supabase
      .from('gigs')
      .delete()
      .eq('id', id)
      .eq('owner_id', userId)
    if (error) throw error
  })
}

// ── Venues (suggestion shape + reuse/dedupe) ──────────────────────────────

export function listVenues(userId) {
  return withErrorMapping(async () => {
    const supabase = await getSupabase()
    const { data, error } = await supabase
      .from('venues')
      .select('*')
      .eq('owner_id', userId)
      .order('name', { ascending: true })

    if (error) throw error
    return (data || []).map(flattenVenue)
  })
}

/**
 * Create a venue, reusing an existing one with the same name (case-
 * insensitive) instead of duplicating — the suggestion/reuse scenario.
 */
export async function createVenue(userId, { name, location, type }) {
  return withErrorMapping(async () => {
    const trimmed = name?.trim()
    if (!trimmed) throw new Error('Venue name is required.')

    const supabase = await getSupabase()
    const { data: existing, error: findErr } = await supabase
      .from('venues')
      .select('*')
      .ilike('name', trimmed)
      .eq('owner_id', userId)
      .limit(1)
      .maybeSingle()
    if (findErr) throw findErr
    if (existing) return flattenVenue(existing)

    const { data, error } = await supabase
      .from('venues')
      .insert({
        owner_id: userId,
        name: trimmed,
        location: location ?? null,
        type: type ?? null,
      })
      .select()
      .single()
    if (error) throw error
    return flattenVenue(data)
  })
}

export async function demo() {
  const assertEq = (actual, expected, label) => {
    if (actual !== expected) {
      throw new Error(`gigs demo failed: ${label} expected ${expected}, got ${actual}`)
    }
  }

  // Network-free asserts: flatten shapes + CRUD guards
  const raw = {
    id: 'g1', org_id: 'o1', branch_id: 'b1', owner_id: 'u1', name: 'Friday Gig',
    venue_id: 'v1', scheduled_at: '2026-09-18T21:00:00.000Z', setlist_id: 's1',
    status: 'completed', shared_to_branch: false, created_at: '2026-09-01T00:00:00.000Z',
    performances: [{
      id: 'p1', gig_id: 'g1', venue_id: 'v1', performed_at: '2026-09-14T22:30:00.000Z',
      performance_items: [
        { id: 'i2', performance_id: 'p1', song_id: 'song2', version_id: null, state: 'skipped', position: 2 },
        { id: 'i1', performance_id: 'p1', song_id: 'song1', version_id: null, state: 'played', position: 1 },
      ],
    }],
  }
  const gig = flattenGig(raw)
  assertEq(gig.performance.items[0].songId, 'song1', 'items sorted by position')
  assertEq(gig.performance.items[1].state, 'skipped', 'skipped recorded separately')
  assertEq(gig.userId, 'u1', 'owner mapped to userId')
  assertEq(flattenGig({ ...raw, performances: [] }).performance, null, 'no performance → null')
  assertEq(flattenVenue(raw).name, 'Friday Gig', 'flattenVenue passthrough')

  // Lifecycle: edit locked after completion; transitions per spec
  assertEq(canEditGig('planned', { setlistId: 's2' }), true, 'planned gig editable')
  assertEq(canEditGig('confirmed', { venueId: 'v2' }), true, 'confirmed still editable')
  assertEq(canEditGig('completed', { setlistId: 's2' }), false, 'completed gig locked')
  assertEq(canEditGig('completed', { status: 'confirmed' }), true, 'status-only patch allowed')
  assertEq(validTransition('planned', 'confirmed'), true, 'planned → confirmed')
  assertEq(validTransition('confirmed', 'cancelled'), true, 'confirmed → cancelled')
  assertEq(validTransition('cancelled', 'completed'), false, 'cancelled cannot complete directly')
  assertEq(validTransition('cancelled', 'planned'), true, 'cancelled → planned (reopen)')
  assertEq(validTransition('planned', 'completed'), false, 'completion goes through completeGig only')

  // Completion normalization + guards
  const rows = validateCompletion({
    performedAt: '2026-09-14T22:30:00.000Z',
    items: [
      { songId: 'song3', state: 'off_setlist' },
      { songId: 'song1', state: 'played', position: 1 },
    ],
  })
  assertEq(rows.length, 2, 'completion items normalized')
  assertEq(rows[0].state, 'off_setlist', 'encore recorded outside the setlist')
  assertEq(rows[1].position, 1, 'explicit position kept')
  let threw = ''
  try { validateCompletion({ items: [] }) } catch (e) { threw = e.message }
  assertEq(threw, 'Cannot complete a gig without songs.', 'empty completion rejected')
  threw = ''
  try { validateCompletion({ items: [{ songId: 'song1', state: 'sang' }] }) } catch (e) { threw = e.message }
  assertEq(threw, 'Invalid performance item.', 'bad play_state rejected')

  // Venue suggestion/reuse: case-insensitive match only
  const venues = [
    { id: 'v1', userId: 'u1', name: 'Café La Luna', location: 'Calle Luna 3, Madrid', type: 'bar' },
  ]
  assertEq(findVenueByName(venues, 'café la luna').id, 'v1', 'case-insensitive reuse')
  assertEq(findVenueByName(venues, 'El Retiro'), undefined, 'unknown venue not suggested')

  // Input guards fire before any network call (committed CRUD asserts)
  threw = ''
  try { await createGig('u1', { scheduledAt: '2026-09-18T21:00:00.000Z' }) } catch (e) { threw = e.message }
  assertEq(threw, 'Gig name is required.', 'createGig rejects empty name')
  threw = ''
  try { await createGig('u1', { name: ' No Title ' }) } catch (e) { threw = e.message }
  assertEq(threw, 'Scheduled date and time are required.', 'createGig rejects missing schedule')
  threw = ''
  try { await createVenue('u1', {}) } catch (e) { threw = e.message }
  assertEq(threw, 'Venue name is required.', 'createVenue rejects empty name')
  threw = ''
  try { await updateGig('u1', 'g1', { name: '  ' }) } catch (e) { threw = e.message }
  assertEq(threw, 'Gig name is required.', 'updateGig rejects blank name')
  threw = ''
  try { await updateGig('u1', 'g1', { status: 'completed' }) } catch (e) { threw = e.message }
  assertEq(threw, 'Invalid gig status transition.', 'updateGig rejects direct completion')

  console.log('gigs demo OK: 26 asserts (flatten, lifecycle, completion, venue, guards)')
}