# Plan-freeze error mapping — 0034 literals in USER_ERRORS (Hito 5 follow-up)

## Goal
Close **finding 3** of `odd/tasks/offboarding-cascade.md` ("Findings to carry forward"):
`0034_plan_freeze.sql` raises seven raise-sites / **five distinct** literals that `USER_ERRORS`
did not carry, so every plan-freeze rejection through `services.js` reached the UI as
`'Something went wrong. Please try again.'`.

- `publish_plan` raises `'Service not found'` (`0034`), `'Only the service leader can publish the plan'` and `'A completed service is read-only'`
- `get_published_plan` raises `'Service not found'` and `'Not visible to this user'`
- `list_plan_versions` raises `'Service not found'` and `'Only the service leader can view version history'`

## Scope (deliberate)
**Client allowlist only — no DB text change.** The five literals are period-less by design (they were
raised that way in the Hito-5 evidence, `odd/tasks/hito5-plan-freeze.md:31` quotes one verbatim);
rewriting the DB strings would alter user-visible text already shipped. `USER_ERRORS` in
`src/data/repositories/services.js` gains the five exact strings plus a period-less
`'Service not found'` alongside the existing `'Service not found.'` (both spellings stay
serviceable; the comment names which cores raise which).

**No OpenSpec change:** no requirement is added or altered — this is the rejection surface of the
already-spec'd plan-freeze capability (`openspec/specs` had no delta to write). Recorded here only.

## Reachability (traced this unit — the finding's open question)
- `handlePublish` → `setPublishError(err.message)` and `handleShowHistory` → `setHistoryError(err.message)`
  in `src/features/services/pages/ServiceDetail.jsx` — publish and version-history rejections ARE
  user-visible, so the mapping turns their generic fallback into the real messages.
- `getPublishedPlan(id).catch(() => null)` — the read path swallows errors, so
  `'Not visible to this user'` / `'Service not found'` on the get side are **not** user-visible today;
  the mapping is the precondition for any future surfacing, not a live-bug fix for that path.
- The publish button is leader-gated and completed services hide it, so
  `'Only the service leader can publish the plan'` / `'A completed service is read-only'` are
  race-window rejections (e.g. a second tab completes the service mid-publish) — the UI would
  previously have rendered the generic message for them.

## Evidence
- `src/data/repositories/services.js`: five literals added to `USER_ERRORS` with raise-site comments.
- `src/data/repositories/services.test.js`: new `plan-freeze error mapping (0034)` block —
  `it.each` over the five literals (each through its actual wrapper), asserting verbatim re-throw
  **and** object identity (`.code` preserved — the offline drain classifies on it), plus a
  negative case (an unmapped raise still genericizes).
- **+6 tests, no new file** (the cases live in the existing `services.test.js`). On this unit's own
  main-based branch the suite went 462 → **468** (24 files); the same source measured 466 → **472**
  on the stacked development base (`feat/account-export-pr5-import`, which already carries the
  respond-member-guard PR files) where the edit was written. `pnpm test:gherkin` 44/44,
  `pnpm build` green on this branch.

## Falsifiability
Neutering one mapping — `'Not visible to this user'` deleted from `USER_ERRORS` — turns exactly its
`it.each` case red (`471 passed / 1 failed`, failure `services.test.js:132` "Not visible to this user
passes through verbatim") while the other four literals and all earlier seam cases stay green.
Restored byte-identical (`diff` clean) and re-run **472/472**. The property pinned is set membership:
each literal must be in the set for its wrapper to re-throw verbatim.

## Honest limitations
- **`pnpm test:gherkin` cannot reach this unit** (it never opens `.feature` files); the seam tests
  are unit-level evidence, not BDD execution.
- **No fresh-reset SQL work here**: no migration, no smoke touched, `supabase db reset` untouched —
  pure client mapping, so no smoke tier was warranted.
- **Carry-forward (found during recon, deliberately not fixed here — different unit, its own
  wrapper):** `0035_projection.sql:48` raises the same `'Not visible to this user'` and **no
  repository anywhere maps it** (`grep` over `src/data/repositories`: zero matches). Whatever file
  wraps `get_projection` for the stage/projection path still genericizes it. Same defect class
  as this unit.
- The get-side literals surface nothing today while `catch(() => null)` stands — recording the
  mapping as precondition, not as a proven user-visible fix for that path.

## Verification commands
```bash
pnpm test && pnpm test:gherkin && pnpm typecheck && pnpm lint && pnpm build   # all green
```
