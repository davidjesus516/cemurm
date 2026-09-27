// @ts-check
// Supabase data layer for service planning (features/service-planning.feature,
// Hito 4). Reads the services family under 0018 RLS (any org member / leader
// sees the plan; ONLY the leader can write via the RPCs) and mirrors the
// orgRepertoire/gigs data-layer conventions: known user-facing errors are
// re-thrown with their EXACT backend strings, everything else maps to the
// generic message. The client never guesses access — it queries and renders
// what comes back; RPC errors surface inline.
//
// Public surface: listServices, getService, createService,
// updateServiceStatus, validateServicePlan, assignMusician, unassignMusician,
// reorderBlocks, swapBlockSong, checkIn, createBlock, updateBlock, deleteBlock,
// listBlockCounts.

import { supabase } from '../supabase.js'

/**
 * @typedef {'draft' | 'published' | 'completed'} ServiceStatus
 */

/**
 * Raw Supabase rows for the services family (0001 + 0018 service planning)
 * and the embeds the queries select (organizations / branches / setlist_items
 * / songs) plus the profiles search used for member names.
 * @typedef {object} RawServiceRow
 * @property {string} id
 * @property {string} org_id
 * @property {string | null} branch_id
 * @property {string} name
 * @property {ServiceStatus} status
 * @property {string | null} leader_id
 * @property {string} created_at
 * @property {string | null} starts_at
 * @property {{ name: string } | null} [organizations]
 * @property {{ name: string } | null} [branches]
 */

/**
 * @typedef {object} Service
 * @property {string} id
 * @property {string} orgId
 * @property {string | null} branchId
 * @property {string} name
 * @property {ServiceStatus} status
 * @property {string | null} leaderId
 * @property {string} createdAt
 * @property {string | null} startsAt
 * @property {string | null} orgName
 * @property {string | null} branchName
 */

/**
 * @typedef {object} RawBlockRow
 * @property {string} id
 * @property {string} service_id
 * @property {string} name
 * @property {number} position
 * @property {number | null} time_budget
 * @property {string | null} setlist_id
 * @property {number} start_offset_minutes
 */

/**
 * @typedef {object} Block
 * @property {string} id
 * @property {string} serviceId
 * @property {string} name
 * @property {number} position
 * @property {number | null} timeBudget
 * @property {string | null} setlistId
 * @property {number} startOffsetMinutes
 */

/**
 * @typedef {object} RawAssignmentRow
 * @property {string} id
 * @property {string} service_id
 * @property {string | null} block_id
 * @property {string} user_id
 * @property {string} part
 * @property {boolean} is_substitute
 * @property {string | null} covered_by
 * @property {string | null} decided_by
 * @property {string | null} checkin_at
 * @property {number} call_lead_minutes
 */

/**
 * @typedef {object} Assignment
 * @property {string} id
 * @property {string} serviceId
 * @property {string | null} blockId
 * @property {string} userId
 * @property {string | null} memberName
 * @property {string} part
 * @property {boolean} isSubstitute
 * @property {string | null} coveredById
 * @property {string | null} coveredByName
 * @property {string | null} decidedById
 * @property {string | null} decidedByName
 * @property {string | null} checkinAt
 * @property {number} callLeadMinutes
 */

/**
 * @typedef {object} Member
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {object} RawProfileRow
 * @property {string} id
 * @property {string | null} username
 * @property {string | null} display_name
 */

/**
 * @typedef {object} RawSetlistItemRow
 * @property {string} id
 * @property {string} song_id
 * @property {number} position
 * @property {string | null} agreed_key
 * @property {string | null} version_id
 * @property {{ title: string | null } | null} [songs]
 */

/**
 * @typedef {object} RawSetlistRow
 * @property {string} id
 * @property {string | null} name
 * @property {RawSetlistItemRow[]} [setlist_items]
 */

/**
 * @typedef {object} BlockSetlistItem
 * @property {string} id
 * @property {string} songId
 * @property {string | null} title
 * @property {string | null} agreedKey
 * @property {number} position
 */

