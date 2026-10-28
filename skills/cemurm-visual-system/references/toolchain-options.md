# Toolchain Options for the macOS Visual System

Decision record for the CEMURM visual-system redesign. Every number came from a command run
2026-09-27 or 2026-09-28, named next to the number. Anything unconfirmed is written `unverified`
rather than guessed.

Fixed constraints: React 18.3.1, Vite 5.4.21, Tailwind 3.4.19, plain JSX (no TypeScript), pnpm.
No component library, no Zustand, state in React context and hooks. Offline-first PWA on cheap
Android tablets, dark room, live service. Budget: landing 120 kB gzip, largest chunk 150 kB gzip.
Project rule: no animation library in the authenticated bundle. Tailwind stays on 3.4 this cycle.

Current measured baseline — `npx vite build --outDir /tmp/opencode/cemurm-dist --emptyOutDir` emits
**one** JS chunk, `index-ec4j5xb5.js` at **232,032 B gzip**, plus a 5,953 B gzip stylesheet. That is
already 82 kB over the chunk ceiling before any dependency is added, so code splitting is a
prerequisite for this work, not a follow-up.

---

## 1. How to Evaluate a Candidate

Apply all seven. Failing 5, 6, or 7 is disqualifying regardless of stars.

| # | Criterion | Checkable question | How it was checked here |
|---|---|---|---|
| 1 | Adoption | How many actually installed it? | `npx skills find "<query>"`; `npm view <pkg>` |
| 2 | Reputation | Is the source accountable? | `gh api repos/OWNER/REPO --jq .stargazers_count` |
| 3 | Maintenance | Is it alive? | `--jq .pushed_at`, `--jq .archived`, `npm view <pkg> version` |
| 4 | Licence | Can we ship it? | `--jq .license.spdx_id`. If `NONE`, read the `LICENSE` file or mark `unverified`. Never infer one. |
| 5 | Byte cost | What does it cost 120/150 kB? | esbuild minify + ESM + gzip, React externalised |
| 6 | Runtime overhead | Needs JS to work, or only to configure? | Read the source. Any `.Provider`/`.Portal` layer is runtime JS. |
| 7 | Low-end degradation | Worse on a 2019 Android tablet? | Per-frame work: scroll listeners, `IntersectionObserver` loops, `backdrop-filter` count, font payload |

Two project-specific rules: **Tailwind 3.4 compatibility is a hard gate** (section 2), and **the
bundle budget is measured, not estimated**.

---

## 2. Component Libraries

Repo metadata from `gh api repos/OWNER/REPO` (2026-09-27). Gzip from esbuild minify + ESM + gzip
with `react`/`react-dom`/`react/jsx-runtime` externalised. "TW 3.4" is the hard gate from section 1.

| Library | Stars | Last push | Licence | Shape | Measured gzip | TW 3.4 | Verdict |
|---|---|---|---|---|---|---|---|
| shadcn/ui | 124,712 | 2026-09-24 | MIT | Copy-in | 0 | **No** | Reject this cycle |
| Radix Primitives | 19,339 | 2026-08-08 | MIT | Dependency | Dialog 13,441 B; Popover+Tooltip+Tabs 30,399 B | Yes | Adopt, per primitive |
| Headless UI | 28,758 | **2026-04-13** | MIT | Dependency | Dialog 16,796 B | Yes | Inspect only |
| Ark UI | 5,398 | 2026-09-27 | MIT | Dependency | not measured | Yes | Inspect only |
| Base UI | 11,007 | 2026-09-28 | MIT | Dependency | Dialog 25,084 B (v1.0.0-rc.0) | Yes | Reject this cycle |
| React Aria Components | 15,894 | 2026-09-28 | Apache-2.0 | Dependency | not measured | Yes | Reject |
| Mantine | 31,775 | 2026-09-26 | MIT | Full styled system | not measured | Co-exists | Reject |
| HeroUI (ex-NextUI) | 30,837 | 2026-09-27 | Apache-2.0 repo / MIT npm | Full styled system | not measured | No | Reject |
| "macOS UI in React" | — | — | — | — | — | — | Does not exist |

**shadcn/ui — reject this cycle, reconsider with Tailwind 4.** The copy-in model is exactly
right: zero runtime dependency, source the project owns, Tailwind-native. The blocker is version.
The current docs install `@tailwindcss/vite` and use `@import "tailwindcss"`, and shipped
components target the v4 theme where `shadow-sm`, `rounded-md`, and `ring` mean something else.
Adopting now means hand-porting every component back to v3 semantics.

**Radix — adopt, one primitive at a time.** MIT, actively maintained, completely unopinionated
about styling: it provides behaviour and accessibility, you provide class names. That is the only
shape that lets a macOS visual system exist without fighting a library's defaults. Add
`@radix-ui/react-dialog` when a dialog is needed; not the aggregate `radix-ui` package.

**Headless UI and Ark UI — inspect only.** Headless UI last pushed 2026-04-13, five months stale
while every competitor pushed within the week; a primitive that must be re-implemented is a
liability on a project with a hard offline guarantee. It also ships Tailwind class names inside
the component, so its DOM carries a styling opinion to fight, and 16.8 kB for one Dialog is 25%
more than Radix for the same job. Ark UI is MIT, current, and right-shaped, but at 5,398 stars
against Radix's 19,339 and being Chakra's rebrand of a Zag-based system — a large framework behind
a primitive — there is no gzip number to justify it over Radix. Revisit either only for a
primitive Radix lacks.

