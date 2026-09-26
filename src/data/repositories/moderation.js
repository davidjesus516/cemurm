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
 * reports.reason — the 0001 `report_reason` enum. REPORT_REASONS is the
 * frozen client-side copy; the runtime `includes` guard stays authoritative
 * because the value arrives from UI state.
 * @typedef {'copyright_violation' | 'offensive_content' | 'spam_duplicate' | 'wrong_metadata'} ReportReason
 */

/**
 * moderation_cases.decision (0001) — a case is open while this is null.
 * @typedef {'keep' | 'remove' | 'escalate'} ModerationDecision
 */

/**
 * moderation_cases.reason_counts (0001 jsonb): grouped reporter counts keyed
 * by report_reason, e.g. {copyright_violation: 3, offensive_content: 1}.
 * @typedef {Record<string, number>} ReasonCounts
 */

/**
 * Raw moderation_cases row as getModerationQueue selects it (0001 columns
 * plus the 0015 created_at). decision/notes are null while the case is open.
 * @typedef {object} RawModerationCase
 * @property {string} id
 * @property {string} public_song_id
 * @property {ReasonCounts} reason_counts
 * @property {string[]} grounds
 * @property {ModerationDecision | null} decision
 * @property {string | null} decider_id
 * @property {string | null} appeal_of
 * @property {string | null} decided_at
 * @property {string | null} notes
 * @property {string} created_at
 */

/**
 * The public_library_entries (0010 view) columns the queue joins on for the
 * entry card.
 * @typedef {object} QueueEntryRow
 * @property {string} id
 * @property {string} title
 * @property {string | null} [artist]
 * @property {string | null} [genre]
 * @property {string} contributor_id
 * @property {string | null} [contributor_name]
 * @property {string} license
 */

/**
 * reports row as the queue selects it — reporter identity is moderator-only
 * (RLS), so this surface never reaches contributors.
 * @typedef {object} QueueReportRow
 * @property {string} id
 * @property {string} public_song_id
 * @property {string} reporter_id
 * @property {ReportReason} reason
 * @property {string} status
 * @property {string} created_at
 */

/**
 * The two group-bys getModerationQueue appends to each open case.
 * @typedef {object} QueueEmbeds
 * @property {QueueEntryRow | null} entry
 * @property {QueueReportRow[]} reports
 */

/**
 * The narrower moderation_cases surface getReportedEntries selects for the
 * dashboard summary — the decision columns are deliberately left out.
 * @typedef {object} RawReportedCase
 * @property {string} id
 * @property {string} public_song_id
 * @property {ReasonCounts} reason_counts
 * @property {string[]} grounds
 * @property {string} created_at
 */

/**
 * One open case (decision IS NULL, appeal_of IS NULL) with its entry details
 * and consolidated reports.
 * @typedef {RawModerationCase & QueueEmbeds} ModerationQueueItem
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
 * Re-throws known user-facing errors; a duplicate insert (the UNIQUE
 * (public_song_id, reason, reporter_id) constraint) maps to the same
 * "Already reported." copy the constraint would produce; everything else maps
 * to a generic message.
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
 * Get the moderation queue: open cases (decision IS NULL) grouped by entry.
 * Returns an array of cases with entry details and report info.
 * @returns {Promise<ModerationQueueItem[]>}
 */
export async function getModerationQueue() {
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
    .is('decision', null)
    .is('appeal_of', null)
    .order('created_at', { ascending: true })
  if (error) throw error

  if (!cases || cases.length === 0) return []

  // Fetch entry details for each case
  const songIds = [...new Set(cases.map((c) => c.public_song_id))]
  const { data: entries, error: entriesError } = await supabase
    .from('public_library_entries')
    .select('id, title, artist, genre, contributor_id, contributor_name, license')
    .in('id', songIds)
  if (entriesError) throw entriesError

  /** @type {Record<string, QueueEntryRow>} */
  const entryMap = {}
  for (const entry of entries || []) {
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
  /** @type {Record<string, QueueReportRow[]>} */
  const reportsByEntry = {}
  for (const report of reports || []) {
    const key = report.public_song_id
    if (!reportsByEntry[key]) reportsByEntry[key] = []
    reportsByEntry[key].push(report)
  }

  return cases.map((c) => ({
    ...c,
    entry: entryMap[c.public_song_id] || null,
    reports: reportsByEntry[c.public_song_id] || [],
  }))
}

/**
 * List entries with pending reports (for moderator dashboard summary).
 * @returns {Promise<RawReportedCase[]>}
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
 * A read error is indistinguishable from "not a moderator" here.
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
 * @returns {Promise<RawModerationCase[]>}
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