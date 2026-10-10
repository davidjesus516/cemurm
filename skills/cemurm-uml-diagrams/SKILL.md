---
name: cemurm-uml-diagrams
description: "Trigger: UML diagram, use case, casos de uso, class diagram, sequence, PlantUML, Kroki, diagram for teachers. Builds UML diagrams in real notation with the archify viewer, ES/EN and light/dark."
license: Apache-2.0
metadata:
  author: "davidjesus516"
  version: "1.0"
---

# CEMURM UML Diagrams

## Activation Contract

Load when producing a UML diagram for CEMURM — use case, class, sequence, lifecycle —
and before reviewing or regenerating one already under `docs/uml/`.

## Hard Rules

1. **Never use archify for UML shape.** It has no `use case` type; nodes are rectangles.
   UML shape comes from PlantUML via Kroki. archify contributes only the viewer.
2. **Never edit a generated file.** `*.html`, `*.svg` come from the pipeline. Edit the
   `.puml` or the script, then regenerate.
3. **Never add comments to the `.puml`.** Kroki returns HTTP 400 on 2+ comment lines.
4. **Never put a database, cylinder, or storage actor in a use case diagram.** A use case
   diagram holds actors, use cases, the system boundary and relationships. Persistence
   belongs in `docs/er-diagram.html`.
5. **Associate an actor to at most two use cases.** With three or more, PlantUML draws the
   associations as huge overlapping wedges that cover the whole diagram. The base case is
   reached directly; extensions go through the actor only when genuinely needed.
6. **Every actor carries the `<<actor>>` stereotype**, on its own line:
   `actor "Músico\n<<actor>>" as Musician`. Use cases do not carry a stereotype.
7. **Every `<text>` line of a use case needs a key in `UC_LABELS`,** with the same line
   count per language. The script warns when the counts disagree — do not ignore it.
   Actors need an `UC_LABELS` entry too: their second line is the stereotype.

## Decision Gates

| Need | Type |
|---|---|
| Actors, use cases, `«include»`/`«extend»` | PlantUML `usecase` → Kroki |
| Entities, attributes, cardinality | `docs/er-diagram.html` (exists, 48 tables) |
| Message order between two actors | PlantUML `sequence` |
| State machine (`draft → ready → retired`) | PlantUML `lifecycle` |
| Components and trust boundaries | archify `architecture` |

## Execution Steps

1. Ensure Kroki runs: `docker run -d --name kroki -p 127.0.0.1:8000:8000 yuzutech/kroki:latest`.
2. Copy `assets/uc-template.puml` to `docs/uml/<id>.puml` and replace only the actor names and
   the use cases. Do not retype the skinparam block: it is what keeps every diagram identical.
3. Add every case name to `UC_LABELS` in `docs/uml/stamp_archify.py`, one list per language.
   Actors need an entry too, and it must match the rendered line count exactly.
4. Add the cards to `CARDS_ES` / `CARDS_EN` and the notes to the subtitle. The subtitle
   carries the use case name, not the path of the module.
5. Regenerate — never hand-edit:

```bash
python3 docs/uml/merge_runtime_es.py docs/uml/<id>.html
python3 docs/uml/stamp_archify.py docs/uml/<id>.puml docs/uml/<id>.html \
  --locale es --lang es --switcher \
  --title "CEMURM — <id> <nombre>" \
  --subtitle "Escenario: <nombre del caso> · features/<file>:<linea>" \
  --keep-svg docs/uml/<id>.svg
```

6. Verify in Chromium before declaring done. See `references/verification.md` for the probes.

## Output Contract

Return the paths of the `.puml`, `.svg` and `.html`; the node and edge count; the number of
untranslated keys; and the browser-verification result. If Chrome is unavailable, say so —
deterministic validation alone is not visual proof.

## References

- `references/pipeline.md` — what each script does and the order between them.
- `references/pitfalls.md` — the Kroki, PlantUML and viewer bugs that cost the most time.
- `references/verification.md` — browser probes that catch what greps cannot, plus the
  cross-diagram consistency check.
- `assets/uc-template.puml` — the skeleton every diagram starts from.