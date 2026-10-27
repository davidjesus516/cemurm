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

import { enqueueOp } from '../../offline/queue.js'

/**
 * Local mirror of src/offline/queue.js's enqueueOp. Deliberately NOT imported
 * as a type: queue.js is untyped on this branch (it is annotated in the
 * jsdoc-libs offline slice), so an imported signature would silently degrade
 * to `any` and the call below would be checked against nothing — a fake green
 * that looks annotated while annotating nothing. Same reason enrichments.js
 * (S07c) mirrors spotifyKeyToLabel instead of importing it. What queue.js
 * actually does:
 * - `userId` is only interpolated into the IDB key `pending:${userId}`
 *   (queue.js:40-42), so a string is the whole contract.
 * - `op` is spread into the stored record `{ seq, ...op, queuedAt }`
 *   (queue.js:70-73), so structurally it is an open object. What every caller
 *   actually OWES is the drainer's contract: it looks the replay function up by
 *   `op.name` and spreads `op.args` into it (drainer.js:153,171), so `{ name,
 *   args }` is the part worth checking — a typo in `name` silently drops the
 *   op at drain time instead of failing here.
 * - It resolves `Promise<void>`: an absent IndexedDB returns early
 *   (queue.js:61-62) and write failures are swallowed (queue.js:79-81), so the
 *   caller learns nothing from the result.
 * @typedef {(userId: string, op: { name: string, args: unknown[] }) => Promise<void>} EnqueueOp
 */

/**
 * substitution_requests.status — the 0001:361 inline vocabulary, written by the
 * 0023 lifecycle at :290 and :503 ('covered'), :366 ('open', cancel reopens)
 * and :434 ('closed', reclaim).
 * @typedef {'open' | 'covered' | 'closed'} SubstitutionRequestStatus
 */

/**
 * substitution_requests.scope — the 0001:359 inline vocabulary: 'org' for
 * ordinary plans, 'event' once the block's setlist belongs to an event and
 * cross-org candidates are eligible (0023:129-135).
 * @typedef {'org' | 'event'} SubstitutionScope
 */

/**
 * substitution_responses.status — the 0023:34 inline vocabulary, seeded
 * 'pending' by send_substitution_request (0023:193-195), then 'declined'
 * (0023:250) or 'accepted' (0023:294) by respond_substitution.
 * @typedef {'pending' | 'accepted' | 'declined'} ResponseStatus
 */

/**
 * One candidate's response as both read RPCs build it inside `responses`
 * (0023:559-563 single, 0023:625-630 list). user_id/status come from the
 * substitution_responses row (0023:33-34, both NOT NULL); responded_at is that
 * column's own NULLABLE timestamptz (0023:35); name is
 * private.display_name_for() over the NULLABLE profiles.display_name
 * (0006:31).
 * @typedef {object} SubstitutionResponse
 * @property {string} user_id
 * @property {string | null} name
 * @property {ResponseStatus} status
 * @property {string | null} responded_at
 */

/**
 * The confirmed substitute covering the part, assembled from
 * service_assignments.id / user_id plus a display name, and only built once the
 * request is covered (0023:570-579). Both columns are NOT NULL uuids
 * (0001:343, 0001:346).
 * @typedef {object} SubstitutionCover
 * @property {string} assignment_id
 * @property {string} user_id
 * @property {string | null} name
 */

/**
 * The snake_case RPC row flattenRequest normalizes — the jsonb_build_object
 * argument lists at 0023:582-597 (get_substitution_request) and 0023:615-633
 * (list_substitution_requests). The two RPCs do NOT emit the same key set, so
 * three keys are optional and the asymmetry is load-bearing, not defensive
 * padding:
 * - `service_id` (0023:585) and `requested_by` (0023:590) are single-request
 *   only; the list RPC projects neither, so a list row leaves them undefined.
 * - `covered_by` (0023:595) is single-request only as well, and SQL NULL until
 *   the request is covered.
 * Column provenance: id / requested_by / candidates / scope / status /
 * created_at / resolved_at are substitution_requests (0001:356-363; candidates
 * is a NOT NULL uuid[] at 0001:360, resolved_at is the NULLABLE timestamptz at
 * 0001:363); assignment_id / block_id / part / original_member are
 * service_assignments (0001:357, 0001:345-347 — block_id is a NULLABLE
 * reference) and service_id is that row's NOT NULL services FK (0001:344).
 * @typedef {object} RawSubstitutionRequestJson
 * @property {string} id
 * @property {string} assignment_id
 * @property {string} [service_id]
 * @property {string | null} block_id
 * @property {string} part
 * @property {string} original_member
 * @property {string | null} original_name
 * @property {string} [requested_by]
 * @property {SubstitutionScope} scope
 * @property {SubstitutionRequestStatus} status
 * @property {string[]} candidates
 * @property {SubstitutionResponse[]} responses
 * @property {SubstitutionCover | null} [covered_by]
 * @property {string} created_at
 * @property {string | null} resolved_at
 */

