# Feedback triage — unblock the CI gates

- **Change:** repair of the uncommitted `feat/feedback-triage` work (surprise audit 2026-10-29).
- **Branch:** `feat/feedback-triage`, HEAD `05a6667` (3 commits behind `origin/main` = `86ab810`).
- **TDD:** off (`openspec/config.yaml:13` `strict_tdd: false`). Verification is the repo's JS
  contract — `pnpm test && pnpm typecheck && pnpm lint && pnpm build` — plus `deno check` for the
  Edge Function and one smoke run against a freshly reset local DB.
- **Migration:** `0046_feedback_triage_and_github_link.sql`; `0046` is free on `main` and on every
  remote branch (verified 2026-10-29), so no renumber.

## Problem (one paragraph)

The feature was written in one pass and never run through the repo's gates. Four of them fail —
`build` (wrong `supabase` client path), `lint` (34 `react/prop-types` errors), `deno check`
(`TS18046 'e' is of type 'unknown'`) and the visual gate via `pnpm test` (5 default-palette
utilities) — and four would-be defects hide behind them: the guard renders nothing for admins
because a layout route needs `<Outlet />`, the triage write path has no `grant update` so the new
RLS policy is dead, the Edge Function calls an RPC that is not exposed, and the smoke script has no
preamble and no expected-pass line.

## In scope / out of scope

**In:** the six fixes above plus the `search_path` alignment of the new helper and the smoke
rewrite. **Out:** the 13 BDD scenarios beyond the guard's access-denied state (no step definitions
yet), unit tests for the service/hook, the navigation entry, the hosted-project link in
`supabase/.temp/`, and the `AGENTS.md` drift — all reported separately in the audit.

## Tasks

- [x] **T1** — Point the three new modules at the real client (`src/data/supabase.js`) instead of the
      non-existent `src/lib/supabase`.
- [x] **T2** — Add the repo's `/* eslint-disable react/prop-types */` head to the four new components;
      fix the `exhaustive-deps` warning in `useFeedbackTriage` without changing its behaviour.
- [x] **T3** — Type the Edge Function's `catch` variable so `deno check` passes on TS 6.
- [x] **T4** — Replace the 5 default-palette utilities with `cem` tokens; visual gate rule 01b back to 0.
- [x] **T5** — `RequireSystemAdmin` renders `<Outlet />` when allowed and an access-denied state when
      not (`features/feedback-triage.feature` @access), instead of returning `children`/redirecting.
- [x] **T6** — `0046`: reset the table ACL (see the correction below) and grant `update` on the triage
      columns only; align the helper's `search_path` with the repo's `''` convention.
- [x] **T7** — Drop the unexposed `private.is_system_admin` RPC call in the Edge Function and keep the
      single service-role role check.
- [x] **T8** — Rewrite `scripts/smoke/0046-feedback-triage.sql` with the documented preamble
      (`tmp_assert`, `tmp_expect_error`), role-switched RLS coverage, and an `expects N PASS / 0 FAIL`
      line that matches the observed run.

## Correction to the audit (T6)

The audit said the missing `grant update` made the new policy dead. That was **wrong in effect**: the
Supabase default privileges hand `authenticated` `arwdDxtm` (ALL) on every new table in `public`, and
`0033` only revoked from `public, anon` — so `authenticated` already held UPDATE and the policy was
reachable. The real defect is the opposite and worse than reported: the table carried DELETE and
TRUNCATE too, against `0033`'s own "reports are immutable" contract, and **RLS never filters
TRUNCATE**. The first smoke assertion (`has_table_privilege(...,'UPDATE')`) passed for that wrong
reason, which is why the first pass looked green.

`0046` now revokes ALL from `authenticated` and re-grants `insert, select` plus column-scoped `update`
on the triage surface. Verified after reset: `authenticated=ar` at table level,
`has_column_privilege(status)=true`, `(user_id)=false`, DELETE/TRUNCATE `=false`.

## Verification evidence

- `pnpm lint` → exit 0, zero output.
- `pnpm typecheck` → exit 0.
- `pnpm build` → `✓ built in 9.82s` (only the pre-existing >500 kB chunk warning).
- `deno check 'supabase/functions/**/*.ts'` → 3 functions checked, 0 errors.
- `pnpm test` → `Test Files 27 passed`, `Tests 496 passed`.
- `bash scripts/check-visual-contract.sh` → `visual contract: OK (12 rules checked, 0 failing)`;
  rule 01b 0 occurrences, rule 02 still 240/240 (ratchet untouched).
- `supabase db reset` → all 46 migrations applied, seed loaded, 0046 clean.
- `scripts/smoke/0046-feedback-triage.sql` → **15 PASS / 0 FAIL** (13 `tmp_assert` + 2
  `tmp_expect_error`).
- No test was edited, skipped or weakened.

## Delivery

- **Delivery strategy:** `ask-on-risk`. The forecast (1.269 authored lines, generated lockfile
  excluded) exceeded the 400-line budget, so the maintainer was asked and chose chained PRs.
- **Chain strategy:** `stacked-to-main`. Every PR targets `main`; each branch is based on the
  previous slice, so a later PR shows the accumulated diff until its parent merges.
- **Slice boundaries** (each ≤400 authored lines):

  | Slice | Contents | Lines |
  |---|---|---|
  | S1 | `0046_feedback_triage_and_github_link.sql` + `scripts/smoke/0046-feedback-triage.sql` | 314 |
  | S2 | `supabase/functions/feedback-to-issue/index.ts` | 196 |
  | S3 | `src/app/guards/`, `src/features/feedback-triage/`, `src/app/router.jsx` | 380 |
  | S4 | `features/feedback-triage.feature`, `openspec/changes/add-feedback-triage/`, this record | 379 |

- The 401-line `package.json` / `pnpm-lock.yaml` / `AGENTS.md` diff was **not** feature work: it was
  the branch sitting 3 commits behind `main`, where #421 dropped the template mock dependencies.
  Merging `main` removed it instead of shipping it.

## Opened PRs

| Slice | PR | Branch | Commit |
|---|---|---|---|
| S1 | #430 | `feat/feedback-triage-pr1-db` | `d100f18` |
| S2 | #433 | `feat/feedback-triage-pr2-edge` | `35759cc` |
| S3 | #431 | `feat/feedback-triage-pr3-ui` | `8c5b0c9` |
| S4 | #432 | `feat/feedback-triage-pr4-docs` | `bee77c1` |

All four target `main`. Merge order is bottom-up: S1 → S2 → S3 → S4. The four commits were rebased
onto `86ab810` before opening, and the rebased tree is byte-identical to the merged tree the gates
ran against (`3ad5b97`), so the verification evidence below applies to exactly the pushed bytes.

### What is still unverified

- The Edge Function's happy path never ran: no GitHub token is configured locally. Only
  `deno check` covers it.
- `/feedback-triage` was never exercised in a browser. The access rule is verified by reading the
  route tree, not by running it.
- The 13 BDD scenarios have no step definitions, so `pnpm test:gherkin` does not execute them.
