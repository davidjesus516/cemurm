# Proposal: ampliar el alcance de CEMURM de cuaderno del músico a plataforma de gestión institucional

> Change: `ampliar-alcance-institucional`
> Origen: lista de 11 requerimientos de gestión remitida por la academia, por recomendación de su docente.
> Estado: **propuesta en revisión.** No autorizada para implementación.
> Base: `main` = `a610dd0`, 34 migraciones, 45 features / 713 escenarios, 26 rutas.
> Documento largo acompañante: `docs/propuestas/cemurm-ampliacion-alcance-11-modulos.md`.
> Diagrama: `docs/uml/uc-04-alcance-institucional.puml` / `.svg` / `.html`.

---

## Intent

CEMURM hoy es "a digital music binder": repertorio, escaletas, modo escenario, colaboración. La academia pide once módulos de **gestión institucional** —usuarios y roles, reportes, eventos, asistentes, bandas, actividades, seguimiento, inventario y préstamos— que no son una extensión de ese producto sino **un producto distinto**.

Este change propone aceptar los once, con el orden de dependencias que la evidencia impone, y con las seis decisiones de producto que hay que tomar antes de la primera migración.

Lo que **no** hace: no autoriza código. Fija alcance, expone las decisiones abiertas y dice qué se escribe antes de construir.

## Problem

### 1. La lista describe un producto que no construimos — y el esquema inicial sí lo anticipaba

`docs/product-brief.md:5` define el producto como un cuaderno de partituras. Pero `supabase/migrations/0001_init.sql` fue escrito con **44 entidades** y `organizations.org_type` acepta `'Academy' | 'Church' | 'Orchestra'`. Esas cuatro áreas son, literalmente, el diseño original del esquema.

El resultado: **la lista de la academia no es arbitraria, es la ambición del esquema inicial que quedó a medias.** Eso la hace razonable — y también hace que adoptarla sea una decisión de producto, no un faltante de ejecución.

### 2. "Ya existe" no es una respuesta válida: hay cinco capas

La pregunta "¿está esto construido?" tiene cinco respuestas distintas por requerimiento. El repositorio entero se equivoca cuando responde sin esa distinción.

| Capa | Qué significa | Cómo se verifica |
|---|---|---|
| Esquema | la tabla existe | `create table` |
| RLS | hay políticas | `create policy` |
| Grants | el cliente tiene permiso | `grant … to authenticated` |
| BDD | el comportamiento está especificado | `features/*.feature` |
| Cliente | hay pantalla y repositorio | `src/` |

El caso más importante: **`events`, `event_participants`, `event_rsvps` y `event_setlists` parecían schema muerto y no lo son.** Tienen tabla, enum, **4, 4, 3 y 4** políticas RLS respectivamente (las cuatro de `venues` son de `0004`), y `0016:554-558` les **devuelve el GRANT a `authenticated`**. Están construidos y gobernados, nunca cableados. Cuesta repository y pantallas, no diseño de datos.

### 3. La organización es de solo lectura, y todo lo demás depende de eso

Este es el hallazgo que condiciona la ampliación entera.

```
grant select on table public.organizations, public.branches, public.org_memberships to authenticated;
  -- 0016_org_repertoire_model.sql:552
```

`org_memberships` tiene **tres políticas, las tres `SELECT`**: `org_memberships_select_self`, `_select_org_admin`, `_select_system`. De las **164 políticas vivas** del repositorio —174 sentencias `create policy` en el historial, de las que diez son re-creaciones con el mismo nombre— ninguna escribe en esa tabla.

**Lo que falta no es un camino de escritura: es casi todo el camino de escritura, menos uno.** Existe exactamente uno, y es de una sola acción:

| | |
|---|---|
| Core | `private.org_leave` (`0016:437-453`) hace `update org_memberships set status = 'former', left_at = now()` sobre las filas del propio actor |
| Wrapper | `public.leave_organization` (`0016:455-459`) |
| Permisos | `grant execute … to authenticated` en `0016:534` y `0016:544` |
| Cliente | `src/data/repositories/orgRepertoire.js:180` y un botón vivo en `Organizations.jsx:318-340` |

