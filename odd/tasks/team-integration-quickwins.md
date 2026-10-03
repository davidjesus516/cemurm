# Team integration — quick wins (unit 1)

**Feature**: team-integration (security + separation of duties for full team integration)
**Branch**: `feat/team-integration-quickwins` · **PR**: #279
**Date**: 2026-10-02
**Delivery strategy**: `single-pr` (147 authored changed lines across 4 paths after the
Etapa-C record and CODEOWNERS — still under the 400-line budget)
**RDD**: on (global) · assess → `medium` (`configuration_change`), 4 paths / 147 lines,
`review_due: false` (`under_budget`)

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
- [x] T4 — `.github/CODEOWNERS` for `supabase/migrations/` and `.github/workflows/`
      (`@davidjesus516`), both paths verified to exist; commit `d9b81ae`. GitHub-side
      validation via GraphQL `Repository.codeowners` reads the default branch, so it
      resolves only after #279 merges. **Etapa D (`require_code_owner_review`)
      deliberately deferred until a second code owner exists**: with a single owner, that
      owner's own PRs touching these paths could never collect code-owner approval
      (last-push rule), i.e. a self-lockout.
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

- [x] T5c (Etapa C) — Admin bypass removed (2026-10-02 20:59 -04, ruleset 24085467). Full-body
      PUT verified by diff: exactly two deltas — `RepositoryRole 5` dropped from
      `bypass_actors` and the `update` rule dropped; everything else byte-identical
      (`dismiss_stale_reviews_on_push` stays `true` from Etapa A). Remaining bypass: only
      `Integration:1549082`, identified 2026-10-03 via GraphQL
      `Repository.ruleset(databaseId: 24085467).bypassActors` → **App `opencode-agent`
      ("OpenCode Agent")**, `bypassMode: ALWAYS` — the OpenCode↔GitHub integration itself,
      which today could push to main, force-push, or merge without approval/checks.
      Whether to drop this last bypass is the user's pending decision.

      **The `update` removal was a forced companion of the bypass removal, decided by an
      empirical probe on disposable branches (temporary rulesets + branches, all deleted
      after; probe PR #280 marked disposable):**

      | Probe scenario | Result |
      |---|---|
      | `update`, empty bypass → normal merge | ✗ blocked |
      | `update`, empty bypass → `--admin` merge | ✗ `Cannot update this protected ref` |
      | `update`, bypass = RepositoryRole 5 → normal merge | ✗ blocked (UI shows the bypass checkbox) |
      | `update`, bypass = RepositoryRole 5 → `--admin` merge | ✓ merged |
      | `pull_request` only → direct push, no bypass | ✗ `Changes must be made through a pull request` |

      Conclusion: with `update` active, only bypass-listed actors could merge, and only with
      explicit bypass — so removing the admin bypass while keeping `update` would have locked
      out every human (including the repo owner). `pull_request` alone already blocks direct
      pushes, so `update` was redundant for protection and only harmful for merges.
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
2. **The `update` rule was silently breaking separation**: added to the ruleset in its
   2026-09-29 update, it blocked PR merges for every actor not in the bypass list —
   `Antony-Figueroa` (write) merged #235 on 2026-09-28 and has been unable to merge since.
   Only `davidjesus516` could merge, and only with explicit bypass (`--admin`). Probe-proven
   matrix recorded under T5c; fixed by dropping the rule (`pull_request` covers direct
   pushes) when the admin bypass was removed.
3. **The repo cannot satisfy its own review rule yet**: PR #279 has `reviewDecision:
   REVIEW_REQUIRED` under `require_last_push_approval`, but author == reviewer ==
   `davidjesus516`, so the reviewer request is a silent no-op and no approval is obtainable
   until a second account has access. This is the concrete "separation" gap the plan targets.
4. AGENTS.md still points at `src/lib/supabase.js`; the real file is `src/data/supabase.js`
   (known finding; `.env.example` uses the real path).
5. Secrets scan over tracked files: clean. `.gitignore` covers `.env*`. Resend key lives only
   in Supabase Vault (`service_role`); seed `password1234` is a documented local fixture.

## Deviations

- The `branch-pr` skill mandates an approved linked issue per PR; cemurm has no PR-validation
  workflow and recent precedent (#277, #278) ships without one. Followed repo precedent,
  added the `type:chore` label the skill's scheme expects.

## Next step

Review requested from `Antony-Figueroa` on #278 (2026-10-03) — his approval is now the
merge-order gate: #278 → #277 → #279, re-requesting/rebasing each next PR after the
previous merge (strict + stale-dismiss make approvals non-transferable). Etapa B
(required check `lint-and-build`) activates the moment #278 lands. Awaiting user decisions:
(a) drop the `opencode-agent` bypass (last remaining actor), (b) T7 teammate accounts/roles
(unblocks T6, the second approver for #277/#279, and Etapa D).
