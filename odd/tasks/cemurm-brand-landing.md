# CEMURM — Visual Brand + Marketing Landing

Status: planned (feature document, nothing implemented)
Decisions closed: 34 (4 superseded, retained below as history)
Artifact language: English (project convention). Landing copy: Spanish-first.

---

## 1. Objective

Create CEMURM's visual brand from scratch, and apply it to a marketing landing page that lives
as a real route inside the React app. The application refactor of the 108 existing source files
is a **later cycle**, explicitly gated on approval of the landing.

The brand is the deliverable. The landing is its first application and its proof.

## 2. Problem

The repository has **no design system**. This is not a restyling job.

| Fact | Evidence |
|---|---|
| The entire token system is a 39-line Tailwind config: 11 colors, 1 font | `tailwind.config.js:11-35` |
| 6 of those 11 are literal Tailwind defaults (slate-900/800/700/600/50/400) | `tailwind.config.js:13-18` |
| `#0f172a` is a blue-leaning near-black, so the app reads "SaaS", not "dark room" | `tailwind.config.js:13` |
| **Zero shared UI primitives** — no `src/ui/`, no `Button`, no `Card`, no `Modal` | `src/components/**` — all domain-scoped |
| 29 inline copies of the primary button class string | `StageMode.jsx:378` and 28 others |
| 20 copies of the input class, 20 of the list container, 8 empty states, 3 modals, 3 date formatters | see audit in §12 |
| 7 independently re-implemented `StatusBadge`; 2 byte-identical | `GigCard.jsx:11`, `Songs.jsx:22`, `SongDetail.jsx:39`, `Services.jsx:13`, `Rehearsals.jsx:13`, `Organizations.jsx:46`, `RehearsalDetail.jsx:544` |
| **Zero icon library** — 14 sites use emoji/glyphs as icons, same glyph at 3 sizes | `StageMode.jsx:455` vs `PdfChartViewer.jsx:88` |
| Dark-only by force: `color-scheme: dark` on `html`, zero `dark:` variants anywhere | `src/index.css:7` |
| 3 responsive utilities in the whole app vs a 13-link non-wrapping nav | `AppLayout.jsx:57` |
| No focus style on any button or link; 9 inputs remove the outline with no replacement | `SetlistDetail.jsx:437,638,669,748,791` |
| `RequireAuth` returns literal `null` while loading → blank page | `AuthGuards.jsx:12` |
| Favicon is still Vite's default | `index.html:5` |

### 2.1 The one surface with real craft — and the trap

`StageMode.jsx` (811 lines) and `OverlayView.jsx` are the only designed surfaces in the
product: pure black, large type, amber chords, real keyboard control, foot pedal, OBS stream.
They deliberately escape the app shell.

**This is the brand.** A musician alone, standing, in a dark room, phone 40cm from their face.
Everything else is desktop scaffolding.

> **Hard constraint: the redesign must NOT harmonize Stage Mode with the rest of the app.**
> Moving Stage Mode onto `bg-cem-surface` with a `p-4` panel destroys the only differentiated
> moment in the product.

### 2.2 There is an orphaned design document

`docs/design-system.md` is 450+ lines with an approved palette named "Slate & Ember" and states
at `:452,456` that palette and typography are no longer pending a designer. The code never
implemented it, and `docs/ux-spec.md:3,260` says the opposite ("pending designer").

> **Decision: `docs/design-system.md` is superseded. Archive it as history. It is not an input.**

Two lines from it are worth keeping as brand voice, because they are already approved prose:

- `docs/design-system.md:14-20` — *"A professional tool with community soul… Utility, Community,
  Creativity… must feel like a well-organized music binder that happens to be digital."*
- `docs/design-system.md:20` — *"Playful moments are welcome, but the default mode is 'this tool
  respects my time.'"*

## 3. Scope

### In scope

1. Visual brand: palette, typography, spatial scale, grid, motion principles, voice
2. Design system: tokens + shared primitives (`Button`, `Card`, `Panel`, `Badge`, `Modal`,
   `Input`, `EmptyState`, `Table`) + iconography
3. Brand mark / logo
4. Mascot system spec (Kutu) + placeholder SVG — **no final illustration art**
5. The landing page as a real route in the app
6. **Route-level code splitting + vendor chunk split + a lazy Supabase client** (§7.1)
7. **PWA manifest, theme-color, icons, and a real favicon** (§7.5)
8. **Variable fonts**, replacing the 872 kB static-weight payload (§7.4)
9. **An additive token layer** — the new ramp ships alongside the existing tokens and removes
   nothing the app still uses (§7.2)

### Out of scope — explicitly deferred