Y es el **único** `INSERT`/`UPDATE` sobre `org_memberships` en las 34 migraciones (fuera del seed, `seed.sql:79`). Lo que sigue sin existir: **alta** —nadie puede unirse a una organización desde la aplicación—, **cambio de rol** y **baja de terceros**. Un miembro solo puede irse a sí mismo. Por lo tanto:

- **#1** asignar un rol es escribir en una tabla que el cliente no puede escribir
- **#7** bandas necesita pertenencia a un grupo
- **#8** matricular alumnos requiere saber quiénes pertenecen a la organización

**C1 no es un módulo paralelo. Es la precondición de tres de los once.**

### 4. El precedente correcto ya está escrito: hay que replicarlo, no inventarlo

El repositorio ya resolvió esto para las canciones. `promote_song_to_system` / `demote_song` (`0016:360-430`) son el molde exacto:

- RPC público delgado que delega a `private.org_promote_song`
- El helper valida `session_has_system_role('system_admin')` **o** `private.session_role_in(...)`
- Si ninguna se cumple, `raise exception`

Y `private.session_role_in` (`0002_rls_core.sql:26-30`) tiene la forma correcta: `security definer`, `set search_path = ''`, y **la guarda `user_id = auth.uid()` dentro de la función** — no confía en el argumento que le pasan. Además `0002:41` deja `alter default privileges … revoke execute`, así que las funciones futuras en `private` heredan el bloqueo.

**El requerimiento #1 es un caso más de un patrón existente.** La propuesta no inventa arquitectura de autorización.

## Scope

### In scope

Once módulos, agrupados en cinco contextos con dependencia de construcción explícita:

| Contexto | Requerimientos | Trabajo |
|---|---|---|
| **C1 Identidad y organización** | #1, #7 | Cerrar el ciclo de escritura de `org_memberships`; estado de cuenta en `profiles`; bandas como tipo de organización |
| **C2 Formación** | #8, #9 | 5 tablas (`odd/tasks/cemurm-education-audit.md` §E). Los 46 escenarios BDD **ya están escritos** |
| **C3 Eventos y asistencia** | #3, #4 | Cableado. **Cero migraciones** — esquema, RLS, grants y la decisión D3 ya resueltos |
| **C4 Inventario y préstamos** | #10, #11 | 3 tablas nuevas desde cero |
| **C5 Analítica institucional** | #2 | Vistas y RPC de agregación. Cero tablas. Reescritura del BDD |

Migraciones previstas `0037`–`0041` (`0037` es el siguiente libre; `0021`/`0022` siguen siendo hueco deliberado).

### Out of scope

- **Hito 6 sin tocar.** Seis features sin iniciar, es la puerta de beta y `docs/master-plan.md` §4 pone las obligaciones de privacidad primero. Los once requisitos van a Hitos 7–9.
- **`user_roles` no se extiende.** `system_admin` y `community_moderator` son de plataforma, no de organización. Ampliar ese catálogo crea un tercer sistema de roles.
- **Una entidad `bands` propia** si D4 se resuelve como se recomienda (§D4): duplicaría `organizations`, que es exactamente el error que la auditoría ya rechazó 12 veces sobre 20.
- **No se toca `features/practice-mode.feature`.** El bloqueo de gamificación (R3) ya se resolvió amending ese archivo; no hay razón para volver a abrirlo.
- **No se reescribe `docs/database-schema-v2.md` en este change.** Es el origen de diseño de 900 líneas y su §3.1 sigue siendo *design target, not live*. Reportado, no vinculado a este change — ver *Frozen decisions* 6.

## Capabilities

### New capabilities

- `identity-account-lifecycle` — #1. Estados de cuenta, gestión de roles organizacionales, baja sin pérdida de historial.
- `band-membership` — #7, condicionado a D4.
- `asset-inventory` — #10.
- `asset-loans` — #11, con vinculación a evento.
- `education-courses-exercises` — #8 (sin spec propia todavía).
- `education-student-progress` — #9.
- `education-teaching-work` — #8, la mitad de asignación. El sustantivo de esquema es `education_work`, no `education_assignments` (D6).
- `event-attendance` — #4. Ningún `.feature` menciona RSVP hoy.
- `institutional-analytics` — #2.

