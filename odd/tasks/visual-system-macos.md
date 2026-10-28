# Visual system — macOS-led redesign rules for CEMURM's interfaces

## 1. Objective

Produce one project skill that encodes the visual rules for **every CEMURM interface** — the
marketing landing, the authenticated app, and the live Stage Mode surface — so that visual
decisions are made against a written, checkable contract instead of per-PR taste.

The direction is **the macOS / Apple design language**, chosen deliberately by the maintainer on
2026-09-28, keeping CEMURM's existing color essence: a dark ramp plus **one** amber accent
(`#f59e0b` family).

## 2. Problem

The visual rules for this project currently exist in three places and none of them is enforced:

| Where | State |
|---|---|
| `docs/design-system.md` | 464 lines, written 2026-09-06, **orphaned** — never implemented, and it describes a "warm, organized music binder", not a macOS system |
| `odd/tasks/cemurm-brand-landing.md` §5–§6 | On branch `feat/cemurm-brand-landing` only. 18+ commits behind `main`. Not on `main` |
| `tailwind.config.js` | 11 tokens, **6 borrowed straight from Tailwind**; `cem.stage.dim` defined with **zero usages** — the system anticipated a technique nobody executed |

Result: every surface invents its own spacing, radius, and accent usage, and `docs/master-plan.md`
already lists the refactor debt this causes.

A second, sharper problem: the two candidate reference sets disagree with each other, and with the
written plan. That disagreement has to be resolved on paper **before** any code moves, or PR 4
becomes an argument instead of an implementation.

## 3. The references, and what they actually agree on

Analyzed 2026-09-28. All four are dark-first with **one accent at full saturation spent in exactly
three places — logo mark, primary CTA, active/selected state — and nowhere else.**

| Reference | Medium | Accent | Signature technique |
|---|---|---|---|
| "Bloco — The Culture Engine" | Dribbble mp4, 24 s, 1600×1200@60, video-only | Red/orange | Giant accent-colored wordmark cropped by the page edge to close the page |
| "pulse" | Dribbble png, 752×564 | White CTA, green only for price deltas | Restraint; native iOS controls, dark UI on a light neutral mockup stage |
| "fever" | Dribbble png, 752×564 | Acid yellow, aggressively | Emissive glow on the mascot; full-saturation accent on logo + CTA + selected calendar day |
| "ChatFleek" | Dribbble mp4, 14.6 s, 1600×1200@30, **has audio** | Violet | Translucent panel over an organic background — the macOS *material* concept in CSS |

"fever" is the closest match to what the maintainer described. "ChatFleek" is the closest match to
the material/glass language. "Bloco" contributes one closing-block technique. "pulse" contributes
restraint, and is the least useful of the four for this project.

**Audio caveat:** the ChatFleek reel carries a real audio track (mean −22.4 dBFS, peak −9.5 dBFS)
and there is no transcription tool in this environment, so its sound design was not analyzed. Only
the Bloco reel was video-only.

## 4. Deliberate supersessions

This unit **replaces** two rules in the existing plan. They are recorded here so the change is
visible and reviewable, not smuggled in:

| Old rule | Source | New rule | Why |
|---|---|---|---|
| `border-radius: 0` in page structure; no gradient in structure | `odd/tasks/cemurm-brand-landing.md` §5.3, §9.4 | Continuous radii with a scale tied to component size; gradient permitted **only** in the logo mark and the accent surface | Apple's shape language is radius-first. All four references are radius-heavy. The maintainer authorized "un estilo rediseñado y moderno" on 2026-09-28 |
| Amber at full saturation "only on the performance surface" | same, §5.1 | Amber at full saturation on **logo mark, primary CTA, and active/selected state** | That is where all four references spend the accent. "Performance surface" was a guess; this is observed |

The **rejection** of the SaaS card kit (§6.3) **survives**. Card grids are not banned — the four
references use cards heavily. What is banned is *decorative* card chrome: identical soft shadow on
every surface, one radius everywhere, gradient washes, and cards used to fill space that content
could fill.

## 5. Scope

**In scope**

- `skills/cemurm-visual-system/SKILL.md` — thin activation + hard rules + decision gates
- `skills/cemurm-visual-system/references/apple-macos-visual-language.md` — the evidence base
- `skills/cemurm-visual-system/references/toolchain-options.md` — libraries and agent skills
- `skills/cemurm-visual-system/assets/tokens.css` — the additive token layer, ready to copy
- Registration in `AGENTS.md` and the skill registry

**Out of scope for this unit**

- Any change to `src/`, `tailwind.config.js`, or `src/index.css` — this unit produces the contract,
  not the migration. The migration is PR 4 in the landing route.
- Any external skill installation. This unit *recommends*; installation is a separate human decision.
- Touching the landing's 13-section structure, hero spec, or copy rules. Unchanged.

## 6. Constraints

