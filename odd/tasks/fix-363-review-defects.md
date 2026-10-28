# fix-363-review-defects — reseñar y corregir los 5 defectos del PR #363

- **Estado:** completado — 6/6 tareas; pendiente de decisión de merge
- **Rama:** `feat/11-modulos-institucionales` (PR #363)
- **Base:** `origin/main` = `d3f1269` (#366)
- **Modo TDD:** no aplicable — PR puramente documental, 0 ficheros bajo `src/`
- **Comandos de verificación:** `pnpm lint && pnpm build` (no afectados), revisión estructural de cada sitio editado

## Problema

El PR #363 (`feat: ampliación institutional — 11 módulos`) tiene CI **completamente verde**
en su head `15d87ac` — `lint-and-build`, `CodeQL`, `GitGuardian` y `E2E ×3` — pero el
mantenedor le pidió cambios con 5 defectos de **contenido**, no de build. Ninguno se ve en CI
porque son afirmaciones falsas o incoherentes dentro de los documentos.

El diagnóstico previo de esta sesión añadió un sexto problema heredado: la rama parte de
`a610dd0`, está **47 commits por delante de `origin/main`**, y su cambio a `docs/master-plan.md`
**regresa** hechos que `main` ya había corregido en #366.

## Por qué

Un documento de plan que afirma "el siguiente número de migración libre es `0037`" cuando ya se
consumieron `0037`–`0040` hace que un desarrollador cree una **colisión de numeración**. Ese es
exactamente el fallo que `check-migrations-unique.sh` existe para detectar, y llega como sorpresa
en CI en lugar de como corrección temprana.

## Alcance autorizado

Solo documentación dentro de la rama del PR #363. **No** se reescribe el código de #364 (devuelto
a su autor), **no** se añaden migraciones, **no** se toca `supabase/`, `src/` ni `package.json`.

## Hechos verificados contra la API de GitHub (no contra el remoto local)

| Hecho | Valor | Cómo se verificó |
|---|---|---|
| Migraciones en `main` | **38 ficheros**, `0001`–`0040`, hueco deliberado `0021`/`0022` | `gh api .../contents/supabase/migrations?ref=main` |
| Siguiente número libre | **`0041`** | descontando el hueco de 2 sobre 40 números |
| `main` tip | `d3f1269` (#366) | `gh api .../commits/main` |
| Ficheros `amp-*` en `docs/uml/` | **ninguno** — ni `.html` ni `.archify.json` | `git ls-tree` sobre rama y `main` |
| Conjunto de decisiones canónico | **D1, D2, D4** | `odd/tasks/decisions-pending-team-discussion.md` es la única fuente que los **define** |

> El remoto local `origin/main` quedó desfasado durante esta sesión y llegó a parecer que `main`
> había retrocedido. Todas las cifras de arriba se obtuvieron de GitHub directamente.

## Tareas

- [x] **T1** Sincronizar la rama con `origin/main`, resolviendo el conflicto de `docs/master-plan.md`
      **manteniendo la verdad de `main`** y descartando el retroceso de la rama. → commit `04b81db`.
- [x] **T2** Renumerar el plan de migración `0037_identity_account_lifecycle.sql` → **`0041`**
      en todos los documentos de plan vivos, y corregir los conteos obsoletos
      ("34 migraciones", "`0001`–`0036`", "siguiente libre `0037`") por el estado real de `main`.
      La planificación completa pasó de `0037`–`0041` a **`0041`–`0045`**.
- [x] **T3** Corregir las referencias rotas a `docs/uml/amp-01-estado-requerimientos.html` y
      `amp-02-arquitectura-contextos.html`, que **nunca existieron**, y desmentir la afirmación de
      `odd/tasks/judgment-day-ampliacion-r1.md:529` de que se corrigieron y se verificaron como
      JSON válidos.
- [x] **T4** Unificar el conjunto de decisiones en **D1, D2, D4**. El `D5` de
      `proposal.md:281` era erróneo **como condición de bloqueo**: `D5` sí existe
      (`proposal.md:260`, *"Dónde entra esto en el calendario"*) pero la sección 226 solo
      marcaba D1/D2 como `(bloqueante)`. Marcado D4 como `(bloqueante)` y corregida la línea 281.
- [x] **T5** Resolver la tensión entre el marcador `JUDGMENT: APPROVED ✅` y la afirmación de que
      nada del change está autorizado para implementación.
      **Corregido en la redacción: el marcador NO está en `proposal.md`** como dije al planificar,
      sino en `odd/tasks/session-termination-note.md:3` — el único de los tres sitios que no
      declaraba el bloqueo. `judgment-day-terminal-verdict.md:67` ya lo declaraba
      (*"C2/C3/C4 blockades D1-D4 … unchanged and documented"*).
- [x] **T6** Actualizar el cuerpo del PR #363 con `gh pr edit`. El cuerpo anterior decía
      *«9 archivos, 2789 inserciones»* cuando el diff real era **+4358/−124**, y no mencionaba
      ninguna de las correcciones.

## Hallazgos adicionales corregidos fuera del listado

- **`odd/tasks/judgment-day-ampliacion-r1.md` seguía afirmando la existencia de artefactos que
  nunca hubo**, en abreviatura y por tanto invisibles al grep de T3: las líneas "Lo que NO se
  hizo" y "Acciones pendientes para round 2" listaban `amp-01`/`amp-02` entre los `.html`/`.svg`
  que "muestran el texto viejo"; y la tabla *"Archivos tocados (9)"* incluía
  `uc-04-alcance-institucional.cards.json` — un **cuarto** fichero que tampoco existe.
  Recuento real: **6 de 9**.
- **"26 rutas" era 30**: contado con `path:` en `src/app/router.jsx` y corroborado de
  independientemente por el propio ledger (`judgment-day-ampliacion-r1.md:67`).
- **Conteos obsoletos más extensos de lo listado**: `roadmap:18`, `academia-v2:20` y la sección
  de smoke de `AGENTS.md` (decía 13 ficheros de smoke; `ls scripts/smoke/` da **16** tras la fusión).

## Criterios de aceptación

- Ningún documento de plan vivo afirma `0037` como siguiente número libre.
- Ningún enlace apunta a un fichero que no existe en el árbol.
- El conjunto de decisiones es **D1, D2, D4** en todos los documentos vivos, y coincide con
  `odd/tasks/decisions-pending-team-discussion.md`.
- `docs/master-plan.md` no regresa ningún hecho ya corregido en `origin/main`.
- `pnpm lint && pnpm build` siguen en verde (no deberían verse afectados: 0 ficheros bajo `src/`).

## Evidencia de verificación

**Commits en la rama:**

| Commit | Contenido |
|---|---|
| `04b81db` | Fusión de `origin/main`; conflicto de `docs/master-plan.md` resuelto a favor de `main` |
| `a1786eb` | Las 6 tareas de corrección; 9 ficheros, +156/−52 |

**Checks en el head `a1786eb` — 9/9 en verde, 0 fallos:**

```
Analyze (actions)                success
Analyze (javascript-typescript)  success
CodeQL                           success
E2E Chromium                     success
E2E Firefox                      success
E2E WebKit                       success
GitGuardian Security Checks      success
lint-and-build                   success
Setup — emit deterministic anon key  success
```

`lint`, `typecheck`, `test`, `test:gherkin` y `build` corren dentro de `lint-and-build`. **No se
tocó ningún fichero bajo `src/`, `supabase/`, `features/` ni `package.json`**: 0 de 9 ficheros
cambiados están en esas rutas, así que este trabajo no puede haber afectado a esos gates.

**Verificaciones de contenido tras los cambios:**

- `grep "siguiente libre|next free"` → ningún documento de plan vivo declara un número distinto
  de `0041`.
- `grep "amp-01|amp-02|uc-04...html|cards.json"` → **ningún enlace superviviente**; todos los
  supervivientes declaran expresamente la no existencia.
- `proposal.md` → 3 marcadores `(bloqueante)` (D1, D2, D4) y el párrafo final condiciona a
  «D1, D2 y D4».
- Sin marcas de conflicto en el árbol.

**Decisión de merge:** pendiente del mantenedor. El diff acumulado de `+4358/−124` supera con
creces el presupuesto habitual de 400 líneas por PR, y la revisión del mantenedor sigue en
`CHANGES_REQUESTED` — el trabajo de esta rama aborda esos comentarios pero no los cierra por sí
solo.

## Nota de honestidad

Los registros históricos de `odd/tasks/judgment-day-*.md` documentan lo que una ejecución pasada
**afirmó en su momento**. T3 desmiente una afirmación concreta y verificablemente falsa (que se
corrigieron ficheros que no existen); el resto de esos registros se deja tal cual, porque
reescribirlos convertiría un registro de auditoría en una reconstrucción.
