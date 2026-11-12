# Hito 6 N3 — product slice: export-and-sharing, user-onboarding, analytics-and-insights

- **Change:** Hito 6 N3 (product slice). The two privacy obligations of N2 are on `main`; this
  unit ships the three remaining product features.
- **Branch:** `feat/hito6-n3-product-slice` (from `main` = `e774ad9`). One branch per feature,
  stacked; each targets `main` and merges in order.
- **Delivery:** `ask-on-risk`, resolved → **`stacked-to-main`**. Forecast ≈ 3000+ authored lines
  across three features → chained PRs required (each ≤ 400 lines). Each feature branches from
  the previous and targets `main`, merged in order.
- **TDD:** off (`openspec/config.yaml:13`, `strict_tdd: false`). These three features are
  predominantly UI and aggregation behaviour; honest verification is the gate run
  (`pnpm test && pnpm typecheck && pnpm lint && pnpm build`) plus the Gherkin scenarios the
  feature files already encode. Where a behaviour is deterministic and isolated (export bundle
  assembly, onboarding progress math), tests are written first.
- **RDD:** on (global). Native review must NOT be started on this runtime (OpenCode V2 — the
  Review Execution Contract forbids it). Substitute in place of a receipt: the writer's raw
  gate output plus a parent re-run of the same command. A substitute, not a receipt.

## Specs

Three feature files, quoted verbatim as the product source of truth. Nothing below adds a
requirement that is not in them.

- **S1** — `features/export-and-sharing.feature` (23 scenarios). Setlist export formats
  (PDF, ChordPro, MusicXML, ABC, plain text, custom branding), sharing options (link with
  view-and-edit / view-only, song links, QR for audience, embed, proximity code), integrated
  sharing targets (WhatsApp, Telegram, email, chord-chart image), audience view (deep link,
  push notification, offline), export management (history, regenerate, delete, batch ZIP).
- **S2** — `features/user-onboarding.feature` (16 scenarios). First-time welcome flow
  (3-slide walkthrough, account creation, skip, returning user), organization setup (create org,
  invite code `ACAD-MAD-001`, join via code, add branches, choose instrument), tutorial hints
  (setlists tooltip, 4-step dashboard tour, help button re-opens, feature-update tooltip),
  onboarding completion (progress 100%, unlocks next steps, incomplete flagged).
- **S3** — `features/analytics-and-insights.feature` (23 scenarios). Personal performance
  analytics (most-used songs, repertoire growth, practice hours, untouched songs), performance
  history (mark gig, timeline, song popularity, duration trends), org analytics (member activity,
  repertoire by branch, event participation, low-activity warning), repertoire insights (genre
  distribution, key distribution, trending, instrument coverage, recent additions), export/share
  analytics (formats, most-exported setlists, audience scans), offline/engagement metrics
  (offline usage, daily heatmap, session duration).

## Tasks

| ID | Linked S# | Feature | Route | Commit |
|---|---|---|---|---|
| **T1** | S1 | `export-and-sharing` — export formats | inline | `a8966ac` (serializers) + this slice (format menu) |
| **T2** | S1 | `export-and-sharing` — sharing options + integrated targets | — | reopened — draft discarded, see L6 |
| **T3** | S1 | `export-and-sharing` — audience view + export management | — | — |
| **T4** | S2 | `user-onboarding` — welcome flow + org setup | — | — |
| **T5** | S2 | `user-onboarding` — tutorial hints + completion | — | — |
| **T6** | S3 | `analytics-and-insights` — personal + performance history | — | — |
| **T7** | S3 | `analytics-and-insights` — org + repertoire insights | — | — |
| **T8** | S3 | `analytics-and-insights` — export/share + engagement metrics | — | — |

Each task is a work unit of ≤400 authored lines, branched from the previous feature branch and
merged to `main` in order. `cross-organization-event-collaboration` (N4) is deliberately **not**
in this unit — it depends on four surfaces being stable and ships separately.

## Log

- **L1** (2026-11-06, user, verbatim): "podemos empezar el hito 6?"
- **L2** (2026-11-06, user): "oprision c, sync primero y resolver commits pendientes a su
  propio workspace para no entremezclar mucho el trabajo" — option C: three features of N3 in
  parallel as independent work units (stacked branches, ≤400 lines each, chained merges), leaving
  `cross-org` for a separate round.
- **L3** (2026-11-06, orchestrator): verified Hito 6 state against `main` = `8b9de12` before
  sync. Found `offboarding-cascade` and `account-data-export-and-erasure` already on `main`
  (N2 closed); the four remaining features have only their `.feature` files. Cleaned the
  `docs/uml-uc04-build-fix` workspace (committed plantuml-1.2026.9 regeneration + `__pycache__`
  gitignore entry on branch `pr-440-2`), fast-forwarded `main` to `origin/main` = `e774ad9`,
  and opened `feat/hito6-n3-product-slice` from there with a clean tree.