1. **Tailwind stays 3.4.19.** Do not flip `checkJs`, do not bump Tailwind to 4.
2. **No animation library in the authenticated bundle.** Project rule, not preference.
3. Bundle budgets: landing ≤120 kB gzip, largest chunk ≤150 kB gzip.
4. **JSX, not TSX.** The codebase is plain JS. Tailwind only — no CSS modules, no styled-components.
5. The token layer is **additive**: `cem.emerald`, `cem.rose`, `cem.sky`, `cem.secondary`,
   `cem.elevated`, `cem.hover`, `cem.amber` must survive intact. Only `cem.coral` goes to zero.
6. **Do not touch** `docs/master-plan.md`, `supabase/migrations/`, or `scripts/smoke/` — uncommitted
   owner work-in-progress was present in the working tree when this unit started (the 0029→0033
   feedback-migration renumber and its smoke test). All commits in this unit use explicit pathspecs
   so that work cannot ride along.

## 7. Tasks

- [x] **T1** — Analyze the four references, extract the shared rule set. *Done, §3 above.*
- [x] **T2** — Extract Apple HIG materials/color/type/layout/shape/motion/controls/dark-mode
      specifics with provenance into `references/apple-macos-visual-language.md`. *Done, 978 lines.*
- [x] **T3** — Research component libraries, motion approaches, color tooling, and external agent
      skills with verified numbers into `references/toolchain-options.md`. *Done, 608 lines.*
- [x] **T4** — Write `SKILL.md`. *Done: 61 lines, 404 words of body, four tiers.*
- [x] **T5** — Write `assets/tokens.css`. *Done, 133 lines, 52 custom properties.*
- [x] **T6** — Register the skill in `AGENTS.md`. *Done, new "Visual system" section.* The
      `.atl/skill-registry.md` refresh is deferred: it scans only the global skill directories
      (`~/.agents/skills`, `~/.config/opencode/skills`, `~/.claude/skills`, `~/.codex/skills`) and
      does not index a project-local `skills/`, so a refresh would not pick this up. The
      `AGENTS.md` registration is what makes it discoverable in-repo.
- [x] **T7** — Verify. *Done, §13.*

## 8. Acceptance criteria

1. `SKILL.md` body is 180–450 tokens, frontmatter is single-line and quoted, sections are in the
   order Activation Contract → Hard Rules → Decision Gates → Execution Steps → Output Contract →
   References.
2. Every `references/` link in `SKILL.md` resolves to a file that exists.
3. Every numeric value in the references is either traced to a loaded source page or explicitly
   marked unverified. No invented HIG URLs, no invented licenses.
4. `assets/tokens.css` contains no hardcoded value that duplicates a pre-existing `cem-*` token, and
   introduces no token that removes one still in use.
5. `git status` shows no change outside `skills/cemurm-visual-system/` and `odd/tasks/`.
6. The four supersessions in §4 are stated in the skill, not only in this file.

## 9. Applicable checks

This unit adds no production code and no test surface.

```bash
pnpm typecheck && pnpm lint && pnpm build
```

Run as a regression guard only — the unit must not change build behaviour, and `typecheck` is
absent from CI so it must be run locally. Additionally:

```bash
grep -roE 'cem-(coral|emerald|rose|sky|secondary|elevated|hover|amber)\b' src/ | wc -l
```

Must be **unchanged** from the pre-unit count, except `cem.coral` is not touched at all in this
unit. This is the check that replaces a visual baseline.

## 10. Route

| Task | Route | Trigger evidence |
|---|---|---|
| T1 | inline | 3 files read, already-understood, no research beyond the media itself |
| T2 | delegated | 8 HIG pages to load and compress; the knowledge must not land in the parent |
| T3 | delegated | 11 skill candidates to verify against GitHub plus 9 component libraries |
| T4, T5 | inline | thin, mechanical once T2/T3 land; the decisions are already made in §4 |
| T6, T7 | inline | bounded state and command checks |

## 11. Progress and next step

**Next step:** T2 and T3 are running. On return, write T4 and T5, then T6 and T7.

**Open risk:** the references are four iOS/marketing concepts, and none of them is a dense
data-entry product. CEMURM's tables, chord grids, and setlist editors are the real stress case and
the references say nothing about them. If T7 surfaces that gap, the honest fix is to say the skill
covers chrome and surfaces but not dense grids, rather than to invent guidance and present it as
Apple's.

## 12. Enforcement gate — what it blocks and the measured baseline

`scripts/check-visual-contract.sh` makes §8's contract checkable. Bash and grep only: no install
step, no test runner, no build. It runs in CI between `pnpm lint` and `pnpm test`, and locally via
`pnpm check:visual`. Every check prints `PASS` / `FAIL` / `WARN` with a count; a failure names the
file and line. Paths resolve from the script location, so it runs from any working directory.

Each rule is `enforcing` (any count above 0 fails), `ratchet` (current count tolerated, exceeding
the ceiling fails), or `report` (counted, never fails). The mode is one declaration per rule in the
`RULE MODES` block, next to its ceiling, so whether a rule can fail is readable in one place.

