// @ts-check
// Community moderation data layer (Hito 4 — community-moderation).
// Handles report intake, case consolidation, moderator decisions, appeals,
// and takedown propagation. All case writes are ONLINE-ONLY server RPCs
// (0015): consolidate_report f/u, decide_moderation_case, file_appeal run
// as SECURITY DEFINER in `private` so no client path can forge a decision
// or see another reporter's identity. Reporter identity is hidden from
// contributors and visible only to moderators (RLS moderator policies).
//
// Scenario coverage: features/community-moderation.feature

import { supabase } from '../supabase.js'

/**
 * Report grounds — the report_reason enum (0001) and the REPORT_REASONS list
 * below are the same vocabulary.
 * @typedef {'copyright_violation' | 'offensive_content' | 'spam_duplicate' | 'wrong_metadata'} ReportReason
 */

/**
 * Decision vocabulary — the values decide_moderation_case (0015) raises; the
 * client gates on the same set before calling the RPC.
 * @typedef {'keep' | 'remove' | 'escalate'} ModerationDecision
 */

/**
 * Report lifecycle — 'pending' on insert, 'consolidated' once the 0015 RPC
 * folds it into a case, 'closed' by a decision.
 * @typedef {'pending' | 'consolidated' | 'closed'} ReportStatus
 */

/**
 * Raw moderation_cases row (explicit select list in getModerationQueue,
 * select '*' in getAppeals). created_at is added by 0015, not by 0001.
 * @typedef {object} RawCaseRow
 * @property {string} id
 * @property {string} public_song_id
 * @property {Record<string, number>} reason_counts
 * @property {string[]} grounds
 * @property {string | null} decision
 * @property {string | null} decider_id
 * @property {string | null} appeal_of
 * @property {string | null} decided_at
 * @property {string | null} notes
 * @property {string} created_at
 */

/**
 * Raw reports row (select list in getModerationQueue).
 * @typedef {object} RawReportRow
 * @property {string} id
 * @property {string} public_song_id
 * @property {string} reporter_id
 * @property {ReportReason} reason
 * @property {ReportStatus} status
 * @property {string} created_at
 */

/**
 * Raw public_library_entries catalog row (the subset the queue selects).
 * @typedef {object} RawEntryRow
 * @property {string} id
 * @property {string} title
 * @property {string | null} artist
 * @property {string | null} genre
 * @property {string} contributor_id
 * @property {string | null} contributor_name
 * @property {'public-domain' | 'CC-BY-4.0' | 'proprietary'} license
 */

/**
 * Raw moderation_cases row as the dashboard summary projects it.
 * @typedef {object} RawReportedEntryRow
 * @property {string} id
 * @property {string} public_song_id
 * @property {Record<string, number>} reason_counts
 * @property {string[]} grounds
 * @property {string} created_at
 */

/**
 * One queue item: the case spread as read, plus its catalog entry (null when
 * the entry is no longer readable) and the consolidated reports.
 * @typedef {object} ModerationQueueItem
 * @property {string} id
 * @property {string} public_song_id
 * @property {Record<string, number>} reason_counts
 * @property {string[]} grounds
 * @property {string | null} decision
 * @property {string | null} decider_id
 * @property {string | null} appeal_of
 * @property {string | null} decided_at
 * @property {string | null} notes
 * @property {string} created_at
 * @property {RawEntryRow | null} entry
 * @property {RawReportRow[]} reports
 */

const USER_ERRORS = new Set([
  'Already reported.',
  'Already decided.',
  'Not a moderator.',
  'Appeal already reviewed.',
  'Cannot review your own decision.',
  'Case not found.',
  'Entry not found.',
  'Case is still open.',
  'Report not found.',
  'Only the contributor can appeal.',
])

/**
 * Re-throws known user-facing errors (and the UNIQUE race that means a
 * duplicate filing); everything else maps to a generic message. Never returns.
 * @param {Error} error
 * @returns {never}
 */
function handleError(error) {
  const msg = error?.message || ''
  if (USER_ERRORS.has(msg)) throw error
  if (msg.includes('unique constraint')) throw new Error('Already reported.')
  throw new Error('Something went wrong. Please try again.')
}

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withErrorMapping(fn) {
  try { return await fn() } catch (e) { handleError(/** @type {Error} */ (e)) }
}

// ── REPORT INTAKE ─────────────────────────────────────────────────────────────

const REPORT_REASONS = [
  'copyright_violation',
  'offensive_content',
  'spam_duplicate',
  'wrong_metadata',
]

export { REPORT_REASONS }

