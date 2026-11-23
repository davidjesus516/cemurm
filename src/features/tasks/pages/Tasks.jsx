/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../app/providers/useAuth.jsx'
import { listBandmates } from '../../../data/repositories/bandmates.js'
import {
  createTask,
  deleteTask,
  listTasks,
  setTaskStatus,
} from '../../../data/repositories/tasks.js'
import { isOverdue, partitionTasks, validateDraft } from '../../../domain/tasks/task.js'

// Tier 1 (form, empty states, dialogs) on the Bandmates page's language: one amber CTA,
// `cem.surface` cards, no material. The list half is tier 2 and carries no extra depth.
const inputClass =
  'w-full rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-hidden focus:ring-2 focus:ring-cem-amber focus:ring-offset-2 focus:ring-offset-transparent'
const primaryBtn =
  'rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60'
const ghostBtn =
  'rounded-md border border-cem-elevated px-3 py-1.5 text-xs font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60'
const dangerBtn =
  'rounded-md border border-cem-elevated px-3 py-1.5 text-xs font-medium text-cem-secondary-elevated hover:bg-cem-elevated disabled:opacity-60'

/** `due_at` is a DATE. Parsing it with a time attached keeps it on the same calendar day. */
function formatDue(dueAt) {
  if (!dueAt) return null
  return new Date(`${dueAt}T00:00:00`).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function TaskRow({ task, userId, busy, onDone, onReopen, onWithdraw }) {
  const isAssignee = task.assignedTo === userId
  const late = isOverdue(task)
  const counterpart = task.counterpart?.displayName || task.counterpart?.username

  return (
    <li className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className={`text-sm ${task.status === 'done' ? 'text-cem-secondary line-through' : 'text-cem-text'}`}>
          {task.title}
        </p>
        <p className="mt-0.5 text-xs text-cem-secondary">
          {isAssignee ? `From ${counterpart || 'a bandmate'}` : `For ${counterpart || 'a bandmate'}`}
          {task.dueAt && (
            <>
              {' · '}
              <span className={late ? 'font-medium text-cem-text' : undefined}>
                Due {formatDue(task.dueAt)}{late ? ' — overdue' : ''}
              </span>
            </>
          )}
          {task.status === 'done' && ' · Done'}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {isAssignee && task.status === 'open' && (
          <button type="button" onClick={() => onDone(task)} disabled={busy} className={primaryBtn}>
            Done
          </button>
        )}
        {isAssignee && task.status === 'done' && (
          <button type="button" onClick={() => onReopen(task)} disabled={busy} className={ghostBtn}>
            Reopen
          </button>
        )}
        {!isAssignee && (
          <button type="button" onClick={() => onWithdraw(task)} disabled={busy} className={dangerBtn}>
            Withdraw
          </button>
        )}
      </div>
    </li>
  )
}

function TaskSection({ title, emptyText, items, render }) {
  return (
    <>
      <h2 className="mt-8 text-lg font-semibold text-cem-text">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-cem-secondary">{emptyText}</p>
      ) : (
        <ul className="mt-2 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-xs">
          {items.map(render)}
        </ul>
      )}
    </>
  )
}

export default function Tasks() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [bandmates, setBandmates] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: '', assignedTo: '', dueAt: '' })

  const refresh = useCallback(async () => {
    if (!user) return
    try {
      const [list, links] = await Promise.all([listTasks(user.id), listBandmates(user.id)])
      setTasks(list)
      setBandmates(links.filter((link) => link.status === 'active'))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    const draftError = validateDraft({ ...form, createdBy: user.id })
    if (draftError) {
      setError(draftError)
      return
    }
    setSaving(true)
    try {
      await createTask({
        createdBy: user.id,
        assignedTo: form.assignedTo,
        title: form.title,
        dueAt: form.dueAt || null,
      })
      setForm({ title: '', assignedTo: '', dueAt: '' })
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function run(task, action) {
    setError('')
    setBusyId(task.id)
    try {
      await action()
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId('')
    }
  }

  if (!user) return null

  const { assignedToMe, assignedByMe } = partitionTasks(tasks, user.id)
  const options = bandmates.map((link) => ({
    id: link.userId,
    label: link.profile?.displayName || link.profile?.username || 'Bandmate',
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-cem-text">Tasks</h1>

      {error && (
        <p className="mt-3 rounded-md border border-cem-elevated bg-cem-elevated px-3 py-2 text-sm text-cem-text">{error}</p>
      )}

      <form onSubmit={handleCreate} className="mt-4 flex flex-wrap items-start gap-2">
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="What needs doing?"
          aria-label="Task title"
          maxLength={200}
          className={`${inputClass} max-w-md`}
        />
        <select
          value={form.assignedTo}
          onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
          aria-label="Assign to"
          className={`${inputClass} max-w-56`}
        >
          <option value="">Assign to…</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
        <input
          type="date"
          value={form.dueAt}
          onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
          aria-label="Due date"
          className={`${inputClass} max-w-44`}
        />
        <button type="submit" disabled={saving} className={primaryBtn}>
          {saving ? 'Assigning…' : 'Assign'}
        </button>
      </form>

      {options.length === 0 && !loading && (
        <p className="mt-3 text-sm text-cem-secondary">
          Add a bandmate before assigning work — only active bandmates can be assigned tasks.
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-cem-secondary">Loading tasks…</p>
      ) : (
        <>
          <TaskSection
            title="Assigned to me"
            emptyText="Nothing assigned to you."
            items={assignedToMe}
            render={(task) => (
              <TaskRow
                key={task.id}
                task={task}
                userId={user.id}
                busy={busyId === task.id}
                onDone={(t) => run(t, () => setTaskStatus(t.id, 'done'))}
                onReopen={(t) => run(t, () => setTaskStatus(t.id, 'open'))}
                onWithdraw={(t) => run(t, () => deleteTask(t.id))}
              />
            )}
          />

          <TaskSection
            title="Assigned by me"
            emptyText="You have not assigned any tasks."
            items={assignedByMe}
            render={(task) => (
              <TaskRow
                key={task.id}
                task={task}
                userId={user.id}
                busy={busyId === task.id}
                onDone={(t) => run(t, () => setTaskStatus(t.id, 'done'))}
                onReopen={(t) => run(t, () => setTaskStatus(t.id, 'open'))}
                onWithdraw={(t) => run(t, () => deleteTask(t.id))}
              />
            )}
          />
        </>
      )}
    </div>
  )
}
