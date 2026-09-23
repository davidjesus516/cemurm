# Docs Sync — Current State + Diagrams

## Objective

Bring the repository's status-bearing documentation in line with the actual implemented state (Hito 1–4 shipped, Hito 5 in progress) and add accurate diagrams (current architecture + hito roadmap). Nothing invented: every claim must trace to `main` tree, `git log`, migrations, routes, or shipped openspec specs.

## Problem

Docs describe a much earlier state: README says "Hito 1 implemented" with localStorage mocks; AGENTS.md says offline-first is "planned, not built"; `docs/mvp-scope.md` progress log stops at 2026-09-14; `docs/technical-spec.md` says "offline: planned, not implemented" and shows a stale ASCII architecture/folder map; `docs/product-brief.md` says Stage Mode "not yet shipped". There are no diagram files at all.

## Why

New contributors and agents (including this orchestrator) read these docs as ground truth. Stale status lines cause wrong assumptions about what exists (`public/sw.js`, routes, lib modules, migrations 0001–0019 on main; 0021 on the hito5 branch).

## Authorized scope

Docs and diagrams only — **no source code, no migrations, no behavior changes.** Files:

- `README.md` — status line, tech stack table accuracy, quick start, docs index
- `AGENTS.md` — "What this is" status, project layout, spec/docs pointers
- `docs/mvp-scope.md` — per-hito implementation status, progress log, planned-vs-implemented
- `docs/technical-spec.md` — architecture diagram (replace ASCII with mermaid + archify HTML), §3.4 offline status, §5 folder structure, §6 PWA status, §7 deployment
- `docs/product-brief.md` — beta scope status + timeline
- `docs/diagrams/` — new archify deliverables: current architecture + hito roadmap (HTML), plus mermaid code blocks inline in the md docs for GitHub rendering

## Ground truth (verified 2026-09-23, branch docs/current-state-sync from main)

- `main` HEAD `894845a`; migrations `0001_init.sql` … `0019_rehearsal_workflow.sql` (0021 `plan_freeze` exists only on `feat/hito5-plan-freeze`, NOT on main).
- `public/sw.js` EXISTS on main (offline shipped, Hito 2).
- Routes on main (`src/App.jsx`): `/`, `/songs`, `/songs/:id`, `/songs/:id/practice`, `/library`, `/moderation`, `/profile/:userId`, `/setlists`, `/setlists/:id`, `/setlists/:id/stage`, `/gigs`, `/gigs/:id`, `/bandmates`, `/organizations`, `/services`, `/services/:id`, `/rehearsals`, `/rehearsals/:id`, `/notifications`, `/settings`, `/settings/storage`, `/auth`, `*`; guardian-consent gate wraps the authed tree.
- Pages: 24 files in `src/pages/` (incl. Storage, Moderation, PublicLibrary, Organizations, Services, Rehearsals, Settings).
- `src/lib/`: 31 modules incl. offlineCache/offlineQueue/offlineSync/updateManager/storage (Hito 2), bandmates/setlistCollab/comments/notifications (Hito 3), publicLibrary/follows/moderation/orgRepertoire/minors/scaleCatalog/degreeResolver/progressions (Hito 4), services/rehearsals (Hito 4/5).
- `src/store/` does NOT exist; `src/utils/relativeTime.js` exists.
- openspec shipped specs: user-auth, row-level-security, gigs, personal-preferences, pwa-updates-storage, shared-setlist-collaboration, collaboration-bandmates, collaborative-comments, notifications. Archived changes dirs: `2026-09-11-rls-and-offline-first`, `2026-09-15-hito-2-remainder`, `2026-09-18-hito-3-band-collaboration`, `2026-09-19-hito-3-notifications`.
- `features/`: 42 `.feature` files.
- Merged since mvp-scope's last progress row (2026-09-14): Hito 3 (band collaboration + notifications, archived 09-18/09-19), Hito 4 (public library S4.1 PRs #125-#127, contributions S4.2 PRs #131/#136, community moderation #138, org repertoire #139, music theory #137, minors consent, service planning, rehearsal workflow — merged via branches, some not numeric PRs). Hito 5: `feat/hito5-plan-freeze` (3 commits unpushed beyond main, PR 3/10 of chain), branches `feat/hito5-external-display`, `feat/hito5-in-app-feedback`.
- `pnpm lint` / `pnpm build` unaffected by docs changes; package manager pnpm, lockfile `pnpm-lock.yaml`.

