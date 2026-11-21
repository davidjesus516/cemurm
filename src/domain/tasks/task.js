// @ts-check
// Pure task rules (features/assignable-tasks.feature). No I/O, no Supabase: the repository
// maps rows, the page renders, and everything that can be wrong about a task draft or a
// task's place in a list is decided here so it can be tested without a browser.
//
// A task's `dueAt` is a DATE, not a timestamp (0052 declares `due_at date`). ISO `YYYY-MM-DD`
// strings compare correctly with `<`, including across month and year boundaries, which is why
// `isOverdue` does not build a Date at all — a Date would introduce a timezone where the
// database has none.

export const TASK_TITLE_MAX_LENGTH = 200

/** @typedef {'open' | 'done'} TaskStatus */

/**
 * @typedef {object} Task
 * @property {string} id
 * @property {string} createdBy
 * @property {string} assignedTo
 * @property {string} title
 * @property {string | null} dueAt
 * @property {TaskStatus} status
 * @property {string} createdAt
 * @property {string | null} completedAt
 * @property {{ username: string, displayName: string }} [counterpart]
 */

/**
 * Collapses runs of whitespace so "Book  the room " and "Book the room" are one title. The
 * database trims for its length check (0052 `tasks_title_length`); this also collapses the
 * middle, which the constraint deliberately does not police.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeTitle(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

/**
 * The only client-side gate on a draft; 0052 enforces the same invariants at the table so a
 * direct PostgREST call cannot skip them. Returns a user-facing message, or null when valid.
 * @param {{ title?: unknown, assignedTo?: string | null, createdBy?: string | null }} [draft]
 * @returns {string | null}
 */
export function validateDraft({ title, assignedTo, createdBy } = {}) {
  const normalized = normalizeTitle(title)
  if (!normalized) return 'Give the task a title.'
  if (normalized.length > TASK_TITLE_MAX_LENGTH) {
    return `Keep the title under ${TASK_TITLE_MAX_LENGTH} characters.`
  }
  if (!assignedTo) return 'Choose a bandmate to assign this to.'
  if (createdBy && assignedTo === createdBy) return 'You cannot assign a task to yourself.'
  return null
}

/**
 * Local calendar date as `YYYY-MM-DD`, matching the format `due_at` round-trips as.
 * @param {Date} [now]
 * @returns {string}
 */
export function todayISO(now = new Date()) {
  /** @param {number} n */
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Late means open, dated, and strictly before today. A task due TODAY is not late yet, and a
 * completed task is never late — completion clears the flag instead of preserving history.
 * @param {{ status?: TaskStatus, dueAt?: string | null } | null | undefined} task
 * @param {string} [today]
 * @returns {boolean}
 */
export function isOverdue(task, today = todayISO()) {
  return Boolean(task && task.status !== 'done' && task.dueAt && task.dueAt < today)
}

/**
 * Which side of the task the user is on, or null when they are neither party (RLS should make
 * that unreachable, but the UI must not invent a bucket if a stale row arrives).
 * @param {{ createdBy?: string, assignedTo?: string } | null | undefined} task
 * @param {string | null | undefined} userId
 * @returns {'assignedToMe' | 'assignedByMe' | null}
 */
export function taskDirection(task, userId) {
  if (!task || !userId) return null
  if (task.assignedTo === userId) return 'assignedToMe'
  if (task.createdBy === userId) return 'assignedByMe'
  return null
}

/**
 * Splits the visible tasks into the two lists the screen draws. Open tasks come before done
 * ones, then due date ascending with undated last, then creation order descending.
 * @param {Task[]} [tasks]
 * @param {string | null | undefined} [userId]
 * @returns {{ assignedToMe: Task[], assignedByMe: Task[] }}
 */
export function partitionTasks(tasks, userId) {
  /** @param {Task} a @param {Task} b */
  const byUrgency = (a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1
    const dueA = a.dueAt || '9999-12-31'
    const dueB = b.dueAt || '9999-12-31'
    if (dueA !== dueB) return dueA < dueB ? -1 : 1
    return (b.createdAt || '').localeCompare(a.createdAt || '')
  }

  const assignedToMe = []
  const assignedByMe = []
  for (const task of Array.isArray(tasks) ? tasks : []) {
    const direction = taskDirection(task, userId)
    if (direction === 'assignedToMe') assignedToMe.push(task)
    else if (direction === 'assignedByMe') assignedByMe.push(task)
  }
  return { assignedToMe: assignedToMe.sort(byUrgency), assignedByMe: assignedByMe.sort(byUrgency) }
}