/**
 * The camelCase client shape. A pure rename of the row above, so every
 * nullable/optional key stays exactly as nullable there — narrowing
 * serviceId/requestedBy to `string` here would be a lie for list rows.
 * @typedef {object} SubstitutionRequest
 * @property {string} id
 * @property {string} assignmentId
 * @property {string | undefined} serviceId
 * @property {string | null} blockId
 * @property {string} part
 * @property {string} originalMemberId
 * @property {string | null} originalName
 * @property {string | undefined} requestedBy
 * @property {SubstitutionScope} scope
 * @property {SubstitutionRequestStatus} status
 * @property {string[]} candidates
 * @property {SubstitutionResponse[]} responses
 * @property {SubstitutionCover | null} coveredBy
 * @property {string} createdAt
 * @property {string | null} resolvedAt
 */

/**
 * One chart inside a context block's or event setlist's song list (0023:742-755
 * for blocks, 0023:770-781 for the event setlist — the event projection omits
 * the two version columns, hence the optional pair). song_id/title come from
 * songs (0001:71 PK, 0001:74 NOT NULL title); artist is the NULLABLE
 * songs.artist (0001:75); version_id is the NULLABLE setlist_items.version_id
 * (0001:182); version_name is song_versions.name (0001:103, NOT NULL) and
 * base_key the NULLABLE song_versions.base_key (0001:106); `chart` is
 * coalesced to '' so it is never null (0023:749-754).
 * @typedef {object} SubstitutionContextSong
 * @property {string} song_id
 * @property {string} title
 * @property {string | null} artist
 * @property {string | null} version_id
 * @property {string} [version_name]
 * @property {string | null} [base_key]
 * @property {string} chart
 */

/**
 * One of the caller's assignment blocks (0023:705-761). id/name are the
 * service_blocks NOT NULL columns (0001:334-335); `part` is the coalesced
 * assignment part (service_assignments.part, 0001:347 NOT NULL); `role` is the
 * three-armed CASE over is_substitute / user_id (0023:684-686), so it is one
 * of exactly three literals; assignment_id comes from a LEFT JOIN lateral
 * (0023:683, 0023:688-693) and is therefore nullable, as are request_id,
 * request_status and covered_name — scalar subqueries that find nothing outside
 * the caller's own coverage (0023:716-740).
 * @typedef {object} SubstitutionContextBlock
 * @property {string} id
 * @property {string} name
 * @property {string} part
 * @property {'original' | 'substitute' | 'candidate'} role
 * @property {string | null} assignment_id
 * @property {string | null} request_id
 * @property {SubstitutionRequestStatus | null} request_status
 * @property {string | null} covered_name
 * @property {SubstitutionContextSong[]} songs
 */

/**
 * The cross-org event payload (0023:766-787), present only when the caller has
 * an event-scoped request (0023:794) — otherwise the SELECT INTO yields SQL
 * NULL. events.id / events.name are both NOT NULL (0001:242, 0001:244) and
 * `songs` is coalesced to [] (0023:769-781).
 * @typedef {object} SubstitutionContextEvent
 * @property {string} event_id
 * @property {string} event_name
 * @property {SubstitutionContextSong[]} songs
 */

/**
 * The service header (0023:800): services.id PK and the NOT NULL services.name
 * (0001:323, 0001:326). Both keys are always present — v_service is the row
 * already guarded at 0023:660-663.
 * @typedef {object} SubstitutionContextService
 * @property {string} id
 * @property {string} name
 */

/**
 * The substitution_context jsonb row (0023:799-803). It is ALREADY client-shaped
 * — only the nested blocks/songs keep their snake_case — so flattenContext is
 * a pure defaulting pass. `event` is SQL NULL unless an event-scoped request
 * matched (0023:788-797), and `instrument` is coalesced to '' (0023:803)
 * because profiles.instrument is a NULLABLE column (0006:33).
 * @typedef {object} RawSubstitutionContextJson
 * @property {SubstitutionContextService | null} service
 * @property {SubstitutionContextBlock[]} blocks
 * @property {SubstitutionContextEvent | null} event
 * @property {string} instrument
 */

