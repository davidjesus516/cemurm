# Feature: The Vibe Coding Blueprint — docs gaps + visual viewer

**Status:** in_progress
**Branch:** `feat/blueprint-docs` (from `main` @ dd5419b)
**Delivery strategy:** `ask-on-risk` — forecast ~900–1100 authored lines, exceeds the 400-line
slice budget, so this ships as a chained PR sequence (see Slices).
**Route:** delegated direct (writer trigger: 2+ non-trivial files; mapping done inline, see
Route declaration per task).

## Objective

Close the documentation gaps identified by auditing *THE VIBE CODING BLUEPRINT* against the
repo, and add a static visual viewer that renders the documentation so it can be read and
reviewed without opening raw markdown.

## Problem / Why

The blueprint's thesis is "context before code": a documented source of truth stops an AI
agent from guessing. CEMURM already satisfies ~70% of the blueprint under different names
(`AGENTS.md`, `features/*.feature`, `docs/master-plan.md`, `skills/cemurm-visual-system`).
Re-creating the missing documents as *new* structures would create a second source of truth,
which is the exact failure mode the blueprint warns about (mistakes 2 and 9).

Three genuine gaps remain:

1. **Security rules are dispersed.** RLS, the `charts` bucket policy, signed-URL lifetime, the
   app-side 10 MB PDF cap, and the env-var classification live in `AGENTS.md` prose, migration
   comments, and `docs/local-dev.md`. No single document answers "what must be protected and how".
2. **Architectural rationale is unrecoverable.** `odd/tasks/*.md` records *what* was done, not
   *why* the shape was chosen. Decisions like "JSX not TSX", "no Zustand", "RLS instead of API
   routes" are re-debatable every session because no ADR holds them.
3. **Documentation has no visual surface.** Five archify HTMLs exist for diagrams, but the
   textual corpus (design tokens, decisions, architecture) has no rendered view.

## Scope

### In scope

- `docs/security.md` — consolidated security rules, sourced from existing implementation.
- `docs/decisions.md` — ADR records for decisions already made and in force.
- A static viewer generated **from** the `.md` files (never a hand-maintained copy) plus the
  generator that produces it.
- Three designed sections: design system (real token values), decisions (ADR cards),
  architecture (dependency structure).
- Gate run: visual contract, lint, test, typecheck, build.

### Out of scope

- `PRD.md`, `ARCHITECTURE.md`, `CODE_STYLE.md`, `TESTING.md` — already covered by
  `features/*.feature`, `AGENTS.md`, and `docs/master-plan.md`. Creating them would duplicate.
- Any change inside `src/` or the authenticated bundle. The viewer is static under `docs/`.
- Any token, colour, or visual-system change. The viewer *displays* `assets/tokens.css`; it
  never redefines it.
- Any migration, schema, or dependency change.

## Constraints

- The viewer must be a static file in `docs/`, openable by double-click, consistent with the
  five existing archify HTML files (dark default + light toggle, JetBrains Mono family).
- The generator reads `skills/cemurm-visual-system/assets/tokens.css` so displayed hex values
  are the real tokens, not transcriptions.
- Design direction (taste skill): technical-editorial docs viewer for the maintainer and
  agents. Dials `DESIGN_VARIANCE 6 / MOTION 4 / VISUAL_DENSITY 3`. One accent only
  (`cem.amber`), dark/light locked at page level, `prefers-reduced-motion` honoured, WCAG AA.
- Artifacts (docs, ADRs, UI copy) are written in English.
- Characterization tests are never edited to go green.

## Slices

- **PR 1 (`pr1-docs`)** — `docs/security.md`, `docs/decisions.md`. Forecast ~300 lines.
- **PR 2 (`pr2-viewer`)** — generator + template + designed sections + gate run. Forecast
  ~600–800 lines.

## Acceptance criteria

- [ ] `docs/security.md` answers authentication, authorization, secrets, env vars, data
      protection, and file-upload rules, with every claim traceable to an existing file.
- [ ] `docs/decisions.md` holds one ADR per in-force decision, each with context / decision /
      alternatives / reason / consequences.
- [ ] The viewer renders every `docs/*.md` from the generated output; no documentation content
      is duplicated by hand.
- [ ] The design-system section shows hex values read from `assets/tokens.css`.
- [ ] Viewer opens offline from the filesystem with no console errors.
- [ ] `bash scripts/check-visual-contract.sh` PASS; `pnpm lint && pnpm test && pnpm typecheck
      && pnpm build` all pass.
- [ ] Work-unit commit per slice, conventional commit message, PR opened with reviewer.

## Task checklist

- [ ] **T1 — `docs/security.md`.** Route: delegated (writer trigger — source-dispersed content
      requiring multi-file reading). Trigger evidence: reads `AGENTS.md`, `docs/local-dev.md`,
      migrations, and `src/lib/supabase.js`; writing prepares on that reading.
- [ ] **T2 — `docs/decisions.md`.** Route: delegated (same writer as T1 — one writer for the
      paired docs).
- [ ] **T3 — viewer generator + template.** Route: delegated (writer trigger — 2+ non-trivial
      files, design work against the taste skill).
- [ ] **T4 — designed sections (design system / decisions / architecture).** Route: delegated
      (same writer thread as T3).
- [ ] **T5 — gates + slice commits + PRs.** Route: inline for git state, delegated for the
      full gate run.

## Progress log

- 2026-10-04 — Feature document created; branch `feat/blueprint-docs` cut from `main`.
