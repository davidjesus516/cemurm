# Judgment Day — CEMURM landing, round 1

**Target:** `92490a3fa652f6fe3362abbf62af15054abf5250` on `feat/landing-page`
**Content identity:** `2eebaf9220a3513594b6f8af185651c34860d4214c39a7b3f9910ede162a1377`
**Scope:** 21 files, frozen. `src/app/index.css`, `src/content/landing.es.js`, `tailwind.config.js`, `src/features/landing/**`.
**Requested lens:** design and UX (maintainer).
**Judges:** `jd-judge-a`, `jd-judge-b`, run blind and in parallel with identical scope and criteria. The named workers are not installed in this runtime, so both roles ran as `general` subagents with the skill's exact prompt and native result shape.

## Method both judges were held to

Read-only. No browser, no visual regression test exists in this toolchain, `pnpm typecheck` covers zero `.jsx`, and Vitest runs in `node` with no jsdom over `src/domain/**` and `src/integrations/spotify.js` only. **No landing component is covered by an automated test.** Every finding therefore rests on source, built CSS, gate output or arithmetic.

Both judges ran `pnpm lint`, `bash scripts/check-visual-contract.sh`, `pnpm test` and `pnpm build`, and audited every `className` token against the built CSS with backslashes stripped.

## Counts

| | |
|---|---|
| Findings returned | A: 17 (3 CRITICAL, 14 WARNING) · B: 29 (2 CRITICAL, 19 WARNING, 7 SUGGESTION) |
| **Confirmed, both judges** | **12** — 3 merged CRITICAL, 9 WARNING |
| **Suspect, one judge only** | **16** |
| **Contradictions** | **2** |
| INFO (SUGGESTION) | 7 |

**No finding was rated CRITICAL by both judges.** Corroboration is on the defect; severity below is the parent's merge, and the merge is stated for every disagreement.

## Confirmed, both judges

### C-1 · CRITICAL · Header's two accessibility fallbacks emit selectors nothing can match
`src/features/landing/components/Header.jsx:32-35`

`MATERIAL` carries `[@media(prefers-reduced-transparency:reduce)]:bg-cem-base/95` and the `@supports` twin. The built CSS contains a class whose escaped selector is `.` followed by the variant text verbatim, so the rule only applies to an element whose class attribute contains that text literally. Nothing renders it.

Verified by the parent:
```
@media(prefers-reduced-transparency:reduce){.[@media(prefers-reduced-transparency:reduce)]:bg-cem-base/95{background-color:#0f172af2}
```

The page's only functional-layer material therefore has **zero working reduced-transparency handling**. Apple §14 declares that signal mandatory. The sibling rule for `.cem-material` works correctly, but `grep cem-material` across the landing components returns **0**, because W4 deleted that class's last consumer.

Judge A rated this CRITICAL with the impossible-selector proof. Judge B found the same defect at the same lines but misdiagnosed the mechanism, reporting instead that the branch works and merely leaves the blur on. **The parent's merge takes A's proof**: the branch does not work at all, which is strictly worse.

### C-2 · CRITICAL · `transition-[background-color/backdrop-filter]` is invalid CSS
`src/features/landing/components/Header.jsx:74`

Verified by the parent:
```
.transition-[background-color/backdrop-filter]{transition-property:background-color/backdrop-filter;...}
```
A `/` cannot appear in `<single-transition-property>`, so the browser drops the declaration and the header has no transition at all. Tailwind emitted the class without error, so no gate, no lint and no build step can see it. Separately, on the three components combining `transition-all` with PRESS's `transition-transform` (`Header.jsx:106`, `Galeria.jsx:80`, `Accordion.jsx:74`), `.transition-transform` is emitted later at equal specificity and wins, so their hover fills snap instead of transitioning.

A WARNING, B CRITICAL. Merged CRITICAL: the page's sticky chrome does not animate.

### C-3 · CRITICAL · Three scroll listeners mutate state per event with no frame coalescing
`Landing.jsx:33-38`, `Header.jsx:59-63`, `Hero.jsx:57-69`

B quantified it: `offset = (min(scrollY, 0.6*vh)/vh) * 14`, so the entire parallax travel is **8.4px over 0.6 viewport heights**, the active frame multiplies by **0** and never moves, and the cost is a React render plus three re-targeted 200ms tweens per event. `IntersectionObserver`, `useScroll` and `ScrollTrigger` appear **0 times** in the landing. The skill calls this a hard ban, not a preference.