| Deferred | Why |
|---|---|
| Refactor of the 108 existing source files | Gated on landing approval. **Exception:** code splitting is in scope, because it is a prerequisite for the landing rather than restyling (§7.1) |
| **Tailwind 4 migration** | Decided against. Tailwind 4 changes the meaning of `shadow-sm`, `shadow`, `ring` and `rounded-md`, all of which this repository already uses in 40+ files. Not worth the restyle risk to gain `@theme` sugar (§7.2) |
| Kutu's name and final illustration art | Name deferred to a product decision; an LLM cannot deliver final mascot art |
| App UI strings in Spanish | Requires i18n across 108 files |
| ToS, privacy policy, DMCA agent registration, contact email | All block any CTA that is not a waitlist (`docs/copyright-policy.md:231-239`, all checkboxes unchecked) |
| Pricing model | Does not exist. Landing says "$0 during beta", nothing more |
| `supabase/seed.sql` enrichment | Fixture lives in the content file instead |

## 4. Decisions

### 4.1 Product and market

| # | Decision | Foundation |
|---|---|---|
| 1 | Primary buyer: **national orchestra systems / system directors** | Domain spine is the service week. 7 of 24 authenticated routes are institutional. `docs/propuestas/cemurm-propuesta-para-orquesta-nacional.md` already exists with written scope |
| 2 | **Hero idea: Stage Bus** — one performance, N screens, each with a role | User-declared top implementation priority. Merges three features that have no common name today: External Display, OBS Overlay, congregation projection |
| 3 | The **split** (canonical chart + personal rendering) is the *explanation* of why Stage Bus works | `docs/features-overview.md:63`; `docs/propuestas/cemurm-propuesta-para-orquesta-nacional.md:67` — *"la versión oficial es la fuente de verdad; cada músico tiene su transposición, capo o anotaciones personales sin pisar la versión oficial. Un punto que creemos muy relevante para el mundo orquestal"* |
| 4 | **No competitor names anywhere on the page** | Supersedes decision 5. Every table cell is a publicly auditable claim; the buyer does due diligence. Negative framing carries the same positioning with zero exposure |
| 5 | ~~Two competitive axes: notation editors + gig management~~ | **SUPERSEDED by #4** |
| 6 | **Dedicated, argued "what we deliberately do NOT do" section** | `features/*.feature` Non-Goals blocks. Strongest positioning asset in the repo |
| 7 | **One single framing line** stating the page shows the target beta design | The page claims capabilities not yet built. One sentence neutralizes the credibility gap without creating a status section. Must not become stale — it asserts nothing checkable |
| 8 | **No status / roadmap section** | `docs/mvp-scope.md:215-217` says Hito 5 is unmerged; the tree has migrations through `0028`. Publishing the roadmap publishes a verifiable error |
| 9 | Price: **"$0 during beta" only**. No invented tiers | Only commercial statement in the repo |
| 10 | CTA: **beta waitlist only** | Only CTA with no legal exposure |
| 11 | **Spanish first**, prepared for English | Repo is English-first with no i18n library; see §8.4 |

### 4.2 Visual identity

| # | Decision | Foundation |
|---|---|---|
| 12 | Scope: **brand + full design system** | Repo has none of it |
| 13 | **`docs/design-system.md` is replaced**, not repaired | Supersedes "adopt and repair". Contradicts `ux-spec.md:3,260`; its palette is the "near-black + bright accent" tell |
| 14 | Direction: **dark-first, done properly** | Multi-tone dark ramp, real elevation model, **amber reserved exclusively for the performance surface**. Second accent for the institutional/data layer resolved with *value*, not another color |
| 15 | **Dark identity / light app default** | Resolves a self-created contradiction. Dark: landing, hero, Stage Mode, projection, overlay. Light: planning, printing, office. This is the map of the product's two real contexts |
| 16 | **The landing is dark** | It is the brand declaration. A light landing would show one thing and ship another |
| 17 | Palette applied professionally: **one built dark ramp, one accent, hierarchy by value** | "Keep the colors" done with discipline means *fewer* colors, not more colors used consistently. `coral`, `emerald`, `rose`, `sky` leave the system — no function. `#0f172a`'s blue cast goes away |
| 18 | Type: **Inter for UI/data + one technical monospace as the display face** | Solves two problems: brand personality, and the real bug at `SongDetail.jsx:930` where `font-mono` silently falls back to DejaVu. The reference's ghost-outline treatment works better in mono than in almost anything else |
| 19 | **Kutu stays** | Supersedes "no mascot". Keeps the community-soul angle |
| 20 | Mascot deliverable: **system spec + geometric SVG placeholder** | An LLM cannot deliver final mascot art. Deliverable: name, shape language, construction grid, character palette, required poses, use/non-use rules, compliant placeholder SVG. Final illustration is commissioned separately |
| 21 | Kutu's name: **deferred to a product decision** | Consequence: the landing ships **without** the mascot. The slot is reserved in the content file from day one |

