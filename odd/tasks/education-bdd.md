# education-bdd — Education capability as BDD product truth

> Change slug: `cemurm-education`. Branch: `docs/cemurm-education-bdd` (isolated worktree),
branched on `docs/cemurm-education-proposal` because this record cites that proposal's
§H as its rationale. Merge the proposal first or this citation dangles.
> **This unit writes product truth only. No code, no migration, no spec, no nav.**
> Product truth layer: BDD (`features/*.feature`), per `AGENTS.md`. This file is the ODD execution record.

## Objective

Two jobs, both blocking items from `odd/tasks/cemurm-education-audit.md`:

1. **Resolve R3.** The audit's sharpest finding: `features/practice-mode.feature:186-194` was a
   NON-GOALS scenario forbidding streaks and gamification, which directly contradicts the Education
   capability the same audit recommends. Maintainer approved removing that prohibition. Done here.
2. **Write down the approved MVP** as three feature files, so the next unit has something to build
   from. `AGENTS.md`: BDD is product truth and is the source of what to build.

## Deliverables

| File | Scenarios | What it locks down |
|---|---|---|
| `features/education-courses-and-exercises.feature` | 13 | Course owned by an organization; flat ordered exercises; an exercise aimed at a real song and a specific section of it |
| `features/education-student-progress.feature` | 20 | Learning path states; progress; XP as an append-only event history; streaks and what counts as an active day; daily goals |
| `features/education-teaching-assignments.feature` | 13 | Instructor gives work to enrolled students; student completes it; instructor sees who is done |
| `features/practice-mode.feature` | amended | Gamification prohibition removed, boundary preserved |

Suite total moves from 42 files / 656 scenarios to **45 files / 702 scenarios**.

## T1 — The non-goals change (`practice-mode.feature`)

Three lines changed, one added. The scenario is retitled from
*"Audio playback, recording, gamification, and shared practice are out of scope"* to
**"Audio playback, recording, and shared practice are out of scope"**, so the title no longer makes a
claim the file no longer holds.

- **Removed:** `And no practice streaks, badges, or gamification elements exist — the analytics dashboard is the only consumption surface`.
  The whole line goes, including its trailing clause. Keeping "the analytics dashboard is the only
  consumption surface" would have been a second, quieter contradiction: Education derives streaks and
  XP from practice activity, so the analytics dashboard is no longer the only surface that reads it.
  A prohibition left half-alive is worse than one removed.