| Rule | Mode | Baseline | Why that mode |
|---|---|---|---|
| 01a raw colour literals in `src/` (`#hex`, `rgb()`, `hsl()`, `oklch()`, …) | enforcing | **0** | Correct count today, so it can be a hard zero |
| 01b Tailwind default-palette utilities in `src/` (`bg-black`, `text-white/70`, …) | ratchet | **82** in 5 files | Real token bypass, but 82 uses exist today |
| 02 the four dead accents in `src/` | ratchet | **252** in 35 files | Correct in principle, false today — see below |
| 03 chrome-free projector surface | enforcing | **0** unexcused, **1** allowlisted | Correct count is 0 once one exception is named |
| 04 token palette may not grow | enforcing | **0** undeclared of **16** keys | Adding a fifth accent must be reviewable |
| r1 `StageMode.jsx` chrome | report | **30** `rounded*`, **2** `shadow*` | Legitimate on a touch surface; tracked, not blocked |
| r2 declared token count | report | **16** | Makes palette growth visible in the log |

**Correction to the task brief.** The brief stated all four dead accents have **0** usages. That
figure came from grepping `cem.rose` (the JS object form). In JSX the tokens are used as Tailwind
classes, and `cem-rose` has **177** uses, `cem-emerald` **68**, `cem-sky` **7** — **252** across
35 files. A gate written against the brief's pattern would have reported 0 and passed while 252
violations stood, which is the exact false confidence a gate must not create. The pattern now
matches both forms. §6 constraint 5 also requires these tokens survive intact, so their usages
cannot reach 0 without a deliberate decision to change that constraint — which is why rule 02 is a
ratchet and not a zero: the existing 252 stand, and no new use is admitted.

**Rule 03's one exception** is `rounded-full` on the `N / M` position chip,
`src/features/stage/components/OverlayView.jsx:38`. A bounded data-bearing counter, not decorative
furniture, and it carries no shadow, gradient, or backdrop filter — the three things that actually
degrade through a projector and an H.264 encode. It is a named, commented allowlist entry that
prints on every run, not a loosened rule.

**Deliberate violations were introduced and reverted to confirm each rule can fail.** Verified
2026-09-28: a hex literal (01a), a `bg-slate-800` (01b), a `cem-coral` class (02), a
`className="rounded-xl shadow-2xl"` and a class name in a variable (03), a flat `cem.indigo` and a
nested `cem.stage.alert.bg` (04). Each produced `FAIL` with a file and line and exit 1; each
reverted to `PASS` and exit 0. Comment prose in the overlay files was confirmed **not** to trip
rule 03, since those files are about being chrome-free and will document the rule inline.

**Deviation from §5 and §8.5.** This unit's scope said no change outside
`skills/cemurm-visual-system/` and `odd/tasks/`, but an enforcement gate cannot live there: it adds
`scripts/check-visual-contract.sh`, one CI step, and one `package.json` script (`check:visual`,
not on the critical path — CI invokes the script directly). No file under `src/`,
`tailwind.config.js`, `docs/master-plan.md`, `supabase/migrations/`, or `scripts/smoke/` was
changed; the overlay and config edits above were temporary probes, each reverted and
byte-compared against a backup.

**Promotion path.** When a ratchet or report count reaches 0, set that rule to `enforcing` and
delete its ceiling. Rule 02 reaching 0 also requires revisiting §6 constraint 5.

## 13. Verification evidence, and what the unit found

All numbers below were measured on `feat/visual-system-macos`, not taken from a worker's report.
Three of my own earlier measurements were wrong and are corrected here.

### Deliverables

| File | Lines |
|---|---|
| `skills/cemurm-visual-system/SKILL.md` | 61 |
| `skills/cemurm-visual-system/assets/tokens.css` | 133 |
| `skills/cemurm-visual-system/references/apple-macos-visual-language.md` | 978 |
| `skills/cemurm-visual-system/references/tier-3-performance-surfaces.md` | 544 |
| `skills/cemurm-visual-system/references/toolchain-options.md` | 608 |
| `scripts/check-visual-contract.sh` | 449 |

`SKILL.md` sections are in the style-guide order; all four `references/`/`assets/` links resolve.
`SKILL.md` body is 404 words, inside the 180–450 target.

### The gate was made to fail on purpose

| Injected | Result | Exit |
|---|---|---|
| `rounded-xl shadow-2xl` into `Overlay.jsx` | `FAIL 03` | 1 |
| `const BRAND = "#ff0000"` into `src/` | `FAIL 01a` | 1 |
| both reverted | `OK (7 rules, 0 failing)` | 0 |

`Overlay.jsx` verified byte-identical to `HEAD` afterwards. A gate that has never been seen to fail
is not a gate, so this is recorded rather than assumed.

### Corrections to figures I stated earlier in this session