**Base UI — reject this cycle.** `npm view @base-ui-components/react dist-tags` returns
`{"latest": "1.0.0-rc.0"}`; the `*` range does not even resolve (`ETARGET`). Shipping a
project-critical primitive from an RC that can still break its API is the wrong trade for a
dark-room tablet. Also the most expensive Dialog measured, 25.1 kB, nearly double Radix.

**React Aria, Mantine, HeroUI — reject all three.** React Aria is Apache-2.0 and the most correct
accessibility implementation on the list, and also the most opinionated: its own styling hooks, its
own state layer, a large runtime, and an API assuming a design system we do not have. Mantine and
HeroUI are complete styled systems that want to own the theme, the components, and the CSS — the
opposite of what a macOS redesign needs, and HeroUI is closest to "Apple-looking" precisely because
it enforces its own theme through Tailwind plugin config. HeroUI's licence is also inconsistent
between surfaces (Apache-2.0 in the repo, MIT on `@heroui/react@3.2.6`).

**"macOS UI in React" — does not exist.** `gh api "search/repositories?q=macos+ui+react"` returns
`yang991178/fluent-reader` (9,680 stars, a desktop e-book reader) and `gabrielbull/react-desktop`
(9,481 stars, last push 2023-07-01). Every repo named `apple-design-system` scores 0-9 stars.
**The Apple look has to be built by hand from CSS. This is the most important finding here.**

### Tailwind 3.4 compatibility

From `https://tailwindcss.com/docs/upgrade-guide` (fetched 2026-09-27), the v4 renames hit exactly
the utilities a macOS look is built from: `shadow-sm` → `shadow-xs`, `shadow` → `shadow-sm`,
`rounded-sm` → `rounded-xs`, `rounded` → `rounded-sm`, `backdrop-blur` → `backdrop-blur-sm`,
`outline-none` → `outline-hidden`, `ring` → `ring-3`.

Plus three silent behaviour changes that break a dark UI with no error: `ring` default width 3px →
1px and colour `blue-500` → `currentColor`; `border-*`/`divide-*` default colour `gray-200` →
`currentColor`; `transition` now also transitions `outline-color`. A macOS look depends on a soft
wide low-opacity shadow and a hairline ring — under v4 those become `shadow-2xl` and `ring-1` with
an explicit colour, and every call site needs auditing. Tailwind stays on 3.4.

> The claim that this project "already reverted a Tailwind 4 migration once" is **unverified**.
> `git log --all --grep=tailwind -i` returns five commits, none a version bump, and
> `git log --oneline --all -- package.json` never shows `tailwindcss` above `^3.4.4`. Keep v4
> rejected on its own merits — "v4 semantics are wrong for this design" — which is sufficient.

---

## 3. macOS-Look-Specific Options

Four separable pieces. Three achievable; one legally closed. All browser data below is MDN
browser-compat-data, queried locally.

### Vibrancy / materials — achievable, with a cost

`backdrop-filter`: `chrome 76 · chrome_android 76 · edge 79 · firefox 103 · firefox_android 103 ·
safari 18 · safari_ios 18 · samsunginternet_android 12.0 · webview_ios 18`. The
`-webkit-backdrop-filter` prefix has no BCD entry, so write the unprefixed name.

**Usable, but budget it deliberately.** The real cost is criterion 7: every `backdrop-filter` layer
is a GPU blur running during scroll. On a cheap tablet, three or four stacked layers drop frames
where a musician is scrolling a setlist. Rule: **one** vibrancy surface per screen, the navigation
shell, never a list row and never a card inside a scrolling list.

`prefers-reduced-transparency` is the right guard and is unevenly supported: `chrome 118 · edge 118
· firefox 113 · samsunginternet_android 25.0`, with `firefox_android false` and `safari false` /
`safari_ios false`. On Firefox Android and all of Safari it silently does nothing. So write the
**opaque fallback as the base rule** and the translucent one inside
`@supports (backdrop-filter: blur(1px))` — not the reverse.

### Continuous corners (squircle) — not achievable on the target device

`corner-shape`: `chrome 139 · chrome_android 139 · edge 139 · opera 123 · samsunginternet_android
30.0`, with `firefox "preview"` / `firefox_android false` and `safari "preview"` / `safari_ios
false`. BCD status: `{ deprecated: false, experimental: true, standard_track: true }`.
`corner-shape: squircle` has identical support.

**iOS Safari is `false` and Firefox Android is `false`** — on a project whose target is a cheap
Android tablet this is unusable, and it is flagged `experimental: true`, so it may change. Both
workarounds are dead ends too: `massivemadness/Squircle-CE` (1,882 stars, Apache-2.0) uses the CSS
Paint API, which Firefox does not implement; `PavelLaptev/css-houdini-squircle` (439 stars, MIT)
last pushed 2023-06-24 and has the same Houdini problem. **Approximate with `border-radius` and
stop.** A single large radius plus a 1px hairline reads as "Apple" to almost every user;
superellipse versus 12px radius is not perceptible at musician-UI sizes.

### SF Pro and type — the licensing reality

From `https://developer.apple.com/fonts/`, fetched 2026-09-27, revision EA1370 2/24/2016. Three
clauses decide it (verbatim):

