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
| **T2** | S1 | `export-and-sharing` — sharing options + integrated targets | inline | `aa0df92` (deep link, summary, WhatsApp/Telegram/email); token links in `0047` — QR, embed, proximity, PNG still open, see L11/L12 |
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
- **L11** (2026-11-18, orchestrator): **T2 rebuilt after the L6 discard**, same approach as T1 —
  the deterministic half inline, no writer. `src/domain/setlist/share.js` is pure string
  assembly: `setlistDeepLink` (origin trimmed, id encoded), `setlistShareSummary` (name, song
  count and duration, ordered titles, link — deliberately **no** keys, chords or notes, so the
  same text can go to a channel the audience reads), and `shareTarget`/`shareTargets` for
  WhatsApp (`wa.me/?text=`), Telegram (`t.me/share/url?url=&text=`) and email (`mailto:` with
  subject and body). `src/features/setlists/components/ShareSetlistMenu.jsx` is the tier-2 panel
  on `SetlistDetail` — Copy link plus the three channels, borrowing the Collaboration card's
  surface rather than adding a dialog. 9 new assertions in `share.test.js`.
  **Known gaps, deliberate.** No share token, so no 7-day expiry and no view-only link: the
  schema has no token table, and a link only opens what RLS already allows (owner or accepted
  collaborator) — the panel says exactly that instead of promising access. QR, embed and
  proximity codes need that same table (proximity also needs an offline-verifiable one-time
  token), and the chord-chart PNG needs a canvas renderer this build does not have. The email
  target sends the summary but **no PDF attachment** — there is no PDF writer (L8). So of the
  ten T2 scenarios, the link-copy and the three chat/email payloads are implemented; the
  view-only link, QR, embed, proximity code and PNG are not, and no test pins them.
  **Verification**, all on this branch: `pnpm test` 527 passed, `pnpm test:gherkin` 44 passed,
  `pnpm typecheck` clean, `pnpm lint` clean, `pnpm build` OK (same >500 kB chunk warning as
  `main`), `bash scripts/check-visual-contract.sh` 12 rules / 0 failing,
  `bash scripts/check-test-integrity.sh` OK, `bash scripts/check-doc-counts.sh` OK (44
  migrations, 22 smokes, 48 features, 776 scenarios, `0047` free). Diff: 373 changed lines
  across 4 files, inside the 400 budget — no size exception. No migration, so the `0047`
  question is untouched. Not verified: the browser half (clipboard write, share-sheet opening)
  needs a browser this run does not have; the panel was type-checked and linted, not clicked.
  No OpenSpec capability spec was written — `openspec/specs/` still has no
  `export-and-sharing` capability, a pre-existing gap T1 also left open.
- **L12** (2026-11-18, orchestrator): **the token half of T2** — `0047_setlist_share_links.sql`
  plus its smoke, repository, redeem route and the owner block in the share panel. The design is
  in the migration header and matters more than the file list:
  **the link grants a collaborator row, it does not bypass RLS.** Redeeming inserts (or upgrades)
  a `setlist_collaborators` row with `accepted_at = now()` and `can_edit = (permission = 'edit')`,
  so a view-only link is read-only through the same gate the owner's permission picker already
  uses, and every existing setlist/item/comment policy keeps working untouched. Creation is
  **RPC-only with no INSERT policy**, so a client cannot mint a link whose `expires_at` it chose;
  the definer function stamps `now() + 7 days`. Tokens are `uuid` (122 bits), the same
  capability shape `0032` uses, unique-indexed; only the owner can read or delete link rows, so a
  non-owner cannot enumerate tokens. Expired, revoked and unknown links share **one** message so
  a dead link is indistinguishable from a guessed one, and redeeming is idempotent and never
  downgrades an editor who opens a view-only link.
  **Layout.** `src/domain/setlist/shareLinks.js` (pure: URL, state, days left, 7-day constant) +
  9 assertions; `src/data/repositories/setlistShares.js`; `/share/setlists/:token` →
  `AcceptSetlistShare.jsx`, **inside RequireAuth** because a grant needs a user to attach to;
  panel: permission picker, Create link (copies to clipboard), list with expiry state, Copy and
  Revoke. `AGENTS.md` and `docs/master-plan.md` counts moved to 45 migrations / 23 smokes /
  next free `0048`, and the stale header in `share.js` that claimed no token table existed was
  corrected in the same change.
  **NOT VERIFIED — and this is the important line: `0047` and its smoke were never executed.**
  The runner has no Docker access (`permission denied` on `/var/run/docker.sock`), so
  `supabase start` / `supabase db reset` cannot run here. The migration is written against the
  real schema and passes `check-migrations-unique.sh` and `check-migrations-destructive.mjs`,
  but **no SQL in it has been parsed by Postgres**, and the smoke's `expects 21 PASS / 0 FAIL`
  is the expectation, not a result. Treat the DB half as unproven until someone runs:
  `supabase db reset`, then the `docker exec … -f - < scripts/smoke/0047-setlist-share-links.sql`
  invocation at the top of that file.
  **Also open:** a signed-out visitor who opens a share link is bounced to `/auth` and the token
  is lost (the route sits inside RequireAuth); carrying it through login needs a redirect-back
  that this slice does not implement. QR, embed, proximity codes and the chord-chart PNG remain
  unimplemented, as L8/L11 recorded.
  **Verification actually run**: `pnpm test` 537 passed (33 files), `pnpm test:gherkin` 44,
  `pnpm typecheck` clean, `pnpm lint` clean, `pnpm build` OK, `check-visual-contract.sh` 12/0,
  `check-test-integrity.sh` OK, `check-migrations-unique.sh` 45 unique,
  `check-migrations-destructive.mjs` OK, `check-doc-counts.sh` OK. The visual gate initially
  failed at 243/240 dead accents because the new panel used `cem-rose`; the fix was to use the
  sanctioned tokens, **not** to raise the ceiling.
