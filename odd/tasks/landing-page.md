# Landing page — marketing surface for CEMURM

> Unit record for the marketing landing. Plan + team split + slice map.
> Branch: `feat/landing-page` · Base: `main` = `e849738` (2026-10-03)
> Owner of the UI: **Antony-Figueroa** · Backend/logic: **davidjesus516**

## 1. Objective

Ship a real marketing landing as a route in the app: nine sections, dark ramp + one amber
accent, macOS/Apple visual language, under a measured performance budget. The upstream plan's
thirteen were cut to nine, and the count plus the render order are recorded in §10.

## 2. Problem / why now

There is no marketing surface. `/` is `src/features/shell/pages/Home.jsx` — **13 lines**,
one heading, one paragraph, and it renders **inside `AppLayout`**, i.e. wrapped in the
signed-in nav chrome. That is a placeholder, not a landing.

Three constraints make this urgent and non-trivial:

- **The automated safety net for UI is two checks.** No `.jsx` is tested (there is no React
  renderer in the dependency tree) and **no `.jsx` is type-checked** — measured: `npx tsc
  --noEmit --listFiles | grep -c '\.jsx$'` is **0** against 54 `.jsx` files. So `pnpm lint`
  + `pnpm check:visual` are the only automated verification a landing page will ever get.