### Modified capabilities

- `organizational-repertoire-model` — `org_memberships` deja de ser read-only. **Es una modificación de una capacidad existente, no una nueva**, y eso cambia la revisión: toca políticas que ya tienen nombre y propósito.
- `gigs-and-performance-history` — `performances`/`performance_items` pasan a ser la materia prima de C5.
- `analytics-and-insights` — se reorienta de analítica **personal** a **por módulo**. Los 23 escenarios existentes se reescriben, no se agregan al lado.

## Approach

Un principio, tomado del precedente que ya existe:

> **La autorización es una función `SECURITY DEFINER` en `private` que revalida `auth.uid()` internamente y nunca confía en sus argumentos. El cliente no escribe tablas organizacionales.**

De ahí sale todo:

- Los RPC de C1 replican la forma de `promote_song_to_system`: wrapper público delgado, validación en `private`, excepción en negación.
- Los grants de escritura se justifican con la existencia del RPC, nunca "por comodidad". Un `grant insert` sin `with check` en la política es una fuga de escritura que **ningún test de lectura detecta** (PostgreSQL 18: `USING` gobierna la lectura, `WITH CHECK` gobierna la escritura).
- `org_memberships.role` recibe un `CHECK` que hoy no tiene (`0001:32`, `text` libre — `"enum in 2.2; system roles live on a join"`, y `odd/tasks/cemurm-education-audit.md:34` lo anota como *"all `text`, no CHECK"*).
- La proliferación de datos sensibles hace obligatorio el registro de auditoría, que el repositorio no tiene.

### Los cuatro huecos que hay que cerrar

Verificados sobre el código, no heredados:

| # | Hueco | Evidencia | Cierre propuesto |
|---|---|---|---|
| **S1** | Ninguna de las 31 tablas con RLS tiene `FORCE ROW LEVEL SECURITY`, así que **el owner de la tabla bypasea RLS** | `grep "force row level security" supabase/migrations/*.sql` → 0 | `ALTER TABLE … FORCE ROW LEVEL SECURITY` en las tablas organizacionales de C1–C4. Ojo: `service_role` es `BYPASSRLS` por diseño en Supabase y eso **no** se toca |
| **S2** | `org_memberships` sin ruta de escritura | Ver *Problem* §3 | Los RPC de C1 |
| **S3** | **No hay registro de auditoría.** Cinco migraciones mencionan `audit` en comentarios, no hay tabla | `grep -l audit supabase/migrations/*.sql` → 0 filas de auditoría | Tabla de auditoría con **contexto de grupo**, no solo actor: ownCloud registra los grupos del actor por evento (`OWNCLOUD_ADMIN_AUDIT_GROUPS`) precisamente porque el id solo no basta para reconstruir *qué organización* lo hizo |
| **S4** | `profiles` sin `status` ni `created_at`; `update` capado a cuatro columnas | `0006:29`, `0006:176` | Columnas + grant ampliado |

**S1 es independiente de la ampliación.** Es una decisión de endurecimiento que pudo haberse tomado antes y no se tomó.

### Separación de funciones (SOD)

OPA documenta el patrón como pares de roles que **nunca** se asignan juntos, y la razón es que cada control por sí solo es insuficiente. Aplicado:

| Restricción | Razón |
|---|---|
| Quien **solicita** un ingreso no puede **aprobarlo** | Una sola persona no se auto-aprueba |
| Un `branch_admin` no opera fuera de su sede | El modelo es por rama; saltarse la rama es el bypass más común |
| Un `instructor` no modifica su propio avance | El avance es evidencia de evaluación; el evaluador no es el evaluado |

Esto se expresa en el `raise exception` de los RPC, que es donde el repositorio ya pone sus decisiones de autorización.

### Nombres de rol: el dominio ya existe, y no es el de `Organizations.jsx:17`

