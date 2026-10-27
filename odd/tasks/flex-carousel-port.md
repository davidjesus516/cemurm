# Feature: FlexCarousel — replace the /design placeholder with the real reactbits port

**Status:** implemented — T1–T5 done; 3 of 5 gates green, the 2 failures are pre-existing and
outside this unit's files (see Progress / Evidence)
**Branch:** `landing-page` (working tree; `src/features/design/` is untracked on this branch)
**Delivery strategy:** `ask-on-risk` — forecast ~450–550 authored lines (the ported component
alone is ~1400 lines before type stripping), over the 400-line slice budget. No PR is opened
from this unit yet: the whole `/design` surface is still uncommitted work on `landing-page`.
**Route:** delegated direct (writer trigger: 2+ non-trivial files; source read belongs to the
writer, see Route declaration per task).

## Objective

`/design` ships a `FlexCarousel` that is not the component it claims to be. Replace it with the
actual reactbits source so the review surface shows the real thing, and record the port in the
`DESIGN.md` fidelity ledger.

## Problem / Why

- `src/features/design/components/blocks.jsx` exports a `FlexCarousel` that renders five
  expanding text tiles. Upstream (`reactbits.dev/components/flex-carousel`) is an infinite
  **image** row rendered through a WebGL2 lens with four bend presets, five entrances, a speed
  squeeze and click-to-focus — `ogl` is already a declared dependency and was unused.
- `DESIGN.md` §12 already lists `FlexCarousel` under **Aproximación — pendiente de
  reescritura**, so the placeholder was known debt, not a decision.
- The maintainer pasted the upstream source verbatim (`src/ts-tailwind/Components/
  FlexCarousel/FlexCarousel.tsx`, 1411 lines, byte-identical) and authorised the replacement.

## Scope / Authorized edit surfaces

- `src/features/design/components/flexCarousel.jsx` (new)
- `src/features/design/components/blocks.jsx`
- `src/features/design/components/index.js`
- `src/features/design/pages/DesignSystem.jsx`
- `DESIGN.md`

Nothing else. No new dependency (`ogl@1.0.11` is already installed), no migration, no product
surface outside `/design`.

## Constraints

1. **JSX, not TSX** (`AGENTS.md`): the port strips every type annotation, interface, `import
   type` and generic. ESLint only lints `--ext js,jsx`.
2. **Rule 01A is `enforcing`**: the upstream focus ring
   `focus-visible:shadow-[inset_0_0_0_2px_rgba(128,128,140,0.55)]` is a raw colour literal and
   fails CI. It moves to the repo's focus convention (`ring-2 ring-inset ring-cem-amber`).
   Same class of deviation the ledger already records for HoldButton.
3. **Rosters stay at 35/36**: `components.test.jsx` and `DesignSystem.test.jsx` assert explicit
   name lists, so the component keeps the name `FlexCarousel` and keeps its `<Demo>` block.
4. **Tier 1 surface** (`/design`): full macOS language; the gate is `pnpm check:visual`.
5. Demo needs an explicitly sized container — the component is `h-full w-full` and collapses to
   nothing without one.

## Checklist

- [x] T1 — Port upstream `FlexCarousel.tsx` to `flexCarousel.jsx` (plain JSX, token-safe focus
       ring, `'use client'` dropped, prop-types lint disabled as the sibling files do).
       **Deviation from plan:** the TS→JS strip was NOT done by hand or by transpiling. Both
       `tsc --jsx preserve` and `esbuild.transform` reprint the AST, so they collapse the
       multiline JSX and (esbuild) switch every string to double quotes — a formatting rewrite
       of a 1300-line file. Upstream publishes a plain-JS Tailwind variant
       (`src/tailwind/Components/FlexCarousel/FlexCarousel.jsx`, 1289 lines), which was verified
       token-for-token against the TS-TW source the maintainer pasted: identical except for
       arrow-function parenthesisation. That variant is the port source, so formatting is
       upstream's own.
- [x] T2 — Placeholder removed from `blocks.jsx` (section 21; the 22–27 section comments were
       renumbered 21–26 so the sequence stays contiguous); `index.js` now does
       `export { default as FlexCarousel } from './flexCarousel.jsx'`.
- [x] T3 — Demo rewired: `h-[460px] w-full` container, note rewritten to describe the WebGL
       behaviour and to warn that the default images come from Unsplash.