### 4.3 Data, language, delivery

| # | Decision | Foundation |
|---|---|---|
| 22 | Deliverable: **brand + landing now**; app refactor later, gated on landing approval | Cheapest way to validate a visual language before applying it to 108 files |
| 23 | The landing is a **real route in the React app** | Dogfooding: if it lives in the app, the design system must be real |
| 24 | **Curated fixture in the content file** — `supabase/seed.sql` is NOT enriched | Seed has 3 songs and 1 setlist. Consequence: **the landing does not read from the data layer** |
| 25 | Hero fixture: **a verifiable public-domain piece**, 3 instrument projections | Avoids the legal question entirely. A piece a system director recognises buys instant credibility. Precedent: `public_songs` with confirmed licence, CC-BY-4.0 default |
| 26 | Hero mechanism: **scripted interactive demo**, not video | A video is a fixed asset re-recorded on every UI change, and it shows capabilities that do not exist yet — a claim with a timestamp. The demo does two jobs at once: it demonstrates the capability and it lights up the split idea |
| 27 | Hero demo rotation: **three roles — musicians, audience, signal** | The musician/audience contrast is the comprehension moment. Two screens is not a bus |
| 28 | **Radius and volume only in the hero** | The reference has zero radius and zero gradients; the only volumetric things on it are the floating mockups. Structure stays hard-edged. This satisfies the "professional visual image" instinct where it is actually seen, and avoids the SaaS-card-kit tell |
| 29 | Mockups: **we render our own** | `shadcn/ui` Device Frames + a real stage layout inside. Stock mockups cannot demonstrate capabilities that do not exist. No licences, no cost, updatable |
| 30 | **No tablatura promised** | Guitar TAB exists nowhere in the product — not in code, not in the 45 features, not in the schema. CEMURM has ChordPro, PDF scans, and planned MusicXML/ABC. Copy says "acordes, letras y partituras" |
| 31 | Skills: **use what is installed** | `frontend-design` (already loaded — produced the reference analysis), `prototype`, `archify`, `browser`/`playwright` for screenshots and visual self-critique. "Taste Design" and "Emil Kowalski Design" are **not installed in this environment** and must not be simulated |

### 4.4 Architect calls taken without asking

1. **i18n → one content file per locale, landing only.** `src/content/landing.es.js` holding the
   whole copy structure; later `landing.en.js` + a `useLocale()`. No `i18next`, no changes to the
   108 app files. This is the only cheap reading of "prepared for English without suffering".
2. **The landing does not read from Supabase.** Consequence of #24.
3. **The palette is reduced, not extended.** "Keep the established colors" applied professionally
   means fewer colors with more discipline.

### 4.5 Corrections made to my own recommendations

| I recommended | Corrected to | Why |
|---|---|---|
| Light-first as the theme | **Dark** for the landing | Self-created contradiction; identity wins |
| Adopt and repair `design-system.md` | **Replace it** | Its palette is the exact tell `frontend-design` flags |
| A comparison table | **No comparison** | Institutional buyer with due diligence |
| A "live vs coming" status block | **One framing line** | The page asserts unbuilt capabilities; a whole section was more structure than needed |

### 4.6 Alignment with existing outreach proposals

`docs/propuestas/` was checked against this plan.

**Agreements (safe):** "$0 during beta" identical in every commercial doc; the institutional
buyer is already a declared audience; the split is grounded in shipped spec; "agreed key",
"canonical chart", "personal rendering", "readiness", "block", "call sheet", "substitution",
"plan freeze", "fork/lineage", "guardian consent" are all real shipped nouns; the `cue` ban is
correct (zero occurrences across all 45 features); Spanish-first matches 3 of 4 proposals.

**Gaps worth mining into the landing (not yet used):**

| Material | Source |
|---|---|
| Substitute-material projection — the most director-shaped capability in the repo | `cemurm-propuesta-para-orquesta-nacional.md:52` |
| Institutional traceable history: *"Registro histórico de eventos completados (solo lectura) — trazabilidad institucional"* | same, `:47` |
| Rights posture: no scraping, public library CC-BY-4.0, institutional content stays private | same, `:79` |
| The one sharp problem sentence in the corpus: *"cuadernos de papel en la oscuridad, arreglos perdidos en hilos de email"* | `cemurm-revision-para-ingenieros.md:14` |
| The "el acorde concreto es la fuente de verdad; el grado es una vista derivada" epistemic shape | same, `:76` |
| A non-goal with its rationale, the model for §8 | same, `:116` |
| A verifiable multi-sede proof point (Madrid / Lima / Bogotá) | `features/organizational-repertoire-model.feature:36` |

**Do NOT mine these proposals for maturity language.** They say *"fase de especificación avanzada,
sin implementación real"* and *"primer hito ~2 meses"*; Hitos 1–4 shipped weeks ago.