1. **The four accents are not dead.** I grepped `cem.rose` — the JS object form — and got 0. JSX
   emits hyphenated Tailwind classes. Real counts: `cem-rose` **177**, `cem-emerald` **68**,
   `cem-sky` **7**, across 35 files. `cem-coral` **0** is the only genuinely dead token. A gate
   written to my original spec would have printed `0` and gone green over 252 standing violations.
2. **`cem.stage.*` is 100% unused.** I annotated the token layer as "already in production and
   proven against a real projector". Both halves were false. `grep -rn "cem-stage" src/` → 0. The
   projector surface runs on Tailwind's *default* palette: `StageMode.jsx` has 42
   `bg/text/border-black|white` utilities, `OverlayView.jsx` has 7. Adopting the namespace is a
   class-name rename with no intended colour change, and nothing is legibility-tested.
3. **The glyph count is disputed three ways** — plan says 14, one grep says 15, the extracting
   worker says 43. None is verified; none is repeated as fact anywhere in the deliverables.

### Findings recorded, deliberately not fixed here

Per the standing rule that a red test is fixed in the source but a *finding* gets reported rather
than smuggled into an unrelated unit, these are left for their own slices:

| Finding | Evidence |
|---|---|
| `cem.secondary` fails contrast in production | **2.96:1** on `cem.hover` `#475569`, **4.04:1** on `cem.elevated` `#334155`. Both under the 4.5 AA text floor |
| Text on an amber fill is unreadable | `#f8fafc` on `#f59e0b` = **2.05:1**. An amber button needs dark text: `#0f172a` = 8.31:1 |
| The landing plan contradicts itself | §9.5 wants `emerald/rose/sky` gone from the config; §9.13 wants their usage counts identical. With 252 usages these cannot both hold |
| Stage Mode has three radii for one button | `StageMode.jsx:399,432,452,460,656,767` (4 px) vs `:514,526,552,697,743,755,794` (6 px) vs `:641,669` (8 px) — the 8 px outliers are Prev/Next, the most important controls |
| Both Stage Mode elevation cues are inert | `shadow-xl` at `:474` and `:683` are `rgb(0 0 0 / 0.1)` over `bg-black`, compositing to `#000000`. Zero visible delta |
| No `focus:` or `active:` states anywhere | Zero in all of `src/`, against `docs/ux-spec.md:250` |
| `prefers-reduced-motion` required but absent | `docs/ux-spec.md:253` requires it; absent from `src/`. `assets/tokens.css` now provides it |
| Three conflicting song-change budgets | 150 ms / 90 ms / 80 ms in the docs |

### The negative results that shape the design

- **Apple publishes no numeric corner radius, spacing scale, elevation ladder, or motion duration.**
  Only two corner *styles* exist (`circular` / `continuous`); "squircle" does not appear on the
  HIG. Every such token is a project decision, tagged as one.
- **`corner-shape` is unavailable on Safari iOS and Firefox Android** (verified against
  `@mdn/browser-compat-data`; Chrome 139, `safari_ios: NO`, `firefox_android: NO`). The macOS squircle
  cannot ship natively. `backdrop-filter`, which carries the same visual language, is available
  everywhere (Safari iOS 18, Firefox Android 103). `animation-timeline` is **not** on Firefox
  Android and needs a guard.
- **The macOS agent-skill ecosystem is not trustworthy**: five candidates totalling 2,529 stars,
  two unlicensed, one archived, one seven months stale, against 178,684 stars for the best generic
  skill. Three orders of magnitude. It is thin because the good guidance is Apple's own prose, which
  is why this project encodes it directly with citations.
- **Legibility at distance cannot be sourced from WCAG.** WCAG 2.2 scopes itself to content that
  "does not emit light" and its 24 px threshold is a contrast threshold, not a distance one. §6 of
  the tier-3 reference is therefore a labelled open question with six ranked candidate sources and
  interim rules. No invented numbers. WCAG *did* supply one usable fact: the red-on-black
  protanopia rationale, which is why `cem.rose` is barred from the projector surface.

### Budget, measured

`pnpm build` → one chunk, `232,032 B` gzip. That is **82 kB over** the 150 kB ceiling in §9.13, and
the 120 kB landing ceiling is unreachable until code splitting happens. This unit does not attempt
it; the contract it produces is the prerequisite, not the fix.

### Still open

The dense-grid gap named in §11 held. All four references and the Apple HIG cover chrome and
surfaces; none covers a dense editable data grid at 40 rows. The skill covers tier 1, 2, 3a and
3b and says so rather than inventing guidance and attributing it to Apple.

## 14. How this unit ships — two chained PRs

The unit is 3,374 lines against a repo budget of 400 per PR, so it is cut in two:

| PR | Branch | Base | Contents | Lines |
|---|---|---|---|---|
| 1 | `feat/visual-system-macos-pr1-gate` | `main` | the gate, its CI step, the `check:visual` script entry | 457 |
| 2 | `feat/visual-system-macos-pr2-contract` | PR 1 | `SKILL.md`, `assets/tokens.css`, the three references, the `AGENTS.md` registration, this file | 2,661 |

