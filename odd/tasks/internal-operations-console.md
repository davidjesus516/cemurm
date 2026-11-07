# Internal operations console — proposal, spec and the UML contexts it needs

Branch: `docs/uml-contexts-and-ops-console`. Delivery: single PR #425, `size:exception`
documented below.
Feature: `features/internal-operations-console.feature` (29 scenarios).

## Size exception

Measured against `origin/main` at `e774ad9`, after merging `main` into the branch:
**1,132 authored changed lines**, over the 400 budget.

```
  331  openspec/changes/add-internal-operations-console/specs/internal-operations-console/spec.md
  286  openspec/changes/add-internal-operations-console/proposal.md
  251  docs/uml/amp-02-arquitectura-contextos.archify.json
  243  features/internal-operations-console.feature
   17  docs/uml/uc-04-alcance-institucional.cards.json
```

The two generated viewers are already excluded by the measurement (2 files, 29,867 lines:
`amp-02-arquitectura-contextos.html` and `uc-04-alcance-institucional.html`). They do not
justify anything here; the number above is content someone has to read.

The exception is accepted because slicing cannot bring this unit under the budget without
cutting artifacts that are coherent only together:

- The console trio — proposal (286), spec (331) and feature (243) — is 860 lines. Moving the
  feature to its own PR leaves **617** in proposal + spec: still over 400. The only way below
  that is to split a single capability spec across PRs, which costs a reviewer more context
  than reading it once.
- The two UML artifacts (268 lines) could have shipped alone and under budget. They were not
  split because they are the same authoring pass over the same milestone document set, and the
  console proposal cites both diagrams. Lifting them out would leave the proposal's references
  pointing at files that do not exist on `main` yet.

Generated artifacts are excluded from the count and are not part of this justification.

## Objective

Specify the internal operations console — the moderator and system-administrator surface the
feedback triage inbox needs — and complete the two UML context diagrams it references
(`uc-04` scope and `amp-02` architecture contexts).

## Problem / Why

The feedback triage chain (#430–#433) shipped an inbox gated on `isSystemAdmin` with no
documented surface of its own: no route contract, no navigation model, no stated answer for
what a moderator sees versus what a system administrator sees. The capability existed in code
and nowhere as a specification, so the next slice had no definition to build against.

## Scope

In:

- `features/internal-operations-console.feature` — 29 scenarios covering route placement,
  the two navigation tiers, the sidebar's behavior (icon rail, persisted collapse, keyboard
  toggle, mobile drawer, focus return, reduced motion), empty and denied states.
- `openspec/changes/add-internal-operations-console/` — proposal and delta spec for the
  `internal-operations-console` capability.
- `docs/uml/amp-02-arquitectura-contextos.{archify.json,html}` — architecture context diagram.
- `docs/uml/uc-04-alcance-institucional.{cards.json,html}` — use-case scope cards.

Out: the console's implementation. No `src/` file changes here; this unit is specification and
diagram only.

## Decisions

- **The route is proposed, not settled.** `/dashboard` is the proposal's placement, registered
  inside `RequireAuth` and `RequireGuardianConsent` and outside `AppLayout`. The proposal keeps
  it as an open question so a reviewer can move it without rewriting the spec.
- **Two tiers, one surface.** The console serves `community_moderator` and `system_admin`; the
  administrator sections are absent — not disabled — for a moderator, matching the tiering
  `0020` already establishes.
- **This branch supersedes three others.** `docs/uml-uc04-build-fix` (439), `docs/uml-amp-02-contexts`
  (440) and `docs/ops-console-proposal` (442) each carry a subset of these artifacts. The
  `uc-04` cards, the `amp-02` sources and the console feature are byte-identical here; the only
  content not absorbed is their `odd/tasks/*.md` records and 440's `docs/roadmap-ampliacion.md`
  correction, which belong in their own follow-up.

## Verification

Run in the worktree that produced commit `010f141`, after merging `e774ad9` into the branch:

- `bash scripts/check-doc-counts.sh` — OK (44 migrations, 22 smokes, 48 features, 776 scenarios,
  `0047` free). This gate landed on `main` while the branch was open and failed on first run:
  the new feature moved the tree to 48 / 776 while `AGENTS.md` and `docs/master-plan.md` still
  said 47 / 747. Repaired in `010f141`.
- `bash scripts/check-migrations-unique.sh` — OK.
- `node scripts/check-migrations-destructive.mjs` — OK (44 files, 0 destructive).
- `node scripts/hooks/pre-tool-guard.selftest.mjs` — 79 checks passed.
- `bash scripts/check-test-integrity.sh` — OK (32 test files).
- `bash scripts/check-visual-contract.sh` — OK (12 rules, 0 failing).

Not run locally in that worktree: `pnpm test`, `pnpm test:gherkin`, `pnpm build` — the worktree
has no `node_modules`, so CI is the evidence for those. `lint-and-build`, CodeQL and GitGuardian
were green on `5b3f09a` and re-run on `010f141`.

## Deviations

- The branch was opened before `check-doc-counts.sh`, `pre-tool-guard.selftest.mjs` and
  `check-migrations-destructive.mjs` existed on `main`. Merging `main` pulled all three gates in
  and the counts repair was required to satisfy the first one.
- `docs/ops-console-proposal` (442) carries a **newer** revision of this proposal than this
  branch does: it states the route as an open question. The two differ in 5 hunks (38 added,
  11 removed), all of them softening a settled-sounding decision, so 442 remains a follow-up
  rather than being closed as absorbed.
