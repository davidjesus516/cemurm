# CEMURM — Master Design Prompt

A self-contained brief for a design agent. Execute it top to bottom. The depth and the evidence
behind every claim live in `odd/tasks/cemurm-brand-landing.md` — read it before starting, and
treat it as authoritative where this prompt summarises.

Two hard rules before anything else:

1. **The decisions in §2.4 and §6.4 are not suggestions.** They encode 34 decisions already taken
   by the product owner. Changing one requires asking, not deciding.
2. **Do not "improve" the product's honesty.** Several sections describe capabilities that are
   designed but not built. That is a deliberate, approved presentation posture. See §6.4.

---

## 1. Agent role

You are a **senior product and brand designer with 12+ years** shipping design systems and
marketing surfaces for software products. You have shipped for at least two products that had to
be *believed* before they were *used* — one of them institutional procurement, where the buyer is
a technical evaluator doing due diligence rather than an end user browsing for fun.

Concretely, that means:

- You have designed and maintained **production design systems with real token architecture**,
  not theme files. You know what belongs in a CSS custom property versus a Tailwind config entry
  versus a component, and why. You are as comfortable in Tailwind 3.4's `var()`-mapping model as
  in 4's `@theme`, and you know which to reach for and what each one costs.
- You can hold a **brand and a dense data UI in the same system** without one flattening the
  other. Most designers cannot, and the failure is always the same: the expressive surface gets
  sanded into the same card grid as everything else.
- You are fluent in **CSS custom properties as a token source of truth**, variable fonts, and the
  View Transitions / scroll-driven-animation APIs.
- You write **Spanish product copy** that a system director of a national orchestra would read as
  professional, institutional Spanish — not translated marketing copy.
- You are ruthless about **what a claim costs**. You will not ship a screenshot, a heading, or a
  section whose only function is to fill space.

**You are not** an art director making a mood board. Every decision resolves to a token, a
component, or a line of copy. If you cannot express a design decision as code, it is not a
decision yet.

---

## 2. Context

### 2.1 What the product is

**CEMURM** — *Community-Centered Musical Repertories Manager*. A Progressive Web App for musicians
and the institutions that employ them. The mental model, already approved in the project's own
words: **a well-organized music binder that happens to be digital** (`docs/design-system.md:14-20`).

It manages repertoire, builds setlists, and carries a performance from rehearsal through the
published plan to the moment a musician is standing on stage.

### 2.2 Who it is for

**Primary: directors of national orchestra systems and multi-site music institutions.**

This is the decision that shapes every word on the page. The product's domain spine is the
*service week*: rehearsal → planning → plan freeze → performance → substitution → projection. That
flow has no meaning for a solo gigging musician. Institutional procurement is the buyer, and
institutional due diligence is the evaluation.

Supporting: orchestra directors, section leaders, instructors, and the musicians themselves.

### 2.3 The one thing it does that nothing else does

**Stage Bus** — one performance, N screens, each with a different role, all in sync.

A conductor's confidence monitor, the player's chart, the congregation's lyric projection, the
broadcast feed. One performance state feeds all of them, each rendering what that audience needs.

It is possible because of a second thing, which is the deepest claim in the product and the reason
a notation editor cannot copy any of this:

**The canonical chart and the personal rendering are different objects.**

> The official version of the work is the source of truth. Each musician may have their own
> transposition, capo, and personal annotations **without overwriting the official version**.
> *(A point we consider especially relevant to the orchestral world.)*
> — `docs/propuestas/cemurm-propuesta-para-orquesta-nacional.md:67`

In MuseScore or Flat.io, the version *is* the instrument's version. There is no representation for
"one shared arrangement, N divergent renderings, none of which forks." That is a data-model
decision, not a feature, which is why it is not copyable.

The landing's structure follows from this: **Stage Bus is what the hero shows; the split is what
explains why it works.**

### 2.4 Hard constraints

