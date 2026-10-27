# Gig shared-to-branch read access — the last gap in `offboarding-cascade`

- **Change:** N2 unit 2 of Hito 6 (privacy slice). Migration `0041_gig_shared_read.sql`.
- **Branch:** `feat/gig-shared-read-access` (from `main` = `0b311e9`).
- **Delivery:** `ask-on-risk` (forecast ≈ 250 lines; single PR, no chain needed).
- **TDD:** off (`openspec/config.yaml:13`). This unit is SQL behaviour, so its honest
  verification is the smoke script run against a fresh `supabase db reset`.
- **RDD:** on (global). Native review must NOT be started on this runtime (OpenCode V2 —
  the Review Execution Contract forbids it). Substitute in place of a receipt: the writer's
  raw smoke output plus a parent re-run of the same command. A substitute, not a receipt.

## Objective

Close the one requirement of `offboarding-cascade` that has no implementation at all:
org/branch members keep read-only access to a completed gig and its performance record
once the owner shares it.

## Problem / why

`shared_to_branch` exists as a column (`0001_init.sql:300`), the client writes it
(`src/data/repositories/gigs.js:439`, `:540`), and **nothing reads it** — its only
appearance in `supabase/migrations/` is the column definition. Two BDD sources require
the behaviour:

- `features/gigs-and-performance-history.feature:128` — "Gig visibility follows the org
  and branch model". Its coverage is marked **deferred** in `openspec/specs/gigs/spec.md:5`
  ("deferred, org model is Hito 4"). Hito 4 landed; the deferral is now the gap.
- `features/offboarding-cascade.feature:33-37` — after Sofia leaves, "the gig and its
  performance record stay with her / And org members keep read-only access to the
  completed gig".

Current RLS is owner-only in both directions: `gigs_select_owner`, `performances_select_owner`
and `performance_items_select_owner` all chain to `gigs.owner_id = auth.uid()`. A member of
the gig's branch gets zero rows.

## Decisions (accepted, with rationale)

- **D1 — branch-scoped, not org-wide.** `:128` is explicit: Juan (Sede Madrid) sees the
  shared gig, **Pedro (Sede Lima) cannot**. Org-wide `is_org_member` would fail that
  assertion. Rule mirrors the existing `songs_select_branch` precedent
  (`0016:137-144`): `branch_id = any(private.user_branch_ids(auth.uid()))`, and
  `user_branch_ids` already returns only **active** memberships (`0002:20-24`).
- **D2 — three tables, not one.** The spec pairs "the gig **and its performance record**"
  (`:37`) with "once completed, its performance record" (`:134`). A read path that returns
  the performance row but not its items would render an empty setlist and read as a bug.
  So `gigs`, `performances` and `performance_items` all get the hop.
- **D3 — `branch_id IS NULL` fails closed.** A shared gig with no branch grants no member
  read. The scenario's sharing action names a branch target ("shares the gig to
  *Sede Madrid*"); inventing an org-wide fallback would widen access beyond the spec.
- **D4 — READ-ONLY is structural.** Only `for select` policies are added. INSERT/UPDATE/
  DELETE stay owner-only, so "read-only" is enforced by the absence of a write policy, not
  by a convention someone can forget.
- **D5 — no migration is edited in place.** `0001`/`0004`/`0016` are immutable; `0041`
  only adds policies (drop-if-exists + create), so a fresh full-chain reset and an
  already-deployed database converge.

## Scope (authorized)

- New migration `0041_gig_shared_read.sql`: three additive SELECT policies.
- New smoke `scripts/smoke/0041-gig-shared-read.sql` proving positives, every negative
  branch, and write denial.
- `openspec/specs/gigs/spec.md` coverage line: the deferral is no longer accurate.
- This record.

**Out of scope:** the client UI (it writes `shared_to_branch` already), any schema change,
`venues`, branch-level *write* access, and the remaining `offboarding-cascade` scenarios
that hold by construction (assertions for those are a separate unit).

## Tasks

- [x] T1 Branch from `main` + this record (before the first write)
- [x] T2 Migration `0041_gig_shared_read.sql` — gigs / performances / performance_items (three additive SELECT policies)
- [x] T3 Smoke `0041-gig-shared-read.sql` — fresh reset, positive + all negatives + write denial (23 assertions)
- [x] T4 Verify: run the smoke and record its raw output — writer ran it, parent re-ran it independently
- [x] T5 `openspec/specs/gigs/spec.md` — drop the deferral claim, cite the migration
- [x] T6 Work-unit commit — code in `d7d1089`; this record and the spec travel in the commit after it

## Acceptance criteria

- An active member of the gig's branch reads the completed + shared gig, its performance
  and its items.
- An active member of a **different** branch of the same org reads nothing.
- An unshared gig is invisible to members; a shared but non-completed gig is invisible too.
- A **former** member of the branch reads nothing.
- A member of another org reads nothing.
- The reader cannot UPDATE or DELETE the gig — **corrected during the write**: an UPDATE/DELETE
  whose RLS `USING` does not match filters the row out *silently* (observed `UPDATE 0` /
  `DELETE 0`, and no exception was raised even inside a plpgsql `exception when others`
  handler). SQLSTATE 42501 comes from a missing table privilege or a `WITH CHECK` violation,
  neither of which applies here. The asserted contract is therefore the row count plus row
  intactness. The original `42501` expectation in this record was wrong.
- The owner keeps UPDATE and DELETE on her own gig, and keeps reading it — and its performance
  record — after leaving the org.
- Smoke reports `expects N PASS / 0 FAIL`, 0 FAIL on a fresh `supabase db reset`.

## Progress

- 2026-10-20 — record created before the first write. Branch `feat/gig-shared-read-access`.
- 2026-10-20 — T2/T3/T4. Migration + smoke written. Writer ran `npx supabase db reset`
  (exit 0; `0041` applied in the chain) then the smoke under `ON_ERROR_STOP=1`
  (exit 0, 23 PASS / 0 FAIL, 0 ERROR). Parent re-ran both independently: same result.
  Grant evidence after the reset: `authenticated` holds SELECT/INSERT/UPDATE/DELETE on the
  three tables, `anon` holds none, and the three new policies are `polcmd = 'r'` — so
  read-only is structural, and the policies are not inert.
- 2026-10-20 — **correction.** The write-denial expectation of `42501` was wrong; see the
  acceptance criterion above. The assertions assert 0 rows affected plus row intactness.
- 2026-10-20 — the smoke's closing banner spelled the bracketed forms of PASS/FAIL, so a
  plain `grep '[FAIL]'` over the output reported 1 failure in a run that had none (observed
  while spot-checking: grep said 24 PASS / 1 FAIL, the assertions said 23 / 0). Reworded.
- 2026-10-20 — T5. `openspec/specs/gigs/spec.md`: the "deferred" coverage line is repaired and
  the capability gets a `Gig visibility follows the org and branch model` requirement section
  (clause held: the requirement notes that a former member loses the read through
  `user_branch_ids` filtering on `status = 'active'`).
- 2026-10-20 — T6. Code + smoke in `d7d1089`; this record and the spec in the commit after it.