A WARNING, B CRITICAL. Merged CRITICAL.

### C-4 · WARNING · `SpecularButton`'s light sweep never runs
`SpecularButton.jsx:70-73`, `:87-89`. The strip sits at `-translate-x-full` with no `group`, `hover:` or `focus-visible:` variant anywhere in the file. Worse, `absolute inset-0 w-1/2` resolves to `left:0; width:50%` (the over-constrained `right:0` is ignored), so a permanent `from-cem-text/10` wash sits over the left quarter of every amber pill while a 300ms transition is paid for nothing. The component's own comment claims it "moves across the surface on hover".

### C-5 · WARNING · The hero and CtaFinal video backgrounds have never rendered
`Hero.jsx:176-190`, `CtaFinal.jsx:66-73`. `#hero` is `relative` with `z-index: auto`, which is not a stacking context, so the `absolute inset-0 -z-10` child paints in step 3 of the root stacking context, while `Landing.jsx:50`'s opaque `bg-cem-base` paints in step 4 and covers it. `VideoBG src=""` has no intrinsic height either. This is the same trap that killed the seven decorative gradients in W2/W3, and the code comment admits it and leaves it.

### C-6 · WARNING · `RevealText.jsx` is 297 unreachable lines
Zero importers. Exports `useLandingReady`, `HERO_LINE_HEIGHT`, `SECTION_LINE_HEIGHT`, `CLIP_RESERVE`, none read. Three files inside the target cite it as the authority for a pattern Hero implements with `MaskedHeading`. W4 proved eight components dead by import search and kept this one.

### C-7 · WARNING · The icon colour rotation is a no-op
`GlassIcon.jsx:60-72`. `COLORS` holds exactly `amber`, `amberLight`, `secondary`, `secondaryElevated`, and `COLORS[color] ?? COLORS.amber` swallows the rest. `Galeria.jsx:27` and `Features.jsx:23` pass `['amber','emerald','sky','rose','coral','violet']`; `Hero.jsx:143` passes `['amber','sky','emerald']`. **Every tile on the page is amber**, `violet` is not even a token, and `StageBus.jsx:206` claims the colour rotates.

### C-8 · WARNING · Below `sm` the email row stacks its icon above a field still indented for it
`Registro.jsx:87-97` and `CtaFinal.jsx:96-106`, identical. The wrapper is `flex-col ... sm:flex-row`, the `GlassIcon` is a fixed `h-12 w-12`, and the input keeps `pl-12`. On a phone that is a 48px decorative row above the field plus 48px of dead padding inside it.

### C-9 · WARNING · Neither form announces its result
`Registro.jsx:130`, `CtaFinal.jsx:134`. The feedback region is a plain `<div className="mt-4 text-center text-sm">`. `aria-live`, `role="status"`, `aria-invalid` and `aria-describedby` appear **0 times** in the landing. These forms are the page's only conversion path and the only state feedback it has.

### C-10 · WARNING · Copy promises machinery that does not exist
Two independent instances, one per judge. A: `landing.es.js:372-378` states in the present tense that a minor's guardian consent "se pide a un adulto, por correo, con un enlace de un solo uso" and that the account "permanece cerrada" until the adult answers. No such flow, mail path or account state exists; the only handler is `console.log`. B: `landing.es.js:320` tells the visitor "Algo salió mal. Intenta de nuevo." for what is exclusively a client-side `!email.includes('@')` check, implying a system failure where none occurred.

### C-11 · WARNING · The artificial curtain puts LCP past the budget
A computed it: `MIN_VISIBLE_MS` 1400 plus a 3-word stagger at 0.12s plus 1100ms per word finishes the hero `h1` at **2740ms**, against a 2.5s target, and **3940ms** on the `MAX_VISIBLE_MS` path. B independently flagged the same component for holding the first 1.4 to 2.6 seconds behind an opaque curtain with `lockScroll()`, against a page whose first surface is `#000000` while everything after it is `#0f172a`.

### C-12 · WARNING · Every mockup label and blurb is printed twice, ~40px apart
`Hero.jsx:123-134` and `:149-150`. Once inside the `DeviceFrame`, once in the caption row below the `figcaption`. A rated CRITICAL, B WARNING. Merged **WARNING**: duplicated copy is a quality deficit, not broken behaviour.

## Suspect, one judge only — recorded, not fixed

Per the gate, a one-judge report is a suspect and is not auto-fixed.

