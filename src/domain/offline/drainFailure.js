// @ts-check
// Pure decision logic for a queued offline write whose replay FAILED (drainer
// R6). Zero imports and no environment reads — the caller passes the online
// flag — so this module is bare-node safe and unit-testable without a DOM
// (Vitest runs in the node environment: no jsdom, no indexedDB).
//
// Why it exists. The drain used to `break` on ANY non-superseded error, so a
// single op the server rejects deterministically (RLS denial, validation, 409)
// stalled every later queued op forever. The fix cannot be a bare `continue`:
// an op that fails deterministically would then be retried on every drain,
// forever. So a failure is CLASSIFIED before the loop reacts:
//   - the server already gave a verdict (RLS, auth, conflict, invalid input)
//     -> permanent -> set the op aside and keep draining;
//   - the server never got to answer (offline, gateway error, 5xx) -> transient
//     -> keep the op, stop this drain, leave the ops behind it in order;
//   - nothing recognizable -> UNKNOWN -> fail OPEN (never discard user data) but
//     with a bounded budget, because a shape-erased error cannot be told apart
//     from a transient one.
//
// The verdict-vs-no-verdict line is the whole rule. A request the server
// answered cannot succeed unchanged on the next drain; a request it never
// answered can.
//
// UNKNOWN is not hypothetical: every repository wraps its writes in
// withErrorMapping, and handleError re-throws anything that is not a
// user-facing message as the bare constant MAPPED_GENERIC_ERROR, destroying
// `status` and `code`. So a genuine RLS denial and a genuine 503 can arrive at
// the drainer as the SAME Error. The constant is the only thing separating
// them, which is why it is pinned below: if the repositories ever change that
// message, this module degrades to "unknown errors are treated as user-facing
// guards" and ops get quarantined on their first failure. That failure mode is
// loud (the user is told) rather than lossy. The real fix is upstream:
// handleError should preserve the cause, e.g. new Error(msg, { cause: e }).

/**
 * The one non-user-facing message every repository's handleError produces
 * (13 files under src/data/repositories). Kept byte-identical on purpose; see
 * the header.
 */
export const MAPPED_GENERIC_ERROR = 'Something went wrong. Please try again.'

/** What the drain does with a failed op. */
export const DRAIN_ACTION = {
  /** Keep the op, stop this drain: the next drain tries again. */
  RETRY: 'retry',
  /** Move the op out of the queue: it will never succeed unchanged. */
  QUARANTINE: 'quarantine',
}

/** What the failure looks like, independent of the action chosen. */
export const DRAIN_KIND = {
  /** No verdict from the server: the request never got through. */
  OFFLINE: 'offline',
  /** No verdict from the server: it answered, but with a server-side fault. */
  SERVER: 'server',
  /** A verdict: this exact op is rejected. */
  REJECTED: 'rejected',
  /** Unclassifiable: no verdict, no known permanent cause. */
  UNKNOWN: 'unknown',
}

/**
 * How many times an UNKNOWN failure may be retried before the op is set
 * aside. Only UNKNOWN is capped, and deliberately so: offline/server failures
 * have positive evidence that a later drain can still succeed, so a long
 * outage must not burn this budget and strand a write that would have worked.
 * UNKNOWN has no such evidence either way, so it gets a bounded number of
 * tries — that cap is what keeps an unclassifiable op from stalling the queue
 * forever, which is the bug this module fixes.
 */
export const UNKNOWN_RETRY_BUDGET = 3

/**
 * Postgres/PostgREST codes that mean "this request is rejected, now and on
 * every replay". Mapped to the reason slug recorded on the quarantined op.
 * 42501 is insufficient_privilege, i.e. an RLS policy denial; the PG* entries
 * are constraint violations, which depend only on the stored data, never on
 * connectivity.
 */
const CODE_REASONS = new Map([
  ['42501', 'rls'],
  ['PGRST301', 'auth'],
  ['23505', 'conflict'],
  ['23503', 'conflict'],
  ['23502', 'invalid'],
  ['23514', 'invalid'],
  ['22P02', 'invalid'],
  ['22001', 'invalid'],
  ['PGRST116', 'invalid'],
  ['PGRST202', 'invalid'],
])

/** HTTP statuses the server can answer with that still leave a retry sane. */
const TRANSIENT_STATUS = new Set([408, 425, 429])

