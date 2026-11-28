# CEMURM — Hoja de ruta de la ampliación institucional

> **Estado:** aceptada el 2026-11-14 (ADR-012). Sustituye el plan anterior de integración con Moodle, que queda retirado por completo.
> **Change:** `openspec/changes/education-institutional-modules`
> **Decisiones:** `odd/tasks/education-institutional-decisions.md` (B1–B8, T1–T8, D1–D5)
> **Modelo de datos:** `docs/database-schema-ampliacion.md` (F1, núcleo académico F3, F4, inventario F7, índice de fases §9)
> **Diagramas:** de los dos previstos, **solo existe `amp-02`**. `docs/uml/amp-02-arquitectura-contextos.html` está generado a partir de `docs/uml/amp-02-arquitectura-contextos.archify.json` y muestra el orden C1→C5 con el que se escribió la auditoría; su contenido sigue siendo válido (membresía → académico → eventos → inventario → analítica), pero la numeración vigente es **F0–F8**. `amp-01-estado-requerimientos.html` **sigue sin generarse**. El otro artefacto real de `docs/uml/` para este change es `uc-04-alcance-institucional.puml` / `.svg`.

Esta es la pieza que convierte la ampliación en algo ejecutable. La propuesta dice **qué**; esto dice **en qué orden, con qué unidad de trabajo y qué decisión desbloquea cada fase**.

---

## 1. La regla que ordena todo

**F1 va primero, y no es una preferencia de arquitectura.**

> **Estado actual:** la administración de membresías ya está implementada. La migración
> `0021_identity_account_lifecycle.sql` añadió los tres RPC administrativos, sus cores privados y
> `admin_audit_log`; `scripts/smoke/0021-identity-account-lifecycle.sql` registró 21 PASS / 0 FAIL.
> `/organization/members` consume esos RPC. El prerrequisito de membresía para F2/F3 está
> satisfecho. Lo pendiente de F1 es el ciclo de vida de la cuenta: creación, estado,
> suspensión/reactivación, restricciones de rol y el endurecimiento RLS restante.

Antes de `0021`, `private.org_leave` era el único escritor de `org_memberships` y solo permitía que
un miembro se retirara a sí mismo. Ese bloqueo quedó resuelto para alta, cambio de rol, baja y
reactivación administrativa. La matrícula de F3 puede apoyarse en esas membresías; todavía no debe
asumir que la plataforma puede crear o suspender cuentas desde la administración.

| Fase | Depende de | Por qué |
|---|---|---|
| F1 Membresía y ciclo de cuenta | — | los tres RPC de membresía están listos; falta completar creación y estado de cuenta |
| F2 Activación de módulos | F1 | el `org_owner` que apaga un módulo es el rol que F1 vuelve administrable |
| F3 Núcleo académico | F1, F2 | matrícula a oferta + guard de módulo (T5) |
| F4 Sesiones y espacios | F3 | una sesión pertenece a una oferta; el salón es de la organización |
| F5 Materiales | F3 | un material se cuelga de curso, oferta o sesión |
| F6 Seguimiento | F3 | una observación pertenece a un alumno matriculado |
| F7 Inventario | F1, F2, F4 | el activo vive en una sede (`spaces` de F4 da la ubicación fina) |
| F8 Reportes | F3–F7 | agrega lo que las fases anteriores registran |

---

## 2. Hito 6 no se toca

**Hito 6 tiene seis features sin iniciar** y es la puerta de beta. `docs/master-plan.md` §4 lo secuencia por **obligación de privacidad primero**: `offboarding-cascade`, `account-data-export-and-erasure`.

Moverlo es otra propuesta. Las fases F1–F8 van **detrás**, no adentro.

| Hito | Estado | Features |
|---|---|---|
| 6 — Beta Polish | **sin iniciar** | `user-onboarding`, `account-data-export-and-erasure`, `offboarding-cascade`, `analytics-and-insights`, `export-and-sharing`, `cross-organization-event-collaboration` |

