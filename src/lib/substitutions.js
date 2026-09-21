// Substitutions & coverage data layer (Hito 5 #81): thin wrappers over the
// 0023 definer RPC lifecycle, plus the member-side rendering helpers for the
// substitute assignment view. The RPCs are the client contract — these
// wrappers only map errors (setlists.js convention) and normalize shapes.
//
// Rendering notes: chord/sectional transformations stay in transpose.js and
// personal chord substitutions are applied by ChordProRenderer via
// annotations.buildSubstitutionMap — this module computes the TOTAL view
// offset each page feeds into those existing pieces. No new rendering engine.
//
// Offline: the app already has an IDB outbox (offlineQueue.js) drained by
// offlineSync.startOfflineSync (mounted in main.jsx). This module reuses it —
// respondSubstitutionOfflineAware queues when offline; the drain replays on
// reconnect and drops a superseded first-wins accept with a notice.
//
// Lazy supabase import (annotations.js pattern): the module must stay
// node-testable — supabase.js evaluates import.meta.env at module scope.

import { enqueueOp } from './offlineQueue.js'

let supabaseClient = null
async function supabase() {
  if (!supabaseClient) supabaseClient = (await import('./supabase.js')).supabase
  return supabaseClient
}

// Known user-facing errors re-thrown verbatim; anything else maps to a safe
// generic message (setlists.js convention). The first-wins rejection is a
// normal outcome the UI should surface exactly as-is.
const USER_ERRORS = new Set([
  'Not authenticated.',
  'Not allowed.',
  'Service not found.',
  'Assignment not found.',
  'Request not found.',
  'Request is not covered.',
  'Request is already resolved.',
  'Position already covered.',
  'Only the assigned member can mark this assignment unavailable.',
  'Only the service leader can send the request.',
  'Only the current substitute can cancel.',
  'Only the assigned member can reclaim this part.',
  'Only the service leader can overrule.',
  'Only the service leader can list substitution requests.',
  'The chosen substitute is not an active member of this organization.',
])

function handleError(error) {
  if (USER_ERRORS.has(error?.message)) throw error
  throw new Error('Something went wrong. Please try again.')
}

async function withErrorMapping(fn) {
  try {
    return await fn()
  } catch (e) {
    handleError(e)
  }
}

// ══════════════ 1. LIFECYCLE RPC WRAPPERS ══════════════

/** Assigned member marks the assignment unavailable ⇒ open request id. */
export function markUnavailable(assignmentId) {
  return withErrorMapping(async () => {
    const { data, error } = await (await supabase())
      .rpc('mark_unavailable', { p_assignment_id: assignmentId })
    if (error) throw error
    return data
  })
}

/** Leader seeds pending responses + notifies candidates for an open request. */
export function sendSubstitutionRequest(requestId) {
  return withErrorMapping(async () => {
    const { error } = await (await supabase())
      .rpc('send_substitution_request', { p_request_id: requestId })
    if (error) throw error
  })
}

/**
 * Candidate accepts/rejects. Accept is first-wins: returns the substitute's
 * own assignment row id; throws 'Position already covered.' when another
 * candidate already confirmed.
 */
export function respondSubstitution(requestId, accept) {
  return withErrorMapping(async () => {
    const { data, error } = await (await supabase())
      .rpc('respond_substitution', { p_request_id: requestId, p_accept: accept })
    if (error) throw error
    return data
  })
}

/** Current substitute releases the spot ⇒ request reopens for the rest. */
export function cancelSubstitution(requestId) {
  return withErrorMapping(async () => {
    const { error } = await (await supabase())
      .rpc('cancel_substitution', { p_request_id: requestId })
    if (error) throw error
  })
}

/** Original member returns ⇒ substitute row(s) released, request closed. */
export function reclaimAssignment(assignmentId) {
  return withErrorMapping(async () => {
    const { error } = await (await supabase())
      .rpc('reclaim_assignment', { p_assignment_id: assignmentId })
    if (error) throw error
  })
}

