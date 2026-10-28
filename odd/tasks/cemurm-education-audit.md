# CEMURM Education — feasibility audit

**Status:** investigation complete, no implementation authorized
**Date:** 2026-09-28
**Scope:** read-only audit. No product code was modified. Two parallel code mappers + parent verification of migration numbering.
**Change slug:** `cemurm-education`
**Methodology layer:** ODD (execution record). Product truth lives in `features/*.feature`; capability specs belong in `openspec/specs/`.

---

## Objective

Determine, from the real code, whether CEMURM can support an Education bounded context
(courses, lessons, exercises, progress, practice, assignments, streaks) without compromising
performance, stability, multiplatform, or maintainability.

Explicitly **not** the goal: proving the idea is viable. The finding is that the proposal as
written needs substantial correction before it is implementable.

---

## A. Current state — what actually exists

| Area | Reality | Evidence |
|---|---|---|
| Tables | **57 tables**, 1 view, 6 enums, 13 triggers, 1 bucket | `supabase/migrations/0001_init.sql` + 26 later |
| Migrations on disk | **27 files**, not 25. `0020` and `0022` **exist**; only `0021` is absent | `ls supabase/migrations/` |
| Organizations | Real: `organizations`, `branches`, `org_memberships`, multi-org capable | `0001:6,15,27` |
| Songs / repertoire | Real: `songs`, `song_versions`, `chart_files` | `0001:70,100,89` |
| Setlists | Real: `setlists`, `setlist_items` with ordered `position` | `0001:155,178` |
| Practice | `practice_sessions` table is real but is a **ghost** — RLS, grants and a seed row, **zero client code** | `0001:367`; zero hits in `src/` |
| Rehearsals | Real: `rehearsals`, `rehearsal_items` with `outcome`, `run_count`, `carry_over_to` | `0001:379,394` |
| Education concepts | **None.** No course, unit, lesson, exercise, enrollment, XP, streak anywhere | 42 `.feature` files, 0 educational |
| Roles | Vocabulary is `org_owner`/`org_admin`/`branch_admin`/`instructor` — all `text`, no CHECK | `0001:60-67`, `AppLayout`/`Organizations.jsx:17` |
| Frontend | 14 feature folders, 47 files, 24 routes, **one** React context (`AuthProvider`) | `src/app/router.jsx`, `src/features/` |
| UI patterns | `src/ui/patterns/` holds **2 leaf renderers**, both self-declared layer violations. No Button/Card/Progress anywhere | `ChordProRenderer.jsx:2-3`, `PdfChartViewer.jsx:2-3` |
| Tests | **7 test files**, all in `src/domain/**` + `src/integrations/`. **Zero** in `ui/`, `features/`, `hooks/`, `data/`, `app/`, `offline/` | `vite.config.js` has no `test` block |
| Diagrams | **archify 2.17.0-dev.1** exports, 5 files. External tool, not in `package.json` | `<meta name="generator">` in each |

---

## B. Current architecture

Layering is nominally correct and mostly holds. `src/domain/**` is pure, `src/data/repositories/**`
is the only Supabase boundary. Three confirmed leaks:

1. `src/domain/music/degreeResolver.js:10` imports from `data/repositories/scaleCatalog.js` and
   `await`s it — a "pure" domain function doing network I/O. **Not tracked** in `master-plan.md`.
2. `src/features/stage/pages/Overlay.jsx:11` calls `supabase.rpc` inline.
3. `src/features/stage/hooks/useFootPedal.js:2` queries Supabase directly.

(2) and (3) are already logged at `docs/master-plan.md:291-295`, which also declares **ADR 0002
absent from the repo** and "rule 2 is false". The authoritative boundary rule is not in-tree.

**Navigation is a horizontal top header, not a sidebar** (`AppLayout.jsx:5-19`, 13 flat links,
`flex gap-4`, no grouping, no responsive collapse). `docs/wireframes.md:29` confirms this is
deliberate. There is one top-level layout route; nesting inside it is a guard chain
(`RequireAuth` → `RequireGuardianConsent` → 20 flat routes).

