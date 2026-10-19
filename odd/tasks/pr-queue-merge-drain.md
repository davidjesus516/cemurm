# PR queue merge drain — execution record

- Feature: `pr-queue-merge-drain`
- Date: 2026-10-11
- Status: **11 of 12 landed (batch 3: #299 reshaped + merged).** #336/#335 deferred (project board not started; findings below). #357 blocked on undefined symbols in its own tree (`AppLayout.jsx`),
  branch actively authored by Antony-Figueroa — untouched on purpose.
- Main reference: batch 1 `8775efd` → `515fd14`; batch 2 → `f605cd2`; batch 3 (2026-10-12) → `c14e977`

> Execution record, not a capability spec. What was done and how it was verified goes
> here; what a capability *is* goes in `openspec/specs/`.

## Objective

Land the open PRs that are already green and conflict-free, so the open queue reflects
only items that genuinely need rework or a product decision.

## Problem / why

30 PRs are open. A scan of all 30 (`gh pr view --json mergeable,mergeStateStatus,
reviewDecision,statusCheckRollup`) returned:

- **0 approvals**, across every PR. The `review` ruleset (id `24904691`) requires 1
  approving review with `require_last_push_approval: true`, and GitHub does not allow
  self-approval. Every PR is authored by `davidjesus516`, so without the maintainer's
  `pull_request`-mode bypass **no PR has an in-platform approval path**.
- **0 PRs in a mergeable-by-policy state**: all green candidates are `BEHIND` main.
  The `checks` ruleset (id `24904685`) sets `strict_required_status_checks_policy: true`
  and has **no bypass actors**, so main must be contained in the head branch before the
  merge, and CI cannot be skipped by anyone — including via `--admin`.

Consequence: the drain is **strictly serial**. Each merge advances `main`, which returns
every remaining PR to `BEHIND`; pre-updating all branches would burn CI on runs that are
invalidated by the next merge. Order is update-branch → CI green → merge --admin →
next one.

## Scope (authorized)

The 9 PRs that are MERGEABLE with all three required checks green and zero unresolved
review threads. User decision (2026-10-11): drain them with the maintainer `--admin`
bypass, CI never bypassed.

| # | Branch | Authored Δ | Order note |
|---|---|---|---|
| 354 | `feat/hito5-midi-pr1` | 235+/181− | — |
| 352 | `feat/hito5-congregation-projection-pr1` | 311+/6− | #353 stacks on it but has red CI |
| 350 | `fix/hito4-polish-moderation-client` | 6+ | zero file overlap with #346 |
| 346 | `fix/hito4-polish-moderation` | 28+/5− | zero file overlap with #350 |
| 345 | `fix/hito4-polish-music-theory` | 13+/1− | — |
| 318 | `hotfix/minors-guardian-consent-server-gate` | 413+/41− | — |
| 279 | `feat/team-integration-quickwins` | 173+ | had an open review request to Antony |
| 356 | `feat/nav-cardnav-pr1` | 421+/241− | must land before #357 |
| 357 | `feat/nav-cardnav-pr2` | 1406+/381− | descendant of #356 |

## Out of scope (explicitly, reported not touched)

- **Red CI** (7): #353, #351, #336, #335, #301, #299, #288 — needs rework, not a merge.
- **Conflicting** (5): #355, #349, #348, #314, #282 — needs real conflict resolution.
- **Stack E2E** (#289, #290, #291, #295, #297, #313): bases are other stack branches, not
  `main`; separate unit decision (per `odd/tasks/make-prs-actionable.md`).
- **`CHANGES_REQUESTED`** (#283, #284): Raymond/Antony review not addressed.

## Checklist

- [x] **T1** Drain #354 — midi. Flow validated: update-branch moved the head
      `329eeaf` → `2de01da`, the three required checks went green on the **new** head,
      `mergeStateStatus` settled at `MERGEABLE BLOCKED` (only the approval missing), and
      `gh pr merge --admin` landed it. Merge commit `affba1e`. `--admin` bypasses the
      `review` ruleset only; the `checks` ruleset is not bypassable by anyone, which is
      exactly the split the 2026-10-11 ruleset notes describe. One cycle ≈ 85 s.
- [x] **T2** Drain #352, #350, #346, #345 — merge commits `bdda2b5`, `6f1be6c`, `74f37d8`,
      `34158c4`. All four were `MERGEABLE BLOCKED` pre-merge, required checks green on the
      post-update head. The `#350`/`#346` pair was verified independent beforehand
      (neither branch is an ancestor of the other, and their changed-file sets are
      disjoint), so their relative order carried no risk.
- [x] **T3** Drain #318, #279 — merge commits `9ce1a19`, `d2f5911`. #279 had an open
      review request to Antony-Figueroa; merged under the user's `--admin` decision.
- [x] **T4** Drain #356 → #357 in order. #356 landed (`515fd14`). **#357 did not**:
      `update-branch` refused with a real conflict after #356 merged.
- [x] **T5** Verify each merge on `main` — `git log --oneline origin/main` shows all nine
      `Merge pull request` commits in order, each preceded by its `Merge branch 'main' into
      <branch>` update commit. CI on `main` green on the intermediate heads
      (`9ce1a19`, `d2f5911`), confirming the merged state is not just recorded but verified.
- [x] **T6** Report final queue state (30 → 21 open; 8 of 9 landed; #357 blocked).

## Acceptance criteria

- Each landed PR: `state == MERGED`, recorded merge commit, required checks green on the
  pre-merge head — **CI never bypassed**.
- Any PR that fails update-branch, CI, or merge is skipped and reported, never forced.
- No force-push, no direct commit to `main`.
- Not-ready PRs are untouched and named in the final report.

## Checks

- `gh pr view <n> --json state,mergeCommit,mergeStateStatus,statusCheckRollup`
- `gh run list --commit <sha>` when a check result is ambiguous
- Post-drain: `git fetch && git log --oneline origin/main` to confirm the merge commits

## Progress

- 2026-10-11: created. Full 30-PR scan recorded; serialization constraint established;
  user authorized the `--admin` drain of the 9 green PRs. Starting T1.
- 2026-10-11 23:31: drain finished. **8 of 9 landed** (`affba1e`, `bdda2b5`, `6f1be6c`,
  `74f37d8`, `34158c4`, `9ce1a19`, `d2f5911`, `515fd14`), 21 open PRs left. `main` verified
  after: CI **and** CodeQL `completed/success` on `515fd14`, the post-drain head. #357
  skipped on a one-file conflict and deliberately left to its active author.

## Delivery strategy

- Authored changed-line forecast for this batch: **0** (no source edits — branch updates
  are forward merges of `main`, performed by the update-branch API).
- Delivery: the merges themselves. Merge is the user's standing decision for this cycle
  (AGENTS.md clause 4 is suspended for this batch by explicit instruction); CI is not
  bypassed.
- TDD: not applicable — no source change. Applicable functional check = CI
  (`lint-and-build`, `GitGuardian Security Checks`, `CodeQL`), required links only.

## Landed

| # | Merge commit | Note |
|---|---|---|
| 354 | `affba1e` | MIDI data layer + hook + settings + StageMode |
| 352 | `bdda2b5` | Projection data layer + SlideView + congregation page |
| 350 | `6f1be6c` | Moderation client fixes |
| 346 | `74f37d8` | Public Library & Orgs UI state bugs |
| 345 | `34158c4` | `parseKeyContext` minor-key shorthand |
| 318 | `9ce1a19` | Guardian approval server gate |
| 279 | `d2f5911` | Team onboarding (`.env.example` + PR template) |
| 356 | `515fd14` | CardNav stylesheet split + three opt-in props |
| 353 | `f378401` | Projection operator console (orphan SlideView removed, 0022→0035 comments) |
| 351 | `f605cd2` | External display menu/preview/reconnect (foot pedal error de-accented) |

Procedure per PR, automated in `/tmp/opencode/drain/drain.sh` (never bypassing CI):

1. `gh pr update-branch <n>` — forward merge of `main`, no force-push.
2. Wait for the **new** head SHA, then wait until the three required checks are `SUCCESS`
   **attached to that head** and nothing is pending. A PR that shows green before the new
   head registers is not accepted as green — that is the one way this could silently merge
   an untested state.
3. Confirm `mergeable`/`mergeStateStatus` is not `BEHIND`/`DIRTY`/`UNKNOWN`.
4. `gh pr merge <n> --merge --admin`, then verify `state == MERGED` and record the commit.

On any failure at any step the PR is skipped and reported — never forced.

## Blocked: #357

`update-branch` refused after #356 landed: a **content conflict in exactly one file**,
`src/app/AppLayout.jsx`, confirmed read-only with
`git merge-tree --write-tree --name-only origin/feat/nav-cardnav-pr2 origin/main` (no
worktree, no checkout). Everything else in the PR merges clean.

It is not touched here for a specific reason: the branch's last three commits
(`a669965`, `c4a0559`, `107e389`, up to 03:20 UTC) are authored by **Antony-Figueroa**, the
same collaborator whose comments on the PR describe those commits as answering review
findings. Resolving the conflict means rewriting live, shared work; that is the author's
or the maintainer's call, not a merge-drain step. The conflict itself was *created by this
drain* — #357 was `MERGEABLE BEHIND` before, and main gained the colliding `AppLayout.jsx`
changes (#279, #356) while the queue was being drained.

## Findings — the not-ready PRs, with causes (measured, not inferred)

Pulled from `gh run view <id> --log-failed` on each red `lint-and-build` job:

- **#353, #351** — visual gate **rule 02** (`no use of the four dead accents in src/`):
  `235 occurrences, over ceiling 234 by 1`. Not a mystery failure: each branch adds one
  dead-accent occurrence. A one-line fix, not a rework. The other nine rules pass.
- **#336, #335** — `Error: Cannot find package 'verovio-wasm' imported from
  spike/musicxml-layout/tests/stress.test.ts` (and `visual-parity.test.ts`). The spike
  imports a package that is not a dependency, so the suite dies before the build. Note
  #336 also carries a **migration-chain + RLS hotfix** whose value is independent of the
  spike debt — separating the two is the real decision there.
- **#288, #301** — `[ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL] Command "test:gherkin" not found`.
  Not a code defect: the branch is older than #287, which added the `test:gherkin` script;
  the workflow on the branch calls a script the branch does not have. Both are also
  `CONFLICTING`, so they need the conflict resolved first — after which CI likely clears
  on its own.
- **#299** — GitGuardian fails on the PR that narrows the GitGuardian allowlist.

Conflicting (no cause needed, they need rotation against `main`): #355, #348, #314, #282.
**#349 was the design-cluster blocker when this record was written; verified and closed
below before any conflict work — see "Closed without merging".**

## Closed without merging: #349 (superseded, 2026-10-12)

`feat/design-deps` was offered as the highest-leverage next item and examined first. The
verdict is superseded, not blocked:

- **All six deps are already on `main`** (`package.json` at `515fd14`): RAC `^1.7.0`
  (lockfile resolves **1.22.1**), motion `^14.1.0` (14.1.0), `@hugeicons/react` `^1.1.10`,
  `@hugeicons/core-free-icons` `^4.3.5`, `gsap` `^3.15.0`, `ogl` `^1.0.11`. They landed via
  the merged cluster PRs #310, #303, #341 — the ones `make-prs-actionable.md` said were
  waiting on the deps PR. Waiting mostly ended.
- The branch payload is equal-or-older at every point: it pins RAC **1.21.1** (a downgrade
  against main's resolved 1.22.1), motion `^14.0.0` (older floor), and folds a lockfile that
  stopped at `6f4a579`, 50+ commits behind main.
- Merging it would not unblock anything — it would regress the resolved RAC version and
  rewind the lockfile. **Closed with a comment carrying the version table**, per queue
  hygiene (same class as #343/#347 in `make-prs-actionable.md`). Reopenable if a deliberate
  RAC/motion pin decision is wanted.

The cluster question that motivated #349 is fully closed: #310, #303, #341, and the deps
they need are all on `main`.

## Next step

Nothing further without a decision. Three candidate follow-ups, in leverage order:

1. **#357** — resolve one file (`src/app/AppLayout.jsx`) or hand it back to Antony-Figueroa,
   who is actively pushing to that branch.
2. ~~**#349** —~~ **done**: closed as superseded (2026-10-12); the design cluster it was meant
   to unblock is fully on `main` (#310/#303/#341 + deps).
3. **Cheap reds** — #353/#351 need one dead-accent occurrence removed (rule 02 is over its
   ceiling by exactly 1); #288/#301 need their conflict rotated against `main`, after which
   the `test:gherkin` failure should clear on its own.

Explicitly not decided here: the E2E Playwright stack (#289–#297, #313) and the docs re-sync
series (#282–#284), both left as separate units by `odd/tasks/make-prs-actionable.md`.

## Note on state

`odd/tasks/pr-queue-merge-drain.md` and `odd/tasks/make-prs-actionable.md` are both
untracked in the working tree; neither is committed. The drain produced no source change —
its deliverable is the eight merge commits on `main` — so no branch was created for it.
Committing the record is a separate decision.

## Batch 2 — #353/#351 red-to-green (2026-10-12)

User decision: "si" → fix the two rule-02 failures and drain them with the same
serial procedure. Verified in fresh worktrees with real installs
(`pnpm install --frozen-lockfile`, vite 6.4.3 / vitest 5.0.2 — the main checkout's
node_modules is stale, backlog #14; worktrees:
`cemurm-worktrees/pr353-projection-pr2`, `cemurm-worktrees/pr351-external-display-pr1`).

### Diagnosis (measured)

Both branches sat at **235 occurrences vs ceiling 234** (rule 02). Main is at exactly
234/234, so each branch's net +1 breaks CI. The two causes were different:

- **#353 (`feat/hito5-congregation-projection-pr2`)** — NOT new content. The branch
  forked before #352 relocated `components/SlideView.jsx` →
  `components/projection/SlideView.jsx`; its merge of origin/main (`beee5dc`) kept the
  pre-relocation copy as an orphan. Nothing imports it (`Projection.jsx` and
  `ProjectionDisplay.jsx` import the nested path), so the gate counted the same file
  twice. Fix: `git rm` the orphan — 235→234 with zero visual impact.
- **#351 (`feat/hito5-external-display-pr1`)** — one genuine new usage:
  `StageMode.jsx:887` foot-pedal pairing error used `text-cem-rose`. Fixed to the stage
  surface's own token `text-cem-stage-lyric/80` (above the /40–/60 hints, one existing
  /80 use in the file). The `completeError` at line 1013 (`bg-cem-rose/10`) is main's
  pre-existing debt — ratcheted, not touched here.

### Second finding — #353 add/add conflict in `src/lib/projection.js`

After the orphan was pushed, `update-branch` still refused: `mergeStateStatus DIRTY /
CONFLICTING`, confirmed with `git merge-tree --write-tree` → add/add conflict on
`src/lib/projection.js` (main created it via #352; the branch carried its own copy).
Content diff: **2 insertion / 2 deletion — two comment lines**; the branch referenced
migration `0022`, main uses `0035` (the projection migration was renumbered when it
landed on main, same class as feedback `0020→0033`). Aligned both comments to `0035`
→ file byte-identical to main → add/add auto-resolves. Merge tree now clean (exit 0).

### Verification (per worktree, full AGENTS.md chain)

`bash scripts/check-visual-contract.sh` → rule 02 at **234, PASS**, exit 0; `pnpm lint`
clean; `pnpm typecheck` clean; `pnpm test` 348/348; `pnpm test:gherkin` 41/41;
`pnpm build` ok (pre-existing >500 kB chunk warning only).

### Commits

- `031caa3` `chore(projection): remove orphan SlideView duplicate` (#353)
- `c784a74` `docs(projection): reference renumbered 0035 migration` (#353, conflict fix)
- `5817536` `fix(stage): drop dead accent from foot pedal error` (#351)

### Merge state (final)

- **#353 landed** — merge commit `f378401`. `update-branch` → head `e17be58`; all
  required checks SUCCESS on that head (`lint-and-build`, CodeQL incl. both Analyze
  jobs, GitGuardian); `merge --admin`; CI on main `success`. **CI never bypassed.**
- **#351 landed** — merge commit `f605cd2`. Updated after #353 landed (serial, so its
  CI ran against post-#353 main): head `ca2a967`; all required checks SUCCESS; `merge
  --admin`. Queue: 20 → 18 open.
- Both merges verified on `origin/main`: `git log` shows each `Merge pull request`
  preceded by its `Merge branch 'main' into` update commit.


## Batch 3 — #299 reshaped to intent, then merged (2026-10-12)

User decision: "si el 299", then "Reformar a la intención" after the scope finding.

### Scope finding (measured)

`chore/gitguardian-allowlist` carried **49 commits** vs 124 behind main: only the top
two were the allowlist (`5e8d51d`, `f5dcdd2` — both touching ONLY `.gitguardian.yaml`);
the other 47 were the whole E2E harness (8636 insertions, `tests/e2e/`,
`playwright.config.js`, `vitest.config.js`) — the deferred E2E stack. The PR body
stated allowlist-only intent, so merging as-is would have landed the out-of-scope
harness through the back door.

Second finding: **#300 already merged that allowlist to main** (`c7156ea`) — the
branch's yaml was byte-equivalent except 3 comments + missing final newline. So #299's
original payload was already on main; its real latent value was that the rules are
BROKEN in both copies.

### GitGuardian failure root cause (from check-run output, run 111576103826)

"9 secrets uncovered from 49 commits": 5× Generic Password (`postgres`) + 3× JSON Web
Token (the deterministic anon JWT), in `.github/workflows/e2e.yml` and
`tests/e2e/global-setup.js`. The config's `match: "POSTGRES_PASSWORD: postgres"`
anchors on the LINE, but GitGuardian evaluates `match:` against the DETECTED VALUE
(`postgres`); the JWT had no rule; `tests/e2e/` wasn't path-ignored. The PR body's
"Rules match exactly the flagged occurrences" claim was empirically false.

### Fix (reshape, 1 file, 11+/2− vs main)

Branch recreated from `main` (`f605cd2`), commit `58dcfed`, force-push with lease
(old head's harness commits remain reachable in the E2E PR branches — nothing lost),
PR title/body updated to the truth:

- `match: "^postgres$"` — value match, not line match
- new anchored rule for the deterministic local-dev anon JWT
- `tests/e2e/` added to `ignored_paths`
- yaml validated (`yaml.safe_load` OK)

### Result

Head `58dcfed`, files = `[.gitguardian.yaml]` only; all checks SUCCESS incl.
**GitGuardian green for the first time** (config file is itself excluded from
scanning, so the rules now train the E2E harness PRs #288/#297). Merged `--admin`,
merge commit **`c14e977`**; CI on main in progress. Queue: 18 → 17 open.

### Implication for the E2E stack

The corrected allowlist should clear GitGuardian noise on #288/#297 when those branches
rotate against the post-#299 main; their remaining blockers (`REVIEW_REQUIRED`,
CONFLICTING, base on other harness branches) are unchanged — still a separate decision.


## Batch 4 — #336/#335 investigated and DEFERRED (2026-10-12)

User decision: after the finding below, "ese spike no está completado y es trabajo de un project
board que no ha comenzado" → left untouched, moved to other PRs.

### #336 must NOT be merged as-is (security regression)

`hotfix/migration-chain-rls-leaks` = main + 2 commits (spike + `0035_fix_migration_chain_rls.sql`).
Its RLS payload is **superseded by `0020_review_batch1.sql`** (already on main; #149 batch 1 =
criticals + highs), and its definitions are **weaker**. Since the migration sorts AFTER 0020, it
would be the last writer and win:

| Policy | main (`0020`) | #336 would replace it with |
|---|---|---|
| `songs_update_source_org` | WITH CHECK: membership **+ `org_id = any(private.session_org_ids())` + branch scoping** → closes C3 | WITH CHECK that only mirrors USING → `org_id`/`branch_id` unbounded, **C3 leak reopens** |
| `event_setlists_update_organizer` | + `visibility` pinned to the 4 documented values + `session_owns_setlist` | omits both |
| `songs_insert_scoped`, `event_repertoire` narrowing, revoke/grant column pin on `public.songs` | present | absent |

Also: the "fresh reset aborts at 0019 with 42710" premise is **already fixed on main** —
`0019_rehearsal_workflow.sql:189` uses `create or replace function private.display_name_for`.
And its seed section (7) sets `d0000001` to `'Dorian b2'` rot 1, which **already exists as
`d0000002`** → creates a NEW duplicate (the author indexed the seed rows off by one: their comments
call `d0000002` "Lydian Augmented", which on main is `d0000003`).

Numbering: main's chain was renumbered (`0034_plan_freeze`, `0035_projection`); the branch still has
them at `0021`/`0022`, and its fix is numbered `0035` → collision with `0035_projection.sql`.

Surviving real value in #336: `c0000001` `'Locrian #6'` intervals `[0,1,3,5,6,8,11]` → correct
harmonic-minor rotation 1 `[0,1,3,5,6,8,10]`; and the `d0000001` duplicate of parent `a0000004`
(correct fix is `delete ... where id = ...`, which IS idempotent — the migration's own comment
wrongly claims it is not). Not extracted; left for the #149 pass-2 work.

### #335

`spike/suite-modular` = main + 1 commit: 22 files / 2271 insertions of spike scaffolding
(`.github/workflows/spike.yml` + `spike/**`). Its workflow can never run: triggers are
`branches: [spike/suite-modular]` and its jobs need self-hosted runners (`spike-ios`,
`spike-android`, `spike-windows`) that do not exist. Its 4 `spike/musicxml-layout/tests/*.test.ts`
are what makes `pnpm test` red (`Cannot find package 'verovio-wasm'`) — the root vitest run picks
them up because there is no test config excluding `spike/**`.

### Recurring pattern

Third instance in this drain of a stale branch whose payload already landed under a different
number: #349 (superseded by #310/#303/#341), #299 (config already on main via #300), #336
(superseded by #0020). Check `git log origin/main -- <path>` provenance before treating any
old branch's stated fix as still pending.

## Queue review (17 open, 2026-10-12)

| PR | State | Note |
|---|---|---|
| 282 → 283 → 284 | #282 DIRTY (conflict: `AGENTS.md`, `docs/master-plan.md`), #283/#284 BLOCKED | docs re-sync stack; 283/284 are stacked on 282 — unblocking 282 lands 3 PRs |
| 314 | DIRTY, +34/-1 | small: #312 guardian-consent email validation + deno check in CI (the static check `supabase/functions/**` lacks) |
| 288–297, 301, 313 | DIRTY/BEHIND/red | E2E harness stack, deferred (bases on other harness branches) |
| 348 | DIRTY, +4734/-78 | landing page; its own body: "nobody has seen this page in a browser" |
| 355 | DIRTY, +262 | branch `fix/design-page-critical-v2`, body "test" |
| 357 | BEHIND + lint red | `AppLayout.jsx` references undefined `useModeration`, `baseNavLinks`, `moderationNavLink`; live work by Antony-Figueroa |
| 335, 336 | BEHIND + lint red | this batch — deferred |

## Batch 5 — docs stack #282 → #283 → #284 (in progress)

User pick: "Stack docs #282→#284".

### Mechanism finding: stacked PRs cannot use the legacy merge path

GitHub detects #282/#283/#284 as a native STACK (child PR bases point at parent branches). Both legacy paths refuse:

- `gh pr merge 282 --merge --admin` → `GraphQL: This pull request is part of a stack and must be merged using the asynchronous merge REST API`
- `gh pr edit 283 --base main` → `GraphQL: Cannot change the base branch because the pull request is part of a stack.`

Working path (verified on #282):

```bash
gh api -X PUT repos/<owner>/<repo>/pulls/<n>/merge-async -F bypass_rules=true -F merge_method=merge
```

- `-f bypass_rules=true` **fails** — `gh api -f` sends a string: *"Invalid property /bypass_rules: `"true"` is not of type `boolean`"*. Must use `-F` (typed field).
- Returns `{"status":"pending","details":{"message":"Merge request enqueued.","uuid":...,"expected_head_sha":...,"bypass_rules":true}}`.
- Rules are evaluated **at merge time**, not at enqueue time; a rule failure surfaces while polling. Poll the PR state for the outcome.
- A stack merge is **atomic** and merges "every pull request in the stack up to and including the one you request" into the stack's base branch.
- Without `bypass_rules=true`, an enqueued merge on a `BLOCKED` (review-required) PR silently never completes — state stays `OPEN`/`BLOCKED`.

### #282 — MERGED `bcd7550` (head `ab89a77`)

Rebased onto `main` = `c14e977` (branch was 126 commits behind). Dropped the branch's tooling-docs commit: it had already landed via **#281** (`aa3f8f5`). Re-derived the doc facts against today's main and corrected them (migrations `0001`–`0035` with `0021`/`0022` free; gate now green; CI order; `src/` layout; ts-check `62`; finding D → `0036`). 1 file: `docs/master-plan.md` +307/−72. PR title/body updated with the full correction table.

### #283 — MERGED `61d3701`

Base retargeted to `main` automatically once #282 landed. The branch's other two commits were
already on main, so it was reset to `main` and `b6d9a53` cherry-picked as one re-derived commit
(`ade9f8e`). **Conflict in `docs/mvp-scope.md`** (Feature→Hito mapping): the slice claimed
"Every one of the 45 BDD features is assigned to a hito", while main — written by #287 five days
**later** — says 42 of 45, with the three `education-*` awaiting a scope decision. Took main's
side: it is newer *and* accurate (the slice's own hito lists omit `education-*`), and kept the
slice's `713`-scenario total.

Corrections re-derived: migration numbering (`0021`/`0022` → `0034`/`0035` per #344; `main` = 33
files `0001`–`0035`, `0021`/`0022` free, next free `0036`), the CI order, item 8's "contiguous, no
gap", item 9's "no rule file documents the ruleset" (closed by `58c45a6`), and backlog items 11
and 13 marked **RESOLVED** (CI green with `typecheck`/`check-test-integrity.sh`/`test:gherkin` and
the gate last; visual gate `OK`, 12 rules, 0 failing — `01b` 4/5, `02` 240/240, `06` 0).

### #284 — MERGED `3c4d464`

Base retargeted to `main`; reset + cherry-picked `f292c56` as one commit (`60a1b74`). One new file,
`odd/tasks/docs-sync-current-state.md` (+379). The record is measurement-at-time by its own
constraint 1, so rounds 1–2 were kept **verbatim** and a dated **Delivery outcome (2026-10-12)**
section was appended naming the three statements that had become false: N0 ("blocks CI on every
PR") → resolved and the gate now runs last; the "no typecheck in CI" claims → `typecheck`,
`check-test-integrity.sh` and `test:gherkin` are in CI; the round-1 migration counts → #344
renumbered. Round 2's item-14 finding was re-checked and **still holds**, so it was left alone.

### Batch 5 outcome

All four slices of `docs/sync-current-state` are on `main`: **#281** (1/4, 2026-10-07), **#282**
(2/4), **#283** (3/4), **#284** (4/4). `main` = `3c4d464`.

**Lesson — re-derive, never replay.** Three of these four branches were stale in ways only a fresh
measurement caught: #282's gate/migration claims, #283's `education-*` regression plus numbering,
#284's "N0 blocks CI". A mechanical rebase would have landed all of them as fact.

**Correction to an earlier note in this record:** the main checkout's `node_modules` IS synced
(vite 6.4.3 / vitest 5.0.2, matching the lockfile). The belief that it was stale was wrong, and
backlog item 14 was right to say so — verify before "correcting" a claim.

---

### #314 — MERGED `8696a61` (2026-10-12)

`fix: guardian consent email validation + deno check in CI [#312]`. Standalone PR (base `main`
directly, **not** a stack member), rebased onto `3c4d464` → `ba285ba`, **+40/−4 over 2 files**
(`.github/workflows/ci.yml` +10, `supabase/functions/send-guardian-consent/index.ts` +34/−3).

Merged with `gh pr merge 314 --merge --admin` on the **first attempt**. Worth recording as the
contrast case: the stacked PRs (#283, #284) refuse `--admin` with *"part of a stack, must be merged
using the asynchronous merge REST API"*, but a standalone PR bypasses the `review` ruleset normally.
The async-API recipe is for stack members only — do not reach for it by reflex.

**Four corrections, all evidence-backed:**

1. **`ci.yml` conflict resolved to `main`'s comment, not the branch's.** The branch asserted the
   visual gate *"is red on pristine main"*. False since the gate went green: measured `OK`, 12
   rules, 0 failing. Taking the branch side would have re-introduced a false claim into a file the
   PR touches.
2. **The glob was quoted**: `deno check 'supabase/functions/**/*.ts'`. Unquoted, bash expands `**`
   as `*` because `globstar` is off in Actions, degrading the pattern to
   `supabase/functions/*/*.ts` and **silently omitting nested files**. Proven against a synthetic
   tree (`functions/a/b/deep.ts`): unquoted omits it, quoted and `find` cover it. This matters
   precisely because #312's finding *is* "this path had no gate" — a gate that misses files would
   repeat the same failure at a smaller scale. With one function today both forms look identical,
   which is how the defect would have shipped unnoticed.
3. **Deno setup moved down** to sit with its single use, after `pnpm lint`, so a lint failure does
   not pay the Deno download first.
4. **Stale in-file comment corrected.** It claimed the default from-address is a *"verified
   domain"*; #312 establishes no verified sending domain exists in any environment. The comment now
   says the default is a placeholder and cites #312.

**Verification — the new gate runs *and* passes in Actions.** Read from the job's own step list
(run `38278905727`, `wf=CI`), not inferred from a green badge:

```
7. Run denoland/setup-deno@v2                  → success
8. Run deno check 'supabase/functions/**/*.ts' → success
```

All 14 steps of `lint-and-build` green, order: `install → lint → setup-deno → deno check →
typecheck → check-test-integrity → test → test:gherkin → build → visual-contract`.

**Client compatibility checked before merging, not after.** The PR adds the error slug
`invalid_from_address`. `src/data/repositories/minors.js:212` maps *any* error to `'unavailable'`,
which renders as the existing `no_email` state — so the new slug degrades gracefully. `git diff`
over `src/` is empty: no client change was needed and none was made.

**Lesson — a gate is unverified until you read that it ran.** `lint-and-build: SUCCESS` alone proves
nothing about the new step; a step can be absent or skipped inside a green job. The step list is the
evidence.

**Lesson — do not conflate workflows.** The first `.github/workflows/` listing showed a `test-ci.yml`
whose only job is `echo "test"`. A `gh run list` by commit SHA pinned it to `wf=Test CI`, a separate
throwaway workflow, while the real pipeline is `wf=CI`. Reporting "the CI passed" against the wrong
run would have been worthless.

**Still open by design.** This is items 5–6 of #312. Items 1–2 (a verified Resend sending domain and
a real send) need operator action, so the guardian-consent flow remains **undeliverable in every
environment** after this merge. #312 stays open; the PR body says so and the file comment now says
so too.

### Batch 6 outcome

`#314` merged; `main` = `8696a61`. Worktree `pr314-guardian` removed.

**Finding, unrelated and untouched:** `origin/main` carries `.github/workflows/test-ci.yml`, a
workflow that runs `echo "test"` and consumes a check named `test`. It is junk on the default
branch and it inflates the required-check surface. Candidate for removal — not actioned here.

---

### #359 — MERGED `eab3001` (2026-10-12)

`chore(ci): remove the accidental test-ci.yml workflow`. Standalone PR, new branch off `8696a61`.
Commit `adf15a2`, **−10 lines, 1 file deleted**. Merged with `gh pr merge 359 --merge --admin`, first
attempt.

**The finding.** `origin/main` carried `.github/workflows/test-ci.yml`: a workflow named *"Test CI"*
whose only job runs `echo "test"`. It was added by commit `a36e218` (*"test: add test workflow"*)
**inside PR #303**, a design change (`skeleton gradient reflectante` + design route), so the file rode
along by accident rather than by intent.

**Why it was worth removing.** It ran on *every* pull request and published a check named `test`
that **cannot fail** — `echo "test"` exits 0 unconditionally. A green check that cannot fail is worse
than no check: it inflates the surface a reviewer must read and teaches people to trust a signal
that carries nothing. Same failure class as a gate that silently under-covers (#314's glob): a check
you believe in that proves nothing.

**Verified before deleting, not after** — the whole point being that removing a workflow cannot be
validated by the checks it no longer produces:

| Check | Result |
|---|---|
| `test` a required status check? | **No.** Ruleset `24904685` requires `lint-and-build`, `GitGuardian Security Checks`, `CodeQL` only. |
| Any other workflow producing a `test` check? | No. |
| Anything referencing `test-ci` / `Test CI`? | Only the file. The `docs/bdd-coverage-map.md` hits are the phrase *"test citation"* — unrelated. |
| An environment requiring it? | No environments configured. |

**Post-merge structural evidence.** #359's own rollup showed five checks — `lint-and-build`,
`Analyze (actions)`, `Analyze (javascript-typescript)`, `CodeQL`, `GitGuardian Security Checks` —
and **no `test` check at all**, which is what deleting the workflow must produce. After the merge,
`git ls-tree origin/main -- .github/workflows/` returns `ci.yml` and nothing else.

**Note for future PR reviews:** pull requests now show one fewer check. That is the intended change,
not a lost gate — the required set is identical before and after.

---

### Queue review (3 open, 2026-10-13) — #336 / #335 / #301

`main` = `a610dd0`. CI **and** E2E green on it (runs `38338299813`, `38338299824`). Only three PRs
remain open, and all three are stale. Two findings here **correct** the earlier not-ready list.

**#335 is superseded — and its lint red is already fixed on main.** Its guardian-approve payload is
on main: the branch's `0034_guardian_approve_public_sharing.sql` is **byte-identical** to main's
`0036_guardian_approve_public_sharing.sql`, and `minors.js` / `GuardianApprove.jsx` match too. Its
only unique content is the same spike blob #336 carries byte-for-byte. Correction to the earlier
record: the `verovio-wasm` failure is no longer a blocker — `vitest.config.js` (added by #360) sets
`include: ['src/**/*.test.js']`, so the spike's `.test.ts` files are no longer collected.

**#336 has a second, harder blocker than the RLS weakening.** Beyond the last-writer-wins regression
already recorded (its `0035` sorts after main's `0020`), the branch carries `plan_freeze`/`projection`
as `0021`/`0022` — **byte-identical to main's `0034`/`0035` except line 1's number**. Rotating it
against main puts *both copies* in the chain, and `0021` has a bare `create table
public.service_plan_versions`, so a fresh `supabase db reset` dies at `0034` with 42P07. CI cannot see
this: the pipeline has no DB step. Also confirmed dead: main's `0019:189` already uses `create or
replace function private.display_name_for`, so the "reset aborts at 0019" premise is gone.

**Batch 7 — #301 reshaped to intent, then superseded (2026-10-13)**

User decision: "301", then "Solo el mínimo" (no page-object scaffolding).

#### Scope finding (measured, three-dot vs main: 8415 insertions / 46 files)

- **The harness already landed** via #360 in reduced form: `tests/e2e/**`, `playwright.config.js`,
  `vitest.config.js`.
- **The "shared Supabase stack" cannot work across runners.** The `setup` job starts a stack and
  exports `host=127.0.0.1`; each browser job runs on **its own runner** and consumes it as
  `VITE_SUPABASE_URL: http://${{ needs.setup.outputs.supabase-host }}:54321` — i.e. `127.0.0.1` on
  *its* runner. Proof the stack was never used: the branch's `tests/e2e/global-setup.js` is
  byte-identical to main's (`git diff` empty), so every browser job ran `supabase start` itself. The
  setup job's ~2m40s was decorative.
- **The image cache could never be restored:** `key: ...-${{ github.run_id }}` misses on every run and
  only ever saves — a multi-GB `/var/lib/docker` snapshot against the repo's 10 GB cache budget.
- **20 page-objects/component-objects (~5600 lines) are referenced by nothing**: one spec exists, and
  `git grep -n "page-objects"` over `specs/` and `fixtures/` returns nothing. AGENTS.md's entry rule
  (YAGNI) blocks landing uncalled scaffolding.

#### What landed

PR **#361** `ci(e2e): authenticate Docker Hub pulls in browser jobs` — branch
`ci/e2e-dockerhub-login` recreated from `main`, one file, **+39/−0**. `docker/login-action@v3`
immediately before the E2E run in each of the three browser jobs, because the pulls happen in
`global-setup`'s `supabase start` at test time, and credentials do not cross runners, so it cannot be
done once in `setup`.

#### Verification — the step list, not the badge

`E2E Tests` run `38380732419` on head `097da8c`, conclusion `success`:

| Job | `Login to Docker Hub` | steps |
|---|---|---|
| Setup — emit deterministic anon key | not present | 3 |
| E2E Chromium | ran, success | 20 |
| E2E Firefox | ran, success | 20 |
| E2E WebKit | ran, success | 20 |

`lint-and-build`, `GitGuardian`, `CodeQL` green on the same head. Honest limit: the run would likely be
green without the change (anonymous pulls work until the per-IP budget is spent) — the value is
preventive, not a fix for an observed red run.

#### Outcome

**#301 closed as superseded** with the full evidence in a comment (dead shared-stack design, run-id
cache key, uncalled page objects, what #361 keeps). Nothing lost: the commits stay reachable in
`fix/e2e-docker-rate-limit`. Queue: 3 → 2 open (#336, #335). Worktree `cemurm-worktrees/pr301-min`.