**A only (6):** `ClickSpark.jsx:146` `ctx.strokeStyle = sparkColor` receives the string `bg-cem-amber` at 5 call sites with `getComputedStyle` count 0, so the assignment is invalid and the sparks paint `#000000` on `#0f172a`. A rated this CRITICAL. **The parent verified the mechanism independently** and it holds; it is still suspect because B did not see it. · `StageBus.jsx:79-83` inactive panels at `opacity: 0.4` drop real copy to 3.51:1 and 2.09:1 · `Hero.jsx:97-113` frame fan crops the active frame · `Galeria.jsx:72-74` and `Accordion.jsx:66-68` glows clipped by `overflow-hidden`, so the three copies are inconsistent · `Header.jsx:121-125` the scroll scrim is zero-height and `.cem-scroll-scrim` has 0 consumers, so the hard `border-b` is what visitors actually see, and `Header.jsx:74` re-adds it on scroll · no `<label>` element exists anywhere in the landing, only placeholder plus `aria-label`

**B only (10):** `GlassIcon.jsx:76` the `border-*` half of every colour key is inert, `.border-cem-text/10` is emitted later at equal specificity · `Header.jsx:106` the hand-rolled CTA has no `whitespace-nowrap` and the nav goes two-line between 640px and ~700px · `Landing.jsx:35` the "one amber primary" invariant fails: the header CTA turns amber exactly when `Registro` and `CtaFinal`'s own amber buttons are on screen · `StageBus.jsx:185-191` the three view labels are exposed twice, and the `ClickSpark` handler is on a sibling div the buttons do not overlap, so clicking a label fires no spark · `Accordion.jsx:99` and `Galeria.jsx:111` animate `height`, the one property §6.A names first · `Hero.jsx:125` the caption row carries no breakpoint prefix at all · `Features.jsx:42-81` all six bento cells are the identical fill, failing the mandatory background-diversity rule · `GlassIcon.jsx:15-54` twelve hand-rolled SVG paths against an explicit ban, with the repo justifying the opposite on a zero-dependency budget (the only `inferential` finding either judge filed) · `IntroLoader.jsx:197` `bg-cem-stage-bg` is `#000000`, banned twice by the skill and borrowed from the OBS projector palette, which the visual system scopes to a different surface · `landing.es.js:313` "Unirme" and "Unirme a la lista de espera" are one intent with two labels, one line under a rule that says "A CTA says exactly what happens. Not 'Enviar'."

## Contradictions — escalated for human decision

1. **Hero frame crop.** A files it as a WARNING: `w-72` x3 minus two `-ml-12` is 768px against a 343px container at 375px, leaving ~26% of the active frame visible. B reports the identical hypothesis and then **explicitly discards it**: "My initial clipping hypothesis did not survive the arithmetic and was discarded rather than reported." Both are competent measurements of the same layout; one of them is wrong and neither shows working to settle it.
2. **Header reduced-transparency, mechanism.** A: the selector can never match, so nothing works. B: the branch works and leaves the blur on. The parent's own build settles it in A's favour, but the disagreement is recorded because B's reading is the one a maintainer skimming a report would take away.

## INFO, no action

7 SUGGESTION rows, all from B: 7 inline `style={{}}` in a Tailwind-only repo, 5 of them static · a decorative hairline carrying a transition that can never fire · `MaskedHeading`'s and `RevealText`'s clip-reserve assertions guard line-heights neither component ships · `canSpark` calls `matchMedia` twice per render and never subscribes · `CtaFinal` reads `landing.registro.input.*` so the two forms can drift · the mockup fan zeroes the active frame on every axis · `Landing.jsx` carries two byte-identical inline sections.

## Skill resolution

`paths-injected` — `/home/antony/.agents/skills/design-taste-frontend/SKILL.md`, `/home/antony/.agents/skills/apple-design/SKILL.md`, `/home/antony/.agents/skills/emil-design-eng/SKILL.md`, `skills/cemurm-visual-system/SKILL.md`. All four verified present before launch and read in full by both judges. Both reported the taste skill versus visual system conflict rather than silently resolving it, and both honoured the rule that forbids hand-rolled icon paths while recording the repo's contrary justification.

## Round 2 — scoped re-judgment and terminal verdict

Both judges ran again over this frozen ledger plus the immutable round-1 delta `92490a3..1b06d35`, seeing only those two inputs. **Unanimous: all twelve returned FIXED.** Neither trusted the fix commit's own claims; both recomputed the LCP arithmetic from the current constants, and both landed on 1860ms at the floor and 2460ms at the backstop against the 2500ms target.