/** Leader assigns a substitute directly (decided_by=leader) ⇒ new assignment id. */
export function overruleSubstitution(requestId, substituteId) {
  return withErrorMapping(async () => {
    const { data, error } = await (await supabase())
      .rpc('overrule_substitution', { p_request_id: requestId, p_substitute_id: substituteId })
    if (error) throw error
    return data
  })
}

/** Eligible candidates for an assignment (member or leader only). */
export function substitutionCandidates(assignmentId) {
  return withErrorMapping(async () => {
    const { data, error } = await (await supabase())
      .rpc('substitution_candidates', { p_assignment_id: assignmentId })
    if (error) throw error
    return data || []
  })
}

// ══════════════ 2. READ SURFACE RPC WRAPPERS ══════════════

/** One request + response state (leader / original member / candidate). */
export function getSubstitutionRequest(requestId) {
  return withErrorMapping(async () => {
    const { data, error } = await (await supabase())
      .rpc('get_substitution_request', { p_request_id: requestId })
    if (error) throw error
    return flattenRequest(data)
  })
}

/** All substitution requests of a service with response state (leader-only). */
export function listSubstitutionRequests(serviceId) {
  return withErrorMapping(async () => {
    const { data, error } = await (await supabase())
      .rpc('list_substitution_requests', { p_service_id: serviceId })
    if (error) throw error
    return (data || []).map(flattenRequest)
  })
}

/**
 * The caller's assignment view for a service: own blocks (or pending-candidate
 * target blocks) with their setlist songs, charts and versions; plus the event
 * setlist when event-scoped. Cross-org safe by design — never org repertoire.
 */
export function getSubstitutionContext(serviceId) {
  return withErrorMapping(async () => {
    const { data, error } = await (await supabase())
      .rpc('substitution_context', { p_service_id: serviceId })
    if (error) throw error
    return flattenContext(data)
  })
}

// ══════════════ 3. NORMALIZERS ══════════════

/** Map a get/list substitution request JSON row to the client shape. */
export function flattenRequest(json) {
  if (!json) return null
  return {
    id: json.id,
    assignmentId: json.assignment_id,
    serviceId: json.service_id,
    blockId: json.block_id,
    part: json.part,
    originalMemberId: json.original_member,
    originalName: json.original_name,
    requestedBy: json.requested_by,
    scope: json.scope,
    status: json.status,
    candidates: json.candidates || [],
    responses: json.responses || [],
    coveredBy: json.covered_by || null,
    createdAt: json.created_at,
    resolvedAt: json.resolved_at,
  }
}

/** Map the substitution_context JSON to { service, blocks, event }. */
export function flattenContext(json) {
  if (!json) return null
  return {
    service: json.service || null,
    blocks: json.blocks || [],
    event: json.event || null,
  }
}

// ══════════════ 4. RENDERING HELPERS ══════════════

/**
 * Transposing-instrument offsets (written pitch vs concert pitch): the
 * substitute plays their instrument, so the chart renders shifted from the
 * stored plan. B♭ trumpet +2, F horn +7, E♭ sax +9, everything else concert.
 */
export function instrumentTransposition(instrument) {
  const i = String(instrument || '').toLowerCase()
  if (/(french\s*horn)|(^|\s)horn(\s|$)/.test(i)) return 7
  if (/(alto|baritone)/.test(i) && /sax/.test(i)) return 9
  if (/(trumpet|cornet|clarinet|flugelhorn|tenor\s*sax|soprano\s*sax)/.test(i)) return 2
  return 0
}

/** Written-pitch label for the assignment header badge. */
export function instrumentPitchLabel(instrument) {
  const s = instrumentTransposition(instrument)
  return s === 7 ? 'F' : s === 9 ? 'E♭' : s === 2 ? 'B♭' : 'Concert'
}