- **L4** (2026-11-06, orchestrator): read all three feature files plus the existing export
  bundle (`src/domain/account/exportBundle.js`, `exportZip.js`, `exportZip.test.js`,
  `src/data/repositories/accountExport.js`, `src/features/settings/components/ExportDataCard.jsx`,
  `Settings.jsx`). The export surface already ships a JSON+Markdown ZIP; `export-and-sharing`
  extends it with the printable/interoperable formats and the share channels, and reuses the
  `Settings.jsx` card placement.
- **L5** (2026-11-08, orchestrator): the three commits of the first pass were sitting on
  `main` local, not on `feat/hito6-n3-product-slice`, and `main` was 19 commits behind
  `origin/main`. Moved them onto the branch, rebased onto `01e0235`, reset `main` to
  `origin/main`. A Jest/jsdom/testing-library detour (`.babelrc`, `jest.config.cjs`,
  `simple-test.js`, `test-component.js`, `tests/unit/`, `ExportDataCard.test.jsx`, `.todo`,
  `@babel/*` in package.json + 1307 lock lines) was moved out to
  `/tmp/opencode/cemurm-debris-20261108/` and the dependency files reverted — the repo is
  Vitest/node only, no jsdom, no testing-library.
- **L6** (2026-11-08, orchestrator): reviewed the first pass before shipping it. It was not
  usable: `SetlistSelector.jsx` declared the same component twice (ESLint parse error) over
  hardcoded mock setlists; `exportSetlist.js` had an undefined `name`, an unused import and
  Spanish notes in the source; `0047_export_setlist.sql` assigned `envelope` but returned
  `result` (NULL), called a non-existent `build_setlist_summary`, and read
  `setlists.description`, a column the schema does not have; `ExportDataCard.jsx` had been
  overwritten, removing the shipped account-export card. Gates: lint 10 errors, 3 test
  failures. Full draft preserved on branch `backup/hito6-n3-generated-t1t2` (`6c791d8`);
  the branch was reset to the task-spec commit and T1/T2 rebuilt from the real model.
- **L7** (2026-11-08, orchestrator): T1 rebuilt inline (no writer: one coherent unit, the
  design depended on facts discovered while reading). Key finding that changed the design:
  the repo already ships an OnSong/ChordPro exporter (`src/domain/setlist/exporters/onsong.js`,
  wired into `SetlistDetail`), so the new formats are siblings in that folder instead of a
  parallel `src/domain/account/setlistExport.js`. No RPC and no migration: the export reads
  the existing repositories (`getSetlist` + `listSongs`) under RLS, which also makes it work
  offline. Two latent bugs fixed on the way: no setlist read ever selected
  `setlist_items.agreed_key`, so `flattenSetlist`'s `agreedKeys` map was always empty and the
  OnSong export ignored agreed keys; and `setlist_items.notes` was never exposed (`itemNotes`
  now is, and the plain-text outline prints it).
- **L8** (2026-11-08, orchestrator): **known gaps, deliberate.** PDF and MusicXML are
  unimplemented and the export menu does not offer them: their charts are storage objects
  (`chart_files.object_key`, `content` NULL) and there is no PDF writer in this build, so a
  file for either format would be a placeholder with a real extension. `pdf` and `musicxml`
  throw a message naming the format. Also unimplemented in T1: custom org branding, the
  A5 print layout, and the `setlist-name.musicxml` single-file container (MusicXML has no
  multi-piece document format; MXL is a zip).
- **L9** (2026-11-08, orchestrator): verification for T1, run on the single-branch version
  before it was sliced (the same content, same tree): `pnpm lint` clean, `pnpm typecheck`
  clean, `pnpm test` 511 passed, `pnpm test:gherkin` 44 passed, `pnpm build` OK,
  `bash scripts/check-visual-contract.sh` OK (12 rules, 0 failing),
  `bash scripts/check-doc-counts.sh` OK. The combined diff measured 774 authored lines, over
  the 400 budget, so T1 ships as two stacked slices: the serializers, then the dispatcher and
  the page menu. Each slice re-runs lint/typecheck and the exporter tests; the full gate set
  was verified again on the second slice before opening its PR.
- **L10** (2026-11-10, orchestrator): review of T1a (#450) left one blocker and three fixes,
  applied in `217f1ed` and `71cf7f9`: `chordpro.test.js` pins the separator (single song → no
  `{new_song}`), the orphaned JSDoc above `onsongFileName` is gone, titles and notes escape
  `\` then `|` (CodeQL `js/incomplete-sanitization`), and `slugify` stays exported because
  `setlistFile.js` in T1b consumes it — the review corrected its own point 3 on that.
  **Size exception:** the slice now measures 470 authored lines against `main`'s merge base
  (386 before the review fixes), so it carries the `size:exception` label. The overage is the
  coverage the review demanded, not content that could be dropped.
  `pr-size.yml` reported 639 because it diffs the merge base against the merge-ref `HEAD`,
  which pulls in `main` commits that landed after the branch point; the workflow's own base
  choice is the defect, and the PR body says so.