Round 1 also created defects, which the re-judgment was entitled to record. Both judges independently found the same two, and round 2 (`6fd285e`) cleared them: the `PRESS` constant orphaned in `Accordion.jsx` and `Galeria.jsx` by the C-2 rewrite, which `no-unused-vars`' `varsIgnorePattern: '^[A-Z_]'` makes structurally invisible, and the prose across `Hero.jsx`, `Landing.jsx`, `Header.jsx` and `VideoBG.jsx` still describing the deleted video layer and parallax. Both judges also observed the tell that made this certain rather than a preference: the same commit rewrote `CtaFinal.jsx`'s equivalent comment to say it has no video, so `Hero.jsx` ended up arguing for and against one deletion inside one file.

One ledger finding was refuted and not applied. C-10's guardian-consent half was going to be rewritten as promising machinery that does not exist. Migration `0031_guardian_consent_email.sql`, the `send-guardian-consent` edge function, `minors.js` and `RequireGuardianConsent` in `AuthGuards.jsx` show the feature ships. Both judges read `Landing.jsx`'s `console.log`, which is the **waitlist** handler, and inferred the FAQ was fiction. The fix actor refused the edit; the parent confirmed with an independent grep.

```yaml
target_identity: 2eebaf9220a3513594b6f8af185651c34860d4214c39a7b3f9910ede162a1377
round: 2
confirmed:
  - C-1  # Header reduced-transparency, impossible selector -> real media queries, plus prefers-contrast added
  - C-2  # invalid transition-property, plus the equal-specificity cascade collision
  - C-3  # three per-event scroll listeners -> useScroll + IntersectionObserver, 8.4px parallax deleted
  - C-4  # SpecularButton sweep never ran -> group/group-hover variants
  - C-5  # video backgrounds painted behind the page fill -> dead layers removed
  - C-6  # RevealText.jsx, 297 unreachable lines -> deleted, citations rewritten
  - C-7  # colour rotation collapsed to amber -> permitted tokens only
  - C-8  # 48px icon row and dead pl-12 gutter below sm -> collapsed
  - C-9  # zero aria-live in the landing -> role=status + aria-invalid + aria-describedby
  - C-10 # error string implied a system failure -> now names the address
  - C-11 # h1 painted at 2860/4060ms -> 1860/2460ms
  - C-12 # label and blurb printed twice -> printed once
suspect: 16        # recorded, never touched
contradictions: 2  # frame-fan crop and the C-1 mechanism; both escalated, neither auto-resolved
info: 7
fix_work_units:
  - round1 # 12 units, 16 files, +444 -458, commit 1b06d35
  - round2 # 3 units, 6 files, comment and dead-declaration only, commit 6fd285e
scoped_rejudgment: not_run
terminal_state: approved
skill_resolution: paths-injected
```

`scoped_rejudgment: not_run` is deliberate. The second round changed two dead declarations and five comment blocks with **zero behavioural difference**, verified by all four gates green, `PRESS` at 0 references in both files, and the stale prose at 0. Spending another two blind judges on a delta with no runtime consequence would be ceremony, and the verdict shape admits `not_run` precisely for this case.

Two SUGGESTION items were recorded and **not** cleared, both from a single judge. The C-8 wrapper moves `GlassIcon` from a blockified flex item into a block container at the only two sites where it is not a direct flex child, and its unsized `svg` resolves renderer-dependently, so the rendered delta cannot be settled without a browser. The C-4 sweep is the landing's first hover trigger without a `(hover: hover) and (pointer: fine)` gate, so a phone tap plays a 300ms crossing; the reason it was left alone is that `Features.jsx` already carried an ungated `group-hover` at the frozen base, so the fix follows existing local practice rather than establishing a worse convention.

## What both judges agree is already right

Worth recording, because it is what the previous slices bought: the eyebrow count is exactly at budget (3 across 9 sections), the bento claims 8 of 8 cells with no empty one, six distinct layout families with none used more than twice, zero em-dashes or middle-dots in visible copy, zero Tailwind classes that emit nothing **except** C-2's invalid declaration, `inert` on both collapsed bodies, `aria-expanded` and `aria-controls` on all 12 accordion triggers, `:active:scale-[0.97]` on every pressable, `min-h-12` targets, `focus-visible` rings throughout, `motion` imported by exactly 8 files and no authenticated surface, and all four gates green with both ratchets exactly at ceiling.