/**
 * Total view offset for a song = personal transpose + per-song override +
 * instrument offset. This is the number the page feeds transposeParsed and
 * the renderer; the stored plan/chart never changes.
 */
export function renderSemitones(prefs, songId, instrument) {
  const p = prefs || {}
  return Number(p.transpose ?? 0) + Number(p.overrides?.[songId] ?? 0) + instrumentTransposition(instrument)
}

// ══════════════ 5. OFFLINE-AWARE ACCEPT (BDD scenario 17) ══════════════

/**
 * Accept a substitution with offline support. Online: direct first-wins RPC.
 * Offline: queue the accept in the outbox — the existing drain
 * (offlineSync.startOfflineSync, mounted in main.jsx) replays it on
 * reconnect and drops it with a notice when the position was already covered
 * before the sync (first-wins supersedes the queued intent).
 */
export async function respondSubstitutionOfflineAware(userId, requestId) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await enqueueOp(userId, { name: 'respondSubstitution', args: [requestId, true] })
    return { queued: true }
  }
  const substituteAssignmentId = await respondSubstitution(requestId, true)
  return { queued: false, substituteAssignmentId }
}

// Self-check: node -e "import('./src/lib/substitutions.js').then(m => m.demo())"
export function demo() {
  const assert = (actual, expected, label) => {
    if (actual !== expected) {
      throw new Error(`substitutions demo FAILED: ${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
    }
  }

  assert(instrumentTransposition('trumpet'), 2, 'B♭ trumpet +2')
  assert(instrumentTransposition('Trumpet'), 2, 'case-insensitive')
  assert(instrumentTransposition('French Horn'), 7, 'F horn +7')
  assert(instrumentTransposition('horn'), 7, 'generic horn is F')
  assert(instrumentTransposition('Alto Sax'), 9, 'E♭ alto sax +9')
  assert(instrumentTransposition('baritone sax'), 9, 'E♭ baritone sax +9')
  assert(instrumentTransposition('tenor sax'), 2, 'B♭ tenor sax +2')
  assert(instrumentTransposition('bass'), 0, 'concert instrument 0')
  assert(instrumentTransposition(''), 0, 'undefined instrument 0')
  assert(instrumentPitchLabel('trumpet'), 'B♭', 'trumpet label')
  assert(instrumentPitchLabel('bass'), 'Concert', 'concert label')

  assert(renderSemitones({ transpose: 2, overrides: {} }, 's1', 'trumpet'), 4, 'global + instrument')
  assert(renderSemitones({ transpose: 2, overrides: { s1: -3 } }, 's1', 'trumpet'), 1, 'override beats global per song')
  assert(renderSemitones({ transpose: 0, overrides: { s2: 1 } }, 's2', 'bass'), 1, 'override alone')
  assert(renderSemitones(null, 's1', 'bass'), 0, 'no prefs → 0')

  const raw = {
    id: 'r1', assignment_id: 'a1', service_id: 'sv1', block_id: 'b1',
    part: 'bass', original_member: 'u1', original_name: 'Lucia',
    requested_by: 'u1', scope: 'org', status: 'covered',
    candidates: ['u2', 'u3'], responses: [{ user_id: 'u2', status: 'accepted' }],
    covered_by: { assignment_id: 'a2', user_id: 'u2', name: 'Pedro' },
    created_at: 'now', resolved_at: 'now',
  }
  const flat = flattenRequest(raw)
  assert(flat.id, 'r1', 'request id')
  assert(flat.originalName, 'Lucia', 'original name')
  assert(flat.coveredBy.user_id, 'u2', 'covered_by nested')
  assert(flattenRequest(null), null, 'null request → null')

  assert(flattenContext({ service: { id: 'sv1', name: 'Sunday' }, blocks: [], event: null }).event, null, 'no event → null')
  assert(flattenContext(null), null, 'null context → null')

  console.log('substitutions demo OK: 17 asserts (instrument offsets, render offset, normalizers)')
}