> "IMPORTANT NOTE: THE APPLE SAN FRANCISCO FONT IS TO BE USED SOLELY FOR CREATING MOCK-UPS OF USER
> INTERFACES TO BE USED IN SOFTWARE PRODUCTS RUNNING ON APPLE'S iOS, OS X OR tvOS OPERATING SYSTEMS."

> "You may use this Apple Font only for the purposes described in this License and only if you are
> a registered Apple Developer, or as otherwise expressly permitted by Apple in writing." (§2A)

> "The grants set forth in this License do not permit you to, and you agree not to, install, use or
> run the Apple Font for the purpose of creating mock-ups of user interfaces to be used in software
> products running on any non-Apple operating system or to enable others to do so. You may not embed
> the Apple Font in any software programs or other products." (§2B)

This is not ambiguous, and it is not a "prefer not to" situation. §2B forbids use on **any
non-Apple operating system** — CEMURM's primary target is Android, so it is prohibited outright.
The preamble and §2A limit use to **mock-ups** and require registered-Apple-Developer status, so
even on an Apple device self-hosting SF Pro in a shipped web app is outside the grant. §2B
separately forbids **embedding the font in any software product**, which is what `@font-face` does.

**Shipping SF Pro on the web is prohibited by the licence. No configuration makes it legal.** The
only legitimate path is the one Apple already provides — reference the OS font by keyword
(`-apple-system` resolves to San Francisco on Safari and on Chrome/Edge on Apple platforms, with no
redistribution; `unverified` in BCD because it is a non-standard keyword, not a specified feature):

```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, /* … */ sans-serif;
```

On non-Apple devices the fallback takes over, and **this is where the macOS illusion ends.** The
project self-hosts Inter via `@fontsource/inter` (400/500/600/700, imported in `src/app/main.jsx`).
Inter is the right choice to keep: the closest metric-compatible open substitute for SF, already
paid for in the bundle, and it renders identically everywhere instead of fragmenting into a
different typeface per device. **The visual system must be designed so the look survives in Inter,
with SF as a bonus on Apple hardware — not the reverse.** The Apple look has to come from the ramp,
the radii, the hairlines, the spacing, and the materials.

### What "macOS look" reduces to, given the above

A four-step dark surface ramp with hairline `1px` borders at low opacity rather than shadows; one
`backdrop-filter` layer on the navigation shell behind an `@supports` guard; a tight uniform
spacing scale on an 8px rhythm; system-corner `border-radius` rather than squircles;
`-apple-system` first in the stack with Inter as the shipped fallback; and `prefers-color-scheme`
honoured (`chrome 76 · firefox 67 · safari 12.1`) even though the app is dark-first, so a light-mode
tablet is not blinding in a bright room. None of that needs a library. All of it needs a decision
the skill has to encode.

---

## 4. Icon Set

| Set | Repo | Stars | Last push | Licence | Tree-shaking |
|---|---|---|---|---|---|
| Lucide | `lucide-icons/lucide` | 24,748 | 2026-09-27 | **ISC** — `gh` says `NOASSERTION`; `LICENSE` reads "ISC License, Copyright (c) 2026 Lucide Icons and Contributors" | Per-icon ESM; 15 named imports = **3,235 B gzip** |
| Heroicons | `tailwindlabs/heroicons` | 23,829 | 2026-05-12 | MIT | Per-icon |
| Phosphor | `phosphor-icons/homepage` | 7,557 | — | MIT | 6 weights, per-icon, plus webfont option |
| Material Symbols | `google/material-design-icons` | 54,031 | 2026-09-25 | Apache-2.0 (`LICENSE`: "Apache License Version 2.0, January 2004") | Variable webfont; self-hosting required |

**Verdict: Lucide.** A 24px grid with 2px stroke — the same geometry as SF Symbols, which is what
makes it read as "Apple" rather than "Material". 3,235 B gzip for 15 icons, roughly 215 B per icon:
the cheapest line item in this document, and measured. The 35 MB `dist.unpackedSize` is the whole
set as files, not what ships. ISC is the most permissive of the four, confirmed from the `LICENSE`
file because GitHub's API reports `NOASSERTION`.

**Runner-up Heroicons** — also MIT, also 24px/2px, the Tailwind-adjacent choice; its
outline/solid/mini split is better designed than Lucide's single weight if the set grows toward
filled active states. Do not install both. **Reject Phosphor** — nicest artwork, but the React
package last pushed 2026-01-06 and six weights do not map onto a single-weight system. **Reject
Material Symbols** — correct licence, wrong dialect, and a self-hosted variable webfont is exactly
the payload the 120 kB budget cannot absorb, plus a FOUT on a slow tablet connection.

### The cost of the current glyph sites

The codebase uses raw Unicode glyphs inline in JSX. Measured with `grep -rP` over
`src/**/*.{jsx,js}`, excluding comment-only lines: **43 rendered glyph sites across 17 files**,
concentrated in `StageMode.jsx` (11), `ServiceDetail.jsx` (5), `SetlistDetail.jsx` (5),
`SongDetail.jsx` (3), and the `← Back to <section>` link duplicated in 8 pages. Three problems the
macOS redesign must fix anyway:

1. **Inconsistent rendering.** `← ↑ ↓ ✕ ✓ ⚠ ♪ ♫ ▶` plus two full-colour emoji (U+1F4FA
   television, U+1F39B control knobs) come from whatever font the OS supplies. On a cheap tablet
   with a stock emoji font, those two are colour glyphs with their own baseline and padding. They
   cannot be sized, cannot take `currentColor`, and will not line up with a Lucide icon at 20px.
