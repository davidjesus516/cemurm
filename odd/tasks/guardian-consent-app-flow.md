# guardian-consent-app-flow — give the guardian's emailed link somewhere to land

**Feature:** close the last hole in the Hito 4 minor-consent handshake. Migration `0031` ships
`public.confirm_guardian_consent_by_token(p_user_id uuid, p_revocation_token uuid)`, granted to
`anon`, and the edge function in #202 emails the guardian a one-shot confirm link. **No page and
no route call that RPC.** The link is a dead end.
**Branch:** `feat/guardian-consent-app-flow`, branched from `origin/feat/guardian-email` (#202) and
merged with `origin/feat/guardian-consent-db` (#201), so both halves of the handshake are present.
**Repo-relative locator:** `odd/tasks/guardian-consent-app-flow.md` · Engram mirror topic
`odd/guardian-consent-app-flow/tasks`.

## Objective

A guardian who opens the emailed link can confirm the consent, with no account and no session. The
minor's account unlocks on its own the next time the gate reads the ledger.

## Problem / why

Verified on this branch, not inherited from a document:

| Fact | Evidence |
|---|---|
| The RPC exists and is `anon`-granted | `0031_guardian_consent_email.sql:264-270`, grant at `:349` |
| The email carries the link | `supabase/functions/send-guardian-consent/index.ts:219` |
| Nothing calls it | no `/guardian/confirm` route in `src/app/router.jsx`; no confirm export in `src/data/repositories/minors.js` |
| The account stays locked meanwhile | `AuthGuards.jsx` admits app routes only on `consent?.status === 'active'` |

The consequence is the one F-1 named: a minor can open a request, the app sends the mail, and then
**nothing can ever move the row from `pending` to `active`.** The lock screen has no exit. The
half of the handshake that #201 already fixed is the half the minor drives; this work unit is the
half the guardian drives.

## The exact contract, quoted not paraphrased

The page must match the URL the email already contains, so this is not a design choice:

    const confirmUrl = `${siteUrl}/guardian/confirm?user=${encodeURIComponent(userId)}&token=${capability}`

— `send-guardian-consent/index.ts:219`, where `capability = encodeURIComponent(consent.revocation_token)`.

Two further obligations are written into the code this work unit must honour:

1. **Strip the token immediately.** The same file states both pages "read it from the URL and
   immediately strip it with `history.replaceState` so the token does not survive in the address
   bar, a bookmark, or a Referer header" (`:216-218`).
2. **One message for every failure.** `private.confirm_guardian_consent_core` raises the single
   string `'Consent not found or already finalized.'` for a wrong token, an unknown account, an
   already-confirmed consent, a revoked one and a no-longer-minor account alike, "so the endpoint
   cannot be used to find out whether a token, an account or a consent exists" (`0031:252-258`).
   The page must not turn that into distinguishable states.

## Scope

### In scope

- [ ] **T1** `minors.js`: `confirmGuardianConsent({ userId, token })` calling the 0031 RPC. Must map
      the failure to one non-enumerating user-facing message.
- [ ] **T2** `src/features/auth/pages/GuardianConfirm.jsx`: read `user` + `token` from the query
      string, capture both into component state, then `history.replaceState` to strip them. A
      deliberate confirm action (this flips a supervision record, so no one-click auto-submit).
- **T3** `src/app/router.jsx`: the `/guardian/confirm` route, **outside** `RequireAuth` and
      **outside** `RequireGuardianConsent` — a guardian has no session, so either guard would
      redirect them to `/auth` and the link would dead-end again.

### Out of scope, and why

- **`/guardian/revoke` — blocked on a decision, see below.** Not built in this unit.
- Anything touching `approvePublicSharing` / the 0020 sharing capability. That is PR #194's
  territory and a different decision (F-2). This unit adds functions and a route; it renames
  nothing and rewrites no existing behaviour.
- SQL. No migration is needed for T1-T3: the RPC and its `anon` grant already shipped in 0031.

## The revoke defect, recorded not fixed

`private.revoke_guardian_consent(p_user_id uuid, p_guardian_email text, p_revocation_token uuid)`
uses the **guardian email as part of the witness**: `where user_id = … and guardian_email = … and
revocation_token = … and status = 'active'` (`0017:368-374`). Its own comment says "the token is the
secret, the email is the witness."

The emailed revoke link is `${siteUrl}/guardian/revoke?user=…&token=…` — **no email**. So the page
the email points at cannot call the function the email is adjacent to.

Three further pieces of evidence, all verified in this repo, settle which side is right:

1. **`0017` is already on `main`.** Its witness is not a proposal awaiting a decision; it is
   shipped, and its comment states the rule the whole design rests on.
2. **A local branch, `feat/guardian-routes` (commit `7ed2133`, pre-M0a tree, no PR), already
   implements the revoke page against `0017` unchanged.** Its shared `src/lib/guardianLink.js`
   documents `email` as "the WITNESS that 0017's revoke requires alongside the token", and
   `GuardianRevoke.jsx` calls `public.revoke_guardian_consent` with `guardianEmail` read from the
   query string. So the page contract is already written, and it expects the parameter the email
   never sends.
3. **That branch's edge function is byte-identical to `feat/guardian-email`'s.** Neither emits
   `&email=`. The defect is in the producer, and it has been in the producer from the start.

So there is no fork to escalate. The edge function must emit `&email=` in the revoke URL; the RPC
stays exactly as `0017` wrote it; the page reads and scrubs the parameter like any other. Option B
would require a migration that contradicts a design already merged, to work around a one-line
omission in the function that sends the mail. The cost of A is real but bounded and already
mitigated by the immediate scrub, and the PII exposure is the witness value `0017` already
considers necessary for a login-less revoke.

`0032` is free, and stays free — no branch, local or remote, and no open PR contains a `0032*`
migration. (PR #228's body states `0032` is taken by `0032_overlay_access_token.sql`; that file
does not exist anywhere in this repository, on any branch, so #228 renumbered to `0033` for a
number nobody is using.)

## Constraints

- JSX, not TSX. Tailwind only. `PascalCase.jsx`, `camelCase` utilities. No CSS modules, no inline styles.
- No new dependency. No `src/store/`, no Zustand — React state only.
- English artifacts. No AI attribution on commits.
- **Never echo the token** into the page body, a log, an error string, or an analytics call.
- Do not distinguish failure modes in user-visible copy (see obligation 2 above).
- Do not modify `GuardianConsentRequired.jsx` or `AuthGuards.jsx` — #201 owns them, and its gate
  already re-reads the ledger, so an activated consent unlocks the app with no change here.

## Acceptance criteria

1. A signed-out guardian opening `/guardian/confirm?user=…&token=…` reaches the page — it is not
   redirected to `/auth`.
2. The address bar no longer contains the token once the page has captured it.
3. A valid token flips the row to `active`; the minor's next ledger read unlocks the app.
4. A wrong, reused, revoked or no-longer-minor token produces **one** message, indistinguishable
   across all four cases.
5. `pnpm lint` 0 · `pnpm typecheck` 0 · `pnpm build` green · `pnpm test` green.

## Verification

Run at this unit's head, in this worktree:

    pnpm lint && pnpm typecheck && pnpm test && pnpm build

**Not covered, and must not be claimed as covered:**

- `pnpm test` gives **zero** coverage for this work. The characterization suite guards
  `src/domain/**` and `src/integrations/spotify.js` only. Nothing here is under test.
- No browser run, no real session, no real email, no `supabase db reset`, no smoke SQL. F-7 in
  `odd/tasks/minor-compliance-debt-plan.md` owns the real-key proof.
- The `anon` grant is asserted from migration text, not from a live PostgREST call.

## Progress

- T1 pending · T2 pending · T3 pending

## Next step

Implement T1-T3, run the gates, push, open the PR against `feat/guardian-email`.