El vocabulario verificable es el enum `role` de `0001:60-68` menos los dos roles de plataforma, que viven en `user_roles` (`0001:32`, y `private.session_has_system_role` lee esa tabla en `0016:43-48`): `org_member`, `performer`, `substitute`, `instructor`, `branch_admin`, `org_admin`, `org_owner`, `event_coordinator`, `backstage_coordinator`.

Lo que el repositorio **escribe** hoy es una fracción: el seed inserta `org_owner` (`supabase/seed.sql:81`) y `org_member` (`:83`); `0016:177`, `0017:397` y `0020:73,84` evalúan `instructor`/`branch_admin`/`org_admin`/`org_owner`; y `authentication-and-profiles.feature:16,23` y `user-onboarding.feature:66` afirman `performer` y `org_member`. **No se inventan roles nuevos.** Lo que se agrega es el `CHECK` que ata ese vocabulario.

> `Organizations.jsx:22` tiene `member: 'Member'` en `ROLE_LABELS`, pero ese mapa es un `roleLabel(role) { return ROLE_LABELS[role] || role }`: la clave `member` nunca se alcanza, y el rol real `org_member` cae en el `||` y se renderiza crudo. Es un defecto de la pantalla, no del modelo, y no se propaga al esquema.

## Affected areas

| Área | Impacto | Descripción |
|---|---|---|
| `supabase/migrations/0037_identity_account_lifecycle.sql` | Nuevo | `profiles.account_status`, `profiles.created_at`, `CHECK` de rol, RPC `SECURITY DEFINER` de alta/baja/rol, `FORCE RLS`, grant ampliado de `profiles` |
| `0038_bands_as_organizations.sql` | Nuevo | `'Band'` en el `CHECK` de `org_type` (condicionado a D4) |
| `0039_education.sql` | Nuevo | Las 5 tablas de `odd/tasks/cemurm-education-audit.md` §E + familia RLS, siguiendo la convención de una migración por familia (`0018`, `0019`, `0023`) |
| `0040_inventory.sql` | Nuevo | `asset_types`, `assets` |
| `0041_asset_loans.sql` | Nuevo | `asset_loans` + índice único parcial sobre `returned_at is null` |
| `features/event-attendance.feature` | Nuevo | Primer BDD de asistencia. Hoy ningún feature menciona RSVP |
| `features/analytics-and-insights.feature` | **Modificado** | 23 escenarios, de personal a institucional. Reescritura, no adición |
| `features/*.feature` (identidad, bandas, inventario, préstamos) | Nuevo | BDD antes que código, sin excepción |
| `docs/mvp-scope.md:18` | Modificado | Los `education-*` dejan de decir *"await a scope decision"* y se asignan a Hito 8 |
| `docs/decisions.md` | Modificado | ADR-011 en adelante: D4, D5, D6. El registro va por tema, no por cronología |
| `supabase/functions/admin-accounts/` | Nuevo | La **primera** Edge Function de escritura del repo. Hoy hay una sola (`send-guardian-consent`) y CI corre `deno check` sobre ellas |
| `src/data/repositories/{identity,events,inventory,loans,education}.js` | Nuevo | El `data/` es la única frontera con Supabase (ADR-010) |
| `src/features/{identity,bands,events,inventory,loans,education}/` | Nuevo | Carpetas por feature, layout post-reubicación |
| `scripts/smoke/00{37..41}-*.sql` | Nuevo | Los smokes son manuales, con `expects N PASS`, y **requieren `supabase db reset` antes**: no son idempotentes |

## Verification — cómo se prueba esto

La verificación de JS es `pnpm test && pnpm typecheck && pnpm lint && pnpm build`. **Ninguna de esas cuatro pruebas toca la base de datos**, y para este change eso es insuficiente: casi todo el trabajo es SQL.