- **The visual gate was red on `main` for 3 days** (every push since `2026-09-30T02:28`, PR
  #199). PR **#278** pays the ratchets down and is green. **#278 must land first.**
- Ratchets `01b`/`02` are *ceilings*. New UI that adds Tailwind default-palette utilities or
  the four dead accents increases the debt #278 just paid down.

## 3. Upstream source, and one correction

The design plan lives on the **unmerged** branch `feat/cemurm-brand-landing`
(`odd/tasks/cemurm-brand-landing.md`, added in `dfb0fbc`). It is thorough: 13 sections, scope
in and out, design tokens, aesthetic direction, tech stack, and a performance budget with
numbers. Sections referenced below by § are from that document.

**Correction to the upstream plan:** its §7.1 cites `src/lib/supabase.js:3-8` as the Supabase
client. That path does not exist — the client is **`src/data/supabase.js:4-8`**, and that is
where the module-load throw lives. Anyone reading the plan and grepping `src/lib/` will find
nothing.

Where this record states a count, it was measured on 2026-10-03. Where it does not, the number is
inherited from the upstream plan and has **not** been re-verified.

## 4. Scope

### In scope (Antony — build directly)

1. The 13 sections as markup + Tailwind, on the additive token layer.
2. Header + footer, hero **Stage Bus** demo, all prose sections, responsive behaviour.
3. `lucide-react` replacing the emoji/glyph usage; `motion` **landing chunk only**.
4. Variable fonts (`@fontsource-variable/inter` + one variable mono): **872 kB → ~45 kB**.
   Today `src/app/main.jsx:3-6` imports four static Inter weights.
5. Route-level `React.lazy` + vendor chunk via `manualChunks`.
6. PWA manifest, theme-color, icons, real favicon (§7.5).

### Out of scope

| Deferred | Why |
|---|---|
| Refactor of the existing 132 source files (54 `.jsx` + 78 `.js` under `src/`) | gated on landing approval |
| Tailwind 4 migration | changes `shadow-*`/`ring`/`rounded-*` semantics used in 40+ files |
| Final mascot (Kutu) illustration art | an LLM cannot deliver final art |
| App UI strings in Spanish | needs i18n across every UI file |
| ToS, privacy policy, DMCA, contact email | all deferred, checkboxes unchecked — **so the CTA can only be a waitlist** (`docs/copyright-policy.md:231-239`) |
| Pricing tiers | do not exist; the page says "$0 during beta" |

## 5. Team split — the explicit part

**Antony-F Figueroa (UI).** All markup, Tailwind, tokens, motion, copy, responsive, the hero
demo, and **passing data into components**. He defines and freezes the prop shapes the
components accept, so the owner's backend work can land against them without a second design
pass. He does **not** implement logic, schema, or backend.

**davidjesus516 (owner — backend and functions).** Everything on the data path:

| # | Item | Status |
|---|---|---|
| B1 | Decide whether the waitlist CTA needs a **real backend** (table + RLS + migration `0034`) or an external/mailto target | **open — blocks the CTA only** |
| B2 | If B1 is real: migration, RLS policy, and the submit function | blocked by B1 |
| B3 | **Lazy Supabase client** (§7.1) — moving the `src/data/supabase.js` throw from module load to first authenticated use is a **contract change** | **needs the owner** |
| B4 | Any auth/route contract change the landing forces | needs the owner |

### B3, measured — what it actually costs, and why a Proxy will not do it

Measured 2026-10-10 on the built chunks, gzip level 6. `/landing` downloads:

| chunk | gzip | how it gets there |
|---|---|---|
| `vendor` | 77,884 | static from `index` |
| `supabase` | **58,693** | **static from `index`** |
| `motion` | 43,986 | dynamic, from `Landing` |
| `index` | 28,449 | entry |
| `Landing` | 10,731 | dynamic, from `index` |
| | **219,743 B = 214.6 KiB** | budget is ≤120 kB |

The landing never touches Supabase and still pays 58.7 kB for it, because
`router.jsx` imports `AppLayout` and `AuthGuards` statically, both of which reach
the client through `data/repositories/auth.js` and `minors.js` — and `<AuthProvider>`
wraps `<RouterProvider>` at the root, so **every** route mounts it.

Dropping `supabase` alone lands at 157.3 KiB, still over. Dropping `supabase` **and**
`motion` lands at 114.3 KiB, which meets the budget.

**Why a lazy Proxy cannot do it.** `supabase-js` is synchronous after init: the
repository layer calls `supabase.rpc(...)` and reads the result without awaiting
anything. A Proxy that defers the import gives back a Promise, which turns all 16
importing modules async. The only shape that preserves the sync contract is a
dynamic `import()` resolved **before** the repositories run — which means moving the
guarantee to a mount boundary, not into the client module.

**The low-risk shape, and its cost.** Put `/landing` outside `AuthProvider`, the
same way `/external-display` and `/overlay/:token` already sit outside `AppLayout`.
That is a router restructure, and it changes *when* a missing-env throw fires for
every authenticated route. That is exactly what B3 is, and it stays with the owner.

**Neither side blocks the other.** Every section except the CTA form renders with static
content, so the landing can be built and reviewed in full while B1–B4 are open. The CTA is
designed against a frozen prop shape and wired when B2 lands.

> B3 is the one that looks like UI work and is not. Making the client lazy changes when a
> missing-env error throws. That is a behaviour contract, so it belongs to the owner.

## 6. Open decision — route placement

Today `/` is `Home` inside `AppLayout` (nav chrome). A marketing landing must sit **outside**
`AppLayout`. The repo already has the pattern with its reasoning written into
`src/app/router.jsx`: `/external-display` and `/overlay/:token` are top-level route objects
outside `AppLayout` and outside the auth guards.

| Option | Consequence |
|---|---|
| **A — landing replaces `/`** | best SEO and the honest marketing root, but `Home` disappears and the nav's "Home" link must be retargeted. Touches signed-in UX |
| **B — landing at a new path, `/` stays** | zero risk to the app, nothing to retarget. Weaker as a marketing root |

Not decided. **Antony decides**, with the owner's nod, because option A changes signed-in
navigation.

## 7. Slices

Each slice is its own PR, ≤400 changed lines. `pnpm check:visual` must pass on every one.

| ID | Slice | Depends on |
|---|---|---|
| **L0** | This plan + team split | ✅ `e74667e` |
| **L1** | Token layer, route outside `AppLayout`, section scaffold, header + footer | ✅ landed |
| **L2** | Hero Stage Bus demo (the one memorable thing) | L1 |
| **L3a** | Framing sections: `problema`, `alcance` | L1 |
| **L3b** | `ciclo` — the one scroll-driven section | L1 |
| **L3c** | `split`, `limites`, `offline` | L1 |
| **L3d** | `organizacion`, `precios`. `faq` deferred — needs a human | L1 |
| **L4** | Section 6 (Stage Bus) + section 8 (capacidades by role) | L1 |
| **L5** | Code splitting: `React.lazy` + vendor chunk | L1 |
| **L6** | CTA wiring (B1/B2) + fonts, PWA installability, favicon (§7.5) | L1; **B3** for the Supabase client |

**L3 was split three ways and L4 took its own slice.** The plan's L3 was "prose sections 3–5,
7–13" — ten sections in one PR, which cannot fit the 400-changed-line convention. It became
L3a/L3b/L3c/L3d, each measured on its own. **Fonts and PWA work moved out of L5 into L6**:
L5 is the code-splitting prerequisite and nothing else, so its diff stays small enough to
review as wiring rather than mixed with font and manifest decisions.

**L1 delivered less than this table promised.** It was scoped to include the additive token
layer; that part was **not built**, because adding keys to `tailwind.config.js` was outside the
allowed edit surfaces and because it is a visual decision that should be deliberate rather than
a side effect. See D1.

### Decisions L1 raised

**D1 — RESOLVED: the reference's §5.2 scale is adopted.** Committed in the same slice. L2–L4 can
now use real radii.

| token | px | class | §5.2 assigns it to | min height |
|---|---|---|---|---|
| `radius-xs` | 4 | `rounded-cem-xs` | tag, key badge, small chip | fixed |
| `radius-sm` | 8 | `rounded-cem-sm` | text input, icon button, segment, menu row | 32 |
| `radius-md` | 12 | `rounded-cem-md` | button, list row, toolbar control, tab item | 44 |
| `radius-lg` | 16 | `rounded-cem-lg` | card, panel, setlist block, dialog body | 88 |
| `radius-xl` | 22 | `rounded-cem-xl` | sheet, modal, popover, command surface | full-bleed on one edge |

**Named `cem-*` tokens, never Tailwind's default radius classes.** The defaults collide *in
meaning*: `rounded-md` is 6px where §5.2's `radius-md` is 12px, and §5.2 assigns that token to
buttons. `radius-xl` = 22px matches no Tailwind step at all (`rounded-3xl` is 24px). Verified in
the built CSS that the defaults are untouched — the trap stays visible.

§5.2 states outright that **Apple publishes no numeric radius**, so this scale is a
`[CEMURM DECISION]` and adopting it is legitimate. The scale in
`skills/cemurm-visual-system/assets/tokens.css` (4/6/10/14/20) is **not** adopted.

### What L2–L4 must not forget (all from §5)

1. **Same component class, same radius, always.** A per-instance radius is forbidden. Six named
   tokens exist so there is no excuse for a one-off value.
2. **The min heights above are a reviewer rule, not a token rule.** `border-radius` carries one
   number; "min height 44" is a relation between that number and the element's box, and no gate
   can see the relation. Check it by eye.
3. **A card's radius may not exceed a control on it by more than 4px.** A `radius-xl` sheet
   holding `radius-xs` badges reads as broken.
4. **Never exceed one third of the short edge.** `rounded-full` on a 44px control is a pill, not a
   button. Note there is **no `cem-full`** — reach for `rounded-full`.
5. **Horizontal row → capsule; vertical stack → rounded rectangle.** Verbatim Apple.
6. **Capsule is for the primary standalone action only.** "A screen with three capsules has no
   primary action."
7. **Tier 1 takes min-height 44; tier 3a takes 48.** Not a conflict — §7.4 deliberately raises
   every radius and min-height by 4px for a tablet clamped to a stand.
8. **Stage mode must not consume these tokens.** §5 rule 7 raises every token by 4px and caps
   `radius-xl` at 28px, so `rounded-cem-md` there would be wrong by 4px. The stage scale belongs
   in `references/tier-3-performance-surfaces.md` and is not encoded.

Two inconsistencies inside §5.2 itself, resolved in favour of the table:

- **Rule 1's formula cannot produce `radius-xs`.** It clamps a derived radius to `[8, 22]`, so
  4px never falls out of `0.28 × min(w,h)`. `radius-xs` is legitimate only via the table's
  "fixed" note.
- The formula's clamp ceiling of 22 and the table's `radius-xl` of 22 agree, but rule 7's 28px
  stage cap does not exist in the table. Stage owns it.

**D2 — "El ciclo del servicio" → "El ciclo del culto".** Upstream §8.1 titles the section "El ciclo
del servicio"; §8.3 bans `servicio` for a worship service because it is ambiguous for a church
audience and sanctions *culto* / *junta*. The two collide on exactly this section. The hard rule
won; it is one string in `landing.es.js:76` if the literal title is wanted instead.

**D3 — the `cue` ban cannot be enforced naively.** `grep cue` matches **"frecuentes"**. Any check
needs `\bcue\b` *and* must exclude comments, or it flags both that and the very comment that
documents the ban. Separately, upstream §8.3 claims `cue` has "zero occurrences across all 45
feature files" — true of `features/`, false of the repo: it is live in
`docs/propuestas/live-engine-sesion-en-vivo.md` and `docs/architecture-current.html`.

**D4 — no renderer means an invalid utility is undetectable.** A `.jsx` class that does not exist
emits no CSS, no build warning, no lint error and no gate hit, because the gate greps class
*names*. A `backdrop-saturate-180` was written and caught only by auditing every static class
against the built stylesheet (Tailwind's scale stops at 150). For a repo whose entire UI
verification is `lint` + `check:visual` + `build`, an invalid utility is indistinguishable from a
valid one. Consider a rule that greps each `className` token against the emitted CSS.

**D5 — the ratchets have ZERO headroom.** After #278, `01b` sits at 5/5 and `02` at 234/234. A
single use of `cem-rose`, `cem-emerald`, `cem-sky` or `cem-coral` in L2–L4 **fails** the gate
rather than warning. This constrains every later slice's colour choices.

**D6 — upstream §5.3/§9.4 contradict the skill.** The plan demands "Zero `border-radius` in the
page structure"; the skill's reference explicitly replaces that mandate and `AGENTS.md` names the
plan's §5–§6 as superseded for visual decisions. The skill wins. Worth correcting in the plan text
so the next reader does not "restore" zero radius.

## 8. Performance budget (§7.7) — acceptance criteria

| Metric | Today | Target |
|---|---|---|
| JS gzip, first visit (landing) | 234 kB | **≤ 120 kB** |
| Largest single chunk | 855 kB raw | ≤ 150 kB gzip |
| Font payload | 872 kB / 56 files | ≤ 45 kB / 2 files |
| LCP, 4G throttle, mid-tier Android | unmeasured | < 2.0 s |
| CLS from fonts | unmeasured | 0 |
| Non-user-triggered motion moments | — | 1 |

**Motion policy, load-bearing:** no animation library in the authenticated bundle. Not one.
CSS-native motion first (View Transitions, `animation-timeline: view()`, `@starting-style`),
all behind `@supports` guards for Firefox.

## 9. Micro-interaction guide

A decision procedure, not a catalog. Both source libraries ship their components as
**copy-paste source**, so a component costs zero bundle bytes — only the technology underneath it
costs anything. Decide the technology first, then pick the component.

### 9.1 The rule

| The interaction is | Use | Cost |
|---|---|---|
| section enters / leaves the viewport | `animation-timeline: view()` + `@supports` | 0 |
| element enters for the first time | `@starting-style` + a transition | 0 |
| route / page change | View Transitions API | 0 |
| press, hover, focus feedback | Tailwind transitions | 0 |
| **orchestrated state** (the hero's role rotation) | `motion` — landing chunk only | ~18 kB |
| scroll-jacking, parallax on a container, physics | **nothing** — refuses the brief | — |

The fifth row is the only one that costs, and §7.7 budgets **one** non-user-triggered motion
moment. Everything in rows 1–4 reacts to the user.

### 9.2 Per section

Only two sections need motion. Everything else is text, and text that competes with motion is text
nobody reads.

| Section | Needs | Technology |
|---|---|---|
| **hero** | role rotation, orchestrated | `motion`, landing chunk only |
| **el ciclo** (5) | sequence highlighting as it scrolls | `animation-timeline: view()` |
| all others | nothing | — |

The hero is the single memorable thing. Spend the budget there and nowhere else.

**The table above was written for the pre-rewrite page and no longer describes the code.** All
three gaps are recorded here instead of being edited away, because closing them is a §7.7 budget
call for the maintainer rather than a documentation fix.

1. `el ciclo` is not one of the nine sections that ship. The component that applied
   `.cem-cycle-rail` has not been imported by a page since `e3e28e2`, and `src/app/index.css`
   keeps that block with no consumer, annotated as a documented pattern rather than as live
   styling.
2. `motion` is imported by eight landing components (IntroLoader, RevealText, MaskedHeading, Hero,
   StageBus, Galeria, Features, Accordion), so "all others: nothing" is not what the code does.
   Row 6 of §9.1 refuses parallax on a container, and `Hero.jsx`'s `MockupStack` applies exactly
   that on scroll.
3. The hero's role rotation was deleted with its component set, so §9.1 row 5's parenthetical and
   §12.3's "(hero rotation)" name nothing any more. `IntroLoader.jsx` claims the single
   non-user-triggered moment §7.7 budgets; `Hero.jsx`'s own header comment still claims it for the
   hero reveal. The two claims cannot both be right.

### 9.3 Hard constraints

- **Firefox has no scroll-driven animations.** Verified. Guard with `@supports` and let it degrade
  — degrading is correct, breaking is not.
- `prefers-reduced-motion` is already handled in `src/app/index.css`. New motion inherits it; do
  not override it.
- Ratchets `01b` (5/5) and `02` (234/234) have zero headroom. One dead accent or default-palette
  utility **fails** the gate. Choose colours before building.
- Verify every Tailwind class against the built CSS. An unknown utility emits nothing and trips no
  check — `backdrop-saturate-180` proved it (see D4).

### 9.4 Where to look, and what is verified

**Verified names** (extracted from Magic UI's raw HTML, so they exist): Shimmer, Marquee, Counter,
Ripple, Meteo, floating-3d-particles.

**Not verified:** the full React Bits and Magic UI catalogs. Both render client-side and expose no
component list in the HTML, so **treat any specific component name as unverified until you open its
page**. Do not copy a name from this file into code on my word.

Browse for examples: `60fps.design` (curated interaction details from top apps). Lifting a
*technique* from there is free; lifting a *component* still means checking its dependency cost.

**Out of scope, deliberately:** three.js via `threeui` (~150 kB, consumes the whole landing
budget), and `metalforge` shaders (churns against CSS-native-first).

`pnpm check:visual && pnpm lint && pnpm build`

`pnpm test` too, though it covers no UI. `pnpm typecheck` is **absent from CI** and covers
zero `.jsx` — do not present it as UI evidence. There is no test to write for a `.jsx`
component: the dependency tree has no renderer.

Before trusting any local result, confirm the toolchain is current — the main checkout's
`node_modules` was stale (Vite 5.4.21 / Vitest 3.2.7 against a lockfile demanding Vite 6.4.3
/ Vitest 5.0.2). `pnpm install --frozen-lockfile` first.

## 10. Progress

### What renders today: nine sections, in order

Counted from `src/features/landing/pages/Landing.jsx` on the `feat/landing-page` branch, not from
the slice names below. `IntroLoader`, `Header` and `Footer` are page chrome, not sections, exactly
as that file's header comment says.

| # | Section | Where it is defined | id |
|---|---|---|---|
| 1 | Hero | `Hero.jsx` | `#hero` |
| 2 | Problema | inline in `Landing.jsx` | `#problema` |
| 3 | Stage Bus | `StageBus.jsx` | `#stage-bus` |
| 4 | Galería | `Galeria.jsx` | `#galeria` |
| 5 | Capacidades | `Features.jsx` | `#features` |
| 6 | Cómo funciona | inline in `Landing.jsx` | `#como-funciona` |
| 7 | Registro | `Registro.jsx` | `#registro` |
| 8 | CTA final | `CtaFinal.jsx` | `#cta-final` |
| 9 | FAQ | `Accordion.jsx` | `#faq` |

**The section names in the L3a to L4 rows below are the pre-rewrite names.** `alcance`, `ciclo`,
`split`, `limites`, `offline`, `organizacion`, `precios`, `roles` and `waitlist` are not sections
of this page: the approved rewrite in `7479e87` cut the upstream plan's thirteen sections down to
the nine above, before any W-slice ran. The rows stay exactly as delivered evidence. Two of them
still read in the present tense and are now stale: the L3d row says `faq` and `waitlist` "remain
empty frames", and `faq` is filled today (six questions with answers, see §12.5) while `waitlist`
was dropped as a section entirely.

| ID | State | Evidence |
|---|---|---|
| L0 | done | `e74667e` |
| L1 | done | 289 added / 0 removed, 6 files |
| L1a | done | radius token layer, `6ec88b0` (D1) |
| L2 | done | hero Stage Bus demo, 398 changed lines |
| L3a | done | `problema`, `alcance` |
| L3b | done | `ciclo` — the scroll-driven section |
| L3c | done | `split`, `limites`, `offline` |
| L3d | done | `organizacion`, `precios`. `faq` + `waitlist` remain empty frames |
| L4 | done | `stage-bus`, `roles` |
| L5 | done | code splitting — see §11. Landing budget **NOT met** (216.51 vs 120 kB), blocked on B3 |
| L6a | done | fonts + PWA — see §12. Font target **NOT met** (94.48 kB / 4 files), CTA **NOT built** (B1) |

### L6 was also split

Fonts, PWA assets and §7.7 verification are assets and config, and they were doable in one
slice. **The CTA is not, and was not attempted** — B1 is undecided and owner-gated, and §8.3
says a CTA must say exactly what happens, so there is nothing honest to render yet.

**L1 verification** (run against the #278 base, where the gate is green):

```
pnpm check:visual   visual contract: OK  (10 rules checked, 0 failing)
pnpm lint           exit 0
pnpm test           307 passed (307), 9 files
pnpm build          exit 0
```

Gate WARNs are all pre-existing at their baseline and none moved: `01b` 5/5, `02` 234/234,
`05b` 13 report-only, `r1` 30 report-only, `r2` 17 report-only.

L1 consumed only existing tokens — `cem.base`, `cem.text`, `cem.secondary`, `cem.amber` — plus
alpha modifiers. **Zero new colour tokens**; `tailwind.config.js` was not touched. `cem-amber`
appears exactly twice: the wordmark and the primary CTA. The header hairline is
`border-cem-text/10`, derived from a token with an opacity modifier rather than hardcoded, which
also keeps it clear of rule 01b (`border-white/*`).

`pnpm typecheck` exits 0 and covers **none** of it — `grep -c '\.jsx$'` on the program is 0. Not
evidence. No `// @ts-check` was added to any `.jsx`, because it is inert there.

Bundle delta: **+3,514 B raw / +1,064 B gzip**. The landing is statically imported, so it lands in
the main chunk; that is what L5's `React.lazy` + `manualChunks` exists to undo. The §7.7 budget is a
whole-landing criterion and is **not** met.

Route is `/landing`, deliberately neutral, because §6 is undecided. It sits outside `AppLayout`
following the existing `/external-display` and `/overlay/:token` pattern.

**Token layer follow-up owed:** `src/app/index.css` also declares the five utilities as plain
rules (`.rounded-cem-md { border-radius: var(--cem-radius-md) }`) because Tailwind is JIT and
emits nothing for a token with zero usages. Once the first component uses these tokens Tailwind
will emit them as well and that hand-written block becomes redundant — delete it then.

---

## 11. L5 — code splitting, measured

`pnpm check:visual` OK 0 failing · `pnpm lint` exit 0 · `pnpm test` 307 passed · `pnpm build` exit 0.
Ratchets unmoved: `01b` 5/5, `02` 234/234.

**What changed.** Every route element in `src/app/router.jsx` is now `React.lazy` behind one
`defer()` helper (`<Suspense fallback={null}>`), and `vite.config.js` declares three
`manualChunks`: `vendor` (react, react-dom, react-router-dom), `motion`, `supabase`.

**Auth behaviour and route order are unchanged.** `AppLayout`, `AuthProvider` and the three
guards stay eager — auth must resolve before any route renders. Every route sits exactly where
it sat, with its own comment intact: the top-level `/external-display` and `/overlay/:token`,
`/guardian/confirm` outside the auth guards, and the `*` catch-all. The `fallback={null}` is
the same blank frame `RequireAuth` already returns while loading, so no new visual state.

### 11.1 Chunk inventory (gzip level 9, as served)

| Chunk | Raw | Gzip |
|---|---:|---:|
| `vendor` | 232.49 kB | **76.20 kB** |
| `supabase` | 221.70 kB | **57.50 kB** |
| `motion` | 123.50 kB | **40.58 kB** |
| `index` (entry: router + AppLayout + guards + AuthProvider) | 95.31 kB | **27.93 kB** |
| `SongDetail` | 43.24 kB | 11.79 kB |
| `Songs` | 36.82 kB | 10.38 kB |
| `ServiceDetail` | 29.76 kB | 7.35 kB |
| `StageMode` | 19.80 kB | 6.07 kB |
| `SetlistDetail` | 21.76 kB | 5.92 kB |
| `Landing` | 15.65 kB | 5.75 kB |
| `Rehearsals` | 12.93 kB | 4.22 kB |
| CSS | 36.78 kB | 6.90 kB |
| *61 further route chunks* | — | *0.20–4.05 kB each* |

`motion` is a single 40.58 kB chunk and **only `Landing` imports it.**

### 11.2 What each route actually downloads

| Route | Chunks | JS+CSS gzip |
|---|---|---:|
| `/landing` | `vendor` + `supabase` + `motion` + `index` + `Landing` + `OverlayView` + `SlideView` | **216.51 kB** |
| `/songs` (signed in) | `vendor` + `supabase` + `index` + `Songs` + `spotify` + `enrichments` + `transpose` + `useSongs` | **184.06 kB** |

### 11.3 The budget: half the targets met, one missed

| Metric | Target | Measured | Verdict |
|---|---:|---:|---|
| Landing JS+CSS gzip | ≤ 120 kB | 216.51 kB | **MISSED by 96.5 kB** |
| Largest single chunk | ≤ 150 kB gzip | 76.20 kB (`vendor`) | **MET** |
| `motion` in the authenticated bundle | 0 | 0 — `/songs` does not reach it | **MET** |

**The gap is almost entirely the Supabase client.** `supabase` is 57.50 kB gzip of the 216.51,
and it is in the landing's first visit because `AuthProvider` → `data/repositories/auth.js`
→ `src/data/supabase.js` imports it eagerly, and `AuthGuards` → `minors.js` imports it a second
time. The chunk carries `realtime`, `postgrest`, `goTrue`, `storage` and `functions`
sub-clients that a visitor who never signs in never calls.

**Removing it is B3, not this slice.** B3 moves the `throw` in `src/data/supabase.js:7-9` from
module load to first authenticated use. That is a **behaviour contract change** — it changes
*when* a missing-env error fires — and it is owned by davidjesus516 (§5 B3). A marketing page
that no-ops a misconfigured build would be worse than a heavy one.

**What would close the gap**, in order of effect and all owner-gated:

1. **B3, lazy client.** Up to −57.5 kB. Lands at ~159 kB: still over 120, so B3 alone is
   necessary and NOT sufficient.
2. **`motion` at 40.58 kB is 19% of the landing.** §7.3 budgets it for the landing chunk and
   §9.1 makes the landing's orchestrated motion the one thing worth paying for, so it stays.
   This is the number to attack if 120 kB must be hit. The lever is `motion/mini` or
   reimplementing a three-step cross-fade in ~20 lines of CSS; both change the motion budget in
   §7.7, which is a product decision, not a build one.
3. **Font payload, still unaddressed.** `main.jsx` imports four static Inter weights; 16 woff2
   files ship today against §7.7's 2-file target. This is §7.4 and moved to L6.
4. The `vendor` chunk at 76.20 kB gzip is the floor no visitor gets under.

### 11.4 What this slice did NOT do

- **No lazy Supabase client.** B3, owner-gated, contract change. See above.
- **No fonts, no PWA manifest, no favicon.** §7.4 and §7.5, moved to L6.
- **No `modulepreload` link added** to `index.html`. Vite already emits correct preload hints
  for the entry's static imports; `index.html` was left byte-identical.

---

**Blocked on:** B1–B2 with the owner for the L6 CTA. **B3 for the §7.7 landing budget.**
**L6 alone remains.**

---

## 12. L6 — fonts, PWA, and the §7.7 verdict

`pnpm check:visual` OK 0 failing · `pnpm lint` exit 0 · `pnpm test` 307 passed · `pnpm build` exit 0.
Ratchets unmoved: `01b` 5/5, `02` 234/234. 62 changed lines excluding binary assets.

### 12.1 Fonts (§7.4)

**Measured before and after, from `dist/assets`:**

| | woff2 files | woff2 bytes | woff files | woff bytes |
|---|---:|---:|---:|---:|
| before | 28 | 386,820 | 28 | 506,108 |
| **after** | **4** | **96,744** | **4** | **124,560** |

A **75% reduction**, and the four `.woff` fallbacks are never fetched by a woff2 browser, so the
payload a real visit pays is the 94.48 kB of woff2.

**What actually changed.** `src/app/main.jsx:3-6` imported the SUBSET-LESS
`@fontsource/inter/{400,500,600,700}.css`, and each of those pulls five subsets in two formats.
Swapping to the `latin-*.css` entrypoints the installed package already ships is a **subset**
change, not a weight change: same family, same four weights, one `src` each.

**`font-display: swap` was already set** by @fontsource — verified by reading
`node_modules/@fontsource/inter/latin-400.css`, which emits it per face. Nothing to add.

**The metric fallback is measured, not estimated.** `public/fonts.css` declares
`Inter Fallback` with `size-adjust: 105.31%`, `ascent-override: 96.88%`,
`descent-override: 24.12%`, `line-gap-override: 0%`. Those four numbers were read out of the
shipped `inter-latin-400-normal.woff2` with fontTools 4.66 (upm 2048, hhea.ascent 1984,
descent -494, lineGap 0, OS/2.xAvgCharWidth 1250) and compared against Liberation Sans, which
is metric-compatible with the `Arial` named in the `src:` (xAvgCharWidth 1187 on the same upm),
giving 1250/1187 = 105.31%. All four weights report identical ratios, so one face covers all of
them. It lives in `public/` and is linked before the app stylesheet so it is parsed before
first paint — the whole point of the face is to be in place before `swap` happens.

**§7.4's variable font is NOT done, and could not be in this slice.**
`@fontsource-variable/inter` is not installed and not in `pnpm-lock.yaml`; installing it means
editing `package.json` and the lockfile, neither of which is an allowed surface here. The four
latin files are 96,744 B against the variable font's ~45 kB, so **≈51 kB is left on the table**
for a slice that may also spend `package.json`.

### 12.2 PWA (§7.5)

**What already existed in `public/`:** only `sw.js` (5,090 B, the offline service worker). No
manifest, no icons, no favicon, no theme-color — `index.html` referenced `/vite.svg`, **which
does not exist in the repo**, so the favicon was a broken reference before this slice.

**Added:** `site.webmanifest` (1,315 B), `mark.svg` (1,632 B), `icon-192.png` (2,650 B),
`icon-512.png` (8,343 B), `apple-touch-icon.png` (2,638 B), `fonts.css` (2,930 B). `index.html`
gained the manifest link, `theme-color` (#0f172a = `cem.base`, already what `body` paints),
the two `apple-mobile-web-app-*` meta tags and `viewport-fit=cover` for safe-area insets.

**The mark is a PLACEHOLDER and says so in three places.** The brand mark has not been designed
— §3 lists it as in scope and §3 defers final mascot art — so `mark.svg` is a rounded square in
`cem.amber` on `cem.base` carrying two bars. Colours are duplicated from `tailwind.config.js`
rather than referenced, because a static SVG in `public/` cannot read a CSS custom property from
the page. **Rule 01a does not apply here and the gate confirms it:** `check-visual-contract.sh:202`
sets `SRC_DIR="src"`, so `public/` is outside the scan path. No threshold was touched.

### 12.3 The §7.7 table, measured

| Metric | Target | Measured | Verdict |
|---|---:|---:|---|
| JS gzip, first visit (landing) | ≤ 120 kB | **215.47 kB** | **MISSED** by 95.5 kB |
| JS gzip, authenticated session | ≤ 150 kB | **183.02 kB** | **MISSED** by 33.0 kB |
| Largest single chunk | ≤ 150 kB gzip | **76.20 kB** (`vendor`) | **MET** |
| Font payload | ≤ 45 kB / 2 files | **94.48 kB / 4 files** | **MISSED** |
| LCP, 4G throttle, mid-tier Android | < 2.0 s | — | **UNMEASURED** |
| CLS from fonts | 0 | — | **UNMEASURED** |
| Non-user-triggered motion moments | 1 | **1** at measurement (the hero rotation, deleted since; see §9.2) | **MET** |
| Runtime dependencies | 5 → 8 | **5 → 6** (`motion` added) | not reached |

**The two UNMEASURED rows are honestly unmeasured.** There is no Lighthouse, no WebPageTest and
no browser in this toolchain, and `pnpm test` covers the domain layer only. A build size is not a
proxy for LCP and I will not present one as one. The CLS mitigation is *implemented and
measured in intent* — the `size-adjust` face is there so the swap should not shift layout — but
"should" is not "measured", and only a real page load settles it.

Note the landing total dropped 216.51 → 215.47 kB: the font change removed no JS, and the CSS
shrank by 1.04 kB gzip because fewer `@font-face` rules ship. **The font work is a payload win,
not a §7.7 JS win.**

### 12.4 The `motion/mini` option — a product decision, NOT taken

`motion` is a single **40.58 kB gzip** chunk that only the landing reaches; `/songs` does not
fetch it (verified by walking the built static import graph). `motion/mini` would measure
roughly 9 kB gzip, a **saving of ~32 kB** — which would take the landing from 215.47 to ~183 kB
and the authenticated row is unaffected either way.

**Not done, deliberately.** `motion/mini` requires `LazyMotion` wrapping and a features bundle,
so it changes §7.7's motion budget — that is a product call, not a build one. And on its own it
does not fix anything: 183 kB is still 63 kB over the landing target. **B3 (−57.5 kB) plus
`motion/mini` (−32 kB) plus the variable font (−51 kB) together land at ~113 kB**, which is the
first combination that actually reaches 120. All three are owner decisions.

### 12.5 The waitlist CTA IS a dead end — reported, not faked

**Re-verified for W4: the original write-up no longer matches the code.** It cited
`landing.cta = { label: 'Unirme a la lista de espera', href: '#waitlist' }`, a `waitlist`
registry entry carrying only `eyebrow` and `title`, and a landing that greps clean for `<form`,
`onSubmit` and a `type="email"` input. None of those three still hold.

**What the code says now.** `landing.cta.href` is `#registro`
(`src/content/landing.es.js:48-51`), `#registro` is a real section, and `Registro.jsx` and
`CtaFinal.jsx` each render a `<form>` with `type="email"` and an `onSubmit` handler. There is no
`waitlist` entry in `landing.es.js` at all.

**What has not changed: there is still no way to join.** B1 is undecided, so nothing sits behind
the form. `Registro.jsx` validates the address locally and then says so in the UI: the success
string is "Correo validado. No se envió nada: este formulario no está conectado.", and
`Landing.jsx` only logs the address. The dead end is no longer silent, because §8.3 forces the
page to state what happens, but the visitor still cannot join. That is B1.

**Still owner calls:** (a) B1 lands and the form posts to a real endpoint; (b) until then, hide the
CTA, which removes the page's only conversion action and is therefore a marketing decision rather
than a build one. A `mailto:` to an address `docs/product-brief.md:89-90` says does not exist
remains ruled out by §8.3.

**`faq` is no longer an empty frame either.** `landing.faq.items` carries six questions with
answers and `Accordion.jsx` renders them, so the second half of the original note here is closed.