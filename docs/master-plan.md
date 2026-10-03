# Master Plan — CEMURM

> Authoritative sequencing for everything not yet on `main`. Written 2026-09-27 against
> verified git state at `main` = `8b66394`. Supersedes the Hito 5 / Hito 6 status claims in
> `docs/mvp-scope.md`, which were stale (see §0).
>
> Convention: ~400 changed lines per PR, chained `-prN-` slices. Larger work ships split, or
> with a written `size:exception` (precedent: `odd/tasks/hito5-substitutions-and-coverage.md:4`).

## Status of this document (2026-09-30, re-verified 2026-10-02)

**Re-scoped, not archived — and the reasoning is worth stating, because the choice was not free.**

This document is *still* the sequencing authority: it is the only artifact that orders the
remaining work, and retiring it would leave nothing authoritative for Hito 6, the ten spec
findings, or the audits. So it was re-scoped to the real remaining work rather than demoted to a
historical record. But it is no longer trustworthy as a whole, because **its central premise —
four unmerged Hito 5 branches — is gone.** Every section is now labelled:

- **§0, §5, §6 — current.** Re-derived from `main` = `762a040` on 2026-09-30; re-verified
  2026-10-02 against `main` = `e849738` — no drift found in any row.
- **§1, §2, §5b — LANDED, kept for their reasoning.** The work is on `main`. The prose is preserved
  deliberately: the migration-numbering race, the `0019:184` chain-breaker and the hand-rolled
  reset bug are each a lesson that outlives the branch they were about, and this repo's own rule
  is that a superseded document is annotated, not rewritten.
- **§3, §4 — still open, and the reason to keep reading.**

The three defects this file was *written* to prevent are the reason for the labelling: it asserted
Hito 5 was unmerged long after it merged, and a planner sequencing from it would have re-planned
shipped work. Each later section below now carries the date and evidence that closed it.

## 0. State of play — verified, not read from prose

