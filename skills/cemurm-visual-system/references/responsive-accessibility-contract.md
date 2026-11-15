# Responsive and accessibility contract — measured for CEMURM

Third reference of `skills/cemurm-visual-system`, alongside `apple-macos-visual-language.md`
(tiers 1–2) and `tier-3-performance-surfaces.md` (tiers 3a–3b). Same house rule: this is a rule
set, not inspiration. Where it says "do not", do not.

Every number carries a tag:

| Tag | Means |
|---|---|
| `[MEASURED]` | counted in this tree on **2026-11-14**; the producing command is in §9 |
| `[HIG]` | Apple Human Interface Guidelines, as cited in `apple-macos-visual-language.md` |
| `[GATE]` | enforced by `scripts/check-visual-contract.sh`; the rule number is given |
| `[DECISION]` | a CEMURM choice. No external authority behind it, and it is revisable by review |

**This is a contract, not a migration.** It binds interfaces created or modified from T2.1 onward.
§10 counts the debt that already exists. Counting is not blessing.

---

## 1. Breakpoints

**Rule — four widths, named by the device class they serve.**

| Class | min-width | Tailwind prefix | Occurrences `[MEASURED]` |
|---|---|---|---|
| base — phone | 0 | *(none)* | — |
| phone landscape / small tablet | 640px | `sm` | 87 |
| tablet | 768px | `md` | 80 |
| laptop | 1024px | `lg` | 34 |
| desktop | 1280px | `xl` | 7 |
| — | 1536px | `2xl` | **0** |

1. **Mobile-first.** The unprefixed class is the phone. A prefix only widens.
2. **`2xl:` is not used and is not introduced.** Zero occurrences. A 1536px rule nobody tests is a
   rule that breaks silently; if a future surface needs it, that is a new decision, recorded.
3. **A breakpoint may change how much fits, never what a component is.** A table that becomes a
   card list is a different component and belongs in the task that builds it, declared in the report.
4. **The four thresholds are Tailwind's defaults, not project decisions.** `[DECISION]` They are
   adopted as-is because they already carry 208 occurrences; inventing a `--breakpoint-*` scale
   now would mean rewriting all of them to land in the same four places.
5. **Container queries before media queries** when the constraint is the component's own width.
   `@container` count is **0** `[MEASURED]`. A card in a 3-column grid and the same card in a
   sidebar are the same width problem, and the viewport cannot see it.

```jsx
// Wrong: the grid decides, so the card is broken in the sidebar.
<p className="text-sm md:text-base">

// Right: the card decides. Add `@container` to the card's own wrapper.
<div className="@container">
  <p className="text-sm @md:text-base">
</div>
```

## 2. Touch targets

**Rule — an interactive area is at least 44×44 CSS px.** `[HIG › Buttons]` states the 44×44 pt hit
region. CEMURM is installed as a standalone PWA (`public/site.webmanifest: "display": "standalone"`)
on tablets, so the touch rule is the primary one, not the desktop one.

**Measured `[MEASURED]`, `src/components/ui/button.tsx`:**

| Size | Class | Height |
|---|---|---|
| `xs` | `h-6` | 24px |
| `sm` | `h-7` | 28px |
| `default` | `h-8` | 32px |
| `lg` | `h-9` | 36px |
| `icon` | `size-8` | 32px |
| `icon-xs` / `icon-sm` / `icon-lg` | `size-6` / `size-7` / `size-9` | 24 / 28 / 36px |

**None reaches 44.** That is the starting condition, not a verdict on the design: the visual size is
a deliberate density decision and it stays.

**Comply without resizing anything.** Expand the hit area with a pseudo-element, gated on a coarse
pointer so a mouse does not inherit an invisible 44px target. The project already does exactly this
on the radio (`src/app/index.css`, `after:absolute after:-inset-2`); this generalizes the pattern it
started.

```jsx
// (44 - size) / 2 = inset per side.
// 24px control -> 10px. 32px control -> 6px.
<Button
  size="icon"
  className="relative after:absolute after:content-['']
             pointer-coarse:after:-inset-[10px]"
  aria-label="Cerrar"
>
```