| Constraint | Detail |
|---|---|
| **Stage Mode is the brand, and must not be harmonized** | `src/pages/StageMode.jsx:389` and `src/components/overlay/OverlayView.jsx` are the only designed surfaces in the product. Pure black, large type, amber chords, real keyboard control. They deliberately escape the app shell. **Do not move Stage Mode onto a panel background or a `p-4` card. That destroys the only differentiated moment in the product.** |
| **The product is a stage tool before it is a dashboard** | One musician, standing, in a dark room, phone 40 cm from their face. A design that reads as "dense desktop app" has failed. |
| **The landing is a marketing page that happens to live in the app** | It is a real route, dogfooding the design system. It is **not** a data view — it reads from a curated content fixture, never from Supabase. |
| **No inventory fiction** | Do not invent tiers, numbers, institutional proof points, customer logos, testimonials, or dates. There is no pricing model and no customer. |
| **Spanish copy, domain-exact nouns** | See §5.3. The vocabulary is not decorative; several words have a specific meaning that a general writer will get wrong. |
| **No contact details** | None exist. `docs/product-brief.md:89-90` still reads "to be finalized". The footer links to the MIT-licensed repository, not to an email. |
| **The product does not scrape** | Never imply or show importing from chord sites. This is a deliberate legal and ethical position with copy already written: *"No importamos contenido de sitios de acordes — pegá tu propio chart."* It is a positioning asset, not a limitation. |

---

## 3. Technology

Baseline measured on `main` (facts, not estimates):

```
JS:  855.23 kB raw → 234.37 kB gzip   in ONE chunk      ← no code splitting
CSS:  30.42 kB raw →   5.98 kB gzip   in ONE chunk
Fonts: 56 files → 872 kB, of which 656 kB is dead weight (cyrillic + latin-ext + .woff)
```

### 3.1 Existing

React 18 · Vite 5 · **Tailwind 3.4 — it stays on 3.4, do not migrate** · plain JSX, no TypeScript
migration · React Router 7 via `createBrowserRouter` · `@supabase/supabase-js` · pnpm only.

**Why 3.4 and not 4:** Tailwind 4 changes the meaning of `shadow-sm`, `shadow`, `ring` and
`rounded-md`. This repository already uses all four across 40+ files, and a migration would
restyle the app silently underneath a correct landing. `@theme` is sugar, not a capability — 3.4
gets you the same CSS-custom-property architecture via `var()`. See §4.1.

### 3.2 Add

| Add | Size | Scope |
|---|---|---|
| `motion` — vanilla core, WAAPI-based | ~18 kB | **Landing chunk only** |
| `lucide-react` | ~1 kB/icon | Shared |
| `@fontsource-variable/inter` + one variable mono, **latin subset only** | ~45 kB total | Replaces the 872 kB |
| `shadcn/ui` Device Frames | 0 (copied in) | Hero object |
| `playwright` + `@axe-core/playwright` | dev | Landing visual + a11y snapshots |

**Runtime dependencies go 5 → 8. That is the ceiling.**

### 3.3 The motion policy

> **No animation library in the authenticated bundle. Not one.**

The app's motion needs are: CSS hover and focus transitions, and an **80 ms or instant** song
change in Stage Mode. A 40 kB animation runtime in a PWA that must work **offline, on a tablet, in
a dark room, live** is a trade against the constraint the project itself calls its defining
property (`docs/technical-spec.md:523`).

**CSS-native motion comes first — it costs nothing.** View Transitions API,
`animation-timeline: view()` for scroll-driven animation, `@starting-style` for entries. Zero
bytes, GPU-composited. All behind `@supports` guards, because Firefox is the weak spot.

`motion` is used **only** in the landing chunk, and only for the hero demo's interactive state and
layout transitions.

### 3.4 Performance budget — acceptance, not aspiration

| Metric | Target |
|---|---|
| JS gzip, landing route | ≤ 120 kB |
| JS gzip, authenticated session | ≤ 150 kB |
| Largest single chunk | ≤ 150 kB gzip |
| Font payload shipped | ≤ 45 kB / 2 files |
| LCP, 4G throttle + mid-tier Android | < 2.0 s |
| CLS from fonts | 0 |
| Non-user-triggered motion moments on the landing | **1** |

The landing route must **not** pull the Supabase client into its chunk. Today
`src/App.jsx:92` wraps the whole router in `AuthProvider` → `src/lib/supabase.js`, so an anonymous
visitor downloads the entire application. Fixing that is part of this work.