/** HTTP statuses that mean the request itself is not acceptable. */
const REJECTED_STATUS = new Map([
  [400, 'invalid'],
  [401, 'auth'],
  [403, 'rls'],
  [404, 'invalid'],
  [405, 'invalid'],
  [406, 'invalid'],
  [409, 'conflict'],
  [422, 'invalid'],
])

// Message patterns, checked only after the structural signals (code, status)
// have had their say. They exist for the errors that carry a human sentence and
// no machine field, which is most of them once handleError has run.
const OFFLINE_MESSAGE =
  /failed to fetch|fetch failed|networkerror|network request failed|load failed|err_(network|connection|internet_disconnected)|the internet connection appears to be offline/i
const SERVER_MESSAGE =
  /bad gateway|service unavailable|gateway time-?out|internal server error|upstream (?:connect|premature)|connection reset by peer/i
const RLS_MESSAGE =
  /row[- ]level security|not authorized|permission denied|insufficient privilege|forbidden/i
const AUTH_MESSAGE =
  /invalid (?:api )?key|invalid jwt|jwt (?:is )?(?:expired|invalid)|invalid token|token (?:has )?expired|not authenticated|missing (?:the )?(?:authorization|auth)|authorization header/i
const CONFLICT_MESSAGE =
  /duplicate key|already exists|violates unique constraint|violates foreign key constraint/i
const INVALID_MESSAGE =
  /violates (?:not-null|check) constraint|invalid (?:input|text|uuid|syntax|json)|malformed|could not find the (?:function|table|column)|must be|is required|required\.|not found|no rows returned|not allowed|not a member|is not a/i

/**
 * Best-effort message of any thrown value. A raw string throw counts as its
 * own message; everything else is read off `.message` and coerced, so a
 * non-Error value (a PostgREST body, a number, undefined) cannot throw here.
 * @param {unknown} error
 * @returns {string}
 */
function messageOf(error) {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const value = /** @type {{ message?: unknown }} */ (error).message
    if (typeof value === 'string') return value
  }
  return ''
}

/**
 * Numeric HTTP status, when the thrown value carries one. PostgrestError does
 * NOT (it keeps only message/details/hint/code), so today this fires for
 * errors that preserve status themselves — kept because a classifier that
 * silently depended on an absent field would be wrong the moment one appears.
 * @param {unknown} error
 * @returns {number | null}
 */
function statusOf(error) {
  if (!error || typeof error !== 'object') return null
  const value = /** @type {{ status?: unknown }} */ (error).status
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 100 && n <= 599 ? n : null
}

/**
 * Postgres/PostgREST error code, when the thrown value carries one. Also
 * accepts a bare 3-digit HTTP-shaped code, which gateway error bodies use.
 * @param {unknown} error
 * @returns {string}
 */
