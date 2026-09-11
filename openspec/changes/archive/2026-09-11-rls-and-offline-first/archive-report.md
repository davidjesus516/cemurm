# Archive Report — rls-and-offline-first

**Archived**: 2026-09-11
**Artifact store**: openspec (repo-local, `openspec/`)
**Change root (archived)**: `openspec/changes/archive/2026-09-11-rls-and-offline-first/`
**Source of truth updated**: `openspec/specs/{row-level-security,user-auth}/spec.md`
**Verdict**: PASS WITH WARNINGS — standard complete archive (no partial archive, no stale-checkbox reconciliation needed)

## Archive Readiness (native status)

- Native `gentle-ai sdd-status rls-and-offline-first --json` at archive time:
  `artifacts`: proposal done, specs done, design done, tasks done, verifyReport done, applyProgress missing (none produced this cycle — no apply-progress artifact expected)
  `taskProgress`: 12/12 completed, 0 pending
  `dependencies.archive: ready`, `nextRecommended: archive`, `blockedReasons: []`
  `actionContext.mode: repo-local` with `allowedEditRoots` = repo root — all archive operations stayed inside the repo.
- Config `archive` rule checked: "Warn before merging destructive deltas" — no destructive merge occurred (both delta specs were first-time main-spec creation; they contain no REMOVED/RENAMED sections).

## Task Completion Gate

Inspected `tasks.md` (persisted tasks artifact): **12/12 `[x]`, zero unchecked implementation tasks** (`- [ ]` count = 0 before and after the move). Applied in the archived copy again as verification: `grep -c '\[ \]'` on the archived `tasks.md` returned 0. No stale checkboxes; no reconciliation was required.

## Verification Summary (attributed)

Per the persisted `verify-report.md` (verification-time snapshot, evidence sha256 `9057a73564454e53bf4eed43444ca8afd26645ff016a694e4f07ffc1d79d1646`):

- Verdict `pass_with_warnings`; `blockers: 0`, `critical_findings: 0`; requirements 9/9; scenarios 18/18 compliant.
- Live harness: `supabase db reset` exit 0 (0001_init.sql → 0002_rls_core.sql → seed.sql); RLS audit `rls_off=0` (48/48 tables), 34 policies; helpers proacl excludes anon/public (4 helpers incl. `session_owns_setlist`); full curl matrix green (anon 42501, demo 2 songs, isolation 1 own song, setlist owner 204 / isolation 42501, notifications read_at 204 / title 42501, outbox 201 + self-read, gap-table hard deny, service_role full).
- Build: `pnpm build` exit 0 (vite 5.4.21, 111 modules, 2.17s).
- Warnings at verification time (nonblocking, both recorded in verify-report S3):
  1. Observable HTTP contract on denied tables is **42501 hard deny**, stricter than scenario prose "zero rows are returned" — security intent fully met; wording drift deferred.
  2. Vite chunk-size advisory (index bundle 515 kB > 500 kB) — pre-existing bundle artifact, not introduced by this change.
- SUGGESTION items at verification time: "Other user sees zero rows" GIVEN wording (seed gives isolation one own song; verified property is zero rows *of demo's data*); outbox `seq` NOT NULL/unique hidden in 0001 schema (client util when S6 drain lands); app-level sign-out manual-E2E only.

**CRITICAL issues: none** — archive gate (no CRITICAL) passed.

## Final-State Handoff (orchestrator launch prompt — most recent account, outranks intermediate snapshots)

Work completed after intermediate snapshots were persisted; recorded here as the final state at close:

- **Tasks 3.1–3.3 checkboxes completed**: work landed via PR #85 (commit 2d2e510); `tasks.md` now 12/12. (apply-progress was never persisted for this change; task completion visible only in the final tasks artifact.)
- **Delivery completed on `main`**: commit f00137e (auth swap, PR #82 merged), 8c5663b (infra config, PR #83 merged), 9eb11d9 (RLS policies + grants, PR #86), 2d2e510 (RLS core, PR #85), plus seed PR #84 and 0001_init. All 5 chained PRs merged; **no open PRs remain** for this change.
- **`pnpm lint` zero warnings; `pnpm build` green** — re-verified post-merge in the verify phase.

No unrankable contradictions were found between the persisted artifacts, the launch prompt, and repository evidence.

## Accepted Residue (known, intentional — carried into archive)

- S3 gap-table revisit deferred (recorded in design Open Questions).
- Scenario-wording refinement for the row-level-security spec: "zero rows" prose vs observed 42501 hard-deny (strictly stronger than specified; observable HTTP contract differs from prose).
- Mock `localStorage` orphan keys (accepted residue from apply; no runtime impact on real Supabase session persistence).
- App-level sign-out / `getCurrentUser() === null` verified by manual E2E only (no JS runtime harness; config declares E2E manual).

## Spec Sync Record (delta → main specs)

`openspec/specs/` was empty at archive time; both delta specs are **full specs** (hold `## Purpose` + `## Requirements`; contain no ADDED/MODIFIED/REMOVED/RENAMED sections), so each became a first-time main spec via mechanical shell copy:

| Domain | Action | Verbatim `diff -r` readback |
|--------|--------|------------------------------|
| `row-level-security` | Created `openspec/specs/row-level-security/spec.md` (4157 bytes) | empty (no differences) — copy passed |
| `user-auth` | Created `openspec/specs/user-auth/spec.md` (3610 bytes) | empty (no differences) — copy passed |

Copy mechanism: `mktemp` target + `cp` + `diff -r` readback + `mv` (per sdd-archive Mechanical Copy Contract); no file content passed through a model Read/Write path. Post-move re-verification `diff -r` of both main spec dirs against the archived delta spec dirs: **empty (MAIN-SPECS-IDENTICAL)**.

## Archive Move Record

- Source `openspec/changes/rls-and-offline-first/` → destination `openspec/changes/archive/2026-09-11-rls-and-offline-first/`.
- Pre-move recursive snapshot taken via `cp -R` into a temp dir; EXIT trap guaranteed cleanup.
- `git mv` failed (source directory is untracked — `openspec/` is not tracked in git; git reports "source directory is empty" for untracked content). Fallback rule applied: source still present, snapshot-vs-source `diff -r` empty, destination absent → plain `mv` used.
- Destination collision guard passed (archive dir was empty).
- MANDATORY readback `diff -r snapshot/destination`: **empty (DIFF-OK)** — byte-identical, no truncation/alteration.
- `archive-report.md` is additive-only and excluded from the comparison (it did not exist in the pre-move snapshot).
- Active `openspec/changes/` now contains only `archive/` — the change is no longer active.

## Archive Contents (all artifacts)

- `proposal.md` ✅
- `specs/row-level-security/spec.md` ✅, `specs/user-auth/spec.md` ✅
- `design.md` ✅
- `tasks.md` ✅ (12/12 tasks complete, zero unchecked)
- `verify-report.md` ✅
- `archive-report.md` ✅ (this file)

## Locators

- Archive report: `openspec/changes/archive/2026-09-11-rls-and-offline-first/archive-report.md`
- Synced main specs:
  - `openspec/specs/row-level-security/spec.md`
  - `openspec/specs/user-auth/spec.md`
- Archived change root: `openspec/changes/archive/2026-09-11-rls-and-offline-first/`

SDD cycle for `rls-and-offline-first` is complete.