| Qué | Cómo | Por qué alcanza |
|---|---|---|
| Aislamiento entre organizaciones | Smoke SQL con `set_config('role', …, false)` y JWT fijo | Es el único modo del repo; los smokes usan UUID literales, nunca `gen_random_uuid()`, porque no cruza el cambio de rol |
| Los tres controles SOD | Smoke con el actor en el rol que debe fallar, esperando excepción | Un SOD que no se prueba es una intención |
| Fuga de escritura por `WITH CHECK` | Smoke que **intenta** insertar una fila belonging a otra org y espera rechazo | Una fuga de escritura es invisible a los tests de lectura. Este es el test que la atrapa |
| La lógica de XP y racha | `src/domain/education/` con `// @ts-check` | Vitest corre en `node` sin jsdom: **el JSX no se renderiza en tests**. Si la lógica vive en un hook o una página, llega sin red de regresión |
| `FORCE RLS` | Smoke que conecta como owner y confirma que ahora respeta la política | S1 no se puede verificar desde el cliente |

**Límite declarado:** `pnpm test` es una suite de caracterización sobre `src/domain/**` y `src/integrations/spotify.js`. Ninguna de las cuatro puertas ejecuta un `.feature`. **El BDD es verdad de producto que nada ejecuta hoy**, y eso no lo arregla este change.

## Rollback

Un contexto por migration group, y cada uno es reversible sin pérdida de datos:

- **C1** — revertir `0037`/`0038` deja las columnas fuera y el GRANT como estaba. `org_memberships` vuelve al estado de hoy: solo lectura más `leave_organization`, que sobrevive intacto porque `0037` no lo toca. El sistema funciona como antes. **No hay que deshacer las pertenencias que C1 creara**, porque las únicas filas que existían antes de este change son las del seed —salvo que alguien haya usado el botón "salir" de `Organizations.jsx:318-340`, que sí escribe `status='former'` y `left_at` desde antes de este change y que el rollback no toca, porque tampoco lo revierte.
- **C2** — `DROP TABLE` de las 5 tablas. Se pierde el progreso escrito, no el catálogo musical.
- **C3** — sin migración. Rollback es revertir el cliente.
- **C4** — `DROP TABLE` de las 3 tablas. Se pierden inventario y préstamos registrados.
- **S1 (`FORCE RLS`)** — es el único cambio cuyo rollback **reduce** seguridad. Si algo se rompe, el arreglo es la política, no quitar el `FORCE`. Por eso va solo en `0037` y con smoke propio.

## Frozen decisions

1. **Hito 6 no se toca.** Tiene seis features sin iniciar y es la puerta de beta con obligaciones de privacidad primero. Moverlo es otra propuesta.
2. **El orden por dependencia es C1 → {C2, C3, C4}.** No es una preferencia de arquitectura: los tres dependen de escribir en la organización.
3. **BDD antes que código, sin excepción.** Nueve de los once requisitos no tienen `.feature`. `AGENTS.md` es explícito: un ítem se implementa solo si su hito o su BDD lo requiere. Adoptar once requisitos sin escribir sus escenarios compra deuda desde el día uno.
4. **`education_work`, no `education_assignments`.** `service_assignments` ya significa *puesto de músico en un bloque de servicio*, y `service-planning.feature` tiene una sección `MUSICIAN ASSIGNMENT`. Cuando llegue una tabla `education_assignments`, el nombre significará dos cosas.
5. **Cero columnas nuevas en `songs`.** Su `UPDATE` está capado por columna desde `0020:104-106`; una columna nueva no es escribible por el cliente hasta que se amplíe esa lista literal de grant. La auditoría lo advierte y el precedente es `0020:96-103`.
6. **`docs/database-schema-v2.md` no se actualiza en este change.** Hace la misma afirmación obsoleta sobre el overlay que un change de seguridad previo decidió no tocar, y su §3.1 sigue siendo design target. Actualizarlo aquí convertiría un diff de seguridad en un documento de 900 líneas. **Reportado como deuda conocida, sin vincular a este change.**
7. **`user_roles` no crece.** `system_admin` y `community_moderator` son de plataforma. Un tercer vocabulario de roles sería peor que dos.
8. **Los smokes no son idempotentes.** Requerieren `supabase db reset` antes de cada corrida y hay que pasar `-v ON_ERROR_STOP=1`. Es la convención del repo (`odd/tasks/hito5-substitutions-and-coverage.md`), no un descuido.

## Open decisions — bloquean la primera migración

Estas son de producto. El engineering no las puede resolver.

### D1 — Consentimiento de menores para datos educativos **(bloqueante)**