> Nota de dependencia real: el sexto, `cross-organization-event-collaboration` (16 escenarios), **es la primera rebanada de F4**. No lo duplicamos: cuando F4 construya la extensión académica de `events`, ese feature ya estará delivering parte.

---

## 3. Decisiones resueltas (D1–D5)

Las cuatro decisiones que bloqueaban el arranque **ya están tomadas** (2026-11-14). No se reabren en esta hoja; el registro completo está en `odd/tasks/education-institutional-decisions.md`.

| ID | Tema | Decisión | Fase |
|---|---|---|---|
| **D1** | Consentimiento de tutor | **A (simple)**: `educational_data_access` + `expires_at` en `guardian_consents`; revocable por el tutor, sin tabla extra | F3/F6 |
| **D2** | Formato de recurrencia | **C (tabla propia)**: `recurrence_patterns(freq, interval, weekdays[], end_date)` | F4 |
| **D3** | Visibilidad de observaciones | **C (por observación)**: `visibility` con enum `staff_only \| student_and_staff` | F6 |
| **D4** | Bucket de materiales | **C (bucket nuevo)**: `education_materials` org-scoped; `charts` queda intacto como user-scoped | F5 |
| **D5** | `module_key` permitidos | `education`, `sessions`, `materials`, `observations`, `inventory` — todos `enabled=true` por defecto | F2–F7 |

Además: **la antigua D4 de bandas quedó resuelta como A** — una banda usa `organizations` con `org_type='Band'`; no hay entidad separada. Y **B1–B8 / T1–T8** fijan el resto del alcance: matrícula a oferta (B1), gamificación conservada (B2), evaluaciones y notas ahora (B3), consentimiento educativo (B4), visibilidad configurable (B5), `events` extendido (B6), módulos on por defecto (B7), storage privado para materiales (B8); RPC de membresía (T3), RPC de matrícula (T4), enforcement de módulos en UI/RPC y no en RLS (T5), numeración a recontar (T6), ancla de ejercicio opcional (T7), offline por outbox (T8). **B8 fijó la necesidad —storage privado para materiales—; D4 resolvió el cómo con un bucket nuevo `education_materials`, en vez de reutilizar `charts`.** Las dos decisiones conviven: B8 es el requisito, D4 es la implementación elegida.

---

## 4. F1 — Membresía administrable (Hito 7)

**Es la bisagra.** Sin esto, la matrícula de F3 no arranca.

### F1-1 — BDD de membresía

**Antes de la migración. Sin excepción** — la entry rule de `AGENTS.md` es explícita.

| Archivo | Escenarios nuevos | Qué fija |
|---|---|---|
| `features/organization-members.feature` | ~12 | roster por sede, filtro por rol, alta, baja que conserva historial, cambio de rol, reactivación de un `former`, y las negativas de separación de funciones |

### F1-2 — Migración de identidad y ciclo de cuenta

La primera parte se entregó en `0021_identity_account_lifecycle.sql`:

- los **tres RPC de T3** — `add_org_member`, `change_member_role`, `remove_org_member` — con sus cores privados `*_core`;
- `admin_audit_log` append-only, con contexto de organización y `FORCE ROW LEVEL SECURITY`;
- políticas administrativas sobre `org_memberships`, manteniendo revocada la escritura directa del cliente.

El smoke `scripts/smoke/0021-identity-account-lifecycle.sql` registró **21 PASS / 0 FAIL**. Verifica
autorización, protección del owner, baja lógica, preservación de sede, reactivación, rechazo de
escritura directa y anonimización del audit log. La evidencia de ejecución está en
`odd/tasks/f1-0021-smoke.md`.

Queda pendiente en una migración posterior:

- `profiles.account_status` y el RPC `set_account_status`;
- el CHECK de `org_memberships.role`;
- `FORCE ROW LEVEL SECURITY` en `org_memberships` y `profiles`;
- los casos del smoke que dependan de esas reglas de ciclo de cuenta.