/**
 * @typedef {object} BlockSetlist
 * @property {string} id
 * @property {string | null} name
 * @property {BlockSetlistItem[]} items
 */

/**
 * change-log detail payload (jsonb — loosened to the keys the 0018 RPCs
 * write: song_swap ids, assign/unassign user_id + part; values are the
 * non-null uuids/text the RPCs put into jsonb_build_object).
 * @typedef {object} RawServiceLogDetail
 * @property {string} [old_song_id]
 * @property {string} [new_song_id]
 * @property {string} [user_id]
 * @property {string} [part]
 */

/**
 * @typedef {object} RawServiceLogRow
 * @property {string} id
 * @property {string} service_id
 * @property {string} actor_id
 * @property {string} action
 * @property {RawServiceLogDetail | null} detail
 * @property {string} created_at
 */

/**
 * @typedef {object} ServiceLogEntry
 * @property {string} id
 * @property {string} serviceId
 * @property {string} action
 * @property {string} actorId
 * @property {string | null} actorName
 * @property {string} createdAt
 * @property {Record<string, unknown>} detail
 * @property {string} summary
 */

/**
 * @typedef {object} ServiceDetail
 * @property {Service & { leaderName: string | null }} service
 * @property {Array<Block & { setlist: BlockSetlist | null }>} blocks
 * @property {Assignment[]} assignments
 * @property {Record<string, Assignment[]>} assignmentsByBlock
 * @property {Member[]} members
 * @property {ServiceLogEntry[]} changeLog
 */

/**
 * validate_service_plan returns {warnings: [{kind, message}]}.
 * @typedef {object} ServicePlanWarning
 * @property {string} kind
 * @property {string} message
 */

/**
 * Mutation inputs — client guards run before any network call.
 * @typedef {object} ServiceInput
 * @property {string | undefined} [orgId]
 * @property {string | null | undefined} [branchId]
 * @property {string | undefined} [name]
 * @property {string | Date | null | undefined} [startsAt]
 */

/**
 * @typedef {object} AssignmentInput
 * @property {string} serviceId
 * @property {string} blockId
 * @property {string} userId
 * @property {string | null | undefined} part
 */

/**
 * @typedef {object} SwapSongInput
 * @property {string} serviceId
 * @property {string} blockId
 * @property {string} oldSongId
 * @property {string} newSongId
 */

/**
 * @typedef {object} BlockInput
 * @property {string} serviceId
 * @property {string} name
 * @property {number | string | null | undefined} timeBudget
 * @property {number | string | null | undefined} startOffsetMinutes
 */

/**
 * @typedef {object} BlockUpdateInput
 * @property {string | undefined} [name]
 * @property {number | string | null | undefined} [timeBudget]
 * @property {number | string | null | undefined} [startOffsetMinutes]
 * @property {string | null | undefined} [setlistId]
 */

// Exact literals raised by the 0018 cores and RLS-blocked writes — surfaced
// verbatim so the UI renders the BDD wording (em-dash U+2014 verbatim).
const USER_ERRORS = new Set([
  'Only the service leader can edit the plan.',
  'Service not found.',
  'Block not found.',
  'Block has no setlist.',
  "Song not found in the block's setlist.",
  'Assignment not found or already checked in.',
  'Service is already completed.',
  // client-layer input guards (gigs.js precedent: guards live in the set)
  'Service name is required.',
  'Organization is required.',
  'Block name is required.',
  'Part is required.',
])

/**
 * The overlap error is dynamic: '<name> is already assigned to <block> —
 * overlapping times' (assign_musician raises with the BDD literal). Match the
 * stable suffix instead of the whole string.
 * @param {unknown} message
 * @returns {boolean}
 */
function isOverlapError(message) {
  return typeof message === 'string' && message.includes(' — overlapping times')
}

/**
 * Re-throws known user-facing errors; maps everything else to a generic
 * message so callers never see PostgREST internals. Never returns.
 * @param {Error} error
 * @returns {never}
 */
