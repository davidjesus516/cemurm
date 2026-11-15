# Visual Identity Orchestration — CEMURM Native

Branch: `feat/visual-identity` (from `origin/main` @ `9bf9f6e`; this document was written on
`docs/visual-identity-orchestration` and cherry-picked here as `309b6a6`)
Delivery: one work unit per PR, max 2 open PRs from this initiative. Merge is human.
Gates: `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm test:gherkin && bash scripts/check-visual-contract.sh`

## Specs

- **S1** — Establish a single, enforced visual contract. `skills/cemurm-visual-system/SKILL.md`
  is the operational authority and the `@theme` block of `src/app/index.css` is the only token
  source. No competing palette, no second token file. `check-visual-contract.sh` must stay green
  and must never be loosened.
- **S2** — One accent. `cem.amber` at full saturation on the logo mark, the primary CTA and the
  active/selected state only. Any change to the accent policy, the brand colours, the font or the
  mascot is a human approval gate.
- **S3** — Classify every surface by tier before styling it: 1 nav/settings/dialogs/forms/auth,
  2 lists/tables/editors, 3a Stage Mode on the musician's device, 3b overlay/OBS projector
  (chrome-free). Styling tier 3 as tier 1 is the defect the contract exists to prevent.
- **S4** — Token coverage is the actual gap, not component coverage. The `@theme` block declares
  43 colour tokens, 5 radii and 1 font family; it declares **zero** motion durations, easing
  curves, elevation/shadow steps, z-index layers or spacing steps. Those five families must exist
  as documented tokens before page migration begins, each value tagged as a project decision
  (Apple publishes no numeric scale).
- **S5** — `prefers-reduced-motion` honored everywhere. No animation library in the authenticated
  bundle. CSS-native motion first; `motion` stays confined to the landing chunk; `gsap` stays
  confined to `src/features/landing` and `src/features/design`.
- **S6** — Every migrated page ships its loading, empty, error, disabled and (where relevant)
  offline and insufficient-permission states, plus contextual skeletons rather than a generic
  placeholder.
- **S7** — No business behaviour change: auth, RLS, schema, API contracts, offline queue, service
  worker, domain logic, Stage Mode semantics and organisation/collaboration permissions are out of
  bounds. A functional defect found during a visual task becomes its own task, not a wider PR.
- **S8** — Visual evidence per migrated screen at 390 / 768 / 1024 / 1440 px, previous vs new, with
  states where applicable. No fabricated screenshots; disclose when only emulation was used.
- **S9** — Baseline is already green: the visual gate reports `12 rules checked, 0 failing`.
  No change may reduce that count or convert a PASS into a WARN.

## Tasks