Prose in this repo has drifted. These are the facts, checked against git and code on
**2026-10-02 at `main` = `e849738`** (originally 2026-09-30 at `762a040`, re-verified after the
#236/#273/#274/#275/#276 merges):

| Fact | Value |
|---|---|
| `main` | `e849738`, in sync with `origin/main` |
| **Test files on `main`** | **9** — was 7 at `8b66394` |
| **`test` script on `main`** | **present** — `package.json` has `build`, `check:visual`, `dev`, `lint`, `preview`, `test`, `test:watch`, `typecheck` |
| **CI on `main`** | `install --frozen-lockfile → lint → check:visual-contract.sh → test → build` |
| `src/` layout on `main` | post-relocation: `app/`, `data/`, `domain/`, `features/`, `integrations/`, `offline/`, `ui/`, plus `lib/storage.js`. No `store/` — there is no Zustand |
| Feature files | **45**, 713 scenarios — was 42 / 656 at `8b66394` |
| Migrations on `main` | **33 files, `0001`–`0033`, contiguous, no gap** — was 27 with a gap at `0021` |
| Next free migration number | **`0034`**, free unconditionally |
| Hito 5 | **complete and merged.** Migrations `0021`–`0033` all on `main` |
| Hito 6 | **not started** — no implementation for any of its six features |
| `// @ts-check` opt-ins | **47** files; `tsc --listFiles` reaches **60** `src/` files |
| `docs/design-system.md` | superseded in part by `skills/cemurm-visual-system/` (PR #235, commit `5547150`); banner added in #238 |

**`docs/mvp-scope.md` was wrong on Hito 5, twice.** It first stated "Nothing from Hito 5 is merged
to main yet" and "Migrations 0021+ exist only on those branches", repeated in its Milestone Summary
and Progress Log (corrected on `fix/stale-docs`, 2026-09-29). It then *still* described the
plan-freeze chain as unmerged at PR 3/10, which was also wrong by then. Plan-freeze merged via
#192/#193, alongside congregation projection and in-app feedback. Corrected again 2026-09-30.

**🔴 One gate is red on `main` right now.** `bash scripts/check-visual-contract.sh` exits **1**
with 3 failing rules: `01b` default-palette utilities 92 vs ceiling 82; `02` dead accents 274 vs
ceiling 252; `06` one `text-cem-secondary` on a raised fill at
`src/features/auth/pages/DateOfBirthRequired.jsx:101`. Two are ceiling overflows — Hito 5 code
pushed usage past the recorded ceilings — and one is a real single-line defect. Because CI runs
this gate, **CI on `main` is red.** Verified 2026-09-30 by stashing every local edit and re-running
on a pristine checkout: the failure is pre-existing, not caused by this change. Re-verified
2026-10-02: `gh run list --branch main` shows the CI job failing on the #274, #275 and #276 merge
pushes (CodeQL green on the same pushes). It needs its own PR; nothing here may paper over it.

## 1. 🔴 The blocker: `main` has no regression net

> **RESOLVED.** This section described the state at `8b66394`. The net now exists: `main` carries
> **9 test files and 307 passing tests**, and CI runs them. The reasoning below is kept because it
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
| **M0b** | PR 1b-0: Vitest 3.2.7 + characterization tests + `test` script + CI test step | 7 test files at the time | **None** — no production code | Landed — **235 tests**, since grown to **307** across 9 files |

Both are on `main` today. The bundle is `ae14521` (M0a) and `e267b97` + `e9d41c3` (M0b).

The original plan projected **293** characterization tests; the suite that landed had **235** across
7 files. **As of `e849738` the real count is 307 across 9 files** (`pnpm test` re-run 2026-10-02,
exit 0) — treat 307 as the current count.

**Note:** the intermediate PR that carried these commits, #168, was **closed without merging** on
2026-09-27; the work reached `main` by a different route. Any reference to "#168 open" below is
historical.

> Vitest and Vite moved as a pair in #236: `main` now carries `vite` `^6.4.3` together with
> `vitest` `^5.0.2`, and the suite passed unchanged. What survives is the pairing, not the
> versions: Vitest declares Vite as a peer, so one major never moves without the other in the
> same change — and verify the bump against a worktree with its own `node_modules`, not a symlink
> to this checkout's (see `AGENTS.md`).

## 2. P1 — finish Hito 5 (12 commits, 4 branches, ~3266 lines)

> **✅ LANDED — this whole section is historical.** All four branches' work is on `main` as of
> `762a040`. The branch *refs* `origin/feat/hito5-{plan-freeze,external-display,in-app-feedback,
> congregation-projection}` still exist and are still unmerged as refs, but the work reached `main`
> by a different route; do not read their existence as pending work. What actually landed:
> plan-freeze (#192/#193), congregation projection (#181/#182/#186/#188/#189), in-app feedback
> (#190/#191/#228), and the earlier `0023`–`0028` run (#147/#148/#155/#156/#159/#165).
>
> The subsections below are kept because **the failure modes they describe are the reusable part**:
> the migration-numbering race, the `0019:184` chain-breaker, and the hand-rolled reset that
> silently empties `profiles`. Each one happened for real. Read them as post-mortems.

All four branches exist, are pushed, and are unmerged. Verified after `git fetch --prune`:

| Branch | Commits | Diff | Migration |
|---|---|---|---|
| `feat/hito5-in-app-feedback` | 4 | 7 files, +447 | **`0020`** |
| `feat/hito5-external-display` | 2 | 6 files, +570 | — |
| `feat/hito5-plan-freeze` | 3 | 5 files, +844 | **`0021`** |
| `feat/hito5-congregation-projection` | 3 | 9 files, +1405 | **`0022`** |

### ⚠️ Migration numbering: one real collision, and the rest is fine

> **RESOLVED — and the outcome is the opposite of what this section predicted.** Read this as the
> post-mortem it now is. `main` is contiguous `0001`–`0033` and the next free number is **`0034`**.
>
> - The gap closed by *landing*, not by renumbering. `0021_plan_freeze.sql` (#192/#193) and
>   `0022_projection.sql` (#181/#182/#186/#188/#189) merged under exactly the numbers predicted
>   below as "correctly positioned" — the section's call to **not** renumber them was right.
> - The `0020` collision resolved by giving `0020` to the security fix, as recommended:
>   `0020_review_batch1.sql` is on `main` and the feedback migration moved to `0033_feedback.sql`
>   (#228), passing through `0029` on the way.
> - **Prediction corrected:** this section warned that `0029` was free. It was not — the guardian
>   branch family claimed `0029`/`0030`/`0031` (#203). That is the whole lesson, restated below.

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

> **✅ FIXED on `main`.** The fix this section called a hard prerequisite — `#172` / `d31888b`,
> `fix(migrations): make 0019 display_name_for creation idempotent` — **is on `main`**, and
> `main` has carried 13 further migrations since. Re-verified 2026-09-30 against `762a040`:
> `0018_service_planning.sql:344` is still a plain `create function`, but
> **`0019_rehearsal_workflow.sql:189` now reads `create or replace function`**, so the chain no
> longer aborts. (The line moved 184 → 189 as the file grew.) The claim "#172 is a hard
> prerequisite" is now **historical**: it was true, it is satisfied, and the eleven migrations
> after `0022` prove the chain applies past `0019`.
>
> The lesson below is why the section stays. It is the clearest instance in this repo of a
> **negative finding that was only as good as the range searched** — and the range was
> re-searched and the earlier, wrong "no problem" conclusion retracted. That is the part to
> inherit.

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

**`#172` was therefore a hard prerequisite for any slice that adds a migration**, and for any
fresh `db reset` on `main` as it stood. It has since landed — see the banner at the top of this
section. `0021_plan_freeze` (#179) was stacked on it for that reason. The `1ee9615` patch on
`feat/hito5-in-app-feedback` guarded the same line and was a no-op once #172 landed.

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

> **SETTLED 2026-09-30: the surfaces are independent. The `mvp-scope.md` claim was wrong, and
> `mvp-scope.md` has been corrected.** The check below is now done, not outstanding — verified
> against the post-relocation tree at `762a040` rather than the `src/pages/` layout this section
> was written against:
>
> - `features/external-display.feature:44` — *"External display vs congregation projection are
>   separate targets"*, asserting the display does not override the projection target.
> - **No import edge in either direction.** `src/features/stage/pages/ExternalDisplay.jsx` imports
>   only `data/repositories/externalDisplay.js`; `src/features/projection/pages/Projection.jsx`
>   imports only `data/repositories/projection.js`.
> - Separate repositories, separate components, separate feature directories, separate routes
>   (`/external-display` vs `/services/:id/projection` + `/projection/display`).
>
> The reasoning below guessed correctly on the Gherkin but got its *tree* evidence wrong —
> `src/pages/` no longer exists, which is why it could not find the surface. The conclusion held.

The doc says `congregation-projection` "rides on the external-display surface". Not verified,
and the evidence points the other way: `features/external-display.feature:44` contains a
scenario titled *"External display vs congregation projection are separate targets"*, and the
external-display surface is absent from the tree (no `Display.jsx` / `Projector.jsx` under
`src/pages/`). The only cross-reference in code is a prose comment in `OverlayView.jsx:8`.

**Treat the four branches as independent until proven otherwise**, and confirm by reading the
projection branch's imports before sequencing M3 after M1c/M1d. If they really are separate
targets, the doc is wrong and should say so.

### Also unmerged, and not in this plan

> **✅ RESOLVED — this landed, and the security fix with it.** `fix/hito4-review-batch1` carried 9
> commits including a **songs-metadata RLS leak fix**, and `0020_review_batch1.sql` is on `main`.
> The leak was real: `0016:125` read `using (… and org_id is null)`, which treated **every**
> org-null song as a system-catalog row, while the client's `addSong` inserts only
> `{created_by, title}` → `org_id` NULL → the title/artist/genre of every user's personal
> repertoire was readable by every authenticated user. `0020` fixes it by **provenance**, not by
> tightening the predicate: `org_promote_song` now stamps `source_org_id`, so system rows are
> distinguishable and provenance-less org-null rows **fail closed** to owner-only. See
> `e70385e fix(songs): distinguish system songs by provenance and bound their writes`.
>
> The `0020` number went to this branch, exactly as §2's numbering section recommended, which is
> why the feedback migration had to move twice. The lesson below about `0020` resolving *by
> security-first* is the one that was kept.

`fix/hito4-review-batch1` — 9 commits including a **songs-metadata RLS leak fix**
(`main:0016_org_repertoire_model.sql:125` uses `org_id is null` unguarded, so every
authenticated user can read every other user's personal repertoire metadata). It needs its
own decision, separate from this plan. See §5.

## 3. P2 — the ten spec findings

> **🔴 NINE OF THE TEN ARE NOW FIXED AND MERGED. This section was badly stale.** It previously said
> "All ten still hold on `main`" and that "one change proposal exists … B through J have none".
> Verified 2026-09-30 against `762a040`: nine findings have their fix commit on `main`, and
> `openspec/changes/` holds **eleven** live proposals, not one. Only **finding D** remains open.

| Finding | Subject | Status on `main` | Fix |
|---|---|---|---|
| **A** | `sectionKeyContexts` always empty; the sectional-key branch was dead | ✅ **fixed** | `20e79d0` via #218 |
| **B** | enharmonic spelling from a hardcoded six-key set | ✅ **fixed** | `92e64f6` via #219 |
| **C** | OnSong export cannot reach `agreed_key` | ✅ **fixed** | `63d1ed3` via #220 |
| **D** | **no tie-break in offline conflict resolution, and nothing stores the applied rule** | 🔴 **OPEN** | proposal `fix-offline-tie-break` |
| **E** | `qualityForDegree` inert — 0 of 49 correct | ✅ **fixed** | `0cf6907` via #218 |
| **F**+**G** | readiness lifecycle and per-version tracking | ✅ **fixed** | `791d1de` via #222 |
| **H** | reconcile silent drop — unidentifiable op reported as *superseded* | ✅ **fixed** | `e34e7c6` via #216 |
| **I**+**J** | Spotify key labels and the mode comparison | ✅ **fixed** | `23de152` via #221 |
| — | offline write-queue stalling on unsyncable ops | ✅ **fixed** | `057120a` via #253 |
| — | three unspecified crashes that killed the caller | ✅ **fixed** | `5cc50f6` via #223 |

**Finding D is the only real work left in this section**, and it is the hardest of the ten, which
is why it is the one that survived: `features/offline-edit-conflict-policy.feature:47-51` requires
both that the app "applies the recorded tie-break rule" and that "the applied rule is stored with
the resolution so every device reaches the same result". Today `reconcileSetlistOp` uses a strict
`>` comparison, no rule runs on an exact tie, and there is nowhere to store one. The suite says so
in its own words — `src/domain/setlist/collab.test.js:125-126` carries the Gherkin quote and the
note "The code has no tie-break". **No migration mentions a tie-break** (verified across
`supabase/migrations/`), so the storage half is absent too.

It is also the **only finding of the ten that needs a migration**, and the numbering question that
blocked it is settled: `0034` is free, unconditionally. The proposal deliberately left the number
open, so filling it in is now a real, small decision rather than a blocker.

**The three product decisions below were real, and two have since been made** — B (in #219) and
E (in #218). D's decision is still unmade, and it is a **product** decision, not an engineering
one: what is the tie-break rule, and is it a per-conflict stored value or a global constant? A
schema change follows from the answer, and the Gherkin demands determinism across devices, which
is the claim the product is sold on. This cannot be resolved by reading the code.

The other seven (A, C, F, G, H, I, J) were mechanical against a written scenario — and all of them
are done.

> **The characterization suite no longer pins finding A.** This section previously said the suite
> "pins the buggy behaviour deliberately — `parser.test.js:86` reads `it('sectionKeyContexts is
> ALWAYS empty, even for a chart that modulates')`". **That assertion no longer exists.** After
> #218, `parser.test.js:94-99` reads
> `it('records a mid-chart {key} as a sectional override')` and asserts the *correct* value
> (`[{ sectionIndex: 2, key: 'G' }]`), with a comment recording what the replaced assertion had
> claimed. The predicted deliverable — invert the pinned assertion — is done, and done the right
> way: the behaviour changed **and** the assertion changed with it. The flat-key assertion
> `transpose.test.js:44` is also gone, replaced by `92e64f6` (#219), which derives spelling from
> the key's own name.
>
> `// FINDING` markers still exist elsewhere in the suite (3 in `parser.test.js`, 11 in
> `transpose.test.js`) — those are the *sharp edges* record, i.e. behaviour no feature file
> specifies, not unfixed discrepancies. The rule that an assertion is never edited to go green
> while the behaviour stays wrong still holds; it is simply no longer what finding A is.

Each finding was one behaviour change against one Gherkin scenario — already atomic, and each
took its own PR. Three of them hid a **product decision** that no amount of reading resolved:

- **B** — when does a flat win? Key's own spelling, circle-of-fifths canonical, or
  caller-supplied preference. Changes what `transposeKey` means at every call site.
  ✅ **Decided and shipped in #219** — spelling derives from the key's own name.
- **D** — what is the tie-break rule, and where is it stored? The Gherkin requires the applied
  rule be persisted "so every device reaches the same result", so this implies a **schema
  change** *and* an undefined rule. This is the determinism claim the product is sold on.
  🔴 **Still undecided** — see above.
- **E** — what is the correct degree-quality algorithm? The code read consecutive scale steps
  as a triad's root/third/fifth; stacking real thirds is a different computation.
  ✅ **Decided and shipped in #218** (`0cf6907`).

> **Superseded 2026-09-30** — the text this block replaced claimed the suite "pins the buggy
> behaviour deliberately" and that `parser.test.js:86` asserted `sectionKeyContexts` was ALWAYS
> empty. Both halves are now false, and the correction is in the banner at the top of §3: the
> assertion was inverted by #218 along with the behaviour it described, and `transpose.test.js`'s
> flat-key assertion went with #219. **The rule it encoded survives**: editing an assertion to
> make a gate pass *without* changing behaviour is still forbidden (AGENTS.md, delivery workflow
> clause 3).

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

## 5. Doc rot — status as of 2026-09-30

Most of this table is **repaired**, by this change or by an earlier one. It is kept in the
document rather than deleted, because "doc rot is a live category here" is the lesson, and a
repaired list with dates tells the next reader which claims were once wrong.

| File | Defect | Status |
|---|---|---|
| `docs/mvp-scope.md:217,301,309-310` | claims nothing from Hito 5 is merged | ✅ **repaired 2026-09-30** — Hito 5 complete, `0021`–`0033` on `main`, with per-migration PRs |
| `docs/mvp-scope.md:82,84` | projection-rides-on-external-display dependency | ✅ **repaired 2026-09-30** — settled as **false**; the two surfaces are independent, and the doc now says so with evidence |
| `docs/mvp-scope.md:18` | "42 BDD features" | ✅ **repaired 2026-09-30** — 45 files / 713 scenarios |
| `AGENTS.md` methodology table | said 42 files / 656 scenarios (and this table said it "says 45" — the table was wrong) | ✅ **repaired 2026-09-30** — 45 / 713 |
| `AGENTS.md` type-checking section | "only four files are actually checked"; `listFiles` 48 | ✅ **repaired 2026-09-30** — 47 opt in, `listFiles` 60; the four canonical files kept as the named baseline |
| `AGENTS.md` test paragraph | claimed the `node` environment came "via the existing `vite.config.js`" | ✅ **already fixed before this change** — `AGENTS.md` already says `vite.config.js` has no `test` block; verified, it has none |
| `AGENTS.md` smoke-test section | "6 files, `0023`–`0028`" | ✅ **repaired 2026-09-30** — 13 files, `0021`–`0033` |
| `openspec/config.yaml` | "NO test framework, NO typecheck, NO CI"; empty `test_command`/`test_framework`; six `testing:` flags false; `rules.design` on the pre-relocation layout; no-`store/`-or-Zustand claim | ✅ **repaired 2026-09-30** — real commands filled, `strict_tdd: false` re-justified, layout corrected |
| `CONTRIBUTING.md` | `npm install`, `npm run lint`, `your-org` remote, `src/store/` Zustand | ✅ **repaired 2026-09-30** — pnpm, real remote, post-relocation layout, no store claim |
| `README.md` | hosted project URL, "no CI/deploy", partial script list, design-system-as-authority, no master-plan link | ✅ **repaired 2026-09-30** |
| `docs/technical-spec.md:241` | hosted Supabase, migrations `0001`–`0019`, "no CI" | ✅ **repaired 2026-09-30** — local stack, `0001`–`0033`, CI present |
| `docs/local-dev.md:29` | "two confirmed users"; password hidden behind "whatever `crypt()` says" | ✅ **repaired 2026-09-30** — three users, password `password1234` stated outright |
| `docs/design-system.md` | presented as the design system | ✅ **already fixed** — supersession banner added in #238 (PR `5547150` = #235 verified). Cross-reference count corrected 11 → 14 on 2026-09-30 |
| `docs/master-plan.md` §0, §2, §6 | this document's own drift | ✅ **repaired 2026-09-30** — see the status block at the top |
| `odd/tasks/hito4-remaining.md` | 42 unchecked boxes | 🔶 **still open, and the old row was wrong**: it claimed the per-feature headers all say COMPLETE. Only Feature 1 does ("✅ COMPLETE (PR pending)"). The file is a superseded umbrella — every Hito 4 feature did land — but it reads as 42 open tasks. Cheap to annotate; needs its own edit |
| `odd/tasks/cemurm-brand-landing.md` §14.2 | reuses the letter **E** for a different finding than §14.1's E | 🔶 **cannot be fixed from `main` — the file is not here.** It exists only on `origin/feat/cemurm-brand-landing-pr1b-boundary-refactors`. `master-plan.md` §3, `AGENTS.md` (2 places) and `odd/tasks/music-theory-discrepancies.md` all cite it. The live record on `main` is `odd/tasks/music-theory-discrepancies.md`, which is self-contained and already declines to use the branch-only file as its reference |
| `feat/hito5-*` branches | no ODD record for plan-freeze, external-display, in-app-feedback, congregation-projection | 🟡 **mostly closed** — `odd/tasks/hito5-*.md` now covers 9 of the 10 Hito 5 features (#247). **One gap remains: `external-display` has no ODD record** |
| `docs/master-plan.md` §3 "Full detail in `odd/tasks/cemurm-brand-landing.md` §14" | dangling reference to a branch-only file | ✅ **repaired 2026-09-30** — repointed at `music-theory-discrepancies.md` |
| `AGENTS.md` §"Where the real context lives" | points at this file as the sequencing authority | ✅ **repaired 2026-09-30** — reworded to match the re-scope |

## 5b. PR 1b: known defects to fix before it is re-cut

PR 1b (`59c1c1f`) is **not** in the sequence above, because it carries problems beyond the
acceptance-gate deviation documented in PR #168. All three were found during review, not by
the suite. **Re-verified 2026-09-30 — one is fixed, one was misdescribed, one is still live:**

1. **The clock injection degrades silently.** 🔶 **Live, but not as described.** Refactors 5 and
   6 were supposed to remove the implicit default from `relativeTime(iso, now)` and
   `isLockStale(lock, now)`. The current code has it the other way round:
   `isLockStale(lock, now = Date.now())` (`collab.js:185`) **has** a default again, and
   `relativeTime(iso)` (`relativeTime.js:16`) never took a `now` parameter at all — it reads
   `Date.now()` internally at `:19`. So there is no longer "a required parameter that silently
   yields a plausible answer"; there is an **implicit read**, which is the determinism problem the
   refactor was meant to remove, arriving by a different route. The concern stands; the
   description did not survive.
2. **ADR 0002 rule 2 is false.** ✅ **Fixed — the ADR is now true.** This claimed
   `src/features/stage/pages/Overlay.jsx:11` and `src/features/stage/hooks/useFootPedal.js:2`
   "import `supabase` from outside `data/`". Both now import from
   `'../../../data/supabase.js'` — which resolves to `src/data/supabase.js`, **inside** the
   boundary. The violation no longer exists, and the line numbers have moved (:11 → :12). Keep
   the principle, not this item: an ADR that claims more than is true is the same failure as the
   orphaned `design-system.md`, and that is why the check is worth repeating.
3. **The refactor list skipped `applyLock`** at `collab.js:91`, which reads `Date.now()`
   internally. 🔴 **Still live at `collab.js:203`.** `applyLock(locks, payload)` takes no clock
   and calls `const now = Date.now()` directly, inconsistent with `isLockStale`'s injectable
   `now`. Left as-is it is a flake source in the one module whose determinism the product claims
   — and note it is no longer the *only* one: `relativeTime` does the same thing. **If this is
   picked up, fix both, or the inconsistency just moves.**

## 6. Order, and why

**As written on 2026-09-27, against the state at that time:**

```
M0a  relocation (renames, bundle identical)      ← unblocks everything
M0b  characterization suite + CI test step        ← the net; gates all of §2–§4
M1   renumber migrations 0020/0021/0022 → 0029+  ← blocker, do before any Hito 5 merge
M2   finish Hito 5, 10 slices                    ← already built, cheapest real product value
M3   findings A–J, 10 PRs                        ← now provable against the suite
M4   Hito 6, sliced by feature                   ← 99 scenarios from zero, the long pole
M5   doc repairs, alongside each slice above
```

**Where that landed (verified 2026-09-30 at `762a040`):**

| Step | Outcome |
|---|---|
| **M0a** | ✅ landed — `ae14521` |
| **M0b** | ✅ landed — `e267b97` + `e9d41c3`; now **307 tests / 9 files** |
| **M1** | ⛔ **moot, and it predicted the wrong thing.** The renumbering never happened: `0021` and `0022` merged under their original numbers, exactly as §2 argued they should. The `0020` collision resolved the other way — `0020` to the security fix, feedback renumbered all the way to `0033`. The "next free number is `0029+`" premise was wrong from the start: `0029` was claimed by the guardian family |
| **M2** | ✅ landed — Hito 5 complete, `0021`–`0033` |
| **M3** | ⬜ **still open** — the ten findings A–J, unfixed |
| **M4** | ⬜ **still open** — Hito 6, 99 scenarios, 0 shipped |
| **M5** | 🟡 **partly done** — this document, `mvp-scope.md`, `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `openspec/config.yaml`, `technical-spec.md`, `local-dev.md` repaired 2026-09-30. Still open: `odd/tasks/hito4-remaining.md`, and the branch-only `cemurm-brand-landing.md` |

**The order that actually remains, 2026-09-30:**

```
N0  unblock the red gate: fix check-visual-contract (3 rules)   ← CI is red on main
N1  findings A–J, one PR each, inverting the pinned assertion   ← now provable against 307 tests
N2  Hito 6 privacy slice: offboarding-cascade, then
    account-data-export-and-erasure                              ← obligations, not features
N3  Hito 6 product slice: export-and-sharing, user-onboarding,
    analytics-and-insights
N4  cross-organization-event-collaboration                      ← last; needs four surfaces stable
N5  remaining doc rot, alongside whatever slice is open
```

**N0 is first because it is the only item that is blocking something other than itself.** CI on
`main` is red, which means every PR is currently red too, and a red suite is a suite people
learn to ignore. It is also small: two ceiling overflows and one one-line fix.

Two things deliberately do **not** go in this plan:

- **The landing / brand cycle** (`feat/cemurm-brand-landing-pr1b-boundary-refactors`, PR #168).
  It is marketing surface, and it is currently one 9-commit PR. The refactor slices inside it
  (M0a, M0b, plus PR 1b) are worth keeping and land as their own PRs; the brand and landing
  work is deferred and should be re-planned against this state.
  **Update 2026-09-30:** M0a and M0b did land as their own PRs. The rest — including the PR 1b
  branch itself and `odd/tasks/cemurm-brand-landing.md` — is **still branch-only**, which is why
  that file is a dangling reference from `main` (§5). PR 1b was never re-cut; §5b's remaining
  defect 3 stands.
- **`fix/hito4-review-batch1`.** Nine unmerged commits, several of them security fixes, one of
  them a real metadata leak. That is its own decision with its own urgency, and merging it is
  not a formality.
  **Update 2026-09-30: it merged, and the leak is fixed.** `0020_review_batch1.sql` is on
  `main` and closes the songs-metadata leak by provenance — see §2's "Also unmerged" block. The
  security-first call on the `0020` number is what forced the feedback migration's two
  renumberings, and that chain is now fully settled at `0033`.
