import { describe, expect, it } from 'vitest'

import {
  TASK_TITLE_MAX_LENGTH,
  isOverdue,
  normalizeTitle,
  partitionTasks,
  taskDirection,
  todayISO,
  validateDraft,
} from './task.js'

// features/assignable-tasks.feature — the rules the table (0052) and the screen share.
describe('normalizeTitle', () => {
  it('trims and collapses internal whitespace', () => {
    expect(normalizeTitle('  Book   the   room  ')).toBe('Book the room')
  })

  it('returns an empty string for anything that is not a string', () => {
    expect(normalizeTitle(null)).toBe('')
    expect(normalizeTitle(undefined)).toBe('')
    expect(normalizeTitle(42)).toBe('')
  })
})

describe('validateDraft', () => {
  const valid = { title: 'Book the room', assignedTo: 'lucia', createdBy: 'ana' }

  it('accepts a complete draft', () => {
    expect(validateDraft(valid)).toBeNull()
  })

  it('rejects an empty or whitespace-only title', () => {
    expect(validateDraft({ ...valid, title: '' })).toBe('Give the task a title.')
    expect(validateDraft({ ...valid, title: '   ' })).toBe('Give the task a title.')
    expect(validateDraft({})).toBe('Give the task a title.')
  })

  it('rejects a title longer than the column allows', () => {
    expect(validateDraft({ ...valid, title: 'x'.repeat(TASK_TITLE_MAX_LENGTH + 1) }))
      .toBe(`Keep the title under ${TASK_TITLE_MAX_LENGTH} characters.`)
    expect(validateDraft({ ...valid, title: 'x'.repeat(TASK_TITLE_MAX_LENGTH) })).toBeNull()
  })

  it('requires an assignee', () => {
    expect(validateDraft({ ...valid, assignedTo: null })).toBe('Choose a bandmate to assign this to.')
    expect(validateDraft({ ...valid, assignedTo: '' })).toBe('Choose a bandmate to assign this to.')
  })

  it('refuses assigning to yourself', () => {
    expect(validateDraft({ ...valid, assignedTo: 'ana' })).toBe('You cannot assign a task to yourself.')
  })
})

describe('todayISO', () => {
  it('pads month and day', () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(todayISO(new Date(2026, 10, 30))).toBe('2026-11-30')
  })
})

describe('isOverdue', () => {
  it('is true only when open, dated, and strictly before today', () => {
    expect(isOverdue({ status: 'open', dueAt: '2026-11-29' }, '2026-11-30')).toBe(true)
    expect(isOverdue({ status: 'open', dueAt: '2026-11-30' }, '2026-11-30')).toBe(false)
    expect(isOverdue({ status: 'open', dueAt: '2026-12-01' }, '2026-11-30')).toBe(false)
  })

  it('is false for a completed dated task and for an undated one', () => {
    expect(isOverdue({ status: 'done', dueAt: '2026-11-01' }, '2026-11-30')).toBe(false)
    expect(isOverdue({ status: 'open', dueAt: null }, '2026-11-30')).toBe(false)
    expect(isOverdue(null)).toBe(false)
  })
})

describe('taskDirection', () => {
  const task = { createdBy: 'ana', assignedTo: 'lucia' }

  it('classifies the two parties and nobody else', () => {
    expect(taskDirection(task, 'lucia')).toBe('assignedToMe')
    expect(taskDirection(task, 'ana')).toBe('assignedByMe')
    expect(taskDirection(task, 'marco')).toBeNull()
    expect(taskDirection(task, null)).toBeNull()
  })
})

describe('partitionTasks', () => {
  const t = (overrides) => ({
    id: 'id',
    createdBy: 'ana',
    assignedTo: 'lucia',
    title: 'Task',
    dueAt: null,
    status: 'open',
    createdAt: '2026-11-01T00:00:00Z',
    completedAt: null,
    ...overrides,
  })

  it('drops tasks the user is not a party to', () => {
    const { assignedToMe, assignedByMe } = partitionTasks(
      [t({ id: 'mine' }), { ...t({ id: 'theirs' }), createdBy: 'marco', assignedTo: 'pedro' }],
      'lucia',
    )
    expect(assignedToMe.map((task) => task.id)).toEqual(['mine'])
    expect(assignedByMe).toEqual([])
  })

  it('puts open tasks before done ones', () => {
    const { assignedToMe } = partitionTasks(
      [t({ id: 'done', status: 'done', completedAt: '2026-11-02T00:00:00Z' }), t({ id: 'open' })],
      'lucia',
    )
    expect(assignedToMe.map((task) => task.id)).toEqual(['open', 'done'])
  })

  it('orders open tasks by due date with undated last', () => {
    const { assignedByMe } = partitionTasks(
      [
        t({ id: 'undated' }),
        t({ id: 'later', dueAt: '2026-12-10' }),
        t({ id: 'sooner', dueAt: '2026-11-25' }),
      ],
      'ana',
    )
    expect(assignedByMe.map((task) => task.id)).toEqual(['sooner', 'later', 'undated'])
  })

  it('returns empty lists for missing input', () => {
    expect(partitionTasks(undefined, 'ana')).toEqual({ assignedToMe: [], assignedByMe: [] })
  })
})