**Do NOT cite this claim** from `cemurm-propuesta-para-orquesta-nacional.md:22`: *"Los
escenarios de prueba del proyecto ya citan explícitamente el Sistema Nacional de Orquestas"*. It
is false — that string appears exactly once in the whole repository: in that line itself.

## 5. Design tokens

### 5.1 Palette

Not the current 11 tokens. **One built dark ramp, one accent.**

- Build a **4–5 step dark ramp**, neutral or very slightly warm. It replaces the borrowed Tailwind
  slate scale. The current `#0f172a` blue cast is removed.
- **One accent: the amber** (`#f59e0b` family). At full saturation **only** on the performance
  surface and one or two accent moments on the page. Everywhere else, a desaturated or
  lower-chroma variant.
- **Hierarchy is carried by value and opacity**, not by a new color per level. The existing
  `elevated`/`hover` tokens become `white/4%` and `white/8%` overlays.
- `coral`, `emerald`, `rose`, `sky` **leave the system.** No function.
- **Ghost-outline text color: `cem.stage.dim` = `#1e293b`** — it already exists at
  `tailwind.config.js:29` and has **zero usages** in `src/`. The system already anticipated this
  technique and nobody executed it. Reuse that value.

### 5.2 Typography

| Role | Family | Notes |
|---|---|---|
| UI and data | **Inter** 400/500/600/700 | Already self-hosted via `@fontsource/inter` (`main.jsx:3-6`). Correct for tables and call sheets |
| Display | **One technical monospace** | Serves as brand display AND as the real mono. Needs a one-line rationale in the spec |
| Mono (data, metadata) | **Same family as display** | Fixes `SongDetail.jsx:930`, where `font-mono` silently falls back to DejaVu |

Self-host both. No Google Fonts link. `font-display: swap` must be configured — it is not today.

Scale follows *The Elements of Typographic Style*: intentional weights, widths, spacing.
Line length under 80 characters. Serif body text is not in play.

### 5.3 Structure

Hard-edged. Full-bleed. No card grid. Asymmetric editorial grid that alternates sides. Zero
`border-radius` in the page structure. Radii and volume are spent in exactly one place: the hero
object. This is *spend your boldness in one place*.

## 6. Aesthetic direction

A visual reference was supplied: a product landing with a near-black ground, one hot accent,
rotated product mockups bleeding off-canvas, giant outline ghost typography as background
texture, full-bleed sections, asymmetric editorial grid, a product carousel, and an accent block
closing the page.

### 6.1 Transfers

| From the reference | How it lands in CEMURM |
|---|---|
| Near-black ground, one hot accent | Already decided: dark-first, amber reserved |
| **Product as hero object, rotated, bleeding off-canvas** | The real Stage Mode / stage layout, at an angle, cropped by the edge. Frames rotate; content stays axis-aligned so the chart remains readable |
| **Giant outline typography as background texture** | Uses `cem.stage.dim`. The token already exists unused |
| Full-bleed, hard edges, no cards, zero radius | Anti-SaaS-card-kit |
| Asymmetric editorial grid, alternating sides | Never everything centered |
| Accent block closing the page | Amber full-bleed footer |
| Product-family carousel | Its functional equivalent is the hero's **role switch** |

### 6.2 Does NOT transfer

1. **The pixel/bitmap typeface.** It works there because that product is consumer hardware with
   retro appeal. A national orchestra system director reads it as "2021 hobby project". The
   distinctiveness must come from the mono display instead.
2. **3D hardware renders with lens flare.** There is no product photography and there will not be.
   An invented mockup is the fastest route to looking like a template. The honest translation is
   better anyway: the hero object is real UI.
3. **Decorative numbered eyebrows** (`DESIGN & CRAFTSMANSHIP · 02`). Legitimate only where the
   content genuinely is a sequence. The service cycle is one. Nowhere else.

### 6.3 Explicitly rejected defaults

Per `frontend-design`: warm cream + high-contrast serif + terracotta; near-black with a single
acid accent; broadsheet hairlines with zero radius; the SaaS-card kit (one radius everywhere,
identical soft shadow, gradient washes); template chrome (tracked-out ALL-CAPS eyebrows,
middle-dot meta strings, `WORD — fragment` labels, `→` on button text).

Motion: **one** orchestrated page-load moment, nothing else non-user-triggered. No fade-and-slide
on every section. No hover transition on every card. `prefers-reduced-motion` respected.

## 7. Technology stack and performance budget

Baseline measured from `pnpm build` on `main` — facts, not estimates:

```
dist/assets/index-*.js     855.23 kB raw  →  234.37 kB gzip
dist/assets/index-*.css     30.42 kB raw  →    5.98 kB gzip
JS chunks: 1        CSS chunks: 1        ← no code splitting
Fonts: 56 files → 872 kB
   ├─ latin woff2 (the only part needed):  234 kB
   └─ cyrillic + latin-ext + .woff:       656 kB  ← dead weight
```