2. **Inaccessible.** `← Back to rehearsals` is fine. `↑ top` in a reorder control
   (`SetlistDetail.jsx:806`) is an `aria-label` with no visible text and no describable component.
3. **Non-localised and duplicated.** The `← Back to` string appears in 8 pages with 8 slightly
   different class strings — a component waiting to happen.

The migration is mechanical: one `<BackLink>`, one `<IconButton>`, Lucide for the rest. Budget it
as a work unit, not a drive-by — `StageMode.jsx` is the live-performance screen and 11 changes in
one file needs a manual smoke test on the tablet.

---

## 5. Animation and Motion

**No animation library in the authenticated bundle.** That is a rule, and the measured numbers below
are why it is enforceable rather than aspirational. Note the last column: nothing on this list
gives you `prefers-reduced-motion` for free except `motion`, at 41 kB.

| Approach | Browser support (MDN BCD) | Gzip | Reduced-motion free? |
|---|---|---|---|
| CSS transitions/keyframes | Universal | 0 | No — must be written |
| `@starting-style` | Chrome 117 · Edge 117 · Firefox 129 · Safari 17.5 · iOS 17.5 · Samsung 24.0 | 0 | No, but pairs with a media query |
| `transition-behavior: allow-discrete` | Chrome 117 · Edge 117 · Firefox 129 · Safari 17.4 | 0 | No |
| View Transitions | Chrome 111 · Edge 111 · **Firefox 144** · Safari 18 · iOS 18 | ~0-300 B glue | No |
| `animation-timeline` | Chrome 115 · Edge 115 · **Firefox preview** · **Firefox Android false** · Safari 26 · iOS 26 | 0 | No |
| `view-timeline` / `animation-range` | Chrome 115 · **Firefox preview / Android false** · Safari 26 | 0 | No |
| WAAPI (`Element.animate`) | Chrome 36 · Edge 79 · Firefox 48 · Safari 13.1 · iOS 13.4 | 0 | No |
| `motion` (`motion/react`) | Universal | **41,846 B** | Yes — `useReducedMotion` |
| `motion/mini` `animate()` | Universal | **3,933 B** | No |

**1. CSS transitions and `@keyframes`, hand-written, as the default.** Zero bytes, universal, no
library. A macOS look is mostly 150-200ms `ease-out` on `opacity` and `transform` — two lines in a
`@layer components` block. This should be 90% of the motion in the app.

**2. `@starting-style` for entry animations — the best-supported modern feature on this list.**
Firefox 129 and Safari 17.5, far better than View Transitions and much better than scroll-driven.
Zero bytes, pure CSS, and dialogs and popovers enter with no JavaScript at all:

```css
@starting-style { .sheet { opacity: 0; transform: scale(0.96); } }
.sheet { opacity: 1; transform: scale(1); transition: opacity 180ms, transform 180ms; }
@media (prefers-reduced-motion: reduce) { .sheet { transition: none; } }
```

Pair with `transition-behavior: allow-discrete` (Chrome 117 / Firefox 129 / Safari 17.4) to
animate `display` and `overlay` through a transition. Two properties, both free.

**3. `prefers-reduced-motion` must be written by hand.** The query is well supported —
`chrome 74 · firefox 63 · safari 10.1` — so it always works, but no CSS feature above disables
itself under it, and the only library giving it for free is `motion` at 41 kB. Rule: **every
motion rule uses shared duration/timing custom properties, and
`prefers-reduced-motion: reduce` sets those to `0ms` in one block.**

**4. View Transitions — feature-detect, do not assume.** Firefox only reached it in **144**, recent
enough that service tablets may still lack it. Wrap `document.startViewTransition` in a truthiness
check; the fallback is the normal render, already correct. Route changes only, never inside a list.

**5. Scroll-driven animations — do not use them.** The clearest reject here. `animation-timeline:
view()`, `view-timeline`, and `animation-range` are Chrome 115+ and Safari 26+, with **Firefox in
preview and `firefox_android` at `false`**. On Firefox Android such an animation either does not
run or degrades to the base state; a musician scrolling a setlist in a browser that silently
ignores the effect is worse than no effect. It also fails criterion 7: scroll-driven animation ties
compositing to scroll position continuously, exactly the load a cheap GPU cannot absorb.

**6. `motion` — landing route only, and only `motion/mini`.** Measured: `motion/react` with one
`motion.div` and `useReducedMotion` is **41,846 B gzip**, 35% of the entire 120 kB landing budget,
in an app whose current chunk is already 232 kB. It re-implements what `@starting-style` does
natively in browsers that have supported it since 2023. `motion/mini`'s `animate()` is **3,933 B**
— 91% cheaper, imperative, no React wrapper. That is the only form worth considering, and only for
the landing route, which sits outside the authenticated bundle and therefore outside the rule.

**7. WAAPI is the escape hatch for Stage Mode.** `Element.animate` has been in Firefox since 48 and
Safari since 13.1 — universal, zero-dependency — and returns an `Animation` whose `finished` promise
(Chrome 112 / Firefox 115 / Safari 16) can be awaited. If Stage Mode needs a choreographed
transition, WAAPI is the right tool: no library, no bundle cost, imperative control suited to a
performance-critical screen.

**Net motion budget for the authenticated bundle: 0 bytes of animation library.**

---

## 6. Color Tooling

### Why OKLCH beats hand-tuned HSL for a dark ramp

