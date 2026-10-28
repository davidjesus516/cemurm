# Tier 3 — Performance Surfaces

The contract for the interfaces that run **during** a live service. This is the part of the CEMURM
visual system that Apple guidance does not cover, and the part where a wrong colour is a safety
problem rather than an aesthetic one.

Tiers 1 and 2 live in `references/apple-macos-visual-language.md`. Read that file for radius, depth,
materials and motion primitives. Read this file for **who is looking, from how far, and what happens
when they get it wrong**.

## Scope and verification

Verified against the working tree at `land/1-fixtures` (`29565f4`), tracked files clean. Every number
below is measured from the source, not estimated. Contrast figures use the sRGB relative-luminance
formula in WCAG 2.2 SC 1.4.3, compositing alpha over the actual background before measuring.

| Surface | Route | File |
|---|---|---|
| Stage Mode — the musician's own tablet | `/setlists/:id/stage` | `src/features/stage/pages/StageMode.jsx` |
| Overlay — the public OBS Browser Source | `/overlay/:sessionId` | `src/features/stage/pages/Overlay.jsx`, `src/features/stage/components/OverlayView.jsx` |

---

## 1. The split, and why the code draws it

### 1.1 The rule

**Ask one question: do the pixels leave the device?** If they stay on the screen the performer is
holding and touching, the surface is **tier 3a** and the full macOS language applies — radius, depth,
materials, touch affordances, focus rings. Depth is not decoration there; it is how the performer knows
a panel is floating above the chart. If they are rendered by something else, on something else, for
people who are **not** the operator, the surface is **tier 3b** and the macOS language is switched off
entirely: no radius, no shadow, no translucency, no gradient, no personal annotation, no chrome.

### 1.2 The tiebreaker, when the question is ambiguous

A performer reading their own tablet at arm's length is a different problem from a congregation reading
a wall at 8 metres. When you cannot tell which you are building:

| Ask | 3a | 3b |
|---|---|---|
| **Who is the audience?** | the operator | a second pair of eyes, which cannot ask a question |
| **What is the cost of a mistake?** | a fumbled chord | a wrong note read aloud in front of a room |
| **Can the reader ask what they meant?** | yes | no — so no annotations, no operator-only state |

If all three point the same way, classify it 3b.

### 1.3 What the code already does — and why the line falls exactly there

The split is not a convention this skill invented. The router already draws it:

| | Stage Mode | Overlay |
|---|---|---|
| Route declaration | `src/app/router.jsx:56` | `src/app/router.jsx:85` |
| Inside `AppLayout` (nav chrome) | yes | **no** |
| Inside `RequireAuth` | yes (`src/app/router.jsx:41`) | **no** |
| Inside `RequireGuardianConsent` | yes (`src/app/router.jsx:46`) | **no** |
| Input model | touch, keyboard, foot pedal, MIDI | a 2 s poll (`STATE_POLL_MS = 2000`, `src/data/repositories/overlay.js:25`) |
| Gets radius and depth | yes | no |

`src/app/router.jsx:80-83` states the overlay's reason: the CEF source "gets no nav chrome and no
JWT". `src/features/stage/pages/Overlay.jsx:1-6` says the same from the other side — "NO auth guard: the
anon-visible RPC serves an inactive row (zero song data) for unknown or inactive session ids — the
unguessable uuid IS the authorization". The two agree. **The overlay has no session, and therefore
cannot have any interface element that requires one.** That is the load-bearing fact: a projector
surface is not a page that happens to have no styles, it is a rendering target a third party loads, in
a context where the app controls neither the device, the room, nor the pixels that surround it.

### 1.4 Measured compliance, current state

| Property | Stage Mode (3a) | Overlay.jsx | OverlayView.jsx (3b) |
|---|---|---|---|
| Lines | 810 | 51 | 98 |
| `rounded*` | **30** | **0** | **1** |
| `shadow*` | **2** | **0** | **0** |
| `backdrop-*` / `gradient*` | **0** / **0** | **0** / **0** | **0** / **0** |
| `border*` | 47 | 0 | 1 |
| `white/<alpha>` utilities | 56 | 0 | 7 |