/**
 * The client's view of that context. Identical by construction — declared as
 * its own name so the RPC row and the consumer contract can drift apart
 * without a rewrite of the normalizer's signature.
 * @typedef {RawSubstitutionContextJson} SubstitutionContext
 */

/**
 * The personal rendering preferences renderSemitones reads: the account-wide
 * `transpose` (preferences.js always Number()-coerces it, preferences.js:35)
 * plus the per-song `overrides` map, which beats the global
 * (preferences.js:38). Every key is optional because the function defaults a
 * missing bundle to `{}` and the demo passes null outright; the real caller
 * (SubstitutionAssignment.jsx:35) hands over the whole preferences object.
 * @typedef {object} RenderPreferences
 * @property {number | null} [transpose]
 * @property {Record<string, number | null> | null} [overrides]
 */

/**
 * The offline-aware accept verdict: `queued` when the intent went to the outbox
 * instead of the RPC.
 * @typedef {object} OfflineAwareAccept
 * @property {boolean} queued
 * @property {string | null} [substituteAssignmentId]
 */

// ponytail: lazy import — supabase.js evaluates import.meta.env at module load,
// which is undefined in bare node (this module's demo runs there).
/** @type {typeof import('../supabase.js').supabase | null} */
let supabaseClient = null
async function supabase() {
  if (!supabaseClient) supabaseClient = (await import('../supabase.js')).supabase
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
  'You are no longer an active member of this organization.',
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
 * the safe generic message. Never returns.
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
 * @returns {Promise<string>} the substitution_requests id. mark_unavailable
 * returns `uuid` (0023:107) and every success path returns a non-null one
 * (0023:142 the idempotent already-open hit, 0023:166 the fresh insert);
 * 'Assignment not found.' and the rest raise instead.
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
 * @returns {Promise<void>} send_substitution_request returns `void` (0023:171).
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
 * @returns {Promise<string | null>} respond_substitution returns `uuid`
 * (0023:220) that is NULL on the decline path (0023:257) and the substitute's
 * own assignment id on the accept path (0023:324) — hence the union, not
 * `string`.
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
 * @returns {Promise<void>} cancel_substitution returns `void` (0023:330).
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
 * @returns {Promise<void>} reclaim_assignment returns `void` (0023:400).
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
 * @returns {Promise<string>} overrule_substitution returns `uuid` (0023:446) and
 * only ever the non-null id it just upserted (0023:501, 0023:525).
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
 * @returns {Promise<string[]>} substitution_candidates returns `uuid[]`
 * (0023:47), coalesced to the empty array rather than NULL (0023:87).
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
 * @returns {Promise<SubstitutionRequest | null>} the single-request row always
 * carries service_id / requested_by / covered_by (0023:582-597); null only when
 * the RPC hands back no jsonb at all.
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
 * @returns {Promise<(SubstitutionRequest | null)[]>} each element keeps the
 * normalizer's null arm, and each row is the NARROWER list projection
 * (0023:615-633) — no service_id / requested_by / covered_by, which is exactly
 * why those three are optional on the shared row type.
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
 * @param {string | null} instrument — profiles.instrument is a NULLABLE column
 * (0006:33) and substitution_context already coalesces it to '' (0023:803);
 * the demo passes '' too. `undefined` is accepted by the `String(x || '')`
 * guard at the top of the body.
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
 * @param {string | null} instrument
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
 * @param {string | null} instrument
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
    // The cast is what makes this call checked: enqueueOp resolves to `any`
    // here (see the EnqueueOp mirror above), so without it neither the op name
    // — which the drainer looks the replay function up by — nor the arg list
    // would ever be verified.
    await /** @type {EnqueueOp} */ (enqueueOp)(userId, { name: 'respondSubstitution', args: [requestId, true] })
    return { queued: true }
  }
  const substituteAssignmentId = await respondSubstitution(requestId, true)
  return { queued: false, substituteAssignmentId }
}

// Self-check: node -e "import('./src/data/repositories/substitutions.js').then(m => m.demo())"
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

  // The RPC always builds every key of the row (0023:582-597); this hand-written
  // fixture carries only the ones the asserts below read, so it is an assertion
  // rather than a checked literal — the widened `scope`/`status` strings are
  // comparable to the unions, but not assignable to them.
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