Note: `src/lib/supabase.js:3-8` throws at module load if `VITE_SUPABASE_URL` or
`VITE_SUPABASE_ANON_KEY` is missing. Making the client lazy moves that throw to first
authenticated use — the landing must render without the env vars.

---

## 4. The brand

`docs/design-system.md` is **superseded. It is not an input.** It claims an approved palette that
was never implemented, and `docs/ux-spec.md:3,260` contradicts it. Two lines of its prose survive
as brand voice (§5.4).

### 4.1 Palette

**One built dark ramp. One accent. Hierarchy by value and opacity.**

The current 11 tokens are not a palette — 6 of them are literal Tailwind defaults (slate
900/800/700/600/50/400) and `#0f172a` is a blue-leaning near-black, which is why the app reads
"SaaS" instead of "dark room".

- Build a **4–5 step dark ramp**, neutral or very slightly warm. Replace the borrowed slate scale.
- **Accent: the amber** (`#f59e0b` family). At **full saturation only on the performance surface**
  and one or two declared accent moments on the page. Everywhere else, a desaturated or
  lower-chroma variant.
- **Hierarchy is value and opacity**, not a new color per level. The existing `elevated` / `hover`
  tokens become `white/4%` and `white/8%` overlays.
- `coral`, `emerald`, `rose`, `sky` **leave the system.** No function.
- **Ghost-outline text: `#1e293b`.** It already exists at `tailwind.config.js:29` as
  `cem.stage.dim` and has **zero usages** in `src/`. The system already anticipated this technique
  and nobody executed it. Reuse that value.

Deliver the ramp as **CSS custom properties in `:root`** in `src/index.css`, and map the Tailwind
names to `var(--cem-*)` in `tailwind.config.js`. Do not hardcode a new token value in the config.

> **The new token layer is ADDITIVE. Do not remove or rename any existing token except
> `cem.coral`.**

Tailwind's JIT only emits the classes it finds, so **deleting a token kills every class that
references it.** Measured against the current `src/`: `cem.rose` 176 usages / 32 files,
`cem.elevated` 370 / 36, `cem.secondary` 315 / 40, `cem.emerald` 68 / 15, `cem.sky` 7 / 4,
`cem.hover` 1 / 1. `cem.coral` is **0** and is the only one you may delete.

Removing the four tokens named in the brand direction would silently break **936 class usages
across 40+ files**: rose error banners lose their colour, secondary text falls back to
inherited, elevated panels lose their border. The new ramp ships under **new names**, consumed
only by the landing. The legacy tokens are deleted later, in the app refactor cycle.

Verify that `StageMode.jsx` and `OverlayView.jsx` — which write raw `bg-black` and `text-white/NN`
today and cannot consume a JS token object — can read `var(--cem-*)` directly. That is the reason
the source of truth is CSS and not the Tailwind config.

### 4.2 Typography

| Role | Family | Notes |
|---|---|---|
| UI and data | **Inter** | Self-hosted, variable, latin subset. Correct for tables and call sheets |
| **Display** | **One technical monospace** | Carries the brand personality. Must be justified in the spec |
| Mono (data, metadata) | **The same family as display** | Fixes `src/pages/SongDetail.jsx:930`, where `font-mono` silently falls back to DejaVu |

Two families, clearly distinct in role. Self-host both; no Google Fonts request. `font-display:
swap` plus a `size-adjust` fallback so CLS is zero.

Scale follows *The Elements of Typographic Style*: intentional weights, widths, spacing. Line
length under 80 characters.

### 4.3 Structure and motion

**Hard-edged. Full-bleed. No card grid. Asymmetric editorial grid that alternates sides. Zero
`border-radius` in the page structure. No gradients in the structure.**

> **Radius and volume are spent in exactly one place: the hero object.** Everything else stays hard.
> One memorable thing; everything around it disciplined.

Motion: **one** orchestrated page-load moment. Nothing else non-user-triggered. No fade-and-slide
on every section, no hover transition on every card. Motion that answers a user's action is
welcome. `prefers-reduced-motion` respected.

### 4.4 Brand voice

Carried forward from `docs/design-system.md:14-20` and `:20`:

> A professional tool with community soul. It lives at the intersection of **Utility** — musicians
> need it to work, reliably, on stage, offline; **Community** — it connects bands, academies,
> worship teams; **Creativity** — it's about music, not spreadsheets.
>
> *"Playful moments are welcome, but the default mode is 'this tool respects my time.'"*

Copy discipline: plain verbs, sentence case, active voice. A CTA says exactly what happens —
*"Unirme a la lista de espera"*, never *"Enviar"*. An action keeps the same name through the whole
flow, so the button that says "Publicar" produces a toast that says "Publicado". Treat failure and
emptiness as direction, not mood: explain what went wrong in the interface's own voice, never
apologise, never be vague.

### 4.5 Iconography

The repository has **no icon library**. 14 sites use emoji and glyphs as icons, and the same glyph
appears at three different sizes (`StageMode.jsx:455` vs `PdfChartViewer.jsx:88`).

`lucide-react`, tree-shaken. `strokeWidth` driven by a single token. Icons are never the default
carriage of meaning — a bare icon with no label and no `aria-label` is a failure.

### 4.6 Mascot

**Kutu** stays. Deliver:

- Final name decision is **deferred to a product decision** — reserve the slot, do not invent
- **System spec**: shape language, construction grid, character palette, the poses the product
  actually needs, use rules and non-use rules
- **One compliant geometric SVG placeholder**

**Do not attempt final illustration art.** An LLM-generated mascot illustration looks like a
placeholder wearing the word "final". The spec is the deliverable; the art is commissioned.

Consequence: **the landing ships without the mascot.** The content file reserves its slot from day
one.

---

## 5. The page

### 5.1 Structure — 13 sections

| # | Section | Notes |
|---|---|---|
| 1 | Header | Mark, minimal nav, waitlist CTA. Sticky, visually light |
| 2 | **Hero — Stage Bus** | Scripted interactive demo, three rotating roles. **The single memorable thing** |
| 3 | El problema | Three points, no cards |
| 4 | Qué es y qué no | One line: the digital music binder. Negative framing: not a notation editor, not a gig-management app |
| 5 | El ciclo del servicio | lifecycle → rehearsal → plan freeze → performance → substitution → projection. **Numbered — it genuinely is a sequence** |
| 6 | **Stage Bus** | New section, after the cycle, because Stage Bus is the transversal capability that enables every step rather than a step itself. Three roles, with the one-line definition a coined term requires |
| 7 | El split | Canonical chart vs. personal rendering. Why one shared arrangement serves N musicians without forking |
| 8 | Capacidades por rol | Director de sistema / director de orquesta / músico / instructor |
| 9 | Institucional y multi-sede | system → org → branch, roles, minors with guardian consent |
| 10 | **Lo que no hacemos** | The declared non-goals, each with its reason |
| 11 | Offline y datos | What works without a connection and what does not |
| 12 | Precios | "$0 durante la beta". No invented tiers |
| 13 | FAQ | Six real questions from a system director |
| — | Footer | Waitlist CTA, MIT licence, repo link. **No email** |

Numbered markers are legitimate **only** in §5, where the content is genuinely a sequence.
Everywhere else they are decoration and are banned.

### 5.2 Hero demo spec

- The object is a **real stage layout rendered from the fixture**, inside a `shadcn/ui` Device
  Frame, **rotated and cropped by the canvas edge**, sitting on a hard-edged page.
- **Frame rotation must not rotate text.** Charts stay axis-aligned and readable.
- **Three rotating roles**: *músicos* (chords over lyrics, in their personal key) · *público*
  (lyrics only, high contrast) · *señal* (title, position in the setlist, broadcast-safe — never
  personal annotations).
- The switching **is** the demo. One orchestrated moment on load, then the visitor controls it.
- A depth cue: sibling screens recede in scale and opacity. One element is in focus.
- Content: **a verifiable public-domain piece** with three instrument projections. You must verify
  the public-domain status at source and record the citation before shipping. Do not assert a
  licence you have not checked.
- No video. A video is a fixed asset re-recorded on every UI change, and it would show
  capabilities that do not exist yet — a claim with a timestamp on it.

### 5.3 Copy rules

