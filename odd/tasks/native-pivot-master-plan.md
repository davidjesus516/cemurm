# ODD — Documentar el pivote nativo en `docs/master-plan.md`

- **Feature**: `native-pivot-master-plan`
- **Autorizado**: 2026-10-19, decisión explícita del mantainer
- **Alcance**: documentar la decisión de producto en `docs/master-plan.md`. Nada más.
- **TDD**: n/a — cambio de solo documentación (Markdown). Verificación = readback estructural + gates del repo.

## Problema / por qué

PR #335 (`spike/suite-modular`) y el milestone #7 dan por conocida una «Fase 1» que **no está escrita
en ningún sitio**. Sin ella el spike es ilegible: dos de sus tres patas (audio nativo `oboe`, sync P2P)
no las pide ningún hito ni ninguna feature BDD, y el entry rule de AGENTS.md (*«implemented only when
its hito or BDD feature requires it»*) las rechaza correctamente.

El mantencer resolvió el 2026-10-19 qué es Fase 1: **un pivote a app nativa especializada en monitoreo
y sincronización en vivo**, con el PWA actual **conviviendo** como segunda superficie y **un solo backend**.

Esa es la ausencia que el entry rule pedía. Falta escribirla.

## Alcance autorizado

- Escribir la decisión en `docs/master-plan.md`.
- Etiquetar la sección nueva en el bloque *Status of this document*.
- Declarar su relación con §6 *Order, and why*.

**Fuera de alcance**: tocar #335, las issues del milestone #7, las 46 features, `technical-spec.md`,
código, o cualquier gate.

## Decisiones aceptadas

- **DP-1** — Pivote a app nativa: monitoreo y sincronización en vivo.
- **DP-2** — El PWA **no se retira**: conviven las dos superficies contra un solo backend (Supabase).
- **DP-3** — La escalera `Phase 0–4` de `technical-spec.md` §10.7 **sigue vigente para el PWA**;
  el pivote es una pista paralela, no el siguiente peldaño.

> Los conflictos se etiquetan **SC-1/SC-2/SC-3** en `docs/master-plan.md`; aquí se referencian con
> el mismo prefijo. Las decisiones **abiertas** del pivote (OD-1–OD-3 en `master-plan.md`) no se
> resuelven en esta tarea.

## Hallazgos — conflictos de spec detectados (declarados, no resueltos aquí)

- **SC-1 (serio)** — `features/pwa-updates-and-storage.feature:189` es un NON-GOAL que afirma
  literalmente "no native app-store or manual download update channel exists — updates flow only
  through the service worker". Es la fuente de verdad del producto y **niega la app nativa**.
  Esa feature hay que reabrir antes de implementar nada.
- **SC-2** — Colisión de nombre: el spike llama "Fase 1" a este pivote; `technical-spec.md` §10.7
  llama "Phase 1 (Scale)" al escalado web >5k MAU. Mismo nombre, cosas distintas.
- **SC-3 (menor)** — El requisito de audio más cercano ya existente es `features/practice-mode.feature`
  (metrónomo), que una PWA sirve con Web Audio. No exige audio nativo.

## Checklist

- [x] T1 Crear este registro ODD + mirror engram
- [x] T2 Rama `docs/native-pivot-master-plan` desde `main`
- [x] T3 Sección nueva en `docs/master-plan.md` — `## Strategic pivot (2026-10-19)`, línea 38
- [x] T4 Etiqueta en el bloque *Status of this document* — primera de la lista
- [x] T5 Referencia en §6 *Order, and why* — párrafo «The native track is deliberately absent from N0–N5»
- [x] T6 Verificación: readback estructural + 9/9 gates de CI
- [x] T7 Commit work-unit — obra en `7864d13`; este registro en el commit siguiente

## Criterios de aceptación

- La decisión de producto queda escrita en `master-plan.md`, con fecha y procedencia (elección del mantainer).
- Los tres conflictos de spec (SC-1, SC-2, SC-3) quedan **declarados**, no silenciados.
- §0–§6 no se renumeros ni se reescriben.
- Nada fuera de `docs/master-plan.md` cambia.

## Progreso

- 2026-10-19 — registro creado antes del primer write.
- 2026-10-19 — T1–T7 completos. Obra en commit **`7864d13`** (`docs/master-plan.md`, +78); este
  registro viaja en el commit siguiente, porque un fichero no puede contener el SHA del commit que
  lo transporta.
- **RDD**: `review assess --base-ref acfcd9b --committed-only` → **`passive`**
  (`non_executable_only`, `changed_paths: 2`, `changed_lines: 187`, `review_due: false`).
  Boundary avanza a `7864d13`.
  - *Primer intento falló* con `unassessable` / `high`: los ficheros sin trackear heredados de
    sesiones anteriores (`pr-body*.md`, `deno.lock`, otros `odd/tasks/`) exigen declaración
    explícita. Se resolvió con `--untracked-scope=exclude` + el inventario canónico que la propia
    herramienta devolvió. **No se infirió bajo riesgo del fallo.**

## Evidencia de verificación

**Readback estructural** (`docs/master-plan.md`, 599 → 677 líneas, +78):

- Orden de encabezados preservado, **sin renumerar** §0–§6:
  `Status (10)` → `Strategic pivot (38)` → `§0 (103)` → `§1 (147)` → … → `§6 (609)`.
- Las tres referencias citadas resuelven: `technical-spec.md` §10.7 (`:440`),
  `features/pwa-updates-and-storage.feature`, `features/practice-mode.feature`.
- La cita literal de SC-1 coincide **exacto** con `pwa-updates-and-storage.feature:189`.
- Guillemets `«»` que yo había introducido detectados como inconsistencia (los únicos del
  documento) y sustituidos por comillas rectas, el estilo del resto del doc.
- Solo 2 ficheros en el diff: `docs/master-plan.md` + este registro. Los ficheros sin trackear
  heredados no se tocaron.

**Barra de CI — 9/9 en verde** sobre `7864d13`:

| Gate | Resultado |
|---|---|
| `pnpm lint` | exit 0 |
| `deno check 'supabase/functions/**/*.ts'` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `check-test-integrity.sh` | OK — 1 rule, 0 failing |
| `pnpm test` | **415 passed / 18 files** |
| `pnpm test:gherkin` | **44 passed / 5 files** |
| `pnpm build` | ✓ built in 4.29s |
| `check-migrations-unique.sh` | OK — 38 migrations, all unique |
| `check-visual-contract.sh` | OK — 12 rules, 0 failing |

**Queda fuera de esta tarea** (declarado, no silenciado): resolver SC-1/SC-2/SC-3, decidir
OD-1–OD-3, y tocar #335 o el milestone #7.
