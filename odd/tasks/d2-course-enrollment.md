# D2 — Quién matricula: BDD de la matrícula en cursos

> **Objetivo:** diseñar el flujo de matrícula a un curso como comportamiento, no como precondición.
> **Rama:** `feat/d2-course-enrollment` · **Base:** `main` @ `8a9b1b2` · **PR:** apilado sobre `main`, no sobre la rama de la ampliación (§ Base, abajo).
> **Estrategia de entrega:** `single-pr`. Un solo PR, un solo artefacto de comportamiento más la sincronización de conteos que el repo exige.
> **Test runner:** la suite BDD no tiene runner. `features/*.feature` no los parsea ningún test (`src/test/gherkin/*.test.js` son tests escritos a mano, no un parser de Gherkin). Verificación = estructural: conteo de escenarios y el `awk` de reconciliación de `docs/bdd-coverage-map.md:258`.
> **Alcance:** BDD **y nada más**. Cero migraciones, cero `src/`, cero wireframes.

---

## Specs

Las declaraciones de producto van entre comillas porque este es el artefacto que las fija. La
decisión de D2 no la tomé yo: la tomó Antony en la sesión del 2026-10-13 y su respuesta literal fue
*"La organización da de alta"*.

### S1 — Quién tiene autoridad para matricular

> *"La organización da de alta (Recomendada)"*

La organización es la que inscribe. `org_owner` y `org_admin` matriculan en toda su organización;
`branch_admin` sólo dentro de su propia sede. **El alumno no se matricula a sí mismo** y el
instructor tampoco inscribe a nadie.

### S2 — El alumno no tiene ningún control de matrícula

> *"no CTA — enrolment is a precondition set by an admin"*

`docs/wireframes.md:638` (rama de la ampliación) ya lo declara por escrito: el estado vacío de
`/education` es `You are not enrolled in any course` **sin acción**, y dibujar un `Join course`
"inventaría un flujo que el BDD explícitamente declina especificar". Esta spec convierte esa
prohibición de pantalla en contrato verificado.

### S3 — La matrícula es por curso y el rol es por curso

La tabla `education_enrollments` lleva `role in ('student','instructor')` **por curso**, no un rol
de organización. La misma persona puede ser alumna en un curso e instructora en otro.

### S4 — La baja existe, la re-matrícula no crea una segunda fila

`status in ('active','completed','withdrawn')` y `UNIQUE(course_id, user_id)`. Reinscribir a alguien
que se dio de baja no puede ser un `INSERT`: choca contra el `UNIQUE`. Tiene que ser una revive de
la fila existente.

### S5 — El solo hecho de matricular no revela actividad privada

Matricular a alguien **no** abre su práctica, su racha, su XP, su objetivo diario ni sus notas
privadas. La negativa ya está afirmada en `features/education-teaching-assignments.feature` para el
docente; esta spec la extiende al actor que escribe la matrícula.

### S6 — Sólo se puede matricular a quien ya pertenece a la organización

`education_courses_select_member` resuelve el alcance con `private.is_org_member`, y
`education_enrollments_select_staff` hace `join` contra `org_memberships`. Una fila de matrícula de
alguien que no es miembro produce un registro que **nadie puede leer**: ni el curso es visible para
él, ni el roster lo lista al staff. El modelo es "la organización inscribe desde su roster".

### S7 — Fuera de alcance, declarado

Esto **no** se escribe aquí y queda nombrado para que no se pierda:

| # | Qué | Por qué no en este PR |
|---|---|---|
| X1 | Escenarios de menores en la matrícula | `private.profile_is_minor` excluye a los menores de `profiles_select_search` (`0017:161-163`), así que el selector de alumnos **devuelve cero filas para todo menor**. Escribirlo sería codificar un hueco. Depende de **D1**, que necesita asesoría legal. |
| X2 | El estado `completed` de una matrícula | `status` lo admite, pero **nadie lo escribe** en el modelo actual y ningún escenario del repo lo exige. Definir quién marca un curso como completado es producto, no BDD. |
| X3 | La fecha de baja | `education_enrollments` tiene `enrolled_at` y **no** tiene `withdrawn_at`. Por eso S4 afirma el estado y la ausencia en la lista, y **no** una fecha de baja: esa columna no existe todavía. |
| X4 | La política `INSERT` del DDL | `docs/database-schema-ampliacion.md:871-891` tiene **sólo** políticas `SELECT` para `education_enrollments`. La `INSERT` que esta spec exige se escribe en la migración de C2, que está en la rama de la ampliación y bloqueada por D1. |

---

## Tasks

| ID | linked `S#` | Route | Status | Commit / evidencia |
|---|---|---|---|---|
| T1 | — | inline | ✅ | Evidencia verificada: tabla, políticas, helpers `session_role_in` / `is_org_member` / `user_branch_ids`, `profile_is_minor`, precedente de `former` |
| T2 | S1, S2, S3, S4, S5, S6 | inline | ✅ | `features/education-enrollment.feature` — 21 escenarios |
| T3 | — | inline | ✅ | Conteos sincronizados en `AGENTS.md`, `docs/features-overview.md`, `docs/master-plan.md`, `docs/mvp-scope.md`, `docs/bdd-coverage-map.md` |
| T4 | — | inline | ✅ | Verificación estructural + suite intacta |

### Base: por qué el PR va a `main` y no sobre la ampliación

La evidencia que motiva D2 (`docs/roadmap-ampliacion.md`, `docs/database-schema-ampliacion.md`,
`odd/tasks/decisions-pending-team-discussion.md`) **no está en `main`**: vive en el PR #363
(`feat/11-modulos-institucionales`), y `docs/roadmap-ampliacion.md:3` dice de esa ampliación
*"**Estado:** propuesta. No autorizada."*