HSL's `lightness` is not perceptual. `hsl(220 20% 50%)` and `hsl(220 20% 20%)` differ by 30 points of
a value mapping to very different perceived brightness, and that perceived difference changes with
hue — a blue at 25% lightness looks much darker than a yellow at 25%. That is why hand-tuned HSL dark
ramps are inconsistent: the step from `surface` to `elevated` reads differently at the top of the
ramp than at the bottom, fixable only by eye, per swatch, forever.

OKLCH fixes this at the root. Its `L` axis is perceptual lightness, calibrated so `L = 0.5` reads as
a mid-tone regardless of hue or chroma, and equal `L` steps read as equal steps. A dark ramp is then
`L: 0.16 → 0.22 → 0.30 → 0.42 → 0.94` and the steps are steps. Chroma is separately controllable, so
a blue-tinted surface holds its hue while the lightness ramp stays even — exactly what a macOS dark
material does. This matters more than usual here: the ramp has to be readable at 3 a.m. under stage
light, where contrast errors are not caught until they are a usability bug in front of an audience.
Support (MDN BCD): `chrome 111 · chrome_android 111 · edge 111 · firefox 113 · firefox_android 113
· safari 15.4 · safari_ios 15.4 · samsunginternet_android 22.0 · webview_ios 15.4`, identical for
`oklab()` and `color-mix()`. **Floor: Safari 15.4 / Chrome 111 / Firefox 113.** Below it an
`oklch()` declaration is an invalid value and is dropped — the element falls back to whatever came
before, or to transparent. This is the one place in the visual system where an unsupported browser
is a **readability** failure rather than a cosmetic one, so it needs a real fallback.

### Build-step implications, measured

Can Tailwind **3.4** consume OKLCH? Yes, with one condition that is not obvious. Tested with
`tailwindcss@3.4.19` in a scratch project, input `@import "tailwindcss/utilities"`, reading the
generated CSS. With `colors: { brand: 'oklch(0.72 0.17 68)' }` the output is
`.bg-brand { background-color: oklch(0.72 0.17 68) }` — and **`bg-brand/50` generates NOTHING. No
rule, no warning.** With
`colors: { brand: { soft: 'oklch(0.72 0.17 68 / <alpha-value>)' } }` the output is
`.bg-brand-soft { --tw-bg-opacity: 1; background-color: oklch(0.72 0.17 68 / var(--tw-bg-opacity, 1)) }`
and `.bg-brand-soft\/50 { background-color: oklch(0.72 0.17 68 / 0.5) }`.

**Rule: every OKLCH token in `tailwind.config.js` MUST use the `oklch(L C H / <alpha-value>)` form.**
A token written as bare `oklch(L C H)` compiles, looks correct in isolation, then silently loses
every `/opacity` variant — the most common way an overlay, disabled state, or hover tint vanishes in
production. No error, no test failure. This deserves a lint rule.

Tailwind 3.4 also has **no OKLCH palette of its own** (its default palette is the v3 HSL set); the
OKLCH palette (`--color-avocado-100: oklch(0.99 0 0)`) arrived in Tailwind 4, per the upgrade guide.
The ramp has to be authored.

### Plugin versus CSS custom properties

**CSS custom properties. Do not add a plugin.** The candidates are thin or stale:
`tailwindcss-oklch@0.0.1` (MIT, version 0.0.1), `tailwindcss-palette-generator@2.4.0` (MIT, a
build-time generator, not a plugin), `tailwind-color-palette@1.0.3` (MIT). No official Tailwind
OKLCH plugin for 3.4 exists — `@tailwindcss/oklch` returns 404 on npm.

Authoring the ramp in `tailwind.config.js` is better here for three reasons: zero dependencies,
which is the point of the budget; Tailwind 3.4's `<alpha-value>` mechanism already generates the
`/opacity` utilities so a plugin adds nothing; and the ramp is the project's most opinionated
artefact, so it belongs in config the project owns, not in a node_modules generator.
```js
// tailwind.config.js
colors: {
  cem: {
    // <alpha-value> is mandatory: without it /opacity silently emits no CSS (Tailwind 3.4).
    base:     'oklch(0.16 0.012 265 / <alpha-value>)',
    surface:  'oklch(0.22 0.014 265 / <alpha-value>)',
    elevated: 'oklch(0.30 0.016 265 / <alpha-value>)',
    border:   'oklch(0.42 0.018 265 / <alpha-value>)',
    text:     'oklch(0.94 0.006 265 / <alpha-value>)',
    secondary:'oklch(0.68 0.014 265 / <alpha-value>)',
    accent:   'oklch(0.78 0.155 70 / <alpha-value>)',
  },
}
```

Chroma stays low (0.006-0.018) on the neutrals, matching Apple's approach of tinting the grey
rather than saturating it; the accent carries the chroma because it is the only thing that should.
Pairs must be checked against WCAG 2.2 rather than `oklch-contrast` intuition. `prefers-contrast` is
available as an enhancement (`chrome 96 · firefox 101 · safari 14.1`) but is not a substitute for
meeting the baseline.

---

## 7. External AI-Agent Skills

Discovered with `npx skills find "<query>"` (2026-09-28). Stars, push, licence from
`gh api repos/OWNER/REPO --jq '{stars: .stargazers_count, pushed: .pushed_at, license: .license.spdx_id, archived: .archived}'`.
Where GitHub reports `NONE` there is no detectable licence file, written `unverified` rather than
guessed. **No skill was installed and executed** — verdicts rest on provenance, repository metadata,
and stated scope. Every install command below follows the verified CLI form
(`npx skills add <owner>/<repo>@<skill>`, confirmed via `npx skills add --help`).

