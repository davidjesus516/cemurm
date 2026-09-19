// Notifications feed page shell (Hito 3 PR#2, task 2.4 — notifications
// Feed3/Feed4/Feed5 + Feed1). Category tabs All / Invitations / Setlist
// Changes / Events / System (Feed5); grouped rendering with per-group unread
// counts (Feed4, via groupByCategory); relative time (Feed1, via
// relativeTime); per-row read toggle + Mark all (Feed2/Feed3 via the hook's
// optimistic markRead/markAllRead — the realtime echo converges the badge);
// empty/offline states. Events and System tabs render empty states until the
// Hito 4 emitters exist (frozen Feed5 contract). Tap routes through
// notificationTarget (deep-link navigations are fully exercised in PR#3/PR#4
// tasks); invitation action buttons are PR#3 task 3.4, comment/mention rows
// are PR#4 task 4.3 — deliberately out of this lean slice.

/* eslint-disable react/prop-types */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications.js'
import { CATEGORY_ORDER, groupByCategory } from '../lib/notifications.js'
import { relativeTime } from '../utils/relativeTime.js'

const CATEGORY_LABELS = {
  all: 'All',
  invitation: 'Invitations',
  setlist: 'Setlist Changes',
  event: 'Events',
  system: 'System',
}
const TABS = ['all', ...CATEGORY_ORDER]

const tabClass = (active) =>
  active
    ? 'rounded-md bg-cem-amber px-3 py-1.5 text-xs font-medium text-cem-base'
    : 'rounded-md border border-cem-elevated px-3 py-1.5 text-xs font-medium text-cem-text hover:bg-cem-elevated'
const primaryBtn =
  'rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60'

function EmptyState({ text }) {
  return <p className="mt-6 text-sm text-cem-secondary">{text}</p>
}

export default function Notifications() {
  const { rows, unreadCount, loading, online, markRead, markAllRead } = useNotifications()
  const [activeTab, setActiveTab] = useState('all')
  const navigate = useNavigate()

  const visibleRows = useMemo(
    () => (activeTab === 'all' ? rows : rows.filter((row) => row.category === activeTab)),
    [rows, activeTab],
  )
  const groups = useMemo(() => groupByCategory(visibleRows), [visibleRows])

  function handleRowTap(row) {
    if (!row.read) markRead(row.id)
    const target = row.target
    if (!target) return
    const params = target.params
      ? new URLSearchParams(Object.entries(target.params).filter(([, value]) => value != null)).toString()
      : ''
    navigate(params ? `${target.route}?${params}` : target.route)
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-cem-text">Notifications</h1>
        {unreadCount > 0 && (
          <button type="button" onClick={markAllRead} className={primaryBtn}>
            Mark all as read
          </button>
        )}
      </div>

      {!online && (
        <p className="mt-3 rounded-md bg-cem-elevated/50 px-3 py-2 text-xs text-cem-secondary">
          You&apos;re offline — showing cached notifications.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={tabClass(activeTab === tab)}
          >
            {CATEGORY_LABELS[tab]}
          </button>
        ))}
      </div>

      {loading && rows.length === 0 ? (
        <EmptyState text="Loading notifications…" />
      ) : groups.length === 0 ? (
        <EmptyState
          text={
            activeTab === 'all'
              ? 'You’re all caught up!'
              : `No ${CATEGORY_LABELS[activeTab].toLowerCase()} notifications yet.`
          }
        />
      ) : (
        groups.map((group) => (
          <section key={group.category} className="mt-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-cem-text">
              {CATEGORY_LABELS[group.category]}
              {group.unread > 0 && (
                <span className="rounded-full bg-cem-amber/20 px-2 py-0.5 text-xs font-medium text-cem-amber">
                  {group.unread} unread
                </span>
              )}
            </h2>
            <ul className="mt-2 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm">
              {group.rows.map((row) => (
                <li key={row.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleRowTap(row)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleRowTap(row)
                      }
                    }}
                    className="flex w-full cursor-pointer items-start justify-between gap-3 px-4 py-3 hover:bg-cem-elevated/40"
                  >
                    <div>
                      <p className="text-sm text-cem-text">{row.title}</p>
                      {row.body && <p className="mt-1 text-xs text-cem-secondary">{row.body}</p>}
                      <p className="mt-1 text-xs text-cem-secondary">{relativeTime(row.createdAt)}</p>
                    </div>
                    {row.read ? (
                      <span
                        className="mt-0.5 text-xs text-cem-secondary"
                        title="Read"
                        aria-label="Read"
                      >
                        ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          markRead(row.id)
                        }}
                        className="rounded border border-cem-elevated px-2 py-0.5 text-xs font-medium text-cem-text hover:bg-cem-elevated"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}