`guardian_consents` (`0017:81`) tiene **un solo permiso sustantivo**: `public_sharing_approved`. Sin columna de alcance, sin finalidad, sin registro por propósito. **Un docente que lee el avance de un alumno menor no tiene ningún consentimiento que lo cubra.**

Con esta ampliación el progreso académico pasa a ser el dato más sensible de los once módulos, y los menores ya son fail-closed desde Hito 4. Sin resolver esto no se pueden escribir escenarios de menores sin inventar acuerdo sobre una pregunta abierta.

*Posición:* consentimiento versionado **por finalidad** antes de la primera migración de C2.

### D2 — Quién matricula y qué ve un administrador **(bloqueante)**

La auditoría describe las políticas como *"owner/instructor scoped"* sin resolver cuál owner, y `education-bdd.md` lo registra como pendiente: la matriculación se trata como precondición, no como flujo diseñado.

*Posición:* `org_admin` matricula; `branch_admin` sólo en su sede; el instructor ve **qué ejercicios terminó y cuándo**, y nada más — que es lo que los 46 escenarios ya afirman en la negativa.

### D3 — Qué es un evento

`events.type` está anotado en el propio esquema como *"NOT SETTLED BY THE FEATURES"* (`0001:243`), y el enum mezcla colaboración (`'mixed-group'`, `'sequence-only'`, `'full-program'`) con naturaleza de evento. **Un concierto no es "sequence-only".** Y `gigs`, `rehearsals` y `services` ya existen como entidades construidas.

*Posición:* `events` coordina y **no crea una cuarta entidad**; un evento apunta opcionalmente a un `gig`, `rehearsal` o `service`. Resolver antes del BDD de asistencia.

### D4 — Bandas: organización o entidad

| | A — organización con `org_type='Band'` | B — entidad `bands` propia |
|---|---|---|
| Tablas | 0 | 3 |
| Pertenencia | `org_memberships`, existe | `band_members`, duplicación |
| RLS | la de organizaciones | red nueva, sin precedente |

*Posición: A.* La auditoría rechazó 12 de 20 tablas propuestas como duplicación pura; `organizations` ya acepta `'Academy' | 'Church' | 'Orchestra'`. **Cambia si los alumnos tocan en bandas que no son de la misma institución.**

### D5 — Dónde entra esto en el calendario

*Posición:* Hito 6 intacto. **7** Identidad y organización → **8** Formación → **9** Eventos e inventario.

### D6 — Vocabulario

*Posición:* `education_work` como sustantivo de esquema. El título del feature y el verbo "assign" se quedan.

## References

Patrones consulted, para que un revisor pueda refutarlos:

- **Precedente interno** — `0002_rls_core.sql:26-30` (`private.session_role_in`) y `0016:360-430` (`promote_song_to_system`). La forma de autorizar organización ya existe en el repo.
- **PostgreSQL 18, §5.9 Row Security Policies** — `USING` gobierna qué filas se pueden ver o tocar; `WITH CHECK` gobierna qué filas se pueden escribir. Una política `INSERT` sin `WITH CHECK` es una fuga de escritura. Ninguna tabla como owner por defecto lo evita salvo `FORCE ROW LEVEL SECURITY`.
- **Open Policy Agent, security** — `default allow := false` como default explícito, y SOD como pares de roles que no pueden coexistir.
- **Casbin, RBAC with domains** — `r = sub, dom, obj, act`. El `dom` es la organización o la rama; CEMURM lo tiene implícito en `org_memberships` y le faltan `obj` y `act` explícitos.
- **ownCloud, admin_audit** — la auditoría registra el **contexto de grupo** del actor además de su id, porque el id solo no reconstruye qué organización actuó.
- **Nextcloud, threat model** — publicar el modelo de amenaza y los riesgos aceptados, en vez de dejarlos implícitos.

---

*Elaborado contra `main` = `a610dd0` el 13 de octubre de 2026. Cada afirmación lleva su evidencia en `supabase/migrations/`, `src/`, `features/` u `odd/tasks/`. Nada de este change está autorizado para implementación hasta que D1, D2 y D5 estén decididas.*