---

## C. Reuse — do not create

| Proposal entity | Maps to | Verdict |
|---|---|---|
| education organization | `organizations` + `branches` + `org_memberships` | pure duplication |
| education membership / teacher | `org_memberships.role = 'instructor'` | pure duplication |
| education user identity | `profiles` | pure duplication |
| education arrangement | `song_versions` (**`arrangements` never existed**) | pure duplication |
| education assignment | `rehearsal_items` (`outcome`, `run_count`, `notes`, `carry_over_to`) | pure duplication |
| education practice log | `practice_sessions` — add 2 columns | duplication |
| education curriculum order | `setlist_items.position` | duplication |
| education section anchor | `shared_comments.anchor` `{section, index}` jsonb | copy the idiom |
| education notifications | `notifications` + `public.notify_user` (definer-only) | reuse the shape |
| education minor consent | `guardian_consents` | reuse — but see risk R5 |
| education XP counter / streak table | nothing | **reject**; derive from a ledger |
| education units / lessons | `position integer` | **reject**; collapse |
| education badges, achievements, certificates, reviews, submissions, feedback | nothing | **reject**; MVP over-engineering |

---

## D. Changes required to existing code

None. Education is **additive**. No existing feature, table, or column must change to host it —
with one exception: `songs` UPDATE is column-limited since `0020:104-106`, so any new `songs`
column is not client-writable until that literal grant list is amended (`0020:96-103` records
the lesson). Avoid adding columns to `songs`.

Nav addition (one route + one `navLinks` entry) is the cheap path. The proposal §33 four-group
nav is a **rewrite** of `AppLayout.jsx:5-19` and `:57-66`, not an addition, and it promotes
"Practice" to a peer group while `router.jsx:50` makes it a **child** of repertoire.

---

## E. New entities — 5 tables, not 20

Migration number: **`0030_*.sql`**. Not `0021` (genuine hole, do not renumber to "restore" it —
`master-plan.md:94-96` shows renumbering inverts authored dependency order). Not `0029`
(reserved for `0020_feedback.sql` renumber, `master-plan.md:98-100`).

**T1 `education_courses`** — `org_id` FK (**the isolation boundary**), `branch_id`, `title`,
`instrument`, `created_by`, `status text` default `'draft'`, timestamps. Purely new: nothing
existing can hold "a curriculum owned by an org".

**T2 `education_exercises`** — `course_id` FK, `title`, `instructions`, `target_song_id` FK,
`target_version_id` FK, **`anchor jsonb`** holding `{section, index}` copied verbatim from
`shared_comments.anchor`, `position integer` (**replaces units + lessons**), `est_minutes`.
Index `(course_id, position)`.

**T3 `education_enrollments`** — `course_id` + `user_id`, `role text` default `'student'`
(*per-course*, not an org role), `status`, `unique(course_id, user_id)`, index `(user_id, status)`.
Deliberately **not** shaped like `org_memberships`: its `UNIQUE(user_id, org_id, branch_id)`
(`0001:36`) is defeated by NULL `branch_id` because Postgres treats NULLs as distinct.

**T4 `education_progress`** — PK `(exercise_id, user_id)`, `status text` default `'assigned'`,
`score`, `attempts`, `notes`, `assigned_by`, `assigned_at`. This is `rehearsal_items`
generalized from rehearsal→exercise, with the assignment half folded in as columns. One
single-writer-per-key row, so **last-write-wins is safe** — unlike a counter.

**T5 `education_events`** — append-only XP ledger: `client_uuid uuid unique` (**device
idempotency key, non-negotiable**), `user_id`, `delta int`, `reason text`, `course_id`,
`source_id`, `created_at`. Index `(user_id, created_at)`.
Plus `SECURITY DEFINER` helpers `private.education_xp_total(uuid)` and
`private.education_streak(uuid)`, shaped after `private.validate_service_plan` (`0018:355`).