The cut is drawn where the dependency is, not where the line count is convenient. `SKILL.md`
references all three reference files, so shipping it in PR 1 would leave four dead links and would
put a skill in the repo whose evidence base has not been reviewed. PR 1 is therefore the gate alone:
self-contained, independently useful, and enforcing rules that are already true. It was verified in
isolation — gate green, typecheck clean, lint clean, 235 tests passing, three files touched.

PR 2 is still 6.7x the budget and cannot be cut further without breaking the skill's own structure,
because every file in it is referenced by `SKILL.md`. 2,130 of its 2,661 lines are the research
references, and those are the part that needs review, because they assert what Apple does and does
not publish.

Unrelated to this unit, and preserved untouched on its own branch: `a879d3e`, the maintainer's
feedback-migration renumber to `0033`, which had landed on the working branch while the unit was in
progress. It is on `feat/feedback-0033-renumber` and appears in neither PR.

## 15. Rule 05 — the contrast rule added to the gate

Added to `scripts/check-visual-contract.sh`, which lands in **PR 1** (`75cb813`) — it is a change to
the gate, and the gate is PR 1's whole subject. This note rides in PR 2 because the task record does.
It computes the WCAG 2.x contrast ratio for every foreground-token-on-background-token pair in
`tailwind.config.js` and prints the full 7 × 4 matrix. Token values are parsed from the config at run
time, so editing a hex changes the reported number on the next run; there is no second copy of the
palette to drift.

| Sub-rule | Mode | Baseline | Why that mode |
|---|---|---|---|
| 05a `cem.text` on every background | enforcing | **0** of 4 | Passes today, and it is the checker's own self-test |
| 05b every other fg/bg pair | report | **12** of 28 under the floor | Correct in principle, false today — see below |

**The floor is 4.5:1**, the AA normal-text threshold (SC 1.4.3), not the 3:1 that SC 1.4.3 allows
for large text. A token is not size-aware: the same `cem.secondary` is 14px body copy in one
component and a large stage label in another, and a static config-level check cannot tell them
apart. Judging everything at 3:1 would pass a regression that only ever surfaces in small text.
Over-strict on a large label is a cosmetic over-warning; too lax on 14px copy is an accessibility
defect. The strict figure is the cheaper mistake.

**The measured matrix, 12 of 28 pairs under the floor:**

| fg \ bg | base | surface | elevated | hover |
|---|---|---|---|---|
| text | 17.06 | 13.98 | 9.90 | 7.24 |
| secondary | 6.96 | 5.71 | **4.04** | **2.96** |
| amber | 8.31 | 6.81 | 4.82 | **3.53** |
| emerald | 7.04 | 5.77 | **4.08** | **2.99** |
| rose | 4.86 | **3.98** | **2.82** | **2.06** |
| sky | 6.44 | 5.28 | **3.74** | **2.73** |
| coral | 6.37 | 5.22 | **3.69** | **2.70** |

This confirms and extends the `cem.secondary` finding already in §13 from two hand-computed cells to
a full matrix. The one that matters for a human decision is still `cem.secondary` at **2.96:1** on
`cem.hover` — it is body text, and it has 318 usages across 41 files, so correcting it is its own
unit and not a change this gate should make. The four accent rows are lower still, but rule 02
already holds them at 252 usages and they are on the retirement path, so tightening them now would
be theatre. No token value was changed.

**05b is report, not enforcing, and the count is the reason.** Promoting it today fails CI on its
first run over debt that predates the gate, and a gate that is red on arrival gets deleted. As a
report it is a ratchet in waiting: the number is visible in every run, a token change that makes it
worse shows up in the diff of this output, and when it reaches 0 the rule is promoted to enforcing
and becomes a regression guard for free.

### Three defects found by making the checker fail on purpose

A contrast checker that always passes is worse than no checker, so 05 was made to fail three ways.
Two of the three were bugs in this rule, found only because it was tested against a known-bad tree.

1. **The `-v` flags must precede the program text.** Passing the parameters as bare `name=value`
   operands looks correct and silently scores **0 pairs**: an assignment operand is applied when awk
   reaches it on the command line, which is after `BEGIN` has already run, so `split(fgs, …)` inside
   `BEGIN` sees an empty string. `--assign` has the same defect, and `-v` placed after the program is
   read as an input filename. The output was a clean `PASS 05a  0 occurrences` over a check that
   never ran — no error, no warning, no crash. This is the exact false confidence §12 records for
   rule 02, reached by a different route.
2. **The sRGB offset was dropped from the power term.** `pow(c, 2.4)` instead of
   `pow((c + 0.055) / 1.055, 2.4)` makes every channel too dark and every ratio too *high*:
   `cem.text` on `cem.base` reported **18.74** instead of **17.06**. Same class of failure, opposite
   direction — a palette that genuinely fails the floor gets reported as passing. Caught by
   diffing the matrix against a reference table, not by reading the code.
