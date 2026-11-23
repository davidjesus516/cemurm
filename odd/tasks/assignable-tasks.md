# Assignable tasks — execution record

**Layer:** ODD (execution record). Product truth is `features/assignable-tasks.feature`;
the capability spec is `openspec/specs/assignable-tasks/spec.md`.

**Commit:** `1205ea1` — `feat(tasks): assign work to an active bandmate` (this branch,
`feat/assignable-tasks`).

## What shipped

One table, its permissions, and one screen.

| Layer | File | Note |
|---|---|---|
| Schema + RLS + grants | `supabase/migrations/0052_assignable_tasks.sql` | `tasks`: creator, assignee, title, optional `due_at date`, `open`/`done` |
| Manual RLS smoke | `scripts/smoke/0052-assignable-tasks.sql` | 15 assertions, both sides of every permission |
| Pure rules | `src/domain/tasks/task.js` | title normalization/validation, overdue, partitioning |
| Rules tests | `src/domain/tasks/task.test.js` | 12 cases |
| Data layer | `src/data/repositories/tasks.js` | list/create/status/delete, profile names resolved in one `in` query |
| Screen | `src/features/tasks/pages/Tasks.jsx` | create form + "Assigned to me" / "Assigned by me" |
| Route + nav | `src/app/router.jsx`, `src/app/AppLayout.jsx` | `/tasks`, Band card |

## Decisions worth knowing

- **Migration 0052, not 0047–0051.** `0047`/`0048` are claimed by open PRs #451/#460,
  and `0050`/`0051` are claimed by in-flight branches
  (`0050_onboarding_invite_redemption.sql`, `0051_onboarding_org_creation.sql`).
  `0052` is the first number free across every branch checked with
  `git branch -r | xargs -I{} git ls-tree --name-only {} -- supabase/migrations/`.
- **Permissions split across two mechanisms.** RLS cannot restrict one policy to
  particular columns, so "assignee only" is the policy's USING/WITH CHECK and "status
  only" is the column-level grant `update (status, completed_at)`. Both are required;
  each alone would allow a write the feature forbids.
- **Assignment requires an active bandmate edge, in either direction.** The existing
  `bandmate_links` relation is reused rather than introducing a second notion of team.
- **Removal freezes, it does not erase.** Existing tasks stay readable and completable
  after the bandmate edge is deleted; only new assignments between the pair are refused.
- **No offline queue.** Reads and writes are online-only in this slice; the server mints
  `id`, so an optimistic offline insert would need an id round-trip the table does not
  offer. A failed write surfaces its error instead of pretending to succeed.
- **No notes, priority, or list.** The table is exactly what the feature uses.

## Verification

Executed in an isolated worktree checked out at `origin/main` (`51b11bf`) with
`node_modules` symlinked from the repo. The lockfile is unchanged, so the symlink does
not affect what is being verified — the AGENTS.md warning about symlinked `node_modules`
concerns dependency bumps.

| Gate | Result |
|---|---|
| `pnpm test` | 37 files / 573 tests passed |
| `pnpm test:gherkin` | 5 files / 44 tests passed |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm build` | exit 0 (the pre-existing >500 kB chunk warning is unchanged) |
| `bash scripts/check-visual-contract.sh` | OK, 12 rules; rule 02 at 240/240 (no new dead accents) |
| `bash scripts/check-doc-counts.sh` | OK — 47 migrations, 24 smokes, 50 features, 797 scenarios |
| `bash scripts/check-migrations-unique.sh` | OK, 47 files |
| `node scripts/check-migrations-destructive.mjs` | OK, 0 unexcused |
| `bash scripts/check-test-integrity.sh` | OK |

**Not verified:** `scripts/smoke/0052-assignable-tasks.sql` was written but not executed —
this environment has no Supabase CLI and no Docker socket. The RLS policies have therefore
not been exercised against a live database. A reviewer with the local stack should run
`supabase db reset` first, then the command in the smoke header, and expect 15 PASS / 0 FAIL.

## Size exception

`node scripts/check-pr-size.mjs` reports 1282 authored lines against the 400 budget. The
exception is requested because the unit does not decompose into reviewable slices: the
schema alone proves nothing about the screen, the screen alone cannot be exercised without
the schema, and the pure rules are shared by both. Splitting would produce a database PR
whose permission model has no caller and a UI PR whose data layer is missing — the two
halves would have to be reviewed twice and merged in order anyway. The slice is one
capability (a task between two people) end to end.

Precedent for a written exception: `odd/tasks/hito5-substitutions-and-coverage.md:4`.
