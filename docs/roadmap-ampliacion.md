# CEMURM — Hoja de ruta de la ampliación institucional

> **Estado:** propuesta. No autorizada. Ningún PR abierto, ninguna migración escrita.
> **Change:** `openspec/changes/ampliar-alcance-institucional`
> **Modelo de datos:** `docs/database-schema-ampliacion.md` · **Pantallas:** `docs/wireframes.md` §6
> **Diagramas:** los dos diagramas previstos — `docs/uml/amp-01-estado-requerimientos.html` y `docs/uml/amp-02-arquitectura-contextos.html` — **nunca se generaron y no existen en el árbol**. El único artefacto real de `docs/uml/` para este change es `uc-04-alcance-institucional.puml` / `.svg`.

Esta es la pieza que convierte la ampliación en algo ejecutable. La propuesta dice **qué**; esto dice **en qué orden, con qué unidad de trabajo y qué decisión desbloquea cada tranche**.

---

## 1. La regla que ordena todo

**C1 va primero, y no es una preferencia de arquitectura.**

`org_memberships` tiene `grant select` únicamente (`0016:552`) y sus tres políticas son las tres `SELECT`. De las **164 políticas vivas** del repositorio —el historial tiene 174 sentencias `create policy`, diez de ellas re-creaciones con el mismo nombre— ninguna escribe en esa tabla.

**Con una excepción, y hay que nombrarla:** `private.org_leave` (`0016:437-453`) → `public.leave_organization` (`0016:455-459`), con `grant execute … to authenticated` (`0016:534,544`), hace `update org_memberships set status='former'` **sobre las filas del propio actor**. Es el único `INSERT`/`UPDATE` sobre esa tabla en las 38 migraciones, está cableado a `src/data/repositories/orgRepertoire.js:180` y tiene un botón vivo en `Organizations.jsx:318-340`. Es decir: **un miembro sí puede irse a sí mismo; no puede unirse, cambiar su rol ni sacar a nadie más.**

Eso significa que una pantalla de administración sin C1 **no es una tarea más chica — es una tarea bloqueada**: hoy no existe forma de dar de alta una cuenta ni de cambiar el rol de nadie desde la aplicación.

| Contexto | Depende de | Por qué |
|---|---|---|
| C2 Integración académica | **C1** | el panel administrativo necesita cuentas y roles administrables; la matrícula ya no escribe en la organización (vive en Moodle) |
| C3 Eventos | **C1** | `event_participants` liga organización ↔ evento |
| C4 Inventario | **C1** | `assets.org_id` es la frontera de propiedad |
| C5 Analítica | C2, C3 | deriva de lo que ellos registren |

---

## 2. Hito 6 no se toca

**Hito 6 tiene seis features sin iniciar** y es la puerta de beta. `docs/master-plan.md` §4 lo secuencia por **obligación de privacidad primero**: `offboarding-cascade`, `account-data-export-and-erasure`.

Moverlo es otra propuesta. Los once requerimientos van **detrás**, no adentro.

| Hito | Estado | Features |
|---|---|---|
| 6 — Beta Polish | **sin iniciar** | `user-onboarding`, `account-data-export-and-erasure`, `offboarding-cascade`, `analytics-and-insights`, `export-and-sharing`, `cross-organization-event-collaboration` |

> Nota de dependencia real: el sexto, `cross-organization-event-collaboration` (16 escenarios), **es la primera rebanada de C3**. No lo duplicamos: cuando C3 se construya, ese feature ya estará delivering parte.

---

## 3. Las cuatro decisiones que hay que tomar antes de abrir el primer PR

Ninguna es de ingeniería. Ninguna la puedo cerrar yo.

| # | Decisión | Bloquea | Quién decide |
|---|---|---|---|
| **D1** | Consentimiento de menores para datos educativos | 8-1 en adelante | producto + asesoría legal |
| **D2** | Qué operaciones del panel se escriben desde CEMURM y qué ve un admin | 8-3, 8-4 | producto |
| **D3** | Qué es un `event` | el BDD de C3 | producto |
| **D4** | Bandas: organización o entidad | una línea de DDL de C1 | producto |