function codeOf(error) {
  if (!error || typeof error !== 'object') return ''
  const value = /** @type {{ code?: unknown }} */ (error).code
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

/**
 * Classify one failed replay. Never throws: any unexpected input lands in
 * UNKNOWN, which retries under a bounded budget rather than discarding work.
 *
 * @param {unknown} error The value the replay threw.
 * @param {boolean} [online] Browser connectivity as the caller sees it. A
 *   local guard error thrown while offline is still a verdict, so `online`
 *   never outranks the rejection checks.
 * @returns {{ kind: string, reason: string, detail: string, permanent: boolean }}
 */
export function classifyDrainFailure(error, online = true) {
  try {
    return classify(error, online !== false)
  } catch {
    // A classifier that throws would abort the drain and leave the queue
    // wedged, which is the very failure this module exists to remove.
    return { kind: DRAIN_KIND.UNKNOWN, reason: 'unknown', detail: '', permanent: false }
  }
}

/**
 * @param {unknown} error
 * @param {boolean} online
 * @returns {{ kind: string, reason: string, detail: string, permanent: boolean }}
 */
function classify(error, online) {
  const detail = messageOf(error)
  /** @param {string} reason */
  const verdict = (reason) => ({ kind: DRAIN_KIND.REJECTED, reason, detail, permanent: true })

  // 1. A machine code is the strongest signal there is: the server answered.
  const code = codeOf(error)
  if (code) {
    const byCode = CODE_REASONS.get(code)
    if (byCode) return verdict(byCode)
    // supabase-js's own connectivity marker, kept in step with the
    // isConnectivityError heuristic the repositories use to decide to enqueue.
    if (code === '-1') return { kind: DRAIN_KIND.OFFLINE, reason: 'offline', detail, permanent: false }
  }

  // 2. A preserved HTTP status, when the error carries one.
  const status = statusOf(error)
  if (status !== null) {
    if (status >= 500 || TRANSIENT_STATUS.has(status)) {
      return { kind: DRAIN_KIND.SERVER, reason: 'server', detail, permanent: false }
    }
    const byStatus = REJECTED_STATUS.get(status)
    if (byStatus) return verdict(byStatus)
  }

  // 3. No status/code: fall back to what the message says. Offline markers
  // come before the rejection markers only because they cannot collide with
  // the app's own guard messages.
  if (OFFLINE_MESSAGE.test(detail)) {
    return { kind: DRAIN_KIND.OFFLINE, reason: 'offline', detail, permanent: false }
  }
  if (SERVER_MESSAGE.test(detail)) {
    return { kind: DRAIN_KIND.SERVER, reason: 'server', detail, permanent: false }
  }
  if (RLS_MESSAGE.test(detail)) return verdict('rls')
  if (AUTH_MESSAGE.test(detail)) return verdict('auth')
  if (CONFLICT_MESSAGE.test(detail)) return verdict('conflict')
  if (INVALID_MESSAGE.test(detail)) return verdict('invalid')

  // 4. Connectivity, once every positive signal above has had its say. It is
  // consulted here so a browser that is plainly offline does not spend the
  // UNKNOWN budget on a blip, and so an unrecognised failure during an outage
  // is retried rather than guessed at. A local guard error thrown while
  // offline is still caught above, by its message.
  if (!online) return { kind: DRAIN_KIND.OFFLINE, reason: 'offline', detail, permanent: false }

  // 5. handleError erased the shape: this exact string is what every
  // repository substitutes for a server rejection it could not translate.
  // Whether the server said 503 or 42501 is unrecoverable, so retry (bounded).
  if (detail === MAPPED_GENERIC_ERROR) {
    return { kind: DRAIN_KIND.UNKNOWN, reason: 'unknown', detail, permanent: false }
  }

  // 6. A message-less throw carries no evidence at all.
  if (!detail) return { kind: DRAIN_KIND.UNKNOWN, reason: 'unknown', detail, permanent: false }

  // 7. Any other human sentence is one of the repositories' own guards
  // ('Setlist name is required.', 'Not allowed.', 'Cannot edit a completed
  // gig.'): thrown by the client, dependent only on stored state, and it
  // replays to the identical rejection. handleError re-throws those verbatim,
  // so this is the commonest permanent failure the drain actually sees.
  return verdict('invalid')

  // Offline is consulted last on purpose. A guard error thrown while the
  // browser is offline is still a rejection; conversely an unrecognised
  // failure while offline is far more likely to be connectivity, and
  // classifying it as such keeps it out of the UNKNOWN budget.
}

/**
 * Full answer to the question the drain loop asks: given a failed replay and
 * how many times THIS op has already failed unclassified, is it retried or set
 * aside?
 *
 * @param {unknown} error The value the replay threw.
 * @param {{ online?: boolean, attempts?: number }} [state] Connectivity as the
 *   caller sees it, and the op's own failure count so far.
 * @returns {{ action: string, kind: string, reason: string, detail: string, permanent: boolean }}
 */
export function decideDrainOutcome(error, state = {}) {
  const failure = classifyDrainFailure(error, state?.online !== false)
  const attempts = Number.isFinite(state?.attempts) ? Number(state?.attempts) : 0
  const budgetSpent = failure.kind === DRAIN_KIND.UNKNOWN && attempts >= UNKNOWN_RETRY_BUDGET
  return {
    ...failure,
    // A permanent failure never gets a second try. An UNKNOWN one gets the
    // budget, then is set aside so it cannot wedge the queue behind it.
    action: failure.permanent || budgetSpent ? DRAIN_ACTION.QUARANTINE : DRAIN_ACTION.RETRY,
  }
}

/**
 * The user-facing line for ops that were set aside. One line per drain, not
 * per op: the queue is drained in a loop and N near-identical banners are
 * noise. Reads through the existing drain-notice channel, so it is shown once
 * and only if a setlist detail screen is open.
 * @param {number} count How many ops were set aside in this drain.
 * @returns {string}
 */
export function quarantineNotice(count) {
  if (count === 1) {
    return 'A change you made offline could not be synced and was set aside. Open the item and make the change again.'
  }
  return `${count} changes you made offline could not be synced and were set aside. Open each item and make the change again.`
}