| Skill | Install command | Installs | Stars | Last push | Licence | Verdict |
|---|---|---|---|---|---|---|
| `anthropics/skills@frontend-design` | `npx skills add anthropics/skills@frontend-design` | 929.2K | 178,680 | 2026-09-24 | `unverified` | Inspect only |
| `vercel-labs/agent-skills@web-design-guidelines` | `npx skills add vercel-labs/agent-skills@web-design-guidelines` | 672.4K | 31,632 | 2026-08-28 | `unverified` | Adopt |
| `leonxlnx/taste-skill@design-taste-frontend` | `npx skills add leonxlnx/taste-skill@design-taste-frontend` | 527K | 90,663 | 2026-09-26 | MIT | Inspect only |
| `nextlevelbuilder/ui-ux-pro-max-skill@ui-ux-pro-max` | `npx skills add nextlevelbuilder/ui-ux-pro-max-skill@ui-ux-pro-max` | 373.1K | 131,046 | 2026-09-27 | MIT | Inspect only |
| `pbakaus/impeccable@impeccable` | `npx skills add pbakaus/impeccable@impeccable` | 297.7K | 71,840 | 2026-09-28 | Apache-2.0 | Inspect only |
| `wshobson/agents@tailwind-design-system` | `npx skills add wshobson/agents@tailwind-design-system` | 66K | 40,042 | 2026-09-28 | MIT | Adopt |
| `antfu/skills@web-design-guidelines` | `npx skills add antfu/skills@web-design-guidelines` | 19.5K | 5,927 | 2026-09-28 | MIT | Reject — duplicate |
| `wondelai/skills@ios-hig-design` | `npx skills add wondelai/skills@ios-hig-design` | 6.8K | 2,273 | 2026-09-10 | MIT | Reject — wrong platform |
| `yetone/native-feel-skill@native-feel-cross-platform-desktop` | `npx skills add yetone/native-feel-skill@native-feel-cross-platform-desktop` | 560 | 1,914 | 2026-05-30 | MIT | Inspect only |
| `ehmo/platform-design-skills@macos-design-guidelines` | `npx skills add ehmo/platform-design-skills@macos-design-guidelines` | 3.9K | 592 | **2026-03-19** | MIT | Inspect only |
| `julianoczkowski/designer-skills@design-tokens` | `npx skills add julianoczkowski/designer-skills@design-tokens` | 5.5K | 567 | 2026-07-06 | Apache-2.0 | Adopt |
| `jakubkrehel/oklch-skill@oklch-skill` | `npx skills add jakubkrehel/oklch-skill@oklch-skill` | 3.9K | 255 | 2026-08-29 | `unverified` | Reject |
| `casper-studios/casper-marketplace@liquid-glass` | `npx skills add casper-studios/casper-marketplace@liquid-glass` | 313 | 13 | 2026-09-17 | MPL-2.0 | Reject |
| `petekp/agent-skills@macos-app-design` | `npx skills add petekp/agent-skills@macos-app-design` | 372 | 9 | 2026-06-04 | `unverified`, **archived** | Reject |
| `designnotdrum/skills@macos-hig-designer` | `npx skills add designnotdrum/skills@macos-hig-designer` | 115 | **1** | 2026-02-01 | `unverified` | Reject |
| `alirezarezvani/claude-skills@apple-hig-expert` | `npx skills add alirezarezvani/claude-skills@apple-hig-expert` | 653 | 26,656 | 2026-08-30 | MIT | Inspect only |

### Corrections to the input table

- `wondelai/skills` — input had stars and push as `?`. Verified: **2,273 stars, 2026-09-10, MIT**.
- `designnotdrum/skills` — **1 star**, 2026-02-01, no detectable licence, and the repo contains
  exactly two entries: a `README.md` and a `macos-hig-designer` directory.
- `pbakaus/impeccable` — 71,840 stars (input: 71,839) and **Apache-2.0**, not MIT.
- `jakubkrehel/oklch-skill` and `vercel-labs/agent-skills` both return `NONE` for
  `.license.spdx_id`; recorded `unverified`.
- Found by re-running discovery, absent from the input: `anthropics/skills@frontend-design` at
  **929.2K installs** (most-installed in this space) and `yetone/native-feel-skill` at 1,914 stars
  (most credible macOS-adjacent repo found).

### Verdict and reason, per skill

Install and star counts are in the table above; this is the reason only.

**ADOPT**

- **`vercel-labs/agent-skills@web-design-guidelines`** — a review checklist, not a design opinion,
  so it cannot fight this project's visual system. No detectable GitHub licence, so read it as
  reference material rather than vendoring it.
- **`wshobson/agents@tailwind-design-system`** — the most-installed Tailwind-specific skill by a
  wide margin, in a large multi-harness marketplace with real maintenance. Constrain it with this
  project's rules: it will not know that `shadow-sm` here means the v3 scale.
- **`julianoczkowski/designer-skills@design-tokens`** — small but clean, Apache-2.0, and scoped to
  design-process structure rather than visual prescription. Directly relevant to section 6's ramp
  authoring.

**INSPECT ONLY**

- **`anthropics/skills@frontend-design`** — the highest-adoption skill in the space. Not adopted as
  a dependency because its licence is `unverified`; the obvious thing to read first.
