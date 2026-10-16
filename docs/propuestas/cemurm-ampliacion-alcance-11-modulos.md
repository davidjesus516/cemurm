# CEMURM — Ampliación de alcance a 11 módulos

**Versión:** 1.0 (borrador para decisión del mantenedor)
**Fecha:** 13 de octubre de 2026
**Audiencia:** Mantenedor y equipo técnico interno
**Propósito:** Fijar el alcance de la ampliación solicitada desde la academia, declarar qué existe hoy en cada capa, señalar los puntos donde el repositorio se contradice con la lista recibida, y poner a decisión las preguntas que son de producto y no de ingeniería.

> Documento interno. El documento dirigido a la academia es `docs/propuestas/cemurm-propuesta-para-academia-v2.md` y se apoya en este.

---

## 1. De dónde viene el pedido

La academia, por recomendación de su docente, devolvió una lista de **11 requerimientos de gestión** y un árbol de cuatro áreas:

```
PLATAFORMA INTEGRAL
├── Eventos y Conciertos      → #3 eventos, #4 asistentes
├── Repertorio Digital        → #5 escaleta, #6 repertorio
├── Formación y Pedagogía     → #8 actividades, #9 seguimiento
└── Inventario y Equipos      → #10 inventario, #11 préstamos
```

más #1 usuarios y roles, #2 reportes y análisis, y #7 bandas.

Esta lista describe una **plataforma de gestión institucional**. CEMURM, según su propia definición vigente (`docs/product-brief.md:5`), es "a web app that helps musicians organize their songs and setlists… a digital music binder". No son el mismo producto.

**La lista no es arbitraria, y conviene entender por qué llega ahora.** El primer esquema del repositorio, `supabase/migrations/0001_init.sql`, fue escrito con 44 entidades y **sí** fue diseñado para una plataforma institucional: `organizations.org_type` acepta `'Academy' | 'Church' | 'Orchestra'`, y existen `branches`, `venues`, `events`, `event_participants`, `event_rsvps`, `event_setlists`, `reports`. Lo que se construyó después fue deliberadamente más angosto — el cuaderno del músico. La lista es, en otras palabras, **la ambición del esquema inicial que quedó a medias**.

Adoptarla no es un error. Es una **decisión de producto**, y este documento es para tomarla con los números a la vista.

---

## 2. Estado real por requerimiento

La pregunta "¿está esto construido?" no tiene una sola respuesta: hay cinco capas y un requerimiento puede estar en una y ausente en las otras. Esta tabla es el centro del documento.

| # | Requerimiento | Esquema | RLS | Grants | BDD | Cliente | Veredicto |
|---|---|---|---|---|---|---|---|
| **1** | Usuarios y roles | parcial | parcial | **solo `select`** | ❌ | ❌ | **bloqueante** |
| **2** | Reportes y análisis | ❌ | ❌ | ❌ | ✅ 23 esc. | ❌ | por escribir |
| **3** | Gestión de eventos | ✅ | ✅ 12 pol. (4+4+4) | ✅ | ✅ 16 esc. | ❌ | cablear |
| **4** | Gestión de asistentes | ✅ | ✅ 3 pol. | ✅ | ❌ | ❌ | cablear + BDD |
| **5** | Gestión de escaleta | ✅ | ✅ | ✅ | ✅ | ✅ | **completo** |
| **6** | Repertorio musical | ✅ | ✅ | ✅ | ✅ | ✅ | **completo** |
| **7** | Gestión de bandas | ⚠️ parcial | ✅ | ✅ | ⚠️ | parcial | decisión de diseño |
| **8** | Gestión de actividades | ❌ | ❌ | ❌ | ✅ 26 esc. | ❌ | por construir |
| **9** | Gestión de seguimiento | ❌ | ❌ | ❌ | ✅ 20 esc. | ❌ | por construir |
| **10** | Gestión de inventario | ❌ | ❌ | ❌ | ❌ | ❌ | desde cero |
| **11** | Préstamos y asignaciones | ❌ | ❌ | ❌ | ❌ | ❌ | desde cero |