## Tasks

- T1 — README.md refresh: status line (Hito 1–4 shipped, Hito 5 in progress), tech stack accuracy (offline/Workbox shipped, hosted Supabase + local stack), quick start unchanged, docs index updated. — DONE (commit 73b8e8e)
- T2 — AGENTS.md refresh: "What this is" current state, entry points/routes, project layout, specs & docs list (openspec pointers), gotchas preserved. — DONE (commit 73b8e8e)
- T3 — docs/mvp-scope.md: per-hito status lines, progress log rows for Hito 3/4 + Hito 5 in progress, planned-vs-implemented summary; keep feature→hito mapping. Add mermaid hito-roadmap diagram. — DONE (commit 73b8e8e; mermaid roadmap kept as technical-spec mermaid + archify HTML roadmap, mvp-scope uses status text + progress log)
- T4 — docs/technical-spec.md: replace ASCII architecture block with accurate mermaid architecture diagram (+ archify HTML linked from docs/diagrams/), §3.4 offline → shipped, §5 folder structure against main tree, §6 PWA → shipped, §7 deployment reality (hosted Supabase project used; cloud REST + local stack both). — DONE (commit 73b8e8e)
- T5 — docs/product-brief.md: beta scope = Hito 1–4 shipped, Stage Mode shipped, Hito 5 in progress, timeline table kept. — DONE (commit 73b8e8e)
- T6 — Architecture diagram (archify): standalone HTML `docs/diagrams/architecture.html` — DONE (validate 9/9 showcase, deliver spec `aff7eec2…` artifact `d073554e…` 719,900 B, visual-check containment+readability pass at 1440/1600/1920/2048 px light+dark; evidence sidecars kept in /tmp/opencode/diagram-evidence/). Commit 8dc58bd.
- T7 — Hito roadmap diagram (archify): standalone HTML `docs/diagrams/hito-roadmap.html` — DONE after CORRECTING stale statuses (initial worker copy had Hito 3–6 'not started' from old mvp-scope; corrected to Hito 1–4 complete, Hito 5 in progress, Hito 6 planned; validate 9/9 showcase, deliver spec `cf5a2cea…` artifact `64bfbcf0…` 708,084 B, visual-check pass; sidecars in /tmp/opencode/diagram-evidence/). Commit 8dc58bd.
- CHK — Read-back all edited docs, spot-check every claimed path/route/module against the tree, verify archify receipts, `git status` clean of unintended files. — DONE (verified: 24 pages / 14 hooks (13 .js + 1 .jsx) / 31 lib modules counted against tree; routes match src/App.jsx; migrations tail = 0019 on this branch; both diagram HTMLs exist with recorded SHAs; only "localStorage mocks" match is the intentional mvp-scope note; git status shows only the 5 docs + docs/diagrams + this file).

## Acceptance criteria

- Every status claim matches the ground-truth block above; no invented features.
- All edited paths exist after edit; docs/diagrams contains the two archify HTML artifacts with passing showcase receipts.
- No source, migration, or lockfile changes (docs-only diff).

## Verification

- Read-back + path spot-check per file (grep/glob against tree).
- Archify: `node bin/archify.mjs validate <type> <candidate.json> --quality showcase --json` (9 checks, 0 errors/warnings) then `deliver ... --quality showcase --json` per diagram.

## Delivery

- ask-on-risk (default); forecast well under 400 authored changed lines → single docs PR, no chain question. Running count from work-unit commits: 73b8e8e (159+/119-), 8dc58bd (diagrams, generated HTML).
- RDD: **global on** per `gentle-ai review mode status`. Docs-only passive change → structural readback is the proportional check; run `review assess` on the accumulated commits for the record after close.

## Progress

- 2026-09-23: branch `docs/current-state-sync` created from main `894845a`. Work moved to isolated worktree `/home/david_jesus516/Documentos/GitHub/cemurm-worktrees/docs-current-state` because the main checkout was on `feat/hito5-spotify-enrichment` with an active parallel session — never disturb it.
- Work-unit commits on `docs/current-state-sync`:
  - `73b8e8e` docs: sync status-bearing docs to current state (5 files).
  - `8dc58bd` docs: add archify architecture and hito roadmap diagrams (2 HTML).
- Archify correction note: first worker run authored the roadmap from the *stale* mvp-scope statuses (Hito 3–6 "not started"). Corrected the candidate JSON with real statuses and re-delivered (`cf5a2cea…` spec).