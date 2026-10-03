# Sync status-bearing docs to current repo state

## Objective

Bring every status-bearing document in the repo back in line with `origin/main` = `762a040`,
and produce a verified reconciliation proposal for the 21 open GitHub issues without
mutating GitHub.

## Problem

Prose in this repo asserts milestone state that git contradicts. The drift is not opinion —
each claim below was checked against `origin/main` during this session, and every one is wrong.

| Document | Asserts | Verified on `origin/main` |
|---|---|---|
| `docs/master-plan.md` §0 | `main = 8b66394`, 7 test files, 27 migrations `0001`–`0020` + gap at `0021` | `main = 762a040`, 9 test files, **33** migrations `0001`–`0033`, no gap |
| `docs/master-plan.md` §2 | 12 Hito 5 commits on 4 unmerged branches | all Hito 5 chains merged; `0021`–`0033` all landed |
| `docs/master-plan.md` §2 | `0019:184` chain-breaker unresolved, `#172` a hard prerequisite | `0029`–`0033` exist, so the chain applies past `0019` |
| `docs/mvp-scope.md` | Hito 5 "in progress", plan-freeze chain not merged | Hito 5 complete on main |
| `docs/mvp-scope.md` progress log | last row "plan-freeze PR 3/10, not merged" | merged |
| `docs/mvp-scope.md` | `export-and-sharing` ~1 of 23 shipped | needs re-verification, not assertion |
| `README.md` | status 2026-09-23, "Hito 5 in progress" | Hito 5 merged |
| `README.md` | "hosted project `kspnacfcietqikbufcka.supabase.co`" | local stack; `AGENTS.md` calls that URL stale |
| `README.md` | "no CI/deploy" | CI runs on push to `main` and every PR |
| `README.md` | scripts: `build`, `dev`, `lint`, `preview` | `build`, `check:visual`, `dev`, `lint`, `preview`, `test`, `test:watch`, `typecheck` |
| `README.md` doc list | links `docs/design-system.md` as the design system | superseded by `skills/cemurm-visual-system/SKILL.md` |
| `docs/technical-spec.md:241` | data layer on hosted Supabase, migrations `0001`–`0019`, "no CI" | local stack, `0001`–`0033`, CI present |
| `docs/local-dev.md:29` | seed creates two confirmed users | three: `demo@`, `isolation@`, `outsider@` |
| `openspec/config.yaml` | "NO test framework, NO typecheck, NO CI", `test_command: ""`, six `testing:` flags `false` | Vitest 3.2.7, `pnpm test`, `pnpm typecheck`, CI with lint + visual gate + test + build |
| `openspec/config.yaml` | `rules.design` cites `components/, pages/, hooks/, lib/, store/, utils/` | post-relocation: `app/`, `features/`, `data/`, `domain/`, `offline/`, `ui/`, `integrations/`; no `store/`, no Zustand |
| `CONTRIBUTING.md` | `npm install`, `npm run lint`, `github.com/your-org/cemurm` | pnpm only, `github.com/davidjesus516/cemurm` |
| `AGENTS.md:158` | 42 `.feature` files, 656 scenarios | **45** files, **713** scenarios |
| `AGENTS.md:45-51,60` | "only four files are actually checked", baseline "now 48" | 47 files carry `// @ts-check`; `--listFiles` count is **60** |
| `docs/engineering-review-backlog.md` | checkJs baseline as open debt | baseline shipped; re-verify before editing |
| `docs/design-system.md` | 464 lines, presented as the design system | superseded per `AGENTS.md`; do not delete, mark superseded |

## Why

Every one of these files is load-bearing. `openspec/config.yaml` feeds SDD routing — its
`test_command: ""` and "NO test framework" line would make a future phase conclude no runner
exists and skip TDD that is in fact runnable. `AGENTS.md`'s "only four files" is worse: a
reader who trusts it believes the `@ts-check` baseline is 4 files when 47 opt in, so they
cannot tell whether a new pragma is expected or a mistake.

The drift also blocks planning. `master-plan.md` §2 orders work by Hito 5 chain merges that
already happened; anyone sequencing from it re-plans shipped work.

## Scope

**In scope** — local, reversible doc edits:

- `README.md`
- `docs/master-plan.md`
- `docs/mvp-scope.md`
- `docs/technical-spec.md` (§ status paragraph only)
- `docs/local-dev.md` (§ seed identities only)
- `docs/design-system.md` (superseded banner only, no deletion)
- `docs/engineering-review-backlog.md` (verify before touching)
- `openspec/config.yaml`
- `CONTRIBUTING.md`
- `AGENTS.md`

