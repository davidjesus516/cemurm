# Apple / macOS visual language — measured reference for CEMURM

Evidence base for CEMURM's visual-system skill. Apple's ecosystem and UI-UX language is the
primary reference. CEMURM keeps its own colour essence: a dark ramp plus one amber accent
(`#f59e0b`, `tailwind.config.js` → `theme.extend.colors.cem.amber`).

Every numeric value below is either (a) traceable to an Apple Human Interface Guidelines page
loaded live on **2026-09-27**, cited inline as `(HIG › Page › Section)`, or (b) explicitly tagged
`[UNVERIFIED]` / `[CEMURM DECISION]`. Ratios computed on CEMURM's own hex values are tagged
`[COMPUTED]` — arithmetic, not Apple values.

This is a rule set, not inspiration. Where it says "do not", do not.

---

## Provenance

### Pages loaded live (all `https://developer.apple.com/design/human-interface-guidelines/…`)

| Page | Used for |
|---|---|
| `/`, `/foundations` | Section index. Foundations = Accessibility, App icons, Color, Layout, Materials, Typography, Dark Mode, Motion. **There is no Shape or Radius page.** |
| `/materials` | Liquid Glass, regular/clear, 35% dimming, ultraThin→thick, vibrancy levels |
| `/color` | Semantic roles, iOS + macOS dynamic colour tables, system colour RGB, accent rules |
| `/dark-mode` | base/elevated, 4.5:1 and 7:1 floors, dark-only apps |
| `/typography` | Default/minimum sizes, iOS/iPadOS Dynamic Type + AX tables, macOS text styles, tracking |
| `/layout` | Size classes, layout guides vs safe areas, tvOS margins, grid specs |
| `/motion` | Motion rules, Reduce Motion interaction, 30–60 fps |
| `/accessibility` | Contrast table, control size table, 12 pt / 24 pt padding |
| `/buttons` | 44×44 pt hit region, roles, visionOS shape + size tables, press state |
| `/segmented-controls`, `/sliders`, `/toggles`, `/lists-and-tables`, `/collections`, `/boxes`, `/popovers`, `/loading`, `/windows` | Control inventory and state rules |
| `/design-principles` | Principle names only; no numbers |
| `/designing-for-macos` | macOS viewing distance (1–3 ft) |
| `/components`, `/content`, `/layout-and-organization`, `/menus-and-actions`, `/navigation-and-search`, `/presentation`, `/selection-and-input`, `/status`, `/system-experiences`, `/patterns` | Full component inventory (link index) |
| `https://developer.apple.com/design/resources/` | SF Symbols: 9 weights, 3 scales, 7,000+ symbols |
| `https://developer.apple.com/documentation/swiftui/roundedcornerstyle` | `circular` vs `continuous` corner vocabulary |
| `https://developer.apple.com/documentation/swiftui/roundedrectangle` | Corner-radius API shape |

### What Apple does **not** publish on the HIG website

1. **Corner radius numbers.** No per-component radius table exists. Apple's `RoundedCornerStyle`
   doc publishes only the two *styles* (`circular` = "Quarter-circle rounded rect corners",
   `continuous` = "Continuous curvature rounded rect corners"). The word "squircle" does not
   appear anywhere on the HIG. Numeric radii ship only inside the downloadable Apple UI Kit on
   `/design/resources/` — a binary, not a citable page.
2. **A spacing scale.** The Layout page has **no Spacing section** as of the load date. There is no
   published 8 pt grid and no published 20 pt window margin. The only surviving spacing numbers are
   the tvOS grid and tvOS screen margins (cited below). `…/specifications` and `…/touch-targets`
   both return 404 — never cite them.
3. **Elevation / shadow levels.** No shadow table, no elevation table, no shadow opacity or blur
   value anywhere on the site.
4. **Motion durations and easing curves.** The Motion page contains **zero** duration tokens and
   **zero** easing curves. It states only that built-in easing exists and, on watchOS, "You can't
   turn off or customize easing" (HIG › Motion › watchOS).

Sections 5 and 6 therefore carry `[UNVERIFIED]` and `[CEMURM DECISION]` tags wherever the
underlying Apple number is absent. Those values are still binding; they are simply not Apple's, and
each is tagged at the point of use.

---

## 1. Materials

### 1.1 The two-layer rule

- **Functional layer** — controls and navigation. "Liquid Glass forms a distinct functional layer
  for controls and navigation elements — like tab bars and sidebars — that floats above the content
  layer, establishing a clear visual hierarchy between functional elements and content"
  (HIG › Materials › Liquid Glass).
- **Content layer** — content and app backgrounds. The standard materials "help with visual
  differentiation **within the content layer**" (HIG › Materials).

### 1.2 Hard rules on the functional-layer material

| Rule | Source |
|---|---|
| "Don't use Liquid Glass in the content layer." | HIG › Materials › Liquid Glass |
| Exception only: "controls in the content layer with a transient interactive element like sliders and toggles; in these cases, the element takes on a Liquid Glass appearance to emphasize its interactivity **when a person activates it**" | same |
| "Use Liquid Glass effects sparingly." / "If you apply Liquid Glass effects to a custom control, do so sparingly." | same |
| "overusing this material in multiple custom controls can provide a subpar user experience by distracting from that content" | same |
| "**Limit these effects to the most important functional elements in your app.**" | same |
| System components pick up the appearance automatically — do not hand-roll it on a standard control | same |

### 1.3 `regular` vs `clear`

| | `regular` | `clear` |
|---|---|---|
| Behaviour | "blurs and adjusts the luminosity of background content to maintain legibility" | "highly translucent" |
| Use when | background "might create legibility issues", or the component "has a significant amount of text, such as alerts, sidebars, or popovers" | components "that float above media backgrounds — such as photos and videos" |
| Default | "Most system components use this variant" | opt-in only |

Dimming layer, verbatim scope (HIG › Materials › Liquid Glass): underlying content **bright** →
"consider adding a dark dimming layer of **35% opacity**". Underlying content **sufficiently
dark**, or AVKit media controls that supply their own dimming layer → "you don't need to apply a
dimming layer".

CEMURM decision gate: `regular` semantics for every chrome surface. `clear` is legal only over user
artwork (an imported song cover), never over a scrolling list.

### 1.4 Standard materials

iOS/iPadOS define four: **ultraThin, thin, regular (default), thick** (HIG › Materials).
Apple's mapping of thickness to purpose (HIG › Materials › tvOS):

| Material | Recommended for |
|---|---|
| `ultraThin` | "Full-screen views that require a light color scheme" |
| `thin` | "Overlay views that partially obscure onscreen content and require a light color scheme" |
| `regular` | "Overlay views that partially obscure onscreen content" |
| `thick` | "Overlay views that partially obscure onscreen content and require a dark color scheme" |

Trade-off (HIG › Materials › Standard materials): "Thicker materials, which are more opaque, can
provide better contrast for text and other elements with fine features." / "Thinner materials,
which are more translucent, can help people retain their context." visionOS restates the same
ladder semantically — `thin` "brings attention to interactive elements like buttons and selected
items", `regular` "can help you visually separate sections", `thick` "lets you create a dark element
that remains visually distinct when it's on top of an area that uses a regular background".

**CEMURM mapping.** `thick` is the only correct choice for a dark-first stage display, and the
tvOS table is the direct justification: an overlay that must be legible over content in a dark
scheme is `thick`, not `thin`.

### 1.5 Vibrancy (the opacity ladder Apple ships)

"The name of a level indicates the relative amount of contrast between an element and the
background: The default level has the highest contrast, whereas quaternary (when it exists) has the
lowest contrast" (HIG › Materials › iOS, iPadOS).

| Kind | Levels | Constraint |
|---|---|---|
| Labels | `label` (default), `secondaryLabel`, `tertiaryLabel`, `quaternaryLabel` | usable on any material, but "**avoid using quaternary on top of the thin and ultraThin materials**, because the contrast is too low" |
| Fills | `fill` (default), `secondaryFill`, `tertiaryFill` | "You can use the following vibrancy values for fills on all materials" |
| Separators | one default value only | "The system provides a single, default vibrancy value for a separator, which works well on all materials" |

CEMURM consequence: 3 steps for fills, 4 for labels, and **separators get exactly one value**. Do
not build a per-surface separator scale.

### 1.6 Translating to a web stack with no SwiftUI materials

A browser has no `Material` primitive. Three declarations reproduce the *read* of a `regular`
functional-layer material — not its mechanism:

```css
/* [CEMURM DECISION] values not published by Apple */
.surface-chrome {
  background-color: rgb(15 23 42 / 0.72);        /* cem.base at 72% */
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgb(248 250 252 / 0.10);    /* 1px light hairline */
}
```

- **1px light border** — `[CEMURM DECISION]`. The HIG publishes no border width. The hairline is
  required because `backdrop-filter` alone gives no edge definition on a dark backdrop;
  `#f8fafc` at 0.10 over `#0f172a` computes to only **1.31:1** `[COMPUTED]`. It is a *presence*
  cue and must never be the only separator carrying meaning.
- **Cost on a low-end tablet** — not an Apple value; platform behaviour: `backdrop-filter` forces
  the compositor to read back the backdrop, blur it, and re-composite **on every frame in which
  the element is visible** — i.e. for the whole duration of a scroll. On a weak GPU that is
  dropped frames during the exact scroll a stage display performs, plus battery drain.
- **Degradation ladder** — mandatory, in this order:
  1. `@media (prefers-reduced-transparency: reduce)` → drop `backdrop-filter`, raise
     `background-color` alpha to 0.94. Apple's equivalent is Reduce Transparency, which the
     Materials page says changes the material's appearance.
  2. `@supports not (backdrop-filter: blur(1px))` → same opaque fallback.
  3. Never apply `backdrop-filter` to a scroll container, a list row, or more than one surface at
     a time — "Limit these effects to the most important functional elements".
- **Not translatable: vibrancy.** It blurs and re-tints *the content itself* under the label,
  adapting per pixel. No CSS primitive does that. Use opacity steps and stop.

---

## 2. Colour

### 2.1 Roles, not hues

"Each dynamic color is semantically defined by its purpose, rather than its appearance or color
values" and "Avoid redefining the semantic meanings of dynamic system colors" (HIG › Color ›
System colors). Never use a separator colour as a text colour, never a secondary label as a
background.

iOS/iPadOS foreground roles (HIG › Color › iOS, iPadOS):

| Role | Definition | UIKit |
|---|---|---|
| Label | "A text label that contains primary content." | `label` |
| Secondary label | "A text label that contains secondary content." | `secondaryLabel` |
| Tertiary label | "A text label that contains tertiary content." | `tertiaryLabel` |
| Quaternary label | "A text label that contains quaternary content." | `quaternaryLabel` |
| Placeholder | "Placeholder text in controls or text views." | `placeholderText` |
| Separator | "A separator that **allows some underlying content to be visible**." | `separator` |
| Opaque separator | "A separator that **doesn't allow any underlying content to be visible**." | `opaqueSeparator` |
| Link | "Text that functions as a link." | `link` |

Background hierarchy (HIG › Color › iOS, iPadOS): two sets — system and grouped — each with
primary / secondary / tertiary. "Primary for the overall view, Secondary for grouping content or
elements within the overall view, Tertiary for grouping content or elements within secondary
elements."

