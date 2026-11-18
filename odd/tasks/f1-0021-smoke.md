# F1 `0021` — membership smoke and doc-count gate (execution record)

Branch: `test/f1-0021-smoke`, stacked on PR1 (#523, `feat/f1-pr1-migration`).
Delivery: chained `-prN-` slices. Manual SQL smoke; this unit ships no JS.
Scope source: `features/organization-members.feature` (F1).

> **This is not the F1 feature record.** `odd/tasks/f1-membership-admin.md` is,
> and the final slice owns it — PR4, #532 at `3b7be32`. This branch once added
> that same path with different content, which is an add/add conflict the moment
> either PR merges. The maintainer's decision (2026-11-17) was that **PR4 keeps
> the feature record**, so this file is scoped to what this unit actually ships
> — the verification of the migration fix and its smoke — under a name no other
> slice claims. The PR3/PR4 page work stays in PR4's record.

## Commits

| SHA | Unit |
|---|---|
| `d898995` | migration `0021_identity_account_lifecycle.sql` (PR1) |
| `19bbc70` | doc counts 44 → 45 |
| `e3fbd00` | `org_admin` may change/remove; status `removed` |
| `c8400b8` | declare `v_is_admin`; revert status to `former` |
| `38ba51f` | drop the feature record so PR1 fits the 400-line budget |
| `77cc9f3` | smoke `0021-identity-account-lifecycle.sql` + smoke counts 22 → 23 |
| `a1e1027` | `check-doc-counts.sh`: report the real next free slot, `0022` |

## The migration did not apply

`e3fbd00` used `v_is_admin` in `private.change_member_role_core` and
`private.remove_org_member_core` and declared it in neither DECLARE block. The
whole chain was RED, and PR #523 was its only proof because
`.github/workflows/e2e.yml` triggers on `pull_request` targeting `main` only —
PR2/PR3/PR4 never run E2E.

RED, reproduced locally by restoring `e3fbd00`'s file and running
`supabase db reset` (exit 1):

```
Applying migration 0021_identity_account_lifecycle.sql...
ERROR: "v_is_admin" is not a known variable (SQLSTATE 42601)
At statement: 13
-- ───────────── 5.2 change_member_role_core ─────────────
```

GREEN after `c8400b8` (`v_is_admin boolean;` at lines 167 and 238):
`supabase db reset` exit 0, 45 migrations applied, `0021` present in
`supabase_migrations.schema_migrations`.

## Why the status reverted to `former`

`member_status` is `enum('active','former','pending')` (`0001_init.sql:25`), so
`'removed'` is not a synonym, it is unrepresentable. `0016:450` (`org_leave`)
already writes `'former'`, and the BDD says `"former"` at
`features/organization-members.feature:72,77,103`. `e3fbd00` introduced
`'removed'` against all three; `c8400b8` is therefore a correctness fix, not a
wording preference.

## The smoke

`scripts/smoke/0021-identity-account-lifecycle.sql`, 16 assertions, run once
after `supabase db reset` (not idempotent):

- `org_admin` re-roles member → instructor → branch_admin → member.
- `org_admin` removes instructor, branch_admin and member; each lands as
  `status = 'former'` with `left_at` set — the assertion that would have caught
  `'removed'`.
- Neither `org_admin` touches an `org_owner`: `cannot modify org_owner`,
  `cannot remove org_owner`.
- A caller with no membership is refused with `not authorized`, and writes no
  audit row.

Observed: **16 PASS / 0 FAIL**. No smoke covered `0021` before this; the file
named `0021-plan-freeze.sql` covers `0034` and is unrelated.

## Decisions

1. **Size — stacked slice, no `size:exception`.** PR1 alone is 355 changed
   lines; this slice adds 382 more (225 smoke + 110 record + 24 `AGENTS.md` +
   16 `master-plan.md` + 7 gate script), so folded together they are 733 and
   `check-pr-size.mjs` would block the PR — measured, not estimated:
   `--base origin/main` reports 733 and exits 1. Shipped as its own slice
   **stacked on PR1**, at 382: both stay under the 400 budget, the atomic
   migration is not split, and no label is needed. (An earlier revision said the
   smoke adds 227; that was the smoke file before the record and the doc fix
   joined the slice.)
2. **`0021`/`0022` — the gate told the truth again.** `0021` is consumed by
   this branch while `AGENTS.md` and `docs/master-plan.md` still called
   `0021`/`0022` a deliberate free gap, and `scripts/check-doc-counts.sh`
   hardcoded both as skipped in `next_free` — the gate stayed green *because*
   it agreed with the stale prose. Fixed here with the maintainer's decision
   (2026-11-17): `next_free` lost both special cases, so it now reports the
   genuine lowest unclaimed slot, **`0022`**, and the docs say `0022` too.
   Verified with a temporary `0022_probe.sql`: the gate reported `0047` and
   exit 1, then exit 0 again once the probe was deleted.

## Findings outside this slice

- PR2's `src/data/repositories/orgMembers.js` `USER_ERRORS` still lists
  `'only org_owner can change member roles'` and `'only org_owner can remove
  members'`. `e3fbd00` replaced both with `'not authorized'`, which the set also
  contains, so the mapping still surfaces the real error — the two entries are
  dead, not broken.
- Smoke filenames do not track migration numbers, and this one now happens to
  match its migration. That is a coincidence, not a new convention.
3. **The record's home — PR4, not here.** PR4 (`3b7be32`) re-added
   `odd/tasks/f1-membership-admin.md`, so this branch's copy of that path was an
   add/add conflict waiting for whichever PR merged second. The maintainer's
   call: **PR4 keeps the feature record.** This slice therefore ships
   `odd/tasks/f1-0021-smoke.md` instead — no shared path, no conflict, and the
   ODD discipline still holds for this unit.