`pointer-coarse` is a real variant in the installed Tailwind (4.3.3) `[MEASURED]`. Typing into a
`24px` icon button with a thumb is not a density preference; it is a miss.

**Do not** put two 44px targets closer than 8px apart — the expanded areas overlap and the tap goes
to whichever paints last. Spacing is `gap-2` minimum on a coarse pointer.

## 3. Keyboard

1. **Tab order follows reading order.** No `tabIndex` above 0. `tabIndex={-1}` for programmatic
   focus only.
2. **Every interactive thing is reachable and operable by keyboard.** A `div` with `onClick` is a
   defect; use `Button` or add `role`, `tabIndex` and the key handlers. The 55 primitives in
   `src/components/ui/` already satisfy this — that is the reason to use them instead of a raw
   element.
3. **Dialogs and sheets trap focus and return it.** Base UI does this; a hand-rolled overlay does
   not. `Escape` closes.
4. **A modal never scrolls the page behind it.** Lock the body, not just the scroll container.

## 4. Focus

**Rule — a visible focus indicator on every interactive element, always.**

`[MEASURED]` across `src/`: 149 `focus-visible:` against 239 `focus:` in JSX/TSX. That ratio is not
automatically wrong, and treating it as wrong would be dogmatic. The distinctions that matter:

| Element | State to style | Why |
|---|---|---|
| Button, link, checkbox, switch, tab, menu trigger | `focus-visible:` | Mouse users should not see a ring; keyboard users must |
| Text input, textarea, select | `focus:` is acceptable | Focus **is** the editing state; a caret with no ring reads as broken |
| Menu item / listbox option / roving tabindex | `focus:` | The active row is the focus, and it already highlights on hover |

**Never `outline: none` without a replacement.** `[MEASURED]` 119 occurrences of
`outline-none`/`outline-hidden` in JSX/TSX, most of them paired with a `focus-visible:ring-*` —
those are correct. The ones that are not:

```
src/app/index.css  .rbc-event:focus,
src/app/index.css  .rbc-day-slot .rbc-background-event:focus { outline: none; }
```

FullCalendar's stylesheet kills the focus indicator outright on calendar events. The gig and
rehearsal calendars are built on it, so a keyboard user navigating events has no visible position at
all. This is a recorded defect, not a style preference; the fix belongs to the task that owns the
calendar surface.

A second rule is weak rather than absent: `.rbc-toolbar button:focus` sets
`color: var(--color-cem-amber)` and the `:hover` rule immediately below sets **the same** colour. The
focus state is conveyed by colour alone and is indistinguishable from hover, which is what a pointer
user sees anyway. WCAG 2.4.7 is technically met and practically not; a ring or an underline is the
fix.

**The ring is `cem.secondary`** `[DECISION]`, at the values already in the primitives
(`focus-visible:ring-cem-secondary/50`, `focus-visible:ring-1`). Do not introduce a second focus
colour.

## 5. Contrast

**Rule — the gate is the authority. Do not restate the palette here.**

`[GATE]` rule 05 of `scripts/check-visual-contract.sh` computes the WCAG 2.x ratio for every
foreground-on-background token pair and prints the full 7 × 4 matrix. Values are parsed from the
`@theme` block at run time, so there is no second copy to drift.

- **05a** — `cem.text` on every background: **enforcing**, 0 of 4 failing.
- **05b** — every other pair: **report**, **12 of 28 under 4.5:1**. The worst is `cem.rose` on
  `cem.hover` at **2.06:1**; the one that matters is `cem.secondary` on `cem.hover` at **2.96:1**,
  because it is body copy with 318 usages across 41 files.

**What this contract adds, and what it does not.** It adds one rule: **a new interface may not
introduce a 13th failing pair.** Existing debt is inventory, and 05b's count is a ratchet — when it
reaches 0 the rule becomes enforcing for free. Nothing here changes a token value; that is a
separate unit with its own review, because `cem.secondary` at 318 usages is not a one-line edit.

**Do not check contrast by eye, and do not check it twice.** Run the gate.

## 6. Screen readers and semantics