macOS additionally publishes roles with no iOS equivalent (HIG › Color › macOS). The ones that
drive a decision in this file: `controlColor` ("The surface of a control"), `controlTextColor`
("The text of a control that is available"), `disabledControlTextColor`, `keyboardFocusIndicatorColor`
("The ring that appears around the currently focused control when using the keyboard for interface
navigation"), `selectedControlColor`, `selectedControlTextColor`, `selectedContentBackgroundColor`,
`unemphasizedSelectedContentBackgroundColor`, `shadowColor` ("The virtual shadow cast by a raised
object onscreen"), `highlightColor` ("The virtual light source onscreen"), `windowBackgroundColor`,
`underPageBackgroundColor`, `textBackgroundColor`, `textColor`, `gridColor`, `headerTextColor`,
`controlAccentColor`, `currentControlTint`.

### 2.2 Apple's grey ladder, and why dark mode stacks by lightness

From the swatch `alt` attributes on HIG › Color › Specifications. Apple states "Do not hard-code
system color values" and that they "may fluctuate from release to release" — reproduced only to
show the direction and spacing of the steps, never to be copied into `tailwind.config.js`.

| Name | Default (light) | Default (dark) | Inc. contrast (light) | Inc. contrast (dark) |
|---|---|---|---|---|
| `systemGray` | 142,142,147 | 142,142,147 | 108,108,112 | 174,174,178 |
| `systemGray3` | 199,199,204 | 72,72,74 | 174,174,178 | 84,84,86 |
| `systemGray6` | 242,242,247 | 28,28,30 | 235,235,240 | 36,36,38 |

Two facts, both used later:

- **Every gray is neutral** — `R = G = B` in all four columns. Dark-mode surfaces change
  *lightness*, not hue. Precedent for keeping `#0f172a` / `#1e293b` / `#334155` on one hue and
  moving only lightness.
- **The ladder inverts direction.** `systemGray6` goes 242 → 28 entering dark mode: the index that
  is lightest in light mode becomes the darkest in dark mode. This is the mechanical proof of the
  elevation-by-lightness rule in §5.4.

### 2.3 Apple's rules on tinting and accent frequency

| Rule | Source |
|---|---|
| "By default, Liquid Glass has no inherent color, and instead takes on colors from the content directly behind it." | HIG › Color › Liquid Glass color |
| "Apply color sparingly to the Liquid Glass material, and to symbols or text on the material." | same |
| "reserve it for elements that truly benefit from emphasis, such as **status indicators or primary actions**" | same |
| "To emphasize primary actions, apply color to the **background** rather than to symbols or text." | same |
| "**Refrain from adding color to the background of multiple controls.**" | same |
| "Keep the number of prominent buttons to **one or two per view**." | HIG › Buttons › Style |
| "Avoid using the same color to mean different things." / "Avoid relying solely on color to differentiate between objects, indicate interactivity, or communicate essential information." | HIG › Color › Best practices, Inclusive color |
| macOS: the system applies the *user's* accent over the app's, "replacing your accent color"; only a fixed-colour sidebar icon survives | HIG › Color › App accent colors |

### 2.4 Mapping: how many accent states CEMURM may have

CEMURM has **one** accent hue. Apple's rules are written for a system that can tint many roles, so
they must be tightened, not copied. `[CEMURM DECISION]`

| Accent state | Allowed? | Token | Contrast `[COMPUTED]` |
|---|---|---|---|
| **Primary action in the current view** | Full-saturation amber background, dark text | `cem.amber` + `text-on-accent: #0f172a` | 8.31:1 |
| **Now-playing / current song in a setlist** | Full-saturation amber, persistent | `cem.amber` | 8.31:1 on `cem.base` |
| **Selected row, not primary** | Amber fill, no amber text, at or above the alpha floor | `rgb(245 158 11 / 0.52)` over base; `/ 0.56` over surface | 3.00:1 vs base |
| Secondary action | **No accent.** Surface + `cem.text` only | — | — |
| Destructive | **No accent.** Non-amber signal, must carry a text label | — | — |
| Focus ring | **No accent.** Must not be confusable with selection | — | — |
| Hover | **No accent.** Hover is not available on a touch stage display | — | — |

- **At most one full-saturation amber surface on screen at a time** — the direct translation of
  "Refrain from adding color to the background of multiple controls" plus "one or two per view".
- **Text on an amber fill is `#0f172a`, never `#f8fafc`.** `#f8fafc` on `#f59e0b` computes to
  **2.05:1** `[COMPUTED]` — a hard fail against the 4.5:1 floor in §3.4.
- **Amber alpha floor for a non-text state indicator is 0.52** over `cem.base`, 0.56 over
  `cem.surface` `[COMPUTED]`. Below that the fill is invisible as a state and the state is
  colour-only, which Apple forbids.
- **The user's OS accent colour does not exist here.** A PWA cannot read the macOS accent setting,
  and even if it could, amber is load-bearing for the now-playing signal. `#f59e0b` is fixed.

### 2.5 Verified defect in the current repo ramp

`cem.secondary` is `#94a3b8`. It passes on the two darkest surfaces and **fails Apple's own
minimum** on the two lightest — "At a minimum, make sure the contrast ratio between colors is no
lower than 4.5:1" (HIG › Dark Mode › Dark Mode colors) `[COMPUTED]`:

| Foreground / background | Ratio | Verdict |
|---|---|---|
| `#94a3b8` on `#0f172a` (base) | 6.96 | pass |
| `#94a3b8` on `#1e293b` (surface) | 5.71 | pass |
| `#94a3b8` on `#334155` (elevated) | **4.04** | **fail** |
| `#94a3b8` on `#475569` (hover) | **2.96** | **fail** |
| `#f59e0b` on `#475569` | **3.53** | fail at ≤17 pt, pass at ≥18 pt |
| `#f8fafc` on `#475569` | 7.24 | pass |

Consequence: either `#475569` stops being a text-bearing surface, or `cem.secondary` is lightened
for those two steps. Measured alternatives: `#cbd5e1` on base = 12.02, on surface = 9.85. This is
a finding for the skill's decision gates, not a settled change.

---

## 3. Typography

### 3.1 Verified default and minimum sizes

HIG › Typography › Ensuring legibility (same table at HIG › Accessibility › Vision):

| Platform | Default size | Minimum size |
|---|---|---|
| iOS, iPadOS | 17 pt | 11 pt |
| macOS | 13 pt | 10 pt |
| tvOS | 29 pt | 23 pt |
| visionOS | 17 pt | 12 pt |
| watchOS | 16 pt | 12 pt |

### 3.2 Verified iOS / iPadOS Dynamic Type ramp (xSmall = default content size)

HIG › Typography › Specifications › iOS, iPadOS Dynamic Type sizes. "Point size based on image
resolution of 144 ppi for @2x and 216 ppi for @3x designs."

| Style | Weight | Size (pt) | Leading (pt) | Emphasized weight |
|---|---|---|---|---|
| Large Title | Regular | 31 | 38 | Bold |
| Title 1 | Regular | 25 | 31 | Bold |
| Title 2 | Regular | 19 | 24 | Bold |
| Title 3 | Regular | 17 | 22 | Semibold |
| Headline | Semibold | 14 | 19 | Semibold |
| Body | Regular | 14 | 19 | Semibold |
| Callout | Regular | 13 | 18 | Semibold |
| Subhead | Regular | 12 | 16 | Semibold |
| Footnote | Regular | 12 | 16 | Semibold |
| Caption 1 | Regular | 11 | 13 | Semibold |
| Caption 2 | Regular | 11 | 13 | Semibold |

Verified macOS built-in text styles (HIG › Typography › Specifications) run one step smaller
throughout: Large Title 26/32, Title 1 22/26, Title 2 17/22, Title 3 15/20, **Headline Bold
13/16**, Body 13/16, Callout 12/15, Subheadline 11/14, Footnote 10/13, Caption 1 10/13 (Medium),
Caption 2 10/13. macOS `Headline` is the only style that ships **Bold** by default and pairs with
**Heavy** as its emphasized weight — the smallest verified size with the heaviest default weight.
That is the precedent for pairing weight inversely with size.

Verified iOS/iPadOS AX1 (largest accessibility): Body 28 pt / 34 pt leading, Large Title 44 pt
(HIG › Typography › Specifications › larger accessibility type sizes). Apple's minimum
enlargement target is "at least 200 percent (or 140 percent in watchOS apps)" (HIG ›
Accessibility › Vision).

### 3.3 Verified rules on weights, faces and hierarchy

| Rule | Source |
|---|---|
| "In general, avoid light font weights. … prefer **Regular, Medium, Semibold, or Bold** … and avoid **Ultralight, Thin, and Light** font weights, which can be difficult to see, especially when text is small." | HIG › Typography › Ensuring legibility |
| "If you use a custom font with a thin weight, aim for larger than the recommended sizes to increase legibility." / "Thicker weights are easier to read for smaller font sizes." | HIG › Typography; HIG › Accessibility › Vision |
| "Minimize the number of typefaces you use, even in a highly customized interface." | HIG › Typography › Conveying hierarchy |
| "Be sure to maintain the relative hierarchy and visual distinction of text elements when people adjust text sizes." | same |
| "Prioritize important content when responding to text-size changes. … they don't expect the tab titles to increase in size." | same |
| "macOS doesn't support Dynamic Type." | HIG › Typography › macOS |

### 3.4 Verified contrast floors — the load-bearing number set

HIG › Accessibility › Vision, quoting WCAG Level AA as used by Accessibility Inspector:

| Text size | Text weight | Minimum contrast ratio |
|---|---|---|
| Up to 17 pt | All | **4.5:1** |
| 18 pt | All | **3:1** |
| All | **Bold** | **3:1** |

HIG › Dark Mode adds the stricter target for custom colours: "For custom foreground and background
colors, strive for a contrast ratio of **7:1**, especially in small text."

CEMURM is dark-first, so its palette is exactly the case 7:1 is written for. **7:1 is the design
target for all body and label text; 4.5:1 is the floor, not the goal.**

### 3.5 The web equivalent for a dark-first PWA on cheap tablets in a dark room

Apple publishes no web font, no web type ramp and no CSS. The mapping reuses Apple's *sizes and
weight permissions* on the repo's existing family (`fontFamily.sans: ['Inter', …]`). Tokens are
`[CEMURM DECISION]`; the size precedents are Apple's.

| CEMURM role | Size | Line height | Permitted weights | Precedent |
|---|---|---|---|---|
| `display` — stage chord line, now-playing title | 40 px | 1.1 | 600 | above iOS Large Title (31 pt) for 1–2 m reading |
| `title` — screen / section title | 24 px | 1.25 | 600 | between iOS Title 1 (25) and Large Title |
| `heading` — card and group title | 20 px | 1.3 | 600 | iOS Title 2 (19 pt) |
| `body` — song title, lyrics, setlist rows | 18 px | 1.4 | 400, 600 | iOS Body (14 pt) + distance allowance |
| `callout` — metadata, key / tempo labels | 16 px | 1.4 | 400, 500 | iOS Callout (13 pt) + distance allowance |
| `caption` — timestamps, hints | 14 px | 1.4 | 400, 500 | iOS Footnote (12 pt) + distance allowance |

- **No weight below 400 anywhere.** Apple's permitted set starts at Regular and excludes
  Ultralight, Thin and Light by name. A dark ramp plus a thin weight on a low-brightness panel is
  the exact failure Apple describes.
- **Permitted weights: 400, 500, 600 only.** 700 is permitted only for a `caption`-size label that
  must meet the 3:1 bold floor — Apple's emphasized-weight column tops out at Bold/Heavy and the
  smallest verified size is 10 pt.
- **`body` floor is 18 px, not 14 px.** Apple's 17 pt default and 11 pt minimum assume a device held
  25–40 cm away. A tablet clamped to a stand at 50–80 cm needs the size raised — which is exactly
  the escape Apple grants: "consider using a larger type size, increasing contrast … or using
  typefaces designed for optimized legibility" (HIG › Typography › Ensuring legibility).
- **Absolute floor is 14 px for anything, ever.** Apple's own floors are 11 pt / 10 pt; 14 px is the
  last role before the floor bites.
- **Line height is fixed per role, never `leading-normal`.** Apple's table publishes leading for
  every style; the ratios above derive from those pairs (iOS Body 14/19 = 1.36).
- **Every token clears 7:1 against its own surface**, not against `cem.base`. §2.5 is the pattern.
- **No Dynamic Type equivalent is required.** Apple does not support Dynamic Type on macOS
  (HIG › Typography › macOS), so "no user-scalable type control" is consistent with the reference,
  not a deviation. Do add a `prefers-contrast: more` block and let browser zoom work.
- **Font.** SF Pro is licensed for Apple-platform UI and cannot ship in a PWA. Inter stays, and
  Apple's *weight semantics* must be recreated explicitly in the Tailwind `fontWeight` scale,
  because Inter's weight names and SF's do not line up.

---

## 4. Layout

### 4.1 Verified layout vocabulary

| Term | Definition | Source |
|---|---|---|
| **Layout guide** | "A rectangular region that helps you position, align, and space your content on the screen. The system includes predefined layout guides that make it easy to apply standard margins around content and restrict the width of text for optimal readability." | HIG › Layout › Guides and safe areas |
| **Safe area** | "The area within a window that isn't covered on the edge by a hardware feature or another view within the window, like a toolbar, tab bar, or status bar." | same |
| **Size class** | compact or regular, independently for width and height. "Determine layout based on size classes, not device type or orientation." | HIG › Layout › Size classes |

Four combinations exist: compact/compact, compact/regular, regular/compact, regular/regular. "Keep
functionality the same as size classes change, and keep layout changes recognizable and familiar to
the platform."

### 4.2 Verified numbers

| Value | Source |
|---|---|
| tvOS screen safe-area inset: **60 pt top and bottom, 80 pt from the sides** | HIG › Layout › tvOS |
| tvOS two-column grid: unfocused content width **860 pt**, horizontal spacing **40 pt**, minimum vertical spacing **100 pt** | HIG › Layout › Grids |
| visionOS: "place buttons so their centers are at least **60 points** apart" | HIG › Layout › visionOS |
| visionOS: "If your buttons measure 60 pts or larger, add **4 pts** of padding around them to keep the hover effect from overlapping" | same |
| visionOS button sizes: Mini **28 pt**, Small **32 pt**, Regular **44 pt**, Large **52 pt**, Extra large **64 pt** | HIG › Buttons › visionOS |
| watchOS ceiling: "display no more than three buttons that contain glyphs — or two buttons that contain text — in a row" | HIG › Layout › watchOS |
| Button hit region: "at least **44x44 pt**" (60×60 pt in visionOS) | HIG › Buttons › Best practices |
| iOS/iPadOS control size: default **44x44 pt**, minimum **28x28 pt** | HIG › Accessibility › Mobility |
| macOS control size: default **28x28 pt**, minimum **20x20 pt** | same |
| Padding: "about **12 points** … around elements that include a bezel. For elements without a bezel, about **24 points**" | same |
| Image button: "about **10 pixels** of padding between the edges of the image and the button edges" | HIG › Buttons › Image buttons |
| Segmented control: "no more than about **five to seven** segments in a wide interface and no more than about **five** segments on iPhone" | HIG › Segmented controls |
| macOS viewing distance: "about **1 to 3 feet**" | HIG › Designing for macOS |
| macOS: "Avoid placing controls or critical information at the bottom of a window." / "Avoid displaying content behind the camera housing at the top edge of the window." | HIG › Layout › macOS |

### 4.3 What is missing: the spacing scale

There is no published 8 pt grid, no published 20 pt window margin and no base-unit statement
anywhere on the site, and the Layout page has no Spacing section. Anyone citing "HIG › Layout ›
Spacing" for 20 pt or 8 pt is citing a page revision that no longer exists.
`[UNVERIFIED — does not exist on the live site]`

The only published grid on the whole site is the tvOS two-column grid (40 pt / 100 pt), which is a
TV focus grid, not a general rhythm.

### 4.4 The CEMURM spacing scale

`[CEMURM DECISION]` — anchored to the three published numbers that survive (40 pt horizontal grid
spacing, 12 pt / 24 pt padding, 10 px image-button padding), on a 4 px base.

| Token | px | Use |
|---|---|---|
| `space-1` | 4 | icon-to-label inside a control |
| `space-2` | 8 | label-to-meta inside a row |
| `space-3` | 12 | inside a control (matches Apple's bezelled padding) |
| `space-4` | 16 | row padding; gap between row content |
| `space-5` | 24 | between elements without a bezel (matches Apple's un-bezelled padding) |
| `space-6` | 32 | card interior padding |
| `space-8` | 40 | section gap (matches the tvOS grid's horizontal spacing) |
| `space-10` | 48 | screen margin, portrait |
| `space-12` | 64 | screen margin, landscape / stage display |

- **Only these nine values. No arbitrary spacing.** Apple's principle: "Use consistent spacing.
  When content isn't consistently spaced, it no longer looks like a grid and it's harder for people
  to scan" (HIG › Layout › Grids).
- **4 px base, not 8 px.** Apple's published pad is 10 px (HIG › Buttons), which is not a multiple
  of 8. A 4 px base absorbs it.
- **Screen margin: 16 px phone, 24 px tablet, 40 px stage mode.** Fixed, never
  viewport-proportional.
- **Safe-area equivalent:** `padding-bottom: max(24px, env(safe-area-inset-bottom))` on any surface
  reaching a screen edge. In a browser the safe area is the union of the notch, the home indicator
  and the browser's own chrome.
- **Alignment:** "Align elements to make them easier to scan, and use indentation to convey
  hierarchy. … People assume that aligned items are related to each other, and conversely, they
  perceive indented items as subordinate" (HIG › Layout › Visual hierarchy). One indent step is
  `space-4`, two is `space-8`, never three.
- **Reading order:** "place the most important items near the top and leading side" (same). In LTR
  that is top-left; it mirrors in RTL. The stage display's next/previous controls go on the
  **trailing** edge so they never sit under a right thumb.

### 4.5 Grid and columns

- **1 column on phones, 2 on tablets ≥ 768 px, 3 in stage mode.** Apple's size-class principle:
  decide on available width, never device identity (HIG › Layout › Size classes). CSS media
  queries only, never user-agent sniffing.
- **Charts:** "Reduce the number of columns when the font size increases to avoid truncation"
  (HIG › Typography › Supporting Dynamic Type). Applies to any data-dense grid.
- **Items in a row are equal-width when they form a choice set.** "Within a segmented control, all
  segments are usually equal in width" (HIG › Segmented controls); "In general, keep segment size
  consistent."
- **Cap prose width.** Apple's layout guide "restrict[s] the width of text for optimal readability"
  (HIG › Layout › Guides and safe areas). Cap lyrics and notes at `max-w-prose`; never let a line
  run the full width of a landscape tablet.

---

## 5. Shape and depth

This section replaces CEMURM's previous `border-radius: 0` mandate. That mandate is a flat
rejection of the reference language and has no support in the HIG.

### 5.1 What Apple actually publishes about corner geometry

| Fact | Source |
|---|---|
| Apple ships exactly two corner styles: `circular` — "Quarter-circle rounded rect corners" — and `continuous` — "Continuous curvature rounded rect corners" | https://developer.apple.com/documentation/swiftui/roundedcornerstyle |
| `RoundedRectangle` takes `init(cornerRadius: CGFloat, style: RoundedCornerStyle)`; `UnevenRoundedRectangle` and `RectangleCornerRadii` cover per-corner radii | https://developer.apple.com/documentation/swiftui/roundedrectangle |
| The word "squircle" does not appear on the HIG. Use Apple's word: **continuous corners**. | verified absent across all loaded pages |
| Three standard button shapes: **circle** (icon-only), **capsule** (text-only, or text + icon), **rounded rectangle** | HIG › Buttons › visionOS |
| "In general, prefer circular or capsule-shape buttons. People's eyes tend to be drawn toward the corners in a shape, making it difficult to keep looking at the shape's center. **The more rounded a button's shape, the easier it is for people to look steadily at it.** When you need to display a button by itself, prefer a capsule-shape button." | same |
| "prefer the rounded-rectangle shape in a **vertical stack** of buttons and prefer the **capsule** shape in a **horizontal row** of buttons" | same |
| "watchOS displays all inline buttons using the capsule button shape" | HIG › Buttons › watchOS |
| A focused row's corners "can also become rounded … don't add your own masks to round the corners" | HIG › Lists and tables › tvOS |
| Boxes default to the **secondary and tertiary** background colours on iOS/iPadOS | HIG › Boxes › iOS, iPadOS |

**Apple publishes no numeric corner radius.** No radius table exists on the site, and
`…/specifications` returns 404. Numeric radii ship only inside the downloadable Apple UI Kit.
Everything in §5.2 is therefore `[CEMURM DECISION]`, derived from the shape vocabulary above plus
the size ladder Apple *does* publish (28/32/44/52/64 pt, HIG › Buttons › visionOS).

### 5.2 The CEMURM radius scale

| Token | px | Component class | Sizing rule |
|---|---|---|---|
| `radius-xs` | 4 | tag, key badge, small chip | fixed |
| `radius-sm` | 8 | text input, icon button, segment, menu row | min height 32 |
| `radius-md` | 12 | button, list row, toolbar control, tab item | min height 44 |
| `radius-lg` | 16 | card, panel, setlist block, dialog body | min height 88 |
| `radius-xl` | 22 | sheet, modal, popover, command surface | full-bleed on one edge |
| `radius-full` | 9999 | capsule / pill button, avatar, toggle track | height / 2 |

1. **Radius scales with size:** `radius ≈ 0.28 × min(width, height)`, snapped down to the nearest
   token, clamped to `[8, 22]`. This reproduces Apple's own progression across its 28→64 pt button
   ladder and is the single rule that makes the scale self-consistent.
2. **Never exceed one third of the short edge.** Past that the corner consumes the control and it
   stops reading as a button. Apple's reasoning applies: eyes are pulled to corners (HIG › Buttons ›
   visionOS). A 44 px control at `radius-full` is a pill, not a button.
3. **Two controls of the same class share a radius, always.** "Once you establish a behavior or
   appearance for an element, apply it throughout your design" (HIG › Design principles ›
   Familiarity). A per-instance radius is forbidden.
4. **Horizontal row → capsule. Vertical stack → rounded rectangle.** Verbatim Apple rule
   (HIG › Buttons › visionOS). Stage mode is a horizontal row, so next/previous are capsules; the
   settings list is a vertical stack, so its rows are `radius-md`.
5. **Capsule is for the primary standalone action only.** "When you need to display a button by
   itself, prefer a capsule-shape button" (same). A screen with three capsules has no primary
   action. **Icon-only control → circle** (same source).
6. **Card radius never exceeds the radius of the control on it by more than 4 px.** A `radius-xl`
   sheet holding `radius-xs` badges reads as broken; a `radius-md` row inside a `radius-xl` sheet
   reads as intentional.
7. **Stage mode raises every token by 4 px and caps `radius-xl` at 28 px.** At 1–2 m the same
   radius subtends a smaller visual angle, so the "eyes are drawn to corners" effect gets
   *stronger*, not weaker. Apple's rule applied at a longer viewing distance (HIG › Designing for
   macOS gives 1–3 ft for macOS; stage viewing is longer).

### 5.3 Continuous corners on the web

CSS `border-radius` is a circular arc — Apple's `circular` style. No CSS primitive provides
`continuous` curvature; Apple documents the word but not its geometry.

- Use `border-radius` for everything up to and including `radius-lg`. One composited property, free,
  supported everywhere.
- The continuous treatment is permitted on **at most one component** — the topmost sheet / modal
  surface — and only as a **static inline SVG `clip-path`** with a hand-authored path, never as a
  runtime `filter: url(#…)` or a `backdrop-filter` combination. `[CEMURM DECISION]`
- Why: a runtime SVG filter forces a filter pass every frame the element is visible, and combining
  it with `backdrop-filter` on one element is a compositing trap on the tablets CEMURM targets. A
  static `clip-path` is rasterised once.
- Never apply continuous corners to anything that scrolls, and never to a list item. A scrolling row
  with a squircle clips against its own mask every frame.

### 5.4 Elevation: lightness, not shadow

Verified:

- "In Dark Mode, the system uses two sets of background colors — called **base** and **elevated** —
  to enhance the perception of depth when one dark interface is layered above another. The base
  colors are dimmer, making background interfaces appear to recede, and the elevated colors are
  brighter, making foreground interfaces appear to advance." (HIG › Dark Mode › iOS, iPadOS)
- "the background color automatically changes from base to elevated when an interface is in the
  foreground, such as a popover or modal sheet" (same)
- "Liquid Glass appears **more opaque in larger elements like sidebars** to preserve legibility over
  complex backgrounds" (HIG › Color › Liquid Glass color) — size and opacity are linked.
- macOS exposes `shadowColor` and `highlightColor` as roles (HIG › Color › macOS), but the HIG
  publishes **no shadow or elevation level table** anywhere.
  `[UNVERIFIED — does not exist on the live site]`

**Apple publishes two surface levels, not an elevation ladder.** `[CEMURM DECISION]` for the
rest:

| Level | Token | Colour | Ratio vs previous `[COMPUTED]` | Permitted content |
|---|---|---|---|---|
| Stage background | `cem.stage.bg` | `#000000` | — | stage-mode surroundings only |
| 0 — base | `cem.base` | `#0f172a` | — | app background |
| 1 — elevated | `cem.surface` | `#1e293b` | 1.220 | every card, row, panel, content-layer surface |
| T — transient | `cem.elevated` + shadow | `#334155` | 1.413 | **only** sheet, modal, popover, command palette |
| S — state overlay | `cem.hover` | `#475569` | 1.366 | hover / pressed. **Never a resting surface** |

1. **Two content levels, not five.** Apple's model is base + elevated; everything above that in
   the repo is either the transient layer or a state overlay.
2. **Elevation is expressed by lightness in dark mode.** A higher surface is *lighter*. Never
   darker, never a hue shift. Apple's gray ladder proves the direction (§2.2: `systemGray6` goes
   242 → 28).
3. **Shadows are for the transient layer only.** A card in the content layer gets **no shadow** — it
   gets a lighter fill. Apple's model has no third content level for a shadow to occupy.
4. **Two shadow tokens, both black, both for `T`:** `shadow-popover: 0 8px 24px rgb(0 0 0 / 0.45)`
   and `shadow-modal: 0 24px 64px rgb(0 0 0 / 0.60)`. `[CEMURM DECISION]` In a dark room a shadow
   is nearly invisible against `#0f172a` anyway; the fill step is what communicates elevation. The
   shadow exists only to separate the transient layer from content scrolling under it.
5. **One transient surface at a time.** "Show one popover at a time. Displaying multiple popovers
   clutters the interface and causes confusion. Never show a cascade or hierarchy of popovers"
   (HIG › Popovers › Best practices). Nested modals are forbidden.
6. **Over images and video, the transient layer gets Apple's 35% black dimming layer** if the
   underlying content is bright (HIG › Materials › Liquid Glass). The stage display shows imported
   cover art, so this is load-bearing there, not optional.

### 5.5 Separators vs borders vs elevation

Apple publishes the two separator roles precisely, and that distinction is the whole rule set:

- `separator` — "A separator that **allows some underlying content to be visible**."
- `opaqueSeparator` — "A separator that **doesn't allow any underlying content to be visible**."
  (HIG › Color › iOS, iPadOS)

And the anti-nesting rule: "Consider using padding and alignment to communicate additional grouping
within a box. A box's border is a distinct visual element — adding nested boxes to define subgroups
can make your interface feel busy and constrained." (HIG › Boxes › Best practices)

Pick **exactly one** mechanism per boundary:

| Boundary | Mechanism | Token | Apple precedent |
|---|---|---|---|
| Items inside one flat list section | 1 px separator | `border-bottom: 1px solid rgb(248 250 252 / 0.08)` | `separator` — one vibrancy value, all materials |
| Boundary between list **sections** | Negative space, no line | `space-8` + optional section label | "use negative space, container shapes, or separator lines" (HIG › Layout › Visual hierarchy) |
| A group of related items, in the content layer | 1 px border on a container | `border: 1px solid rgb(248 250 252 / 0.10)` | `opaqueSeparator` (HIG › Color) |
| A container inside a container | **Padding only. No line, no second border.** | `space-6` | HIG › Boxes, quoted above |
| Content floating above content | Elevation: `shadow-popover` + `#334155` | — | HIG › Dark Mode › iOS, iPadOS |
| Border around a focusable control | Never. Use the focus ring. | — | §7.5 |

- **Never more than one of {separator, border, elevation} on the same boundary.**
- **A separator is 1 px, hairline weight, and never the only carrier of meaning** —
  `#f8fafc` at 0.08 over `#0f172a` computes to **1.23:1** `[COMPUTED]`. It separates; it does not
  label. Anything a separator alone communicates must also be carried by spacing or an icon.
- **Separators do not span full width by default.** Indent them to the start of the row's text
  content — aligned items are perceived as related (HIG › Layout › Visual hierarchy).
- **The scroll edge replaces the top separator.** "Instead of applying a solid or semi-opaque
  background color beneath controls, use a scroll edge effect to visually elevate controls above
  content" (HIG › Layout › Visual hierarchy). In CSS that is a mask gradient at the top and bottom
  of a scroll container, not a border.
- **Grouping expression priority, highest first:** negative space → container shape → separator
  line. That is Apple's own ordering in the same sentence.

---

## 6. Motion

### 6.1 What the Motion page actually contains

**Zero duration tokens. Zero easing curves.** The page is entirely qualitative. The only timing
figures published anywhere on it:

| Figure | Context | Source |
|---|---|---|
| **30 to 60 fps** | "In most games, maintaining a consistent frame rate of 30 to 60 fps typically results in a smooth, visually appealing experience." | HIG › Motion › Leveraging platform capabilities |
| **~0.2 Hz** oscillation to avoid | "you want to avoid showing an oscillation with a frequency of around 0.2 Hz because people can be very sensitive to this frequency" | HIG › Motion › visionOS |
| "a moment" / "a second or two" | threshold before a loading indicator is warranted | HIG › Loading › Showing progress, watchOS |
| "for a moment" | delay before a macOS/visionOS tooltip appears | HIG › Buttons › Content |

`[UNVERIFIED — Apple publishes no motion duration or easing table on the HIG website.]`

### 6.2 Verified motion rules

| Rule | Source |
|---|---|
| "Add motion purposefully … Don't add motion for the sake of adding motion." / "Gratuitous or excessive animation can distract people and may make them feel disconnected or physically uncomfortable." | HIG › Motion › Best practices |
| "Make motion optional. Not everyone can or wants to experience the motion … avoid using it as the only way to communicate important information." / "supplement visual feedback by also using alternatives like haptics and audio" | same |
| "Strive for realistic feedback motion that follows people's gestures and expectations." / "Aim for **brevity and precision** in feedback animations." | same |
| "In apps, **generally avoid adding motion to UI interactions that occur frequently.** The system already provides subtle animations for interactions with standard interface elements." | same |
| "Let people cancel motion. As much as possible, don't make people wait for an animation to complete before they can do anything." | same |
| "All layout- and appearance-based animations automatically include built-in easing that plays at the start and end of the animation. You can't turn off or customize easing." | HIG › Motion › watchOS |

The frequent-interaction rule is decisive for CEMURM: a stage display's next/previous control is
tapped many times per service, and Apple says do not add motion to it.

### 6.3 Verified reduced-motion requirements

Apple's Reduce Motion list (HIG › Accessibility › Cognitive), applied when the setting is active:
"Tightening animation springs to reduce bounce effects"; "Tracking animations directly with people's
gestures"; "**Avoiding animating depth changes in z-axis layers**"; "**Replacing transitions in x-,
y-, and z-axes with fades to avoid motion**"; "**Avoiding animating into and out of blurs**".

Also (same source): "Minimize use of time-boxed interface elements. Views and controls that
auto-dismiss on a timer can be problematic" — no auto-dismissing toast, ever.

### 6.4 CEMURM duration and easing tokens

`[CEMURM DECISION]` — Apple's own values are not published. Durations are 4 px-base aligned and
named for what they animate, not for a scale factor.

| Token | ms | Easing | Use |
|---|---|---|---|
| `motion-instant` | 80 | `linear` | pressed → active feedback on a control |
| `motion-fast` | 120 | `cubic-bezier(0.4, 0, 0.6, 1)` | hover, focus, checkbox, toggle |
| `motion-base` | 200 | `cubic-bezier(0.32, 0.72, 0, 1)` | sheet present, popover, dialog, selection change |
| `motion-slow` | 320 | `cubic-bezier(0.32, 0.72, 0, 1)` | route change, list insert, full-screen present |
| `motion-stage` | 90 | `cubic-bezier(0.4, 0, 0.6, 1)` | the current-song change in stage mode |

1. **Stage mode uses `motion-stage` for everything, 90 ms ceiling.** A musician changes songs
   mid-service; the transition must resolve before they look up from the instrument. The ceiling is
   a function of the task, not of taste.
2. **Never exceed 320 ms** for any content transition. Nothing in CEMURM's repertoire flow needs
   longer.
3. **Same easing curve for enter and exit**, and exit is never longer than enter. This is the web
   equivalent of Apple's built-in start/end easing, which it describes as non-customizable — the
   principle is that easing is not a per-case decision.
4. **Animate `transform` and `opacity` only.** Never `width`, `height`, `top`, `left`, `filter` or
   `backdrop-filter`. Apple's Reduce Motion list bans animating "into and out of blurs" and "depth
   changes in z-axis layers"; a CSS `filter` animation is the browser equivalent of both.
5. **No motion on the primary control of any screen.** Per the frequent-interaction rule, the
   next/previous song control animates only its selection indicator, not the whole row.
6. **`prefers-reduced-motion: reduce` is mandatory.** Under `reduce`, replace every x/y/z transform
   transition with an opacity cross-fade, exactly as Apple prescribes. Do **not** delete the
   transition — the cross-fade is the accessible equivalent. Apple removes movement, not
   information.

   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: 1ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 1ms !important;
       scroll-behavior: auto !important;
     }
   }
   ```

7. **Nothing auto-plays and nothing auto-dismisses.** No carousel, no toast timer, no skeleton
   shimmer loop. Apple's Loading rule is to show content as soon as possible, not to stage a
   performance.

---

## 7. Controls and states

### 7.1 Verified control inventory

Every page below was reached from the live HIG component index. Categories are Apple's.

| Category | Components |
|---|---|
| **Menus and actions** | activity views, **buttons**, context menus, dock menus, edit menus, home-screen quick actions, menus, ornaments, pop-up buttons, pull-down buttons, the menu bar, toolbars |
| **Navigation and search** | path controls, search fields, sidebars, tab bars, token fields |
| **Selection and input** | color wells, combo boxes, digit entry views, image wells, pickers, **segmented controls**, **sliders**, steppers, text fields, **toggles**, virtual keyboards |
| **Layout and organization** | **boxes**, **collections**, column views, **disclosure controls**, **labels**, **lists and tables**, lockups, outline views, split views, tab views |
| **Presentation** | action sheets, alerts, page controls, panels, **popovers**, scroll views, sheets, windows |
| **Status** | activity rings, gauges, **progress indicators**, rating indicators |
| **Content** | web views, text views, image views, charts |
| **System experiences** | widgets, watch faces, top shelf, **status bars**, snippets, **notifications**, live activities, **controls**, complications, app shortcuts |

Load-bearing for CEMURM, in bold above: buttons, segmented controls, toggles, sliders, lists and
tables, collections, popovers, sheets, alerts, progress indicators, status bars, labels, text
fields, disclosure controls.

### 7.2 Button roles (verified)

"A system button can have one of the following roles" (HIG › Buttons › Role):

| Role | Meaning | Appearance effect |
|---|---|---|
| **Normal** | "No specific meaning." | default |
| **Primary** | "The button is the default button — the button people are most likely to choose." | "a primary button uses an app's accent color" |
| **Cancel** | "The button cancels the current action." | non-accent |
| **Destructive** | "The button performs an action that can result in data destruction." | "a destructive button uses the system red color" |

- "**Keep the number of prominent buttons to one or two per view.**" (HIG › Buttons › Style)
- "**Don't assign the primary role to a button that performs a destructive action**, even if that
  action is the most likely choice. Because of its visual prominence, people sometimes choose a
  primary button without reading it first." (HIG › Buttons › Role)
- "Use style — not size — to visually distinguish the preferred choice among multiple options."
  (same)
- "**Always include a press state for a custom button.** Without a press state, a button can feel
  unresponsive, making people wonder if it's accepting their input." (HIG › Buttons › Best practices)

### 7.3 State inventory per control

Apple publishes no single cross-platform state table. These are the states it names where it names
them, plus the states implied by its component guidance.

| State | Verified Apple statement | CEMURM treatment `[CEMURM DECISION]` |
|---|---|---|
| **Rest** | `controlColor` is "The surface of a control"; `controlTextColor` is "The text of a control that is available" (HIG › Color › macOS) | `cem.surface` fill, `cem.text` label, `radius-md` |
| **Hover** | visionOS defines Idle / Hover / Selected / Unavailable, and "buttons don't support custom hover effects" (HIG › Buttons › visionOS). macOS and visionOS show a tooltip "after people hover over a button for a moment" | pointer devices only; 4% white overlay. **Never the sole carrier of meaning** |
| **Pressed** | "Always include a press state for a custom button" (HIG › Buttons) | fill steps to `#334155` + `scale(0.98)` over `motion-instant` |
| **Selected** | a navigation table "persistently highlights the selected row"; an options table "highlights a row only briefly before adding an image — such as a checkmark" (HIG › Lists and tables › Best practices) | `radius-md` fill + 1.5 px leading bar + weight 600. Persist, never flash |
| **Disabled** | `disabledControlTextColor` is "The text of a control that's unavailable" (HIG › Color › macOS) | `#f8fafc` at the alpha floor below, `cursor: not-allowed`, no press response |
| **Focused** | `keyboardFocusIndicatorColor` is "The ring that appears around the currently focused control when using the keyboard for interface navigation" (HIG › Color › macOS) | see §7.5 |
| **Unavailable** | visionOS's fourth button state, alongside Idle / Hover / Selected | same as Disabled |