- [x] T4 — `DESIGN.md`: `FlexCarousel` removed from the *Aproximación / pendiente de
       reescritura* row; new **Fiel con desviaciones** row added to the deviations table. The
       component-count tables were already correct and were not touched.
- [x] T5 — Verify: `pnpm lint && pnpm test && pnpm typecheck && pnpm build && pnpm check:visual`.

## Route declaration

| Task | Route | Trigger evidence |
|---|---|---|
| T1–T4 | **inline (degraded)** | writer trigger fired (4 files), but both subagent launches failed: `getaddrinfo ENOTFOUND opencode.ai`, then an abort. No delegation mechanism available, so the work ran inline with the failure disclosed to the maintainer. |
| T5 | inline (degraded) | same; commands run in the parent with output bounded to tails |

## Test-first note

No RED is available for T1: the existing roster/smoke tests already pass against the
placeholder, and the change is a faithful port of an external source rather than new
behaviour derived from an expectation. The deterministic checks that *can* run —
`components.test.jsx` (mounts all 35), `DesignSystem.test.jsx` (renders every `<Demo>` exactly
once), lint, typecheck, build and the visual gate — are the acceptance evidence, and they run
before the unit is reported.

## Acceptance criteria

- `/design` renders the WebGL carousel with the upstream prop surface intact.
- `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm check:visual` all green.
- `DESIGN.md` no longer lists `FlexCarousel` as *pendiente de reescritura*.

## Progress / Evidence

- 2026-10-06 — upstream TS-TW source confirmed identical to the maintainer's paste
  (`raw.githubusercontent.com/DavidHDev/react-bits/main/src/ts-tailwind/Components/
  FlexCarousel/FlexCarousel.tsx`, 1411 lines); `node -e "import('ogl')"` resolves, so the port
  cannot fail on a missing runtime in the vitest node environment.
- 2026-10-06 — **T5 result: 3 of 5 gates green; the 2 failures are pre-existing and are not in
  this unit's files.**

| Command | Observed result |
|---|---|
| `pnpm test` | 14 files, 355 tests, 0 failed — includes `components.test.jsx` (mounts all 35) and `DesignSystem.test.jsx` (every `<Demo>` exactly once) |
| `pnpm typecheck` | exit 0 |
| `pnpm build` | exit 0 (the >500 kB chunk warning was already there) |
| `eslint` on the 4 changed files | exit 0, 0 problems |
| `pnpm lint` (whole repo) | **FAIL** — 3 errors, all `react/prop-types` in `src/features/design/components/spotlightCard.jsx` (mtime 11:07, untouched here) |
| `pnpm check:visual` | **FAIL** — rule 01a: 25 raw colour literals, all in `borderGlow.jsx` (mtime 11:44) and `spotlightCard.jsx`; rule 01b: 7 occurrences vs a ceiling of 5, the 2 new ones both `spotlightCard.jsx:48` |

This unit's files contribute **zero** findings to either failing rule (verified by running both
gate patterns against `flexCarousel.jsx`, `blocks.jsx`, `index.js` and `DesignSystem.jsx`:
0 occurrences). Both offender files were last written hours before this unit started, and the
whole `src/features/design/` tree is untracked, so the gate was red on arrival — the two
failures are debt in the `/design` surface itself, outside this task's authorized edit surfaces.

## Concurrency finding

A second writer was active in the same worktree during this unit, porting `AccordionGallery`
(`odd/tasks/design-accordion-gallery.md`, *en curso*): it created `accordionGallery.jsx`,
edited `reference.css`, `blocks.jsx`, `index.js`, `DesignSystem.jsx` and `DESIGN.md` between
16:42 and 16:44. One edit of mine failed on an `oldString` mismatch because the file had moved
under it — caught by the tool, no corruption — and one DESIGN.md edit of mine briefly truncated
the other writer's AccordionGallery row before being restored byte-for-byte in the next
operation. Its `// components — 11` comment in `index.js` is currently wrong (7 + 6 = 13) and
was left alone because that file was still moving.

## Next step

Report and ask two things: (1) whether to fix the two pre-existing gate failures in
`spotlightCard.jsx` / `borderGlow.jsx`, which sit outside this unit's authorized surfaces, and
(2) whether to commit — the working tree carries unrelated uncommitted work (`package.json`,
`pnpm-lock.yaml`, `docs/`, `src/app/`), so staging only this unit is a maintainer decision.
