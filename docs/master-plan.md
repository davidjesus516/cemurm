# Master Plan — CEMURM

> Authoritative sequencing for everything not yet on `main`. Written 2026-09-27 against
> verified git state at `main` = `8b66394`. Supersedes the Hito 5 / Hito 6 status claims in
> `docs/mvp-scope.md`, which are stale (see §0).
>
> Convention: ~400 changed lines per PR, chained `-prN-` slices. Larger work ships split, or
> with a written `size:exception` (precedent: `odd/tasks/hito5-substitutions-and-coverage.md:4`).

## 0. State of play — verified, not read from prose

Prose in this repo has drifted. These are the facts, checked against git and code:

| Fact | Value |
|---|---|
| `main` | `8b66394`, in sync with `origin/main` |
| **Test files on `main`** | **7** |
| **`test` script on `main`** | **present** — `package.json` has `build`, `check:visual`, `dev`, `lint`, `preview`, `test`, `test:watch`, `typecheck` |
| **CI on `main`** | `install --frozen-lockfile → lint → check:visual-contract.sh → test → build` |
| `src/` layout on `main` | post-relocation: `app/`, `components/`, `data/`, `domain/`, `features/`, `hooks/`, `integrations/`, `lib/`, `offline/`, `ui/`. `src/components/` holds only `projection/SlideView.jsx`, which has no importers |
| Feature files | **45**, 713 scenarios |
| Migrations on `main` | 27 files, `0001`–`0020`, then a gap at `0021` only, then `0022`–`0028` |
| Hito 5 merged | 6 migrations + PRs #147, #148, #155, #156, #159, #165, #166 |

**`docs/mvp-scope.md` was wrong on Hito 5.** It stated "Nothing from Hito 5 is merged to
main yet" and "Migrations 0021+ exist only on those branches", and repeated both in its
Milestone Summary and Progress Log. Six Hito 5 migrations and seven PRs are on `main`.
**Corrected on `fix/stale-docs`** (2026-09-29), in the Hito 5 status line, a new Progress Log
row for the six merged migrations, and the "Planned vs. implemented" Hito 5 bullet. The
unmerged plan-freeze chain is still described as unmerged.

## 1. 🔴 The blocker: `main` has no regression net

> **RESOLVED.** This section described the state at `8b66394`. The net now exists: `main` carries
> 7 test files and 235 passing tests, and CI runs them. The reasoning below is kept because it
> explains why the plan was ordered this way, and because the atomicity failure it identifies is
> the same rule the project now enforces on every PR.
>
> Original framing, at the time: "There is no test runner and no test file on `main`. CI runs lint
> and build, so a behaviour regression passes green and merges."

This inverts the priority of everything else. Until a net exists:

- the 12 unmerged Hito 5 commits ship blind;
- the ten spec findings can be "fixed" with no way to prove the fix changed only what it should;
- the refactor work on `feat/cemurm-brand-landing-pr1b-boundary-refactors` has no proof of
  faithfulness on `main` at all.

**Consequence:** PR 1a must land before PR 1b-0 — the characterization tests import from
`src/domain/**` and `src/integrations/**`, paths that only exist after the relocation. There
is no way to take the tests without the moves.

### P0 — the net (2 PRs, from the existing branch) — **LANDED**

| Slice | Content | Diff | Risk | Outcome |
|---|---|---|---|---|
| **M0a** | PR 1a: relocate 111 modules into the ADR 0002 boundaries. Import paths only. | 111 files, renames | **None** — bundle verified byte-identical | Landed |
| **M0b** | PR 1b-0: Vitest 3.2.7 + characterization tests + `test` script + CI test step | 7 test files | **None** — no production code | Landed — **235 tests** |

Both are on `main` today. The bundle is `ae14521` (M0a) and `e267b97` + `e9d41c3` (M0b).

The original plan projected **293** characterization tests; the suite that landed has **235** across
7 files. Treat 235 as the current count.