`[COMPUTED]` alpha floors: `#f8fafc` needs **0.47** over `cem.base` and **0.58** over `#334155` to
clear 4.5:1. `cem.secondary` `#94a3b8` needs no reduction on base or surface (6.96 / 5.71) but
already fails on `#334155` (4.04) — a disabled control on the transient layer is unreadable at any
alpha below 1.0. Use `#f8fafc @ 0.58` there, not `cem.secondary`.

### 7.4 Hit targets

| Rule | Value | Source |
|---|---|---|
| Button hit region | **44 × 44 pt** minimum | HIG › Buttons › Best practices |
| iOS/iPadOS control | default 44 × 44 pt, minimum 28 × 28 pt | HIG › Accessibility › Mobility |
| Padding, bezelled element | about 12 pt | same |
| Padding, un-bezelled element | about 24 pt | same |
| Image button internal padding | about 10 px | HIG › Buttons › Image buttons |
| visionOS button centres | at least 60 pt apart; +4 pt padding if the button is ≥60 pt | HIG › Layout › visionOS |
| Segmented control segments | ≤ 5 on a phone, ≤ 7 on a wide interface | HIG › Segmented controls |
| Controls per row (watchOS ceiling) | ≤ 3 glyph buttons or ≤ 2 text buttons | HIG › Layout › watchOS |