3b is compliant on radius, shadow, backdrop and gradient, with exactly one `rounded-full` — the `N / M`
position chip at `src/features/stage/components/OverlayView.jsx:38`, which
`scripts/check-visual-contract.sh:86-88` allowlists by name with a stated reason. 3a uses radius and
depth heavily, which is correct for its tier. **The gate does not currently certify 3b** — see §7.1,
and do not "fix" `OverlayView.jsx:38` to turn it green.

---

## 2. Overlay / projector (tier 3b) rules

### 2.1 Minimum contrast

The only sourced floor in this repository is WCAG 2.2. Both pages were loaded and verified:

- **SC 1.4.3 Contrast (Minimum), Level AA** — text at least **4.5:1**; at least **3:1** for large
  text. <https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html> (dated 01 June 2026)
- **SC 1.4.11 Non-text Contrast, Level AA** — **3:1** for the visual information required to identify UI
  components and their states, and for graphical objects required to understand content.
  <https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html>
- Both treat the ratios as **thresholds that must not be rounded**. 4.499:1 fails.

Apply these on 3b as a **floor, not a target**. They are screen thresholds, not a claim that 4.5:1 is
sufficient on a projector — see §6, which is unsourced and says so. WCAG's 18 pt / 14 pt bold "large
text" threshold is defined as **approximately 24 px and 18.5 px**, since 1 pt = 1.333 px. That is a
*contrast* threshold, not a legibility-at-distance threshold. Do not quote it as one.

### 2.2 Measured contrast on the projector surface

Background is `bg-black` = `#000000` (`src/features/stage/components/OverlayView.jsx:22,33`).

| Element | Source | Size | Ratio | vs SC 1.4.3 |
|---|---|---|---|---|
| Song title, `text-white` | `OverlayView.jsx:35` (`text-5xl`) | 48 px | 21:1 | pass |
| Lyric body, inherited `text-white` | `OverlayView.jsx:48` (`text-3xl`) | 30 px | 21:1 | pass |
| Chord, `text-cem-amber` | `OverlayView.jsx:80` (`text-3xl`) | 30 px | 9.78:1 | pass |
| Key line `:36` and section heading `:54`, `text-white/70` (`text-2xl`) | `OverlayView.jsx:36,54` | 24 px | 10.02:1 | pass |
| No-chart notice, `text-white/60` | `OverlayView.jsx:46` (`text-2xl`) | 24 px | 7.37:1 | pass |
| Position chip, `text-white/80` on `bg-white/10` | `OverlayView.jsx:38` (`text-base`) | 16 px | 11.4:1 | pass |
| Inactive notice, `text-white/50` | `OverlayView.jsx:23` | 16 px | 5.32:1 | pass |
| Position chip border, `border-white/20` | `OverlayView.jsx:38` | 1 px | 1.9:1 vs its own fill | see below |

**Every text treatment on 3b passes SC 1.4.3 AA.** The only low value is the chip's 1 px border, and
under SC 1.4.11's "Boundaries" note a control with visible text does not require a contrasting border,
so this is **not** a WCAG failure. It is a real risk anyway: a 1 px translucent edge is exactly the
detail a video encode smooths away first (§2.5).

### 2.3 Why a projector changes the perceived value of every colour

The contrast ratio is a property of two sRGB values, not of the medium. What the medium changes is the
**black level and the ambient floor**. `cem.stage.bg` is `#000000`, which on a projector is not black —
it is the projector's own black level plus room light plus wall reflection. WCAG states this limitation
about itself: "web content does not emit light itself" (SC 1.4.3, Notes on formula). House lights, a
stage wash, or coloured light on the wall then raise the floor at the dark end and lower the ceiling at
the light end, **compressing the range** the palette sits in: a 21:1 design ratio is not a 21:1
delivered ratio. A soft shadow has nothing darker to fall on, since `rgb(0 0 0 / 0.1)` over `#000000`
is `#000000`. A translucent fill composites against a backdrop the app does not control.

**These claims about encoders and room light are reasoned, not sourced.** They are the physical basis
for §2.4 and §2.5, not a measurement; no number in this repository quantifies them.
`scripts/check-visual-contract.sh:81-85` already holds the same position from the other direction — that
shadow, gradient and backdrop filter "actually degrade through a projector and an H.264 encode".

### 2.4 Why amber is the one saturated colour permitted

Not taste — three checkable reasons.

