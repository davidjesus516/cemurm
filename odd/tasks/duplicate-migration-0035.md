# Fix duplicate migration version 0035 and guard against recurrence

## Objective

Restore `supabase db reset` / `supabase start`, which have been impossible since
2026-10-15, and make the class of defect detectable by CI instead of by a runtime
duplicate-key crash.

## Problem

`supabase/migrations/` carried two files with version prefix `0035`:

| file | introduced by |
|---|---|
| `0035_projection.sql` | `07522a0`, 2026-10-10 (`chore(migrations): renumber plan_freeze 0021→0034, projection 0022→0035`) |
| `0035_fix_migration_chain_rls.sql` | `2f06b1f`, **#376, 2026-10-15** |

`supabase_migrations.schema_migrations` is keyed by version, so the first INSERT
succeeds and the second aborts the reset:

```
Applying migration 0035_fix_migration_chain_rls.sql...
Applying migration 0035_projection.sql...
ERROR: duplicate key value violates unique constraint "schema_migrations_pkey"
Key (version)=(0035) already exists.
```

Evidence: E2E Chromium job `116973294639`, run `38901098665`.

Blast radius: `supabase db reset`, `supabase start`, the E2E suite, and all 13
`scripts/smoke/*.sql` (which mandate a fresh reset first). `main` could not be
green.

## Why it went unnoticed

The two failures are stacked. `main`'s E2E died **earlier**, at the Docker image
pull (`toomanyrequests` from `public.ecr.aws`), and never reached the migration
stage. Fixing the registry (#377) revealed the next failure. A green-looking red
job hid a second, independent break.

## Why it is not an "it was free when I looked" defence

`AGENTS.md` documents this hazard twice -- *"A number free on `main` is not free
for you"* and *"It was free when I looked was true twice and false both times"* --
and it landed anyway. Prose did not hold, which is the argument for the guard.

## Scope

- `supabase/migrations/0035_fix_migration_chain_rls.sql` →
  `0040_fix_migration_chain_rls.sql` (see "The slot I picked was already taken").
- `scripts/check-migrations-unique.sh` -- new CI gate.
- `.github/workflows/ci.yml` -- one step, immediately before the visual gate.

## The slot I picked was already taken

The first attempt renumbered this file to `0038`, chosen because `0038` was free
on `main`. It was not free. `0038` is claimed by `0038_offboarding_cascade.sql`
on `feat/offboarding-cascade-pr1-cascade` (PR #368, open, targets `main`), and
`0039` by `0039_leave_handoff_guard.sql` in the same stack. The next slot free
across **every** remote branch is `0040`:

```
0038_offboarding_cascade.sql
0039_leave_handoff_guard.sql
```

So the guard's own failure message was vindicated within the hour of writing it,
against its author. Recorded here rather than quietly corrected, because it is
the argued case for the guard existing at all.

### Why the guard does not catch this specific case

The guard scans the working tree. On a pull request that tree is GitHub's merge
ref (base + branch), so it *does* catch a branch reusing a number already present
on its base -- which is the #376/`0035` case, and the guard would have failed that
PR.

It cannot catch two *unmerged* branches independently claiming one number, which
is what happened here: `0038` was on no branch reachable from this PR's base. No
per-PR check can see that without scanning every remote branch, and scanning every
branch fails legitimate stale and superseded refs -- the repository already has a
closed `feat/hito5-in-app-feedback` still carrying a superseded `0020`. A check
that flags those gets disabled, and a disabled check protects nothing.

What the guard does give for this case is a loud failure the moment both files
reach `main`, rather than a silent break discovered later in E2E. Picking a slot
still requires the cross-branch check in `AGENTS.md`; that step is manual on
purpose, and the guard prints the exact command when it fires.

## Why moving to 0040 is safe

- The file is idempotent by design: `create or replace` / `drop policy if exists`
  throughout, and its own header states *"MIGRATIONS ARE IMMUTABLE: 0014–0019 are
  left exactly as shipped ... a fresh full-chain reset and already-deployed
  databases converge to the same state."* Re-running it under a new version is
  therefore a no-op on convergent state.
- Neither `0036` nor `0037` references anything it creates. `0036` creates the
  `approve_guardian_public_sharing*` functions; `0037` creates
  `setlist_conflict_resolutions` and `apply_setlist_item_op`; the renamed file
  only recreates `display_name_for` and four RLS policies on `songs`,
  `event_participants` and `event_setlists`. Sorting last is safe.
- Verified against the colliding chain itself: `0038_offboarding_cascade.sql`
  and `0039_leave_handoff_guard.sql` only `create or replace function`
  (`private.org_leave`, `private.assign_musician`). They *call*
  `private.display_name_for` but never define it, and they touch none of the four
  policies this file recreates (`songs_select_system`,
  `event_participants_insert_organizer`, `songs_update_source_org`,
  `event_setlists_update_organizer`). So sorting after them cannot revert their
  work -- the object sets are disjoint.
- Header comment updated to record the renumber; SQL logic untouched.

## Acceptance criteria

1. No duplicate version prefix remains in `supabase/migrations/`.
2. `supabase start` gets past the migration stage in E2E.
3. The E2E suite goes green on this branch (which also carries #377's registry
   fix, so this branch is the first place the full chain can pass).
4. The guard fails on a duplicate and passes on the real tree.

## Checks

- `bash scripts/check-migrations-unique.sh` → exit 0 on the real tree.
- Same script against a synthetic duplicate tree → exit 1, naming both files.
- Same script against a malformed filename → exit 1.
- CI `lint-and-build` runs the guard; E2E is the behavioural verdict.

## Progress

- [x] Rename `0035_fix_migration_chain_rls.sql` → `0040_fix_migration_chain_rls.sql`
- [x] Update the migration header to record the renumber
- [x] Add `scripts/check-migrations-unique.sh` (+ executable bit)
- [x] Wire it into `.github/workflows/ci.yml` before the visual gate
- [x] Verify the guard passes on the real tree and fails on a duplicate
- [x] Confirm no remote branch claims `0040`
- [ ] Push and confirm E2E passes the migration stage / goes green
- [x] Open PR #378, stacked on #377

## Deviations / notes

- Stacked on `ci/e2e-ghcr-images` (#377) deliberately: neither fix alone turns
  E2E green, because each branch carries the other's defect. This branch is the
  first place the full chain can be observed passing.
- The guard deliberately does not check for *gaps* in numbering. Gaps are legal
  (numbers get abandoned or burned); duplicates are not.
- No `size:exception` needed: ~36 lines of script plus a rename and one CI step.
- Renumbered twice (`0035` -> `0038` -> `0040`). The first target was rejected
  because `0038` was already claimed by an unmerged branch, which is the exact
  failure mode this unit exists to stop. Left in the record deliberately.
- Not added: comparing the tree against `origin/main` inside the guard. It would
  need a fetch step, and it would not have caught this case (the colliding file
  was on an unmerged branch, absent from `main`). Adding a check that cannot fail
  on the defect that motivated it is worse than no check.