**Why the ledger is the one genuinely new thing**: XP total, level and streak are all
`sum` / `count(distinct date)` over it. Addition is **commutative**, so two devices' events both
land and the total is right — the only thing the current FIFO offline queue handles correctly.

---

## F. Risks

**R1 — There is no "an org reads its members' data" precedent. Every education policy is net-new.**
`practice_sessions` is user-only (`0002:371`). `features/practice-mode.feature:139` says practice
is "not visible to bandmates **or the organization**". The only teacher-like write in the schema
is `rehearsal_items` via `session_may_mark_item` (`0019:152-180`), rehearsal-scoped.

**R2 — Policy-recursion contract.** `0002:136-141` records a verified plan-time `42P17`.
Route every cross-table resolution through a `SECURITY DEFINER` helper in `private`.

**R3 — BDD conflict, and it is the sharpest one in this audit.**
`features/practice-mode.feature:186-194` is a **NON-GOALS** scenario: *"no practice streaks,
badges, or gamification elements exist"*. `:194`: *"no shared or real-time practice session
feature exists — practice is always personal."* Per `AGENTS.md`, BDD is product truth. **XP,
streaks and achievements contradict live product truth and need a BDD change, not a migration.**

**R4 — Minors are invisible by design.** `profiles_select_search` excludes minors
(`0017:161-163`). A teacher roster query returns **zero rows for every minor student**.
`instrument` is not client-readable at all (`0006:174`) — which is why
`private.substitution_candidates` (`0023:46`) exists as a definer RPC. Any assign-by-instrument
must be a definer RPC.

**R5 — No consent artifact covers educational data.** `guardian_consents` (`0017:81`) has exactly
one substantive permission: `public_sharing_approved` (`0017:89`). No scope column, no purpose
column, no versioned-per-purpose grant. A teacher reading a minor's graded performance has **no
consent record covering it**. Product gap, not schema gap.

**R6 — Offline: one failed XP event blocks the whole queue forever.**
`src/offline/drainer.js` broke the loop on any non-superseded error (the `break` is now at `:215`, the RETRY path). A single rejected
XP event stalls every later queued op, including unrelated setlist writes.

**R7 — No idempotency anywhere in the queue.** `drainer.js:179` does `await fn(...op.args)`. If
the call succeeds and `removeOps` (`queue.js:96`) fails, the op replays and pays twice. Today
every op is only *incidentally* idempotent. `education_events` needs the `unique client_uuid`
and a server-side `on conflict do nothing`.

**R8 — `section_context` is a dead column and a test guards that.**
`0001:109` declares per-section metadata; no client reads or writes it. `parseChordPro` always
returns `sectionKeyContexts: []`, and `parser.test.js:86-110` **characterizes that as expected**.
Populating it makes a characterization test fail — and `AGENTS.md` forbids editing a test to go
green.

**R9 — Section anchors are name-keyed and fragile.** `section-${encodeURIComponent(name)}`
(`ChordProRenderer.jsx:55-57`). Renaming a section orphans every anchor silently. No integrity
guarantee. State this in the spec rather than pretending otherwise.

**R10 — A second gamification palette is a hard CI failure.** `check-visual-contract.sh` Rule 04
is `enforcing` against a closed 17-leaf allowlist. `cem.emerald` and `cem.rose` — the obvious
"achievement green" and "locked red" — are on the **retirement list** (Rule 02, 252 occurrences
being migrated away). Encode the four learning states with **ramp step + amber + weight + icon**.
Amber then means exactly one thing: "this is where you are now", which is what Hard Rule 2
licenses it for.

**R11 — `api.max_rows = 1000`** (`supabase/config.toml:18`). A 40-student class × 20 exercises is
800 rows in one join; a leaderboard over `education_events` blows past 1000 on page 1 and
silently truncates.