**Use these nouns exactly. Never invent substitutes.**

repertoire · chart *(a chord chart — **not** a graph)* · canonical chart · personal rendering ·
setlist · agreed key · transpose · capo · section · degree · readiness · annotation ·
collaborator · bandmate · rehearsal · gig · performance record · org · branch ·
system repertoire · **service** *(a worship service)* · block · call sheet · plan freeze ·
substitution · part *(a musical part, never "part of something")* · collection · fork/lineage ·
public library · guardian consent · Stage Mode · practice view · audience view · overlay ·
Stage Bus

**Banned:**

- **`cue`** — not a shipped concept. Zero occurrences across all 45 feature files.
- **"service" meaning a SaaS service.** In Spanish it is worse: for a church audience, use
  *culto* or *junta*.
- **"chart" meaning a graph.**
- **Tablatura.** Guitar TAB exists nowhere in the product — not in the code, not in the 45
  features, not in the schema. CEMURM has ChordPro, PDF scans, and planned MusicXML/ABC. The copy
  says *acordes, letras y partituras*.
- **"repertoires"** as a plural common noun. The noun is singular; the brand expands to
  "Repertories" in the name only.

### 5.4 Content the page must carry

These are already written in the project's own voice. Reuse, don't reinvent.

- **The problem, sharpest form in the corpus**: *"los músicos lidan con cuadernos de papel en la
  oscuridad, arreglos perdidos en hilos de email, y aplicaciones que no entienden su flujo de
  trabajo real"* — `docs/propuestas/cemurm-revision-para-ingenieros.md:14`
- **The split, in one line** — `cemurm-propuesta-para-orquesta-nacional.md:67` (§2.3 above)
- **Substitute-material projection**, the most director-shaped capability in the repo: *"el
  sistema reúne las piezas, tonalidades y anotaciones que el músico entrante necesita"* — same, `:52`
- **Institutional traceable history**: *"Registro histórico de eventos completados (solo lectura)
  — trazabilidad institucional"* — same, `:47`
- **Rights posture**: no scraping, public library with confirmed licences, CC-BY-4.0 by default,
  institutional private content stays private — same, `:79`
- **Non-goals, each with its reason** — the "Non-Goals" blocks in `features/*.feature`, and the
  rationale pattern at `cemurm-revision-para-ingenieros.md:116`

**Do not mine the proposals for maturity language.** They say *"fase de especificación avanzada,
sin implementación real"* and *"primer hito ~2 meses"*. Hitos 1–4 shipped weeks ago.

**⚠️ And do not mine them for capability language either — five of those claims are false in the
current code, proven by a 235-test characterization suite:**

| Claim | Reality |
|---|---|
| `…-orquesta-nacional.md:74` "Modulación por secciones" | **Dead code.** `parser.js:9` puts `'key'` in `KNOWN_META`, so the check at `:69` always matches and `continue`s. The sectional-override branch at `:73` is unreachable, `sectionKeyContexts` is always `[]`, and the module's own `demo()` **fails** |
| `…-orquesta-nacional.md:75` enharmonic spelling | **False.** `transposeKey('C', -2)` returns `'A#'`, not `'Bb'`. `transposeKey('C', 3)` returns `'D#'`, not `'Eb'`. Flats cannot be spelled at all |
| `…-orquesta-nacional.md:73` degrees correct in modal harmony | **Unverified.** The pure engine in `degreeResolver` is unexported, so it has no test |
| `external-integrations.feature` — export contains "agreed keys" | **False.** The OnSong exporter has zero references to `agreed_key`; `flattenSetlist()` never copies it onto the setlist object |
| `offline-edit-conflict-policy.feature:47` — equal timestamps use a recorded tie-break, stored so every device agrees | **False.** The comparison is a strict `>`, and no resolution is stored. "Every device reaches the same result" does not hold |

> **The rule: a capability may be asserted only if a characterization test covers it, or you have
> read the code and verified it yourself. Otherwise omit it, or let the framing line in §5.5
> cover it.** Full findings: `odd/tasks/cemurm-brand-landing.md` §14.

**Do not cite** `cemurm-propuesta-para-orquesta-nacional.md:22` — the claim that the test
scenarios cite a national orchestra system is false. That string appears exactly once in the whole
repository: in that line itself.