1. **It is the highest-contrast non-white token in the palette on the stage background.** Measured on
   `#000000`: `cem.amber` **9.78:1**, `cem.emerald` 8.28:1, `cem.secondary` 8.19:1, `cem.sky` 7.58:1,
   `cem.coral` 7.49:1, `cem.rose` 5.72:1. Amber wins on the only metric that matters here.
2. **It carries the most safety-critical datum on the surface.** The chord is the one thing a wrong
   value turns into a wrong note played in front of a room, and both surfaces render it in amber
   (`StageMode.jsx:611`, `OverlayView.jsx:80`). Spending the only saturated colour on the only
   unrecoverable datum is the correct allocation.
3. **Red on black is a known low-vision failure mode, and it is why `cem.rose` is barred.** WCAG's own
   rationale for SC 1.4.3, loaded and verified verbatim: effective luminance contrast holds for
   colour-deficient observers "except for the use of predominantly long wavelength colors against
   darker colors (generally appearing black) for those with protanopia. (We provide an advisory
   technique on avoiding red on black for that reason)". `cem.rose` `#f43f5e` is exactly that case and
   appears nowhere in either overlay file today. Keep it that way.

**Rule.** On 3b the permitted colours are the background, `cem.stage.lyric`, `cem.stage.section` and
`cem.stage.chord`. Nothing else. Hue is spent once, on the chord.

### 2.5 Why translucency, soft shadow, hairlines and low-contrast greys are unsafe

- **Translucency** composites against an unknown backdrop, so the colour you authored is not the colour
  delivered. On 3b every fill is opaque.
- **Soft shadow** needs a lit edge and a darker surround. A projector flattens both, and a black shadow
  on a black field is literally zero delta. Depth cues are for the operator's tablet, not the wall.
- **Hairlines** are the first casualty of scaling and video encoding. The chip border at
  `OverlayView.jsx:38` is the live example: a 1 px translucent edge at 1.9:1 that a congregation will
  never see, and that a designer *believes* is there. Do not add another; do not treat the existing
  one as a precedent.
- **Low-contrast greys** have no upside. `white/30` is 2.48:1 and `white/40` is 3.66:1 on `#000000`. A
  grey that cannot be seen is not hierarchy, it is a fragment. On 3b hierarchy comes from size and
  weight, never from opacity.
- **Gradient** "can reduce the apparent contrast between areas, and make it more difficult to test"
  (SC 1.4.11, Gradients). On a projector it is worse, because the range is already compressed.

### 2.6 Broadcast safety — the hard rule

**Personal annotations must never reach 3b. Ever.** This is a privacy and safety boundary, not a
styling preference. A performer annotation is written for one person and is often a private note about
a person — a reminder, a warning, a criticism, an arrangement decision. On a projector it is in front
of a congregation and it is **recorded** by the stream. The code already enforces this, and it is the
correct precedent:

- `src/features/stage/components/OverlayView.jsx:60-63` — sections of type `'comment'` return `null`.
  Skipped entirely, not styled differently.
- `src/features/stage/components/OverlayView.jsx:5-8` — the header states the rule and names the
  contrast case: the external display "italicizes them", the stream does not show them at all.
- `src/features/stage/pages/StageMode.jsx:591-592` — the same sections on the tablet, where they are
  personal, render `italic text-white/60`. The difference between the two surfaces for the same datum
  is the whole point of this file.

**Rule.** A change that causes a `'comment'` section, a performer note, or any operator-only state to
reach 3b is a defect, not a styling choice. Adding a field to the overlay payload is a broadcast review,
not a data-model change. The rest of the leak defence is `Overlay.jsx:14-22,37-40`: any unknown
session, error or throw renders `INACTIVE_STATE` — a black screen reading "Overlay inactive" and
carrying **zero song data** (`OverlayView.jsx:20-26`). Never blank, never crash, never leak. Preserve
that in any change to the polling path.

---

## 3. Stage Mode (tier 3a) rules

### 3.1 What the 30 radius usages are doing — and finding F-1

Radius is legitimate on 3a: it is how the performer tells a floating panel from a flat region. The
distribution, verified against Tailwind 3.4's own `defaultTheme.borderRadius`:

| Class | px | Count | Where |
|---|---|---|---|
| `rounded-md` | 6 px | **14** | Controls: buttons, inputs, selects, list rows, error banners |
| `rounded` | 4 px | **8** | Header chrome buttons, played/skipped toggles, encore rows |
| `rounded-lg` | 8 px | **4** | The two floating panels (`:474`, `:683`), the two footer nav buttons (`:641`, `:669`) |
| `rounded-full` | — | **4** | Status pills (`:478`, `:483`) and their 6 px dots (`:479`, `:484`) |

`rounded-full` is correct: a pill on a pill, a circle on a circle. The other three are not consistent.
Outlined buttons — border, transparent fill, `hover:bg-white/10` — appear at **three radii in the same
file**:

| Radius | Lines |
|---|---|
| 4 px `rounded` | `399`, `432`, `452`, `460`, `656`, `767` |
| 6 px `rounded-md` | `514`, `526`, `552`, `697`, `743`, `755`, `794` |
| 8 px `rounded-lg` | `641`, `669` |

The two 8 px outliers are the footer's **Prev** and **Next** — the two most important controls on the
surface. The **Pair foot pedal** button (`:656`), two elements above them, is 4 px. A performer scanning
the footer sees two corner treatments on four adjacent buttons, and the difference is not perceptible at
any distance they read at. This is a genuine inconsistency in the existing code: **report it, do not
silently normalise it.** `AGENTS.md` is explicit that existing behaviour is recorded, not rewritten.

**Rule for adding another radius on 3a.** Exactly three legitimate radius roles exist:

| Role | Value | Applies to |
|---|---|---|
| Control | 6 px (`rounded-md`) | Every button, input, select, interactive row. The default. |
| Surface | 8 px (`rounded-lg`) | Floating panels and modals only. Never a bare control. |
| Pill | `rounded-full` | Status badges and dots only. Never a text container. |

A fourth value needs a review, not a preference. If you are reaching for 4 px, you are probably writing
a control that should be 6 px.

### 3.2 What the 2 shadows are doing — and finding F-2

Both are `shadow-xl`, both on genuinely floating elements: the absolute-positioned stream panel
(`StageMode.jsx:474`, `z-40`) and the finish-gig modal (`:683`, inside a `fixed z-50` scrim at `:678`).
That is consistent, and it is not decorative card chrome — which is what
`odd/tasks/visual-system-macos.md:61-63` bans.

**Finding F-2: both shadows are invisible.** Tailwind 3.4's `boxShadow.xl` is
`0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)`. Black at 10% composited over the
stage's `bg-black` (`:389`) is `#000000`, so the shadow falls on `#000000` and is zero delta — not weak,
absent. The panels read as floating only via their `bg-cem-surface` fill and border.

**Rule.** On a `#000000` ground, express elevation with a **surface fill step**, not a shadow. Shadow is
a tier-1 material. If a 3a element must read as above another, step the fill.

### 3.3 Finding F-3 — no press state, and no focus ring

Verified across `src/`:

- **Zero** `active:` or `:active` utilities. The only affordance channel on 3a is `hover:bg-*`, which a
  touch device never delivers, so tapping "Next" produces **no** feedback of any kind. WCAG SC 1.4.11
  does not require hover contrast — author hover treatments are explicitly "supplemental and do not
  themselves need to contrast 3:1" — so this is not a violation. It is a missing channel, and it is
  the one channel `apple-macos-visual-language.md` §7.6 calls Critical.
- **Zero** `focus:` utilities in `StageMode.jsx` or `OverlayView.jsx`, against `docs/ux-spec.md:250`
  ("Visible focus ring (2px, offset 2px) on all interactive elements") and WCAG 2.4.7. The keyboard map
  is fully wired (`StageMode.jsx:128-143`), so a keyboard user can reach every control and cannot see
  where they are.

**Rule.** Every interactive element on 3a carries a **visible focus ring** and a **pressed state** that
does not depend on hover. Press feedback uses `motion-instant` and a `scale` or fill step — §4.

### 3.4 Finding F-4 — touch targets below the repo's own floor

`docs/ux-spec.md:252` requires **≥ 44×44 px on mobile, 48 px preferred**. Computed from the class strings
at Tailwind 3.4's default font sizes and line heights:

| Control | Source | Height |
|---|---|---|
| Footer Prev / Next | `StageMode.jsx:641`, `:669` (`py-3 text-lg`) | **~54 px** — passes |
| Transpose `+` / `-` | `:452`, `:460` (`py-1 text-lg`) | ~38 px — fails |
| Exit, Finish gig, Stream | `:399`, `:408`, `:432` (`py-1 text-sm`) | ~30 px — fails |
| Overlay mode toggle | `:514`, `:526` (`py-1.5 text-xs`) | ~29 px — fails |
| URL input, Copy | `:546`, `:552` | ~30 px — fails |
| Played / Skipped toggle | `:721` (`py-1 text-xs`, no border) | ~24 px — fails |

Five of six groups miss the documented floor. The two that matter most during a service — the song
navigation — are the ones that pass. Report this; do not resize 3a controls without a review, since
enlarging header chrome shrinks the area left for the chart.

### 3.5 Finding F-5 — sub-threshold text on 3a

| Element | Source | Size | Ratio | vs SC 1.4.3 |
|---|---|---|---|---|
| "No foot pedal" hint | `StageMode.jsx:647` (`text-xs text-white/40`) | 12 px | **3.66:1** | **fails** 4.5:1 |
| Destructive button label | `:496` (`text-cem-rose` on `bg-cem-surface`) | 14 px | **3.98:1** | **fails** 4.5:1 |
| Stream error text | `:562` (`text-cem-rose` on `bg-cem-rose/10`) | 12 px | **3.67:1** | **fails** 4.5:1 |
| Complete-gig error text | `:786` (`text-cem-rose` on `bg-cem-rose/10`) | 14 px | **3.67:1** | **fails** 4.5:1 |
| PDF-scan notice | `:444` (`text-[10px] text-white/50`) | **10 px** | 5.32:1 | pass on ratio, smallest type on the surface |

The rose failures are the sharpest: they are the **error** and **destructive** states, read mid-service,
in the two panels that are the only chrome on the surface. An error the performer cannot read is worse
than no error. The `text-[10px]` at `:444` is an arbitrary value — the only one on the surface, and the
only text in the file no design scale produced.

### 3.6 Finding F-6 — the `cem.stage.*` tokens are entirely dead

`grep -rn "cem-stage" src/` returns **nothing**. All five tokens declared at
`tailwind.config.js:24-30` have **zero usages in the whole repository**. Both stage surfaces hardcode
Tailwind's `bg-black` and `text-white/<alpha>` instead. The values coincide, which is why nobody noticed:

| Declared token | Value | What the code actually uses | Same value? |
|---|---|---|---|
| `cem.stage.bg` | `#000000` | `bg-black` (Tailwind `black`) | yes |
| `cem.stage.chord` | `#f59e0b` | `text-cem-amber` | yes |
| `cem.stage.lyric` | `#f8fafc` | `text-white` (is `#ffffff`) | near |
| `cem.stage.section` | `#94a3b8` | `text-white/70`, composited to `#b3b3b3` | no |
| `cem.stage.dim` | `#1e293b` | `bg-cem-surface` | yes |

**A finding, and also good news.** `SKILL.md` Hard Rule 4 says `cem.stage.*` is the only palette 3b may
use. Today 3b uses the wrong token names and gets most of the right values by coincidence, so migrating
it is a **class-name rename with no intended colour change** — except `cem.stage.section`, which visibly
moves `text-white/70` (10.02:1) to `#94a3b8` (8.19:1), and `cem.stage.lyric`, which moves `#ffffff` to
`#f8fafc`. Both still pass. Say so in the PR body; do not let a token migration read as a redesign.

`cem.coral` is the only genuinely dead accent: `cem-coral` has **0** usages, against `cem-emerald`
**68**, `cem-rose` **177**, `cem-sky` **7**. `scripts/check-visual-contract.sh:66-72` labels all four
"dead"; three are in heavy use and pending migration, not dead.

Taken together, 3a currently fails six of the seven rules this section sets: radius (F-1), depth (F-2),
press state (F-3), focus ring (F-3), touch targets at 5 of 6 groups (F-4), text contrast at 4 treatments
(F-5), and the stage palette (F-6). Reported, not fixed.

---

## 4. Motion on tier 3

### 4.1 What the code does today