- **`nextlevelbuilder/ui-ux-pro-max-skill`** — pushed today, MIT. Whether its output is
  Tailwind-3.4-safe is exactly what to check before trusting it.
- **`leonxlnx/taste-skill@design-taste-frontend`** — "taste" skills are opinionated by construction:
  useful as critique, dangerous as a default. Its `design-taste-frontend-v1` sibling at 266.4K
  installs suggests version churn worth noticing.
- **`pbakaus/impeccable@impeccable`** — the most precisely scoped entry: `critique`, `audit`,
  `animate`, `colorize`, `quieter`, `normalize` are individual skills with their own install counts
  (83K-85K each), so it can be adopted piecewise. `animate` is the one to check against the
  no-animation-library rule.
- **`alirezarezvani/claude-skills@apple-hig-expert`** — a 40x install-to-star ratio suggests strong
  visibility, weak adoption. Per section 3, Apple's HIG is authoritative only in Apple's own
  documentation; this is a second-hand summary.
- **`yetone/native-feel-skill@native-feel-cross-platform-desktop`** — best-provenance macOS-adjacent
  repo found, from a recognisable OSS maintainer. Scoped to *native* desktop feel, so
  platform-toolkit guidance does not transfer to a web PWA; the perceptual half might.
- **`ehmo/platform-design-skills@macos-design-guidelines`** — the only entry covering Apple HIG,
  Material 3, and WCAG 2.2 across eight platforms, and the most relevant name in the table. But last
  push is **2026-03-19**, over six months stale, and its macOS coverage is one slice of a
  multi-platform pack. Read it; do not depend on it.

**REJECT**

- **`antfu/skills@web-design-guidelines`** — a near-duplicate of the Vercel original. Two copies of
  the same guidance means two sources of truth.
- **`wondelai/skills@ios-hig-design`** — iOS, not macOS. macOS guidance diverges on window
  management, menu bars, pointer behaviour, and density, which is the entire point of this redesign.
- **`jakubkrehel/oklch-skill@oklch-skill`** — no detectable licence. Section 6 covers everything it
  would teach in about forty lines, including a measured Tailwind 3.4 gotcha a general OKLCH skill
  is unlikely to know.
- **`casper-studios/casper-marketplace@liquid-glass`** — the most current subject matter in the
  table: Liquid Glass is the current macOS design language and almost nothing else here covers it.
  Thirteen stars means nobody has stress-tested it. **Read it for vocabulary, do not install it as
  a dependency.** MPL-2.0 is also file-level copyleft, a real consideration if it is ever vendored.
- **`petekp/agent-skills@macos-app-design`** — 9 stars, no licence, and `gh api` reports
  **`archived: true`**.
- **`designnotdrum/skills@macos-hig-designer`** — **1 star**, no detectable licence, two files in the
  repository. A single-star, unlicensed, unmaintained repository cannot be a design authority.

### Is the macOS-specific skill ecosystem strong or thin?

**Thin, and the evidence is unambiguous.** Restricted to skills actually about macOS:

| Skill | Stars | Licence | Status |
|---|---|---|---|
| `yetone/native-feel-skill` | 1,914 | MIT | native desktop, not web |
| `ehmo/platform-design-skills` | 592 | MIT | one slice of a multi-platform pack, 6 months stale |
| `casper-studios/casper-marketplace` | 13 | MPL-2.0 | no adoption |
| `petekp/agent-skills` | 9 | none | archived |
| `designnotdrum/skills` | 1 | none | two files |

Against generic design skills at 178,680 / 131,046 / 90,663 / 71,840 stars, the macOS-specific tier
is **three orders of magnitude smaller**. Every GitHub repo named `apple-design-system` scores
between 0 and 9 stars. The highest-quality macOS design guidance in existence is Apple's own, and
Apple ships it as prose on `developer.apple.com`, not as an agent skill.

**That is the real conclusion, and it is what the project should act on.** A thin third-party
ecosystem means a third-party skill is either a lossy summary of Apple's own documentation or an
unreviewed opinion from a handful of maintainers. Neither is a trustworthy input to a visual system
that has to survive a dark room. The correct move is to **encode Apple's own published guidance
into this project's own skill, cite the source, and treat the third-party skills as optional
critique layers — never as the specification.** The generic skills are worth installing because
they are well-maintained and opinion-neutral; the macOS-specific ones are not, because there is
nothing trustworthy to install.

---

## 8. Recommendation

### Adopt

| Item | Cost | Why |
|---|---|---|
| `lucide-react` | 3,235 B gzip / 15 icons | 24px/2px grid matches SF Symbols geometry. ISC. Measured tree-shaking. |
| `@radix-ui/react-dialog`, per primitive | 13,441 B gzip each | Correct focus management and a11y, zero styling opinion. The only library shape that permits a custom look. |
| OKLCH ramp in `tailwind.config.js`, every token with `/ <alpha-value>` | 0 | Perceptually even dark steps. The `<alpha-value>` rule is mandatory and non-obvious. |
| CSS transitions + `@starting-style` + `transition-behavior` + a one-block `prefers-reduced-motion` override | 0 | `@starting-style` is Firefox 129 / Safari 17.5 — best-supported modern feature on the list. Zero bytes of library. |
| `-apple-system` first in the font stack, Inter kept as shipped fallback | 0 | SF Pro is licence-prohibited (§2B). The look must survive in Inter. |
| `vercel-labs/agent-skills@web-design-guidelines`, `wshobson/agents@tailwind-design-system`, `julianoczkowski/designer-skills@design-tokens` | agent-time only | Opinion-neutral review checklists, not visual prescriptions. |