`[CEMURM DECISION]`:

1. **Minimum hit target is 48 × 48 CSS px.** 44 px is Apple's iOS floor for a device held 25–40 cm
   away; a tablet clamped to a stand at 50–80 cm, operated by someone not looking at it, needs the
   extra 4 px. Enforce with `min-h-12 min-w-12` on every interactive element, plus `padding` where
   the visual box is smaller than 48 px.
2. **Gap between adjacent targets ≥ 8 px (`space-2`)**, and ≥ 12 px (`space-3`) in a vertical stack
   — Apple's 12 pt bezelled figure.
3. **A 48 px target must hold on a cold, sweaty finger.** The primary next/previous controls are
   **64 px** tall, the top rung of Apple's own button ladder (HIG › Buttons › visionOS:
   Regular 44, Large 52, Extra large 64).
4. **The hit area may exceed the visual area; the reverse is forbidden.** Apple's 10 px
   image-button rule is the same principle.

### 7.5 Focus ring

1. **Keyboard focus ring: 2 px solid `cem.text` at 0.90 alpha, offset 2 px, radius = the control's
   own radius + 2 px.** `[CEMURM DECISION]` — derived from Apple's `keyboardFocusIndicatorColor`
   role (HIG › Color › macOS). The only HIG-published fact is that a ring exists and has its own
   semantic role; no width, offset or colour value is published.