| ID | Task | Specs | Scope | Status | PR |
|---|---|---|---|---|---|
| T0.1 | Repository audit | S1, S4 | read-only | DONE | — |
| T0.2 | Component inventory | S1 | read-only | DONE | — |
| T0.3 | Route/page inventory | S3 | read-only | DONE | — |
| T0.4 | This control document | — | docs | DONE | — |
| T1.1 | Docs reconciliation | S1, S4, S5 | SKILL.md + references + AGENTS.md stack drift | OPEN | #465 |
| T1.2 | Token foundation: motion, z-index (+ elevation/spacing deferred) | S4, S5 | `src/app/index.css` `@theme` | OPEN | #464 |
| T1.3 | Responsive + a11y rules as usable examples | S3, S6, S8 | SKILL.md reference | BLOCKED | — |
| T2.1 | Buttons, icon buttons, badges, toggles, interactive controls | S1, S2 | `src/components/ui` | PENDING | — |
| T2.2 | Form system: labels, fields, descriptions, errors, disabled/loading | S6 | `src/components/ui`, `src/components/form` | PENDING | — |
| T2.3 | Surfaces and overlays: card, dialog, dropdown, tooltip, sheet | S3 | `src/components/ui` | PENDING | — |
| T2.4 | Loading system: skeletons, spinners, page-level fallbacks | S6 | `src/components/ui` | PENDING | — |
| T2.5 | Feedback: Sonner mounting, confirmations, success/error states | S6 | `src/app/providers`, `src/components/ui/sonner.tsx` | PENDING | — |
| T3.1 | Responsive application shell | S3, S8 | `src/app/AppLayout.jsx`, `src/features/shell` | PENDING | — |
| T3.2 | Shell motion normalization (press/hover/focus) | S5 | `src/features/shell` | PENDING | — |
| T3.3 | Route-level loading instead of `Suspense fallback={null}` | S6 | `src/app/router.jsx` | PENDING | — |
| T4.1 | Home (`/`) | S3, S6, S8 | `src/features/shell/pages/Home.jsx` | PENDING | — |
| T4.2 | Repertoire list (`/songs`) | S3, S6, S8 | `src/features/repertoire` | PENDING | — |
| T4.3 | Song detail (`/songs/:id`) | S3, S6, S8 | `src/features/repertoire` | PENDING | — |
| T4.4 | Practice (`/songs/:id/practice`) | S3, S8 | `src/features/repertoire` | PENDING | — |
| T4.5 | Setlists + setlist detail | S3, S6, S8 | `src/features/setlists` | PENDING | — |
| T4.6 | Gigs + gig detail | S3, S6, S8 | `src/features/gigs` | PENDING | — |
| T4.7 | Rehearsals + detail | S3, S6, S8 | `src/features/rehearsals` | PENDING | — |
| T4.8 | Bandmates | S3, S6, S8 | `src/features/bandmates` | PENDING | — |
| T4.9 | Organizations | S3, S6, S8 | `src/features/orgs` | PENDING | — |
| T4.10 | Services + service detail + assignment | S3, S6, S8 | `src/features/services` | PENDING | — |
| T4.11 | Notifications | S3, S6, S8 | `src/features/notifications` | PENDING | — |
| T4.12 | Settings + storage | S3, S6, S8 | `src/features/settings` | PENDING | — |
| T4.13 | Profile, public library, moderation, feedback triage | S3, S6, S8 | `src/features/library`, `moderation`, `feedback-triage` | PENDING | — |
| T4.14 | Auth, guardian confirm, not-found | S3, S6, S8 | `src/features/auth`, `src/features/shell` | PENDING | — |
| T4.15 | Landing (`/landing`) | S3, S5, S8 | `src/features/landing` | BLOCKED | — |
| T4.16 | Admin dashboard subtree (`/dashboard/*`) | S1, S2, S3 | `src/routes`, `src/layouts`, `src/views` | BLOCKED | — |
| T5.1 | Stage Mode (tier 3a) | S3, S5, S7 | `src/features/stage/pages/StageMode.jsx` | PENDING | — |
| T5.2 | Overlay + external display + projection (tier 3b) | S3, S7 | `src/features/stage`, `src/features/projection` | PENDING | — |
| T5.3 | Performance review: bundle, effects, low-end Android | S5 | whole app | PENDING | — |
| T6.1 | Consistency audit against the contract | S1, S9 | whole app | PENDING | — |
| T6.2 | Dependency audit | — | `package.json` | PENDING | — |
| T6.3 | Documentation and examples agree with implementation | S1 | SKILL.md, docs | PENDING | — |
| T6.4 | Acceptance report | — | this file | PENDING | — |

`T4.15` is blocked on the `/` vs `/landing` wiring decision recorded in `src/app/router.jsx:196-210`.
`T4.16` is blocked on the scope decision in "Pending decisions" below.

## Audit findings

### Stack — the prompt's inventory is accurate; `AGENTS.md` is not

Verified against `package.json` and `node_modules`, not against prose:

| Package | Installed | Prompt §1.3 target |
|---|---|---|
| react / react-dom | 19.3.1 | React 19 ✅ |
| typescript | 6.0.3 (pinned, no caret) | TS 6 ✅ |
| vite / vitest | 8.3.5 / 5.0.5 | Vite 8 ✅ |
| tailwindcss | 4.3.3 (`@tailwindcss/vite`, `tw-animate-css`) | TW 4 ✅ |
| @base-ui/react | 1.9.0 | Base UI ✅ |
| cva / clsx / tailwind-merge | 0.7.1 / 2.1.1 / 3.7.0 | ✅ |
| motion / gsap | 14.1.0 / 3.15.0 | ✅ |
| lucide-react / @hugeicons/react / @iconify/react | 1.59.0 / 1.1.10 / 6.0.2 | ✅ |
| sonner / zod | 2.0.8 / 4.6.7 | ✅ |
| react-aria-components / swr / @tanstack/react-table | 1.7.0 / 2.5.1 / 8.21.3 | ✅ |
| react-router-dom / @supabase/supabase-js | 7.18.3 / 2.116.0 | ✅ |

