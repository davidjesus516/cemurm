// @ts-check
// Assignable tasks (0052). One row per task: creator, assignee, title, optional due date,
// status. The permissions are entirely server-side — `tasks` grants and RLS decide who sees,
// creates, completes and withdraws — so this layer only maps rows to the app shape and
// resolves the other party's display name.
//
// ONLINE ONLY, deliberately. Bandmates and setlists queue offline writes because a stage or
// rehearsal can lose signal mid-use; assigning a task is a planning action and a slice that
// queued it would need an id round-trip the table does not offer (the server mints `id`).
// A failed write surfaces its error instead of pretending to have succeeded.
//
// The counterpart name needs a second read: `tasks.created_by`/`assigned_to` reference
// `auth.users`, not `profiles`, so PostgREST cannot embed the profile through a direct FK
// (same shape as orgMembers.getOrgMembers). One `in` query over the distinct ids, never N+1.

import { supabase } from '../supabase.js'
import { normalizeTitle, validateDraft } from '../../domain/tasks/task.js'

/**
 * @typedef {'open' | 'done'} TaskStatus
 */

/**
 * @typedef {object} RawTaskRow
 * @property {string} id
 * @property {string} created_by
 * @property {string} assigned_to
 * @property {string} title
 * @property {string | null} due_at
 * @property {TaskStatus} status
 * @property {string} created_at
 * @property {string | null} completed_at
 */

/**
 * @typedef {import('../../domain/tasks/task.js').Task} Task
 */

/**
 * @typedef {object} RawTaskProfileRow
 * @property {string} id
 * @property {string | null} username
 * @property {string | null} display_name
 */

const USER_ERRORS = new Set([
  'Give the task a title.',
  'You cannot assign a task to yourself.',
  'Only an active bandmate can be assigned a task.',
])

/**
 * @param {Error & { code?: string }} error
 * @returns {never}
 */
function handleError(error) {
  if (USER_ERRORS.has(error?.message)) throw error
  // 42501 is the RLS refusal: the assignee is not an active bandmate, or the caller is not
  // the creator. The user-facing sentence names the one cause the form can produce.
  if (error?.code === '42501') throw new Error('Only an active bandmate can be assigned a task.')
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
    handleError(/** @type {Error & { code?: string }} */ (e))
  }
}

/**
 * @param {RawTaskRow} row
 * @param {{ username: string, displayName: string } | null} counterpart
 * @returns {Task}
 */
function normalizeTask(row, counterpart) {
  return {
    id: row.id,
    createdBy: row.created_by,
    assignedTo: row.assigned_to,
    title: row.title,
    dueAt: row.due_at,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    ...(counterpart ? { counterpart } : {}),
  }
}

/**
 * Every task the caller is a party to — assigned to them or assigned by them. RLS returns
 * exactly that set; there is no client-side filter to keep in sync with it.
 * @param {string} userId
 * @returns {Promise<Task[]>}
 */
export function listTasks(userId) {
  return withErrorMapping(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, created_by, assigned_to, title, due_at, status, created_at, completed_at')
      .or(`created_by.eq.${userId},assigned_to.eq.${userId}`)
      .order('created_at', { ascending: false })
    if (error) throw error

    const rows = /** @type {RawTaskRow[]} */ (data || [])
    if (rows.length === 0) return []

    const counterpartIds = [
      ...new Set(rows.map((row) => (row.assigned_to === userId ? row.created_by : row.assigned_to))),
    ]
    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .in('id', counterpartIds)
    if (profileError) throw profileError

    /** @type {Map<string, RawTaskProfileRow>} */
    const byId = new Map((/** @type {RawTaskProfileRow[]} */ (profileRows || [])).map((p) => [p.id, p]))

    return rows.map((row) => {
      const profile = byId.get(row.assigned_to === userId ? row.created_by : row.assigned_to)
      return normalizeTask(
        row,
        profile
          ? { username: profile.username ?? '', displayName: profile.display_name ?? '' }
          : null,
      )
    })
  })
}

/**
 * Assign a task. The draft is validated client-side for a readable message; 0052's policy is
 * still the authority on whether the pair may be assigned at all.
 * @param {{ createdBy: string, assignedTo: string, title: unknown, dueAt?: string | null }} input
 * @returns {Promise<Task>}
 */
export function createTask({ createdBy, assignedTo, title, dueAt = null }) {
  const normalized = normalizeTitle(title)
  const draftError = validateDraft({ title: normalized, assignedTo, createdBy })
  if (draftError) return Promise.reject(new Error(draftError))

  return withErrorMapping(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        created_by: createdBy,
        assigned_to: assignedTo,
        title: normalized,
        due_at: dueAt || null,
      })
      .select('id, created_by, assigned_to, title, due_at, status, created_at, completed_at')
      .single()
    if (error) throw error
    return normalizeTask(/** @type {RawTaskRow} */ (data), null)
  })
}

/**
 * Mark a task done or reopen it. Only the assignee may do this (0052
 * `tasks_update_assignee`); the column grant limits the write to status/completed_at, so this
 * function sends exactly those two columns.
 * @param {string} taskId
 * @param {TaskStatus} status
 * @returns {Promise<Task>}
 */
export function setTaskStatus(taskId, status) {
  return withErrorMapping(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status,
        completed_at: status === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', taskId)
      .select('id, created_by, assigned_to, title, due_at, status, created_at, completed_at')
      .single()
    if (error) throw error
    return normalizeTask(/** @type {RawTaskRow} */ (data), null)
  })
}

/**
 * Withdraw a task. Only the creator may do this (0052 `tasks_delete_creator`).
 * @param {string} taskId
 * @returns {Promise<void>}
 */
export function deleteTask(taskId) {
  return withErrorMapping(async () => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) throw error
  })
}