**D4 es la única que se puede resolver en una reunión de treinta minutos y tiene el mejor ratio valor/esfuerzo de las cuatro.**

---

## 4. Hito 7 — Identidad y organización (C1)

**Es la bisagra.** Sin esto, los otros tres no arrancan.

### PR 7-1 — BDD de identidad y roles

**Antes de la migración. Sin excepción** — la entry rule de `AGENTS.md` es explícita.

| Archivo | Escenarios nuevos | Qué fija |
|---|---|---|
| `features/account-administration.feature` | ~10 | alta, baja (conserva historial), cambio de rol, desactivación, y las tres negativas de SOD |
| `features/organization-members.feature` | ~12 | roster por sede, filtro por rol, reactivate de un `former` |
| `features/account-data-export-and-erasure.feature` | +3 | un `former` conserva su historial; el log de auditoría sobrevive al borrado |

**Estimación:** ~25 escenarios. Es el PR más grande de la serie y el único que no divide: las políticas de `org_memberships` son un contrato indivisible.

### PR 7-2 — `0041_identity_account_lifecycle.sql`

El DDL está en `docs/database-schema-ampliacion.md` §1–§2. Incluye los cuatro RPC, `admin_audit_log`, los CHECK de `role` y `org_type`, y **`FORCE ROW LEVEL SECURITY`** en las tablas tocadas.

**Más el smoke `scripts/smoke/0041-*.sql`**, con:
- los cuatro guards de cada RPC, invocados **como el actor que debe fallar**
- SOD: auto-agregarse, auto-cambiarse el rol, auto-desactivarse → excepción
- `WITH CHECK`: un `system_admin` que intente escribir un `account_status` inválido → rechazo
- `FORCE RLS`: conexión **como owner** confirmando que ahora respeta la política

**Requiere `supabase db reset` antes. No es idempotente.**

### PR 7-3 — `/organization/members` y `/settings/accounts`

Layout en `wireframes.md` §6.1 y §6.2. Dos repositorios nuevos o uno con dos superficies.

> **Lo que este PR no hace, y por qué:** no crea cuentas. Eso necesita `auth.admin.createUser`, que es la **primera Edge Function de escritura** del repositorio (hoy hay una sola: `send-guardian-consent`) y CI corre `deno check` sobre ellas. Va en su propio PR.

### PR 7-4 — `0042_bands_as_organizations.sql` + bandas

**Solo si D4 = A.** Si D4 = B, son tres tablas nuevas y un contexto entero: se re-planifica.

---

## 5. Hito 8 — Integración académica (Moodle)

> **Reemplazado el 2026-10-20.** Esta sección decía "Formación (C2): construir las 5 tablas de
> educación". Esa versión **no se ejecuta**: con Moodle como dueño de cursos, matrícula y
> calificaciones, esas tablas no se construyen. Lo que se construye es el puente. El bloque
> anterior se retira, no se conserva al lado — dejarlo invitaría a planificar trabajo muerto.

**Decisión (2026-10-20):** el área académica se delega a Moodle y se integra. Es un contexto
*medianamente aparte* del área musical: Moodle no conoce canciones, y el núcleo offline de CEMURM
no se toca. La alternativa evaluada —construir el módulo en Supabase— quedó descartada por precio
de mantenimiento, no por incapacidad técnica.

### Qué queda de cada lado

| Zona | Dueño |
|---|---|
| Cursos, lecciones, actividades, cuestionarios, calificaciones, informes, roles docentes | **Moodle** |
| Ejercicio musical atado a canción/sección, práctica, modo escenario, offline | **CEMURM** |
| Identidad de la persona | **CEMURM** (Moodle recibe una sombra) |
| El puente entre ambos | esta integración |

### Costo declarado

**Los 67 escenarios de educación dejan de ser la verdad del producto para esa área** hasta que se
reescriban contra el nuevo dueño. No se tiran: los que describen el ejercicio musical atado a una
canción siguen vigentes y siguen siendo de CEMURM. Pero los 21 de `education-enrollment` chocan de
frente con que Moodle sea dueño de la matrícula, y los 20 de `education-student-progress` describen
cuatro estados que Moodle no tiene.