**All twenty libraries named in the prompt are installed at the target major.** Dependency
migration is therefore not part of this initiative. See the dependency verdict below.

`AGENTS.md` contradicts this on three points and must be corrected in T1.1 because it is the file
every agent reads first:
1. It states React 18 and Vite 6.4.3 / Vitest 5.0.2; installed are React 19.3.1 and Vite 8.3.5 /
   Vitest 5.0.5.
2. It states "JSX, not TSX … the codebase is plain JS". Measured: 153 `.tsx`, 116 `.jsx`,
   131 `.js`, 16 `.ts` under `src/`. The TS surface is larger than the JS one.
3. It describes the migration count of the branch it was written on; it is branch-relative and
   drifts on every checkout. Not a visual concern, but it is the same failure mode.

### Component inventory

- `src/components/ui/` — **55 primitives**, shadcn-shaped but built on **Base UI**; `radix` appears
  zero times in `package.json`. Already consuming `cem-*` tokens (`button.tsx` uses
  `bg-cem-amber`, `focus-visible:ring-cem-secondary/50`). **188 imports** of `@/components/ui/*`
  from features, views and layouts — adopted, not dormant.
- `src/components/` — 113 files across `ui`, `icons`, `tables`, `form`, `dashboards`, `apps`,
  `animated-components`, `shared`, `user-profile`. The non-`ui` folders are template cargo:
  candidates for T6.2, not for promotion.
- `src/ui/patterns/` — **two files only** (`ChordProRenderer.jsx`, `PdfChartViewer.jsx`). The
  directory name promises a pattern library it does not contain. Do not mistake it for the
  official component layer; that is `src/components/ui`.
- `src/features/design/` — a design laboratory (dock, jellyRadio, morphSlider, swipeRow,
  textAnimations, …). Experimental by definition. Per the contract it may not be promoted because
  a demo looks good.
- Classification to carry into T2: **official** = `src/components/ui/*`; **experimental** =
  `src/features/design/*`; **legacy/cargo** = the template `apps`/`dashboards`/`animated-components`
  folders pending T6.2 evidence.

### Token reality — the real gap

`src/app/index.css` is 2401 lines with `@theme` at line 92, `@theme inline` at 220 and a second
`@theme inline` at 595. Declared: 17 `cem.*` colours + 5 `cem.stage.*` + destructive/chart-1..5/
success/warning/error, 5 radii (`--radius-cem-xs..xl`), `--font-sans`, 2 keyframe names.

Absent, and required by S4 before page migration: motion durations, easing curves,
elevation/shadow steps, z-index layers, spacing steps.

### Visual gate baseline

`bash scripts/check-visual-contract.sh` → `visual contract: OK (12 rules checked, 0 failing)`.

Report-only findings that must not be read as new debt:
- **05b**: 12 token pairs under 4.5:1. Worst offenders `cem.secondary` on `elevated` (4.04) and on
  `hover` (2.96), `cem.amber` on `hover` (3.53), `cem.rose` on `hover` (2.06). Already recorded in
  `odd/tasks/visual-system-macos.md` §13 as measured, pre-existing, and deprioritised for accents.
- **r1**: `StageMode.jsx` carries 41 `rounded*` and 4 `shadow*` lines, deliberately out of rule 03
  scope — tier 3a allows depth.
- **r2**: 43 distinct colour tokens, including duplicates between the light and dark ramps.

### Motion — the prompt's premise is outdated

Prompt §3.5 orders an inspection of "the existing GSAP use in the navigation shell". Measured:
**zero** `gsap` and **zero** `motion` imports in `src/app/`, `src/features/shell/` or
`src/layouts/`. Both libraries appear only in `src/features/landing/` (public marketing, lazy chunk)
and `src/features/design/` (the lab). `src/app/router.jsx:11-20` documents that this split was done
on purpose so `motion` never rides into an authenticated session, satisfying hard rule 5.

**There is no conflict to resolve in T3.2.** The task reduces to normalising press, hover and focus
feedback with CSS transitions. Recorded so nobody "fixes" a conflict that was already fixed.

### Route inventory — 32 entries, three shells

`src/app/router.jsx` defines three chrome contexts, and they must not be unified:

1. **Admin subtree** `/dashboard/*` — outside `AppLayout`, gated by `RequireAuth` +
   `RequireGuardianConsent` + `RequireOrgOwner`, with its own `FullLayout` chrome and its own
   `AdminThemeBoundary` theme system (`@custom-variant style-lyra`). 21 layouts, 21 views.