**Resultado: 2 completos, 3 cableables, 1 con decisión de diseño pendiente, 5 por construir de los cuales 2 son desde cero.**

### 2.1 Corrección sobre #3 y #4

Una lectura rápida da la impresión de que `events`, `event_participants`, `event_rsvps` y `event_setlists` son *schema muerto*. **No lo son.** Tienen tabla, enum, políticas RLS (**4, 4, 3 y 4** respectivamente, todas en `0016`) y —decisivamente— `0016_org_repertoire_model.sql:556-557` les **devuelve el GRANT a `authenticated`**. Están **construidos y gobernados, pero nunca cableados a un cliente.** Es el mejor negocio de la lista: se paga repository, páginas y BDD, no diseño de datos.

> El recuento sale de `grep -h "create policy" supabase/migrations/*.sql` filtrado por tabla y con `sort -u`: cuatro nombres por tabla. `0020_review_batch1.sql:184,201,230` recrea tres de ellos con los mismos nombres, así que reemplazan y no suman. Los números 8, 12, 6 y 10 que circulaban en versiones previas de este documento no corresponden a nada que exista en el repositorio.

La decisión de diseño que los bloqueaba ya está resuelta: `docs/database-schema-v2.md` §D3, resolución del 2026-09-01 — *"Event-owned, read-only for all participants"*.

### 2.2 Sobre #2: la tabla `reports` no es de reportes

`reports` (`0001_init.sql:460`) es `public_song_id` + `report_reason` (`copyright_violation`, `offensive_content`, `spam_duplicate`, `wrong_metadata`) + `reporter_id`. Es **denuncia de contenido sobre la biblioteca pública**, con flujo de moderación. No tiene relación con generar reportes por módulo.

El único sustento de #2 es `features/analytics-and-insights.feature`, que está asignado a **Hito 6, sin empezar**, y su alcance es *analítica personal de repertorio* (canciones más usadas, crecimiento, horas de práctica), no analítica institucional.

### 2.3 La bisagra: `org_memberships` es de solo lectura

Este es el hallazgo que condiciona toda la ampliación.

```
grant select on table public.organizations, public.branches, public.org_memberships to authenticated;
0016_org_repertoire_model.sql:552
```

`org_memberships` tiene **tres políticas, las tres `SELECT`**: `select_self`, `select_org_admin`, `select_system`. **No hay política `INSERT`, `UPDATE` ni `DELETE`, y el único grant es `select`.**

**Hay un camino de escritura, y es de una sola acción: salir.** `private.org_leave` (`0016:437-453`) pone `status='former'` y `left_at` sobre las filas del propio actor, envuelto por `public.leave_organization` (`0016:455-459`), con `grant execute … to authenticated` (`0016:534,544`), cableado a `src/data/repositories/orgRepertoire.js:180` y a un botón vivo en `Organizations.jsx:318-340`. Es el **único** `INSERT`/`UPDATE` sobre `org_memberships` en las 34 migraciones.

Lo que **no** existe: **alta** —nadie puede unirse a una organización desde la aplicación—, **cambio de rol**, ni **baja de terceros**. Un miembro solo se va a sí mismo. Todo lo demás sigue siendo seed o SQL manual.

Consecuencias directas:

- **#1** no es "una pantalla más". Asignar un rol es escribir en una tabla que el cliente no puede escribir.
- **#7** necesita pertenencia a una banda.
- **#8** necesita matricular alumnos, lo que requiere saber quiénes pertenecen a la organización.

Además `profiles` (`0006_band_collaboration.sql:29`) tiene solo cinco columnas —`id`, `display_name`, `username`, `instrument`, `avatar_url`— **sin `created_at` y sin `status`**, y su `update` está capado por columna (`0006:176`). No hay forma de listar cuentas por fecha de alta ni de desactivar una cuenta.

**#1 no es un módulo paralelo: es la precondición de #7, #8 y #9.**

---

## 3. Arquitectura propuesta

