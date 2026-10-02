# Merge-queue drain and PR/branch cleanup — findings record

> Date: 2026-10-01 · State: queue drained, findings recorded, decisions pending
> This is an execution record, not a capability spec. What a capability *is* goes in
> `openspec/specs/`; what was done and how it was verified goes here.

## Objective

Drain the merge queue, then clean up PRs, branches and worktrees — so the
directives (`AGENTS.md`, the backlog) can later be rewritten against a real
repository state instead of one carrying zombie PRs and branches that
misrepresent what is on `main`.

## Scope

**In**: landing the open queue in dependency order, resolving/closing what
remained, porting the salvageable part, deleting merged branches and dead
worktrees, and recording every finding that a future directive should answer.

**Out, deliberately**:

- **Ruleset mutation** — deferred by the maintainer to the end of the cycle.
- **Visual-gate debt** — not migrated inside merge-repair PRs; it stays a
  separate work item (see backlog #13).
- **Directive corrections** — the findings below are recorded, not acted on.
  The maintainer's stated plan is to resolve and document the findings first and
  only then write better directives, so patching `AGENTS.md` now would be
  premature.

## Landed

All batches reached `main` at `84a48f2`. Gates on that commit: `tsc` 0 errors,
baseline 60 `/src/` files, eslint 0, vitest 307/307 across 9 files, vite build ok.

| PR | What | Note |
|---|---|---|
| #236 | Vite `5.4.21→6.4.3` + Vitest `3.2.7→5.0.2` | Paired majors moved together, per the rule. Verified with a **real** install into a worktree with its own `node_modules`, not a symlink. Bundle delta: JS +3,217 B (+0.35%), CSS −8 B; the >500 kB chunk warning already existed on Vite 5. `lockfileVersion` stayed `'9.0'`. |
| #273 | `AGENTS.md` pairing rule | The "Vitest is pinned to 3.2.7" claim was false once #236 landed. Replaced with the transferable pairing rule plus the mandatory real-install verification step. |
| #254 | **closed, not planned** | Three proofs: ancestor test, blob-identical content, empty patch. Branch left intact. |

Prior batches (offline/setlist #253/#216/#271, overlay/a11y #237/#225/#272,
jsdoc v2 series, M2 series, #266, guardian chain, #268/#269/#270) merged in
earlier legs of this drain.

## Closed, and why

### #194 / #195 — one indivisible unit, superseded by a decision already taken

These are not stale duplicates; #194 proposes an **alternative guardian model**
to the one `main` already shipped.

| | `main` (shipped) | #194 (proposed) |
|---|---|---|
| Route | `/guardian/confirm` → `GuardianConfirm.jsx` | `/guardian-approve` → `GuardianApprove.jsx` |
| API | `requestGuardianConsent` + `sendGuardianConsentEmail` + `confirmGuardianConsent` | `recordConsent` + `approveGuardianSharing` |
| Transport | email + token via the `send-guardian-consent` edge function, migration `0031` | direct capability link, citing "H10 (0020)" |

Choosing between them is a product decision, and it has already been made — with
migration, edge function, page and routes in place. #195 is stacked on #194, so
its diff carries the guardian redesign with it and merging it into `main` drags
the redesign along, conflicting in `router.jsx` and `minors.js`. **They cannot be
split at PR level.** Both closed with the reasoning posted; contributor branches
left intact.

The salvageable part was real work and was **not** discarded: the moderation half
was extracted onto `main` with zero guardian files in the diff, as a chain —
**#274** (repository + hook, 189 lines) and **#275** (UI, stacked on #274).

Two defects surfaced in that port and would have shipped:

1. **3 type errors inside the `@ts-check` baseline** — `isSystemAdmin` with no
   `@param`/`@returns`, and `getMyModerationCases` indexing a bare
   `const entryMap = {}` (TS7053).
2. **9 new visual-contract violations** — 6 dead accents (`emerald`/`rose`) in
   the new `MyCases.jsx` and 3 `text-cem-secondary` on an elevated fill. The
   gate is a ratchet, so these were fixed rather than accumulated; occurrences
   now match `main` exactly (01b 92, 02 274, 06 1).

## Findings

Each is measured, not inferred. The five that a future directive should answer:

1. **`tsconfig.json`'s `include` cannot reach any `.jsx`.** It covers
   `src/domain`, `src/data`, `src/integrations`, `src/lib`, `src/offline`.
   `src/features` is absent, so none of the **54 `.jsx` files** under `src/` can
   enter the TypeScript program, and a `// @ts-check` pragma on any of them is
   inert while `tsc` still exits 0. `AGENTS.md` presents the pragma as "the whole
   mechanism"; that holds for `.js` under the five included directories and is
   false for every JSX. **The type baseline covers zero UI.** Backlog #10.

2. **`--listFiles` is not a per-file verification.** It lists the *program*, not
   the type-checked files, so adding a pragma to an already-included file leaves
   the count identical. The only real proof is a probe: inject a deliberate error,
   confirm `tsc` reports it, remove it. This is the mechanism that caught finding
   1, and it is the mechanism `AGENTS.md` should prescribe instead of
   `grep -c '/src/' > 1`.

3. **A self-review request is a silent no-op.** `gh pr edit <n> --add-reviewer
   davidjesus516` on a PR *authored by* davidjesus516 exits 0, prints a URL, and
   creates nothing. Measured: #273 (self-authored) → `reviewRequests: []`; #194
   (author `Antony-Figueroa`) → `reviewRequests: ["davidjesus516"]`, and it
   notifies. Combined with `require_last_push_approval: true`, a self-authored PR
   has **no in-platform approval path at all** — only `--admin`. So `AGENTS.md`
   clause 6 ("Always request a reviewer… notify, do not wait silently") reports
   success while accomplishing nothing. Backlog #12.

4. **CI on `main` is red *and* blind since `6ee10f0`** (merge of #199). It aborts
   at `bash scripts/check-visual-contract.sh`, so `pnpm test` and `pnpm build` are
   reported `skipped` and never run. Separately, `pnpm typecheck` is **absent from
   CI entirely**, so type errors ship behind a green check. Backlog #11.

5. **The 400 changed-line PR ceiling is a written convention, not a rule.** The
   active ruleset (`PR`, id `24085467`) has no size rule: it requires GitGuardian,
   1 approving review, `require_last_push_approval`, thread resolution, CodeQL,
   and `dismiss_stale_reviews_on_push: false`. Nothing blocks an oversized PR.
   The moderation chain was split to honour the convention anyway.

Two more, environmental rather than structural:

6. The **main checkout's `node_modules` is stale** — vite 5.4.21 / vitest 3.2.7
   while `main`'s lockfile after #236 demands vite `^6.4.3`. Gates run there pass
   against versions nobody will ship. Not touched without the maintainer's word.
   Backlog #14.

7. The visual gate's own debt: three ratchets failing on `main` (01b 92 over
   ceiling 82 by 10; 02 274 over 252 by 22; 06 1 occurrence). Backlog #13.

## Process mistakes in this work, reported rather than smoothed over

These cost real time and are the reusable part:

- **`for f in $files` does not word-split in zsh.** The per-file comparison loop
  ran *once* with 16 paths glued into one invalid path, producing a table where 49
  branches all showed exactly "1 differing file". Only the impossibility of the
  number caught it. Use `while IFS= read -r f`. Hit twice in the same session.
- **A verification helper that took a ref as a *label* and never checked it out**
  produced a false green: "slice 1" was re-measuring `HEAD`. Then, after fixing
  that with `git checkout --detach HEAD~1`, a `for ref in HEAD~1 HEAD` loop
  verified slice 1 **twice** — a detached checkout *moves* `HEAD`, so the second
  iteration's `HEAD` was already the slice-1 commit. Resolve the target SHA first
  and assert `HEAD` equals it, or the guard is decorative.
- **Never pipe a critical git command through `tail`/`head`.**
  `git checkout -b <new> origin/main 2>&1 | tail -1` discarded the exit code; the
  checkout was refused (local `AGENTS.md` edits collided with `origin/main`) but
  `tail` returned 0, so the chain continued and commit `4d41e6f` landed on the
  **wrong branch**. Redirect stderr to a file and check `$?`.
- **A symlinked `node_modules` invalidates dependency verification silently** —
  every gate passes against a dependency set nobody will ship. Install the lockfile
  into the worktree with its **own** `node_modules` (`pnpm install
  --frozen-lockfile`, never `npm install`).
- **A missing `node_modules` symlink produces false gate failures**: `tsc` exit 1
  with 0 errors, `--listFiles | grep -c '/src/'` = 0, eslint exit 2. That
  signature means `npx` resolved an impostor, not that the code is broken.
- **Never trust a "0 conflicts" verdict without its exit code**, and always compare
  `gh pr view N --json headRefOid` against the ref you merge. Twice now: for #254
  the origin ref was `d797641` while the real head was `e93894b`.
- **Simulated merge direction must match execution direction.** Resolving with
  `main` as HEAD then executing with the fork as HEAD silently dropped
  `readiness.js` typedefs. And when merging `main` into a fork branch, `HEAD` is
  the fork and the label is `>>>>>>> origin/main`.
- **Wrong-direction diffs mislead.** `git diff main pr254` showed 142 differing
  files that were 163 commits of main's later evolution. Compare a PR head
  against *its own* merge-base.
- **"Blob differs from main" does not mean "work missing".** The jsdoc v1 branches
  classified as live work were superseded by their `-v2` siblings, which *are*
  merged; main simply holds the newer version. Content classification needs the
  superseding branch considered, not just a blob comparison.
- **Deleting `antony/*` from `origin` correctly fails** — those refs live on the
  contributor's *fork* remote, which `git branch -r` prints interleaved with
  `origin/*`. 28 refusals were a protection, not an error; the fork was untouched.
  A remote-branch count that mixes both remotes is misleading.

## Cleanup performed

| | before | after |
|---|---|---|
| heads in `origin` | 105 | 48 |
| local branches | 83 | 37 |
| worktrees | 40 | 1 |

Remote deletions were 57 merged-or-dead branches; the safety-net list is in
`/tmp/opencode/cleanup/ramas-a-borrar.txt`. Local deletions used `git branch -d`
and never `-D`, so git's own refusal makes deleting unmerged work impossible by
construction. `v253` was inspected before deletion: it held a half-resolved merge
sim of `fix/offline-drain-quarantine` (`UU` markers), and `main` was verified to
already contain everything it was resolving — that branch merged as #253
(`f487e83`).

## Verification evidence

Both moderation slices were verified **separately**, each on a real
`pnpm install --frozen-lockfile` of `main`'s lockfile into a worktree with its own
`node_modules` (vite 6.4.3 / vitest 5.0.2) — never a symlink:

| slice | commit | files | changed lines | tsc | baseline | eslint | vitest | build | visual contract |
|---|---|---|---|---|---|---|---|---|---|
| 1 — data + hook | `52039b1` | 2 | 189 | 0 errors | 60 | 0 | 307/307 | ok | identical to main |
| 2 — UI | `fa7f20f` | 6 | 476 | 0 errors | 60 | 0 | 307/307 | ok | identical to main |

`main` reference for the visual gate: 01b 92/82 (over by 10), 02 274/252 (over by
22), 06 1. The gate still **fails** — that is pre-existing debt, and what matters
here is that the chain adds zero to it.

Slice 1 is intentionally inert: no UI change, so the page behaves as on `main`
until slice 2. Stated plainly in the PR body rather than presented as a
deliverable slice.

## Pending decisions

None of these are actioned; each needs the maintainer.

1. **Merge #274, then #275** — a new batch, so it needs fresh approval for the
   `--admin` bypass. Both are verified and waiting.
2. **`AGENTS.md` clause 6** (finding 3) — correct the clause to state the real
   mechanism, or establish a different notification channel. Structurally
   unachievable as written.
3. **CI blindness** (finding 4) — add `pnpm typecheck` to the workflow, and decide
   whether the visual gate should keep aborting before test and build.
4. **Visual-gate debt** (finding 7) — three ratchets; not fixable by moving the
   ceilings.
5. **`docs/sync-current-state`** — a local-only branch carrying a 12-file doc sync
   (AGENTS.md, CONTRIBUTING.md, README.md, `docs/master-plan.md`,
   `docs/mvp-scope.md`, …) whose content is **not** on `main` (0 of 11 files
   identical). It also carries commit `4d41e6f`, which is my own mistake: an
   AGENTS.md correction applied on top of it through the `| tail` bug above. The
   same correction landed properly as #273, so `4d41e6f` is a duplicate. Decide:
   land the doc sync (dropping `4d41e6f`), or drop the branch. **I did not touch
   it** — whether another actor holds it is not determinable from here, and the
   author of every commit on it is `davidjesus516`.
6. **The 400-line ceiling** (finding 5) — keep it as convention, or automate it.
7. **UI type coverage** (findings 1–2) — accept that the baseline covers zero UI
   and state it, or make a deliberate `include` change with a measured error
   count. `AGENTS.md`'s "do not flip `checkJs` globally" rationale would have to be
   re-argued, not overridden.
8. **Ruleset** — deferred to the end of the cycle by the maintainer. Standing
   question from backlog #9 (moving the GitGuardian requirement from `target:
   branch` to `target: pull_request`) plus the `size:exception` question.
