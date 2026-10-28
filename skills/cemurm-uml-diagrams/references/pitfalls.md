# Pitfalls

Every item here cost real debugging time. Each was verified, not inferred.

## Kroki

- **Two or more comment lines → HTTP 400.** One is fine. This is a Kroki bug, not PlantUML
  syntax. Keep metadata out of the `.puml`.
- **The file must end with a newline.** Missing trailing newline → 400 with no useful message.
- **Non-ASCII in comments fails.** Use ASCII hyphens, never an em-dash.
- Start it with `docker run -d --name kroki -p 127.0.0.1:8000:8000 yuzutech/kroki:latest`.
  The public `kroki.io` works but sends the diagram to a third-party server.

## PlantUML

- `skinparam linetype { ortho }` is not valid → 400 Syntax Error.
- `note` crashes when theme skinparams are applied. Put notes in the HTML cards.
- Stereotypes render as UTF-8 guillemets (`«include»`), not `&lt;&lt;include&gt;&gt;`.
- `textLength` fixes the width measured from the **source** text. After the language
  switches, the browser stretches glyphs to fill it: `A d d a s o n g`. Always strip it.
- Actors carry `class="entity"` exactly like use cases. The only reliable discriminator is
  that a use case name contains a dot (`CEMURM.UC1`) and an actor does not (`Musician`).
  Process them in one pass or the second pattern steals the actor.

## SVG post-processing

- **Do not give `stroke` to text.** A stroke is a second paint pass over the glyph: it fattens
  and blurs. Text and actor shapes need separate classes (`uc-ink` vs `uc-ink-stroke`).
  `getComputedStyle().fontWeight` and `.textShadow` both report normal here, so those
  measurements will not catch it — read the SVG attributes instead.
- `data-entity-1` / `data-entity-2` hold **internal ids** (`ent0001`), not names. Map them to
  `data-node-id` before writing `data-edge-from`.
- The cylinder is detected by 4 `C` curves plus 2 `L` lines in the path, not by an `A`.
- Injecting attributes into a tag that already has them breaks the XML (`Attribute redefined`).
- Match tags by class (`class="entity"`). A bare `.*?</g>` swallows the `<g class="cluster">`
  wrapper and stops at its inner `</g>`.
- **A function that transforms must return what it transformed.** Changing `mark_diagram_text()`
  to return `(keys, missing)` without updating the caller silently discarded the marked SVG
  while the script still reported success.

## Colors and theme

- The SVG background is transparent; no renderer honours `style="background"`. Insert a
  `<rect class="uc-canvas">` as the first child.
- Inline `style="stroke:..."` needs `!important` in CSS to be overridden.
- CSS appended at the end of `<head>` loses to the viewer's stylesheet on equal specificity.
  Append to the end of `<body>`.

## Viewer layout

- `svg { width: 100%; min-width: min(900px, 100%) }` scales the diagram (~×1.32 at 1440 px).
  The viewer computes this in JavaScript, so CSS `width: auto !important` does **not** win.
  The residual blur from that scaling is the one defect left open.
- The semantic passport is `position: absolute` inside `.diagram-container` and covers the
  drawing. Move it to `.container` with `appendChild` and force `position: fixed`.
- Rows inside the passport have 3–4 **inline** children with no separator; force
  `display: block` on the children, not on the row.
- The group title does not interpolate `{count}` — the viewer appends it separately. Remove the
  placeholder from the catalog value.
- `textLength`, `drop_text_length()` and the `«` characters are unrelated; do not conflate them.

## Catalog

- Keys live in two planes: the template's `{{i18n}}` (176) and the JS `viewerText()` calls (198).
  Covering only the first leaves raw identifiers on screen.
- Some keys are used **only at runtime** and never appear in the template: `viewer.theme.light`,
  `viewer.preset.classic.short`. Search the viewer JavaScript for them.
- Copy the viewer's **full** font stack. A truncated stack
  (`"JetBrains Mono", ui-monospace, monospace`) resolves early and hints differently.
- The `editorial` preset switches the `<h1>` to Georgia. For a presentation keep `classic`.

## Diagram semantics

- A use case diagram holds actors, use cases, the boundary and relationships — nothing else.
  A cylinder and a storage actor are noise; persistence lives in `docs/er-diagram.html`.
- Without `left to right direction` every stereotype label lands on one line and overlaps.
  `nodesep` controls the vertical separation of labels (`60 → ~51 px`); `ranksep` does not.
- **Three or more associations from one actor collapse the layout.** PlantUML renders them as
  enormous filled wedges that cover the diagram; the text still reads fine in the DOM, so only
  a screenshot catches it. Cap an actor at two use cases and route the rest through the base.