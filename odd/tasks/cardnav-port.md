# cardnav-port — CardNav: faithful reactbits port

Feature: cardnav-port
Branch: landing-page
Route: **delegated direct** — writer trigger fired (2+ non-trivial files: cardNav.jsx,
reference.css, plus edits across blocks/index/demos/DesignSystem/api.test/DESIGN.md).

## Objective

Replace the placeholder card-deck `CardNav` in `blocks.jsx` with a faithful port of the
reactbits CardNav navigation bar (hamburger → 60px bar → expanding 3-card link bar),
demoed on `/design` with the app's 13 current nav links.

## Why

`/design` currently renders an unrelated static deck under the CardNav name; DESIGN.md
records it as "Aproximación — pendiente de reescritura". The real component is the nav
bar documented at reactbits.dev/components/card-nav.

## Allowed edit surfaces

- `src/features/design/components/cardNav.jsx` (NEW)
- `src/features/design/components/blocks.jsx` (remove old CardNav only)
- `src/features/design/components/index.js` (export line + faithful-ports comment)
- `src/features/design/components/reference.css` (append CardNav section)
- `src/features/design/components/demos.jsx` (CardNavDemo)
- `src/features/design/pages/DesignSystem.jsx` (demo block + imports)
- `src/features/design/components/api.test.js` (prop-surface entry)
- `public/ceumrm-wordmark.svg` (NEW — demo logo asset)
- `DESIGN.md` (fidelity ledger row)
- `odd/tasks/cardnav-port.md` (this file)

## Constraints

- Rule 01a of `scripts/check-visual-contract.sh`: no colour literals in `src/` (hex +
  rgb/rgba/hsl/oklch/… functions). Colour props take TOKEN NAMES resolved at runtime by
  `useTokenColors` (colors.js). Ported CSS colours become `@apply cem-*` tokens or
  `currentColor` (already used 3× in reference.css).
- `react-icons` is NOT a dependency: upstream's `GoArrowUpRight` → `ArrowUpRight01Icon`
  from `@hugeicons/core-free-icons`, rendered at size 16 (upstream is `1em` at 16px).
- `gsap` ^3.15.0 is already a dependency (accordionGallery.jsx uses it) → keep the
  reference GSAP timeline.
- API = upstream contract only: `logo, logoAlt, items, className, ease, baseColor,
  menuColor, buttonBgColor, buttonTextColor`. Upstream has NO `theme` prop (verified on
  GitHub main, all 4 registry variants) — do not invent one.
- `pnpm` only; no commits, no pushes.

## Tasks

- [x] T1 RED: add the `cardNav.jsx` entry to api.test.js first, run it, observe failure
      (file missing) — this is the honest RED for the port.
- [x] T2 Port `cardNav.jsx`: reference structure verbatim (`/tmp/opencode/cardnav-ref.jsx`),
      token colours, Hugeicons arrow, `/* eslint-disable react/prop-types */` header
      matching sibling ports.
- [x] T3 Port the reference CSS into reference.css as a `CardNav` section
      (`/tmp/opencode/cardnav-ref.css`): `background-color: white` → `@apply bg-cem-text`,
      border/shadow → tokens, `#111`/`#333` CTA → `@apply bg-cem-base` /
      `hover:bg-cem-hover`, `currentColor` kept.
- [x] T4 Remove old CardNav from blocks.jsx (section comment + function, currently the
      last export); rewire index.js: move `CardNav` out of the blocks list into the
      "ported from the reference source" group, and reconcile the NINE-ports comment with
      reality (count/list must match the files that carry a reference.css section).
- [x] T5 `CardNavDemo` in demos.jsx: the 13 `navLinks` from `AppLayout.jsx:7-20`,
      grouped into the reference's 3-card limit —
      Play (5): Home, Repertoire, Library, Setlists, Gigs
      Band (4): Rehearsals, Bandmates, Organizations, Services
      System (4): Moderation, Notifications, Settings, Storage
      `href` = the real route paths, `ariaLabel` = `Go to ${label}`,
      `baseColor: 'text'`, `menuColor: 'base'`, `buttonBgColor: 'base'`,
      `buttonTextColor: 'text'`, item `bgColor` surface/elevated/base, `textColor: 'text'`.
