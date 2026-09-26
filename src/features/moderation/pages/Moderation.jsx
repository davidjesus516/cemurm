// Community moderation page (Hito 4 — community-moderation).
// System-appointed moderators review reports on public-library entries and
// decide keep/remove/escalate. Org admins do NOT get these powers (BDD:
// "Org admins do not get community moderation powers") — the page gates on
// system-level moderator status via `useModeration`.
// Decisions are online-only (BDD: "Moderation decisions are online-only").

import { useModeration } from '../../../hooks/shared/useModeration.js'
import ModerationQueue from '../components/ModerationQueue.jsx'

export default function Moderation() {
  const {
    isMod,
    queue,
    loading,
    error,
    deciding,
    decideCase,
    refresh,
  } = useModeration()

  if (!isMod && !loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-cem-text">Moderation</h1>
        <p className="mt-3 rounded-md bg-cem-elevated px-3 py-2 text-sm text-cem-secondary">
          Only system-appointed community moderators can access the moderation queue.
          Organization admins manage only their own organization&apos;s repertoire.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-cem-text">Moderation</h1>
        <button
          type="button"
          onClick={refresh}
          className="rounded-md border border-cem-elevated px-3 py-1.5 text-sm font-medium text-cem-text hover:bg-cem-elevated"
        >
          Refresh
        </button>
      </div>
      <p className="mt-1 text-sm text-cem-secondary">
        Reports on public-library entries, grouped per entry. Decisions are final
        except through the appeal flow.
      </p>

      <div className="mt-4">
        <ModerationQueue
          queue={queue}
          loading={loading}
          error={error}
          onDecide={decideCase}
          deciding={deciding}
        />
      </div>
    </div>
  )
}