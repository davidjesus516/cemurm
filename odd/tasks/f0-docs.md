# F0 — Documentation & Decisions (reconstruction)

**Branch:** `feat/visual-token-foundation` (current) — F0 docs land as a work unit; F1 code lives on `feat/f1-membership-admin`.
**Status:** reconstruction after an accidental `git checkout HEAD --` discarded the uncommitted F0 edits.
**Source of truth:** `odd/tasks/education-institutional-decisions.md` and `openspec/changes/education-institutional-modules/proposal.md` (both survived as untracked files).

---

## Specs

**S1** — `docs/decisions.md` carries ADR-012 ("Native institutional/educational modules") with Context, Decision, Alternatives considered (Moodle a/b/c, hybrid), Consequences, and a **Superseded** marker on the existing ADR-011. ADR-011 is preserved, not deleted.

**S2** — `docs/roadmap-ampliacion.md` §5 is rewritten from the Moodle 8-0…8-6 phases into **F0–F8**, each with its BDD file, migration content, RPCs, smoke, UI, and dependencies. The old Moodle section is gone.

**S3** — `docs/mvp-scope.md` timeline gains **Hito 7 (Identity & Org Admin, F1)** and **Hito 8 (Education & Institutional, F3–F8, ADR-012)**; the four existing `education-*` features (67 scenarios) are assigned to Hito 8 instead of waiting on a scope decision.

**S4** — `docs/database-schema-ampliacion.md` §4 is replaced: the old 5-table C2 design becomes the ADR-012 academic core with `academic_periods`, `education_courses`, `education_subjects` (conditional), `education_course_offerings`, `education_enrollments`, `education_exercises`, `education_progress`, `education_events`, `education_evaluations`, `education_grades`, plus derivation RPCs, private cores for membership/enrollment, public wrappers, RLS policies and directed grants.

**S5** — `docs/database-schema-ampliacion.md` §6 becomes **F7 — inventory** with `inventory_asset_types`, `inventory_assets`, `inventory_loans`, `inventory_movements` (conditional), RLS and grants.

**S6** — `docs/database-schema-ampliacion.md` gains §9, a phase → migration quick-reference table (F0–F8) naming the next free migration number and warning that it must be re-counted at implementation time.

**S7** — Every document stays internally consistent with the resolved decisions D1–D5 and with `derived` decisions B1–B8 / T1–T8 in the acta.

---

## Tasks

| ID | Spec | Route | Commit |
|----|------|-------|--------|
| T1 | S1 | inline/worker: ADR-012 into `docs/decisions.md` | `f0-decisions` |
| T2 | S2 | inline/worker: roadmap §5 F0–F8 | `f0-roadmap` |
| T3 | S3 | inline/worker: mvp-scope Hito 7/8 | `f0-mvp-scope` |
| T4 | S4, S5, S6 | worker: schema doc §4 / §6 / §9 | `f0-schema` |

---

## Log

**L1** (user): «Resolvamos decisiones, que propones?» → D1–D5 resolved: D1=A, D2=C, D3=C, D4=C, D5=five module keys.

**L2** (incident): `git checkout HEAD --` on four docs discarded the uncommitted F0 rewrites. Surviving: acta, OpenSpec proposal, F1 code (committed on `feat/f1-membership-admin`). This task reconstructs the docs from those survivors.