### Orden dentro del hito

| Unidad | Contenido | Nota |
|---|---|---|
| **8-0** | Verificación en Docker: `enrol_lti` publica cursos como herramienta LTI 1.3, funciones de Web Services habilitables, login OIDC operativo | **primero, y sin compromiso de arquitectura.** Salida: go/no-go escrito sobre embeber contra pestaña |
| **8-1** | BDD reescrito de los cuatro `features/education-*` contra el nuevo dueño | entry rule: BDD antes de código. PR más grande y el único que no se divide |
| **8-2** | Identidad federada: Edge Function OIDC + `moodle_user_links` | criterio: un usuario de CEMURM abre Moodle ya logueado, sin segunda contraseña |
| **8-3** | Vínculo organizacional + panel de lectura: `academic_links` (organización/sede → categoría o curso) | lectura solamente. El admin ve lo de su organización y nada más |
| **8-4** | Matrícula: lectura de inscriptos | la escritura espera la lista cerrada de operaciones (decisión abierta) |
| **8-5** | Notas y avance: lectura por Web Services, proyección de solo lectura | el docente ve, no edita |
| **8-6** | Expectativa offline: documento para la academia + decisión sobre la app de Moodle | el offline académico vive en la app de Moodle, no en la API |

**8-0 primero es la regla que este hito no puede saltear.** La decisión de integrar está tomada;
que las funciones necesarias existan en la versión que se instale, no. `enrol_lti` publicando
cursos como herramienta LTI 1.3 es una afirmación a verificar, no un supuesto.

**8-4 hereda una decisión abierta:** si la lista cerrada de operaciones del panel no existe todavía,
8-4 se queda en lectura y no se escribe nada sobre Moodle.

### Lo que este hito NO construye

- `docs/database-schema-ampliacion.md` §4 — las 5 tablas de C2. Quedan como referencia de diseño,
  **no como plan**.
- `src/domain/education/` — la máquina de estados de progreso y las derivaciones de racha/XP.
- `0043_education.sql`.
- Las pantallas de `wireframes.md` §6.3–§6.5, en su forma actual.

**D1 (consentimiento de menores) se mueve de lugar, no desaparece.** Los datos de menores pasan a
vivir en un segundo procesador —Moodle— lo que agrega un acuerdo de tratamiento de datos y una
revisión legal, no la elimina. Sigue siendo el primer bloqueo de la parte académica.

### Dependencias

No bloquea al Hito 7, pero el panel administrativo cae naturalmente después de 7-3, que es donde se
construye la administración de cuentas.

---

## 6. Hito 9 — Eventos, inventario y analítica

### 9-a — C3 Eventos: **cero migración**

| Unidad | Contenido |
|---|---|
| **9-a-1** | Decisión D3 cerrada |
| **9-a-2** | `features/event-attendance.feature` — **el primer BDD de asistencia**. Hoy ningún `.feature` menciona RSVP |
| **9-a-3** | `src/data/repositories/events.js` + `features/events/` + rutas `/events`, `/events/:id` |
| **9-a-4** | Las pantallas de `wireframes.md` §6.6 |

Es el contexto más barato de los cuatro: **solo cliente y BDD**.

### 9-b — C4 Inventario

**La parte más débil del change.** Las tres tablas las diseñé yo sin pasar el filtro que la auditoría de Education aplicó a Education (12 de 20 tablas rechazadas como duplicación pura). Lo mínimo honesto antes de escribir la migración:

| Unidad | Contenido |
|---|---|
| **9-b-0** | **Revisión del diseño contra el catálogo existente.** ¿`services`/`service_assignments` ya modelan "algo prestado a alguien por un evento"? Si sí, C4 se reduce a `assets` y dos columnas |
| **9-b-1** | `features/inventory-assets.feature` · `features/asset-loans.feature` |
| **9-b-2** | `0044_inventory.sql` + `0045_asset_loans.sql`, con el índice parcial y el trigger de `assets.status` |
| **9-b-3** | Repositorio + `features/inventory/` + las tres pantallas de §6.7 |