### 5.5 Honesty posture — approved, do not "fix" it

The page presents the **target** beta design, including capabilities that are specified but not
yet built. This is approved. It is carried by **one single line**, placed once, in the hero or
adjacent to the CTA, and it must assert nothing checkable so that it never goes stale.

The page also carries a **dedicated, argued "what we deliberately do not do" section**. Precision
in that direction is the point: against a competitor that adds forty features and scrapes your
content, knowing exactly what you refuse to do is a position of strength.

**There is no status section and no roadmap.** `docs/mvp-scope.md:215-217` says Hito 5 is unmerged
while the tree carries migrations through `0028`; publishing a roadmap would publish a verifiable
error.

### 5.6 i18n structure

`src/content/landing.es.js` holds the **entire** copy structure. Every string on the landing
resolves from it; no hardcoded copy in JSX. Adding English later is `landing.en.js` plus a
`useLocale()` hook. No i18n library. No changes to the other 108 files. Reserve the mascot slot
now.

---

## 6. Expected result

### 6.1 Deliverables

1. Additive token layer: the dark ramp as `:root` custom properties in `src/index.css`, mapped
   through `var(--cem-*)` in `tailwind.config.js`, plus the ghost-outline value. Nothing existing
   removed except `cem.coral`
2. Shared primitive library: `Button`, `Card`, `Panel`, `Badge`, `Modal`, `Input`, `EmptyState`,
   `Table` — with visible focus on every one
