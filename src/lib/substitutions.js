// @ts-check
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

/**
 * A candidate's response as the RPC builds it inside `responses`.
 * @typedef {object} SubstitutionResponse
 * @property {string} user_id
 * @property {string | null} name
 * @property {'pending' | 'accepted' | 'declined'} status
 * @property {string | null} responded_at
 */

/**
 * The covering substitute assignment, or null while the request is not covered.
 * @typedef {object} SubstitutionCover
 * @property {string} assignment_id
 * @property {string} user_id
 * @property {string | null} name
 */

/**
 * The `get_substitution_request` / `list_substitution_requests` jsonb row: the
 * snake_case RPC contract, exactly as 0023_substitutions.sql assembles it —
 * every key is always present, and only the values go null.
 * @typedef {object} RawSubstitutionRequestJson
 * @property {string} id
 * @property {string} assignment_id
 * @property {string} service_id
 * @property {string} block_id
 * @property {string} part
 * @property {string} original_member
 * @property {string | null} original_name
 * @property {string} requested_by
 * @property {'org' | 'event'} scope
 * @property {'open' | 'covered' | 'closed'} status
 * @property {string[]} candidates
 * @property {SubstitutionResponse[]} responses
 * @property {SubstitutionCover | null} covered_by
 * @property {string} created_at
 * @property {string | null} resolved_at
 */

/**
 * One request + response state, normalized to the client (camelCase) shape.
 * @typedef {object} SubstitutionRequest
 * @property {string} id
 * @property {string} assignmentId
 * @property {string} serviceId
 * @property {string} blockId
 * @property {string} part
 * @property {string} originalMemberId
 * @property {string | null} originalName
 * @property {string} requestedBy
 * @property {'org' | 'event'} scope
 * @property {'open' | 'covered' | 'closed'} status
 * @property {string[]} candidates
 * @property {SubstitutionResponse[]} responses
 * @property {SubstitutionCover | null} coveredBy
 * @property {string} createdAt
 * @property {string | null} resolvedAt
 */

/**
 * A chart as the context RPC carries it. `version_name` / `base_key` come from
 * the song_versions join on the block's own setlist; the cross-org event
 * setlist payload omits them.
 * @typedef {object} SubstitutionContextSong
 * @property {string} song_id
 * @property {string} title
 * @property {string | null} [artist]
 * @property {string | null} [version_id]
 * @property {string | null} [version_name]
 * @property {string | null} [base_key]
 * @property {string} chart
 */

/**
 * One assignment block of the caller's own (or pending-candidate) view, with
 * the member-side coverage state and the block's setlist songs.
 * @typedef {object} SubstitutionContextBlock
 * @property {string} id
 * @property {string} name
 * @property {string} part
 * @property {string} role
 * @property {string | null} [assignment_id]
 * @property {string | null} [request_id]
 * @property {string | null} [request_status]
 * @property {string | null} [covered_name]
 * @property {SubstitutionContextSong[]} songs
 */

/**
 * The cross-org event context — present only for scope='event' requests.
 * @typedef {object} SubstitutionContextEvent
 * @property {string} event_id
 * @property {string} event_name
 * @property {SubstitutionContextSong[]} songs
 */

/**
 * @typedef {object} SubstitutionContextService
 * @property {string} id
 * @property {string} name
 */

/**
 * The caller's assignment view for one service.
 * @typedef {object} SubstitutionContext
 * @property {SubstitutionContextService | null} service
 * @property {SubstitutionContextBlock[]} blocks
 * @property {SubstitutionContextEvent | null} event
 * @property {string} instrument
 */

/**
 * The `substitution_context` jsonb row. It is already client-shaped (only the
 * nested blocks/songs keep their snake_case), so flattening is a pure
 * defaulting pass. As in the request row, every key is always present.
 * @typedef {object} RawSubstitutionContextJson
 * @property {SubstitutionContextService | null} service
 * @property {SubstitutionContextBlock[]} blocks
 * @property {SubstitutionContextEvent | null} event
 * @property {string} instrument
 */

/**
 * The personal rendering preferences this module reads: the account-wide
 * `transpose` plus the per-song `overrides` map (which beats the global).
 * @typedef {object} RenderPreferences
 * @property {number | null} [transpose]
 * @property {Record<string, number | null> | null} [overrides]
 */