Vite already warns: *"Some chunks are larger than 500 kB after minification."*

**The premise this replaces.** The landing is not a separate place — it is a route inside the
single app bundle. `vite.config.js` is 6 lines with no `manualChunks` and no lazy routes, and
`src/App.jsx:92` wraps the entire router in `AuthProvider`, which imports `src/lib/supabase.js`.
So an anonymous visitor to the landing today downloads the whole app: the moderation queue, the
Planning Center client, the MIDI client, the PDF pipeline, and the Supabase client — the largest
dependency in the chunk, which a fixture-driven landing page with a waitlist CTA does not need at
all. And the reverse: a heavy landing library ships to every authenticated user, including a
musician on a 2018 tablet in a rehearsal room.

**The fix for "must be fast" is splitting the bundle, not keeping the landing small.** After
splitting, the landing can be as expressive as it needs without the app paying for it.

### 7.1 Code splitting — in this cycle

| Change | Why |
|---|---|
| `React.lazy` on the router's route elements | Highest-return change in the project. Splits the app into ~8–12 chunks |
| `build.rollupOptions.output.manualChunks` for `react`, `react-dom`, `react-router-dom` | A stable vendor chunk that is never re-downloaded |
| **Lazy Supabase client** | The landing does not need it. Today it is the largest item in the chunk, shipped to a visitor who never signs in |

Note on the Supabase change: `src/lib/supabase.js:3-8` **throws at module load** when
`VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing. Making the client lazy changes that
contract — the landing must render without the env vars being present, and the throw must move to
first authenticated use.

### 7.2 Tailwind stays on 3.4, and the token layer is additive

**Decision: no Tailwind 4 migration. Stay on 3.4.19.**

The benefit is concrete. Tailwind 4 changes the meaning of four classes this repository already
uses across 40+ files:

| Class | Tailwind 3 | Tailwind 4 would become |
|---|---|---|
| `shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | what `shadow` used to be |
| `shadow` | alias of `shadow-sm` | renamed `shadow-xs` |
| `ring` | 3px default | 1px default, and a `box-shadow` |
| `rounded-md` | fixed scale | derived from `--radius-*` in the theme |

Current usage: `shadow-sm` in ~20 panels, `shadow` at `AppLayout.jsx:51`, `Auth.jsx:160`,
`GuardianConsentRequired.jsx:88`, `ring-1` across several forms. On 3.4 none of these move, and
**no visual baseline is needed**.

**The tokens still belong in CSS custom properties.** Tailwind 3.4 supports this fully: the
values live in `:root` in `src/index.css`, and `tailwind.config.js` maps names to `var(--cem-*)`.
The config can only point *at* CSS, never read out of it — and that is a feature, not a
limitation: the app becomes re-themeable by changing one CSS value per token, which is exactly
what decision 15 (dark identity, light app default) will need when the refactor cycle lands.
`StageMode.jsx` and `OverlayView.jsx`, which write raw `bg-black` and `text-white/NN` today and
cannot consume a JS token object, can read `var(--cem-*)` directly.

**The token layer must be additive. This is not a preference.**

Tailwind's JIT only emits the classes it finds, so **deleting a token kills every class that
references it**. Measured against the current `src/`:

| Token | Usages | Files |
|---|---|---|
| `cem.coral` | **0** | 0 |
| `cem.sky` | 7 | 4 |
| `cem.hover` | 1 | 1 |
| `cem.emerald` | 68 | 15 |
| `cem.rose` | 176 | 32 |
| `cem.amber` | 350 | 36 |
| `cem.secondary` | 315 | 40 |
| `cem.elevated` | 370 | 36 |

> **Only `cem.coral` is safe to remove: 0 usages.** Every other token stays until the refactor
> cycle has migrated the app, at which point they can be deleted in one deliberate pass.

The new ramp ships under new names and is consumed only by the landing. Nothing existing changes.

### 7.3 Dependencies

**Runtime: 5 → 8.**

| Add | Size | Scope |
|---|---|---|
| `motion` (vanilla core, WAAPI-based) | ~18 kB | **Landing chunk only.** Interactive state of the hero demo and layout transitions |
| `lucide-react` | ~1 kB/icon | Shared. Replaces the 14 emoji/glyph sites |
| — | — | No new runtime dependency for the authenticated bundle beyond the two above |

**Motion policy, and this is the load-bearing one:**

> **No animation library in the authenticated bundle. Not one.**

The app's motion needs are: CSS hover/focus transitions, and an 80 ms-or-instant song change in
Stage Mode. A 40 kB animation runtime in a PWA that must work **offline, on a tablet, in a dark
room, live** is a trade against the constraint the project itself calls its defining property
(`docs/technical-spec.md:523`).

