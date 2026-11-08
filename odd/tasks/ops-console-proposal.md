# Internal operations console — proposal slice (PR #425, slice 3)

Branch: `docs/ops-console-proposal`. Delivery: single PR, `size:exception`
documentado — 965 authored lines, all of them one capability's documents
(proposal + spec + feature). Splitting proposal.md from spec.md would be
artificial; there is no functional half of a proposal.

## Objective

Publish the console proposal — and only the proposal — with the `/dashboard`
route question recorded as open instead of claimed as settled. *(L4 closed that
question at `/ops`; the Objective is the L3 state.)*

## Problem / Why

Reviewer findings on #425, slice 3:

1. **The route claim conflicts with the code.** The proposal asserted
   `/dashboard` as the console's home, but that path is mounted behind
   `RequireOrgOwner` (`src/app/router.jsx:86-110`), which is owner-only by
   contract — it denies every role the console exists to serve
   (`system_admin`, `community_moderator`). The affected-areas table listed
   two guards and omitted the one that matters.
2. **Two voices.** `proposal.md:1` asserted the route as settled while the
   PR body called it undecided, and the maintainer's 2026-10-20 `/admin`
   template decision lived only in the PR body.
3. **No Open Questions section** — the one product decision the proposal
   needed had nowhere to live.

The maintainer decided (2026-11-03): publish the proposal with the route as
an explicit **Open question**. Do not decide the path today; decide it when
the console is built.

## Change

- `proposal.md` — status line and the route paragraph said **proposed,
  not settled**; new `## Open questions` section carrying the route conflict
  with evidence (`RequireOrgOwner`'s own contract text), the 2026-10-20
  context, and the three options (widen the guard / new path with its own
  guard / the `/admin` template); the affected-areas `router.jsx` row now
  names `RequireOrgOwner` and the open decision. **L4 renamed that section to
  `## Resolved questions` and replaced the three options with the decision.**
- `specs/internal-operations-console/spec.md` — at L3 the Purpose stated the path as proposed and
  pointed at the proposal's `## Open questions`. **L4 changed both: the Purpose now states the
  path is settled and points at `## Resolved questions`.**
- `features/internal-operations-console.feature` — unchanged at L3. It used `/dashboard` as the
  proposed path name; a route decision renames it mechanically. It is inert by design
  (`test:gherkin` does not execute `features/`), and the reviewer confirmed the 29 scenarios are
  well-structured with the two-tier access model traced to `0020` and
  `community-moderation.feature`. **L4 paid that rename: `/ops`, six literals, 29 scenarios
  still.**

## Verification

- No application code, no migrations, no dependencies — `pnpm test`,
  `pnpm typecheck`, `pnpm lint` and `pnpm build` are unaffected by definition.
- The route claims were checked against the code, not assumed:
  `src/app/router.jsx:86-110` mounts `dashboard` under `RequireOrgOwner`;
  `src/app/providers/RequireOrgOwner.jsx` states the owner-only contract
  verbatim; `src/app/guards/RequireSystemAdmin.jsx` (PR #437) is the
  existing precedent for a dedicated staff guard on its own path.
- OpenSpec structure: the change lives in
  `openspec/changes/add-internal-operations-console/` with `proposal.md` and
  `specs/<capability>/spec.md` — a proposal, not a shipped spec; it is
  archived only when the change closes.

## Scope

Third and last slice of the #425 split. Slice 1 shipped as #439 (uc-04
cards fix), slice 2 as #440 (amp-02 + roadmap). With this PR, nothing from
#425 remains unsplit.

## Log

- L1 (2026-11-02, reviewer): split request — 860 authored lines of proposal
  need a route decision before anyone writes code; `/dashboard` is occupied
  by a guard that denies the console's whole audience; the affected-areas
  table omits `RequireOrgOwner`; `proposal.md` asserts the route as settled
  while the PR body calls it undecided; no Open Questions section.
- L2 (2026-11-03, maintainer): publish as docs with the route recorded as
  an Open question. Do not decide the route today.
- L3 (2026-11-03, exception): 965 authored lines against the 400 budget.
  The three files are one capability's proposal — spec scenarios and
  feature scenarios restate the same rules, so no slice of them is
  independently reviewable. Exception recorded here per the
  `hito5-substitutions-and-coverage.md:4` format.
- L4 (2026-11-08, maintainer): the open question is **closed — `/ops`**.
  `/dashboard` was rejected because `RequireOrgOwner` is owner-only by
  contract and widening it would give platform staff an org-scoped dashboard;
  `/admin` because the 2026-10-20 decision reserves it for the gerencial
  template. `/ops` is free (`src/app/router.jsx`, `src/routes/Router.tsx` and
  a repo-wide search all agree) and is served by a new `RequireStaff` guard
  admitting `isSystemAdmin || isModerator`. Renamed in the three artifacts —
  `.feature` (6), `proposal.md` (14), `spec.md` (8) — and the proposed feature
  directory moves to `src/features/ops/`. No application code in this unit.
  Delivered on its own branch, `docs/ops-console-route` (PR #449), not on
  `docs/ops-console-proposal`.