- [x] T6 `public/ceumrm-wordmark.svg`: amber mark + dark "CEMURM" wordmark, 28px tall
      (`.logo { height: 28px }`). Brand colours live in the asset; rule 01a scopes to src/.
- [x] T7 Swap the `/design` demo block: wrapper `<div className="relative h-[340px] w-full">`
      (the reference container is `position: absolute`), new note text replacing the deck
      note, drop the now-unused `CardNav` import from DesignSystem.jsx if nothing else uses it.
- [x] T8 api.test entry GREEN; DESIGN.md: move CardNav from the Aproximación list into the
      Fiel table with what the port preserves.
- [x] T9 Verification: run every command under Verification and record observed results.

## Verification

Observed on 2026-10-06, run individually and in this order:

```
pnpm test                    → 14 files, 358 tests passed (exit 0)
pnpm typecheck               → no output, exit 0
pnpm lint                    → no output, exit 0 (`--max-warnings 0`)
pnpm build                   → ✓ built in 6.71s, exit 0 (the >500 kB chunk
                               warning is pre-existing, see AGENTS.md)
bash scripts/check-visual-contract.sh
                             → exit 1: "visual contract: FAILED (1 failing,
                               9 non-failing)" — rule 01a, 8 occurrences, ALL
                               in src/features/design/components/accordionGallery.jsx
                               (lines 37, 48, 51, 54 ×2, 55, 125, 325).
                               PRE-EXISTING: the same 8 findings were captured
                               on this tree BEFORE this task started, and a
                               direct scan of every file this task touched
                               returns 0 findings. See Findings.
```

GATE RESOLVED (same day, maintainer authorization): the 8 comment literals in
`accordionGallery.jsx` were rephrased — 7 substitutions, comments only, no code
change and no rule change. Re-runs after that fix:

```
bash scripts/check-visual-contract.sh  → "visual contract: OK (10 rules checked,
                                          0 failing)" (exit 0)
pnpm lint                              → no output, exit 0
```

The api.test entry specifically: RED first (`Error: ENOENT: no such file or
directory, open '.../cardNav.jsx'` at api.test.js:134), GREEN after T2
(14 passed).

Known environmental failures: none was declared at start — but the visual gate
was ALREADY red before this task (see Findings, item 1). `pnpm lint` was
verified green on this tree before start and stayed green.

Interactive behaviour (hamburger → GSAP expand) is NOT exercised by the suite:
`components.test.jsx` / `DesignSystem.test.jsx` render to static markup in the
node environment, so they assert structure and the prop contract, not motion.

## Findings / deviations

- Upstream has no `theme` prop; the `theme="light"` in the pasted usage is not part of the
  API — not implemented (inventing props is the exact mistake DESIGN.md records for
  SpotlightCard).
- Demo links stay plain `<a href>` (upstream contract) → full page load on click, not SPA
  navigation.
- On viewports ≤768px the expanded bar (mobile measures content) can extend past the demo
  wrapper's fixed 340px; desktop is exact (2em top + 260px nav).
- Logo asset added under `public/` — outside the gate's `SRC_DIR="src"` scope.
- **The visual gate was already RED before this task.** Baseline captured before
  `cardNav.jsx` existed: rule 01a, 8 occurrences, every one of them in
  `accordionGallery.jsx` (a file outside this task's edit surface) and every one
  inside a COMMENT — the header notes and the JSX comment quote the reference's
  literals (`color-mix(`, `#0a0713`, `rgba(`, `rgb(`), which rule 01a scans for
  regardless of comment context. Count and lines are IDENTICAL after this task;
  a direct 01a-pattern scan of cardNav.jsx, demos.jsx, blocks.jsx, index.js,
  api.test.js, reference.css and DesignSystem.jsx returns 0. Not fixed here:
  `accordionGallery.jsx` is not an allowed edit surface, and
  `odd/tasks/design-gate-01a-spotlight-borderglow.md` suggests another session
  owns that file. The comments need rephrasing, never the code.
  RESOLVED after the task with maintainer authorization ("dale tú"): those 8
  comment occurrences rephrased in place; gate now OK, 0 failing.
- `index.js` still calls SpotlightCard "A NINTH faithful port", which no longer
  lines up with the header's ELEVEN-with-stylesheet list (SpotlightCard is the
  twelfth faithful port overall, the only one without a reference.css section).
  Left untouched on purpose: the brief scoped fixes to the header comment block
  only. Recommended follow-up: "A TWELFTH faithful port".
