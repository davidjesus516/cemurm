# Account data export and erasure — the N2 privacy obligation

- **Change:** N2 unit 3 of Hito 6 (privacy slice). Migrations from `0042`.
- **Branch:** `feat/account-export-pr1-rpc` (from `main` = `8f01f57`); further slices stack
  onto it, one branch per slice.
- **Delivery:** `ask-on-risk`, resolved 2026-10-22 → **`stacked-to-main`**. Forecast ≈ 2400
  authored lines → chained PRs required (6 slices, each ≤ 400 lines). Each slice branches
  from the previous one and targets `main`, merged in order.
- **TDD:** off (`openspec/config.yaml:13`, `strict_tdd: false`). This unit is predominantly
  SQL behaviour, so its honest verification is the smoke script run against a fresh
  `supabase db reset`. New client-side behaviour does get tests written first.
- **RDD:** on (global). Native review must NOT be started on this runtime (OpenCode V2 — the
  Review Execution Contract forbids it). Substitute in place of a receipt: the writer's raw
  smoke output plus a parent re-run of the same command. A substitute, not a receipt.

## Objective

Ship the two privacy obligations of `features/account-data-export-and-erasure.feature`:
a full, portable, re-importable export of one user's data, and an irreversible erasure that
runs after a cancellable 30-day grace period while the organisation keeps its content with
attribution stripped.

## Problem / why

The feature has **11 scenarios and zero implementation** (verified 2026-10-22: no source file
references erasure, account export, or a deletion request). Hito 6's six features were all
marked "none" in `docs/master-plan.md:517-524`; `offboarding-cascade` and
`account-data-export-and-erasure` are the two the plan calls **obligations, not features**
(`docs/master-plan.md:545-547`), and they sequence first.

The hard part is not the export. It is that **the schema has no notion of account deletion.**
Authoritative introspection of the live schema (2026-10-22) found **51 foreign-key columns
across 44 public tables referencing `auth.users`**:

| `ON DELETE` | Columns | Consequence |
|---|---|---|
| `CASCADE` | 22 | delete themselves with the user |
| `NO ACTION` | 30 | **block the delete outright** |
| of those, `NOT NULL` | 17 | cannot even be nulled without `DROP NOT NULL` |
| `RESTRICT` | 0 | — |

`DELETE FROM auth.users` therefore fails. Every surviving `NO ACTION` row must be handled
explicitly before the user row can go. Two further constraints make a naive delete wrong:

- `setlist_items.song_id` and `collection_songs.song_id` are `ON DELETE RESTRICT`, so a user's
  songs cannot be deleted while any setlist or collection references them — and `:64` requires
  the org to **keep** its songs and setlists.
- `private.withdraw_public_song` (`0012:93`) is bound to `auth.uid()` and raises on any other
  caller. The 30-day job runs from `pg_cron`, where there is **no JWT and no `auth.uid()`**.

## Decisions (accepted, with rationale)

- **D1 — anonymise in place, then delete the auth user.** `:49-50` requires the account and
  personal data to be "permanently removed" and the login to stop working; `:64-65` requires
  the org to keep its songs/setlists/history with "author attribution to me stripped". Those
  two clauses together rule out both a plain delete (blocked by 30 FKs) and a plain
  anonymise (the login would survive). So: strip attribution, delete personal-only rows,
  purge storage and local cache, then delete `auth.users` — which cascades the remaining 22.
- **D2 — re-import scope is the core working set, with an importer.** Maintainer decision
  2026-10-22. Songs, versions, charts, setlists and items, annotations and preferences
  round-trip. Notifications, practice history, audit logs and moderation records ship in the
  bundle as a **read-only archive with no importer** — they have no meaningful re-import
  semantics, and inventing one would be dead code.
- **D3 — `NULL` means "no attributable author", not a tombstone user.** The repo already
  speaks this idiom: `songs.created_by` is nullable today and `songs.org_id IS NULL` already
  means "org/system level" (`0001:73`). A tombstone row inside `auth.users` would violate
  GoTrue's internal contract and leak a fake user into member lists. So surviving rows get
  `NULL` attribution, which needs `ALTER COLUMN ... DROP NOT NULL` on the `NOT NULL`
  survivors.
- **D4 — `pg_cron` is the scheduler substrate.** Verified 2026-10-22 on this stack:
  `pg_cron` is preloaded (`shared_preload_libraries` includes it) and `create extension
  pg_cron` succeeds. It is in-repo and versionable, unlike a dashboard-configured scheduler.
  The job is idempotent and claims rows with `FOR UPDATE SKIP LOCKED` so two runs cannot
  double-erase.