2. **App shell** `AppLayout` — 25 routes behind `RequireAuth` + `RequireGuardianConsent`, plus
   `/auth`, `/guardian/confirm`, `/projection/display` and the `*` catch-all.
3. **Chrome-free** — `/external-display`, `/overlay/:token`, `/landing`, all outside `AppLayout`
   and outside both auth guards.

Tier assignment used for planning:

| Tier | Routes |
|---|---|
| 1 | `/`, `/settings`, `/settings/storage`, `/notifications`, `/auth`, `/guardian/confirm`, `/feedback-triage`, `/projection/display` (operator control window, keeps nav by design), `*` |
| 2 | `/songs`, `/songs/:id`, `/setlists`, `/setlists/:id`, `/gigs`, `/gigs/:id`, `/rehearsals`, `/rehearsals/:id`, `/bandmates`, `/organizations`, `/services`, `/services/:id`, `/assignment/:serviceId`, `/library`, `/profile/:userId`, `/moderation` |
| 3a | `/setlists/:id/stage`, `/songs/:id/practice` |
| 3b | `/overlay/:token`, `/external-display`, `/services/:id/projection` |
| own | `/landing` (public marketing, GSAP/motion budget of its own), `/dashboard/*` (own theme boundary) |

`Suspense fallback` is `null` for every lazy route (`router.jsx:40`). That is the concrete work of
T3.3 and the most visible loading gap in the app.

### Documentation state

`docs/design-system.md` already carries a correct supersession banner (2026-09-28) and a table
mapping each dead section to its replacement. It is **not** dead weight: `README.md`,
`docs/ux-spec.md` and `docs/wireframes.md` cite it 14 times, and it is the only record of brand
voice and mascot. Treat it as partially live, never delete it.

Prior visual work that must be read before T1.2, not duplicated: `odd/tasks/visual-system-macos.md`,
`visual-gate-ratchet-step-1.md`, `gerencial-dashboard-fase4-visual.md`, `design-accordion-gallery.md`,
`design-gate-01a-spotlight-borderglow.md`, `design-ports-delivery.md`.

## Dependency verdict

Question asked: are dependency updates necessary, and are they justifiable as part of this work?

**No, on both counts.** Evidence:

- Every one of the twenty libraries the prompt names is already installed at the target major
  (table above). The premise "the repo is behind the visual redesign's stack" is false.
- `pnpm outdated` reports **patch-level drift only** and no major behind:
  `@iconify/react` 6.0.2→6.0.4, `@tailwindcss/vite` 4.3.3→4.3.5, `tailwindcss` 4.3.3→4.3.5,
  `gsap` 3.15.0→3.15.1, `react-router-dom` 7.18.3→7.18.5, `vite` 8.3.5→8.3.8,
  `@hugeicons/core-free-icons` 4.3.5→4.4.0, `@playwright/test` 1.64.0→1.65.0,
  `@supabase/supabase-js` 2.116.0→2.119.0, the nine `@tiptap/*` 3.32.0→3.33.1.
- None of those patches touches a token, a component or a layout. Bumping them inside a visual PR
  would add lockfile churn to review for zero design gain, which §1.3 forbids.
- The gap this initiative has to close is **tokens and page migration**, not packages.

Standing rule: no dependency is added or upgraded inside a visual work unit. A patch bump, if ever
wanted, is its own PR and its own revert. T6.2 is the only place a dependency is examined, and it
may only *remove*, after use is disproven.

## Pending decisions

- **D1 — admin dashboard scope (`/dashboard/*`, T4.16).** It is a second visual system: own
  `FullLayout`, own `style-lyra` variant, own theme boundary, 42 files, reachable only by an active
  `org_owner`. Options: (a) exclude it from this initiative and keep it on its own contract —
  cheapest, leaves two visual languages in the product; (b) migrate it into `cem.*` tokens and drop
  the separate variant — coherent, but it is 42 files and it rewrites a layout family that a
  different PR series owns; (c) migrate only its token layer, keeping `style-lyra` structure — a
  middle path with an ambiguous result. Recommendation: **(a) now**, revisit after T4.14, because
  the token foundation from T1.2 has to exist first for (b) to be reviewable at all.