2. **The focus ring is never the accent colour.** A musician must distinguish "this has keyboard
   focus" from "this is the current song" at a glance. Amber is reserved (§2.4).
3. **`:focus-visible` only.** Never suppress the ring without a replacement; the common
   `outline: none` is a straight accessibility regression.
4. **Focus is never colour-only.** "Avoid using only color to indicate focus. Subtle scaling and
   responsive animation are the primary ways to denote interactivity when an element is in focus"
   (HIG › Color › tvOS). A 2 px *offset* ring is a shape change, which satisfies this.
5. **Focus order follows reading order** — top to bottom, leading to trailing
   (HIG › Layout › Visual hierarchy).

### 7.6 Which states are load-bearing for CEMURM

Context: a musician changing songs mid-service, in a dark room, on a tablet on a stand, hands
possibly damp, eyes not on the screen.

| State | Load-bearing? | Why |
|---|---|---|
| **Selected** | **Critical** | This is the "what am I playing right now" signal, readable at 1–2 m in the dark. The only place full-saturation amber is allowed (§2.4). Must not rely on colour alone — "Make sure the visual differences in a toggle's state are obvious … Avoid relying solely on different colors to communicate state" (HIG › Toggles). Pair with a 1.5 px leading bar and weight 600. |
| **Pressed** | **Critical** | A missed press during a service is unrecoverable. `motion-instant` (80 ms) + `scale(0.98)` + a fill step gives three simultaneous channels. Never a press delay; never over 100 ms. |
| **Disabled** | High | Encodes offline / not-downloaded / write-queued state, and must be distinguishable from a failed load. Never red — red is Apple's destructive colour. |
| **Focused** | Medium | Keyboard is used for rehearsal and for a laptop-connected display, not usually live. Full support, low visual priority. |
| **Hover** | **Not load-bearing** | A stage tablet is a touch device. Encode **no meaning** in hover; hover styles are a pointer affordance only. |