/**
 * File a report on a public library entry. Inserts the report row (RLS
 * reporter_id = auth.uid()) then calls the server-side consolidation RPC
 * (0015) which folds pending reports into one open moderation case. The
 * UNIQUE (public_song_id, reason, reporter_id) constraint blocks duplicate
 * filings — the client error maps to "Already reported."
 * @param {string} publicSongId
 * @param {ReportReason} reason
 * @returns {Promise<boolean>}
 */
export function reportPublicSong(publicSongId, reason) {
  return withErrorMapping(async () => {
    if (!REPORT_REASONS.includes(reason)) {
      throw new Error('Invalid reason.')
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('You must be signed in.')

    const { error } = await supabase
      .from('reports')
      .insert({
        public_song_id: publicSongId,
        reporter_id: user.id,
        reason,
        status: 'pending',
      })
    if (error) throw error

    // Server-side consolidation: fold into a case, exclude decided grounds.
    const { error: rpcError } = await supabase.rpc('consolidate_report', {
      p_public_song_id: publicSongId,
    })
    if (rpcError) throw rpcError

    return true
  })
}

// ── MODERATION QUEUE ──────────────────────────────────────────────────────────

/**
 * Get the moderation queue for a reviewer. By default: every OPEN case
 * (decision IS NULL) — which INCLUDES open appeals (`appeal_of` set): a
 * moderator decides appeals per the feature, and hiding them behind
 * `.is('appeal_of', null)` made them invisible to everyone.
 * Options:
 *  - includeEscalated: also return `decision = 'escalate'` rows — decidable
 *    ONLY by a system_admin (0020 decide_moderation_case).
 *  - escalatedOnly: return ONLY escalated rows (a pure system_admin who is
 *    not a community moderator may decide escalated cases and nothing else,
 *    so they must not be shown dead decision buttons on open cases).
 * Returns an array of cases with entry details and report info.
 * @returns {Promise<ModerationQueueItem[]>}
 */
export async function getModerationQueue({ includeEscalated = false, escalatedOnly = false } = {}) {
  let query = supabase
    .from('moderation_cases')
    .select(`
      id,
      public_song_id,
      reason_counts,
      grounds,
      decision,
      decider_id,
      appeal_of,
      decided_at,
      notes,
      created_at
    `)
  if (escalatedOnly) {
    query = query.eq('decision', 'escalate')
  } else if (includeEscalated) {
    query = query.or('decision.is.null,decision.eq.escalate')
  } else {
    query = query.is('decision', null)
  }
  const { data: cases, error } = await query.order('created_at', { ascending: true })
  if (error) throw error

  if (!cases || cases.length === 0) return []

  // Fetch entry details for each case
  const songIds = [...new Set(cases.map((c) => c.public_song_id))]
  const { data: entries, error: entriesError } = await supabase
    .from('public_library_entries')
    .select('id, title, artist, genre, contributor_id, contributor_name, license')
    .in('id', songIds)
  if (entriesError) throw entriesError

  /** @type {Record<string, RawEntryRow>} */
  const entryMap = {}
  for (const entry of /** @type {RawEntryRow[]} */ (entries || [])) {
    entryMap[entry.id] = entry
  }

  // Fetch report details for each case (reporter identity visible to moderators)
  const { data: reports, error: reportsError } = await supabase
    .from('reports')
    .select('id, public_song_id, reporter_id, reason, status, created_at')
    .in('public_song_id', songIds)
    .eq('status', 'consolidated')
    .order('created_at', { ascending: true })
  if (reportsError) throw reportsError

  // Group reports by public_song_id
  /** @type {Record<string, RawReportRow[]>} */
  const reportsByEntry = {}
  for (const report of /** @type {RawReportRow[]} */ (reports || [])) {
    const key = report.public_song_id
    if (!reportsByEntry[key]) reportsByEntry[key] = []
    reportsByEntry[key].push(report)
  }

  return cases.map((/** @type {RawCaseRow} */ c) => ({
    ...c,
    entry: entryMap[c.public_song_id] || null,
    reports: reportsByEntry[c.public_song_id] || [],
  }))
}

/**
 * List entries with pending reports (for moderator dashboard summary).
 * @returns {Promise<RawReportedEntryRow[]>}
 */
export async function getReportedEntries() {
  const { data, error } = await supabase
    .from('moderation_cases')
    .select(`
      id,
      public_song_id,
      reason_counts,
      grounds,
      created_at
    `)
    .is('decision', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ── MODERATOR CHECK ───────────────────────────────────────────────────────────

/**
 * Check if a user is a community moderator (has the community_moderator
 * role in user_roles). Org admins do NOT get community moderation powers.
 * @param {string | null | undefined} userId
 * @returns {Promise<boolean>}
 */
export async function isModerator(userId) {
  if (!userId) return false
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'community_moderator')
    .limit(1)
  if (error) return false
  return data && data.length > 0
}

/**
 * Check if a user holds the system_admin role — the only role that may
 * decide ESCALATED moderation cases (0020 decide_moderation_case). Read via
 * the user_roles self-select policy (0015 user_roles_select_self), the same
 * client pattern as isModerator: `private.session_has_system_role` is not an
 * option client-side — the `private` schema is not exposed to PostgREST
 * (supabase/config.toml db.schemas = ["public", "graphql_public"]).
 * @param {string | null | undefined} userId
 * @returns {Promise<boolean>}
 */
export async function isSystemAdmin(userId) {
  if (!userId) return false
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'system_admin')
    .limit(1)
  if (error) return false
  return data && data.length > 0
}

/**
 * The signed-in contributor's OWN moderation cases — originals AND appeal
 * rows (RLS moderation_cases_select_contributor, 0020 §6: case rows whose
 * entry the session owns). This is the contributor's path to a decided case
 * and its appeal form.
 *
 * Honest by construction: reports are NEVER fetched here (reporter
 * confidentiality — RLS only returns a contributor their own report rows, so
 * any "report list" would be a partial claim), and entry details come from
 * the catalog view, which exposes LIVE entries only — a removed/withdrawn
 * entry renders with entry: null instead of a fabricated title.
 */
export async function getMyModerationCases() {
  const { data: cases, error } = await supabase
    .from('moderation_cases')
    .select(`
      id,
      public_song_id,
      reason_counts,
      grounds,
      decision,
      decider_id,
      appeal_of,
      decided_at,
      notes,
      created_at
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!cases || cases.length === 0) return []

  const songIds = [...new Set(cases.map((c) => c.public_song_id))]
  const { data: entries, error: entriesError } = await supabase
    .from('public_library_entries')
    .select('id, title, artist, genre, contributor_id, contributor_name, license')
    .in('id', songIds)
  if (entriesError) throw entriesError

  /** @type {Record<string, RawEntryRow>} */
  const entryMap = {}
  for (const entry of /** @type {RawEntryRow[]} */ (entries || [])) {
    entryMap[entry.id] = entry
  }

  return cases.map((/** @type {RawCaseRow} */ c) => ({
    ...c,
    entry: entryMap[c.public_song_id] || null,
    reports: [],
  }))
}

// ── DECISIONS ─────────────────────────────────────────────────────────────────

/**
 * Decide a moderation case: keep, remove, or escalate.
 * Runs server-side (0015 decide_moderation_case): moderator gate, appeal
 * different-decider check, case update, report closing, takedown
 * propagation, restriction counter, and notifications are all definer work.
 * Online-only — an RPC call, never queued.
 * @param {string} caseId
 * @param {ModerationDecision} decision
 * @param {string} [notes]
 * @returns {Promise<boolean>}
 */
export function decideCase(caseId, decision, notes = '') {
  return withErrorMapping(async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('You must be signed in.')

    if (!['keep', 'remove', 'escalate'].includes(decision)) {
      throw new Error('Invalid decision.')
    }

    const { error: rpcError } = await supabase.rpc('decide_moderation_case', {
      p_case_id: caseId,
      p_decision: decision,
      p_notes: notes || null,
    })
    if (rpcError) throw rpcError

    return true
  })
}

// ── APPEALS ───────────────────────────────────────────────────────────────────

/**
 * File an appeal against a decided case. Server-side (0015 file_appeal):
 * only the entry's contributor may appeal, and the appeal case is created
 * with appeal_of so a DIFFERENT moderator must review it.
 * @param {string} caseId
 * @param {string} appealReason
 * @returns {Promise<boolean>}
 */
export function fileAppeal(caseId, appealReason) {
  return withErrorMapping(async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('You must be signed in.')

    const { error: rpcError } = await supabase.rpc('file_appeal', {
      p_case_id: caseId,
      p_reason: appealReason,
    })
    if (rpcError) throw rpcError

    return true
  })
}

/**
 * Get appeal cases for a specific original case.
 * @param {string} caseId
 * @returns {Promise<RawCaseRow[]>}
 */
export async function getAppeals(caseId) {
  const { data, error } = await supabase
    .from('moderation_cases')
    .select('*')
    .eq('appeal_of', caseId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ── REPORT CHECK ──────────────────────────────────────────────────────────────

/**
 * Check if the current user has already reported a specific entry for a
 * specific reason (prevents duplicate filings).
 * @param {string} publicSongId
 * @param {ReportReason} reason
 * @returns {Promise<boolean>}
 */
export async function hasReported(publicSongId, reason) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase
    .from('reports')
    .select('id')
    .eq('public_song_id', publicSongId)
    .eq('reporter_id', user.id)
    .eq('reason', reason)
    .limit(1)
  if (error) return false
  return data && data.length > 0
}