- **D2 — `/` vs `/landing`.** `router.jsx:196-210` leaves the wiring open on purpose; option A
  changes signed-in navigation, which is an approval gate (S3, gate 6). Not needed before T4.1.
- **D3 — PR sequencing against eleven open PRs.** The repository currently carries eleven open PRs
  (`#451`–`#465`), four of them touching `src/features/setlists` or `src/features/stage`. Page
  migration in those folders would collide. Order must follow whatever merges first. Two of the
  eleven are this initiative's own (`#464`, `#465`), which is why T1.3 cannot open a PR yet: the
  agreed ceiling is two.

## Log

- **L1** — User request, verbatim: `lee esto /home/antony/Documentos/promt.md`
- **L2** — User request, verbatim: `si es necesario, que no creo, actualizamos dependencias, pero
  primero veamos si es necesario y es justificable`
- **L3** (2026-11-13) — Phase 0 executed read-only from `origin/main` @ `9bf9f6e`. Branch
  `docs/visual-identity-orchestration` created for this control document; the working branch
  `feat/acl-setlist-collaborator-read` (PR #460, 2 commits ahead, 4 behind) was left untouched.
  Dependency verdict recorded: no updates. Audit findings above are all measured, not inferred;
  the only claim carried forward as an assumption is the tier assignment, which is a planning
  classification and is revisited per page in its own task.
- **L4** (2026-11-13) — Next task: **T1.1**, documentation reconciliation, because `AGENTS.md`
  currently misstates the stack that every later task depends on.
- **L5** (2026-11-14) — User review, verbatim: `Revisé las dos entregas (#464 y #465). La dirección
  me parece correcta y quiero mantener la secuencia que propones.` Plus one correction, verbatim:
  `En #465 todavía aparece React 18 en la descripción inicial del proyecto, pero package.json
  declara React 19.3.1. Corrige esa información y revisa si queda alguna referencia equivalente
  desactualizada. Mantén el alcance del PR y vuelve a ejecutar las comprobaciones.` And the T1.3
  brief, verbatim: `T1.3 debe contemplar móvil, tablet y escritorio, navegación, áreas táctiles,
  teclado, foco, contraste, lectores de pantalla, reduced motion y safe areas.` with the explicit
  limit `No quiero que esta tarea se convierta todavía en una migración masiva de páginas. Primero
  necesitamos establecer el contrato, demostrarlo con ejemplos y dejar criterios verificables para
  las siguientes fases.`
- **L6** (2026-11-14) — T1.1 corrected on `docs/agent-guide-stack-truth`: commit `4c5b2bc` fixed
  the three claims the first commit left, and `origin/main` was merged (`dbdec1b`) to clear
  `BEHIND`. **Correction of record:** the first commit claimed the Vite/Vitest paragraph was the
  whole drift; it was not. The opening line still read `React 18 + Vite + Tailwind`, and the test
  paragraph still said Vitest was the only test dependency with no config file. Both were fixed in
  the same PR, not deferred. Checks re-run green in that worktree: `check-doc-counts.sh`,
  `check-test-integrity.sh`, `check-visual-contract.sh` (12 rules, 0 failing),
  `pre-tool-guard.selftest.mjs`, `check-migrations-destructive.mjs`. `lint`/`typecheck`/`test`/
  `build` were not run there — the worktree carries no `node_modules` and the diff is one Markdown
  file none of those four gates reads.
- **L7** (2026-11-14) — **Finding outside every task in this table:** `vitest.config.js:6` is
  `include: ['src/**/*.test.js']`, and `main` carries five `.test.jsx` files under
  `src/features/design/` that the pattern cannot match, so they never execute — while
  `check-test-integrity.sh` counts them (`test files scanned: 36` against the 31 that run). The
  pattern is unchanged since `41320d6` created the file. Reported on #465; not fixed there, because
  widening the include and deleting dead tests are different decisions. Needs its own PR.
- **L8** (2026-11-14) — **T1.3 is BLOCKED on two gates, both external.** (1) The two open PRs
  `#464`/`#465` must integrate first; a third PR would break the agreed ceiling. (2) T1.3's motion
  section must cite the `--cem-duration-*` / `--cem-ease-*` / `--cem-z-*` tokens, and those exist
  only on `#464`'s branch — writing the contract against `feat/visual-identity`, which does not
  carry them, would document tokens that are not in the tree and require a rewrite the moment #464
  lands. Starting T1.3 before #464 merges buys a false start, not progress.