**Note:** the intermediate PR that carried these commits, #168, was **closed without merging** on
2026-09-27; the work reached `main` by a different route. Any reference to "#168 open" below is
historical.

> Vitest is pinned to **3.2.7** deliberately: Vitest 5 declares `vite ^6.4||^7||^8` as a peer
> and fails hard against Vite 5.4.21. Do not "upgrade Vitest" without moving Vite first.

## 2. P1 — finish Hito 5 (12 commits, 4 branches, ~3266 lines)

All four branches exist, are pushed, and are unmerged. Verified after `git fetch --prune`:

| Branch | Commits | Diff | Migration |
|---|---|---|---|
| `feat/hito5-in-app-feedback` | 4 | 7 files, +447 | **`0020`** |
| `feat/hito5-external-display` | 2 | 6 files, +570 | — |
| `feat/hito5-plan-freeze` | 3 | 5 files, +844 | **`0021`** |
| `feat/hito5-congregation-projection` | 3 | 9 files, +1405 | **`0022`** |

### ⚠️ Migration numbering: one real collision, and the rest is fine

**The 0020–0022 gap is not deliberate.** No ADR or decision record reserves those numbers.
It is a numbering race between parallel branches, each of which picked the next number from
whatever `main` looked like when it forked: `0020_feedback` (in-app-feedback),
`0021_plan_freeze`, `0022_projection`. An earlier version of this plan called the gap
"deliberate — do not renumber"; that was an inference from the missing files, and it was
wrong.

**Verified: only `0020` actually collides.** Two different files claim it —
`0020_review_batch1.sql` on `fix/hito4-review-batch1` and `0020_feedback.sql` on
`feat/hito5-in-app-feedback`.

`0021` and `0022` are **correctly positioned and can merge unchanged**:

| Migration | Touches | Depends on 0023–0028? |
|---|---|---|
| `0020_feedback` | nothing from that range | no |
| `0021_plan_freeze` | `setlist_items`, `service_change_log` (both ≤0019) | no |
| `0022_projection` | `chart_files`, `song_versions` (0001), `service_change_log` (0019) | no |

Renumbering them to `0029+` would be **wrong**: it would run them *after* `0023`–`0028`,
which is the opposite of the order they were authored for. In filename order they land at
`0019 → 0021 → 0022 → 0023`, exactly where they were written.

**Resolution for `0020`:** one of the two renumbers. Give `0020` to
`0020_review_batch1.sql` — it carries the security fixes and should land first — and rename
the feedback migration, which is safe because it references nothing from
`0023`–`0028`. This depends on the `fix/hito4-review-batch1` decision (§5): if that branch is
never merged, `0020` is free and no renumber is needed at all.

**Superseded 2026-09-28: the feedback migration is `0033_feedback.sql`, not `0029_feedback.sql`.**
`0029` turned out to be claimed by a *second* unrelated change — the guardian branch family carries
a contiguous `0029_fail_closed_minors.sql` / `0030_date_of_birth_step.sql` /
`0031_guardian_consent_email.sql` run. `supabase db reset` executes migrations in **filename
order**, so two files sharing a version prefix have an arbitrary relative order, and the migration
ledger is keyed on that version. It moved again to `0033` because the feedback migration is
standalone, whereas renumbering inside a three-file run is the more invasive move; `0032` is taken by
`0032_overlay_access_token.sql`. Recorded as item 8 in `docs/engineering-review-backlog.md`.

### 🔴 `0019:184` IS a chain-breaker — an earlier revision of this plan was wrong

**Correction, 2026-09-27.** This section previously said the fix was unnecessary and withdrew
it. **That conclusion was wrong, and the reason it was wrong is worth recording.**

The check that produced it grepped only `0023`–`0028` and the feature branches. It never looked
at `0002`–`0018`. Two migrations create the same function with a plain `create function`:

```
0018_service_planning.sql:344   create function private.display_name_for(...)
0019_rehearsal_workflow.sql:184 create function private.display_name_for(...)
```

A fresh chain applies `0018`, creates the function, reaches `0019` and aborts:

```
ERROR:  function "display_name_for" already exists with same argument types
```

Verified both ways on a clean database:

| Chain | Result |
|---|---|
| `main` migrations only | ❌ aborts at `0019` |
| with #172's `d31888b` (`create or replace`) | ✅ `0001`–`0028`, 0 errors |

**`#172` is therefore a hard prerequisite for any slice that adds a migration**, and for any
fresh `db reset` on `main` as it stands. `0021_plan_freeze` (#179) is stacked on it for that
reason. The `1ee9615` patch on `feat/hito5-in-app-feedback` guards the same line and is a no-op
once #172 lands.

**The lesson:** a negative finding ("there is no duplicate") is only as good as the range that
was searched. Grepping the recently-added files and concluding the older ones were clean is how
a real chain-breaker survives review.

### 🔴 A hand-rolled reset that drops only `public` leaves `profiles` empty

Discovered while verifying #179. It breaks login-dependent behaviour with **no error anywhere**.

`public.profiles` rows are created by the `0006` trigger `on_auth_user_created`, which fires on
`INSERT` into `auth.users`. The seed inserts users with `on conflict do nothing` and then
`UPDATE`s their profiles. So:

1. `drop schema public cascade` — profiles gone, `auth.users` untouched
2. re-apply the chain — the trigger exists again
3. `seed.sql` — `insert … on conflict do nothing` is a **no-op** because the users are still
   there, so **the trigger never fires**
4. the seed's `update profiles set display_name = …` matches zero rows, silently

Result: `public.profiles` has **0 rows** while `auth.users` has 5. Every name resolves through
`private.display_name_for` to the `'Unknown'` fallback. In #179 this surfaced as smoke `T7`
failing with `published_by_name = 'Unknown'` instead of `'Demo User'` — a failure that looked
like a migration defect and was not one.

**Correct order** if you must reset without the Supabase CLI:

```sql
-- 1. drop and recreate
drop schema if exists private cascade;
drop schema public cascade;
create schema public;
grant all on schema public to postgres, anon, authenticated, service_role;
delete from supabase_migrations.schema_migrations;
-- 2. THEN clear the users — in this order, or the delete fails on FKs from songs
delete from auth.users;
-- 3. re-apply every migration in filename order
-- 4. seed.sql
```

`supabase db reset` does all of this correctly, which is why the bug only appears when the reset
is hand-rolled. `docs/local-dev.md` should say so explicitly.

### Slicing

| Slice | Branch | Content | ~Lines |
|---|---|---|---|
| M1a | in-app-feedback | feedback data layer + offline replay (no table) | ~200 |
| M1b | in-app-feedback | renumbered migration + form modal + header entry | ~250 |
| M1c | external-display | display channel, shared clean view, popup page + route | ~300 |
| M1d | external-display | stage-mode menu, preview, reconnect + restart recovery | ~270 |
| M2a | plan-freeze | freeze RPC wrappers (no table) | ~250 |
| M2b | plan-freeze | renumbered migration + freeze into versions | ~300 |
| M2c | plan-freeze | publish UI, changed flags, snapshot member view, version history | ~300 |
| M3a | projection | operator console + congregation display + slide deck | ~450 ⚠ |
| M3b | projection | start projection from service detail | ~150 |
| M3c | projection | renumbered migration + license gate, typo-fix, block audit | ~800 ⚠ split again |

⚠ M3a and M3c exceed the convention. M3c's migration plus audit logic should be two commits.
Options: split further, or record a written `size:exception` as the repo has done before.

### ⚠️ The dependency claim in `docs/mvp-scope.md` does not hold

The doc says `congregation-projection` "rides on the external-display surface". Not verified,
and the evidence points the other way: `features/external-display.feature:44` contains a
scenario titled *"External display vs congregation projection are separate targets"*, and the
external-display surface is absent from the tree (no `Display.jsx` / `Projector.jsx` under
`src/pages/`). The only cross-reference in code is a prose comment in `OverlayView.jsx:8`.

**Treat the four branches as independent until proven otherwise**, and confirm by reading the
projection branch's imports before sequencing M3 after M1c/M1d. If they really are separate
targets, the doc is wrong and should say so.

### Also unmerged, and not in this plan

`fix/hito4-review-batch1` — 9 commits including a **songs-metadata RLS leak fix**
(`main:0016_org_repertoire_model.sql:125` uses `org_id is null` unguarded, so every
authenticated user can read every other user's personal repertoire metadata). It needs its
own decision, separate from this plan. See §5.

## 3. P2 — the ten spec findings

Five reproduced (A–E), six reported and pending triage (F–J). All ten still hold on `main`;
verified per file:line. Full detail in `odd/tasks/cemurm-brand-landing.md` §14.

`odd/tasks/music-theory-discrepancies.md` is the working record. One change proposal exists
(`openspec/changes/fix-parser-sectional-key/`, finding A); B through J have none.

Each finding is one behaviour change against one Gherkin scenario — already atomic, and each
needs its own PR. Three of them hide a **product decision** that no amount of reading resolves:

- **B** — when does a flat win? Key's own spelling, circle-of-fifths canonical, or
  caller-supplied preference. Changes what `transposeKey` means at every call site.
- **D** — what is the tie-break rule, and where is it stored? The Gherkin requires the applied
  rule be persisted "so every device reaches the same result", so this implies a **schema
  change** *and* an undefined rule. This is the determinism claim the product is sold on.
- **E** — what is the correct degree-quality algorithm? The code reads consecutive scale steps
  as a triad's root/third/fifth; stacking real thirds is a different computation.

The other seven (A, C, F, G, H, I, J) are mechanical against a written scenario and can be
scheduled immediately once the net exists.

> The suite **pins the buggy behaviour deliberately** — `parser.test.js:86` reads
> `it('sectionKeyContexts is ALWAYS empty, even for a chart that modulates')` with
> `// FINDING (behaviour, do not "fix")`, and `transpose.test.js:44` asserts flat keys are
> unreachable. Fixing a finding therefore *inverts* that assertion. That is the deliverable.
> Editing an assertion to make a gate pass without changing behaviour is forbidden
> (AGENTS.md, delivery workflow clause 3).

## 4. P3 — Hito 6: 99 scenarios, 0 shipped

`docs/mvp-scope.md` marks Hito 6 "not started". Verified: no implementation exists for any of
its six features.

| Feature | Scenarios | Note |
|---|---|---|
| `analytics-and-insights` | 23 | none |
| `export-and-sharing` | 23 | ~1 of 23 — OnSong/ChordPro only; no PDF, MusicXML, ABC, QR or share channels |
| `cross-organization-event-collaboration` | 16 | largest design lift: depends on org model + service planning + shared-setlist collab + repertoire ownership |
| `user-onboarding` | 16 | none |
| `account-data-export-and-erasure` | 11 | none |
| `offboarding-cascade` | 10 | none |

Plus the non-BDD deliverables in `mvp-scope.md:254-261`: Lighthouse > 90, WCAG 2.1 AA, UI
polish, bug-fix sprint, beta docs, error boundaries, analytics.

Sequence by dependency, not by scenario count: `offboarding-cascade` and
`account-data-export-and-erasure` are privacy obligations and are the natural first slice
regardless of size. `export-and-sharing` extends work Hito 5 already landed. `cross-org` goes
last — it depends on four other surfaces being stable.

## 5. Doc rot to repair (cheap, do it alongside)

| File | Defect |
|---|---|
| `docs/mvp-scope.md:217,301,309-310` | claims nothing from Hito 5 is merged; six migrations and seven PRs are on `main` |
| `docs/mvp-scope.md:82,84` | the execution-trio / projection-rides-on-display dependency is unverified and probably wrong |
| `AGENTS.md` methodology table | says 45 `.feature` files; there are **42** |
| `AGENTS.md` test paragraph | says the `node` environment comes "via the existing `vite.config.js`"; `vite.config.js` has no `test` block, so `node` is Vitest's default, not configured |
| `openspec/config.yaml` | declares "NO test framework, NO typecheck, NO CI"; `test_command`/`test_framework` empty; `rules.design` points at the pre-relocation layout |
| `CONTRIBUTING.md` | says `npm install`, `npm run lint`, and a `src/store/` Zustand layer that does not exist |
| `odd/tasks/hito4-remaining.md` | 42 unchecked boxes; its own per-feature headers say COMPLETE. Superseded umbrella — **not** backlog |
| `docs/local-dev.md:29` | "two confirmed users"; the seed creates three |
| `odd/tasks/cemurm-brand-landing.md` §14.2 | reuses the letter **E** for a different finding than §14.1's E. Fix the lettering before anyone triages by letter |
| `feat/hito5-*` branches | **no ODD record exists** for plan-freeze, external-display, in-app-feedback or congregation-projection. Create one per slice as it merges |

## 5b. PR 1b: known defects to fix before it is re-cut

PR 1b (`59c1c1f`) is **not** in the sequence above, because it carries problems beyond the
acceptance-gate deviation documented in PR #168. All three were found during review, not by
the suite.

1. **The clock injection degrades silently.** Refactors 5 and 6 removed the implicit default:
   `relativeTime(iso, now)` and `isLockStale(lock, now)`. Neither validates. Called without
   `now`, `isLockStale` returns `false`, and `relativeTime` falls through to its last branch
   and returns a `YYYY-MM-DD` date for every row. No throw, no warning — just wrong output. A
   required parameter that silently yields a plausible answer is the same class of defect as
   the dead code this cycle exists to remove.
2. **ADR 0002 rule 2 is false.** `src/features/stage/pages/Overlay.jsx:11` and
   `src/features/stage/hooks/useFootPedal.js:2` import `supabase` from outside `data/`. The ADR
   asserts a boundary the code does not hold. It is currently logged as known violations with
   a destination, which is the right handling — but an ADR that claims more than is true is the
   same failure as the orphaned `design-system.md`.
3. **The refactor list skipped `applyLock`** at `collab.js:91`, which reads `Date.now()`
   internally. That is inconsistent with refactors 5 and 6, which injected the clock precisely
   to remove that read. Left as-is it is a flake source in the one module whose determinism the
   product claims.

## 6. Order, and why

```
M0a  relocation (renames, bundle identical)      ← unblocks everything
M0b  characterization suite + CI test step        ← the net; gates all of §2–§4
M1   renumber migrations 0020/0021/0022 → 0029+  ← blocker, do before any Hito 5 merge
M2   finish Hito 5, 10 slices                    ← already built, cheapest real product value
M3   findings A–J, 10 PRs                        ← now provable against the suite
M4   Hito 6, sliced by feature                   ← 99 scenarios from zero, the long pole
M5   doc repairs, alongside each slice above
```

Two things deliberately do **not** go in this plan:

- **The landing / brand cycle** (`feat/cemurm-brand-landing-pr1b-boundary-refactors`, PR #168).
  It is marketing surface, and it is currently one 9-commit PR. The refactor slices inside it
  (M0a, M0b, plus PR 1b) are worth keeping and land as their own PRs; the brand and landing
  work is deferred and should be re-planned against this state.
- **`fix/hito4-review-batch1`.** Nine unmerged commits, several of them security fixes, one of
  them a real metadata leak. That is its own decision with its own urgency, and merging it is
  not a formality.