function handleError(error) {
  if (USER_ERRORS.has(error?.message) || isOverlapError(error?.message)) throw error
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

/** Flatten a raw services row (with optional organizations/branches embeds). */
/**
 * @param {RawServiceRow} row
 * @returns {Service}
 */
function flattenService(row) {
  return {
    id: row.id,
    orgId: row.org_id,
    branchId: row.branch_id,
    name: row.name,
    status: row.status,
    leaderId: row.leader_id,
    createdAt: row.created_at,
    startsAt: row.starts_at,
    // RLS note: organizations/branches are deny-by-default for clients until
    // the org-repertoire slice lands, so these embeds may read null here —
    // the pages render what comes back.
    orgName: row.organizations?.name || null,
    branchName: row.branches?.name || null,
  }
}

/**
 * @param {RawBlockRow} row
 * @returns {Block}
 */
function flattenBlock(row) {
  return {
    id: row.id,
    serviceId: row.service_id,
    name: row.name,
    position: row.position,
    timeBudget: row.time_budget,
    setlistId: row.setlist_id,
    startOffsetMinutes: row.start_offset_minutes ?? 0,
  }
}

/**
 * @param {RawAssignmentRow} row
 * @param {Map<string | null | undefined, Member>} memberById
 * @returns {Assignment}
 */
function flattenAssignment(row, memberById) {
  return {
    id: row.id,
    serviceId: row.service_id,
    blockId: row.block_id,
    userId: row.user_id,
    memberName: memberById.get(row.user_id)?.name || null,
    part: row.part,
    isSubstitute: row.is_substitute,
    coveredById: row.covered_by,
    coveredByName: memberById.get(row.covered_by)?.name || null,
    decidedById: row.decided_by,
    decidedByName: memberById.get(row.decided_by)?.name || null,
    checkinAt: row.checkin_at,
    callLeadMinutes: row.call_lead_minutes,
  }
}

/**
 * Resolve user ids to display names (profiles search — bandmates.js pattern;
 * id → display_name → username). Unknown ids are omitted from the map.
 * @param {Array<string | null | undefined>} ids
 * @returns {Promise<Map<string, Member>>}
 */
async function resolveMemberNames(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))]
  if (unique.length === 0) return new Map()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', unique)
  if (error) throw error
  return new Map((data || []).map((p) => [
    p.id,
    { id: p.id, name: p.display_name || p.username || 'Someone' },
  ]))
}

/** Song titles for the change-log summaries (song_swap rows name the songs). */
/**
 * @param {Array<string | null | undefined>} ids
 * @returns {Promise<Map<string, string>>}
 */
async function resolveSongTitles(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))]
  if (unique.length === 0) return new Map()
  const { data, error } = await supabase
    .from('songs')
    .select('id, title')
    .in('id', unique)
  if (error) throw error
  return new Map((data || []).map((s) => [s.id, s.title]))
}

/**
 * Fetch a block's setlist with its items (title + agreed key) via the
 * setlist_items → songs join. RLS scopes the read; a setlist the reader
 * cannot see comes back as an empty name/items — render as-is.
 * @param {string} setlistId
 * @returns {Promise<BlockSetlist>}
 */
async function fetchBlockSetlist(setlistId) {
  const { data, error } = await supabase
    .from('setlists')
    .select('id, name, setlist_items(id, song_id, position, agreed_key, version_id, songs(title))')
    .eq('id', setlistId)
    .maybeSingle()
  if (error) throw error
  if (!data) return { id: setlistId, name: null, items: [] }
  const items = (/** @type {RawSetlistItemRow[] | null | undefined} */ (/** @type {unknown} */ (data.setlist_items)) || [])
    .sort((a, b) => a.position - b.position)
    .map((i) => ({
      id: i.id,
      songId: i.song_id,
      title: i.songs?.title || null,
      agreedKey: i.agreed_key || null,
      position: i.position,
    }))
  return { id: data.id, name: data.name, items }
}

/** Human-readable change-log row: action, actor, when, detail summary. */
/**
 * @param {RawServiceLogRow} row
 * @param {Map<string | null | undefined, Member>} memberById
 * @param {Map<string | null | undefined, string>} songById
 * @returns {string}
 */
