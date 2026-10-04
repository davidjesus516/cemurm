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

- [x] `docs/security.md` answers authentication, authorization, secrets, env vars, data
      protection, and file-upload rules, with every claim traceable to an existing file.
- [x] `docs/decisions.md` holds one ADR per in-force decision, each with context / decision /
      alternatives / reason / consequences.
- [x] The viewer renders every `docs/*.md` from the generated output; no documentation content
      is duplicated by hand. — 16 docs, 5232 source lines, generated at build time.
- [x] The design-system section shows hex values read from `assets/tokens.css`. — 48 tokens
      parsed; the 41 required ones are fail-loud.
- [ ] Viewer opens offline from the filesystem with no console errors. — routing/theme/
      responsive verified headlessly by the writer; **not yet confirmed by the maintainer in a
      real browser.** Open `docs/handbook.html` by double-click to close this.
- [x] `bash scripts/check-visual-contract.sh` PASS; `pnpm lint && pnpm test && pnpm typecheck
      && pnpm build` all pass.
- [ ] Work-unit commit per slice, conventional commit message, PR opened with reviewer.
      — commits done (`95eb423`, `39c47a6`); PRs still to open.

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
- [x] **T5 — gates + slice commits.** Route: inline for git state, delegated for the full
      gate run.
      **Branch collision:** another session checked out `feat/landing-page` mid-task, so both
      original commits landed there (`23127b6`, `3de48d4`) stacked under four landing commits.
      Resolved by cutting a worktree at `cemurm-worktrees/blueprint-docs` and cherry-picking
      both onto `feat/blueprint-docs` as `95eb423` and `39c47a6`. `feat/landing-page` was left
      untouched — its history still carries the originals and is not ours to rewrite.
      `pnpm install --frozen-lockfile` in the fresh worktree (no dep delta vs `main`), then all
      five gates run there and green:
      `pnpm lint` exit 0 · `pnpm typecheck` exit 0 · `pnpm test` exit 0 — 9 files, **307
      tests** · `pnpm build` exit 0 — `dist/`, 914.57 kB JS + 32.17 kB CSS, the >500 kB chunk
      warning pre-existing on `main` · `bash scripts/check-visual-contract.sh` exit 0 — 10
      rules, 0 failing.
      Confirmed `npx eslint scripts/ --ext js,jsx` → "No files matching the pattern", so
      `build-docs-viewer.mjs` is outside lint's reach by config, not by an ignore rule.

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
- 2026-10-04 — **Branch collision resolved.** Another session switched the shared working
  tree to `feat/landing-page` mid-task, so `23127b6` and `3de48d4` landed there under four
  landing commits. Both were cherry-picked onto `feat/blueprint-docs` in a dedicated worktree
  (`cemurm-worktrees/blueprint-docs`) as `95eb423` / `39c47a6`. `feat/landing-page` was left
  untouched — its history still carries the originals, and rewriting it would destroy another
  session's in-flight work.
- 2026-10-04 — **All five gates green** in that worktree: lint, typecheck, test (9 files,
  307 tests), build, visual contract.

## Findings raised (not fixed here — they need their own authorization)

1. **`AGENTS.md` claims "implemented RLS is owner-scoped only." That is stale.** Migrations
   `0016`, `0018` and `0019` ship live org/branch-scoped policies. `docs/database-schema-v2.md`
   §3.1 is genuinely still a *design target* for the unimplemented rows, while its own header
   says `Status: IMPLEMENTED` — so the document contradicts itself and `AGENTS.md` overstates
   the correction. `docs/security.md` §7 records both rather than propagating either.
2. **Path drift.** `AGENTS.md` and `docs/local-dev.md` both cite `src/lib/supabase.js`; the
   real path is `src/data/supabase.js` (`src/lib/` holds only `storage.js`). Same class of
   drift in `README.md:14` (hosted Supabase URL), `CONTRIBUTING.md` (a `src/store/` Zustand
   layer that does not exist), `docs/local-dev.md:29` ("two confirmed users" — there are
   three), and the `0027` migration header.
3. **The handbook's light palette is invented, not tokenized.** `assets/tokens.css` defines a
   dark ramp only. The viewer ships a `[data-theme="light"]` block whose hex values
   (`#efedea`, `#f5f3f1`, `#fbfaf9`, `#e4e1dd`) were authored for this page and are not
   project tokens. Either promote them into `tokens.css` as a real light ramp, or drop the
   toggle. As shipped, the light mode is a proposal.
4. **`AGENTS.md` cites `odd/tasks/cemurm-brand-landing.md §12.1` for the characterization-test
   strategy — that file no longer exists.** ADR-006 rests instead on the delivery-agreement
   clause, `docs/master-plan.md`, and the live `// FINDING:` markers in the test files.
5. **The visual gate does not cover `docs/*.html`.** `scripts/check-visual-contract.sh` sets
   `SRC_DIR="src"`, so none of the nine generated HTML visualizations are scanned. The
   handbook self-enforces token discipline because the generator owns every colour literal,
   but a green gate does not cover them — do not cite it as if it did.
6. **`scripts/build-docs-viewer.mjs` is outside ESLint's reach.** The config matches `.js`/
   `.jsx` only (`npx eslint scripts/ --ext js,jsx` → "No files matching the pattern"). The
   generator ships unlinted by construction; consider a `scripts` override in the ESLint
   config if that matters.
7. **`VITE_SPOTIFY_CLIENT_SECRET` is public by construction.** Every `VITE_*` variable is
   inlined into the browser bundle. It is a mock-mode default and documented as such, but the
   name implies a secret it cannot be.
8. **Stale test counts.** `docs/master-plan.md` says 7 files / 235 tests; the tree has 9 files
   / 307 tests as of this run.
