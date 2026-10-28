# listbox-rac-heroui — HeroUI ListBox contract on react-aria-components

Feature: listbox-rac-heroui
Branch: landing-page
Route: **delegated direct** for the component (writer trigger fired: `listBox.jsx` NEW,
`index.css` ListBox block, `index.js`, `DesignSystem.jsx`, plus two test files);
**direct inline** for the dependency + regression fix (mechanical, already understood).

## Objective

Add a HeroUI-contract `ListBox` to `/design`, backed by an **installed dependency**
(`react-aria-components@1.21.1`) instead of a hand-written port.

## Why

`@heroui/react@3.2.6` peer-requires `react >=19` + `tailwindcss >=4`; this repo is on
React 18.3.1 + Tailwind 3.4.4. The uncommitted `@heroui/react` import in `skeleton.jsx`
made the module fail to load (`react` provides no export named `use`) and turned
**3 design test files red** on the `landing-page` working tree.

Three options were measured, not guessed:

- **v3 + migrate** — React 19 has zero hard-break sites in `src/` (0 × `findDOMNode`,
  `defaultProps`, legacy context, `ReactDOM.render`, `hydrate`; 0 real `propTypes`), but
  Tailwind 4 needs 34 `@apply` sites re-`@reference`d and changes ring/shadow defaults.
  **And it still fails rule 04**: HeroUI's theme injects a second colour system, which is
  the reason `DESIGN.md:424` gives for not installing it. Version-independent.
- **HeroUI v2** — accepts React 18, but exports `Listbox` (lowercase) with **flat**
  `ListboxItem`/`ListboxSection`, no `ItemIndicator`, no `Label`/`Description`/`Header`/
  `Surface`, and `startContent`/`endContent` props. Different component entirely, plus
  ~40 hard deps and `framer-motion` — while this repo already uses `motion`.
- **`react-aria-components@1.21.1`** — the layer HeroUI v3 itself is built on.
  `react: ^18.0.0` ✅. Same API as the docs (`selectionMode`, `selectedKeys`,
  `disabledKeys`, `onAction`, `items`, `render`; `isSelected`/`isFocused`/`isPressed`
  render props; `Virtualizer` included). **Zero Tailwind peer, zero theme, no palette** →
  rule 04 untouched. 7 behavioural deps (`react-aria`, `react-stately`).

Decision (maintainer, this session): **`react-aria-components`**. It is the only option
that removes real work — keyboard nav, typeahead, focus management, selection state,
virtualization, ARIA — without a migration and without a second colour system.

**Tradeoff accepted:** RAC ships no styles. The CSS is written by hand — which it would
have to be anyway under rule 04. Only the behaviour was outsourced.

## Tasks

- [x] **T1 — Unbreak the tree.** `@heroui/react` removed (`pnpm remove`); `skeleton.jsx` now
      mirrors the Skeleton contract in plain JSX and imports `useEffect`/`useState`; the `.skeleton`
      base fill (`@apply pointer-events-none rounded-md bg-cem-elevated`) is in `index.css`.
      Observed: `skeleton.test.jsx` passes; no `heroui` string left in `src/` or `package.json`.
- [x] **T2 — Install `react-aria-components@1.21.1`** with `pnpm`. No React/Tailwind bump.
      Observed: react 18.3.1, tailwindcss 3.4.19 unchanged; RAC imports under Node and
      exports `ListBox`, `ListBoxItem`, `ListBoxSection`, `Section`, `Virtualizer`.
- [x] **T3 — `listBox.jsx`**: compound API (`ListBox`, `ListBox.Item`, `ListBox.Section`,
      `ListBox.ItemIndicator`) over RAC. Nesting verified against RAC `ListBox.d.ts`/`Collection.d.ts`
      and `dist/private/ListBox.mjs`: `<ListBox>` builds its own collection, wrappers around
      `ListBoxItem` are safe, a plain `<div>` between list and items renders ZERO rows.