**R12 — Cached progress never evicts.** `src/lib/storage.js:13` — `EVICTION_ORDER = ['pdf','exports']`.
The `'data'` IDB category is never auto-evicted. An XP ledger cached there grows unbounded.

**R13 — Erasure is unimplemented on the IDB half.**
`features/account-data-export-and-erasure.feature:59-60` requires practice sessions gone after
erasure plus the local cache cleared. `on delete cascade` covers the DB half; **no code clears
`cemurm-offline` on logout**. An XP ledger that never evicts is a GDPR problem.

**R14 — `private` default privileges differ between migrations.** `0002:42` revokes from
`public, anon, authenticated`; `0016:54` re-declares revoking only from `public, anon`. The
later one wins for functions created after `0016`. Mirror the four-line block at `0002:33-39`
verbatim.

**R15 — Vocabulary collision.** `service_assignments` means *musician role in a service block*,
used across services, substitutions and their OpenSpec specs. **Do not name the education
concept `assignment`.**

---

## G. Proposed architecture

```
CEMURM UI  (src/app/ — one top header, add one nav link)
   ├── Music      features/repertoire, setlists, library
   ├── Live       features/services, rehearsals, stage
   └── Education  features/education          ← NEW, additive
           │
      domain/education/      ← PURE state machine: progress, streak, XP math
           │                    (this is where the tests go)
      data/repositories/education.js   ← only Supabase boundary
           │
      PostgreSQL: 5 new tables + net-new RLS helpers
           │
      Shared (reused unchanged): users, organizations, songs, song_versions,
                                 chart_files, practice_sessions (+2 cols), rehearsals
```

The **domain/data split is what makes education testable at all**. Vitest runs in the `node`
environment with no jsdom, so JSX cannot be rendered and every one of the 7 existing tests lives
in `src/domain/**`. Progress and gamification logic written inside hooks or pages ships with
**zero regression net**. Put it in `src/domain/education/` as pure functions.

---

## H. MVP

1. `education_courses` + `education_exercises` + RLS helpers (owner/`instructor` scoped)
2. `education_enrollments` — one row per student per course
3. `education_progress` — PK `(exercise_id, user_id)`, last-write-wins, offline-safe
4. `education_events` append-only ledger + `client_uuid` idempotency + XP/streak RPCs
5. `/education` route + one nav link + a learning-path list using `StatusBadge`
6. Exercise type: **one** first — `identify_chords_in_section` pointing at
   `{target_song_id, anchor: {section, index}}`. This is the differentiator, prove it before
   adding a second type.

Excluded from MVP: audio recognition, AI, MIDI, teacher dashboards, org analytics, skill
tracking, achievements beyond the ledger, badges, levels, groups, orchestras, payments.

**Prerequisite, not MVP work:** a BDD change to `features/practice-mode.feature` removing the
non-goals that forbid streaks and gamification (R3). Product truth outranks this document.

---

## I. Roadmap

- **Phase 2** — teacher authoring, assignment UI, cohort roster, daily-goal derivation
- **Phase 3** — achievements, levels, skill tracking, instructor dashboards
- **Phase 4** — offline-first course download, conflict-free multi-device progress
- **Phase 5** — MIDI, audio analysis, AI tutoring, orchestra sections

---

## J. Complexity

| Component | Level |
|---|---|
| 5 new tables + migrations | Medium |
| RLS helper family + policies on 5 tables | **High** — no precedent, net-new |
| Progress sync over the existing offline queue | **High** — breaks on first error, no idempotency |
| XP/streak derivation (SQL) | Low |
| Learning-path UI | Medium |
| Exercise rendering (first type) | Medium |
| Gamification visual states | Low — but constrained (R10) |
| Diagram + presentation artifacts | Low — archify already in use |
| BDD change for gamification | Low — but **blocking** |
| Minor consent for educational data | **High** — product decision, not code |