Cinco contextos. El orden no es temático: es de dependencia.

```
┌─ C1 Identidad y organización ────────────────────────────────────────┐
│  #1 usuarios y roles · #7 bandas                                     │
│  Desbloquea: org_memberships escribible + roles con CHECK            │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ requiere
┌───────────────────────────────▼──────────────────────────────────────┐
│  C2 Formación — #8 actividades · #9 seguimiento                       │
│  5 tablas (auditoría ya hecha) · 46 escenarios BDD ya escritos        │
└──────────────────────────────────────────────────────────────────────┘

┌─ C3 Eventos y asistencia — #3 · #4 ──────────────────────────────────┐
│  Cableado. Sin migración: esquema, RLS, grants y D3 ya resueltos.    │
└──────────────────────────────────────────────────────────────────────┘

┌─ C4 Inventario y préstamos — #10 · #11 ──────────────────────────────┐
│  Desde cero. 3 tablas nuevas.                                         │
└──────────────────────────────────────────────────────────────────────┘

┌─ C5 Analítica institucional — #2 ────────────────────────────────────┐
│  Vistas y RPC de agregación. Sin tabla nueva. Reescribe el BDD.      │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.1 C1 — Identidad y organización

**No se crea una entidad de cuentas.** Se cierra el circuito sobre lo que ya existe:

| Cambio | Dónde | Qué resuelve |
|---|---|---|
| `profiles.account_status text not null default 'active'` | migración | Desactivar cuentas. Valores: `active`, `suspended`, `deactivated` |
| `profiles.created_at timestamptz not null default now()` | migración | Listar y ordenar cuentas por alta |
| `CHECK` sobre `org_memberships.role` | migración | El rol hoy es `text` libre sin restricción — `0001:32` lo anota como *"enum in 2.2"* y `odd/tasks/cemurm-education-audit.md:34` lo registra como *"all `text`, no CHECK"*. El vocabulario real es el enum de `0001:60-68` menos los dos roles de plataforma, que viven en `user_roles`: `org_member`, `performer`, `substitute`, `instructor`, `branch_admin`, `org_admin`, `org_owner`, `event_coordinator`, `backstage_coordinator` |
| Grants + políticas `INSERT`/`UPDATE`/`DELETE` en `org_memberships`, o dos RPC `SECURITY DEFINER` en `private` | migración | El camino de escritura que hoy no existe |
| Columna `grant` ampliada en `profiles` | migración | Permitir que un admin escriba `account_status` |
| Edge Function de administración de cuentas | `supabase/functions/` | Crear una cuenta para otro usuario requiere `auth.admin.createUser`. **Hoy hay una sola función en todo el repo** (`send-guardian-consent`), así que esta sería la primera de su clase. CI corre `deno check 'supabase/functions/**/*.ts'` sobre ellas |

> **Trampa conocida (R14 de la auditoría):** los privilegios por defecto del esquema `private` difieren entre `0002:42` (revoca a `public`, `anon`, `authenticated`) y `0016:54` (revoca solo a `public`, `anon`). **Gana el último.** Cualquier función nueva en `private` debe copiar el bloque de cuatro líneas de `0002:33-39` literalmente.

**#7 bandas — la decisión de diseño.** Dos caminos reales:

| | Opción A — una banda es una organización | Opción B — entidad `bands` propia |
|---|---|---|
| Coste | Ampliar el `CHECK` de `org_type` con `'Band'` | 3 tablas nuevas: `bands`, `band_members`, `band_repertoire` |
| Pertenencia | `org_memberships`, ya existe | `band_members`, duplicación |
| RLS | La de organizaciones, ya escrita | Red nueva, sin precedente |
| Repositorio | `orgRepertoire.js`, ya existe | Nuevo |
| Deuda | `bandmate_links` sigue siendo un vínculo **por pares**, no una banda | Dos modelos de grupo conviviendo |

**Posición actual: A.** La auditoría ya rechazó 12 de 20 tablas propuestas como duplicación pura; una entidad `bands` es exactamente eso. `organizations.org_type` ya acepta `'Academy' | 'Church' | 'Orchestra'` — el contenedor institucional ya está diseñado, solo no se usó para bandas.

### 3.2 C2 — Formación

La auditoría `odd/tasks/cemurm-education-audit.md` (28-sep-2026) ya resolvió el diseño completo. **Cinco tablas, no veinte**:

| Tabla | Papel |
|---|---|
| `education_courses` | `org_id` es la frontera de aislamiento; `branch_id`, `title`, `instrument`, `status` |
| `education_exercises` | `course_id`, `target_song_id`, `target_version_id`, `anchor jsonb`, `position` — **reemplaza unidades y lecciones**, que la auditoría colapsa |
| `education_enrollments` | `course_id` + `user_id` + rol por curso. Deliberadamente **no** con la forma de `org_memberships`, cuyo `UNIQUE(user_id, org_id, branch_id)` (`0001:36`) falla cuando `branch_id` es NULL |
| `education_progress` | PK `(exercise_id, user_id)`, una fila por clave → last-write-wins es seguro offline |
| `education_events` | **Ledger append-only de XP** con `client_uuid uuid unique` como clave de idempotencia. XP, nivel y racha se derivan por `sum` / `count(distinct date)`; la suma es conmutativa, así que dos dispositivos convergen |

**Los 46 escenarios ya están escritos** en `features/education-courses-and-exercises.feature` (13), `features/education-student-progress.feature` (20) y `features/education-teaching-assignments.feature` (13). El bloqueo de gamificación (R3) ya se resolvió editando `features/practice-mode.feature`.

El motivo del ledger no es capricho: es lo único que la cola offline actual maneja bien. Los riesgos R6 y R7 de la auditoría —un evento de XP rechazado **detiene toda la cola** para siempre, y no hay idempotencia en ningún lado— se resuelven con el `client_uuid` único y un `on conflict do nothing` del lado servidor.

### 3.3 C3 — Eventos y asistencia

**Sin migración.** Todo el dato está:

- `events` + `event_setlists` + `venues` cubren #3.
- `event_rsvps` (`undecided` / `yes` / `no`, con `responded_at` y `UNIQUE(event_id, member_id)`) cubre #4 casi por completo, y su diseño ya está resuelto: los recordatorios apuntan a `yes` + `undecided`, nunca al `no` explícito.

Falta:

1. **BDD de asistencia.** `cross-organization-event-collaboration.feature` cubre 16 escenarios de evento, pero ningún `.feature` menciona RSVP ni asistencia. Sin BDD no hay producto, por regla del repositorio.
2. `src/data/repositories/events.js` + `src/features/events/` + rutas.

**Obstáculo declarado por el propio esquema:** `0001_init.sql:243` anota que `events.type` está *"NOT SETTLED BY THE FEATURES"*, y el enum `event_type` contiene `'mixed-group' | 'sequence-only' | 'full-program'` — que son **tipos de colaboración, no tipos de evento**. Un concierto no es "sequence-only". Resolver esto es una decisión de producto, no de codificación, y está en §4.

### 3.4 C4 — Inventario y préstamos

Desde cero. Diseño mínimo, tres tablas:

| Tabla | Campos esenciales |
|---|---|
| `asset_types` | `id`, `name`, `category`, `spec_schema jsonb` — el catálogo de qué clase de equipo existe |
| `assets` | `id`, `asset_type_id`, `org_id`, `branch_id`, `label`, `serial`, `status` (`available`/`loaned`/`maintenance`/`retired`), `specs jsonb` (los detalles técnicos del requerimiento: marca, modelo, año), `acquired_at`, `notes` |
| `asset_loans` | `id`, `asset_id`, `holder_user_id`, `assigned_by`, `checked_out_at`, `due_at`, `returned_at`, **`event_id`** (la vinculación directa al evento que pide el requerimiento), `condition_out`, `condition_in`, `notes` |

Dos reglas que no son opcionales:

- **Un activo no puede estar prestado dos veces.** Índice único parcial: `unique (asset_id) where returned_at is null`.
- **La condición de salida y la de vuelta son campos distintos.** Es lo que permite "se prestó roto" como hallazgo posterior en lugar de como memoria.

Decisión abierta en §4: si el inventario es **por organización** (una academia con dos sedes no comparte equipos) o **por sistema** (un equipoNSA circula entre academias). El modelo actual es multi-organización con permisos por rama, así que la respuesta por defecto es por organización.

### 3.5 C5 — Analítica institucional

Sin tablas nuevas. La materia prima ya está: `performances` + `performance_items` registran **qué se tocó realmente**, con `play_state` (`played` / `skipped` / `off_setlist`) y posición. El propio esquema anota que de ahí sale la demanda por canción.

El trabajo es: vistas y funciones `SECURITY DEFINER` de agregación por módulo, **y reescribir `features/analytics-and-insights.feature`**, que hoy describe analítica personal.

> **R11 de la auditoría, aplicable aquí:** `api.max_rows = 1000` (`supabase/config.toml:18`). Una clase de 40 alumnos × 20 ejercicios son 800 filas en un join, y un ranking sobre el ledger revienta ese límite en la primera página **truncando en silencio**. Cualquier agregación de C2 y C5 necesita paginación explícita.

---

## 4. Puntos donde hay que decidir

Cada uno lleva posición actual. Los marcados **(bloqueante)** impiden escribir la primera migración.

### D1 — Consentimiento de menores para datos educativos **(bloqueante, decisión de producto)**

`guardian_consents` (`0017:81`) tiene **un solo permiso sustantivo**: `public_sharing_approved`. No hay columna de alcance, ni de finalidad, ni registro por propósito. Un docente que lee el avance de un alumno menor **no tiene ningún registro de consentimiento que lo cubra**.

Esto no es defecto de esquema sino un hueco de producto, y la ampliación lo agrava: el progreso académico es el dato más sensible de los 11 módulos, y los menores ya son fail-closed desde Hito 4.

**Posición:** agregar un artefacto de consentimiento versionado **por finalidad** antes de la primera migración de C2. Sin él, no se pueden escribir escenarios de menores en `features/education-*.feature` sin inventar acuerdo sobre una pregunta que sigue abierta.

### D2 — Quién matricula y qué ve un admin **(bloqueante, decisión de producto)**

La auditoría describe las políticas como *"owner/instructor scoped"* sin resolver cuál owner, y `education-bdd.md` lo registra como pendiente: la matriculación se tratan como precondición (`Given Lucia is enrolled in …`), no como flujo diseñado.

**Posición:** `org_admin` matricula; `branch_admin` sólo en su sede; el instructor ve **qué ejercicios terminó cada alumno y cuándo**, y no ve sesiones de práctica, duraciones, racha, XP ni notas privadas — que es exactamente lo que los 46 escenarios ya afirman en la negativa.

### D3 — ¿Qué es un evento?

`events.type` está marcado como no resuelto en el propio esquema, y el enum mezcla colaboración con naturaleza. El requerimiento #3 pide "presentaciones, ensayos, reuniones o conciertos"; el repositorio ya tiene `gigs`, `rehearsals` y `services` como entidades separadas y **construidas**.

**Posición:** `events` es la entidad genérica de coordinación y **no debe crear una cuarta no.** Un `event` puede apuntar opcionalmente a un `gig`, `rehearsal` o `service` ya existente, en vez de duplicarlos. Resolver antes de escribir el BDD de asistencia.

### D4 — Bandas: organización o entidad

Ver §3.1. **Posición: A**, con la consequence de que `bandmate_links` se mantiene como invitación directa y no como modelo de pertenencia.

### D5 — ¿Dónde entra esto en el calendario?

Hito 6 tiene **seis features sin iniciar** y es la puerta de beta con obligaciones de privacidad primero (`offboarding-cascade`, `account-data-export-and-erasure`). Sus 11 requerimientos no caben ahí.

**Posición:** Hito 6 intacto. Los 11 requerimientos se **(posponer)** a los siguientes, **en orden de dependencia**:

| Hito | Contenido | Depende de |
|---|---|---|
| **6** (sin cambios) | 6 features de beta polish. Su `cross-organization-event-collaboration` entrega la primera rebanada de #3 | — |
| **7 — Identidad y organización** | #1 + #7 + hacer `org_memberships` escribible | — |
| **8 — Formación** | #8 + #9 (5 tablas, 46 escenarios ya escritos) | 7 |
| **9 — Eventos e inventario** | #3 resto + #4 + #10 + #11 + #2 | 7 |

El orden no es una preferencia: **C2, C3 y C4 no pueden construirse antes que C1**, porque los tres necesitan escribir en la organización.

### D6 — Vocabulario: `assignment` colisiona

`service_assignments` ya significa *puesto de músico en un bloque de servicio*, y `service-planning.feature` tiene una sección `MUSICIAN ASSIGNMENT`. Cuando llegue el día de una tabla `education_assignments`, el nombre significa dos cosas.

**Posición:** el sustantivo de esquema es **`education_work`**. El título del feature y el verbo "assign" se quedan; el sustantivo de base de datos no.

---

## 5. Migraciones

`main` lleva **34 archivos, `0001`–`0036`, con `0021`/`0022` como hueco deliberado**. **El siguiente número libre es `0037`.**

| # | Migración | Contenido | Capa |
|---|---|---|---|
| `0037` | `identity_account_lifecycle.sql` | `profiles.account_status`, `profiles.created_at`, `CHECK` en `org_memberships.role`, grants + políticas de escritura, RPC `SECURITY DEFINER` | C1 |
| `0038` | `bands_as_organizations.sql` | `'Band'` en el `CHECK` de `org_type`, `branch_admin` si aplica | C1 |
| `0039` | `education.sql` | Las 5 tablas + familia completa de RLS, siguiendo la convención de una migración por familia (`0018`, `0019`, `0023`) | C2 |
| `0040` | `inventory.sql` | `asset_types`, `assets` | C4 |
| `0041` | `asset_loans.sql` | `asset_loans` + índice único parcial | C4 |

**C3 no necesita migración.** Es el único contexto cuyo número de migraciones es cero.

Orden obligatorio: el nombre de archivo **es** el orden de ejecución de `supabase db reset`, así que una migración que crea lo que otra referencia tiene que ordenar **antes**. Verificar colisión en todas las ramas remotas antes de abrir el PR:

```bash
git branch -r | xargs -I{} git ls-tree --name-only {} -- supabase/migrations/
```

---

## 6. Riesgos

### Heredados de la auditoría de Education

| # | Riesgo | Estado |
|---|---|---|
| R1 | No existe precedente de RLS de una organización leyendo datos de un miembro. Todas las políticas de C2 son nuevas | abierto → lo resuelve D2 |
| R3 | `practice-mode.feature` prohibía rachas y gamificación | **resuelto**: la prohibición se eliminó y el escenario se renombró |
| R5 | Ningún artefacto de consentimiento cubre datos educativos de menores | **abierto → D1, bloqueante** |
| R6 | Un evento de XP rechazado detiene la cola offline para siempre | abierto → mitigado por diseño del ledger, hay que verificarlo |
| R7 | No hay idempotencia en la cola: una op que se reproduce cobra dos veces | abierto → `client_uuid` + `on conflict do nothing` |
| R10 | Una segunda paleta de color es **fallo duro de CI**. La regla 04 tiene una lista blanca cerrada de 17 hojas, y `cem.emerald` y `cem.rose` —los colores naturales de "logro" y "bloqueado"— están en la lista de retiro de la regla 02 | abierto → codificar los cuatro estados con **rampa + ámbar + peso + icono** |
| R11 | `api.max_rows = 1000` trunca en silencio | abierto → paginación explícita |
| R14 | Privilegios por defecto de `private` difieren entre migraciones | abierto → copiar el bloque de `0002:33-39` literalmente |
| R15 | Colisión de vocabulario `assignment` | abierto → D6 |

### Nuevos, introducidos por esta ampliación

| # | Riesgo |
|---|---|
| **N1** | La entry rule de `AGENTS.md` dice *"an item is implemented only when its hito or BDD feature requires it"*. **Nueve de los once requerimientos no tienen `.feature` todavía.** Adoptarlos sin escribir BDD primero viola la regla que hace confiable al repositorio. `#2`, `#8` y `#9` tienen BDD; los demás no. |
| **N2** | `org_memberships` no tiene camino de escritura salvo `leave_organization` (`0016:437-459`), que solo deja irse a uno mismo. Hoy el hueco está enmascarado porque el seed crea las pertenencias y nadie necesita unirse. Al abrir C1 deja de estarlo. |
| **N3** | `events.type` está declarado no resuelto en el propio esquema. Construir sobre él sin resolver D3 congela una ambigüedad en la base. |
| **N4** | `profiles` no tiene `created_at` ni `status`, y su `update` está capado por columna. "Desactivar cuentas" no tiene punto de anclaje hoy. |
| **N5** | `supabase/functions/` contiene **una** función. La administración de cuentas sería la primera Edge Function de escritura, en una ruta donde CI corre `deno check` y donde no hay precedente. |
| **N6** | Los menores son fail-closed desde Hito 4 y la ampliación multiplica los datos sensibles que el producto puede sostener sobre ellos. D1 no es un formality para este alcance: es el techo legal del Hito 8. |
| **N7** | Doce features de Hito 6 siguen sin empezar. Sumar 11 requerimientos sin cerrar Hito 6 deja la beta sin fecha mientras el producto crece. |