### Reject

| Item | Reason |
|---|---|
| `motion` anywhere in the authenticated bundle | **Project rule.** 41,846 B gzip measured for one `motion.div`, 35% of the landing budget, to re-implement what `@starting-style` does natively. Not justified at any budget. |
| Scroll-driven animations | `firefox_android: false`, iOS only at Safari 26. Silently inert on the target device. |
| SF Pro self-hosted | Licence §2B forbids non-Apple platforms and forbids embedding. Prohibited, not discouraged. |
| CSS `corner-shape: squircle` | `safari_ios: false`, `firefox_android: false`, `status.experimental: true`. |
| shadcn/ui, Base UI | Correct model but wrong Tailwind version; and an RC `latest` at the highest measured Dialog cost. Revisit both later. |
| Mantine, HeroUI, React Aria | Full styled systems that own the visual language, or too heavy. |
| Tailwind 4 this cycle | `shadow-sm`, `rounded-md`, `ring` all change meaning; floor rises to Safari 16.4 / Chrome 111 / Firefox 128. |
| Phosphor, Material Symbols | Wrong dialect, or a webfont the budget cannot absorb. |
| All macOS-specific agent skills as a dependency | 1-1,914 stars, two unlicensed, one archived. Read, do not trust. |

### Build by hand

- The dark surface ramp: four surfaces, hairline borders, low chroma on neutrals.
- The vibrancy layer: one `backdrop-filter` per screen behind `@supports`, opaque fallback as the
  base rule, because `prefers-reduced-transparency` is `false` on Safari and Firefox Android.
- The motion system: one timing block, one reduced-motion block, `@starting-style` for entries.
- `BackLink` and `IconButton`, replacing 43 inline Unicode glyph sites across 17 files and the
  `← Back to <section>` string duplicated in 8 pages.
- A squircle approximation that does not need `corner-shape`.

### Total runtime dependency delta

```
+ lucide-react@1.48.0                             3,235 B gzip  (15 icons, measured)
+ @radix-ui/react-dialog@1.1.23                  13,441 B gzip  (measured, add per primitive)
                                                  -----------
                                       runtime total  16,676 B gzip
```

**13.9% of the 120 kB landing budget** for a real icon set and one correct dialog. Every other
library on the list costs more than that combined.

Prerequisite: the current build emits a single **232,032 B gzip** chunk, already 82 kB over the
150 kB ceiling. `manualChunks` in `vite.config.js` — splitting React, the router, the Supabase
client, and each feature route — must land first; otherwise the measurement is irrelevant because
nothing is within budget.

---

## Verification Commands

Every figure traces to one of these, run 2026-09-27 or 2026-09-28. All browser-support tables come
from `@mdn/browser-compat-data` queried locally, not from a search engine.

```bash
gh api repos/OWNER/REPO --jq '{stars: .stargazers_count, pushed: .pushed_at, license: .license.spdx_id, archived: .archived}'
gh api repos/lucide-icons/lucide/contents/LICENSE --jq .content | base64 -d
gh api "search/repositories?q=macos+ui+react&sort=stars"          # and ?q=apple+design+system+in:name, ?q=squircle+in:name
npx skills find "macos design" | "apple design system" | "oklch color" | "tailwind design" \
                  | "web design guidelines" | "design taste frontend" | "impeccable design" \
                  | "ios hig design" | "macos hig designer"
npm view <pkg> version license dist.unpackedSize ; npm view @base-ui-components/react dist-tags --json
npx esbuild <entry> --bundle --minify --format=esm --loader:.jsx=jsx \
  --external:react --external:react-dom --external:react/jsx-runtime \
  --define:process.env.NODE_ENV='"production"' --outfile=out.js ; gzip -c out.js | wc -c
npx tailwindcss -c tw.config.js -i in.css -o out.css     # Tailwind 3.4.19 OKLCH behaviour
npx vite build --outDir /tmp/opencode/cemurm-dist --emptyOutDir
grep -rPno '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}\x{25A0}-\x{25FF}\x{26A0}\x{2714}\x{2716}\x{2190}-\x{2199}\x{21B5}\x{266A}\x{266B}\x{25B6}\x{25BC}]' src/ --include=*.jsx
```

**Marked `unverified`, and why:**

- **Individual skill content quality.** No skill was installed or executed. Section 7 verdicts rest
  on provenance, repository metadata, and stated scope.
- **The Tailwind 4 revert.** No evidence in git history. See section 2.
- **`-apple-system`.** No MDN BCD entry; non-standard keyword.
- **Licences `unverified`:** `vercel-labs/agent-skills`, `anthropics/skills`,
  `jakubkrehel/oklch-skill`, `designnotdrum/skills`, `petekp/agent-skills`. GitHub's API reports
  `NONE` for all five. Guessing a licence is not an option. HeroUI is a separate case: Apache-2.0
  in the repository, MIT on `@heroui/react@3.2.6`, unresolved and one reason it is rejected.
- **Not measured:** per-primitive gzip for Ark UI, React Aria, Mantine, and HeroUI. Only Radix
  Dialog, Headless UI Dialog, and Base UI Dialog were bundled, because those three were the genuine
  candidates. Do not read the blanks as zero.