**Nothing.** Verified: **zero** `transition*`, `animate-*`, `duration-*` or `ease-*` utilities in
`StageMode.jsx`, `Overlay.jsx` or `OverlayView.jsx`; **one** motion utility in the entire repository,
`transition-colors` at `src/features/repertoire/pages/SongDetail.jsx:964`. A song change on 3a is a
`setIndex` inside a `useCallback` (`StageMode.jsx:111-117`) that re-renders synchronously — there is no
transition to measure. `package.json` carries no animation library: dependencies are `@fontsource/inter`,
`@supabase/supabase-js`, `react`, `react-dom`, `react-router-dom` only, satisfying
`odd/tasks/visual-system-macos.md:85` and `SKILL.md` Hard Rule 5. **The current implementation is
instant, and instant is correct**; the ceiling below is what you are adding motion *under*.

### 4.2 The rules

1. **A song change completes in 80 ms or not at all.** `motion-instant`, 80 ms, `linear`, per
   `apple-macos-visual-language.md` §6.4. If a change takes longer, cut it — do not tune it down from a
   longer value.
2. **Never gate content on an animation.** The new song must be fully formed and at final contrast the
   instant it is committed. An animation may play; it may not gate.
3. **Never animate the opacity of primary content on tier 3.** A fade starts at 0% contrast, which on a
   projector is a blank frame. Use `transform` (a `scale` step) or nothing.
4. **CSS-native only.** `opacity` and `transform` are the budget. No library may enter the bundle for
   motion on this surface, per Hard Rule 5.
5. **3b cuts, it never cross-fades.** A cross-fade puts two songs on screen at once and the congregation
   reads the one it is leaving. Worse: the overlay's song change already waits up to `STATE_POLL_MS`
   (2000 ms, `src/data/repositories/overlay.js:25`) for the next poll, so a transition adds latency and
   buys nothing.

### 4.3 Finding F-7 — three different song-change budgets in one repository

| Source | Value | Status |
|---|---|---|
| `docs/ux-spec.md:224` | "Song change: fade **150ms** (no slide — a stage slide feels like a crash)" | Pre-existing project spec, marked final |
| `apple-macos-visual-language.md` §6.4 | `motion-instant` = **80 ms**; `motion-stage` = **90 ms**, with a "90 ms ceiling" for the current-song change | New, this unit |
| Code | **instant** (0 motion utilities) | Satisfies all three |

`docs/ux-spec.md:225` and `:226` agree with the code and with the rule: "Section jump within song:
instant, no animation" and "Transpose change: instant re-render". **This conflict is unresolved and is
not for a reference file to settle.** Report it: the 150 ms figure predates this skill and comes from
the project's own UX spec, while the 80/90 ms figures are a new CEMURM decision explicitly marked
"Apple's own values are not published". Nothing ships wrong today — the instant implementation satisfies
all three — but the next person to add a fade will find three numbers and no authority. **Interim rule
until a human decides: the strictest value governs. 80 ms, or nothing.**

---

## 5. Reduced motion and the live-service case

### 5.1 What the code does today

**Nothing, because there is no motion to reduce.** `prefers-reduced-motion` appears **zero** times in
`src/`, `public/`, `index.html` and `tailwind.config.js`; there is no `motion-reduce:` variant and no
`@media` block. `docs/ux-spec.md:253` requires "`prefers-reduced-motion` disables confetti, fades
reduce to 0ms". This is an **unimplemented requirement, not a violated one** — with zero motion every
value of the query produces identical output — and it becomes a real gap the moment any motion lands on
tier 3. Report it now.

### 5.2 What the preference means when the user cannot look away

`prefers-reduced-motion` is a statement about **vestibular comfort from large-area movement**: scaling,
parallax, spin, zoom, sweeping transitions. It is not a statement about attention, and it is not a proxy
for the live-service context. On tier 3 the context is the binding constraint, and it binds
**regardless of the query**:

- The performer is looking at the screen because the screen is the task. They cannot look away to let a
  transition finish, and they cannot re-run it.
- A transition that reads as "polish" on a desktop reads as **"did it change?"** to someone who cannot
  check.
- Worse, a performer who must verify the change *re-reads the whole chord chart*, because there is no
  other way to confirm it. The animation's cost is a full re-read of the most safety-critical content on
  the surface.

