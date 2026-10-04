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

- [x] **T1 — `docs/security.md`.** Route: delegated (writer trigger — source-dispersed content
      requiring multi-file reading). Trigger evidence: reads `AGENTS.md`, `docs/local-dev.md`,
      migrations, and the Supabase client; writing prepares on that reading.
      Done — 282 lines, 7 sections, commit `23127b6`.
- [x] **T2 — `docs/decisions.md`.** Route: delegated (same writer as T1 — one writer for the
      paired docs). Done — 228 lines, ADR-001..010, commit `23127b6`.
- [x] **T3 — viewer generator + template.** Route: delegated (writer trigger — 2+ non-trivial
      files, design work against the taste skill).
      Done — `scripts/build-docs-viewer.mjs` (1979 lines, Node ESM, zero dependencies). Run
      command lives in the script header: `node scripts/build-docs-viewer.mjs` (no npm script
      on purpose — `package.json` is outside the edit surface). It embeds the markdown
      renderer, the `tokens.css` parser, the ADR parser, the `SKILL.md` tier-table extractor,
      the `src/` import scan, the page template and the routing script.
- [x] **T4 — designed sections (design system / decisions / architecture).** Route: delegated
      (same writer thread as T3).
      Done — `docs/handbook.html`, generated only (4225 lines, 577.2 KiB): 16 doc pages, the
      three designed sections, 9 links to the existing HTML visualizations. Verification:
      double-run sha256 identical (`349e904a…c988d9f`); `grep -c 'ADR-0'` = 37;
      `grep -c '#f59e0b\|--cem-accent'` = 25; 12 unique external URLs (5 clickable, 2 of them
      the font pair, the rest document content); `bash scripts/check-visual-contract.sh` →
      `visual contract: OK (10 rules checked, 0 failing)` — note that gate scans `src/` only
      and does **not** cover `docs/*.html`. Routing, theme bootstrap and the <768px top-bar
      fallback were verified headlessly (colour-marker probe per route + pixel checks).
- [ ] **T5 — gates + slice commits + PRs.** Route: inline for git state, delegated for the
      full gate run.
      Not started in this session: `pnpm lint|test|typecheck|build` were deliberately not run
      (they would exercise `src/`, which carries another session's uncommitted changes), and
      nothing was committed — the session sits on `feat/landing-page`, not `feat/blueprint-docs`.
      The visual contract gate *was* run (see T4).

## Progress log

- 2026-10-04 — Feature document created; branch `feat/blueprint-docs` cut from `main`.
- 2026-10-04 — **T3/T4 landed (uncommitted).** Added `scripts/build-docs-viewer.mjs` and its
  generated `docs/handbook.html`; updated this record. Sources parsed at build time: 16
  `docs/*.md` (5232 lines), 48 tokens from `skills/cemurm-visual-system/assets/tokens.css`,
  ADR-001..010 from `docs/decisions.md`, the four-row Decision Gates table from
  `skills/cemurm-visual-system/SKILL.md`, and a live `src/` scan (145 files, 10 folders, 29
  cross-folder import edges, 17 Supabase-client importers — 2 of them outside `src/data/`).
  Findings recorded in the output rather than smoothed over: `src/domain/music/degreeResolver.js`
  imports `src/data/repositories/scaleCatalog.js` (one outward edge from the pure layer), and
  `features`/`hooks` import `src/app/providers/useAuth.jsx` 30 times (shared provider, not a
  layer). Determinism, link/id integrity (20 pages, 413 ids, 0 broken internal links), zero
  hex outside the token layer and the responsive fallback were all verified; see T4 for the
  command output. Not run: `pnpm lint|test|typecheck|build` (their scope is `src/`, which
  holds another session's uncommitted work) — T5 still owes them, plus the slice commits.