Further verified rules that apply directly:

- "you might add or remove a color fill, show or hide the background shape, or change the inner
  details you display — like a checkmark or dot" (HIG › Toggles › Best practices) — more than one
  channel, always.
- "Use the switch toggle style only in a list row" (HIG › Toggles › iOS, iPadOS). Outside a list,
  Apple uses a button that behaves as a toggle, not a switch.
- "you use a determinate progress indicator when you know how long loading will take, and you use
  an indeterminate progress indicator when you don't" (HIG › Loading › Showing progress). CEMURM's
  offline write queue is determinate — show the count.
- "Don't use a slider to adjust audio volume" (HIG › Sliders › iOS, iPadOS) — use a volume view.
- "Avoid using a popover to show a warning. People can miss a popover or accidentally close it."
  (HIG › Popovers › Best practices) — destructive confirmations are alerts, never popovers.
- "Prefer a table instead of a collection for text." (HIG › Collections › Best practices) — the
  repertoire list and the setlist are tables, not a grid of cards.

---

## 8. Dark mode specifics

CEMURM is **dark-first**: the dark palette is the primary palette, not a variant. Apple's position
permits this exactly.

### 8.1 Verified rules

| Rule | Source |
|---|---|
| "In rare cases, consider using only a dark appearance in the interface. For example, it can make sense for an app that supports immersive media viewing to use a permanently dark appearance that lets the UI recede and helps people focus on the media." | HIG › Dark Mode › Best practices |
| "The color palette in Dark Mode includes dimmer background colors and brighter foreground colors. It's important to realize that these colors aren't necessarily inversions of their light counterparts: while many colors are inverted, some are not." | HIG › Dark Mode › Dark Mode colors |
| "In Dark Mode, the system uses two sets of background colors — called base and elevated … The base colors are dimmer … and the elevated colors are brighter" | HIG › Dark Mode › iOS, iPadOS |
| "The system uses vibrancy and **increased contrast** to maintain the legibility of text on darker backgrounds." | HIG › Dark Mode › Text |
| "turning on Increase Contrast in Dark Mode can result in **reduced** visual contrast between dark text and a dark background" | HIG › Dark Mode › Best practices |
| "Soften the color of white backgrounds … consider slightly darkening the image to prevent the background from glowing" | HIG › Dark Mode › Dark Mode colors |
| "Design separate interface icons for the light and dark appearances if necessary." | HIG › Dark Mode › Icons and images |
| "At a minimum, make sure the contrast ratio between colors is no lower than 4.5:1. For custom foreground and background colors, strive for a contrast ratio of 7:1, especially in small text." | HIG › Dark Mode › Dark Mode colors |
| "Avoid offering an app-specific appearance setting." | HIG › Dark Mode › Best practices |

### 8.2 How surfaces stack in dark mode

Apple's model is **elevation by lightness**. `[COMPUTED]` ratios on CEMURM's ramp:

| Step | Hex | Ratio vs step below | Reading |
|---|---|---|---|
| Stage background | `#000000` | — | absolute floor, used only in stage mode |
| Level 0 — base | `#0f172a` | — | "making background interfaces appear to recede" |
| Level 1 — elevated | `#1e293b` | **1.220** | "making foreground interfaces appear to advance" |
| Transient | `#334155` | **1.413** | popover / sheet / modal only |
| State overlay | `#475569` | **1.366** | hover / pressed. **Never a resting surface** |

1. **Monotonic lightness. Every step up is lighter.** Verified direction: Apple's `systemGray6`
   moves 242 → 28 entering dark mode, and the base/elevated rule says brighter advances. A "darker
   overlay on hover" inverts the model and reads as a hole.
2. **Exactly two content levels.** §5.4 table. Two of the repo's four surface steps are demoted to
   the transient layer and the state overlay.
3. **Every text pair clears 7:1 (CEMURM target) or 4.5:1 (Apple floor).** Level 0 → Level 1 at
   1.220 is a *deliberately* small step; separation is carried by text contrast and the 1 px
   border, not by the fill. Do not "fix" the 1.220 by lightening `#1e293b` — check the text ratio
   first.
4. **No hue shift between levels.** Apple's grays are neutral (`R=G=B` in every row of §2.2).
   `#0f172a`, `#1e293b`, `#334155` share one blue-slate hue, which is correct. Move only lightness.