- **D5 — the erasure core never touches `auth.uid()`.** It takes `p_user uuid` and runs
  `security definer` with `set search_path = ''`. Rationale: `pg_cron` invokes it with no JWT.
  Any helper that needs `auth.uid()` is called from the *request* RPC, not from the core.
- **D6 — the withdrawal mechanics stay owned by the community suite.** `:69-70` says so
  explicitly. `private.withdraw_public_song` is refactored into a `p_user`-parameterised core
  (`private.withdraw_public_song_for(p_user, p_public_song_id)`) plus the existing
  `auth.uid()` wrapper, so the erasure core calls the same code rather than re-implementing it.
- **D7 — the bundle is a ZIP with the JSON and a readable summary.** `:14` asks for "a JSON
  file and a readable summary", `:29`/`:75` for one thing you hand back. No zip dependency
  exists today; the slice adds `fflate` (≈8 kB, zero transitive deps, tree-shakeable) rather
  than hand-rolling a store-method ZIP writer with its own CRC32.
- **D8 — storage is purged through the Storage API, not by deleting `storage.objects`.**
  Deleting the rows directly orphans the blobs in the filesystem. The `charts` bucket is
  private with owner-folder RLS, so the purge needs the service role — an edge function.
- **D9 — the local cache and pending offline writes are cleared on the client.** `:60`. The
  IndexedDB layer and the offline queue are named in `src/offline/`; erasure is not complete
  until the device forgets too, which the database cannot do.

## Scope (authorised)

`features/account-data-export-and-erasure.feature`, all 11 scenarios.

**Out of scope:** the setlist handoff of `offboarding-cascade:53` (a separate N2 unit); the
`export-and-sharing` formats of N3; analytics; anything on the native track (OD-1–OD-3 and
SC-1 are still open and this feature does not touch them).

## Slices

Each slice is one PR, ≤ 400 authored lines, with its own verification.

- **WU1 — export RPC.** `0042_account_export.sql`: `public.export_account_data()` returning a
  versioned `jsonb` envelope covering every user-attributable record. Plus
  `scripts/smoke/0042-account-export.sql`. Covers `:15-:24` at the server boundary.
- **WU2 — export bundle client.** Pure serializer + ZIP assembly + download, and the
  settings surface. Covers `:10-:14`, `:25-:28`.
- **WU3 — erasure request, grace period and scheduler.** `0043_account_erasure.sql`:
  `account_erasure_requests`, `request_account_erasure()`, `cancel_account_erasure()`,
  the `DROP NOT NULL` set, `private.erase_account_core(p_user)`, the `pg_cron` job, the
  storage-purge function. Plus smoke. Covers `:35-:45`, `:56-:70`.
- **WU4 — erasure UI.** The irreversible-action warning, the confirmation, and the cancel
  path. Covers `:37-:44`.
- **WU5 — re-import.** Importer for the core working set (D2). Covers `:29`, `:75`.
- **WU6 — docs.** New `openspec/specs/account-data/spec.md` capability, the feature-file
  status, and this record's closure.

## Tasks