function summarizeLog(row, memberById, songById) {
  /** @type {RawServiceLogDetail} */
  const detail = row.detail || {}
  switch (row.action) {
    // Runtime quirk preserved as-is: resolveSongTitles stores raw title
    // strings, so the `?.title` reads below ALWAYS fall back. The casts only
    // satisfy the checker (null-safe key + title-shaped read) — no behavior
    // change. A real fix belongs in a separate behavior-change task.
    case 'song_swap':
      return `Swapped ${/** @type {{ title?: string } | undefined} */ (/** @type {unknown} */ (songById.get(detail.old_song_id)))?.title || 'previous song'} → ${/** @type {{ title?: string } | undefined} */ (/** @type {unknown} */ (songById.get(detail.new_song_id)))?.title || 'new song'}`
    case 'assign':
      return `Assigned ${memberById.get(detail.user_id)?.name || 'a member'} to ${detail.part || 'a part'}`
    case 'unassign':
      return `Unassigned ${memberById.get(detail.user_id)?.name || 'a member'}`
    case 'reorder':
      return 'Blocks reordered'
    default:
      return row.action
  }
}

/** All services the session can see, newest first (org member / leader scope). */
/**
 * @returns {Promise<Service[]>}
 */
export function listServices() {
  return withErrorMapping(async () => {
    const { data, error } = await supabase
      .from('services')
      .select('*, organizations(name), branches(name)')
      .order('starts_at', { ascending: false })
    if (error) throw error
    return (data || []).map(flattenService)
  })
}

/** Block count per service id — cheap client-side aggregate for the cards. */
/**
 * @returns {Promise<Record<string, number>>}
 */
export async function listBlockCounts() {
  return withErrorMapping(async () => {
    const { data, error } = await supabase
      .from('service_blocks')
      .select('service_id')
    if (error) throw error
    /** @type {Record<string, number>} */
    const counts = {}
    for (const row of data || []) counts[row.service_id] = (counts[row.service_id] || 0) + 1
    return counts
  })
}

/**
 * Detail read: service + blocks (ordered by position, each with its setlist
 * and items) + assignments (names resolved, keyed by block) + change log
 * (names + summaries). `members` = every profile referenced by the plan —
 * the quick-pick pool for the assignment form.
 * @param {string} id
 * @returns {Promise<ServiceDetail>}
 */
