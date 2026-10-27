# Pipeline

Three scripts under `docs/uml/`. Two are run per diagram; the third feeds the second.

## `stamp_archify.py`

The generator. Turns a `.puml` into a standalone interactive HTML.

```bash
python3 docs/uml/stamp_archify.py IN.puml OUT.html [flags]
```

| Flag | Meaning |
|---|---|
| `--locale en\|es` | Language of the viewer chrome |
| `--lang en\|es` | Language of the content (cards, title, subtitle) |
| `--switcher` | Embed the ES/EN toggle that works at runtime |
| `--title` / `--subtitle` | Header text |
| `--keep-svg FILE` | Also write the instrumented SVG |
| `--cards FILE.json` | Override the notes cards; `[]` removes the slot |

Pipeline inside `main()`:

1. `render_puml()` — POST the `.puml` to Kroki, fail loudly if it is not up.
2. `semanticize_colors()` — inline `fill=`/`stroke=` become CSS classes (`uc-surface`,
   `uc-ink`, `uc-muted`, `uc-canvas`, `uc-edge`, `uc-accent`, `uc-ink-stroke`).
3. `drop_text_length()` — remove `textLength`; it stretches glyphs when the language switches.
4. `set_font()` — replace the root `font-family` with the viewer's exact stack.
5. `stamp()` — add `data-node-id`, `data-node-label`, `data-node-kind`,
   `data-edge-from`/`data-edge-to`, background rect, strip fixed size.
6. `mark_diagram_text()` — mark every `<text>` inside a node with `data-i18n="uc.<alias>.<line>"`.
7. Inject the SVG into the archify viewer template.
8. `localize_with_switcher()` — mark `data-i18n` before resolving placeholders, translate,
   embed both catalogs, add the language button.
9. `add_i18n_data_node()` — create `#archify-i18n-data`; without it `viewerText()` returns raw keys.
10. `add_uml_css()` — theme rules, appended at the **end of the body** so it wins the cascade.
11. `replace_cards_slot()` — swap the build's demo cards for real notes.

## `merge_runtime_es.py`

The viewer asks for **198 keys at runtime** with `viewerText('key')`, on top of the 176
`{{i18n}}` in the template. Missing ones render as raw identifiers. This script extracts the
runtime keys from the generated HTML, pulls the official English from the archify skill, and
writes both catalogs — keeping anything already translated by hand.

```bash
python3 docs/uml/merge_runtime_es.py docs/uml/<id>.html
```

Run it **after** a first generation and **before** the final one, so the new keys are embedded.
Its `MANUAL_ES` map holds the hand-written Spanish; anything absent falls back to English and
is counted in the report. Never let it fail silently.

## `viewer-es.json` / `viewer-en.json`

Keep them in the repo, **not** in `~/.agents/skills/archify`. The skill's own catalog declares
`SUPPORTED_LOCALES = ['en','zh-CN']`, and editing it inside the skill is lost on every update.

## Adding a diagram

1. Copy `assets/uc-01-add-song.puml` as the starting point.
2. Give every case an alias in the `.puml` and a matching entry in `UC_LABELS`.
3. Update `CARDS_ES` / `CARDS_EN` with what this case proves.
4. Generate → `merge_runtime_es.py` → generate again.
5. Verify in a browser.