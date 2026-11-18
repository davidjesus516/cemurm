# F1 — Membership Admin (execution record)

Branch: `feat/f1-pr1-migration` (stacked: PR2 → PR3 → PR4).
Delivery: chained `-prN-` slices. Test runner: Vitest, plus a manual SQL smoke.
Scope source: `features/organization-members.feature` (F1).

> This record was deleted from PR1 by `38ba51f` to hold that PR inside the
> 400-line budget, with the message "task record moves to the final slice". No
> commit re-added it, so rebasing PR2→PR4 onto the fixed PR1 would have dropped
> the record from every tip. This version is scoped to the migration fix and its
> smoke; the PR3/PR4 page work remains to be recorded on the final slice.

## Commits

| SHA | Unit |
|---|---|
| `d898995` | migration `0021_identity_account_lifecycle.sql` + record (initial slice) |
| `19bbc70` | doc counts 44 → 45 |
| `e3fbd00` | `org_admin` may change/remove; status `removed` |
| `c8400b8` | declare `v_is_admin`; revert status to `former` |
| `38ba51f` | drop the record so PR1 fits the 400-line budget |
| `77cc9f3` | smoke `0021-identity-account-lifecycle.sql` + smoke counts 22 → 23 |

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

## Open decisions (not taken)

1. **Size.** PR1 alone is 355 authored lines; the smoke adds 227, so PR1+smoke
   is 584 and `check-pr-size.mjs` blocks it. The smoke is a clean standalone
   slice at 227 lines, stacked on PR1 — that keeps both under budget without
   splitting the atomic migration and without a `size:exception`.
2. **The `0021`/`0022` reservation.** `0021` is consumed by this branch while
   `AGENTS.md:186`, `AGENTS.md:223`, `docs/master-plan.md:119` and
   `docs/master-plan.md:120` still call it free by design.
   `scripts/check-doc-counts.sh` hardcodes the skip in `next_free`, so the gate
   stays green and hides it. Not changed here: the policy is the maintainer's.

## Findings outside this slice

- PR2's `src/data/repositories/orgMembers.js` `USER_ERRORS` still lists
  `'only org_owner can change member roles'` and `'only org_owner can remove
  members'`. `e3fbd00` replaced both with `'not authorized'`, which the set also
  contains, so the mapping still surfaces the real error — the two entries are
  dead, not broken.
- Smoke filenames do not track migration numbers, and this one now happens to
  match its migration. That is a coincidence, not a new convention.