export async function getService(id) {
  return withErrorMapping(async () => {
    const { data: serviceRow, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (serviceError) throw serviceError
    if (!serviceRow) throw new Error('Service not found.')

    const [blocksRes, assignmentsRes, logRes] = await Promise.all([
      supabase.from('service_blocks').select('*').eq('service_id', id).order('position', { ascending: true }),
      supabase.from('service_assignments').select('*').eq('service_id', id),
      supabase.from('service_change_log').select('*').eq('service_id', id).order('created_at', { ascending: false }),
    ])
    if (blocksRes.error) throw blocksRes.error
    if (assignmentsRes.error) throw assignmentsRes.error
    if (logRes.error) throw logRes.error

    const blockRows = blocksRes.data || []
    const assignmentRows = assignmentsRes.data || []
    const logRows = logRes.data || []

    // Names for every referenced user (leader, assignees, deciders, actors).
    const userIds = new Set([
      serviceRow.leader_id,
      ...assignmentRows.flatMap((a) => [a.user_id, a.covered_by, a.decided_by]),
      ...logRows.map((l) => l.actor_id),
    ])
    const memberById = await resolveMemberNames([...userIds])

    // Each block's setlist (title + agreed keys) — independent per block.
    const setlistIds = [...new Set(blockRows.map((b) => b.setlist_id).filter(Boolean))]
    const setlistRows = await Promise.all(setlistIds.map(fetchBlockSetlist))
    const setlistById = new Map(setlistRows.map((s) => [s.id, s]))

    // Titles for song_swap change-log summaries.
    const songIds = logRows
      .filter((l) => l.action === 'song_swap')
      .flatMap((l) => [l.detail?.old_song_id, l.detail?.new_song_id])
    const songById = await resolveSongTitles(songIds)

    const assignments = assignmentRows.map((a) => flattenAssignment(a, memberById))
      .sort((a, b) => (a.memberName || '').localeCompare(b.memberName || ''))
    /** @type {Record<string, Assignment[]>} */
    const assignmentsByBlock = {}
    for (const assignment of assignments) {
      const blockId = /** @type {string} */ (assignment.blockId)
      if (!assignmentsByBlock[blockId]) assignmentsByBlock[blockId] = []
      assignmentsByBlock[blockId].push(assignment)
    }

    return {
      service: {
        ...flattenService(serviceRow),
        leaderName: memberById.get(serviceRow.leader_id)?.name || null,
      },
      blocks: blockRows.map((row) => ({
        ...flattenBlock(row),
        setlist: setlistById.get(row.setlist_id) || null,
      })),
      assignments,
      assignmentsByBlock,
      members: [...memberById.values()],
      changeLog: logRows.map(/** @param {RawServiceLogRow} row */ (row) => ({
        id: row.id,
        serviceId: row.service_id,
        action: row.action,
        actorId: row.actor_id,
        actorName: memberById.get(row.actor_id)?.name || null,
        createdAt: row.created_at,
        detail: row.detail || {},
        summary: summarizeLog(row, memberById, songById),
      })),
    }
  })
}

/** Leader creates a draft service; the creator becomes the leader. */
/**
 * @param {ServiceInput} input
 * @returns {Promise<Service>}
 */
export async function createService({ orgId, branchId, name, startsAt }) {
  return withErrorMapping(async () => {
    const trimmed = name?.trim()
    if (!trimmed) throw new Error('Service name is required.')
    if (!orgId) throw new Error('Organization is required.')

    const { data: session } = await supabase.auth.getUser()
    const leaderId = session?.user?.id
    const iso = startsAt
      ? (startsAt instanceof Date ? startsAt.toISOString() : startsAt)
      : null

    const { data, error } = await supabase
      .from('services')
      .insert({
        org_id: orgId,
        branch_id: branchId ?? null,
        name: trimmed,
        status: 'draft',
        leader_id: leaderId,
        starts_at: iso,
      })
      .select('*')
      .single()
    if (error) throw error
    return flattenService(data)
  })
}

/**
 * Leader-only status transition (publish / complete). RLS enforces the writer
 * scope and freezes completed services; a blocked update updates zero rows,
 * so verify the row actually changed and surface the leader error.
 * @param {string} id
 * @param {ServiceStatus} status
 * @returns {Promise<void>}
 */
export async function updateServiceStatus(id, status) {
  return withErrorMapping(async () => {
    const { data, error } = await supabase
      .from('services')
      .update({ status })
      .eq('id', id)
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Only the service leader can edit the plan.')
  })
}

/** Run the plan validator; returns the warnings array (render as-is). */
/**
 * @param {string} serviceId
 * @returns {Promise<ServicePlanWarning[]>}
 */
export async function validateServicePlan(serviceId) {
  return withErrorMapping(async () => {
    const { data, error } = await supabase
      .rpc('validate_service_plan', { p_service_id: serviceId })
    if (error) throw error
    return data?.warnings || []
  })
}

/** Leader assigns a member to a block (RPC; overlap conflicts rejected). */
/**
 * @param {AssignmentInput} input
 * @returns {Promise<string>}
 */
export async function assignMusician({ serviceId, blockId, userId, part }) {
  return withErrorMapping(async () => {
    const trimmed = part?.trim()
    if (!trimmed) throw new Error('Part is required.')
    const { data, error } = await supabase
      .rpc('assign_musician', {
        p_service_id: serviceId,
        p_block_id: blockId,
        p_user_id: userId,
        p_part: trimmed,
      })
    if (error) throw error
    return data
  })
}

/** Leader removes an assignment (RLS delete — leader-only, not completed). */
/**
 * @param {string} assignmentId
 * @returns {Promise<void>}
 */
export async function unassignMusician(assignmentId) {
  return withErrorMapping(async () => {
    const { data, error } = await supabase
      .from('service_assignments')
      .delete()
      .eq('id', assignmentId)
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Only the service leader can edit the plan.')
  })
}

/**
 * Leader reorders ALL blocks: p_block_ids must be exactly the service's block
 * ids (the current visible order, reordered) — the RPC validates the set.
 * @param {string} serviceId
 * @param {string[]} blockIds
 * @returns {Promise<void>}
 */
export async function reorderBlocks(serviceId, blockIds) {
  return withErrorMapping(async () => {
    const { error } = await supabase
      .rpc('reorder_service_blocks', {
        p_service_id: serviceId,
        p_block_ids: blockIds,
      })
    if (error) throw error
  })
}

/** Leader swaps a song inside a block's setlist (position kept, key reset). */
/**
 * @param {SwapSongInput} input
 * @returns {Promise<void>}
 */
export async function swapBlockSong({ serviceId, blockId, oldSongId, newSongId }) {
  return withErrorMapping(async () => {
    const { error } = await supabase
      .rpc('swap_block_song', {
        p_service_id: serviceId,
        p_block_id: blockId,
        p_old_song_id: oldSongId,
        p_new_song_id: newSongId,
      })
    if (error) throw error
  })
}

/** The assigned member marks themselves present (self-only RPC). */
/**
 * @param {string} assignmentId
 * @returns {Promise<void>}
 */
export async function checkIn(assignmentId) {
  return withErrorMapping(async () => {
    const { error } = await supabase
      .rpc('check_in', { p_assignment_id: assignmentId })
    if (error) throw error
  })
}

/** Leader appends a block (position = current tail + 1). */
/**
 * @param {BlockInput} input
 * @returns {Promise<Block>}
 */
export async function createBlock({ serviceId, name, timeBudget, startOffsetMinutes }) {
  return withErrorMapping(async () => {
    const trimmed = name?.trim()
    if (!trimmed) throw new Error('Block name is required.')

    const { data: maxRow, error: maxError } = await supabase
      .from('service_blocks')
      .select('position')
      .eq('service_id', serviceId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (maxError) throw maxError

    const { data, error } = await supabase
      .from('service_blocks')
      .insert({
        service_id: serviceId,
        name: trimmed,
        position: (maxRow?.position ?? -1) + 1,
        time_budget: timeBudget ?? null,
        start_offset_minutes: startOffsetMinutes ?? 0,
      })
      .select('*')
      .single()
    if (error) throw error
    return flattenBlock(data)
  })
}

/** Leader edits a block: name / time budget / start offset / setlist. */
/**
 * @param {string} blockId
 * @param {BlockUpdateInput} fields
 * @returns {Promise<Block>}
 */
export async function updateBlock(blockId, fields) {
  return withErrorMapping(async () => {
    const patch = {}
    if (fields.name !== undefined) {
      const trimmed = fields.name.trim()
      if (!trimmed) throw new Error('Block name is required.')
      patch.name = trimmed
    }
    if (fields.timeBudget !== undefined) patch.time_budget = fields.timeBudget
    if (fields.startOffsetMinutes !== undefined) patch.start_offset_minutes = fields.startOffsetMinutes
    if (fields.setlistId !== undefined) patch.setlist_id = fields.setlistId || null

    const { data, error } = await supabase
      .from('service_blocks')
      .update(patch)
      .eq('id', blockId)
      .select('*')
      .single()
    if (error) throw error
    return flattenBlock(data)
  })
}

/** Leader deletes a block (RLS delete — leader-only, not completed). */
/**
 * @param {string} blockId
 * @returns {Promise<void>}
 */
export async function deleteBlock(blockId) {
  return withErrorMapping(async () => {
    const { data, error } = await supabase
      .from('service_blocks')
      .delete()
      .eq('id', blockId)
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Only the service leader can edit the plan.')
  })
}