**Rule — the document announces what changed, and the landmarks say where you are.**

`[MEASURED]`:

- **`aria-live` regions: 6 files, and none of them is the authenticated app.** Four are in
  `src/features/design/` (the component gallery) and two in `src/features/landing/` (the public
  marketing page). Every async state in the product — a save that succeeded, a queue that drained,
  a form that failed — changes with no announcement. This is the single largest accessibility gap
  measured in this audit.
- **Landmarks: `<main>` 5, `<nav>` 4, `<header>` 9, `<footer>` 5** across 32 routes. The
  authenticated navigation does render a `<nav>` (`src/features/design/components/cardNav.jsx`) but
  it carries **no `aria-label`**, so a screen reader announces "navigation" twice with no way to
  tell the app nav from the breadcrumb.
- **`<html lang="en">` is correct.** The interface copy is English ("Welcome to CEMURM", "Page not
  found."), verified rather than assumed. A localized interface must change it — and until it does,
  nothing needs to.

1. Every async outcome announces: `role="status"` for success and queue drain, `role="alert"` for
   failure. One live region per app shell, not one per component.
2. One `<main>` per page, inside the layout. `AppLayout` already renders it; a feature page must not
   render a second.
3. A second `<nav>` gets a distinct `aria-label`.
4. **Every icon-only control has an accessible name.** `aria-label` or visible text, never an icon
   alone. 11 `size="icon*"` usages exist today; each takes a label, and the icon is `aria-hidden`.
5. Loading is announced, not only animated. A spinner with no `aria-busy` or live region is a
   silent wait.
6. **A test hook is not an accessible name.** `data-testid` never substitutes for `aria-label`.

## 7. Reduced motion

**Rule — cite the tokens; never re-declare the media query.**

`src/app/index.css` already answers the three system signals: `prefers-reduced-motion: reduce` (a
global block that flattens `transition-duration` and `animation-duration` to `0.01ms`, deliberately
not `0` so `transitionend` still fires), `prefers-contrast: more`, and `forced-colors: active`.
`[MEASURED]` confirmed by reading them, not assumed.

Durations and easings are **tokens**, added by the token-foundation work (PR #464):

```
--cem-duration-fast      150ms
--cem-duration-base      200ms
--cem-duration-slow      300ms
--cem-duration-material  420ms
--cem-ease-standard      cubic-bezier(0.23, 1, 0.32, 1)
```

1. **`[GATE]` Hard Rule 5 of the skill stands:** no animation library in the authenticated bundle.
   `motion` stays in the landing chunk, `gsap` in `src/features/landing` and `src/features/design`.
2. **Consume the duration token, do not type the number.** A literal `duration-200` is the value the
   token already names.
3. **Never re-declare `prefers-reduced-motion` per component.** The global block already covers every
   element; a second block is either redundant or, worse, overrides the flattening.
4. **Motion that carries meaning needs a non-motion equivalent.** A transition that shows where a
   sheet came from needs the sheet to still be identifiable when it does not move.
5. The global block does not cover JS-driven animation. That is another reason motion stays out of
   the authenticated bundle.

## 8. Safe areas

**Rule — `viewport-fit=cover` and `env()` land together, or not at all.**

`[MEASURED]` and this is the defect the audit found:

- `index.html:11` is `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`.
  **`viewport-fit=cover` is absent.** It appears in the file only inside a comment at line 16 that
  says it "lets the safe-area insets the reference asks for reach the edges". The comment describes
  an attribute the tag does not have.
- The only consumer of `env(safe-area-inset-*)` in the whole tree is
  `src/features/design/components/reference.css:498` — a design reference page, not the app.

So today, on a notched device: the insets resolve to `0` because the viewport is constrained, and
there is nothing consuming them anyway.

**The ordering constraint is the rule.** Adding `viewport-fit=cover` alone is a regression: content
extends under the notch and the home indicator with no padding to compensate. Both changes ship in
one unit, in the responsive-shell task (T3.1), never split.

Where the insets are mandatory once enabled:

| Surface | Edge | Token expression |
|---|---|---|
| App shell bottom bar and dock | bottom | `padding-bottom: env(safe-area-inset-bottom)` |
| Any sheet or dialog anchored to the bottom | bottom | same, plus `max-height` reduced by the inset |
| Stage Mode (tier 3a) | all four | the musician's hand sits on the edge |
| Overlay / projector (tier 3b) | none | it is captured by OBS, not displayed on a notched device |

```css
.cem-shell-footer {
  padding-bottom: max(var(--spacing-4), env(safe-area-inset-bottom));
}
```

`max()` and not `calc()`: the inset is `0` on every device without a notch, and `0 + 1rem` must not
collapse the ordinary padding.

## 9. Verification

**What automation already covers `[GATE]`:**

```bash
bash scripts/check-visual-contract.sh     # 12 rules; 05 is the contrast matrix
```

**What a command can confirm today.** Every `[MEASURED]` tag in this document comes from one of
these, and re-running them is how a later review checks this document has not rotted:

```bash
# breakpoints in use
for bp in sm md lg xl 2xl; do
  printf '%-4s %s\n' "$bp:" \
    "$(grep -rhoE "(^|[ \"'.:])${bp}:" src --include=*.jsx --include=*.tsx | wc -l)"
done

# focus state, split by kind
grep -rho 'focus-visible:' src --include=*.jsx --include=*.tsx | wc -l
grep -rhoE '(^|[^-\w])focus:' src --include=*.jsx --include=*.tsx | wc -l
grep -rn 'outline-none\|outline-hidden' src --include=*.jsx --include=*.tsx

# live regions outside the gallery and the landing page (the number that matters)
grep -rl 'aria-live' src --include=*.jsx --include=*.tsx \
  | grep -vE 'features/(design|landing)/' | wc -l

# landmarks
for t in main nav header footer; do
  printf '<%-7s %s\n' "$t" "$(grep -rho "<$t[ >]" src --include=*.jsx --include=*.tsx | wc -l)"
done

# the safe-area pair: both, or neither
grep -n 'viewport-fit' index.html
grep -rn 'env(safe-area' src public
```

**What no command answers, and must be checked by hand:** whether the focus ring is *visible* against
the surface behind it, whether a tab order follows the page, whether an announcement is *useful* and
not merely present, and whether motion communicates what it claims to.

**This document is not wired into CI, on purpose.** Every criterion here has a home: contrast is
rule 05; colour and the token source are rules 01–08. A second script next to
`check-visual-contract.sh` would fragment one gate into two that disagree, and adding rules to that
script is a CI change — CI is a protected area in the working agreement, so it needs explicit
authorization. Until then the contract binds by review, and the report says which clauses were
verified and how.

## 10. Debt inventory

Counted, not blessed. Each line names the task that owns it, so nothing here becomes permanent by
silence.

| Finding | Count `[MEASURED]` | Owner |
|---|---|---|
| Interactive controls under 44px | every `Button` size except `lg` | T2.1 |
| `aria-live` in the authenticated app | **0** across 6 files that have one | T2.4, T3.3 |
| Second `<nav>` without `aria-label` | 1 (`cardNav.jsx:510`) | T3.1 |
| Focus indicator killed on calendar events | 1 selector pair (`index.css`) | the gig/rehearsal surface task |
| Focus on calendar toolbar indistinguishable from hover | 1 selector (`index.css`) | same |
| `viewport-fit=cover` absent, `env()` unused in the app | 1 + 0 | T3.1, as one unit |
| Contrast pairs under 4.5:1 | 12 of 28, worst 2.06:1 | 05b ratchet; not this initiative |
| `@container` usage | 0 | opportunistic, per component |
| `2xl:` usage | 0 | keep it that way |

## 11. What this document does not do

It does not migrate a page, change a token, add a dependency, or alter the gate. It states the
conditions a new interface has to meet and gives the command that proves each one. The first
interface that has to meet them is the one built in T2.1 — and the report for that task names which
clauses it verified.

Where a rule here contradicts `apple-macos-visual-language.md` or
`tier-3-performance-surfaces.md`, those win on visual language and this wins on measurement. Where
both are silent, the decision is recorded in the task that made it, with its evidence.