- [x] **T4 — CSS block** (`.list-box`, `-item`, `-item__indicator`, `-section`, `--danger`,
      data-selected/focus-visible/disabled/visible/hovered) in `src/app/index.css`.
      Observed: gate rules 04, 05a, 06, 07 PASS; no 01a/01b finding comes from this block.
- [x] **T5 — Wire into the page**: `index.js` export + `DesignSystem.jsx` ListBox `<Section>`
      (5 demos) + roster 37. Observed: `DesignSystem.test.jsx` green once the unrelated
      `morphSlider.jsx` import is fixed (see Blockers).
- [x] **T6 — Tests**: `listBox.test.jsx` (renderToStaticMarkup, no jsdom) + `api.test.js` entry.
      Observed: 40 tests pass across listBox/skeleton/api.

## Deviations from the HeroUI contract

- `variant="danger"` is carried by weight, not red: no admissible red token (rules 02/04), amber is
  reserved for selection (visual-system rule 2).
- `Label`/`Description`/`Header`/`Surface`/`Kbd` are not re-created; RAC exports no
  `Description`/`Surface`/`Kbd`. `ListBox.Section` `title` renders RAC `Header` (it supplies the
  `aria-labelledby` target).
- Render props: RAC `ListBoxItemRenderProps` has `isSelected`, `isFocused`, `isPressed`,
  `isDisabled`, `isHovered`, `isFocusVisible` — no gap against the contract.
- RAC selection is always a `Set`, also in `single` mode; the demos hold a `Set` in state.

## Blockers found outside the allowed surfaces (reported, not edited)

- `components/morphSlider.jsx:72` imports `motion` from `'react'` (must be `motion/react`) —
  `components.test.jsx` and `DesignSystem.test.jsx` crash on it (`reading 'div'`).
  `morphSlider.jsx:130` also has a `react-hooks/exhaustive-deps` warning (lint is `--max-warnings 0`).
- Gate rule 01a FAILS on `morphSlider.jsx:45,102` and `springCheck.jsx:80-82` (colour literals).
- With only the `motion/react` import fixed in a scratch copy, all 6 design test files pass (76 tests).

## Allowed edit surfaces

- `src/features/design/components/listBox.jsx` (NEW)
- `src/features/design/components/index.js`
- `src/features/design/pages/DesignSystem.jsx`
- `src/features/design/pages/DesignSystem.test.jsx`
- `src/features/design/components/api.test.js`
- `src/app/index.css` (append ListBox block beside the Skeleton one)
- `src/features/design/components/skeleton.jsx`
- `package.json`, `pnpm-lock.yaml`
- `DESIGN.md`
- `odd/tasks/listbox-rac-heroui.md` (this file)

## Constraints

- **Rule 01a** (`enforcing`): no hex or colour function (`rgb`/`rgba`/`hsl`/`oklch`/`color-mix`)
  anywhere in `src/`. Use `@apply bg-cem-*` / `text-cem-*` or `currentColor`.
  Precedent: `index.css:60`.
- **Rule 04** (`enforcing`): the `cem.*` palette may not grow. RAC adds no colours; every
  colour in the ListBox must come from an existing token.
- **Rule 06** (`enforcing`): no `text-cem-secondary` on an elevated/hover fill.
- **Rule 01b / 02** (`ratchet`): no Tailwind default-palette utilities, no retired accents.
- JSX, not TSX. Tailwind only. Components `PascalCase.jsx`.
- The HeroUI BEM classes are **public API** (mirroring HeroUI's own), so the stylesheet
  belongs in `src/app/index.css` next to `.skeleton--*` — same reasoning as the
  Skeleton block, which documents that the class is public and any caller may use it.
- Artifacts (comments, CSS, prose) in **English**, per the language domain contract.

## Verification

```bash
pnpm test && pnpm typecheck && pnpm lint && bash scripts/check-visual-contract.sh && pnpm build
```

## Progress / evidence

See the commits on `landing-page` and the verification block appended below.