5. **Vibrancy has no web equivalent** (§1.6). The substitute is the label opacity ladder, whose
   floors are in §5.5 and §3.4.

### 8.3 The stage display

Stage mode (`cem.stage.*`: `#000000` background, `#f59e0b` chord, `#f8fafc` lyric, `#94a3b8`
section, `#1e293b` dim) is the immersive-media case Apple's Dark Mode page explicitly sanctions.
Verified `[COMPUTED]`: `#f8fafc` lyric on `#000000` = **20.07**, `#f59e0b` chord on `#000000` =
**9.78**, `#94a3b8` section on `#000000` = **8.19**. All clear 7:1.

1. **No translucency at all in stage mode.** No `backdrop-filter`, no material, no overlay. The
   stage surface is `#000000` and there is nothing behind the content to blur; a blur pass over
   black costs GPU and returns black.
2. **No shadow in stage mode.** A shadow on black is invisible and costs a compositing pass.
   Separation is a 1 px hairline or nothing.
3. **Every size is ≥ 1.25× normal mode**, and the type ramp moves to `display` / `heading` only.
   Apple's legibility rule permits this: "consider using a larger type size"
   (HIG › Typography › Ensuring legibility).
4. **Only the current song is amber** (§2.4). Three amber elements on a stage display means no
   current song.
5. **No animation longer than 90 ms** (§6.4).
6. **No blinking, no flashing, no marquee.** Apple's rule against displaying "a bright object on a
   very dark or black background, especially if the object flashes or moves"
   (HIG › Color › visionOS). Screen brightness is a hardware concern, not a CSS one — do not fake
   it with a white overlay.

### 8.4 Increase contrast

CEMURM ships one appearance, so Apple's Increase Contrast setting does not apply as a mode. Two
consequences, both verified:

- Apple warns that "turning on Increase Contrast in Dark Mode can result in reduced visual contrast
  between dark text and a dark background" (HIG › Dark Mode › Best practices). On a single dark
  palette, **an "increase contrast" mode must raise text lightness or surface separation, never
  lower the text.**
- Honour `@media (prefers-contrast: more)` by raising the separator alpha from 0.08 to 0.16 and the
  surface step from `#1e293b` to `#263244`. Do not touch the type ramp — the roles already clear
  7:1.

---

## 9. What does not transfer

Each entry is a prohibition with its cost and its failure mode.

| Apple convention | Why it does not transfer | Cost | Failure mode on a low-end tablet |
|---|---|---|---|
| **Liquid Glass, in any form** | A GPU-composited native material with live lens distortion, specular response and content-adaptive colour. No CSS primitive. The web approximation is a translucent fill plus a blur — a different mechanism with a different cost model. | Highest per-pixel GPU cost in the system. `backdrop-filter` forces a backdrop readback and blur **on every frame in which it is visible** — i.e. for the whole duration of a scroll. | Jank during exactly the scroll a stage display performs; heat and battery drain over a 90-minute service. On a device without hardware blur the fallback is a far slower software path. **Prohibited in stage mode. At most one chrome surface elsewhere, never on a scroll container or a list row.** |
| **Vibrancy** | Blurs and re-tints the *content underneath the label*, per pixel, adapting to it. No CSS primitive blurs an arbitrary backdrop into a text colour. | Any attempt (a large blur, an SVG filter, a duplicated blurred copy of the backdrop) multiplies blur cost by the number of text elements. | Text whose contrast changes as content scrolls underneath, or a GPU-bound UI on the lowest tier. **Use opacity steps. Prohibited as a technique.** |
| **"60 fps" / 30–60 fps assumption** | Apple's figure is for games on devices with a well-binned GPU (HIG › Motion). | Sustained 60 fps on a weak GPU means thermal throttling. | Progressive frame-rate collapse and shutdown mid-service, on the one device that cannot be replaced until the next rehearsal. **Animate only `transform` and `opacity`; treat 60 fps as a ceiling to stay under.** |
| **Continuous ("squircle") corners everywhere** | No CSS equivalent. A runtime SVG `filter` is a per-frame filter pass; a static path must be authored by hand per radius. | Runtime filter = a second full-surface pass composited with `backdrop-filter`. Static path = maintenance cost for a difference no user can name. | Jank, and blurred glyphs if the filter region clips text. **Permitted on exactly one component (the topmost sheet) as a static `clip-path`, nowhere else.** |
| **User-overridable accent colour** (HIG › Color › App accent colors) | An AppKit / System Settings feature. A PWA has no access to it, and amber is load-bearing for the now-playing signal. | — | A user whose OS accent is blue would make the current song indistinguishable from ordinary chrome. **`#f59e0b` is fixed and non-overridable.** |
| **System dynamic colours / Increase Contrast** (HIG › Color) | Apple ships per-appearance, per-contrast variants of every semantic colour and swaps them free. A web palette is fixed hex with no runtime variant switching. | Maintaining 4 variants (light / dark / increased light / increased dark) of every role is a permanent tax for a single-appearance product. | A role verified at 4.5:1 in dark mode silently failing under a non-standard display profile or a True Tone-style white-point shift. **Ship one dark palette, verify every pair against it, and use `prefers-contrast: more` as the only variant axis.** |
| **44 pt hit targets** | Assumes a device 25–40 cm from the eye and a fingertip with full proprioceptive feedback. A stage tablet is at 50–80 cm, possibly clamped, operated without looking, by hands that may be damp. | A target sized to Apple's number rather than to the task is a mis-hit rate, not a beauty problem. | Missed taps at the one moment a musician cannot afford one, and a re-tap that lands on the *previous* song. **48 px minimum; 64 px for the primary stage control.** |
| **Tooltips on hover** (HIG › Buttons) | A pointer affordance. A stage tablet is a touch device; there is no hover. | — | A control whose only explanation is a tooltip is an unlabeled control on the actual target hardware. **Every control carries a visible label or an icon that reads without hover.** |
| **Springs, haptics, audible feedback, spring loading** (HIG › Buttons › macOS; HIG › Motion) | Platform affordances with no reliable web equivalent. `navigator.vibrate` is absent on iOS Safari and gated on Android. | — | A "tactile" interaction that is silent on the actual device. **Haptics are not part of CEMURM's feedback contract; do not design around them.** |
| **Auto-dismiss, time-boxed views** (HIG › Accessibility › Cognitive) | Apple still discourages these; a native app at least has the system to intervene. | — | A confirmation that vanishes before a musician reads it, on the one screen where a mistake breaks a service. **No auto-dismissing anything. No toast timer.** |
| **tvOS focus scaling** (HIG › Color › tvOS) | tvOS has a 10-foot UI, a remote, and a focus engine that keeps exactly one element focused. A tablet has neither. | — | Scaling every control on a page that never receives focus makes the whole page look broken. **Focus is keyboard-only, via `:focus-visible`, with a ring and no scale.** |
| **Popover-heavy navigation** (HIG › Popovers) | Popovers rely on click-outside dismissal and a pointer. On touch, the first tap can dismiss the popover the second tap was aimed at. | — | A musician tapping "next song" dismisses a popover instead of advancing. **No popovers in the stage flow. Sheets and full-screen views only.** |
| **The macOS 1–3 ft viewing distance and pointer-precision density** (HIG › Designing for macOS) | A different device class. A stage tablet is further, glarer, often below eye level. | — | Type and targets tuned for 30 cm read as sparse and imprecise at 80 cm. **Everything moves up one role in the type ramp and one rung in the size ladder in stage mode.** |
| **`systemGray*` values as a palette** (HIG › Color) | Apple says explicitly: "Avoid hard-coding system color values. Documented color values are for your reference during the app design process. The actual color values may fluctuate from release to release." | Copying them produces a palette Apple will invalidate. | A design that drifts from its own documentation the next time the HIG changes. **Use the table only to reason about the lightness ladder and step spacing. Never copy a value into `tailwind.config.js`.** |
| **Wide color / Display P3** (HIG › Color › Color management) | P3 needs a wide-gamut display and P3 assets. A stage tablet in a dark room is very unlikely to be one, and P3 values can clip on sRGB panels. | Wider-gamut assets for no perceptible gain on the target device. | "Occasionally, it may be hard to distinguish two very similar P3 colors when viewing them on an sRGB display. Gradients that use P3 colors can also sometimes appear clipped" — Apple's own words. **Stay in sRGB. `#f59e0b` and the slate ramp are already sRGB.** |