**In scope** — read-only GitHub reconciliation. Produce a table for each of the 21 open
issues: `closable because <evidence on main>` vs `alive because <code still does X>`.

**Out of scope** — no GitHub mutation. No issue closed, commented, labeled, or reopened. No
milestone or project-board edit. No source-code change. No migration.

## Constraints

1. Every replacement number gets re-derived from `origin/main` at write time, not from this
   document. This file records what was true when measured; it can go stale the moment it lands.
2. Do not delete a superseded document. `design-system.md` and `technical-spec.md` predate
   large parts of reality; mark them superseded with a pointer to what replaced them.
3. Preserve each file's existing voice and structure. These are long documents with deliberate
   narrative — corrections are appended or edited in place, never rewritten wholesale.
4. Do not touch `features/**`, `src/**`, or `supabase/**`.
5. Record what was checked and what was not. A claim left unverified is written down as
   unverified, not silently dropped.

## Acceptance criteria

- [ ] Every stale assertion in the table above is either corrected in place or marked
      superseded with a pointer, and each correction cites the git evidence.
- [ ] `openspec/config.yaml` reports a real `test_command` and `typecheck_command` and its
      `rules.design` names the post-relocation layout.
- [ ] `AGENTS.md` methodology table reads 45 files / 713 scenarios; the type-checking section
      describes the 47-file opt-in baseline, not four files.
- [ ] `README.md` no longer names a hosted Supabase project or denies CI.
- [ ] A reconciliation table covers all 21 open issues with per-issue evidence.
- [ ] No GitHub write call was made.