- **Reworded:** `no shared or real-time practice session feature exists — practice is always personal`
  → `no shared or real-time practice session feature exists — the session itself is always personal,
  even though education derives streaks and XP from it`. The old wording collided with the new
  capability on the word "personal": it read as "no derived data may leave the student", which is not
  what was ever true and is not what is wanted. The new wording keeps the boundary that actually
  matters — the **session** is never shared and never real-time — while saying out loud that derived
  streaks and XP do read it. `features/practice-mode.feature:139` ("not visible to bandmates **or the
  organization**") is untouched and still governs the raw session.
- **Added:** `And the streaks and XP derived from a session belong to education-student-progress —
  practice-mode still defines only the write path`. The suite already uses this cross-reference idiom
  (`practice-mode.feature:114`, `:152`, `analytics-and-insights.feature`). It records the resolution
  of the conflict in the file where the conflict lived, so nobody re-reads this section later and
  wonders where gamification went.
- **Kept unchanged:** audio playback / backing tracks / audio import, slow-down and loop, recording,
  and the annotation non-goal.

## T2 — The three Education feature files

Cover the approved MVP only (`cemurm-education-audit.md` §H). Exercises are a **flat ordered list**,
per the maintainer's explicit choice — `education-courses-and-exercises.feature` asserts positively
that there is no unit or lesson level to open, so the hierarchy cannot be quietly reintroduced. The
first exercise type is one, aimed at `{song, section}`, and gets its own section because the
repertoire link is the differentiator against a generic learning app.

**Cast — reused, not invented.** `Pedro` is the instructor (the only person the suite already calls
`instructor`, at `organizational-repertoire-model.feature:80`); `Lucia` and `Sofia` are the students;
`Juan` stays the practice persona; `Academia Musical` / `Sede Bogota` / `Orquesta Ciudad Norte` are
existing org names. Roles use the existing vocabulary only — `instructor`, `org owner`. No `teacher`.

**No invented literals.** The suite quotes exact UI strings as contracts, but with no implementation
written yet any quoted string I invented would be a fiction the next unit has to match. So the only
quoted labels are the four learning-path states (`"Completed"`, `"In progress"`, `"Locked"`,
`"Pending"`) — which this feature file itself defines — and `"pending sync"`, which is reused
verbatim from four existing features.

## What was deliberately NOT written, and why

- **Minors, guardian consent, students under 18.** An unresolved product decision the maintainer
  parked. `cemurm-education-audit.md` R5 records that `guardian_consents` has exactly one
  substantive permission (`public_sharing_approved`, `0017:89`) and **no artifact covering a teacher
  reading a student's educational data**. Writing scenarios would fabricate agreement on the
  question that is still open. Zero occurrences of minor/guardian/consent/under-18 in the new files.
  Note `features/minors-and-guardian-consent.feature` already exists and was left untouched.
- **Any org or instructor reading a student's practice data.** `practice-mode.feature:139` says
  practice is not visible to bandmates **or the organization**, and R1 confirms there is no RLS
  precedent anywhere for an org reading a member's data. `education-teaching-assignments.feature`
  therefore asserts the boundary in the negative: the instructor sees *which exercises a student
  completed and when*, and does **not** see practice sessions, durations, streak, XP, daily goal, or
  the student's private notes. Two scenarios do that, and the student's own progress file states that
  her XP, streak, and goal are visible to no other member of the organization.
- **Post-MVP phases** (audit §I): audio/MIDI recognition, AI tutoring, teacher dashboards, academy
  analytics, skill tracking, orchestras, payments, marketplaces, levels, groups, assessments, video.
  No scenario for any of them.
- **The gamification visual states.** Audit R10 (a second colour palette is a hard CI failure) is a
  visual-contract concern governed by `scripts/check-visual-contract.sh` and
  `skills/cemurm-visual-system`. Asserting it in BDD would duplicate a gate that already measures it.
- **Points per exercise, and whether re-doing a completed exercise pays again.** The audit defines
  the ledger and the reasons but never the reward amounts. `education-student-progress.feature` says
  only that the total is the sum of one event per completion, and that a re-do records another
  attempt — the amount is an open product decision, not something to invent.
- **Which song version an exercise pins.** The audit carries both a song reference and a version
  reference, and R9 says section anchors are name-keyed and fragile. The file states the observable
  consequence — the exercise follows the song to its current chart, always landing on the same
  section — plus what happens when a section is renamed (flagged, instructor asked to re-point).
  R9 explicitly says to state this rather than pretend otherwise. Version pinning stays open.
- **Who may enrol a student, and what `org_admin` / `branch_admin` may see over Education.** The
  audit calls the policies "owner/instructor scoped" without settling which owner role. Enrolment is
  treated as a precondition (`Given Lucia is enrolled in …`), not as a designed flow.

## Duplication avoided

Referenced rather than restated, using the suite's existing cross-reference idiom:
repertoire/branch visibility (`organizational-repertoire-model`), song readiness and retirement
(`song-lifecycle`, `collections`), chart edits creating versions (`song-lifecycle`), ordering
(`setlist-creation`, `collections`), the practice-session write path (`practice-mode`), offline
pending-sync (`practice-mode`, `rehearsal-workflow`, `collaborative-comments`, `offline-access`),
private-annotation privacy (`collaborative-comments`, `offboarding-cascade`), and the practice
analytics dashboard (`analytics-and-insights`).

## Findings that need a maintainer decision

1. **R15 vocabulary collision is live, and the brief asks for a colliding name.** The audit says
   *"Do not name the education concept `assignment`"*, because in this suite `assignment` already
   means *a musician slot in a service block* — `service-planning.feature` has a `MUSICIAN ASSIGNMENT`
   section and `substitutions-and-coverage.feature` speaks of "Lucia's assignment" meaning her
   Worship slot. The brief specified the filename `education-teaching-assignments.feature` and the
   verb "assigning", so that is what was written. The feature title and the verb are harmless; the
   risk is the day someone introduces an `education_assignments` table or a UI noun. **Recommend the
   schema noun be `education_work` or `education_assignments` only with a glossary entry.** Flagged,
   not silently overridden.
2. **Two claims in the brief did not match the repo, and were resolved in favour of the repo.**
   (a) *"Step text in Spanish"* — the entire 42-file suite is English, 2977 step lines, zero Spanish
   step keywords; Spanish appears only inside proper nouns such as "Canción Z" and
   "Orquesta Clásica Norte". The brief's own example step is English and is a verbatim copy of
   `practice-mode.feature:11`. English was written, matching the suite.
   (b) *"2-space indent for `Scenario:` / `Given` / `When` / `Then` / `And`"* — in the suite
   `Scenario:` is at 2 spaces and steps at 4. That is what was written.
3. **`education-student-progress.feature` invents one thing the audit does not have: daily goals.**
   The brief listed them; the audit puts "daily-goal derivation" in Phase 2 and MVP item 6 only says
   "a learning-path list". Written as specified, and kept deliberately thin (target, progress toward
   it, met/missed per day) so it does not pre-empt the Phase 2 design.

## Commit sequence

This unit was initially landed as a single 559-line commit, which violated the project rule that
a PR be minimal or atomic. It was rewritten as four commits, one per separable concern. No content
changed; the tree after the split is byte-identical to the tree before it.

1. `education-courses-and-exercises.feature` — authoring and the repertoire link, no dependencies
2. `education-student-progress.feature` — student path, XP ledger, streaks, daily goals
3. `education-teaching-assignments.feature` — enrolment, assigned work, instructor visibility
4. `features/practice-mode.feature` — the non-goal amendment, landing **after** the education
   scenarios because its cross-reference points at `education-student-progress`

## Verification performed

- [x] `pnpm lint` → exit 0. Baseline captured **before** any edit was also exit 0, so the run proves
      nothing broke. `.feature` is outside the lint glob (`--ext js,jsx`) by design.
- [x] `git status --porcelain` / `git diff --stat` — 1 file modified, 3 added, 1 ODD record added.
      No other feature file touched.
- [x] **Convention oracle.** A structural checker was written and validated *against the existing
      suite first* (28 of 42 existing files pass it clean; the other 14 fail only on their own
      pre-existing quirks — 7 missing a trailing newline, 1 mixed-case `SCENARIO 1:` header,
      6 step-continuation lines with no keyword). The original `practice-mode.feature` passes it.
      All three new files and the amended `practice-mode.feature` pass it clean, under the same rules.
- [x] Separators were not hand-typed. `@@SEP@@` was substituted with the exact bytes of
      `practice-mode.feature:6` (2 spaces + 46 × U+2500) via a script, so a single canonical
      separator exists across all 45 files.
- [x] Constraint greps over the new files: minors/guardian/consent → 0; `teacher` → 0; table names,
      column names, RLS, SQL, React, JSON → 0; out-of-scope MVP-phase topics → 0.
- [x] Scenario count re-derived from the files, not from the draft.
- [x] `pnpm test` and `pnpm build` not run: no code changed. Not applicable to a BDD unit.

## Not done here

No OpenSpec capability spec, no migration, no `src/` change, no nav link, no diagrams. The audit's
other two blockers (the consent decision, and the RLS policy family having no precedent) are untouched
and still gate the first migration.