**The rule that follows:** on tier 3, **motion must never be the only signal that state changed.** The
changed state must be fully legible in the static frame that replaces the old one. With §4.2 rule 3:
never animate the opacity of primary content on either tier-3 surface.

### 5.3 The rule, stated

1. Tier 3 defaults to **motion-free**. Motion is an addition that must be justified per surface, not an
   inherited default.
2. When motion is added anywhere in the app, add `motion-reduce:` in the same change, to satisfy
   `docs/ux-spec.md:253`. On tier 3 it will be a no-op, which is the correct outcome.
3. Never let a reduced-motion path *delay* anything. Reduced motion removes movement; it does not add a
   settling period.
4. When in doubt on tier 3, ship it instant. Instant is never wrong here.

---

## 6. OPEN GAP — legibility at distance is unsourced in this repository

**This section is deliberately unfilled. It is a labelled open question, not guidance.** No number in
this file answers it, and none should be added without a source or a measurement.

### 6.1 What is sourced, and exactly where the sourcing stops

Sourced and loaded for this file: WCAG 2.2 SC 1.4.3 and SC 1.4.11 (URLs in §2.1), including the exact
thresholds, the large-text definition, the no-rounding rule, the Boundaries note, the hover note, and the
red-on-black protanopia rationale.

Where it stops: WCAG scopes itself to content that **does not emit light**, displayed under conditions the
author does not control. A projector emits light. WCAG models the opposite situation from a sanctuary. The
one place ambient light appears in SC 1.4.3 is a remark in "Notes on formula", not a requirement with a
number: "The ANSI/HFS 100-1988 standard calls for the contribution from ambient light to be included in
the calculation of L1 and L2." It points at the problem; it does not answer it. **No source in this
repository states a minimum type size at viewing distance, a minimum contrast ratio for a projected
image, or an ambient light threshold for a worship space.**

### 6.2 The specific facts that are missing

1. **Minimum character height as a function of viewing distance** for a chord chart read from the back of
   a room. WCAG's 24 px large-text threshold is a *contrast* threshold; do not quote it here.
2. **Minimum contrast ratio for a projected image.** Delivered contrast is (peak white) ÷ (projector black
   level + ambient), and the second term is set by hardware and the room. The app controls only the
   numerator.
3. **Ambient light in a sanctuary**: house lights up, a stage wash, coloured light on the wall behind the
   screen. No threshold exists in this repository.
4. **The encode path.** 3b is an OBS Browser Source, so the delivered image is re-encoded. What survives
   chroma subsampling at the bitrate a church stream typically runs is unstated here.
5. **Throw distance and lens softness**, and how much apparent type size that costs back once keystone
   correction and edge falloff are applied.

### 6.3 Who could answer, in descending order of value per unit of effort

| Source | Settles | Cost |
|---|---|---|
| **A real venue test** | 1–5 together, in the actual room | One service, real projector, watched from the back row |
| The projector's datasheet | 2 — the black level, the denominator | Free; the spec sheet is in the room |
| An AV integrator | 2, 3, 5 | One conversation |
| An occupational-therapy or low-vision clinic | 1, 2, 3. The Arditi & Knoblauch and Arditi & Faye literature WCAG cites is what a low-vision clinic uses, and it covers *spotlighting* — a dark room with a focused pool of light, which is the sanctuary condition. The citations are in the WCAG reference list; the guidance itself was **not** loaded here | One referral |
| SMPTE 431-2 (DCI-P3), ITU-R BT.1886 (EBU reference levels) | 2 — reference levels for projected and displayed luminance | Registration-gated; **not** loaded, **not** cited as authority here |
| Apple HIG | Nothing | It does not cover projection. Do not expect it to |

**The venue test is the right first move.** One service with the real setlist, real projector and real
house lighting, watched from the back row, answers more of this section than any document.

### 6.4 What to do in the meantime

Interim rules that are defensible **without** new data, and already implied above:

1. **Do not drop below WCAG AA on tier 3.** It is the only sourced floor here — a floor, not a target. Do
   not cite it as sufficient for projection.
2. **Prefer larger and fewer.** The smallest type on 3b is the `N / M` chip at 16 px
   (`OverlayView.jsx:38`) and the inactive notice at 16 px (`:23`); the smallest on 3a is `text-[10px]`
   (`StageMode.jsx:444`). **Add nothing smaller.** The 16 px chip is the first candidate to enlarge.