**CSS-native motion comes first — it is free.** View Transitions API, `animation-timeline: view()`
for scroll-driven animation, `@starting-style` for entry. Zero bytes, GPU-composited. All behind
`@supports` guards for Firefox, which is the weak spot.

### 7.4 Typography payload

`@fontsource-variable/inter` + one variable mono, **latin subset only**, replacing the four static
weight imports at `src/main.jsx:3-6`. `872 kB → ~45 kB`. `font-display: swap` must be configured
(it is not today) and a `size-adjust` fallback declared to keep CLS at zero.

### 7.5 PWA installability

Hand-written, no `vite-plugin-pwa` and no Workbox. The existing `public/sw.js` is per-category,
versioned, and tested — Workbox would rewrite a working file. The blocker is the manifest, not the
service worker: add `manifest.webmanifest`, `<link rel="manifest">`, `theme-color`,
`apple-touch-icon`, a real icon set, and replace Vite's default favicon at `index.html:5`.

### 7.6 Deliberately not added

| Not | Why |
|---|---|
| Framer Motion in the app | 40 kB for hover transitions. No budget for that on a stage device |
| GSAP | 70 kB core, imperative. Four keyframes and two transitions are needed |
| Lottie | 250 kB runtime for designed vector animation |
| Lenis / smooth scroll | Scroll hijacking and an accessibility cost |
| Three.js / WebGL | The OBS overlay is DOM text and must run on a 2015 tablet |
| `i18next` | One content file per locale covers the whole landing |
| `react-hook-form` | One field. `useState` and a `fetch` |
| Zustand / Redux / TanStack Query | Already decided in the repo, and correctly: Context + hooks |
| Analytics | Would block publication — there is no privacy policy |
| `vite-plugin-pwa` / Workbox | See §7.5 |

### 7.7 Performance budget

| Metric | Today | Target |
|---|---|---|
| JS gzip, first visit (landing) | 234 kB | **≤ 120 kB** |
| JS gzip, authenticated session | 234 kB | ≤ 150 kB |
| Largest single chunk | 855 kB raw | ≤ 150 kB gzip |
| Font payload shipped | 872 kB / 56 files | **≤ 45 kB / 2 files** |
| Runtime dependencies | 5 | 8 |
| LCP on 4G throttle, mid-tier Android | unmeasured | < 2.0 s |
| CLS from fonts | unmeasured | 0 |
| Non-user-triggered motion moments | — | 1 |

## 8. The landing

### 8.1 Structure — 13 sections

| # | Section | Notes |
|---|---|---|
| 1 | Header | Mark, minimal nav, waitlist CTA. Sticky, visually light |
| 2 | **Hero — Stage Bus** | Scripted interactive demo, 3 rotating roles. **The single memorable thing** |
| 3 | El problema | 3 points, no cards. Borrow the corpus's sharpest sentence |
| 4 | Qué es y qué no | One line: the digital music binder. Negative framing: not a notation editor, not a gig-management app |
| 5 | El ciclo del servicio | lifecycle → rehearsal → plan freeze → performance → substitution → projection. **Numbered — it genuinely is a sequence** |
| 6 | **Stage Bus** | New section, placed after the cycle because Stage Bus is the transversal capability that enables every step. Three roles defined, with the one-line definition the coined term requires |
| 7 | El split | The canonical chart / personal rendering model. Why one shared arrangement serves N musicians without forking. This is the section the engineer proposal already argues in one line at `…-orquesta-nacional.md:67` |
| 8 | Capacidades por rol | Director de sistema / director de orquesta / músico / instructor |
| 9 | Institucional y multi-sede | system → org → branch, roles, minors with guardian consent |
| 10 | **Lo que no hacemos** | The declared non-goals, each with its reason |
| 11 | Offline y datos | What works without a connection and what does not |
| 12 | Precios | "$0 during beta". No invented tiers |
| 13 | FAQ | 6 real questions from a system director |
| — | Footer | Waitlist CTA, MIT licence, repo link. **No email — none exists** (`docs/product-brief.md:89-90`) |

Placement rationale: the cycle is sequential, so Stage Bus follows it as the enabling capability
rather than being folded into the sequence — it is infrastructure, not a step.

### 8.2 Hero demo spec

- Object: a real stage layout rendered from the fixture, inside a `shadcn/ui` Device Frame,
  rotated and cropped by the canvas edge. Sits on the hard-edged page.
- Rotation: **three roles** — *músicos* (chords over lyrics, personal key), *público* (lyrics
  only, high contrast), *señal* (title, position in setlist, broadcast-safe: never personal
  annotations).