### F1-3 — `/organization/members` y `/settings/accounts`

`/organization/members` está implementada y permite alta, cambio de rol, baja y reactivación mediante
los RPC de `0021`. `/settings/accounts` también existe, pero hoy es una vista de solo lectura de la
cuenta del actor; no administra estados de otras cuentas.

> **Pendiente:** crear cuentas requiere `auth.admin.createUser` en una Edge Function de escritura.
> La misma unidad deberá añadir suspensión/reactivación administrativa y completar
> `/settings/accounts`; no debe presentarse la vista actual como administración de cuentas.

---

## 5. F0–F8 — el plan de fases

La tabla maestra. Cada fase lista su BDD, el contenido de su migración, sus RPC, su smoke y su dependencia, tal como lo fijan el acta y `openspec/changes/education-institutional-modules/proposal.md`. Los nombres de migración son los del proposal (`004x`); el **número real está contestado** y se reconta al implementar (T6, ver §9 del esquema).

| Fase | BDD | Migración (nombre del proposal) | Contenido | RPCs | Smoke | UI | Depende de |
|---|---|---|---|---|---|---|---|
| **F0** | — | — | ADR-012, esta hoja, el change de OpenSpec, corrección de encabezados | — | — | — | — |
| **F1** | `organization-members` | `0021_identity_account_lifecycle.sql` + migración pendiente de ciclo de cuenta | **Listo:** RPCs de membresía, audit log y políticas administrativas. **Pendiente:** `profiles.account_status`, CHECK de `role` y FORCE RLS restante | **Listos:** `add_org_member`, `change_member_role`, `remove_org_member`. **Pendiente:** `set_account_status` | 21 PASS / 0 FAIL; ampliación pendiente | `/organization/members` lista; `/settings/accounts` parcial | — |
| **F2** | `module-activation` | `004y_organization_modules.sql` | `organization_modules` con los cinco `module_key` de D5, `enabled=true` por defecto | guard de módulo en los RPC de F3–F7 (T5) | sí | nav y rutas condicionadas | F1 |
| **F3** | `education-structure` + reescritura de `education-enrollment` | `004z_education_core.sql` | `academic_periods`, `education_courses`, `education_subjects` (cond.), `education_course_offerings`, `education_enrollments`, `education_exercises`, `education_progress`, `education_events`, `education_evaluations`, `education_grades` + RLS + grants | `enroll_student`, `withdraw_student`; derivaciones `education_xp_total`, `education_streak`; wrappers de §4 | sí | `/education/*` | F1, F2 |
| **F4** | `education-sessions` | `004a_spaces_sessions_events.sql` | `spaces`, `education_sessions`, `recurrence_patterns` (D2), extensión de `events` (`academic_type`, `space_id`, `recurrence_rule`, `session_number`) | RPC de conflictos de horario | sí | `/activities/*`, sesiones | F3 |
| **F5** | `education-materials` | `004b_education_materials.sql` + RLS del bucket | `education_materials`; bucket `education_materials` org-scoped (D4) | — | sí | materiales por curso/oferta/sesión | F3 |
| **F6** | `education-followup` | `004c_observations_consent.sql` | `education_observations` (visibilidad por observación, D3), `org_module_settings` (cond.), extensión de `guardian_consents` (D1) | — | sí | observaciones | F3 |
| **F7** | `inventory-assets`, `inventory-loans` | `004d_inventory.sql` | `inventory_asset_types`, `inventory_assets`, `inventory_loans`, `inventory_movements` (cond.) | — | sí | `/inventory/*` | F1, F2, F4 |
| **F8** | `analytics-and-insights` (reescritura) | — (vistas/RPC, cero tablas) | agregación institucional por módulo | RPC/vistas de agregación | sí | `/analytics` | F3–F7 |

### F0 — Registro

Solo documentación: ADR-012 supersede ADR-011, esta hoja, el change `education-institutional-modules` y la corrección de los encabezados que citaban el plan Moodle. No hay migración ni pantalla.