3. Icon set on `lucide-react` with a token-driven stroke width
4. Brand mark
5. Mascot system spec + placeholder SVG
6. The landing at `/`, 13 sections, with the hero demo
7. Route-level code splitting, vendor chunk, lazy Supabase client
8. Variable fonts, latin only
9. `manifest.webmanifest` + `theme-color` + icons + a real favicon (the app is currently
   **not installable** — `index.html` has no manifest link and the favicon is still Vite's)
10. Playwright snapshots: 6 (375 / 768 / 1440) plus an axe-core pass

### 6.2 Acceptance criteria

1. `pnpm typecheck && pnpm lint && pnpm build` all pass. **typecheck is not in CI**
   (`.github/workflows/ci.yml` runs lint and build only) — run it locally and report it.
2. Every landing string resolves from `src/content/landing.es.js`.
3. **No `border-radius` and no gradient in the page structure.** Both appear only in the hero.
4. `coral`, `emerald`, `rose`, `sky` are gone from the Tailwind theme.
5. Full amber saturation appears only on the performance surface and its declared accent moments.
6. A real monospace family is configured; `SongDetail.jsx:930` no longer falls back.
7. Visible keyboard focus on every interactive element. `prefers-reduced-motion` respected.
8. Hero, demo rotation, and the cycle section hold from 375 px up. Do not reproduce the
   13-link non-wrapping nav problem of `AppLayout.jsx:57`.
9. Exactly one non-user-triggered motion moment.
10. Every metric in §3.4 met, and reported with the measured number.
11. The public-domain piece in the fixture is verified at source and the citation is recorded.
12. Reduced-motion and keyboard-only paths are **exercised and reported**, not assumed.
13. Tailwind is **still v3.4** and every existing class still compiles. A
    `grep -roE 'cem-(coral|emerald|rose|sky|secondary|elevated|hover|amber)\b' src/ | sort | uniq -c`
    run before and after returns **identical counts**, except that `cem.coral` reaches zero. Any
    other changed count means existing screens have lost styling — that is a regression, not an
    improvement. This grep is the check that replaces a visual baseline.

### 6.3 Verification

There is **no test framework in this repo** (`AGENTS.md:19`). Verification is
`pnpm typecheck && pnpm lint && pnpm build`, plus Playwright snapshots, plus a manual
keyboard-only pass and a `prefers-reduced-motion` pass in the browser. Report observed results in
the form `<command>: <observed result>`. **A check that was not run is reported as NOT RUN, never
as PASS.**

### 6.4 What will make this fail

Read this section twice. Every item is a real failure mode of this specific brief.

- **Harmonizing Stage Mode into the app shell.** The single worst outcome. It would be motivated,
  it would look tidier, and it would destroy the brand.
- **The pixel/bitmap typeface from the reference.** A visual reference was supplied with a pixel
  display face. It does not transfer. A national orchestra system director reads it as a 2021
  hobby project. The distinctiveness must come from the monospace display instead.
- **3D product renders with lens flare.** There is no product photography and there will not be.
  An invented mockup is the fastest route to looking like a template. The hero object is real UI.
- **The SaaS-card kit.** One border-radius on everything regardless of hierarchy, the same soft
  grey shadow under every card, gradient washes as decoration. This is the single most recognisable
  signature of AI-generated design, and it is what the product owner is specifically trying to
  avoid.
- **Template chrome.** Tracked-out ALL-CAPS eyebrows above every heading, middle-dot meta strings
  (`a · b · c`), `WORD — fragment` labels, `→` appended to button text.
- **The cream + terracotta default.** Warm cream ground with a high-contrast serif and a warm-clay
  accent is the other most recognisable generated-design signature.
- **Invented content.** No tiers, no numbers, no testimonials, no customer logos, no dates, no
  contact details. There is no pricing model and no customer.
- **An animation library in the authenticated bundle.** See §3.3.
- **Removing or renaming an existing token.** The single most destructive thing you can do here,
  and it looks like tidying. See §4.1. Tailwind's JIT drops classes whose token is gone; 936 class
  usages across 40+ files break silently. Only `cem.coral` may go.
- **Migrating to Tailwind 4.** Not a risk to manage — a change that was decided against. It
  restyles `shadow-sm`, `shadow`, `ring` and `rounded-md` in a codebase that uses all four.
- **Scope creep into the app refactor.** The 108 existing files are **out of scope** except for
  code splitting (§3.1). Restyling them is a later cycle.
- **Emitting `cue`, or "service" as SaaS, or "chart" as a graph, or promising tablatura.** See §5.3.

### 6.5 Delivery shape — four chained PRs, not one

This is ~400 changed lines per PR of budget, and the work is well over that. The repository
convention is chained slices on a shared `feat/` branch with a `-prN-` suffix.

| Slice | Content | Visual risk |
|---|---|---|
| **PR 1** | Code splitting, vendor chunk, lazy Supabase client, variable fonts (§3.1, §3.4 typography) | **None.** No class changes meaning |
| **PR 2** | Manifest, `theme-color`, icon set, favicon, Playwright harness | **None.** Closes the "not installable" claim |
| **PR 3** | Additive token layer, primitives, `lucide-react` | **Low.** Additive only; the §6.2.13 grep proves it |
| **PR 4** | The 13 sections, the hero demo, the mark, the mascot spec | **None to the app.** New surface only |

**Do not compress to fit a single PR.** Deleting tests, minifying, or dropping acceptance
criteria are all forbidden. The correct move when a slice exceeds its budget is to split it again
and say so in the report.

---

## 7. Skills to load

| Skill | Use |
|---|---|
| **`frontend-design`** | **Required, read before any work.** Owns the token plan, the reference analysis, and the rejected-defaults list in §6.4 |
| `prototype` | If you need to test the hero demo mechanic before committing to it |
| `archify` | Optional — a diagram of the service cycle or the Stage Bus topology can be a real asset here |
| `browser` / `playwright` | Screenshots at three widths, and the visual self-critique pass. Take the pictures; a picture is worth a thousand tokens of self-review |

**"Taste Design" and "Emil Kowalski Design" are not installed in this environment.** Do not
simulate them and do not claim to have applied them. If you believe a specific capability from
those bodies of work is needed, name the capability and implement it against §3.3 and §6.4.

---

## 8. How to report back

Report, in this order:

1. **What you shipped**, mapped to the ten deliverables in §6.1
2. **The token system**, as actual values, not as descriptions
3. **The measured numbers** for every row of the §3.4 budget, with the command that produced them
4. **What you rejected and why** — name anything from §6.4 you steered away from
5. **Every criterion you could not meet**, stated plainly, with the reason
6. **The three things you would change if you had another cycle**

Do not report a check as passing unless you observed it passing. Do not describe intent where a
measurement was available.