- The switching is the demo. One orchestrated moment on load, then the user controls it.
- Depth cue: sibling "screens" recede in scale and opacity. One element is in focus.
- Content: a verifiable public-domain piece with three instrument projections.
  **The designer must verify public-domain status at source (IMSLP) and record the citation
  before shipping.** Do not assert a licence without checking it.
- Frame rotation does not rotate text. Charts stay readable.

### 8.3 Copy rules

- **Vocabulary, reused exactly** — never invented: repertoire, chart (*chord chart, not a
  graph*), canonical chart, personal rendering, setlist, agreed key, transpose, capo, section,
  degree, readiness, annotation, collaborator, bandmate, rehearsal, gig, performance record, org,
  branch, system repertoire, service (*a worship service — never "SaaS service"*), block, call
  sheet, plan freeze, substitution, part (*a musical part*), collection, fork/lineage, public
  library, guardian consent, Stage Mode, practice view, audience view, overlay, Stage Bus.
- **Banned**: `cue` (not a shipped concept — zero occurrences across all 45 feature files).
  Do not use "service" to mean a SaaS service. Do not use "chart" to mean a graph.
- "service" in Spanish is ambiguous for a church audience — use *culto* or *junta*.
- "repertoire" is singular. The brand expands to "Repertories" in the name only.
- Plain verbs, sentence case, active voice. A CTA says exactly what happens: "Unirme a la lista
  de espera", not "Enviar". An action keeps its name through the whole flow.
- No invented tiers, no invented numbers, no invented institutional proof points.
- The single framing line appears once, near the CTA or in the hero. It must not assert anything
  checkable, so it never goes stale.

### 8.4 i18n structure

`src/content/landing.es.js` holds the entire copy structure — every string in the landing comes
from it. Later: `landing.en.js` + a `useLocale()` hook. No i18n library. No changes to app files.
Slots for the mascot are reserved from day one.

## 9. Acceptance criteria

1. `pnpm typecheck && pnpm lint && pnpm build` all pass. **typecheck is not in CI**
   (`.github/workflows/ci.yml` runs lint + build only) — it must be run locally.
2. The new route renders and is reachable.
3. Every landing string resolves from `src/content/landing.es.js`. No hardcoded copy in JSX.
4. **No `border-radius` and no gradient in the page structure.** Both appear only in the hero.
5. Palette check: `coral`, `emerald`, `rose`, `sky` are gone from `tailwind.config.js`.
6. Full amber saturation appears only on the performance surface and its declared accent moments.
7. A real monospace family is configured and `SongDetail.jsx:930` no longer falls back.
8. Visible keyboard focus on every interactive element. `prefers-reduced-motion` respected.
9. Responsive: the hero object, the demo rotation, and the cycle section all hold from 375px up.
   The 13-link non-wrapping nav problem of `AppLayout.jsx:57` is not reproduced.
10. Exactly one non-user-triggered motion moment on page load.
11. The public-domain piece used in the fixture is verified at source and the citation is
    recorded in the file.
12. Reduced-motion and keyboard-only paths are exercised and reported, not assumed.
13. **Stack acceptance criteria:**
    - `pnpm build` produces more than one JS chunk, and the largest chunk is ≤ 150 kB gzip.
    - Gzipped JS for the landing route is ≤ 120 kB; for an authenticated session ≤ 150 kB.
    - The landing route does not pull the Supabase client into its chunk.
    - `pnpm build` ships ≤ 2 font files totalling ≤ 45 kB, latin subset only.
    - The authenticated chunk contains no animation library.
    - `public/manifest.webmanifest` exists, is linked from `index.html`, and declares a
      `theme_color` matching the new palette. Installing the app on a device works.
    - `index.html` no longer references Vite's default favicon.
    - Tailwind is **still v3.4**, and every existing class still compiles. `cem.coral` is gone
      (0 usages). `cem.emerald`, `cem.rose`, `cem.sky`, `cem.secondary`, `cem.elevated`,
      `cem.hover` and `cem.amber` are all **intact**.
    - A `grep -roE 'cem-(coral|emerald|rose|sky|secondary|elevated|hover|amber)\b' src/` before
      and after the token work returns **identical counts**, except that `cem.coral` goes to zero.
      This is the check that replaces a visual baseline.
    - The new ramp lives in `:root` in `src/index.css` and is consumed through
      `var(--cem-*)` in `tailwind.config.js`. No new token value is hardcoded in the config.

## 10. Verification

### 10.1 Functional

There is **no test framework in this repo** (`AGENTS.md:19`). Baseline verification is:

```
pnpm typecheck && pnpm lint && pnpm build
```

Plus, for this work specifically: browser screenshots at mobile / tablet / desktop widths,
keyboard-only traversal of the hero demo, and `prefers-reduced-motion` verified in the browser.

### 10.2 Playwright — landing only

