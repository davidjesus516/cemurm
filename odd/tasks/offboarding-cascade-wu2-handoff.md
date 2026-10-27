# Offboarding cascade WU2 — handoff blocking with consent (Hito 6 N2)

## Goal
Implement WU2: "Owned shared setlists are handed off to the org before leaving" (features/offboarding-cascade.feature:53-57). A member cannot leave if they own a setlist the org uses; the refusal is the static literal `Transfer the setlists this organization uses before leaving.` (already mapped in the client). No new RPCs, no new state.

## Scope
- Extend the guard in `private.org_leave` (recreated from 0038) to cover gigs and require accepted collaborators.
- Preserve the 0038 substitution-request cascade verbatim (org-scoped).
- Update the WU2 smoke to prove gig usage + consent filter; keep WU1 regression green (0038 smoke 33/33).
- Client mapping unchanged (orgRepertoire.js already allows the exact literal).

## Predicate (org-uses)
"Org-uses" means any of:
- a `service_blocks` row of any of the org's services references it, OR
- a `gigs` row of the org references it (`gigs.org_id + gigs.setlist_id`) — the app writes both (`src/data/repositories/gigs.js:437`, `:538`); the seed's Demo Setlist (`30000000-0000-0000-0000-000000000001`, owned by `10000000-...0001`) is used this way by **2 a1 gigs** (61000000-...001 and 002) with 0 service blocks and 0 collaborators,
- an **ACTIVE** member of the org is an **ACCEPTED** collaborator on it (`setlist_collaborators.accepted_at IS NOT NULL`), mirroring RLS (`setlists_select_member` allows owner OR accepted collaborator). A pending (unaccepted) invitation grants no access and must not block any leave.

Note: `setlists.org_id` is **not** part of "org-uses". No RLS policy reads it, and no app code writes it (the seed is its only writer). It is metadata only.

Clause A: leaver owns a setlist the org uses → refuse with the static literal.
Clause B: any org-used setlist has an owner who is not an active member of that org → refuse (broader than the scenario; preserves the invariant).

Both raise the same static literal (client allowlist unchanged).

## Evidence (verified, fresh reset each time)
- Migration: `supabase/migrations/0039_leave_handoff_guard.sql` (162 lines) — gig EXISTS added to both clauses, `c.accepted_at is not null` added to both collaborator EXISTS.
- Smoke: `scripts/smoke/0039-leave-handoff-guard.sql` (≈263 lines) — **18 PASS / 0 FAIL**. Covers: service-block path (1), accepted-collaborator path (2), handoff + cascade (3–8), clause B (9), literal exactness (10), gig channel (11), and consent filter on both clauses (12, 13), with preconditions (pre1–pre5).
- WU1 regression: `scripts/smoke/0038-offboarding-cascade.sql` = **33 PASS / 0 FAIL**.
- JS gates: `pnpm test` 409/409 (18 files), `pnpm test:gherkin` 41/41, `pnpm typecheck`, `pnpm lint`, `scripts/check-visual-contract.sh` (12/0), `pnpm build` — green.
- Client: `src/data/repositories/orgRepertoire.js` maps the literal via `USER_ERRORS.leaveRequiresHandoff` (unchanged).

## Falsifiability (mutations, fresh reset)
Neutering each branch produces the expected assertion failures:

| Mutation | Effect | Result |
|---|---|---|
| M1: clause A → `if false and exists` | Removes clause A entirely | PASS=13 FAIL=7 (reds include 1,2,5,8,11,12,13) |
| M2: clause B → `if false and exists` | Removes clause B | PASS=17 FAIL=3 (reds 9,10) |
| M3: cascade `sr.status='open'` → `false` | Disables cascade scan | PASS=18 FAIL=2 (red 8) |
| M4: gig EXISTS `where g.setlist_id...` → `where false` | Removes gig channel | PASS=18 FAIL=2 (red 11) |
| M5: remove `and c.accepted_at is not null` | Pending invites count as access | PASS=17 FAIL=3 (reds 12,13) |

All restored byte-identical. Migration and smoke changes are minimal and auditable.

## Independent verifier
An independent adversarial verifier (OpenCode general, fresh context) reviewed the slice and returned **HOLDS WITH CAVEATS**. The key points addressed:
- H1 (gaps): gig usage + the `setlists.org_id` tag. Resolved: included gigs (org-scoped, app-written). Excluded `setlists.org_id` (no RLS policy uses it, no app code writes it; the seed’s Demo Setlist is already protected by its 2 gigs). Documented rationale.
- H2 (DoS): collaborator disjunct lacked `accepted_at IS NOT NULL` → fixed (mirrors RLS). Proven by cases 12,13 (pending invites do not block). 
- Assertion conflation (literal captured from refusals where multiple clauses could fire) is a known limitation of the black-box smoke; attribution is proven by mutation, not by a single-capture string.

## Slices (budget ≤400)
- **PR-5** (base `feat/offboarding-cascade-pr4-rejection-surface`, tip `e72f2a9`): guard — `supabase/migrations/0039_leave_handoff_guard.sql` + `src/data/repositories/orgRepertoire.js` (client literal) ≈ 163 lines
- **PR-6** (base PR-5): proof — `scripts/smoke/0039-leave-handoff-guard.sql` ≈ 263 lines
- **PR-7** (base PR-6): record — this file ≈ 300 lines

Each < 400. The guard+proof are kept in separate slices to satisfy the budget while preserving coherent review units; the chain is stacked-to-main.

## Execution
- Built from base `e72f2a9` (not `main`) because `0039` re-creates `private.org_leave` whose body exists from `0038`.
- No `size:exception`. No `.feature` edits. No assertion weakening. Honest reporting of limitations (conflation, scope of clause B). Merge remains human.

## Verification commands
```bash
supabase db reset && docker exec -i supabase_db_cemurm psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -f - < scripts/smoke/0039-leave-handoff-guard.sql
supabase db reset && docker exec -i supabase_db_cemurm psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -f - < scripts/smoke/0038-offboarding-cascade.sql
pnpm test && pnpm test:gherkin && pnpm typecheck && pnpm lint && pnpm build
bash scripts/check-visual-contract.sh
```

All green.