### F1 — Membresía y ciclo de cuenta

Detalle en §4. La administración de membresías ya desbloqueó el alta, cambio de rol, baja y
reactivación dentro de una organización; esa parte satisface el prerrequisito operativo de F2/F3.
F1 permanece parcial hasta que se complete el ciclo de cuenta: creación, estado,
suspensión/reactivación, restricciones de rol y `FORCE RLS` restante.

### F2 — Activación de módulos

`organization_modules(org_id, module_key, enabled, disabled_at, disabled_by)` con los cinco valores de D5 y `enabled = true` por defecto (B7). El `org_owner` puede apagar un módulo por organización. **El enforcement vive en UI/rutas y en el guard de los RPC, no en RLS (T5)**: así no se duplica la autorización de organización con la de módulo. `org_module_settings` es **condicional** — solo se crea si la visibilidad de observaciones (B5) necesita persistencia separada de `organizations`.

### F3 — Núcleo académico

La fase más grande. Matrícula a **oferta** (B1), no a curso: `education_course_offerings` = curso + período + grupo + sede + instructor opcional. Eso es lo que permite “la misma asignatura en distintos períodos” y “una persona en varias cátedras”. `education_subjects` es **condicional**: solo si el catálogo de asignaturas se comparte entre cursos; si no se crea, `education_courses.subject_id` tampoco se escribe.

Gamificación conservada (B2): `education_progress` (cuatro estados) + `education_events` (ledger append-only con `client_uuid` de idempotencia, T8) y las derivaciones `education_xp_total` / `education_streak` con agrupación por resta de `row_number`. Evaluaciones y notas formales entran ahora (B3): `education_evaluations` + `education_grades`, con la auditoría en `admin_audit_log`. La matrícula de menores exige el permiso `educational_data_access` extendido en `guardian_consents` (B4/D1). Los RPC de matrícula son T4: `enroll_student` / `withdraw_student`; el BDD prohíbe la auto-matrícula.

### F4 — Sesiones y espacios

Una clase necesita salón e instructor (T1/T2), por eso `spaces` y `education_sessions` son tablas propias y no una reutilización de `rehearsals` (ensayo con setlist) ni de `venues` (owner-scoped). Las actividades institucionales **extienden `events`** en vez de duplicar el calendario (B6): `academic_type`, `space_id`, `recurrence_rule`, `session_number`. La recurrencia se modela con `recurrence_patterns` (D2), no con una cadena iCal. Resuelve también los conflictos de horario.

### F5 — Materiales

`education_materials` (documentos, enlaces, métodos) colgada de curso, oferta o sesión. **Bucket nuevo `education_materials`**, org-scoped (D4); `charts` queda intacto como user-scoped para lo musical, así que no hay migración de paths. El PDF/MusicXML hereda el límite app-side del bucket de charts, no un límite de base.

### F6 — Seguimiento y observaciones

`education_observations` con autor y **visibilidad por observación** (D3): `staff_only` o `student_and_staff`, elegida por el docente al crearla. La configuración por organización (B5) usa `organizations` o `org_module_settings` (condicional). Esta fase completa el flujo de tutor de D1 (`educational_data_access` + `expires_at`, revocable desde la UI).

### F7 — Inventario

`inventory_asset_types` (catálogo), `inventory_assets` (una unidad física por fila, con sede y condición), `inventory_loans` (préstamo/devolución/vencimiento, ligado a evento o sesión) e `inventory_movements` (**condicional**: solo si hay transferencias entre sedes). El índice único parcial impide dos préstamos abiertos del mismo activo. El DDL, RLS y grants están en `docs/database-schema-ampliacion.md` §6.

### F8 — Reportes institucionales

Reescritura de analítica de **personal a institucional**. Cero tablas: vistas y RPC de agregación sobre F3–F7. El BDD se reescribe, no se agrega al lado.

---

## 6. Lo que esta hoja no resuelve