`Playwright` + `@axe-core/playwright`, scoped to the landing route. Six visual snapshots
(mobile 375, tablet 768, desktop 1440) plus an accessibility pass in the same run. This is the
minimum that makes acceptance criteria 9 and 12 verifiable rather than "checked by eye".

It does **not** cover the authenticated app. See §10.3.

### 10.3 Token-change regression check — required

Because §7.2 removes `cem.coral` and **nothing else**, and because Tailwind's JIT drops classes
whose token no longer exists, the regression check is a grep rather than a screenshot comparison:

```
grep -roE 'cem-(coral|emerald|rose|sky|secondary|elevated|hover|amber)\b' src/ | sort | uniq -c
```

Run it before and after the token work. Every count must be identical except `cem.coral`, which
must go to zero. If any other count changed, existing screens have lost styling — that is a
regression, not an improvement.

This check is mandatory because the failure it guards against is invisible: a panel without its
border still renders, it just renders wrong.

## 11. Route

**This is not one PR.** At ~400 changed lines per PR it is four. The repository convention is
chained slices with a `-prN-` suffix, on a shared `feat/` branch
(precedent: `feat/hito-3-notifications`, `feat/ts-checkjs-baseline`).

| Slice | Content | Visual risk |
|---|---|---|
| **PR 1** — `feat/cemurm-brand-landing-pr1-performance` | Route code splitting, vendor chunk, lazy Supabase client, variable fonts (§7.1, §7.4) | **None.** No class changes meaning |
| **PR 2** — `-pr2-pwa` | Manifest, `theme-color`, icon set, real favicon, Playwright harness (§7.5) | **None.** Closes a false claim |
| **PR 3** — `-pr3-tokens` | Additive token layer in `:root`, primitives, `lucide-react` (§7.2, §4, §5) | **Low.** Additive only; the §10.3 grep proves it |
| **PR 4** — `-pr4-landing` | The 13 sections, the hero demo, the mascot spec, the mark | **None to the app.** Landing is a new surface |

PRs 1 and 2 are prerequisites with no design risk and are independently valuable — PR 2 alone
closes the "not installable" claim. Merging them first means the landing lands on a fast,
installable base.

1. ~~Write this feature document~~ (done — this file)
2. Write the master design prompt, structured as the user requested: **agent role / context and
   technology / page description and structure / expected result**, plus tokens, aesthetic
   direction with the reference applied, the skill set, acceptance criteria, and the line budget
   (done — `docs/prompts/brand-landing-master-prompt.md`)
3. Execute PR 1 → PR 2 → PR 3 → PR 4, in that order
4. Review the landing against §9
5. Only then: propose the app refactor as its own cycle, and only then delete the legacy tokens

## 12. Evidence appendix

Key anchors used to build this brief. All read-only.

| Claim | Source |
|---|---|
| Token system is 11 colors + 1 font, 6 borrowed from Tailwind | `tailwind.config.js:11-35` |
| Ghost-outline color already defined, unused | `tailwind.config.js:29` (`cem.stage.dim`, 0 usages) |
| Dark-only forced, light unreachable | `src/index.css:7` |
| Mono falls back to DejaVu | `src/pages/SongDetail.jsx:930` |
| Stage Mode is the crafted surface | `src/pages/StageMode.jsx:389` |
| Overlay is chrome-free and annotation-free | `src/components/overlay/OverlayView.jsx:60-63` |
| Landing placeholder is 13 lines | `src/pages/Home.jsx` |
| Service = worship service, not SaaS | `features/service-planning.feature:1-4` |
| Split is shipped spec, not invention | `features/personal-preferences-and-adaptations.feature:1-4,151-162,183-194` |
| Split argued in one line for the orchestral buyer | `docs/propuestas/cemurm-propuesta-para-orquesta-nacional.md:67` |
| Substitute-material projection | same, `:52` |
| Institutional traceable history | same, `:47` |
| Rights posture, no scraping, CC-BY-4.0 | same, `:79` |
| The sharpest problem sentence in the corpus | `docs/propuestas/cemurm-revision-para-ingenieros.md:14` |
| Non-goals with rationale | same, `:116` |
| Guardian consent is an institution-facing feature | `features/minors-and-guardian-consent.feature:1-4` |
| Multi-sede proof point (Madrid/Lima/Bogotá) | `features/organizational-repertoire-model.feature:36` |
| No legal/compliance work started | `docs/copyright-policy.md:231-239` |
| Contact placeholders unfilled | `docs/product-brief.md:89-90` |
| PWA not installable | `index.html:1-14`, `public/` contains only `sw.js` |
| Roadmap status is self-contradictory in the repo | `docs/mvp-scope.md:215-217` vs migrations through `0028` |
| typecheck absent from CI | `.github/workflows/ci.yml:23-27` vs `package.json:12` |
| 45 feature files, not 42 | `features/*.feature` (the "42" figure is stale repo-wide) |
