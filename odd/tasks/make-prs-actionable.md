# Make the open-PR keep-list actionable

- Feature: `make-prs-actionable`
- Date: 2026-10-11
- Status: in progress

## Objective

Bring every open PR that requires only an update, a cheap CI fix, or an approval to the
point where a human review/approve/merge is the only remaining step. Closed as dead weight
before this batch: #343 (false rationale) and #347 (duplicate of #316). Open count: 33 → 30.

## Problem / why

Main moved to `6ca254e` while many open branches stayed behind, and several PRs carry red CI
that hides a fixable cause. The user wants the open list reduced to items that genuinely need
change or approval — and this batch turns the "needs change" items into "waiting for approval".

## Scope (authorized batch)

1. **Update green + behind branches against `main`** (update-branch API, no source edits):
   #345, #346, #314, #318, #279, #337, #339, #340.
2. **Design cluster (#303, #305, #306, #310, #341)**: define and execute the correct landing
   order — main ships a broken barrel (`src/features/design/components/index.js` re-exports
   14 modules that do not exist; `DesignSystem.jsx` imports `react-aria-components`, not a
   dependency). #303 adds the `/design` route, which makes the latent breakage fail the build.
3. **Verify** every touched PR's CI; report; hand back for human approval (merge stays human).

## Out of scope (explicitly)

- E2E Playwright chain (#288, #289–#291, #295, #297, #313) + inputs #299/#301 — kept open,
  separate unit decision.
- Docs re-sync series #282/#283/#284 (Antony requested changes; real rework) and spike #335.
- #338 (UML skill; conflicting + silently reverts verified AGENTS.md content — needs rework
  with human direction).
- No merges to `main` — approval and merge are the maintainer's call (AGENTS.md clause 4).

## Checklist

- [x] **T1** Update green+behind branches: #345, #346, #314, #318, #279, #337, #339, #340
      (+ the 5 design-cluster branches: #303, #305, #306, #310, #341). All 13 moved
      BEHIND → BLOCKED via update-branch API (no force-push).
- [x] **T2** Design cluster analysis (delegated): barrel + DesignSystem are byte-identical on
      main and all 5 branches; deps (react-aria-components, motion/react, @hugeicons/*)
      exist on NO open PR (only `feat/design-infrastructure`, which has no PR). A barrel
      trim is OFF the table (would break #310's contract tests). Correct order:
      deps PR → #305 (with fixes) → #306 (with fixes) → #341 → #310 → #303 (route) last.
- [x] **T3** Cheap fixes landed on Antony's branches (writer, normal pushes):
      #305 `feat/design-components-pr2` → commits `18146d2` + `74f9ce3` (micro.jsx lint
      honest fixes + wakeSlider token fallbacks + skeletons shimmer containing block);
      #306 `feat/design-components-pr3` → morphSlider comment literal fix. Both PRs now
      fully green (lint-and-build + gate + test 352/352).
- [ ] **T4** Verify CI on every touched PR; report state; hand back for approval
      (11/13 green; #310 + #303 still red — blocked on a deps PR that does not exist)
- [x] **T5** Deps PR (user-approved decision): extracted the package.json deps hunk from
      `feat/design-infrastructure`; evidence-checked that all 6 deps are imported by open
      cluster branches (RAC + hugeicons in #310; motion in #305/#303/DesignSystem; gsap +
      ogl in shared components). Opened **#349** (`feat/design-deps`, commit `6f4a579`,
      217 line lockfile diff, frozen-lockfile + lint + build green; CI all-pass; reviewer
      requested). Now `MERGEABLE`, `BLOCKED` on approval.

## Acceptance criteria

- Every PR in scope is at least MERGEABLE (no CONFLICTING), CI green or with a known,
  named, transparently-reported failure, and blocked only on human approval.
- No branch force-pushed (updates are forward merges only).
- No merge to `main` performed by the agent.

## Checks

- `gh pr view <n> --json mergeable,mergeStateStatus,statusCheckRollup` per PR after update.
- CI re-run completes before declaring green.

## Progress

- 2026-10-11: created. #343/#347 closed in prior step (33 → 30). Starting T1.
- 2026-10-11: T1 done — all 13 in-scope branches updated against main (BEHIND → BLOCKED).
  T2 done — cluster analysis (deps gap found; trim off the table; order = deps → #305 → #306
  → #341 → #310 → #303). T3 done for the cheap half — #305/#306 fixed and fully green
  (commits `18146d2`, `74f9ce3`, plus morphSlider fix). Board: 11/13 green, 2 red
  (#310 = needs deps + predecessors; #303 = route, must land last).
- Pending: user decision on creating the missing **deps PR** (from `feat/design-infrastructure`'s
  package.json hunk) to unblock #310/#303; then final report + hand back approvals.
- 2026-10-11: deps PR **#349** created (T5) and green — 6 deps, commit `6f4a579`, all CI
  checks pass, reviewer requested, `MERGEABLE`/`BLOCKED`. User's decision executed.

## Delivery strategy

- Forecast authored changed lines: small (updates are no-authored; any barrel fix is expected
  under ~200 lines). Delivery: work-unit commits on feature branches; no PR over ~400 lines.
- TDD: not applicable to this admin batch; applicable functional checks = CI (lint-and-build).

## Next step

T4: report state to the user; pending decision on the deps PR before touching #310/#303.