---

## 7. Qué hay que escribir antes de escribir código

Por regla del repositorio, **BDD es la verdad de producto**. El orden no es negociable.

| Orden | Artefacto | Requerimientos |
|---|---|---|
| 1 | Decisión sobre D1 y D2 | 8, 9 |
| 2 | `.feature` nuevos: asistencia, gestión de cuentas, bandas, inventario, préstamos | 1, 3, 4, 7, 10, 11 |
| 3 | Reescribir `analytics-and-insights.feature` de personal a institucional | 2 |
| 4 | Cambio de `docs/mvp-scope.md`: los `education-*` dejan de *"await a scope decision"* y se asignan a Hito 8 | 8, 9 |
| 5 | `openspec/changes/` — una delta spec por capacidad | los 11 |
| 6 | ADRs nuevos: el registro va por tema, no por cronología, así que **ADR-011** es el siguiente libre | D4, D5, D6 |
| 7 | `features/practice-mode.feature` y el resto del suite **no se tocan** | — |

Un recordatorio de capa: la lógica de progreso, racha y XP va en `src/domain/education/` como funciones puras. Vitest corre en entorno `node` sin jsdom, así que **el JSX no se puede renderizar en tests** — si esa lógica vive en un hook o en una página, llega sin ninguna red de regresión.

---

## 8. Cómo respondemos a esto

1. **Decidir D1 a D6.** D1 y D2 bloquean la primera migración de C2; D5 decide el calendario de todo lo demás.
2. **Escribir los `.feature` faltantes** antes de la primera migración, sin excepción.
3. **Abrir Hito 7** con C1, que es el que desbloquea a los otros tres.
4. **Cerrar Hito 6 sin tocarlo.** La beta tiene una promesa de fecha y Hito 6 es su puerta.
5. **Decirlo en la versión externa.** `docs/propuestas/cemurm-propuesta-para-academia-v2.md` presenta los 11 módulos **con su estado real**: 2 completos, 3 cableables, 5 por construir, 1 pendiente de decisión de diseño.

---

*Elaborado contra `main` = `a610dd0` (34 migraciones, 45 features, 713 escenarios, 26 rutas), rama `docs/sync-ci-and-migration-facts` @ `cc2e7f9`, 2026-10-13. Cada afirmación lleva su evidencia en `supabase/migrations/`, `src/`, `features/` u `odd/tasks/`.*