# Team integration — quick wins (unit 1)

**Feature**: team-integration (security + separation of duties for full team integration)
**Branch**: `feat/team-integration-quickwins` · **PR**: #279
**Date**: 2026-10-02
**Delivery strategy**: `single-pr` (30 authored changed lines, far under the 400-line budget)
**RDD**: on (global) · assess → `medium` (`configuration_change`), `review_due: false` (`under_budget`)

## Objective

First executable slice of the team-integration plan derived from the project-management
research (PDFs at `~/Descargas/Gestión de proyectos.pdf` — slide deck — and
`GESTIÓN DE PROYECTOS.pdf` — expanded document; same work, four disciplines:
administration, risk, change configuration, development environment).

## Checklist

- [x] T1 — `.env.example` with required + optional `VITE_` vars, verified against the 7 env
      var names actually used in `src/` and against `src/data/supabase.js:8` (throws on the
      two required ones). Commit `a27f57e`.
- [x] T2 — `.github/pull_request_template.md` encoding the existing PR rules and the explicit
      note that `pnpm typecheck` is NOT wired into CI. Commit `8aef3fc`.
- [x] T3 — Push + PR #279 opened, label `type:chore` applied.
- [ ] T4 — CODEOWNERS for `supabase/migrations/` and `.github/workflows/` (pending).
- [x] T5a — Branch protection audited + Etapa A applied (ruleset `PR` id 24085467):
      `dismiss_stale_reviews_on_push` false→true, PUT full-body, verified by full-file diff
      (only that flag + `updated_at` changed; 7 rules, GitGuardian required check, `strict`,
      both bypass actors byte-identical). 2026-10-02 20:34 -04.
- [ ] T5b (Etapa B) — Add `lint-and-build` to `required_status_checks`. **Blocked on #278
      merging**: the visual gate fails on every branch today, so activating this first would
      block all PRs. When unblocked (run from a checkout, ruleset 24085467):

      ```bash
      gh api repos/davidjesus516/cemurm/rulesets/24085467 > rs.json
      jq '(.rules[] | select(.type=="required_status_checks") | .parameters.required_status_checks)
          += [{"context":"lint-and-build"}]' rs.json > rs-new.json
      gh api repos/davidjesus516/cemurm/rulesets/24085467 --method PUT --input rs-new.json
      # verify: the context list must read ["GitGuardian Security Checks", "lint-and-build"]
      ```

- [ ] T5c (Etapa C) — User decision pending: remove the admin bypass (`RepositoryRole 5`,
      `bypass_mode: always`) and identify the Integration `1549082` that currently bypasses
      every rule (403 via API; name shows in Settings → Rules → ruleset PR).
- [ ] T6 — Measure onboarding zero-to-code < 15 min with a real team member (pending: team
      access must exist first).
- [ ] T7 — Grant teammates access with roles (pending: user decision on who/what role).

## Verification evidence (observed, not assumed)

- Structural readback of both files: exact contents verified.
- `bash scripts/check-visual-contract.sh` → **FAIL**, and it fails identically on pristine
  `origin/main` at `e849738`: 01b 92/ceiling 82, 02 274/ceiling 252, 06 = 1. Pre-existing
  debt; this unit adds nothing under `src/`. PR #278 is the green fix (its CI: SUCCESS).
- `pnpm lint` / `pnpm test` / `pnpm build`: NOT run locally (worktree has no `node_modules`;
  no JS changed). CI runs them, but the visual gate aborts the job before `test`/`build` on
  every push to `main` right now (finding #11 in #278).
- Native review preflight: attempted → `immutable_review_transport_unsupported`
  (supported runtimes: claude-code, codex). Review receipt PENDING, never granted.

## Findings worth keeping

1. **CI on `main` is permanently red** and skips `test`/`build` — fixed by open PR #278
   (green). Root cause of how it landed: `lint-and-build` was **never a required status
   check** (only GitGuardian was), and the admin bypass let #274/#275 merge anyway.
   Merge order: #278 → #277 (typecheck; failed only on the gate, typecheck itself
   passed) → #279.
2. **The repo cannot satisfy its own review rule yet**: PR #279 has `reviewDecision:
   REVIEW_REQUIRED` under `require_last_push_approval`, but author == reviewer ==
   `davidjesus516`, so the reviewer request is a silent no-op and no approval is obtainable
   until a second account has access. This is the concrete "separation" gap the plan targets.
3. AGENTS.md still points at `src/lib/supabase.js`; the real file is `src/data/supabase.js`
   (known finding; `.env.example` uses the real path).
4. Secrets scan over tracked files: clean. `.gitignore` covers `.env*`. Resend key lives only
   in Supabase Vault (`service_role`); seed `password1234` is a documented local fixture.

## Deviations

- The `branch-pr` skill mandates an approved linked issue per PR; cemurm has no PR-validation
  workflow and recent precedent (#277, #278) ships without one. Followed repo precedent,
  added the `type:chore` label the skill's scheme expects.

## Next step

Etapa B (required check `lint-and-build`) activates only after #278 merges; T5c (admin
bypass + Integration 1549082) and T7 (teammate accounts/roles) await user decisions.
Merge order unchanged: #278 → #277 → #279.