/**
 * The offline-aware accept verdict: `queued` when the intent went to the
 * outbox, otherwise the substitute's own assignment id.
 * @typedef {object} OfflineAwareAccept
 * @property {boolean} queued
 * @property {string | null} [substituteAssignmentId]
 */

/** @type {typeof import('./supabase.js').supabase | null} */
let supabaseClient = null
/**
 * @returns {Promise<import('@supabase/supabase-js').SupabaseClient>}
 */
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

/**
 * Re-throws the known user-facing errors verbatim and maps anything else to
 * the generic message. Never returns.
 * @param {Error} error
 * @returns {never}
 */
function handleError(error) {
  if (USER_ERRORS.has(error?.message)) throw error
  throw new Error('Something went wrong. Please try again.')
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withErrorMapping(fn) {
  try {
    return await fn()
  } catch (e) {
    handleError(/** @type {Error} */ (e))
  }
}

// ══════════════ 1. LIFECYCLE RPC WRAPPERS ══════════════

/**
 * Assigned member marks the assignment unavailable ⇒ open request id.
 * @param {string} assignmentId
 * @returns {Promise<string | null>} the open substitution_requests id
 */
export function markUnavailable(assignmentId) {
  return withErrorMapping(async () => {
    const { data, error } = await (await supabase())
      .rpc('mark_unavailable', { p_assignment_id: assignmentId })
    if (error) throw error
    return data
  })
}

/**
 * Leader seeds pending responses + notifies candidates for an open request.
 * @param {string} requestId
 * @returns {Promise<void>}
 */
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
 * @param {string} requestId
 * @param {boolean} accept
 * @returns {Promise<string | null>} the substitute's service_assignments id
 */
export function respondSubstitution(requestId, accept) {
  return withErrorMapping(async () => {
    const { data, error } = await (await supabase())
      .rpc('respond_substitution', { p_request_id: requestId, p_accept: accept })
    if (error) throw error
    return data
  })
}

/**
 * Current substitute releases the spot ⇒ request reopens for the rest.
 * @param {string} requestId
 * @returns {Promise<void>}
 */
export function cancelSubstitution(requestId) {
  return withErrorMapping(async () => {
    const { error } = await (await supabase())
      .rpc('cancel_substitution', { p_request_id: requestId })
    if (error) throw error
  })
}

/**
 * Original member returns ⇒ substitute row(s) released, request closed.
 * @param {string} assignmentId
 * @returns {Promise<void>}
 */
export function reclaimAssignment(assignmentId) {
  return withErrorMapping(async () => {
    const { error } = await (await supabase())
      .rpc('reclaim_assignment', { p_assignment_id: assignmentId })
    if (error) throw error
  })
}

/**
 * Leader assigns a substitute directly (decided_by=leader) ⇒ new assignment id.
 * @param {string} requestId
 * @param {string} substituteId
 * @returns {Promise<string | null>} the new substitute assignment id
 */
export function overruleSubstitution(requestId, substituteId) {
  return withErrorMapping(async () => {
    const { data, error } = await (await supabase())
      .rpc('overrule_substitution', { p_request_id: requestId, p_substitute_id: substituteId })
    if (error) throw error
    return data
  })
}

/**
 * Eligible candidates for an assignment (member or leader only).
 * @param {string} assignmentId
 * @returns {Promise<string[]>} eligible user ids
 */
export function substitutionCandidates(assignmentId) {
  return withErrorMapping(async () => {
    const { data, error } = await (await supabase())
      .rpc('substitution_candidates', { p_assignment_id: assignmentId })
    if (error) throw error
    return data || []
  })
}

// ══════════════ 2. READ SURFACE RPC WRAPPERS ══════════════

/**
 * One request + response state (leader / original member / candidate).
 * @param {string} requestId
 * @returns {Promise<SubstitutionRequest | null>}
 */
export function getSubstitutionRequest(requestId) {
  return withErrorMapping(async () => {
    const { data, error } = await (await supabase())
      .rpc('get_substitution_request', { p_request_id: requestId })
    if (error) throw error
    return flattenRequest(data)
  })
}

/**
 * All substitution requests of a service with response state (leader-only).
 * @param {string} serviceId
 * @returns {Promise<(SubstitutionRequest | null)[]>}
 */
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
 * @param {string} serviceId
 * @returns {Promise<SubstitutionContext | null>}
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

/**
 * Map a get/list substitution request JSON row to the client shape.
 * @param {RawSubstitutionRequestJson | null | undefined} json
 * @returns {SubstitutionRequest | null}
 */
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

/**
 * Map the substitution_context JSON to { service, blocks, event, instrument }.
 * @param {RawSubstitutionContextJson | null | undefined} json
 * @returns {SubstitutionContext | null}
 */
export function flattenContext(json) {
  if (!json) return null
  return {
    service: json.service || null,
    blocks: json.blocks || [],
    event: json.event || null,
    instrument: json.instrument || '',
  }
}

// ══════════════ 4. RENDERING HELPERS ══════════════

/**
 * Transposing-instrument offsets (written pitch vs concert pitch): the
 * substitute plays their instrument, so the chart renders shifted from the
 * stored plan. B♭ trumpet +2, F horn +7, E♭ sax +9, everything else concert.
 * @param {string | null | undefined} instrument
 * @returns {number} semitones to add to the written plan
 */
export function instrumentTransposition(instrument) {
  const i = String(instrument || '').toLowerCase()
  if (/(french\s*horn)|(^|\s)horn(\s|$)/.test(i)) return 7
  if (/(alto|baritone)/.test(i) && /sax/.test(i)) return 9
  if (/(trumpet|cornet|clarinet|flugelhorn|tenor\s*sax|soprano\s*sax)/.test(i)) return 2
  return 0
}

/**
 * Written-pitch label for the assignment header badge.
 * @param {string | null | undefined} instrument
 * @returns {string}
 */
export function instrumentPitchLabel(instrument) {
  const s = instrumentTransposition(instrument)
  return s === 7 ? 'F' : s === 9 ? 'E♭' : s === 2 ? 'B♭' : 'Concert'
}

/**
 * Total view offset for a song = personal transpose + per-song override +
 * instrument offset. This is the number the page feeds transposeParsed and
 * the renderer; the stored plan/chart never changes.
 * @param {RenderPreferences | null | undefined} prefs
 * @param {string} songId
 * @param {string | null | undefined} instrument
 * @returns {number} total semitone offset for the view
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
 * @param {string} userId
 * @param {string} requestId
 * @returns {Promise<OfflineAwareAccept>}
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
  /**
   * @param {unknown} actual
   * @param {unknown} expected
   * @param {string} label
   */
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

  // The RPC always builds every key; this fixture keeps only what the asserts
  // below read, hence the cast.
  const raw = /** @type {RawSubstitutionRequestJson} */ ({
    id: 'r1', assignment_id: 'a1', service_id: 'sv1', block_id: 'b1',
    part: 'bass', original_member: 'u1', original_name: 'Lucia',
    requested_by: 'u1', scope: 'org', status: 'covered',
    candidates: ['u2', 'u3'], responses: [{ user_id: 'u2', status: 'accepted' }],
    covered_by: { assignment_id: 'a2', user_id: 'u2', name: 'Pedro' },
    created_at: 'now', resolved_at: 'now',
  })
  const flat = /** @type {SubstitutionRequest} */ (flattenRequest(raw))
  assert(flat.id, 'r1', 'request id')
  assert(flat.originalName, 'Lucia', 'original name')
  assert(/** @type {SubstitutionCover} */ (flat.coveredBy).user_id, 'u2', 'covered_by nested')
  assert(flattenRequest(null), null, 'null request → null')

  assert(/** @type {SubstitutionContext} */ (flattenContext({ service: { id: 'sv1', name: 'Sunday' }, blocks: [], event: null, instrument: 'trumpet' })).instrument, 'trumpet', 'context instrument')
  assert(/** @type {SubstitutionContext} */ (flattenContext({ service: { id: 'sv1', name: 'Sunday' }, blocks: [], event: null, instrument: 'trumpet' })).event, null, 'no event → null')
  assert(flattenContext(null), null, 'null context → null')

  console.log('substitutions demo OK: 18 asserts (instrument offsets, render offset, normalizers)')
}