## Checks

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
bash scripts/check-visual-contract.sh
```

Doc-only changes should leave every gate exactly as it was. A gate that moves is a finding.

## Tasks

- [ ] **T1** — Re-derive every count from `origin/main` (migrations, test files, scenarios,
      `@ts-check` count, `tsc --listFiles`, package scripts, CI steps, seed users).
- [ ] **T2** — `README.md`: status line, backend row, deployment row, script list, doc index.
- [ ] **T3** — `docs/master-plan.md`: §0 state table, §2 migration/numbering sections, §5
      doc-rot table, §6 order diagram.
- [ ] **T4** — `docs/mvp-scope.md`: Hito 5 status, progress log, planned-vs-implemented,
      projection dependency claim.
- [ ] **T5** — `openspec/config.yaml`: context, `strict_tdd`/runner fields, `testing:` flags,
      `rules.design`.
- [ ] **T6** — `AGENTS.md`: feature count, type-checking baseline, any other drifted count.
- [ ] **T7** — `CONTRIBUTING.md`: pnpm, real remote URL, `store/` claim if present.
- [ ] **T8** — `docs/technical-spec.md`, `docs/local-dev.md`, `docs/design-system.md`:
      status paragraph, seed identities, superseded banner.
- [ ] **T9** — `docs/engineering-review-backlog.md`: verify each item against main before
      editing; close the ones that shipped.
- [ ] **T10** — Reconcile all 21 open issues against `origin/main`. Read-only. Produce the
      evidence table.

## Authorized scope

Local edits to the ten files listed under Scope. Branch `docs/sync-current-state`, cut from
`origin/main` = `762a040`. Push and PR are the maintainer's call under ordinary repository
policy; no direct push to `main`, no merge.

## Progress

- [x] **T1** — counts re-derived from `origin/main` = `762a040`: 33 migrations
      `0001`–`0033` contiguous, next free `0034`; 9 test files / 307 tests; 45
      `.feature` files / 713 scenarios; 47 `@ts-check` opt-ins; `tsc --listFiles`
      reaches 60 `src/` files; 8 package scripts; CI = install → lint → visual →
      test → build (no typecheck); 13 smoke scripts; 3 seed users.
- [x] **T2** — `README.md`: status, backend row (hosted → local), deployment row
      (CI exists), full scripts table, doc index (points at the visual-system
      skill, marks `design-system.md` superseded, adds `master-plan.md`).
- [x] **T3** — `docs/master-plan.md`: re-scoped, not archived. §0 rebuilt from
      `762a040`; §2 numbering / `0019:184` chain-breaker marked RESOLVED; §3
      rewritten (9 of 10 findings fixed, D open); §6 replaced with the N0–N5 order
      that actually remains. §1/§2/§5b kept as landed post-mortems.
- [x] **T4** — `docs/mvp-scope.md`: Hito 5 complete with a per-migration PR table;
      progress log rows added; the projection-depends-on-external-display claim
      proven false and corrected.
- [x] **T5** — `openspec/config.yaml`: real `test_command`/`typecheck_command`,
      `testing:` flags corrected, `rules.design` on the post-relocation tree.
      `coverage_command` left empty on purpose — no coverage provider installed.
- [x] **T6** — `AGENTS.md`: 45/713; type-checking section rewritten for the 47-file
      opt-in baseline with a re-measured error table; `listFiles` 48 → 60; smoke
      6 → 13.
- [x] **T7** — `CONTRIBUTING.md`: pnpm only, real remote, full check sequence,
      post-relocation tree, no `store/`.
- [x] **T8** — `technical-spec.md` §7 status, `local-dev.md` seed identities,
      `design-system.md` supersession banner cross-reference count.
- [x] **T9** — `docs/engineering-review-backlog.md`: all nine items re-verified.
      Closed with evidence: #1 (partially), #3, #7, #8. #4/#6 open, #5 premise
      false, #9 not verifiable from the tree.
- [x] **T10** — 21 open issues reconciled read-only against `origin/main`. Report
      delivered in-conversation; no GitHub write call was made.
- [x] **Unplanned find** — the visual contract gate is **red on `main` itself**
      (3 rules), verified by stashing every edit and re-running: byte-identical
      output. Because CI runs the gate between lint and test, **CI on `main` is red
      today**. Not fixed: `src/**` is outside this change's scope, and raising a
      ceiling would hide the regression. Recorded as N0 in `master-plan.md` §6.

## Verification evidence

Run on `docs/sync-current-state`, working tree with all edits applied:

```
pnpm test        → exit 0 — 9 files, 307 tests passed
pnpm typecheck   → exit 0
pnpm lint        → exit 0
pnpm build       → exit 0 — 207 modules, built in 2.22s
bash scripts/check-visual-contract.sh → exit 1 — 3 failing rules
```

The visual gate was proven pre-existing, not introduced: `git stash` of all edits,
re-run → exit 1 with byte-identical findings; `git stash pop` → edits restored.

Spot-checks performed by the orchestrator, not taken on the writer's word:

- Nine claimed fix commits (`20e79d0`, `92e64f6`, `63d1ed3`, `0cf6907`, `791d1de`,
  `e34e7c6`, `23de152`, `057120a`, `5cc50f6`) each exist with the claimed subject and
  each is an ancestor of `origin/main`.
- `src/domain/chart/parser.test.js:94-99` reads as quoted, asserting the corrected
  `[{ sectionIndex: 2, key: 'G' }]`.
- `features/external-display.feature:44` is the "separate targets" scenario; neither
  `ExternalDisplay.jsx` nor `Projection.jsx` imports the other.
- 47 `@ts-check` opt-ins, `tsc --listFiles` = 60, 13 smoke scripts, `design-system.md`
  = 514 lines — all re-measured and matching what was written.

## Next step

T10 report delivered. Remaining outside this change: N0 (the red visual gate) blocks
CI on every PR, including this one.

---

## Round 2 — re-sync to `origin/main` = `e849738` (2026-10-02)

### Objective

Rebase this branch onto current `origin/main` (`e849738`), resolve the two overlaps main gained
since `762a040`, re-verify every status claim the ten new commits could have moved, and land the
result as docs-only commits ready for delivery.

### Delta measured before any edit (2026-10-02)

| Fact | Value |
|---|---|
| `origin/main` | `e849738`; this branch is 10 commits behind, 2 ahead |
| Merged since `762a040` | #236 (vite `^5.3.3`→`^6.4.3`, vitest `^3.2.7`→`^5.0.2`), #273 (AGENTS Vitest pairing — **duplicates local `4d41e6f`**), #274/#275 (moderation wiring), #276 (backlog items 10–14 + `odd/tasks/merge-queue-drain-and-findings.md`) |
| CI on `main` | still red: the CI job failed on the #274/#275/#276 merge pushes (`gh run list`, 2026-10-02); CodeQL green; N0 unchanged |
| Open PRs | #277 (typecheck in CI), #278 (visual-gate ratchet), #279 (team quick wins) |
| This checkout's `node_modules` | vite 5.4.21 / vitest 3.2.7 — pre-#236 = backlog item 14; gates here run old deps (disclosed; installing mutates the maintainer's tree and needs his OK) |
| Local DB (environment, not repo docs) | 30/33 applied; `0021`, `0032`, `0033` absent — out of scope here |
| Dirty working tree | 7 `src/features/**` files (another actor's visual migration; maintainer: warn, do not touch) — never staged, never committed, byte-identical |

### Tasks

- [x] **T11** — `git rebase --autostash origin/main`: drop duplicate `4d41e6f` (#273), resolve
      `AGENTS.md` (both sides: the sync's 2026-09-30 corrections AND main's pairing paragraph,
      exactly one copy) and `docs/engineering-review-backlog.md` (both sides: the 2026-09-30 item
      annotations AND #276's items 10–14).
- [x] **T12** — re-verify/update stale claims: `README.md:7` status line; `docs/master-plan.md`
      document-status block, §0 state table, CI-red verified date, Vitest-pin paragraph → pairing
      rule; `openspec/config.yaml` Vite 5 / Vitest 3.2.7 strings; `docs/mvp-scope.md` "as of"
      pointers + progress log; any drained-queue / zero-open-PRs claim.
- [x] **T13** — backlog merge + re-verify item 14 against the measured `node_modules` above.
- [x] **T14** — gates + evidence: run the check sequence, record exact results with the stale-deps
      and dirty-tree caveats, append them below.

### Constraints (round 2)

1. Stage explicit paths only; the 7 dirty `src/**` files stay uncommitted and byte-identical.
2. No `pnpm install`, no push, no GitHub mutation from this round's writer.
3. Every replacement number re-derived from `origin/main` at write time, not copied from round 1.

### Progress (round 2)

- [x] **T11** — `git rebase --autostash origin/main` completed. `0d72796` replayed with a single
      content conflict (`docs/engineering-review-backlog.md`), resolved by the both-sides rule:
      the branch's 2026-09-30 supersession blockquote stays attached to the two "Estado de
      entrada" paragraphs it names, main's "Los ítems 10 a 14…" block follows it — nothing
      dropped from either side, no renumbering. `AGENTS.md` auto-merged cleanly with both the
      branch's 2026-09-30 corrections (45/713, 47 `@ts-check`/60 listFiles, 13 smokes) and main's
      #273 pairing paragraph, exactly one copy. The `4d41e6f` replay hit a wording-variant
      conflict against #273's paragraph, was resolved to main's side, and git dropped it as an
      empty commit: `origin/main..HEAD` = `5912ca9` only, no duplicate Vitest commit. Autostash
      restored the dirty tree — the 7 `src/features/**` files are modified-and-unstaged and
      `git diff -- src/` sha256 = `96700b017fc277c329c83182b965d3c6b18ed0f61b0f3d004c66e1932294f6c3`,
      byte-identical to the pre-rebase measurement.
- [x] **T12** — every claim re-verified against `e849738` before editing. Edited: `README.md:7`
      (date/SHA → 2026-10-02 / `e849738`; content — Hito 1–5 merged, `0021`–`0033` on `main`,
      33 migrations — re-checked and still true); `docs/master-plan.md` (status-block header now
      "re-verified 2026-10-02"; §0 bullet + §0 date/SHA row → `e849738`; CI-red claim re-verified
      2026-10-02 with `gh run list --branch main` — the CI job failed on the #274/#275/#276 merge
      pushes, CodeQL green; 307-tests pointer → `e849738` with the fresh `pnpm test` run; the
      "Vitest is pinned to **3.2.7** deliberately…" blockquote replaced with the #236 pairing rule
      in this document's voice — the pairing survives, not the pin); `openspec/config.yaml`
      (Vite 5 → Vite 6, Vitest 3.2.7 → Vitest 5.0.2 on lines 4, 8, 16, 29, 31, 48; explanatory
      comments and the "Corrected 2026-09-30" note preserved; `9 test files, 307 tests` kept —
      `pnpm test` confirms it); `docs/mvp-scope.md` (Hito 5 status line + "Planned vs. implemented"
      header → 2026-10-02 / `e849738`, original date kept as origin; three progress-log rows
      added for #236/#273, #274/#275, #276 in the table's existing format). Left historical on
      purpose: every dated "verified/repaired 2026-09-30 against `762a040`" record in
      `master-plan` §2/§3/§5/§6 and `AGENTS.md`, and `CONTRIBUTING.md`,
      `docs/technical-spec.md:241`, `docs/local-dev.md`, `docs/design-system.md` — re-grepped,
      none of their current-state claims is false (33 migrations, CI present, 3 seed users, 14
      cross-references all still hold). `AGENTS.md` "CI does not run typecheck" kept — #277 is
      open, not merged — and no pending-PR note added (that section has no such convention). No
      drained-queue or zero-open-PRs claim exists in `master-plan` §5/§6; #277/#278/#279
      falsified nothing that was written.
- [x] **T13** — backlog merge verified by full re-read: the "Status review 2026-09-30" header
      note and the annotations on items 1, 3, 4, 5, 7, 8, 9 all survive (items 2 and 6 were
      left intact by round 1 by design); items 10–14 from #276 all survive; the "Los ítems 10 a
      14…" paragraph and the `odd/tasks/merge-queue-drain-and-findings.md` reference are in
      place; nothing renumbered. Item 14 re-verified against reality: `node_modules` now reads
      vite **6.4.3** / vitest **5.0.2** — synced with main's lockfile — so its 2026-10-01
      premise no longer holds in this checkout; a dated ⚠️ update was appended and the original
      text kept as measured. No `pnpm install` was run by this round's writer.
- [x] **T14** — gates run after the edits; exact results in the evidence section below. Two
      findings recorded there: (1) the local visual gate exits **0**, not round-1's exit 1 — the
      7 dirty `src/features/**` files are a visual migration that pays the ratchet down (01b
      92→82 at ceiling, 02 274→247, 06 1→0), while `main` itself is still red at this exact
      step (CI run `36997399609`, job `lint-and-build`, step "Run
      bash scripts/check-visual-contract.sh" = failure); (2) `node_modules` synced from vite
      5.4.21/vitest 3.2.7 to 6.4.3/5.0.2 at 22:00 during this round's first `pnpm test` — no
      `pnpm install` was invoked, most likely pnpm's own pre-run dependency verification or a
      concurrent actor; not distinguishable after the fact.

### Verification evidence (round 2)

Run on `docs/sync-current-state`, after the rebase and the round-2 edits, 2026-10-02:

```
git log --oneline origin/main..HEAD   → 5912ca9 docs: sync status-bearing docs to main 762a040
                                          (single commit; duplicate 4d41e6f dropped as empty)
git status --short                     → the 7 known src files + this record modified-unstaged;
                                          nothing staged
git diff -- src/ (sha256)              → 96700b017fc277c329c83182b965d3c6b18ed0f61b0f3d004c66e1932294f6c3
                                          — byte-identical to the pre-rebase value

pnpm test        → exit 0 — 9 files, 307 tests passed (RUN v5.0.2)
pnpm typecheck   → exit 0
pnpm lint        → exit 0
pnpm build       → exit 0 — built in 2.30s (>500 kB chunk warning pre-existing on main)
bash scripts/check-visual-contract.sh → exit 0 — "visual contract: OK (10 rules checked, 0 failing)"
                                          01b 82/82 WARN, 02 247/252 WARN, 06 0 occurrences.
                                          CAVEAT: exit 0, not round-1's exit 1, because the 7 dirty
                                          src files (another actor's visual migration, 18 accent/
                                          palette removals in their diff) pay the ratchet down.
                                          Not stashed for comparison, per constraints. `main` is
                                          still red here (run 36997399609 fails at this step).
```

Environment disclosures: (a) gates ran against node_modules vite 6.4.3 / vitest 5.0.2 —
`node_modules` synced mid-session at 22:00 (T14 finding), so the round-2 assumption "gates run
pre-#236 deps" no longer held by run time; `package.json` and `pnpm-lock.yaml` are unmodified vs
HEAD and no `pnpm install` was invoked. (b) `gh run list` re-verified CI on `main` red and
CodeQL green at 2026-10-02; open PRs #277/#278/#279 still open — the "no typecheck in CI" claims
in `AGENTS.md`, `README.md`, `master-plan.md` §0 and `openspec/config.yaml` remain true.
### Delivery (round 2)

The re-sync ships as a chained-branch sequence, chosen by the maintainer on 2026-10-03: the full
diff is ~1210 lines across 11 files and this repo caps PRs at 400 changed lines. Each slice carries
that file's round-1 corrections and its round-2 updates together; every tree is cut from this
branch, and slice 4 reproduces this branch's tree exactly.

| Slice | Branch | PR base | Files |
|---|---|---|---|
| 1 | `docs/sync-current-state-pr1-entrypoint-docs` | `main` | README.md, CONTRIBUTING.md, AGENTS.md, openspec/config.yaml, docs/technical-spec.md, docs/local-dev.md, docs/design-system.md |
| 2 | `docs/sync-current-state-pr2-master-plan` | slice 1 | docs/master-plan.md |
| 3 | `docs/sync-current-state-pr3-scope-backlog` | slice 2 | docs/mvp-scope.md, docs/engineering-review-backlog.md |
| 4 | `docs/sync-current-state-pr4-odd-record` | slice 3 | odd/tasks/docs-sync-current-state.md |

Merges to `main` happen in slice order as the maintainer approves them; GitHub retargets each
child PR to `main` once its predecessor lands. This reference branch (`docs/sync-current-state`)
keeps its two original commits as provenance and is not pushed.