- [x] T1 Branch from `main` + this record (before the first write)
- [x] T2 WU1 — migration `0042_account_export.sql` + smoke (export envelope, server side)
- [ ] T3 WU2 — client serializer, ZIP assembly, repository, settings surface + tests
- [ ] T4 WU3 — migration `0043_account_erasure.sql` + smoke (request, grace, core, cron, purge)
- [ ] T5 WU4 — erasure UI (warning, confirm, cancel) + tests
- [ ] T6 WU5 — re-import for the core working set + tests
- [ ] T7 WU6 — `openspec/specs/account-data/spec.md`, feature status, closure
- [ ] T8 Verify each slice: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`, plus the
      smoke on a fresh `supabase db reset` for every SQL slice

## Acceptance criteria

From the feature, scenario by scenario:

- `:10` — settings offers "Export my data"; it produces a bundle.
- `:14` — the bundle holds a JSON file and a readable summary of the same data.
- `:18-19` — every song, version and chart the user authored is included, plus the version
  change history with dates and editors.
- `:23-24` — comments, annotations, collections, practice history, performance records and
  notification preferences are included.
- `:28` — the JSON documents every included record in a standard, self-describing form.
- `:29`, `:75` — a bundle can be re-imported into a fresh account (core working set, D2).
- `:37-40` — "Delete my account permanently" warns that it is permanent, schedules deletion
  for 30 days, and still allows an export meanwhile.
- `:43-45` — cancelling inside the grace period retains everything and no job runs.
- `:48-50` — after 30 days the deletion runs, the data is gone and the login fails.
- `:59-60` — personal annotations, practice sessions and notification preferences are gone;
  the local cache and pending offline writes are cleared.
- `:64-65` — the org keeps its songs, setlists and history; attribution to the user is stripped.
- `:69-70` — public contributions are withdrawn through the community suite's own mechanics.
- `:73-74` — an export taken during the grace period stays readable on the device.

## Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | 30 `NO ACTION` FKs block `DELETE FROM auth.users`; 17 are `NOT NULL` | Explicit `DROP NOT NULL` migration for the survivors; the smoke asserts a real `auth.users` delete succeeds |
| R2 | `ON DELETE RESTRICT` on `setlist_items.song_id` / `collection_songs.song_id` | Songs are never deleted on erasure — attribution is stripped (D1/D3) |
| R3 | Dropping `NOT NULL` on `setlists.owner_id` changes assumptions in `transfer_setlist_ownership`, RLS policies and the UI | Grep every consumer; NULL must fail closed in RLS and render as "Unknown author" in UI |
| R4 | `pg_cron` runs without a JWT | D5: the core takes `p_user`; no `auth.uid()` in the erasure path |
| R5 | A cron run that dies halfway leaves a partially erased account | The whole core runs in one transaction; the request row carries state, and a repeat run is idempotent |
| R6 | Storage blobs orphaned if rows are deleted directly | D8: purge through the Storage API |
| R7 | `fflate` is a new runtime dependency | Declared in the PR body with its size cost; the alternative (hand-rolled ZIP) is named, not hidden |

## Progress

- 2026-10-22 — record created before the first write. Reconnaissance findings: 51 FK columns
  across 44 tables (22 CASCADE / 30 NO ACTION / 17 NOT NULL / 0 RESTRICT); `pg_cron` verified
  available and preloaded; `private.withdraw_public_song` verified `auth.uid()`-bound;
  `charts` bucket private, currently empty; no zip dependency in `package.json`.
  Maintainer decision D2 recorded: core working set, with importer.
- 2026-10-22 — delivery resolved by the maintainer: `stacked-to-main`. Branch
  `feat/account-data-export-and-erasure` renamed to `feat/account-export-pr1-rpc`, and the
  slice-1 writer started on it.
- 2026-10-22 — **WU1 landed.** `supabase/migrations/0042_account_export.sql` (314 lines) adds
  `public.export_account_data()` — `jsonb`, no args, `security definer`, `set search_path = ''`,
  `raise exception 'Not authenticated.'` when `auth.uid()` is null (the phrasing 0013 already
  uses). The envelope pins all 18 top-level keys the slice brief named, with every array
  coalesced to `'[]'` and every object to `'{}'`, so an empty account still returns a
  well-formed, self-describing document. Grants follow the 0002:33-42 convention:
  `revoke ... from public, anon` then `grant ... to authenticated`.
  `scripts/smoke/0042-account-export.sql` (404 lines, 23 assertions) verifies it on a fresh
  reset.
  **Empirically confirmed the brief's hazard #2, and it is the whole reason the smoke's
  assertion 10 exists:** with `security definer`, a probe returned `count(*) from songs = 10`
  while the same session as `authenticated` would have seen only its own 9 — RLS does not
  apply inside the function, so every `where ... = v_uid` is load-bearing. The smoke therefore
  builds a second user (Beto) with rows of every kind Ana has, so the anti-leak assertion
  excludes real rows rather than passing vacuously over empty tables.
  **One real defect found and fixed by the smoke, not by review:** `now()::text` renders
  `2026-10-22 22:16:16.69+00` — a SPACE separator, which is not ISO-8601 and not what the
  later importer should have to parse. The migration now uses
  `to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`, and assertion 20
  pins it. This is the kind of thing the smoke tier exists to catch.
  Verified, in order, all green: `supabase db reset` (0042 applies clean),
  smoke `23 PASS / 0 FAIL`, `pnpm lint` (clean), `pnpm typecheck` (clean),
  `pnpm test` (18 files / 415 tests passed), `pnpm build` (built in 6.36s).
  **Budget deviation, reported honestly:** 718 authored lines across both files against the
  ≤400 target. The envelope legitimately spans ~20 tables and the fixtures must create a
  second user's rows for the anti-leak assertion to be non-vacuous; trimming further would
  mean deleting either coverage or the rationale a reviewer needs. The header comment is
  already condensed to the non-obvious (the definer/RLS evidence, the two attribution
  hazards, D2/D3) — where the parent wants to cut 300 lines, the honest option is to split
  the smoke's fixture block into a shared SQL include, not to weaken an assertion.