3. **An unreadable token is not a passing token.** A cell that cannot be scored is counted into
   05a's findings, so the enforcing rule fails on an incomplete matrix rather than reporting 0. Also
   verified: a 3-digit hex (`#fff`) normalises to its 6-digit equivalent, and a value the parser
   cannot read — `'var(--cem-text)'`, `'rgb(148 163 184)'` — is skipped with a `WARN` naming the
   path and the exact value, never guessed at and never silently dropped.

**Verification, all on this branch.** `bash -n` clean; `shellcheck -S warning` clean; gate `OK`,
exit 0, 9 rules checked, every pre-existing rule byte-identical in mode and count. Vacuous-pass test:
`cem.text` set to `#0f172a` gave `FAIL 05a  4 occurrences` with all four cells listed and exit 1,
and 05b rose 12 → 16 consistently, then reverted with the config byte-compared against its backup
and `git diff --stat` empty. `pnpm lint`, `pnpm test` (235 passing), `pnpm typecheck` and
`pnpm build` all green. `tailwind.config.js` is untouched; no token value was changed to make a
check pass.

## 16. `cem.secondary` on a raised fill — the measured defect, and the token that answers it

§13 recorded the finding (`cem.secondary` at 4.04:1 on `cem.elevated`, 2.96:1 on `cem.hover`) and
§15 deliberately did not fix it, on the reasoning that it has 318 usages and is therefore its own
unit. This is that unit.

