// useActiveOrgName.js — the display name of the organisation shown in the app
// nav's user strip.
//
// WHY A HOOK AND NOT A FIELD ON `user`. `useAuth` (src/app/providers/useAuth.jsx)
// exposes only what GoTrue knows about the account. Organisation membership is
// owned by `org_memberships` and read under RLS, so the name cannot be part of
// the auth context without making every consumer depend on the org tables.
//
// THE RULE, and the reason this is not a one-liner. `getMyOrganizations()`
// (src/data/repositories/orgRepertoire.js) returns EVERY membership row,
// including history: the query filters on `user_id` alone, and `member_status`
// is an enum of 'active' | 'former' | 'pending' (migration 0001_init.sql). So
// the first row is NOT the current organisation — for a user who left one and
// joined another, it can be the one they left.
//
// Only 'active' qualifies, which is the same filter the rest of the app already
// applies: Organizations.jsx:171 and :312 both read
// `memberships.filter(m => m.status === 'active')`, and the RLS helpers in
// 0016_org_repertoire_model.sql scope every org read to
// `om.status = 'active'`. Reading it any other way here would show a name the
// rest of the product has already decided the user does not have.
//
// KNOWN LIMIT, stated rather than hidden: a user who is genuinely active in two
// organisations sees the first one the query returns, with no way to switch.
// There is no "current organisation" concept in this codebase — no column, no
// context, no route — so "the active one" is not yet selectable. The first row
// is a decision, not a model. If a switcher is ever wanted, the honest fix is a
// selected-org concept plus persistence, not a reordering here.
//
// The hook is deliberately fail-soft: a read error or a logged-out session
// resolves to an empty string, and the caller renders nothing. A nav bar is not
// the place to surface an org lookup failure.
import { useEffect, useState } from 'react'
import { getMyOrganizations } from '../../data/repositories/orgRepertoire.js'
import { useAuth } from '../../app/providers/useAuth.jsx'

/**
 * @returns {string} the active organisation's name, or '' when there is none,
 *   none is readable, or the user is signed out.
 */
export function useActiveOrgName() {
  const { user } = useAuth()
  const [orgName, setOrgName] = useState('')

  useEffect(() => {
    // Signed out: no read, and anything already resolved is cleared so a
    // sign-out does not leave the previous user's organisation on screen.
    if (!user) {
      setOrgName('')
      return undefined
    }

    let cancelled = false
    getMyOrganizations()
      .then((memberships) => {
        if (cancelled) return
        const active = (memberships || []).find(m => m.status === 'active' && m.org)
        setOrgName(active?.org?.name ?? '')
      })
      .catch(() => {
        // Fail-soft on purpose: see the file header. An unreadable org name
        // hides one label; it must not take the nav down with it.
        if (!cancelled) setOrgName('')
      })

    return () => {
      cancelled = true
    }
  }, [user])

  return orgName
}