| # | Pendiente | Por qué no está |
|---|---|---|
| **D7** | `UNIQUE(user_id, org_id, branch_id)` de `0001:36` está defeated por `branch_id` NULL | defecto **preexistente**. Arreglarlo es una migración sobre datos del seed de todos los org_memberships; no se mete de contrabando en una ampliación |
| **D8** | Cómo el docente ve el avance sin ver `notes` | **El mecanismo está resuelto**, no la decisión de producto: `authenticated` recibe un grant por columnas y la alumna lee su fila entera por `public.education_my_progress()`. Si el BDD exige una tercera proyección (“quién no empezó”), es otra función, no un privilegio |
| **D9** | El trigger de `inventory_assets.status` | existe el índice parcial que impide el préstamo doble, pero sin el trigger `status = 'loaned'` es una opinión del cliente. Se decide leyendo los smokes de `0023_substitutions`, que resuelven un problema parecido |
| **S1** | `FORCE ROW LEVEL SECURITY` en las tablas existentes | F1 lo aplica a las tablas que toca. Las demás son una migración aparte y un **endurecimiento independiente** de la ampliación — pudo hacerse antes |
| **S3** | `admin_audit_log` solo registra F1 al principio | las decisiones de permisos de F3–F7 también deberían auditarse. El esquema ya lo soporta; cada fase decide su punto de escritura |
| — | `er-diagram.html`, `architecture-current.html`, la nav | los cuatro artefactos de referencia del repo siguen describiendo el estado **anterior** a la ampliación |

---

## 7. Estado real del BDD

Hoy el árbol tiene **48 feature files y 776 escenarios**. De ellos, la ampliación institucional toca:

| Bloque | Hoy | Plan |
|---|---|---|
| `education-courses-and-exercises` | 13 | se implementa como está (F3) |
| `education-enrollment` | 21 | **se reescribe** contra matrícula a oferta (F3) — los 21 escenarios actuales chocan con B1 |
| `education-student-progress` | 20 | se implementa como está; gamificación conservada (B2) |
| `education-teaching-assignments` | 13 | se implementa como está; evaluaciones y notas añaden escenarios (F3) |
| `analytics-and-insights` | 23 | **se reescribe** de personal a institucional (F8); el proposal la nombra `analytics-institutional.feature` — el nombre final se fija al escribir el BDD, sin duplicar archivo |
| Nuevos | 0 | `organization-members` (~12), `module-activation` (~8), `education-structure` (~15), `education-sessions` (~20), `education-materials` (~12), `education-followup` (~15), `inventory-assets` (~15), `inventory-loans` (~15) |

**Total planificado:** ~160 escenarios en ~10 archivos nuevos o reescritos. La entry rule del repo sigue mandando: un ítem se implementa solo si su hito o su BDD lo requiere, y el BDD va antes de la migración. Los 67 escenarios de `education-*` **no se tiran**: son product truth y se extienden, que es justamente lo que ADR-012 eligió frente a la reescritura contra un dueño externo.

---

## 8. Orden de arranque

1. **F0** — este registro documental. No toca código ni base.
2. **F1-1** (BDD de membresía). No toca la base — se puede abrir en paralelo a la revisión de las decisiones ya tomadas.
3. **F1-2** (migración + smoke). Requiere `supabase db reset`, que es paso reservado del mantenedor.
4. **F1-3** (pantallas). Recién acá F2 tiene sobre qué construir.
5. **F2** (activación de módulos) antes de **F3**: sin gating, el núcleo académico no tiene puerta.
6. **F3** y después **F4**; F5, F6 y F7 pueden abrirse en paralelo cuando F3 esté verde. **F8** al final, porque agrega lo que las otras registran.

---

*Estado reconciliado contra `main` = `a489ab5`, 28-11-2026. F1 está parcialmente implementada en `0021_identity_account_lifecycle.sql`; F2–F8 continúan como especificación y deben recontar la numeración al implementarse (T6).*