Apilar encima ataría el BDD a una propuesta no aprobada. Y no hace falta: `docs/roadmap-ampliacion.md:190`
dice del PR de BDD que *"No toca la base — se puede abrir en paralelo a la decisión"*, y
`docs/propuestas/cemurm-ampliacion-alcance-11-modulos.md:312` fija el orden — *"BDD es la verdad de
producto. El orden no es negociable"* — con los `.feature` **antes** que las migraciones.

**Consecuencia honesta:** este PR referencia documentos que no están en `main`. Se declara acá y en
el cuerpo del PR en vez de esconderlo.

---

## Log

### L1 — Petición de Antony (verbatim, 2026-10-13)

> sobre quien matricula, hay que hacer las features, usa odd para que vayamos armando la planificacion, eso lo subimos en otro pr

### L2 — Decisión D2 (verbatim, misma sesión)

> **La organización da de alta (Recomendada)**

Las otras dos opciones que se le ofrecieron fueron descartadas explícitamente:

- *El alumno se matricula a sí mismo* → exigiría una política `INSERT` del propio alumno, un estado
  `pending` que `education_enrollments.status` no admite, y **corregiría** `wireframes.md:638`, que
  hoy prohíbe ese botón por escrito.
- *Padre/tutor con autorización* → choca de frente con **D1**: `guardian_consents` (`0017:81`) tiene
  un único permiso, `public_sharing_approved`. No existe registro que cubra que un adulto consulte
  datos educativos de un menor.

### L3 — Hallazgo que cambió el diseño: el actor que escribe no está en el BDD existente

La matrícula aparece en `features/` **sólo como precondición**, 11 veces, todas en forma `Given`:
`education-student-progress.feature:11` y `education-teaching-assignments.feature:11,17,18,29,35,43,46,74,84`.
Ningún escenario la ejecuta. `odd/tasks/decisions-pending-team-discussion.md:12-19` lo decía textual:
*"la matriculación se tratan como precondición, no como flujo diseñado"*.

Falso positivo descartado: `authentication-and-profiles.feature:57,60,208,230` dice "enrolled", pero
es **biometría**, no matrícula.

### L4 — La mitad "qué ve un admin" de D2 ya estaba resuelta

`features/education-teaching-assignments.feature:97-108` ya afirma la negativa del docente: ve qué
ejercicios terminó cada alumno y cuándo; **no** ve sesiones de práctica, duraciones, racha, XP,
objetivo diario ni notas privadas. Esos 46 escenarios no se reescribieron. Lo que faltaba era
justamente el otro actor: el que escribe la fila.

### L5 — Precedentes que el feature respeta, no inventa

| Precedente | Dónde | Qué obliga |
|---|---|---|
| Miembro que se va conserva historial | `organizational-repertoire-model.feature:152-155` | La baja no borra lo hecho (S4) |
| Alta por código de invitación | `user-onboarding.feature:62-67` | Es a nivel de **organización** (`org_memberships`), no de curso. `education_enrollments` es otra tabla y **no** tiene ese camino |
| Un `former` no es un `active` | `session_role_in` exige `status = 'active'` (`0002:26-30`) | Un ex-miembro no cuenta como staff ni como alumno (S6) |
| El docente no ve datos privados | `education-teaching-assignments.feature:97-108` | La matrícula no amplía la visión (S5) |
| Un alumno en la org no escribe el curso | `education_courses_write_staff` acepta instructor/branch_admin/org_admin/org_owner y **excluye** a `org_member` | El rol de organización y el de curso son ejes distintos (S3) |

### L6 — Hallazgo colateral, **fuera de alcance**, reportado y no arreglado

`main` ya tiene `supabase/migrations/0037_offline_tie_break.sql` (PR #365/#366). Pero
`docs/propuestas/cemurm-ampliacion-alcance-11-modulos.md:260-265` sigue diciendo *"El siguiente
número libre es `0037`"* y le asigna ese número a `identity_account_lifecycle.sql`. **Ese número ya
está tomado.** El siguiente libre es `0038`.

No se corrige acá: esos archivos son del PR #363 y corregirlos desde este PR ensuciaría un diff que
es de otra cosa. Se reporta para que se arregle donde corresponde.

También: el diff de #363 contra `main` muestra `0037_offline_tie_break.sql` y su smoke como
**borrados** (`-235`, `-560`). Es una rama desactualizada, no una decisión de borrar migraciones.

### L7 — Verificación

| Chequeo | Resultado |
|---|---|
| `ls features/*.feature \| wc -l` | 45 → **46** |
| Conteo de escenarios del feature nuevo | **21** |
| Reconciliación de `docs/bdd-coverage-map.md` (`awk` sobre las filas) | coincide con el total declarado |
| `pnpm test` / `pnpm test:gherkin` / `pnpm lint` | sin cambios en `src/`; suite intacta |

**Policy test-first:** no aplica. El BDD es documentación pasiva y `features/*.feature` no lo ejecuta
ningún runner — no existe un RED que observar. La verificación proporcional es la estructural de
arriba, más la suite del repo para confirmar que nada se movió.

**Risk line:** `Risk: none`. El diff no toca código ejecutable, migraciones, `src/` ni contratos que
otros consuman. Es `.feature` más prosa, y la prosa que cambia son conteos que el propio repo obliga a
mantener sincronizados (`docs/features-overview.md:5`: *"a stale count here propagates to
AGENTS.md, docs/master-plan.md and docs/mvp-scope.md"*).