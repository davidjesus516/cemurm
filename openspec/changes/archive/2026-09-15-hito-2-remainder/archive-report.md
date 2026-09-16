# Archive Report: hito-2-remainder

| Field | Value |
|---|---|
| Change | `hito-2-remainder` (Gigs, PWA Updates & Storage, Personal Preferences; issues #44/#47/#55) |
| Archived on | 2026-09-15 |
| Archive destination | `openspec/changes/archive/2026-09-15-hito-2-remainder/` |
| Artifact store | openspec (files) + Engram observation `sdd/hito-2-remainder/archive-report` |
| Archive mode | standard (no partial archive; no stale-checkbox reconciliation needed — persisted tasks artifact was already final) |
| Cycle status | **COMPLETE — chain closed** |

## Final-State Facts (at close, per authority ranking)

Sources ranked: (1) persisted tasks artifact; (2) orchestrator launch prompt (most recent account); (3) `verify-report`/`apply-progress` snapshots. All forwarded facts were re-verified against repository evidence this session.

1. **Verification: PASS (change-level closure)** — `gentle-ai.verify-result/v1` envelope in `verify-report.md`: `verdict: pass`, `blockers: 0`, `critical_findings: 0`, `requirements: 22/22`, `scenarios: 51/51`, `evidence_revision sha256:2a3e3b71b4948415fdc3fa25f4f39190adff2b964f08d93de4172f7672d32626`, `test (pnpm lint) exit 0` (hash `11d71e77…`, byte-identical across all slice runs), `build (pnpm build) exit 0` (hash `70bb3b94…`). Demos exit 0 per verify transcript (transpose 28, annotations 11, preferences 12, gigs 26, storage 19, offlineCache 6 — no regressions).
2. **Tasks: 31/31 `[x]`, 0 `[ ]`** — persisted `tasks.md` (grep-verified post-move). Native `sdd-status`: `taskProgress {total 31, completed 31, pending 0, allComplete true}`, `applyState: all_done`, `dependencies.archive: ready`, `nextRecommended: archive`, `blockedReasons: []`.
3. **All 11 PRs merged to `main`**, head `5323f87` (verified via `git log --oneline main`):
   - #88 (0004 RLS/orgs+prefs) `e12c216`; #89 (1a) `dfa7c75`; #90 (1a-lifecycle) `052a3e1`; #91 (1b) `5a5853a`; #92 (1c) `9a3df0c`; #93 (2a-SW) `77d4948`; #94 (2a-queue) `53816e5`; #95 (2b) `5e4f7c4`; #96 (3a) `4397b22`; #97 (3b-annotations) `9852501`; #98 (3b-player) `5323f87`.
4. **Ledger settled** — each chained-PR delivery had a passing settle; final 3b acquires (`c4f215a6…`, `9a8e0385…`) each settled `complete`. (Forwarded; ledger not touched this archive.)
5. **Gigs timeline fields + prefs overrides + stage-mode live-update** landed in #90/#96 per plan — no line changes needed in this archive (verified: no diff in this phase beyond spec sync + folder move).

## Spec Sync (delta → main `openspec/specs/`)

| Domain | Action | Details |
|---|---|---|
| `gigs` | **Created** (main spec absent; delta is full spec) | `openspec/specs/gigs/spec.md` — 7 requirements / 15 scenarios (creation, venue, lifecycle, performance record, played tags, notifications data source, offline ops) |
| `pwa-updates-storage` | **Created** | `openspec/specs/pwa-updates-storage/spec.md` — 7 requirements / 15 scenarios (update pipeline, prompt, deferral, queue survival, resilience, storage visibility, quota/eviction) |
| `personal-preferences` | **Created** | `openspec/specs/personal-preferences/spec.md` — 6 requirements / 12 scenarios (transpose, capo, version, annotations/substitution, preservation, practice key/tempo) |
| `row-level-security` | **Updated (composed)** | `gentle-ai sdd-archive-compose` into existing `openspec/specs/row-level-security/spec.md`: `ADDED` 1 requirement ("User preferences owner-scoped", 2 scenarios), `MODIFIED` 1 requirement ("Owner-scoped policies" — gig tables + 2 new scenarios: "Gig owner access on all four gig tables", "Performance items inherit their gig's owner scope"); 4 unrelated requirements preserved byte-for-byte (grep-verified: Hardened lookup helpers, RLS enabled on all 48 tables, Gap tables deny-by-default, Demo seed data) |

Composition evidence: `gentle-ai sdd-archive-compose --canonical openspec/specs/row-level-security/spec.md --delta openspec/changes/hito-2-remainder/specs/row-level-security/spec.md --output …compose-tmp && mv` → exit 0. Full-spec copies mechanical (`cp` → `diff -r` empty → `mv`) — no model Read/Write routing.

## Mechanical Readback Evidence

- Spec full copies: `diff -r` source vs temp — **empty (exit 0) for all 3 domains** (verbatim output captured in phase result).
- Archive folder move: pre-move recursive snapshot vs `openspec/changes/archive/2026-09-15-hito-2-remainder/` — **empty (exit 0)**, i.e. byte-identical. `git mv` succeeded for tracked `tasks.md` (rename then unstaged per constraint); untracked artifacts carried by the directory move; no model-mediated copy anywhere.
- Archived `tasks.md`: 31 `[x]` / 0 `[ ]`.

## Artifacts Read (traceability)

`proposal.md`, `exploration.md`, `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md` (envelope + all slice verdict/compliance sections), delta specs `specs/{gigs,pwa-updates-storage,personal-preferences,row-level-security}/spec.md`, existing main `openspec/specs/{row-level-security,user-auth}/spec.md`. Native `gentle-ai sdd-status hito-2-remainder --json --instructions` (read-only) + `git log --oneline main`.

## Snapshot Reconciliation (per Final-State Authority)

- `apply-progress.md` (final section, written pre-merge at 3b era) stated 3b commits "not pushed (no PR)". Superseded: PR#97 `9852501` + PR#98 `5323f87` merged thereafter (launch prompt + `git log`). Final claim reported above is the merged state.
- Intermediate `verify-report.md` slice sections (PR#1a…PR#3b-annotations) each stated change-level "fail-pending" — superseded by the final change-level section of the same report: envelope flipped `verdict: pass`, 22/22, 51/51, 0 CRITICAL. The PR#3a-era CRITICAL S3 (additive vs replacement override semantics) was closed in-session by fix `08aa587` and re-verified (`**CRITICAL**: None` in the re-run); nothing open at close. `gigs.js` "live RLS chain verified" per PR#1a evidence — kept as recorded.
- No unrankable contradictions remained at close; no distinct failures were merged into one causal story (S3 critical documented with its own proven diagnosis + fix commit).

## Risks / Notes

- Standing verify warning (non-blocking): manual browser E2E walk recommended pre-merge across all slices — carries into product QA, not archive defects.
- Deferrals recorded in-slice and in archived specs: #44 org-visibility, #47 tooltips (→onboarding) + export deletion (→export feature), #55 org/band/event-context + agreed-key/conflicts/rebase/duet/fork/orchestral/range scenarios (Hito 3/4/6); slash-chord engine support (upgrade path documented in `transpose.js`).
- `taskProgress` and verify counts unchanged by this archive; file modes normalized to repo convention (0644).

## Complete

SDD cycle for `hito-2-remainder` fully planned, implemented, verified, delivered (11 PRs merged), and archived. Chain complete; ready for next change.