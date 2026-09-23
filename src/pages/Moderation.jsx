// Community moderation page (Hito 4 — community-moderation).
// System-appointed moderators (and system_admins, who alone resolve
// ESCALATED cases — 0020) review reports on public-library entries and
// decide keep/remove/escalate. Org admins do NOT get these powers (BDD:
// "Org admins do not get community moderation powers") — the page gates on
// system-level role status via `useModeration`.
// Every OTHER signed-in user gets their OWN cases here instead (issue #151):
// the contributor read path (RLS moderation_cases_select_contributor) makes
// a removal reachable so the appeal form can be used end to end.
// Decisions are online-only (BDD: "Moderation decisions are online-only").

import { useModeration } from '../hooks/useModeration.js'
import ModerationQueue from '../components/moderation/ModerationQueue.jsx'
import MyCases from '../components/moderation/MyCases.jsx'

export default function Moderation() {
  const {
    isMod,
    isSystemAdmin,
    queue,
    myCases,
    loading,
    error,
    deciding,
    appealing,
    decideCase,
    appealCase,
    refresh,
  } = useModeration()

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-cem-text">Moderation</h1>
        <p className="mt-3 text-sm text-cem-secondary">Loading moderation…</p>
      </div>
    )
  }

  const isReviewer = isMod || isSystemAdmin

  if (!isReviewer) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-cem-text">My moderation cases</h1>
          <button
            type="button"
            onClick={refresh}
            className="rounded-md border border-cem-elevated px-3 py-1.5 text-sm font-medium text-cem-text hover:bg-cem-elevated"
          >
            Refresh
          </button>
        </div>
        <p className="mt-1 text-sm text-cem-secondary">
          Decisions on your own contributions to the public library. You can
          appeal a removal from here; reporter identities stay confidential.
          The moderation queue itself is limited to system-appointed moderators.
        </p>

        <div className="mt-4">
          <MyCases
            cases={myCases}
            loading={false}
            error={error}
            onAppeal={appealCase}
            appealing={appealing}
          />
        </div>
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
        Reports on public-library entries, grouped per entry — including open
        appeals and cases escalated to system admins. Decisions are final
        except through the appeal flow.
      </p>

      <div className="mt-4">
        <ModerationQueue
          queue={queue}
          loading={false}
          error={error}
          onDecide={decideCase}
          deciding={deciding}
          isMod={isMod}
          isSystemAdmin={isSystemAdmin}
          onAppeal={appealCase}
          appealing={appealing}
        />
      </div>
    </div>
  )
}