- Two other stale counts found while grepping, both pre-existing and both out of
  scope (untouched): `index.js` line "// components — 11" sits above a blocks
  list with 7 exports (11 was true before FlexCarousel and AccordionGallery
  joined the group), and DESIGN.md §"Las siete piezas portadas con su CSS
  original" says seven while reference.css now carries eleven sections.
- `@apply hover:bg-cem-hover` inside the `.card-nav-cta-button:hover` rule
  compiles to `.card-nav-cta-button:hover:hover` — a doubled pseudo-class with
  identical matching, verified in the built CSS. Kept because the brief
  specified that spelling; `@apply bg-cem-hover` would have been equivalent.
- Upstream's `menuColor` has NO default (the reference falls back inline with
  `menuColor || '#000'`); here the signature carries `menuColor = 'base'` as the
  brief specified, so the prop keeps its name and position and the inline
  fallback becomes unnecessary.
- DESIGN.md changed under this task while it was being edited (another session
  moved `SpringCheck` out of the Aproximación row into its own Fiel row); the
  edit was re-read and re-applied against the new text instead of the stale copy.
- Asset filename is `ceumrm-wordmark.svg` (and `logo="/ceumrm-wordmark.svg"`)
  exactly as specified — the spelling differs from the project name "cemurm" but
  file and prop match, so it resolves.

## Delivery

- Forecast ≈ 530 authored lines → above the 400-line PR budget; chain strategy decision
  deferred until commit scope is settled (the whole `src/features/design/` is untracked
  from earlier sessions — a work-unit commit cannot isolate this task's files).
- Commit: **PENDING** — maintainer decision on how the untracked design tree ships.

## Progress

- [x] T1–T9 complete — see Verification and Findings below.

  - T1 RED observed first: `api.test.js:134 — ENOENT … cardNav.jsx`.
  - T2 `cardNav.jsx` written: reference structure verbatim (calculateHeight,
    paused GSAP timeline, toggleMenu, resize rebuild, hamburger aria,
    `aria-hidden`, `items.slice(0, 3)`), token colours via `useTokenColors`,
    Hugeicons arrow at 16, named + default export.
  - T3 `reference.css` gained a `/* ====…==== CardNav */` section: the full
    reference stylesheet, `white`/`#111`/`#333`/hairline/shadow tokenised,
    `currentColor` on the hamburger lines, everything else ported as-is.
  - T4 blocks.jsx: section 26 + the deck function removed (file ends at
    AnimatedList, 389 lines); header count 12 → 11; every import re-grepped,
    none became unused. index.js: `CardNav` moved to the ported group,
    NINE → ELEVEN with `accordionGallery.jsx` and `cardNav.jsx` added.
  - T5 `CardNavDemo` with the 13 real routes in three cards; no caption
    paragraph (the bar is absolutely positioned inside the wrapper).
  - T6 `public/ceumrm-wordmark.svg` rendered and eyeballed at 4× — amber mark
    with an eighth note, dark "CEMURM", 28px box.
  - T7 DesignSystem: `CardNavDemo` inside `<div className="relative h-[340px]
    w-full">`, new note, `CardNav` import dropped (grep confirmed no other use).
  - T8 api.test GREEN (14 passed); DESIGN.md row added and CardNav removed
    from the Aproximación list.
  - T9 all five commands run; results recorded above. The gate's failure was
    pre-existing and untouched by this task; later resolved by rephrasing the
    8 accordionGallery comment literals (maintainer-approved) — gate OK, 0
    failing, lint re-verified green (comment-only change; test/typecheck/build
    cannot be affected and were green before it).