No artificial time estimates. Insufficient data for them.

---

## K. Recommendation

**C — a separate, additive bounded context, with one BDD change and one consent decision
up front. Not B (no refactor needed). Not D (the architecture is not the blocker).**

The layering is good enough to host Education without touching a single existing feature. What
blocks it is not architecture:

1. **BDD** forbids streaks and gamification in `features/practice-mode.feature:186-194`.
2. **Consent** has no artifact covering a teacher reading a minor's performance.
3. **RLS** has no precedent for org→member data access; all five policies are net-new.
4. **The offline queue** will stall the whole app on one rejected XP event.

Items 1 and 2 are product decisions, not engineering. They should be settled before the first
migration is written.

### What the proposal got wrong

The proposal lists 20 proposed tables. **5 are needed**; 12 are duplication of entities that
already exist; 3 (`units`, `lessons`, and the XP counter) should be collapsed or derived. The
single biggest correction: `practice_sessions` is not an extension point, it is a
**fully-specified ghost table** — schema, RLS, grants and seed row, with no client code at all.
The proposal assumed a working practice system to build on.

---

## Deviations and corrections to inherited context

- **`AGENTS.md` is wrong about migrations.** It says "25 files, 0020–0022 absent, a numbering race
  between parallel branches". Reality: 27 files; only `0021` is absent. `docs/master-plan.md:22`
  and `odd/tasks/docs-current-state.md:28` repeat the error. Verified by parent
  (`ls supabase/migrations/`).
- **`AGENTS.md` is wrong about CI.** It says "CI also runs no tests — M0b adds that step".
  M0b has landed: `ci.yml:33` runs `pnpm test`.
- `docs/master-plan.md:18-20` is stale: it claims `main` has no regression net and a
  pre-relocation layout.
- `docs/mvp-scope.md:217,309` — "nothing from Hito 5 is merged" is false; six Hito 5 migrations
  are on disk.
- `assets/tokens.css` is **not** at repo root; it is `skills/cemurm-visual-system/assets/tokens.css`,
  and it is marked `STATUS: proposal` with a dark ramp that conflicts with the live
  `tailwind.config.js`. Write education UI against `tailwind.config.js`.
- `odd/tasks/hito4-minors-consent.md:24-28` cites six pre-relocation paths, none of which exist.
- `src/components/projection/SlideView.jsx` is orphaned dead code (zero importers) but still
  scanned by the visual gate, whose Rule 06 documentation cites it as the live motivating example.

## Corrections applied after review

A delegated writer fixed R6 and reported that the audit's own line references were stale.
Verified and corrected against the current source: the pre-fix `break` was not at
`drainer.js:243-244`; the surviving `break` at `:215` is the RETRY path, which is correct
because ops replay in `seq` order. `WRITE_OPS` starts at `:21`, the `fn(...op.args)` call is
at `:179`, and `removeOps` is at `queue.js:96`. The bug was real; only the line numbers were wrong.

## Verification performed

- `ls supabase/migrations/` — 27 files confirmed; 0020 and 0022 present, 0021 absent
- `git branch -r | ... git ls-tree -- supabase/migrations/` — 12 remote branches checked for
  numbering collisions; none claim `0030`
- All other findings are cited to file:line by two independent read-only code mappers, with the
  parent verifying the highest-stakes claim (migration numbering) directly
- **No command was run against the database. No migration was applied. No code was modified.**

## Working tree state (blocker for branching)

At audit time the tree is dirty on `feat/jsdoc-libs-s11-core-misc` with 10+ uncommitted files
under `src/data/repositories/`, belonging to in-flight JSDoc work. A new branch from this state
would carry that work. Resolve before opening the PR.

## Next step

Interactive pace — awaiting maintainer direction on:
1. the BDD change for gamification (blocking)
2. the minor-consent question (blocking, product decision)
3. whether to proceed to diagrams + presentation in a new branch