**The value of `cem.secondary` is unchanged.** The minimum value clearing all four backgrounds is
`#c7d0da`, which would lift it to near-white and collapse its hierarchy against `cem.text`
(#f8fafc) on all 318 usages, 302 of which sit on `base`/`surface` where it already measures
6.96:1 and 5.71:1. Fixing 16 by changing 318 is a bad trade. Instead the palette gained one
additive token, `cem.secondary-elevated` = `#b0bccb` (**5.38:1** on elevated, 9.27:1 on base),
following the `cem.stage.dim` precedent of a token introduced for one measured need rather than a
rename of an existing one. `cem.secondary` still measures 6.96 / 5.71 / 4.04 / 2.96, byte-identical
to §15's matrix.

### The audit's 16 was a lower bound, and the true same-element figure is 52

A same-element check over `src/` finds **52** sites, not 16, in **27** files. The audit counted only
the sites where the class string is written **directly into a `className=`**; **21 of the 52 write
it somewhere else entirely**, and not one of the 16 is among those 21 — verified line by line, all
16 carry `className=`:

| Form | Count | Example |
|---|---|---|
| Class string written into a `className=` on the element | 33, of which the audit listed 16 | `CaseDetail.jsx:105` |
| **JS object style-map entry, interpolated into an element** | **13** | `GigCard.jsx:7` `cancelled: 'bg-cem-elevated text-cem-secondary'` |
| **Conditional branch inside a `className` template** | **7** | `PdfChartViewer.jsx:102` `zoom === p ? … : 'bg-cem-elevated …'` |
| **Module-level `const` reused on elements** | **1** | `ServiceDetail.jsx:44` `keyBadge`, applied at `:310` and `:744` |

The style-map form is not a near miss — `GIG_STATUS_STYLES[status]` is interpolated straight into a
`<span className=…>`, so it is the same element carrying the same two classes, and a
`grep`-shaped method cannot see it. A further 3 lines (`Auth.jsx:7`, `GuardianConsentRequired.jsx:19`,
`SongForm.jsx:8`) pair `disabled:bg-cem-elevated` with `placeholder:text-cem-secondary` and are
**excluded from rule 06 on purpose**: a placeholder on a `bg-cem-surface` input measures 5.71:1 and
passes, and WCAG SC 1.4.3 exempts an inactive component.

**Remedy, per site, by what the element is.** 5 are real sentences and error text and became
`text-cem-text` (9.90:1 on elevated): `Moderation.jsx:26`, `Notifications.jsx:113`,
`RehearsalDetail.jsx:215`, `EnrichmentPanel.jsx:201` (carries `role="alert"`),
`ServiceDetail.jsx:560`. The other 47 are chips, badges, column headers and button labels and
became `text-cem-secondary-elevated`, which keeps them recessive — correct for a label — while
clearing the floor. No element was restructured: all 52 lines differ from `HEAD` by the colour
token and nothing else, verified pairwise. With the 2 descendant sites below the totals are
**49 `text-cem-secondary-elevated` + 5 `text-cem-text` = 54 class-name changes across 27 files.**

**One site was rejected as a false positive.** `SongForm.jsx:355` pairs an unprefixed
`text-cem-secondary` with `file:bg-cem-elevated`, but `file:` addresses the
`::file-selector-button` pseudo-element while the element's own text keeps the colour its
unprefixed utility set, and that pseudo-element's text is explicitly `file:text-cem-text`. Two
different boxes. Rule 06 therefore omits `file:`, `marker:` and `selection:` from its background
side, and a gate that flagged it would be training maintainers to ignore it.

### Rule 06, and what it cannot see

`RULE_06_SECONDARY_ON_RAISED_FILL=enforcing`, baseline 0. It reuses rule 03's `COMMENT_PATTERN`
verbatim — the `^[^:]*:[0-9]+:` prefix anchors identically for a recursive `grep -rnH` scan, which
is why the file/line is printed on failure — and rule 01a's `SOURCE_INCLUDES`, so the file set
cannot drift. It is a pipeline of two greps because the rule is an AND; a single grep with both
alternatives would be an OR and would report every secondary label in `src/`.

Proven to fail four ways, each reverted and byte-compared: the original defect reintroduced at
`Moderation.jsx:26` and at `Notifications.jsx:113`; a style-map violation at `GigCard.jsx:7`; and a
`hover:bg-cem-hover` pairing that uses neither the state nor the token the fix relied on. Each
produced `FAIL 06` with file and line and exit 1, and exit 0 after revert.

**05b went 12 → 13, and that is the intended consequence, not a weakening.** The new token enters
the matrix on its own merit and contributes exactly one under-floor cell, `secondary-elevated` on
`hover` at 3.93:1 — the same `cem.hover` column every other colour already fails. Scored pairs
28 → 32. The floor was not moved and the rule stays `report`, which is precisely why 05b is
report-only: a new token must not be able to redden the build. **No `cem.hover` site was fixed**,
because no raised fill in `src/` is `cem.hover` at rest; the 87 `hover:bg-cem-elevated` sites were
fixed against the elevated token, which is the fill they actually use. What 05b still reports at
13 is dominated by the four accents rule 02 is retiring, and by the two `cem.secondary` cells that
this unit deliberately left in place. `r2` went 16 → 17 tokens; that is the report-only inventory
doing its job.

### Descendant exposure: measured, and 2 of 4 fixed — the defect is NOT closed

The 56 changes are all same-element. A child can inherit a raised fill from an ancestor, and a
grep cannot see that, so it was measured rather than assumed. Method: a JSX-nesting scan per file
that keeps a stack of open elements, takes each `text-cem-secondary` element's **nearest painted
background** (its own, else the nearest ancestor's), and flags it when that background is
`cem.elevated` or `cem.hover`. It is a lexical scan, not a DOM: containment within one file is
exact, but see the error bars.

**6 candidates before the fix, 4 after, and 2 of the 6 were real defects — both now fixed:**

| Site | Ancestor fill | Verdict |
|---|---|---|
| `SongDetail.jsx:856` "Transition history" | opaque `bg-cem-elevated` | **4.04:1, FAIL** → fixed |
| `SongDetail.jsx:867` "Played at · demand N" | opaque `bg-cem-elevated` | **4.04:1, FAIL** → fixed |
| `Notifications.jsx:195,196,199` | `hover:bg-cem-elevated/40` | composites to `#1d283b`, **5.00–5.78:1, pass** |
| `ReportDialog.jsx:109` | `bg-cem-elevated/50` | composites to `#212c40`, **4.83–5.47:1, pass** |

The last four are why the raw tool output must not be read as a defect count: the scan does not
resolve alpha, so it labels all six `cem-elevated`. Composited against `base` and `surface` they
land at or near `cem.surface` and clear the floor. **They are reported as passing on the
composited value, which is a judgement, not a measurement of the rendered pixel** — a backdrop
darker than `base`, or a `bg-cem-elevated/40` over a raised parent, would move them. They are left
unchanged and recorded here so the judgement is reviewable.

**Error bars, so this is not mistaken for a complete census.** The 2 confirmed are a hard count: each
was read by hand, in context, with its ancestor chain. The bounds around the rest:

- *Closed, measured 0:* `clsx`/`classnames` helper composition — 0 occurrences in `src/`, so no
  className is assembled in a way this scan cannot resolve. Containers whose raised fill comes from
  a module-level `const` — 3 exist (`GigDetail.jsx:10`, `ServiceDetail.jsx:35,44`), all self-closing
  button/badge styles that wrap no children, and all three already carry a compliant text token.
  The cross-file hole — a component that paints `bg-cem-elevated` and receives `children` from a
  caller's file, which no per-file scan can connect — resolves to **1 candidate** repo-wide
  (`GigForm.jsx`), and its `{children}` sits in a plain `<div>` with no fill, so 0.
- *Open, not measured:* classNames arriving through a prop spread into a child's `className`; a
  raised fill set by a CSS rule rather than a utility; and any composition through a helper
  introduced later. Each is 0 today and unquantified by construction.
- *Not covered by this scan at all:* descendants of a container in a **different file** beyond the
  `{children}` case above, and any runtime-composed class name.

**So: the same-element defect is closed and gated; the descendant exposure is measured at 2 real
defects, both fixed, with 4 sites that pass only once alpha is composited; and a structural blind
spot remains that this method cannot close.** Rule 06 is a same-element check by construction and
its 0 means "no same-element pairing", never "the contrast defect is closed". The honest summary is
that `cem.secondary` is still 4.04:1 on `cem.elevated` and 2.96:1 on `cem.hover` as a *token* — 05b
still reports both — and what changed is that no element in `src/` pairs it with a raised fill
anymore.

### Deviations, and one forced gate change

- **The changed file set is 27 source files, not the 12 the brief listed.** The brief's 12 follows
  from its 16, and both undercount by the mechanism in the first table above. Fixing only the 16
  would have left rule 06 unable to reach baseline 0 without narrowing the rule to ignore the
  style-map form, which would have been a gate written to pass rather than to catch. No file
  outside these 27, `tailwind.config.js`, the script, and this record was touched.
- **Rule 04's key parser was widened, from necessity rather than preference.** A JS identifier
  cannot contain a hyphen, so `secondary-elevated` must be a quoted key, and rule 04's
  `leaf_regex`/`leaf_value_regex` only matched bare `[A-Za-z0-9_]+`. The consequence was not a
  missed warning: rule 05 could not read the value either, so the new token printed `n/a` in the
  matrix and **05a failed with "matrix is 4 scored cell(s) short"** — the anti-vacuous-pass guard
  doing its job on my own change. The regexes now accept an optionally-quoted, hyphenated key,
  with the quote characters non-capturing so `BASH_REMATCH[1]`/`[2]` are unchanged. This makes
  rule 04 **stricter**, not weaker: it now catches a key shape it previously ignored entirely.
  Proven by injecting `cem.indigo` (`FAIL 04`, "undeclared colour key \"cem.indigo\"") and
  `cem.warning-ink` (`FAIL 04`, the new quoted shape), both reverted and byte-compared.
- **Two bugs in this unit's own new code, both found by running the gate rather than by reading
  it.** The rule 06 patterns used `\d`, which is not POSIX: under this machine's `es_VE.UTF-8`
  locale GNU grep printed `warning: \ sobrante después de d` and degraded the class. It is now
  `[[:digit:]]{1,3}`, matching the script's existing convention. The descendant scanner's first
  version blanked comments with `''`, which shifted every reported line number after the first
  block comment and mislabelled two findings onto unrelated `text-cem-rose` paragraphs; it now
  blanks them with equal-length whitespace so offsets survive. The first classifier also indexed
  the wrong capture group and reported **0 violations across all of `src/`** — a vacuous pass of
  exactly the kind §13 warns about, caught only because 0 was implausible next to a known 16.
- **A gate value changed that this unit did not intend to change.** `\d` → `[[:digit:]]` touches
  only rule 06's new patterns. No pre-existing rule's mode, floor, ceiling or count moved: 01a 0,
  01b 82, 02 252, 03 0 + 1 allowlisted, 04 0, 05a 0, r1 30, and 05b 12 → 13 for the reason above.

**Verification.** Gate `OK`, exit 0, **10 rules checked, 0 failing**. `bash -n` clean,
`shellcheck -S warning` clean. `pnpm typecheck`, `pnpm lint`, `pnpm test` (**235 passed, 235 — no
test was edited; a failing test would have been fixed in the source**), `pnpm build` all green.
The built stylesheet was checked, because a wrong class name builds cleanly and renders nothing:
`.text-cem-secondary-elevated{…color:rgb(176 188 203…)}` and `.text-cem-secondary{…color:rgb(148
163 184…)}` are both emitted, so the new token resolves and the old one is untouched.

### Consolidated into a single PR, 2026-09-28

This section originally described a two-PR split, and a third PR was added when the accessibility
fix turned out not to belong in the documentation unit. At the maintainer's request the three are
now **one pull request against `main`** from `feat/visual-system-macos`: 38 files, 3,830
insertions, 6 commits.

The split was not discarded, only collapsed. The three units are still separate commits and stay
reviewable in order, because the dependency is real:

| # | Commit | What it does | Why it has to come after the previous one |
|---|---|---|---|
| 1 | `319da53` | the gate, 7 rules | needs nothing |
| 2 | `75cb813` | rule 05, WCAG contrast | measures the palette the gate did not previously look at |
| 3 | `e42772e` | the four-tier contract | documents the rules the first two enforce |
| 4 | `b4e2265` | this file | — |
| 5 | `12779e7` | rule 05 notes and its two silent-pass bugs | — |
| 6 | `a96fc73` | the contrast fix, 27 files | adds rule 06 to the script from commit 1 |

Cost of collapsing them: **3,830 lines against a 400-line budget, 9.6x over.** The reviewer is
reviewing three logical units in one diff. The alternative was three merges in a fixed order, where
merging out of order lands the accessibility fix without the gate that motivated it.