### 9-c — C5 Analítica

| Unidad | Contenido |
|---|---|
| **9-c-1** | **Reescribir `features/analytics-and-insights.feature`**, no agregar al lado. Los 23 escenarios actuales son de analítica **personal**; el requerimiento es **por módulo** |
| **9-c-2** | Vistas y RPC de agregación. Cero tablas |
| **9-c-3** | `/analytics` según `wireframes.md` §6.8 |

---

## 7. Lo que este plan NO resuelve

| # | Pendiente | Por qué no está |
|---|---|---|
| **D7** | `UNIQUE(user_id, org_id, branch_id)` de `0001:36` está defeated por `branch_id` NULL | defecto **preexistente**. Arreglarlo es una migración sobre datos del seed de todos los org_memberships; no se mete de contrabando en una ampliación |
| **D8** | Cómo el docente ve el avance sin ver `notes` | Postgres no tiene grants por rol. La respuesta probable es un RPC `SECURITY DEFINER`, no un grant — y eso cambia la firma de la API |
| **D9** | El trigger de `assets.status` | existe el índice parcial que impide el préstamo doble, pero sin el trigger `assets.status = 'loaned'` es una opinión del cliente |
| **S1** | `FORCE ROW LEVEL SECURITY` en las **31 tablas existentes** | 7-1 lo aplica a las que toca. Las otras 24 son una migración aparte y es un **endurecimiento independiente** de la ampliación — pudo hacerse antes |
| **S3** | `admin_audit_log` solo registra C1 | Las decisiones de permisos de C3 y C4 también deberían auditarse. El esquema ya lo soporta |
| — | `er-diagram.html`, `architecture-current.html`, la nav | Los cuatro artefactos de referencia del repo siguen describiendo el estado **anterior** a la ampliación |

---

## 8. El hueco que esto no cubre

Los once requerimientos tienen **90 escenarios BDD** hoy (`analytics-and-insights` 23 + `education-*` 67 en cuatro archivos). **Faltan BDD para ocho de los once**, y la entry rule del repo dice que un ítem se implementa solo si su hito o su BDD lo requiere:

| Requerimiento | BDD | Nota |
|---|---|---|
| #2 Reportes | ✅ 23 | pero de alcance personal — hay que reescribirlo |
| #8 Actividades | ✅ 26 | |
| #9 Seguimiento | ✅ 20 | |
| #1 Usuarios y roles | ❌ | PR 7-1 |
| #3 Eventos | ✅ 16 | `cross-organization-event-collaboration` |
| #4 Asistentes | ❌ | PR 9-a-2 |
| #5, #6 Escaleta y repertorio | ✅ | ya construidos |
| #7 Bandas | ❌ | PR 7-4 |
| #10 Inventario | ❌ | PR 9-b-1 |
| #11 Préstamos | ❌ | PR 9-b-1 |

**Adoptar once requerimientos sin escribir los ocho BDD que faltan compra deuda desde el día uno.** Es el precio de esta ampliación y conviene que esté escrito.

**Con la integración a Moodle (Hito 8), los números de `education-*` son provisionales:** 8-1 reescribe esos cuatro archivos contra el nuevo dueño, y varios dejan de describir el sistema. Los 90 son el estado de hoy, no el objetivo.

---

## 9. Orden de arranque

1. **Decidir D1–D4.** Sin eso, PR 7-1 puede empezar pero 7-2 no.
2. **PR 7-1** (BDD). No toca la base — se puede abrir en paralelo a la decisión.
3. **PR 7-2** (migración + smoke). Requiere `supabase db reset`, que es paso reservado del mantenedor.
4. **PR 7-3** (pantallas). Recién acá C2, C3 y C4 tienen sobre qué construir.
5. Hito 8 completo antes de abrir el 9. La razón cambió con la redefinición del hito: ya no hay ledger de XP que arriesgar, pero la identidad federada toca el login de toda la app, y no conviene sumarle eventos e inventario encima.

---

*Contra `main` = `0b311e9`, 20-10-2026. Ninguna migración de esta hoja existe todavía; `docs/database-schema-ampliacion.md` es especificación, no código aplicado.*