3. **Keep 3b monochrome plus amber.** Fewer hues means fewer encode artefacts and less reliance on hue
   discrimination — the variable the venue test would have to control for.
4. **Do not write the answer down until it is measured.** If someone returns from a venue test with a
   number, record it here with the conditions attached — projector model, throw distance, house lighting
   state, which element was being read. Then delete this section.
5. If a decision needs this section to proceed, **say so in the PR body and proceed on the interim
   rules.** Do not substitute a plausible number and attribute it to a standard. An invented number is
   worse than a red gate.

---

## 7. Findings index, and two gate bugs

Findings F-1 to F-7 are stated with their evidence in §3.1–§3.6 and §4.3. Three
further gaps, verified and reported rather than fixed (this unit produces a contract, not a migration —
`odd/tasks/visual-system-macos.md:75-78`):

| ID | Finding | Evidence |
|---|---|---|
| F-8 | `prefers-reduced-motion` required by `docs/ux-spec.md:253`, absent from the repo | zero matches in `src/`, `public/`, `index.html`, `tailwind.config.js` |
| F-9 | `docs/ux-spec.md:256` requires Stage Mode locked landscape on narrow devices; not implemented | zero `orientation` / `landscape` / `screen.orientation` in `src/` |
| F-10 | `docs/ux-spec.md:232-236` says settings and navigation chrome never appears in Stage Mode, but `StageMode.jsx:474` and `:683` render operator panels with selects | direct conflict, predates this skill |

### 7.1 The gate cannot currently certify 3b — and you must not fix that in the source

`bash scripts/check-visual-contract.sh` reports **2 failing**, both bugs in the gate rather than
violations in the source. Verified by running it and reproducing each cause.

- **Rule 03 fails on a line its own allowlist intends to excuse.** Hits are collected with `grep -noHE`
  (`scripts/check-visual-contract.sh:298`); `-o` prints only the **matched substring**, so the text handed
  to the allowlist check at `:311` is `className="rounded`, not the line, and the allowlist entry
  `rounded-full` can never match it. Reproduced: `printf 'className="rounded' | grep -q -- 'rounded-full'`
  does not match, so the `rounded-full` at `OverlayView.jsx:38` is counted unexcused.
- **Rule 04 reports 16 false "undeclared colour key" failures.** In the namespace-stack loop the
  `cem: {` line pushes the root at `:378` and then pops it in the same iteration — `skip_open` (`:390`)
  suppresses the push loop but not the pop loop (`:404-411`) — so every leaf is emitted bare (`base`,
  `surface`, …) instead of `cem.base` and none matches `TAILWIND_COLOUR_KEY_ALLOWLIST` (`:94-111`).

**Do not remove `rounded-full` from `OverlayView.jsx:38` to turn rule 03 green.** The badge is
deliberate, its reason is recorded at `scripts/check-visual-contract.sh:80-85`, and deleting a correct
element to satisfy a broken allowlist is the failure mode `AGENTS.md` prohibits.

Two ratchet ceilings were baselined against a different working tree: `RATCHET_01B_MAX=84` against a
measured 82, and `RATCHET_02_MAX=267` against a measured 252. Both still pass, but rule 01b has only **2**
occurrences of headroom — a spurious constraint on any change adding a `bg-black` or `text-white/*`. The
comment at `:66-72` cites `cem-rose 188, cem-emerald 72`; this tree measures 177 and 68.

---

## References

- `references/apple-macos-visual-language.md` — tiers 1 and 2; radius, depth, motion tokens (§6.4),
  load-bearing states (§7.6)
- `SKILL.md` — Hard Rules 4 and 5; the tier decision gate
- `scripts/check-visual-contract.sh` — the enforcement gate, and §7.1's known failures
- `docs/ux-spec.md` — §5 Stage Mode interaction spec, §6 accessibility baseline
- `odd/tasks/visual-system-macos.md` — the project constraints this file implements
- `tailwind.config.js` — the token declarations, including the five unused `cem.stage.*` tokens
- <https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html> — SC 1.4.3, loaded and verified
- <https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html> — SC 1.4.11, loaded and verified
