# CEMURM — Ampliación institucional: modelo de datos de C1–C4

**Estado:** especificación en revisión. **No aplicada.** Ninguna migración de este documento corrió.
**Base:** `main` = `a610dd0`, 34 migraciones (`0001`–`0036`, hueco deliberado en `0021`/`0022`).
**Change:** `openspec/changes/ampliar-alcance-institucional`
**Alcance:** las 9 tablas nuevas de C1–C4 y los 4 RPC de C1. C3 no necesita migración — ver §5.

> Este documento existe porque la propuesta **no** llevaba DDL. Las 3 tablas de inventario y préstamos estaban escritas como tabla de markdown, sin SQL, en un documento meant para client's eyes. Acá van con la convención del repo.

---

## 0. Convenciones que se respetan

Todo lo de abajo sigue lo que `0018_service_planning.sql` fija como contrato. No es estilo, es lo que hace que una migración se pueda auditar.

| Regla | Origen | Qué significa |
|---|---|---|
| **D6** orden por tabla | `0018:40-42` | `enable RLS` → `revoke all` → políticas → `grant` dirigido. Anon no recibe nada en ningún lado |
| **Contrato de recursión RLS** | `0002:136-141` | Una tabla hija resuelve el scope del padre por un `EXISTS` de una sola relación. El grafo de políticas debe ser acíclico |
| **Cores en `private`** | `0002:55` | `security definer`, `set search_path = ''`, referencias calificadas. El wrapper público en `public` solo delega, porque `db.schemas = ["public","graphql_public"]` y `private` no es alcanzable por PostgREST |
| **`private` bloqueado** | `0002:32-41` | `revoke execute from public, anon` + `alter default privileges … revoke execute from public, anon, authenticated` |
| **Literales exactos** | `0018:52-54` | Los mensajes al usuario son texto BDD literal, em-dash U+2014 included. El cliente mapea la cadena, no la interpreta |
| **Orden de guards** | `0018:459-460` | "no visible" primero, después "no autorizado". Never al revés: no se confirma existencia por el mensaje de error |

**Dos desviaciones deliberadas de ese contrato, y por qué:**

1. **`FORCE ROW LEVEL SECURITY`** (hallazgo S1). Ninguna de las 31 tablas con RLS del repo la tiene — `grep "force row level security" supabase/migrations/*.sql` no devuelve una fila — así que el owner bypasea las políticas. Este documento crea **nueve** tablas nuevas y **ocho** llevan `FORCE`. La excepción es `admin_audit_log`, y es una excepción que su propio diseño obliga, no una omisión: ver §3. Es un endurecimiento independiente de la ampliación que pudo haberse tomado antes y no se tomó — ver `proposal.md` §Approach.
2. **Auditoría de actor con contexto de grupo** (hallazgo S3). No existe en el repo. ownCloud registra el grupo del actor además de su id, porque el id solo no reconstruye *qué organización* actuó. La tabla `admin_audit_log` de §4 nace de eso.

---

## 1. C1 — Identidad y organización

### 1.1 Columnas nuevas en tablas existentes

```sql
-- profiles.status — 0006:29 creó profiles con cinco columnas y nada más.
-- "desactivar cuentas" (requerimiento #1) no tenía punto de anclaje hasta acá.
alter table public.profiles add column account_status text not null default 'active';
-- 'active' | 'suspended' | 'deactivated'
-- CHECK en §1.4, no aqui: los CHECK se agregan junto a las politicas.

alter table public.profiles add column created_at timestamptz not null default now();
-- Sin esto no hay forma de listar cuentas por fecha de alta ni de depurar.
```

`profiles` **no** gana columnas nuevas para roles. Los roles viven en `org_memberships.role`, que ya existe. Agregar una segunda lista sería el tercer sistema de roles del repo.

### 1.2 El CHECK que ata el vocabulario

`org_memberships.role` es `text` libre desde `0001:32` — el comentario de esa misma linea lo dice: *"enum in 2.2; system roles live on a join"*. La auditoría de Education lo registra en `odd/tasks/cemurm-education-audit.md:34` (*"Vocabulary is `org_owner`/`org_admin`/`branch_admin`/`instructor` — all `text`, no CHECK"*), y el vocabulario real es el que el repositorio ya escribe, no el que esa tabla resume.

```sql
alter table public.org_memberships
  add constraint org_memberships_role_check
  check (role in ('org_member','performer','substitute','instructor',
                  'branch_admin','org_admin','org_owner',
                  'event_coordinator','backstage_coordinator'));
```

**De dónde sale cada valor** — el enum `role` de `0001:60-68` declara once; este CHECK toma los **nueve** que son de organización o de persona dentro de ella:

| Valor | Evidencia |
|---|---|
| `org_owner` | `supabase/seed.sql:81` lo inserta; `0016:177`, `0017:397`, `0020:73,84` lo evalúan |
| `org_member` | `supabase/seed.sql:83` lo inserta; `authentication-and-profiles.feature:23` y `user-onboarding.feature:66` lo afirman |
| `instructor`, `branch_admin`, `org_admin` | `0016:177`, `0017:397`, `0020:73,84`; `Organizations.jsx:17` los lista en `ELEVATED_ROLES` |
| `performer` | `authentication-and-profiles.feature:16` lo afirma como rol por defecto de una cuenta personal |
| `substitute`, `event_coordinator`, `backstage_coordinator` | declarados en `0001:65-66` como roles de persona y de coordinación cruzada |

**Los dos que quedan fuera son `system_admin` y `community_moderator`, y no es una decisión de gusto:** `0001:32` dice que los roles de plataforma viven en una tabla aparte, y `private.session_has_system_role` (`0016:43-48`) lee `public.user_roles`, no `org_memberships`. Meterlos en el CHECK de esta tabla sería afirmar que una organización puede UNIFIED el rol que decide quién administra la plataforma.

**El `'member'` que estaba acá no existe en ninguna parte.** Ni el enum, ni el seed, ni un solo `.feature`. `Organizations.jsx:22` tiene `member: 'Member'` en `ROLE_LABELS`, pero ese mapa es un `roleLabel(role) { return ROLE_LABELS[role] || role }`: la clave `member` nunca se alcanza y el rol real, `org_member`, cae en el `||` y se renderiza crudo. **No se inventa un quinto vocabulario ni se propaga el typo de la UI al esquema.** El rótulo es un defecto de la pantalla, no del modelo, y se arregla con `Organizations.jsx:22`, no acá.

> **Consecuencia que obliga al resto del documento:** el `coalesce(p_role, 'member')` de §2.1 y el `p_role not in ('member', …)` de §2.3 escriben un valor que este CHECK rechaza. Se corrigen en §2.1 y §2.3.

`org_memberships` también gana un CHECK de branch coherence, porque su `UNIQUE(user_id, org_id, branch_id)` (`0001:36`) ya está defeated por NULLs:

```sql
-- Postgres trata NULLs como distintos en UNIQUE, asi que la misma persona puede
-- tener dos filas (user, org, NULL) — una por sede, sin restriccion. El CHECK no
-- arregla eso; lo hace NOT VALID y una particion por org_id. Ver §6, decision D7.
```

> **Pendiente y marcado como tal:** el `UNIQUE` con `branch_id` nullable es un defecto preexistente de `0001:36`. No lo introduce esta ampliación y **no se arregla acá**: cambiarlo es una migración sobre datos existentes de todos los org_memberships del seed. Queda registrado, no resuelto.

### 1.3 El CHECK de `organizations.org_type` (condicionado a D4)

```sql
alter table public.organizations
  add constraint organizations_org_type_check
  check (org_type is null or org_type in ('Academy', 'Church', 'Orchestra', 'Band'));
-- 'Band' es la adicion. Las otras tres ya estan en 0001:9 y las usan
-- features/organizational-repertoire-model.feature y el seed.
--
-- SOLO si D4 se resuelve como A (banda = organizacion). Si D4 elige entidad
-- propia, esta linea no se escribe y C1 pierde un requisito.
```

### 1.4 Tabla `admin_audit_log` — el hallazgo S3

```sql
-- S3: no existe registro de auditoria en el repo. Cinco migraciones mencionan
-- 'audit' en comentarios y ninguna tiene tabla. Esto no es solo para C1: es la
-- pieza que hace defendible cualquier decision de permisos hacia adelante.
--
-- actor_org_ids es el contexto de grupo, NO el id del actor solo. ownCloud hace
-- exactamente esto (OWNCLOUD_ADMIN_AUDIT_GROUPS) porque sin el grupo no se puede
-- reconstruir que organizacion actuo. Un id de usuario dice quien, no desde donde.
create table public.admin_audit_log (
  id             uuid primary key default gen_random_uuid(),
  actor_id       uuid references auth.users(id) on delete set null,
  actor_org_ids  uuid[] not null default '{}',
  action         text not null,
  subject_table  text not null,
  subject_id     uuid,
  detail         jsonb not null default '{}',
  created_at     timestamptz not null default now()
);
create index idx_admin_audit_created on public.admin_audit_log (created_at desc);
create index idx_admin_audit_subject on public.admin_audit_log (subject_table, subject_id);

-- append-only: no hay UPDATE ni DELETE policy en §1.5, y no hay columna de edicion.
-- Un log que se puede corregir no es un log.
```

`actor_id` es `ON DELETE SET NULL` y no `CASCADE`: borrar una cuenta no borra la evidencia de lo que hizo.

---

## 2. Los 4 RPC de C1

Esta es la parte que más importa, porque es la que **desbloquea** C2, C3 y C4. El molde es `promote_song_to_system` (`0016:360-430`): wrapper público delgado, core en `private`, y `session_role_in` revalidando `auth.uid()` internamente.

```sql
-- ═══════════════ 2.1 alta de miembro ═══════════════
-- Precedente: private.org_leave (0016:437-453), no org_promote_song. org_leave
-- es el molde porque es el UNICO camino de escritura que hoy existe sobre esta
-- tabla: core en private, wrapper publico delgado en public, `grant execute` a
-- authenticated, cableado al repositorio y con un boton vivo en la pantalla. Es
-- la forma correcta y ya esta probada por el propio repo.
--
-- NOTA SOBRE EL ESTADO ACTUAL, porque el change se apoya en el: org_memberships
-- no esta completamente sin escribir. `leave_organization` (0016:455-459) la
-- actualiza, y es lo unico que lo hace en las 34 migraciones. Lo que no existe
-- es alta, cambio de rol ni baja de terceros. Este §2 agrega las tres acciones
-- que faltan y no toca la cuarta.
--
-- POR QUE UN RPC Y NO UNA POLITICA INSERT: org_memberships no tiene politica
-- INSERT, ni grant, ni deberia tenerlos. La escritura organizacional pasa por
-- un punto unico que puede (a) revalidar el actor, (b) escribir la auditoria y
-- (c) negarse con un mensaje que el cliente mapea. Una politica INSERT no tiene
-- ningun sitio donde meter (b).
create or replace function private.org_add_member(
  p_org_id     uuid,
  p_user_id    uuid,
  p_branch_id  uuid,
  p_role       text
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_id    uuid;
begin
  -- guard 1: sesion. Primero, y por separado, para no confirmar nada sin sesion.
  if v_actor is null then
    raise exception 'You must be signed in.';
  end if;

  -- guard 2: autorizacion. El actor tiene que ser org_admin u org_owner de ESA
  -- organizacion. session_role_in (0002:26) ya revale user_id = auth.uid()
  -- internamente, asi que no se le cree al argumento.
  if not private.session_role_in(v_actor, p_org_id, array['org_admin','org_owner']) then
    raise exception 'Only an organization admin can add members.';
  end if;

  -- guard 3: la sede tiene que ser de ESA organizacion. Sin esto, un admin de la
  -- org A mete un branch_id de la org B y lee/escribe los members de B.
  if p_branch_id is not null and not exists (
    select 1 from public.branches b
    where b.id = p_branch_id and b.org_id = p_org_id and b.status = 'active'
  ) then
    raise exception 'Branch not found.';
  end if;

  -- guard 4: SOD. Quien solicita un ingreso no lo aprueba. El actor no puede
  -- agregarse a si mismo.
  if p_user_id = v_actor then
    raise exception 'An administrator cannot add their own membership.';
  end if;

  insert into public.org_memberships (user_id, org_id, branch_id, role, status)
  values (p_user_id, p_org_id, p_branch_id, coalesce(p_role, 'org_member'), 'active')
  returning id into v_id;

  insert into public.admin_audit_log (actor_id, actor_org_ids, action, subject_table, subject_id, detail)
  values (v_actor, array[p_org_id], 'member.add', 'org_memberships', v_id,
          jsonb_build_object('user_id', p_user_id, 'role', p_role, 'branch_id', p_branch_id));

  return v_id;
end $$;
```

```sql
-- ═══════════════ 2.2 baja de miembro ═══════════════
-- NO se borra la fila. org_memberships.status pasa a 'former' y se escribe
-- left_at. El status ya existe (0001:33, member_status) y ya tiene el valor
-- 'former' con el comentario "'former' members keep read-only history" —
-- la tabla fue disenada para esto y nunca se uso. La baja conserva historial;
-- borrar la fila perderia la evidencia de que esa persona estuvo ahi.
create or replace function private.org_remove_member(
  p_membership_id uuid
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor     uuid := (select auth.uid());
  v_org_id    uuid;
  v_user_id   uuid;
begin
  if v_actor is null then
    raise exception 'You must be signed in.';
  end if;

  select org_id, user_id into v_org_id, v_user_id
  from public.org_memberships where id = p_membership_id;
  if not found then
    raise exception 'Member not found.';
  end if;

  if not private.session_role_in(v_actor, v_org_id, array['org_admin','org_owner']) then
    raise exception 'Only an organization admin can remove members.';
  end if;

  update public.org_memberships
  set status = 'former', left_at = now()
  where id = p_membership_id;

  insert into public.admin_audit_log (actor_id, actor_org_ids, action, subject_table, subject_id, detail)
  values (v_actor, array[v_org_id], 'member.remove', 'org_memberships', p_membership_id,
          jsonb_build_object('user_id', v_user_id));
end $$;
```

```sql
-- ═══════════════ 2.3 cambio de rol ═══════════════
-- Guard 4 aqui es distinto y mas fuerte: nobody se degrada a si mismo. Un admin
-- que se quita su propio rol se queda sin poder de.Write, que deja la org sin
-- admins si era el ultimo. El rol de destino tiene que ser valido — el CHECK
-- de §1.2 lo cubre en la base, pero el mensaje de error de Postgres no es el
-- literal que el cliente mapea, asi que se valida antes para dar el string BDD.
create or replace function private.org_set_member_role(
  p_membership_id uuid,
  p_role          text
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor   uuid := (select auth.uid());
  v_org_id  uuid;
  v_user_id uuid;
  v_current text;
begin
  if v_actor is null then
    raise exception 'You must be signed in.';
  end if;

  select org_id, user_id, role into v_org_id, v_user_id, v_current
  from public.org_memberships where id = p_membership_id;
  if not found then
    raise exception 'Member not found.';
  end if;

  if not private.session_role_in(v_actor, v_org_id, array['org_admin','org_owner']) then
    raise exception 'Only an organization admin can change roles.';
  end if;

  -- Mismo vocabulario que el CHECK de 1.2, derivado del enum de 0001:60-68
  -- menos los dos roles de plataforma (que viven en user_roles). El RPC valida
  -- para devolver el literal BDD 'Unknown role.' y no el error del CHECK. Que un
  -- admin pueda asignar 'performer' o 'substitute' dentro de la org, y no solo
  -- los roles elevados, es pregunta de producto (D2); este documento no la
  -- acota ni la restringe por su cuenta.
  if p_role not in ('org_member','performer','substitute','instructor',
                    'branch_admin','org_admin','org_owner',
                    'event_coordinator','backstage_coordinator') then
    raise exception 'Unknown role.';
  end if;

  if p_user_id = v_actor and p_role <> v_current then
    raise exception 'An administrator cannot change their own role.';
  end if;

  update public.org_memberships set role = p_role where id = p_membership_id;

  insert into public.admin_audit_log (actor_id, actor_org_ids, action, subject_table, subject_id, detail)
  values (v_actor, array[v_org_id], 'member.role', 'org_memberships', p_membership_id,
          jsonb_build_object('user_id', v_user_id, 'from', v_current, 'to', p_role));
end $$;
```

```sql
-- ═══════════════ 2.4 estado de cuenta ═══════════════
-- SUSPENDER != DESACTIVAR, y la diferencia es operativa, no semantica:
--   suspended   -> la sesion sigue existiendo, el acceso se corta. Reversible.
--   deactivated -> la sesion no puede crearse. Requiere un email nuevo para volver.
-- Por eso account_status vive en profiles y NO es un valor de member_status:
-- member_status es 'active'|'former'|'pending' y organiza pertenencia, no cuenta.
create or replace function private.set_account_status(
  p_user_id uuid,
  p_status  text
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'You must be signed in.';
  end if;

  -- Solo system_admin. NO es una accion de org_admin: desactivar una cuenta es
  -- una decision de plataforma, no de organizacion. Y aqui no hay session_role_in
  -- porque la cuenta objetivo puede no pertenecer a ninguna organizacion.
  if not private.session_has_system_role('system_admin') then
    raise exception 'Only a system administrator can change account status.';
  end if;

  if p_status not in ('active','suspended','deactivated') then
    raise exception 'Unknown account status.';
  end if;

  if p_user_id = v_actor then
    raise exception 'An administrator cannot change their own account status.';
  end if;

  update public.profiles set account_status = p_status where id = p_user_id;
  if not found then
    raise exception 'Account not found.';
  end if;

  insert into public.admin_audit_log (actor_id, actor_org_ids, action, subject_table, subject_id, detail)
  values (v_actor, '{}', 'account.status', 'profiles', p_user_id,
          jsonb_build_object('to', p_status));
end $$;
```

### 2.5 Wrappers públicos y permisos de función

Los wrappers existen porque `supabase/config.toml` declara `db.schemas = ["public","graphql_public"]`: PostgREST no alcanza `private`. Mismo patrón que `promote_song_to_system`.

```sql
create or replace function public.org_add_member(p_org_id uuid, p_user_id uuid, p_branch_id uuid, p_role text)
returns uuid language sql security definer set search_path = '' as $$
  select private.org_add_member(p_org_id, p_user_id, p_branch_id, p_role);
$$;

create or replace function public.org_remove_member(p_membership_id uuid)
returns void language sql security definer set search_path = '' as $$
  select private.org_remove_member(p_membership_id);
$$;

create or replace function public.org_set_member_role(p_membership_id uuid, p_role text)
returns void language sql security definer set search_path = '' as $$
  select private.org_set_member_role(p_membership_id, p_role);
$$;

create or replace function public.set_account_status(p_user_id uuid, p_status text)
returns void language sql security definer set search_path = '' as $$
  select private.set_account_status(p_user_id, p_status);
$$;

-- R14 de la auditoría: los privilegios por defecto de `private` difieren entre
-- 0002:42 (revoca a public, anon, authenticated) y 0016:54 (solo public, anon).
-- GANA EL ULTIMO. Cada revoke de abajo tiene que listar los TRES.
revoke execute on function private.org_add_member(uuid,uuid,uuid,text)      from public, anon, authenticated;
revoke execute on function private.org_remove_member(uuid)                 from public, anon, authenticated;
revoke execute on function private.org_set_member_role(uuid,text)           from public, anon, authenticated;
revoke execute on function private.set_account_status(uuid,text)            from public, anon, authenticated;
revoke execute on function public.org_add_member(uuid,uuid,uuid,text)      from public, anon;
revoke execute on function public.org_remove_member(uuid)                 from public, anon;
revoke execute on function public.org_set_member_role(uuid,text)           from public, anon;
revoke execute on function public.set_account_status(uuid,text)            from public, anon;

grant execute on function private.org_add_member(uuid,uuid,uuid,text)      to authenticated;
grant execute on function private.org_remove_member(uuid)                 to authenticated;
grant execute on function private.org_set_member_role(uuid,text)           to authenticated;
grant execute on function private.set_account_status(uuid,text)            to authenticated;
grant execute on function public.org_add_member(uuid,uuid,uuid,text)      to authenticated;
grant execute on function public.org_remove_member(uuid)                 to authenticated;
grant execute on function public.org_set_member_role(uuid,text)           to authenticated;
grant execute on function public.set_account_status(uuid,text)            to authenticated;
```

---

## 3. RLS de C1

Orden D6. `org_memberships` **no recibe** política `INSERT`/`UPDATE`/`DELETE`: la escritura pasa por los RPC, y esa es la razón por la que el requerimiento #1 no es "una pantalla más". `leave_organization` (`0016:455-459`) sobrevive intacto —no es una política, es una función `SECURITY DEFINER` con su propio guard— y sigue siendo la única forma en que un miembro modifica una fila de esta tabla sin ser `0037`.

```sql
alter table public.org_memberships enable row level security;
alter table public.profiles enable row level security;
alter table public.admin_audit_log enable row level security;

-- S1: el owner bypasea RLS sin FORCE. Ninguna tabla existente del repo lo trae.
-- Estas ocho si. admin_audit_log NO: ver el bloque de abajo.
alter table public.org_memberships force row level security;
alter table public.profiles force row level security;

-- ═══ admin_audit_log NO lleva FORCE ROW LEVEL SECURITY, y esto es deliberado ═══
--
-- Las otras ocho lo llevan. Esta no puede, por una razon mecanica y no de gusto:
-- sus unicos escritores son los cuatro RPC SECURITY DEFINER de §2, que corren
-- con los privilegios del DUENIO de la funcion. Si la tabla lleva FORCE, el
-- owner tambien queda sujeto a RLS — y como no hay politica INSERT (la linea de
-- abajo explica por que no puede haberla), los cuatro RPC fallarian con
-- `42501 new row violates row-level security policy` al escribir su propia
-- auditoria. FORCE es exactamente lo que impide lo que el diseño pide.
--
-- La otra rama —darle politica INSERT— es peor, no mejor: cualquier politica
-- INSERT de esta tabla se traduce en "un authenticated autenticado puede
-- inyectar entradas de auditoria", y ningun predicado razonable lo evita sin
-- inventar una columna de credencial que la tabla no tiene.
--
-- QUE QUEDA DE LA DENEGA: el deny no viene de FORCE, viene de
--   revoke all on table public.admin_audit_log from public, anon, authenticated;
-- El cliente no tiene privilegio de tabla, asi que su INSERT muere en
-- `42501 permission denied for table admin_audit_log` ANTES de que RLS sea
-- consultado. La denegacion que importa —"el navegador no escribe el log"— la
-- da el revoke, no FORCE. Lo que FORCE compraria aqui es proteccion contra el
-- propio owner de la base, que es justo el actor que si debe escribir.
--
-- O sea: admin_audit_log queda con ENABLE, sin FORCE. El deny que importa lo
-- da la linea de revoke de abajo.

revoke all on table public.org_memberships from public, anon, authenticated;
revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.admin_audit_log from public, anon, authenticated;

-- ── org_memberships ──
-- Las tres SELECT de 0016:87-104 se dejan como estan. NO se anaden las de
-- escritura, y esa es la decision de diseño del change.
--
-- Para que un admin vea los miembros de SU sede y no de las demas, el SELECT
-- nuevo distingue branch_admin de org_admin. org_memberships_select_org_admin
-- (0016:92) no lo hace hoy — un branch_admin que pase por ahi ve todas las sedes.
drop policy if exists org_memberships_select_branch_admin on public.org_memberships;
create policy org_memberships_select_branch_admin on public.org_memberships
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and private.session_role_in((select auth.uid()), org_id, array['branch_admin'])
    and branch_id = any (select private.user_branch_ids((select auth.uid())))
  );

-- ── profiles ──
-- 0006:174-177 da SELECT capado a (id, username, display_name, avatar_url) para
-- que el buscador de miembros no exponga instrument ni el resto. Eso no cambia.
-- Lo que se agrega es el grant de UPDATE sobre account_status, para que
-- set_account_status (definer) pueda escribirlo. El grant es de authenticated,
-- pero la politica de abajo es la que decide quien llega.
drop policy if exists profiles_update_account_status on public.profiles;
create policy profiles_update_account_status on public.profiles
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and id <> (select auth.uid())
    and private.session_has_system_role('system_admin')
  )
  with check (
    (select auth.uid()) is not null
    and id <> (select auth.uid())
    and private.session_has_system_role('system_admin')
  );
```

> El `WITH CHECK` no es decorativo. `USING` gobierna la lectura; `WITH CHECK` gobierna la escritura (PostgreSQL 18 §5.9). Una política `UPDATE` sin `WITH CHECK` deja que un `system_admin` escriba `account_status = 'active'` sobre una fila y el `USING` de esa misma fila no se vuelve a evaluar. Se escribe una `WITH CHECK` que valida el estado **resultante**, no solo el actor.

```sql
-- ── admin_audit_log ──
-- SELECT: system_admin ve todo. Un org_admin ve lo que ocurrio dentro de su
-- organizacion — y por eso la politica usa actor_org_ids, no actor_id: el actor
-- puede tener membresias en varias org y el evento es de una en particular.
--
-- INSERT: no hay politica, y no puede haber una que sirva. Los unicos
-- escritores son los cuatro RPC SECURITY DEFINER de §2, que corren como owner.
-- Una politica INSERT para authenticated permitiria que cualquiera autenticado
-- fabricase entradas — y no existe predicado que distinga "el RPC legitimo" de
-- "el cliente", porque los dos llegan con el mismo rol de sesion. El deny lo
-- pone el `revoke all … from authenticated` de §3, que corta el INSERT por
-- privilegio de tabla antes de que RLS sea consultado. Por eso esta tabla es
-- la unica de las nueve que NO lleva FORCE: ver el bloque de arriba.
-- UPDATE / DELETE: no hay politica. Append-only, y no negociable.
drop policy if exists admin_audit_log_select_system on public.admin_audit_log;
create policy admin_audit_log_select_system on public.admin_audit_log
  for select to authenticated
  using ((select auth.uid()) is not null and private.session_has_system_role('system_admin'));

drop policy if exists admin_audit_log_select_org_admin on public.admin_audit_log;
create policy admin_audit_log_select_org_admin on public.admin_audit_log
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and private.session_role_in((select auth.uid()), actor_org_ids[1], array['org_admin','org_owner'])
  );
```

### Grants de C1

```sql
-- profiles: el SELECT capado de 0006:174 NO se toca. Se AMPLIA el UPDATE con
-- account_status. Grant por columna, no por tabla — el precedente es 0006:176 y
-- 0007:192 lo documenta: una columna-caped update grant es exactamente el set
-- mutable que el cliente escribe.
grant select (id, username, display_name, avatar_url) on table public.profiles to authenticated;
grant update (account_status) on table public.profiles to authenticated;

-- org_memberships: sigue siendo SELECT. Un grant insert/update seria permitir
-- la escritura que los RPC controlan, por la puerta de atrás.
--
-- Y esto no cierra la escritura: `leave_organization` la hace hoy sin ningun
-- grant de tabla, porque un SECURITY DEFINER corre con los privilegios de su
-- dueno y no con los de `authenticated`. Por eso el deny de esta tabla nunca
-- estuvo en el grant sino en la ausencia de la politica — y por eso quitarle el
-- grant a `authenticated` no le quita nada a `leave_organization`.
grant select on table public.org_memberships to authenticated;

grant select on table public.admin_audit_log to authenticated;
```

---

## 4. C2 — Formación (5 tablas)

Diseño de `odd/tasks/cemurm-education-audit.md` §E. **Es el diseño que ya está auditado**; acá va el DDL que faltaba.

```sql
-- ═══════════════ 4.1 courses ═══════════════
-- org_id es LA frontera de aislamiento. education_courses es la primera tabla
-- donde "una organización" es un límite de lectura y no un adorno: sin esta tabla
-- no hay nada que pueda pertenecer a un curso.
create table public.education_courses (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete set null,
  title       text not null,
  instrument  text,
  status      text not null default 'draft',   -- 'draft' | 'published' | 'archived'
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint education_courses_status_check
    check (status in ('draft','published','archived'))
);
create index idx_education_courses_org on public.education_courses (org_id, status);
```

```sql
-- ═══════════════ 4.2 exercises ═══════════════
-- NO hay units ni lessons. position es plano y ordered. La auditoría (§C) rechaza
-- la jerarquia: education-courses-and-exercises.feature afirma positively que no
-- hay un nivel unit/lesson que abrir, asi que la jerarquia no se puede colar.
--
-- anchor jsonb es {section, index}, copiado verbatim de shared_comments.anchor
-- (0001). El idioma ya existe en el repo.
--
-- R9: los anchors de seccion son name-keyed y fragiles — renombrar una seccion
-- deja huerfano cada anchor sin error. Es una limitacion del formato que hereda,
-- no una de esta tabla.
create table public.education_exercises (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.education_courses(id) on delete cascade,
  title         text not null,
  instructions  text,
  target_song_id    uuid references public.songs(id) on delete set null,
  target_version_id uuid references public.song_versions(id) on delete set null,
  anchor        jsonb,
  position      integer not null,
  est_minutes   integer,
  created_at    timestamptz not null default now(),
  constraint education_exercises_position_unique unique (course_id, position)
);
create index idx_education_exercises_course on public.education_exercises (course_id, position);
```

```sql
-- ═══════════════ 4.3 enrollments ═══════════════
-- DELIBERADAMENTE no tiene la forma de org_memberships. El UNIQUE(user_id, org_id,
-- branch_id) de 0001:36 esta defeated por branch_id NULL — Postgres trata los
-- NULLs como distintos, asi que el mismo (user, org) puede aparecer N veces con
-- branch_id NULL. Aca el UNIQUE es (course_id, user_id), ambas partes NOT NULL.
--
-- role es POR CURSO, no un rol de organizacion. Un alumni puede ser 'instructor'
-- en un curso y 'student' en otro. Es lo que el feature escribe: 'Lucia is
-- enrolled in the course "Guitar Fundamentals"'.
create table public.education_enrollments (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.education_courses(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'student',   -- 'student' | 'instructor'
  status     text not null default 'active',   -- 'active' | 'completed' | 'withdrawn'
  enrolled_at timestamptz not null default now(),
  constraint education_enrollments_unique unique (course_id, user_id),
  constraint education_enrollments_role_check  check (role in ('student','instructor')),
  constraint education_enrollments_status_check check (status in ('active','completed','withdrawn'))
);
create index idx_education_enrollments_user on public.education_enrollments (user_id, status);
```

```sql
-- ═══════════════ 4.4 progress ═══════════════
-- UNA fila por clave (exercise, user). Single-writer-per-key, asi que
-- last-write-wins es seguro — y eso es lo que la hace segura OFFLINE: la cola
-- offline del repo (src/offline/drainer.js) no tiene idempotencia (R7) y replay
-- no seria un problema si la operacion fuera idempotente por clave.
--
-- Es rehearsal_items (outcome, run_count, notes, carry_over_to) generalizado de
-- ensayo a ejercicio, con la mitad de asignacion doblada en columnas. La
-- auditoria (§C) rechazo crear una tabla de asignaciones propia por esto.
--
-- CUATRO estados, no cinco. education-student-progress.feature:15 los enumera
-- textualmente — "Completed", "In progress", "Locked", "Pending" — y :10-17 es
-- el escenario que se llama justamente "Every exercise on the path shows one of
-- four states". La pantalla esta construida sobre los mismos cuatro:
-- wireframes.md §6.3 ("the four-state surface"), con su tabla de color, peso e
-- icono. Un quinto valor no tendria donde verse.
--
-- 'assigned' estaba de mas y se cae: no tiene escenario, ni etiqueta, ni
-- columna de estado en §6.3, ni transicion que lo produzca. Lo que una
-- entrega del docente significa es una fila con assigned_by/assigned_at y
-- status 'pending' —Pending en la ruta del alumno—, que es exactamente lo que
-- escribe education_progress_insert_assignment en §4.6.
create table public.education_progress (
  exercise_id  uuid not null references public.education_exercises(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending',
    -- 'pending' | 'in_progress' | 'locked' | 'completed'
  score        numeric,
  attempts     integer not null default 0,
  completed_at timestamptz,
  notes        text,          -- privado del alumno: no esta en el grant select, asi que ni el docente ni la org lo leen
  assigned_by  uuid references auth.users(id),
  assigned_at  timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (exercise_id, user_id),
  constraint education_progress_status_check
    check (status in ('pending','in_progress','locked','completed'))
);
create index idx_education_progress_user on public.education_progress (user_id, status);
```

```sql
-- ═══════════════ 4.5 education_events — el ledger ═══════════════
-- POR QUE UN LEDGER Y NO UN CONTADOR: XP total, nivel y racha son sum /
-- count(distinct date) sobre esta tabla. La SUMA ES CONMUTATIVA, asi que dos
-- dispositivos desconectados convergen sin coordinacion. Es lo unico que la cola
-- offline actual maneja bien — y lo unico, porque el contador no lo haria.
--
-- client_uuid es LA clave de idempotencia (R7). Sin UNIQUE, un replay de la cola
-- paga dos veces; con UNIQUE + on conflict do nothing del lado servidor, el
-- replay es un no-op. R7 dice que hoy ningun op es idempotente "por casualidad".
--
-- Append-only. No hay UPDATE ni DELETE policy en §4.6.
create table public.education_events (
  client_uuid  uuid primary key,       -- device-generated idempotency key
  user_id      uuid not null references auth.users(id) on delete cascade,
  delta        integer not null,
  reason       text not null,
    -- 'exercise_completed' | 'exercise_reopened' | 'daily_goal_met' | 'streak_bonus'
  course_id    uuid references public.education_courses(id) on delete cascade,
  source_id    uuid,
  created_at   timestamptz not null default now(),
  constraint education_events_reason_check
    check (reason in ('exercise_completed','exercise_reopened','daily_goal_met','streak_bonus'))
);
create index idx_education_events_user on public.education_events (user_id, created_at desc);
```

```sql
-- Derivaciones PURAS: reciben p_user_id y no saben quien las llama. Todo lo que
-- sabe quien pregunta esta en el wrapper de mas abajo, no aca.
--
-- VIVEN EN `private` POR DOS MOTIVOS, y los dos se comprueban con comandos de
-- solo lectura —la config, el historial y el catalogo del sistema—, sin aplicar
-- nada:
--
--   1. supabase/config.toml:13 declara `schemas = ["public","graphql_public"]`.
--      PostgREST resuelve `/rest/v1/rpc/...` solo contra los schemas que expone,
--      de modo que una funcion en `private` NO es invocable desde el cliente,
--      por mucha ejecucion que tenga. Este es el motivo que decide.
--   2. Los privilegios por defecto de `private` no son de fiar. Las dos unicas
--      sentencias que los tocan se contradicen entre si — 0002:42 revoca de
--      public, anon, authenticated; 0016:54 solo de public, anon — y en la base
--      local no hay NINGUNA entrada de pg_default_acl para el schema `private`
--      (consulta de solo lectura en el bloque de wrappers). El default no
--      decide nada, asi que la exposicion es la de §2.5: wrapper en `public`,
--      revoke de los tres, grant a authenticated, escrito funcion por funcion.
--
-- CORRECCION AL PROPOSITO QUE AFIRMABA ESTE BLOQUE. Antes decia que eran
-- SECURITY DEFINER "porque leen la tabla del alumno a nombre del docente". Es
-- falso, y el BDD cierra esa puerta: teaching-assignments.feature:105-108 dice
-- que Lucia "has practice sessions, a streak, an XP total, and a daily goal of
-- her own" y que Pedro "does not see her practice sessions, their durations,
-- her streak, her XP, or her daily goal"; student-progress.feature:159-163
-- remata que "no other member of the organization can open any of them". No hay
-- un solo escenario que le entregue XP o racha a un tercero, y menos a un
-- docente. La lectura es de la alumna y solo de la alumna — y por eso el
-- wrapper de mas abajo NO recibe p_user_id: lo toma de auth.uid(). Un parametro
-- de usuario en la superficie publica seria justo el agujero que el BDD cierra.
create or replace function private.education_xp_total(p_user_id uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum(delta), 0)::bigint from public.education_events where user_id = p_user_id;
$$;

-- UNA RACHA ES UNA SECUENCIA CONSECUTIVA. La version anterior de esta funcion
-- contaba `count(distinct created_at::date)` dentro de una ventana de 30 dias:
-- eso responde "cuantos dias activo", que es otra pregunta, y el BDD la
-- distingue. Tres escenarios la acotan:
--   :88-92   con 3 dias de racha, completar hoy la deja en 4
--   :101-106 un dia entero sin hacer nada: al volver y completar, la racha
--            vuelve a 1 — no a 4, que es lo que daria el conteo en ventana
--   :108-112 la actividad cuenta para el dia calendario de Lucia, no el del
--            servidor
--
-- EL ALGORITMO: restarle el numero de fila al dia agrupa en un mismo grupo
-- exactamente los dias que se tocan, y un hueco abre un grupo nuevo. La racha
-- es el largo del grupo que contiene el dia mas reciente, y es 0 si ese dia es
-- anterior a ayer — una racha rota no se repara sola por mirar. Esta derivacion
-- se verifico contra los ocho casos que fijan los escenarios de arriba
-- (incluido el dia offline de :149-153) antes de escribirse.
--
-- EL DIA ES DE LA ALUMNA, no del servidor, y Postgres no lo sabe: `current_date`
-- y el `::date` de un timestamptz dependen del `TimeZone` de la sesion, que en
-- PostgREST es UTC salvo que el cliente lo fije. Por eso la zona entra como
-- parametro y la pasa el cliente; con null se usa la de la sesion, que es el
-- mejor defecto disponible cuando no se pasa nada.
--
-- No se filtra por `reason`: cualquier evento marca su dia como activo. El BDD
-- solo afirma que un evento cuenta (:88-92) y que ABRIR LA APLICACION no cuenta
-- (:81-86) — y abrir la aplicacion no produce evento, asi que la derivacion ya
-- cumple las dos sin necesitar un filtro que el BDD no describe.
create or replace function private.education_streak(p_user_id uuid, p_tz text default null)
returns integer language sql stable security definer set search_path = '' as $$
  with days as (
    select distinct (e.created_at at time zone coalesce(p_tz, current_setting('TimeZone')))::date as d
    from public.education_events e
    where e.user_id = p_user_id
  ),
  runs as (
    select d, d - (row_number() over (order by d))::int as run_id
    from days
  )
  select case
    when (select max(d) from days)
         >= ((now() at time zone coalesce(p_tz, current_setting('TimeZone')))::date - 1)
      then (select count(*)::int
            from runs
            where run_id = (select run_id from runs order by d desc limit 1))
    else 0
  end;
$$;
```

### RLS de C2 — la parte difícil

```sql
alter table public.education_courses    enable row level security;
alter table public.education_exercises enable row level security;
alter table public.education_enrollments enable row level security;
alter table public.education_progress   enable row level security;
alter table public.education_events     enable row level security;

alter table public.education_courses    force row level security;
alter table public.education_exercises force row level security;
alter table public.education_enrollments force row level security;
alter table public.education_progress   force row level security;
alter table public.education_events     force row level security;

revoke all on table public.education_courses    from public, anon, authenticated;
revoke all on table public.education_exercises from public, anon, authenticated;
revoke all on table public.education_enrollments from public, anon, authenticated;
revoke all on table public.education_progress   from public, anon, authenticated;
revoke all on table public.education_events     from public, anon, authenticated;

-- courses: visible para miembros de la org. Escriben org_admin/org_owner.
-- `is_org_member` devuelve TEXT (0002:14) porque su NULL es el "no es miembro";
-- las 22 llamadas que ya existen en el repo lo convierten con `is not null`
-- (0016:73, 0018:112, 0019:238, 0034:196, 0035:47 …). Sin eso, `boolean and text`
-- no resuelve y el CREATE POLICY falla en el momento de crearse.
--
-- Y el filtro de status NO es opcional: sin el, un curso en 'draft' es visible
-- para todo miembro de la org. education-courses-and-exercises.feature:18-24
-- afirma lo contrario —"A course stays a draft until the instructor publishes
-- it" — y :21-22 dice que el alumno la ve solo despues de que Pedro publica.
-- El patron de esta politica es el mismo de songs_select_org (0016:129-134):
-- la pertenencia da el alcance y una columna mas da el filtro.
drop policy if exists education_courses_select_member on public.education_courses;
create policy education_courses_select_member on public.education_courses
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and private.is_org_member((select auth.uid()), org_id) is not null
    and (status <> 'draft'
         or created_by = (select auth.uid())
         or private.session_role_in((select auth.uid()), org_id,
                                    array['instructor','branch_admin','org_admin','org_owner']))
  );

-- courses: ESCRIBEN los cuatro roles de planta, no dos. La politica anterior
-- aceptaba solo org_admin/org_owner y los 26 escenarios de autoria los lleva
-- Pedro, que es instructor: `Given instructor "Pedro" belongs to "Academia
-- Musical"` (courses-and-exercises.feature:11). El es quien crea el curso (:14),
-- lo publica (:23), mueve un ejercicio de posicion (:46), le apunta una
-- cancion (:57), le escribe instrucciones (:101) y lo quita (:108). Con la
-- lista de dos, esos seis escenarios no tienen quien los ejecute.
--
-- El rol que NO entra es el quinto: un member de la org —Lucia— no escribe.
-- Y la negativa de organization-crossover se sostiene sola, porque
-- session_role_in (0002:26-30) exige status='active' en ESA org: el instructor
-- de "Orquesta Ciudad Norte" es miembro de otra org y no pasa
-- (courses-and-exercises.feature:26-30).
drop policy if exists education_courses_write_admin on public.education_courses;
drop policy if exists education_courses_write_staff on public.education_courses;
create policy education_courses_write_staff on public.education_courses
  for all to authenticated
  using ((select auth.uid()) is not null and private.session_role_in((select auth.uid()), org_id, array['instructor','branch_admin','org_admin','org_owner']))
  with check ((select auth.uid()) is not null and private.session_role_in((select auth.uid()), org_id, array['instructor','branch_admin','org_admin','org_owner']));
```

> **El grafo de políticas tiene que ser acíclico** (`0002:136-141`). `education_courses` resuelve su scope por `org_memberships` vía los helpers de `private`. `education_exercises` resuelve por `education_courses`. `education_progress` resuelve por `education_exercises`. Cada uno mira **hacia arriba** y ninguno hacia abajo. Si una política de `courses` llegara a tocar `progress`, el grafo cierra y Postgres devuelve `42P17` en tiempo de plan, no en desarrollo.

```sql
-- exercises: la visibilidad se hereda del curso. UNA sola relacion (0002:136-141).
--
-- Y tambien la escritura, que antes no existia: `education_exercises` solo
-- tenia politica SELECT, asi que los cinco escenarios en los que Pedro anade,
-- reordena o quita un ejercicio no tenian por donde pasar
-- (courses-and-exercises.feature:46, 57, 101, 108). El scope se resuelve por el
-- curso —una sola relacion hacia arriba, el patron de 0002:136-141— y el actor
-- tiene que ser instructor o superior DE ESA organizacion, no de la suya.
--courses-and-exercises.feature:83-88 exige que solo le ofrezcan las canciones
-- que la org ya alcanza; el mismo predicado lo da.
drop policy if exists education_exercises_select_member on public.education_exercises;
create policy education_exercises_select_member on public.education_exercises
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (select 1 from public.education_courses c
                where c.id = course_id
                  and private.is_org_member((select auth.uid()), c.org_id) is not null)
  );

drop policy if exists education_exercises_write_staff on public.education_exercises;
create policy education_exercises_write_staff on public.education_exercises
  for all to authenticated
  using (
    (select auth.uid()) is not null
    and exists (select 1 from public.education_courses c
                where c.id = course_id
                  and private.session_role_in((select auth.uid()), c.org_id,
                                              array['instructor','branch_admin','org_admin','org_owner']))
  )
  with check (
    (select auth.uid()) is not null
    and exists (select 1 from public.education_courses c
                where c.id = course_id
                  and private.session_role_in((select auth.uid()), c.org_id,
                                              array['instructor','branch_admin','org_admin','org_owner']))
  );

-- enrollments: el alumno ve los suyos; el staff de la org ve los de sus cursos.
drop policy if exists education_enrollments_select_own on public.education_enrollments;
create policy education_enrollments_select_own on public.education_enrollments
  for select to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists education_enrollments_select_staff on public.education_enrollments;
create policy education_enrollments_select_staff on public.education_enrollments
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.education_courses c
      join public.org_memberships m on m.org_id = c.org_id and m.user_id = (select auth.uid())
      where c.id = course_id
        and m.status = 'active'
        and m.role in ('instructor','branch_admin','org_admin','org_owner')
    )
  );
```

```sql
-- progress: aqui vive D2, y es la politica mas importante de C2.
--
-- EL ALUMNO: ve y escribe su propia fila.
-- EL DOCENTE: ve status y completed_at de los alumnos de SUS cursos. Y nada mas.
-- No ve notes, no ve score si la politica no lo dice explicitamente, no ve
-- attempts. Y education-teaching-assignments.feature afirma esto en la negativa
-- ("does not see practice sessions, durations, streak, XP, daily goal, or the
-- student's private notes"), asi que el limite va en la politica y no en la UI.
--
-- LO QUE DE ABAJO SE CORRIGIO. Este bloque tenia DOS politicas —una de INSERT y
-- una de DELETE— y ninguna de SELECT ni de UPDATE, mientras el `grant` de la
-- seccion de permisos daba `select, insert, update, delete` sobre la tabla
-- entera. Con `force row level security` el resultado es el peor posible: la
-- fila pasa el permiso de tabla, no hay politica que la examine, y TODO SELECT y
-- TODO UPDATE mueren con `42501 new row violates row-level security policy`. Es
-- un fallo silencioso —el cliente no ve filas y no ve ningun error de RLS que lo
-- explique—. De ahi las cuatro de abajo: SELECT del alumno, SELECT del docente,
-- UPDATE del alumno, y los INSERT/DELETE que ya estaban.
--
-- MECANISMO DEL CAP, y es el punto delicado del bloque. En Postgres la POLITICA
-- decide la FILA y el PRIVILEGIO decide la COLUMNA: son dos filtros
-- independientes y ninguno sustituye al otro. Por eso el grant de SELECT de mas
-- abajo esta capado a seis columnas y `notes`, `score` y `attempts` NO estan en
-- la lista. Lo que el docente puede ver de una fila que su politica ya admitio
-- lo decide el grant, no el USING.
--
-- Y `notes` no vuelve a entrar por la puerta de atras: es la unica columna que
-- la alumna lee de su propia fila y que el docente no debe ver jamas
-- (teaching-assignments.feature:110-115, "A student's private note on an
-- exercise stays private" — "he does not see Lucia's note"). La fila entera de la
-- alumna, `notes` incluida, sale del wrapper `public.education_my_progress()`,
-- que proyecta desde un SECURITY DEFINER. Un grant de columna no puede servir a
-- los dos lectores porque Postgres NO TIENE GRANTS POR ROL: `authenticated` es
-- un unico rol para Lucia y para Pedro. O las dos lecturas salen del mismo juego
-- de columnas, o una de las dos sale de un wrapper. Por eso hay wrapper y no
-- solo grant.
-- ASIGNAR TRABAJO es la otra mitad de los 26 escenarios, y sin esta politica
-- Pedro no tiene por donde entregarlo. teaching-assignments.feature:27-32
-- ("An instructor gives one exercise to one student") y :34-39 ("Work given to
-- a student is offered even when earlier exercises are not done") se ejecutan
-- con un INSERT sobre la fila de Lucia, no sobre una tabla de asignaciones:
-- el modelo dobla la asignacion en `assigned_by`/`assigned_at` de §4.4.
--
-- TRES restricciones, cada una atada a un escenario:
--   assigned_by = auth.uid()  -> el docente ve SU propio reparto, :32.
--   status = 'pending'        -> el trabajo entregado entra como Pendiente, que
--                                 es uno de los cuatro estados de :15.
--   el alumno esta matriculado -> :41-46 ("Work can only be given to a student
--                                 in that course"): Sofia no esta en el curso y
--                                 el INSERT no tiene por donde pasar, asi que
--                                 el rechazo cae en la base y no en la UI.
-- El alcance del docente es el de su organizacion: el mismo session_role_in de
-- arriba, que es lo que hace que el instructor de "Orquesta Ciudad Norte" quede
-- afuera (:48-53). Y el grafo sigue mirando hacia arriba —progress mira
-- exercises y enrollments, los dos miran courses, ninguno mira a progress—.
--
-- ── SELECT del alumno ──
-- Su propia fila y solo la suya. El alcance de columna lo pone el grant, no
-- esta politica: aqui solo se responde "de que filas puede enterarse".
drop policy if exists education_progress_select_own on public.education_progress;
create policy education_progress_select_own on public.education_progress
  for select to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

-- ── SELECT del docente ──
-- FILAS de cursos donde es instructor o superior DE SU organizacion. El
-- session_role_in es lo que deja afuera al instructor de "Orquesta Ciudad Norte"
-- sin que el curso se revele (:48-53), y el grafo sigue mirando hacia arriba:
-- progress mira exercises y courses, ninguno mira a progress.
--
-- Esta politica NO es la que protege `notes`. No puede: `notes` no es una fila,
-- es una columna, y una politica de RLS no sabe de columnas. Lo que la protege es
-- que `notes` no este en el `grant select (...)` de mas abajo — consultarla da
-- `42501 permission denied for column notes`, no un NULL. Las dos mitades hacen
-- falta: la politica elige las filas, el grant elige las columnas, y quitar
-- cualquiera de las dos abre el escenario de :110-115.
--
-- "cual de mis alumnos no ha empezado el curso" NO sale de aqui: sale de
-- education_enrollments_select_staff cruzado con estas filas en el cliente. Una
-- tabla de progreso no tiene fila para el alumno que no empezo, y
-- teaching-assignments.feature:89 lo pide como afirmacion del cliente, no como
-- fila.
--
-- El alcance es del CURSO, no de la entrega: el docente ve tambien lo que otro
-- instructor del mismo curso entrego. El BDD no distingue el caso y la
-- coherencia con education_enrollments_select_staff manda.
drop policy if exists education_progress_select_staff on public.education_progress;
create policy education_progress_select_staff on public.education_progress
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.education_exercises e
      join public.education_courses c on c.id = e.course_id
      where e.id = exercise_id
        and private.session_role_in((select auth.uid()), c.org_id,
                                    array['instructor','branch_admin','org_admin','org_owner'])
    )
  );

drop policy if exists education_progress_insert_assignment on public.education_progress;
create policy education_progress_insert_assignment on public.education_progress
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and assigned_by = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1
      from public.education_exercises e
      join public.education_courses c on c.id = e.course_id
      join public.education_enrollments n
        on n.course_id = c.id and n.user_id = education_progress.user_id
      where e.id = exercise_id
        and n.status = 'active'
        and private.session_role_in((select auth.uid()), c.org_id,
                                    array['instructor','branch_admin','org_admin','org_owner'])
    )
  );

-- RETIRAR TRABAJO (teaching-assignments.feature:55-60) queda a medias y hay que
-- decirlo: el DELETE de abajo resuelve la primera mitad —:59, "it is no longer
-- on Lucia's learning path as work to do"— y NO la segunda —:60, "Pedro's record
-- of what he handed out shows it as withdrawn". education_progress no tiene
-- campo withdrawn: su status es uno de los cuatro estados que el BDD prohibe
-- ampliar (student-progress.feature:15), y borrando la fila no queda rastro de
-- que Pedro la entrego. Cerrar :60 pide una columna `withdrawn_at`/`withdrawn_by`
-- aca, o la tabla `education_work` que D6 ya nombra para exactamente esto.
-- No resuelto, y no se resuelve con una politica.
--
-- ── UPDATE del alumno ──
-- Es la cuarta politica que faltaba. Los cuatro casos de escritura que el BDD
-- produce estan aqui y en ningun otro lado:
--   student-progress.feature:41-45  abrir un ejercicio lo deja 'in_progress' y
--                                   sigue asi otro dia;
--   :19-26 y :66-71                  completarlo graba status y completed_at;
--   :47-51                           rehacerlo conserva la fecha original y suma
--                                   un intento;
--   teaching-assignments.feature:111 la alumna escribe su nota privada.
--
-- Lo que la alumna NO puede mover no lo decide esta politica sino el grant por
-- columnas de mas abajo: `assigned_by`/`assigned_at` quedan afuera porque la
-- asignacion la escribe el docente (education_progress_insert_assignment, dos
-- parrafos arriba) y nadie se fabrica su propia entrega, y `score` queda afuera
-- porque ningun escenario de features/ lo produce — si alguno lo produce, se
-- agrega ahi, no se afloja el grant.
drop policy if exists education_progress_update_own on public.education_progress;
create policy education_progress_update_own on public.education_progress
  for update to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists education_progress_delete_own_assignment on public.education_progress;
create policy education_progress_delete_own_assignment on public.education_progress
  for delete to authenticated
  using (
    (select auth.uid()) is not null
    and assigned_by = (select auth.uid())
    and status = 'pending'
  );

-- ═══════════════ GRANTS de education_progress ═══════════════
-- El `revoke all on table … from public, anon, authenticated` del bloque de RLS
-- dejo a `authenticated` sin privilegio de tabla, y sin privilegio NINGUNA
-- politica es alcanzable: el fallo es `42501 permission denied for table`, y
-- sale ANTES de que RLS se consulte. Estos son los permisos minimos que hacen
-- alcanzables las cinco politicas de arriba (orden D6: revokes, politicas,
-- grants).
--
-- SELECT VA POR COLUMNAS, Y ES EL CORAZON DEL BLOQUE. Dos motivos:
--   · lo que el BDD le da al docente es "which exercises she completed and when"
--     (:107) y "that he gave it to Lucia and when" (:32) — exercise_id, user_id,
--     status, completed_at, assigned_by, assigned_at. Ni `notes` (:111-115), ni
--     `score`, ni `attempts` (la negativa de :108).
--   · `authenticated` es UN SOLO ROL para Lucia y para Pedro, asi que no existe
--     un privilegio que le conceda a uno mas que al otro. El cap de columnas es
--     lo que hace que education_progress_select_staff no pueda abrir `notes`.
-- `notes` vuelve a ser legible para la alumna por el wrapper
-- public.education_my_progress(), que proyecta la fila entera desde un
-- SECURITY DEFINER. Esa es la unica salida cuando el mismo rol tiene que ver
-- cosas distintas.
--
-- NO substitutes esto por `grant select on table public.education_progress`:
-- reabre `notes` para todo `authenticated` que pase la politica, que es
-- exactamente lo que :110-115 prohibe, y el error es invisible porque el
-- `RETURNING` del cliente tampoco lo pide.
--
-- UPDATE tambien va por columna por la misma razon: la alumna escribe su
-- estado, sus intentos, su fecha y su nota, y nada mas.
--
-- INSERT conserva la fila entera a proposito — su politica ya exige
-- `assigned_by = auth.uid()`, `status = 'pending'` y que la alumna este
-- matriculada — y DELETE tambien, aunque su predicado es estrecho: solo el
-- docente que entrego, y solo mientras siga 'pending'. El unico sombreado que
-- queda es que un docente puede escribir `notes` en la fila del alumno: no puede
-- leerla despues y ningun escenario del BDD cubre que lo intente. Si
-- apareciera, la respuesta es `grant insert (...)` por columnas o un wrapper
-- public.education_assign_exercise(...), no una politica mas.
grant select (exercise_id, user_id, status, completed_at, assigned_by, assigned_at)
  on table public.education_progress to authenticated;
grant insert, delete on table public.education_progress to authenticated;
grant update (status, attempts, completed_at, notes, updated_at)
  on table public.education_progress to authenticated;

-- NOTA PARA EL CLIENTE: con un grant por columnas, `returning *` falla con
-- `42501` en la primera columna sin privilegio. El UPDATE tiene que pedir
-- `returning (status, attempts, completed_at, notes, updated_at)` — que es
-- exactamente lo que la app necesita mostrar de una fila propia.
```

> **El grant de arriba está corregido, y con qué mecanismo.** La fila que este bloque señalaba —dos `grant select` que se pisan, el segundo abriendo `notes` al docente— ya no existe: los permisos de `education_progress` están en el bloque de RLS, capados por columna, y el porqué está en el comentario `-- ═══ GRANTS de education_progress ═══`. La respuesta a D8 no fue «un grant más fino»: **Postgres no tiene grants por rol** — `authenticated` es un único rol para la alumna y para el docente, así que ningún privilegio puede darle a uno más que al otro. La resolución es de dos capas: **`authenticated` recibe solo las seis columnas que el BDD le da al docente**, y **la alumna lee su fila entera —`notes` incluida— por `public.education_my_progress()`, un `SECURITY DEFINER` que proyecta exactamente lo suyo**. Lo que D8 deja abierto es la parte de producto: si el rol docente necesita una tercera proyección —«quién no ha empezado el curso», que hoy el cliente arma cruzando `education_enrollments`— eso es una función más, no un privilegio distinto.

```sql
-- events: el ledger es del alumno y NADIE mas. Ni el docente, ni la org.
-- practice-mode.feature:139 dice que la practica no es visible a los companeros
-- "or the organization"; el XP derivado tampoco lo es.
drop policy if exists education_events_select_own on public.education_events;
create policy education_events_select_own on public.education_events
  for select to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

-- La idempotencia NO vive aca. `client_uuid` es la PRIMARY KEY de la tabla
-- (§4.5), asi que un replay del mismo evento choca con la clave y el cliente lo
-- resuelve con `on conflict do nothing`. La version anterior de esta politica
-- hacia las dos cosas: ademas arrastraba un `not exists (select 1 from
-- public.education_events …)` —la propia tabla dentro de su propia politica— que
-- es exactamente la recursión que `0002:136-141` prohibe y que la tabla de arriba
-- no tolera: education_events tiene FORCE, asi que Postgres evalua la politica
-- contra si misma y devuelve 42P17 en tiempo de plan. Ademas el predicado era
-- redunzante: con la clave primaria, la fila no puede existir todavia.
-- El WITH CHECK de una politica INSERT protege columnas; la unicidad la pone el
-- indice. Son dos cosas y hacen falta las dos.
drop policy if exists education_events_insert_own on public.education_events;
create policy education_events_insert_own on public.education_events
  for insert to authenticated
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

-- Sin UPDATE. Sin DELETE. Es un ledger.
```

### Grants de C2

Orden D6: los `revoke all` de arriba van **antes** de las políticas, y los `grant` dirigidos **después**. Sin esta parte el bloque anterior no hace nada: `revoke all … from authenticated` deja a `authenticated` sin privilegio de tabla, y sin privilegio **la política es inalcanzable** — la fila pasa el `USING` y el INSERT nunca llega a evaluarse. El error sale como `42501 permission denied for table`, no como un fallo de RLS, y por eso no lo detecta ninguna prueba de lectura.

```sql
-- courses: el miembro lo lee (select_member, select_member_published),
-- el staff de la org lo escribe (write_staff). El DELETE no tiene politica:
-- un curso se archiva, no se borra, y el ON DELETE CASCADE de §4.1 lo haria
-- desaparecer con sus ejercicios y el progreso de todos los alumnos.
grant select, insert, update on table public.education_courses to authenticated;

-- exercises: misma razon — se elimina un ejercicio de la lista, la fila se
-- borra (courses-and-exercises.feature:106), y por eso aqui si hay DELETE.
grant select, insert, update, delete on table public.education_exercises to authenticated;

-- enrollments: SOLO lectura. Quien matricula y con que condiciones es D2, y
-- D2 no esta decidida; conceder INSERT aca seria escribir la respuesta de
-- producto por el camino del grant. Cuando D2 se cierre, esta linea cambia.
grant select on table public.education_enrollments to authenticated;

-- events: el alumno lee y escribe SU ledger. Ni UPDATE ni DELETE, porque el
-- BDD exige que un evento equivocado se corrija con otro evento, no editando
-- (education-student-progress.feature:63-68).
grant select, insert on table public.education_events to authenticated;

-- education_progress NO aparece aca: sus permisos estan arriba, en el bloque
-- `-- ═══ GRANTS de education_progress ═══`, porque son los unicos de C2 que
-- van POR COLUMNA y no por tabla. `authenticated` recibe SELECT sobre seis
-- columnas —no sobre `notes`, ni `score`, ni `attempts`— y UPDATE sobre otras
-- cinco. El razonamiento completo esta ahi; repetirlo aca seria una segunda
-- version que se desincroniza.
```

### Wrappers públicos y permisos de función (C2)

Mismo patrón que §2.5: núcleo de derivación en `private`, superficie en `public`, `revoke` de los tres y `grant` a `authenticated` escrito función por función. Lo que cambia respecto de §2.5, y es deliberado, está al final de este bloque.

```sql
-- ═══ 1. La fila entera de la alumna ═══
-- SIN parametro de usuario: el unico criterio es `auth.uid()`, que el cliente
-- no puede fijar. Por eso esta funcion no puede devolver la fila de nadie mas,
-- y por eso el cap de columnas de `authenticated` sobre education_progress no la
-- deja tirada: necesita SECURITY DEFINER para leer `notes` y `attempts`, que su
-- grant por columnas no le da.
--
-- Con `auth.uid()` nulo —sesion anonima— devuelve cero filas, no un error: el
-- permiso de ejecucion ya esta revocado para `anon` de todas formas.
--
-- Es la unica lectura de la fila completa que existe. El `select` directo sobre
-- education_progress le da a la alumna las seis columnas de siempre, y el
-- `RETURNING` de su UPDATE le devuelve las cinco que puede escribir; esta es la
-- que llena el resto.
create or replace function public.education_my_progress()
returns table (
  exercise_id  uuid,
  user_id      uuid,
  status       text,
  score        numeric,
  attempts     integer,
  completed_at timestamptz,
  notes        text,
  assigned_by  uuid,
  assigned_at  timestamptz,
  updated_at   timestamptz
)
language sql stable security definer set search_path = '' as $$
  select p.exercise_id, p.user_id, p.status, p.score, p.attempts,
         p.completed_at, p.notes, p.assigned_by, p.assigned_at, p.updated_at
  from public.education_progress p
  where p.user_id = (select auth.uid());
$$;

-- ═══ 2. Las dos derivaciones de XP y racha ═══
-- El `p_user_id` del nucleo NO se expone. Se sustituye por `auth.uid()` dentro
-- del wrapper, y esa es toda la autorizacion: el que llama se entera de lo
-- suyo y no hay forma de preguntar por otro. Un `p_user_id` en la superficie
-- publica seria precisamente el agujero que teaching-assignments.feature:105-108
-- y student-progress.feature:159-163 cierran.
--
-- Con `null`, las dos derivaciones usan la zona horaria de la sesion, que en
-- PostgREST es UTC. `p_tz` existe para que la alumna obtenga SU dia calendario
-- (student-progress.feature:108-112) y lo tiene que pasar el cliente, porque
-- Postgres no lo sabe. Una zona mal formada revienta con `22023 invalid
-- parameter value for TimeZone`; es un error de entrada, no de permiso.
create or replace function public.education_xp_total()
returns bigint
language sql stable security definer set search_path = '' as $$
  select private.education_xp_total((select auth.uid()));
$$;

create or replace function public.education_streak(p_tz text default null)
returns integer
language sql stable security definer set search_path = '' as $$
  select private.education_streak((select auth.uid()), p_tz);
$$;

-- ═══ 3. Permisos ═══
-- `revoke` de los TRES en los nucleos, no de dos: los privilegios por defecto de
-- `private` se reescriben en cada `alter default privileges` y las dos
-- statements del repo no coinciden (0002:42 vs 0016:54). Un privilege explicito
-- por funcion es lo unico que no depende de ese default.
--
-- Y el nucleo NO recibe `grant execute` a `authenticated`, que es lo unico donde
-- C2 se separa de §2.5 — a proposito. Los nucleos reciben `p_user_id`; mantenerlos
-- fuera de la superficie es la segunda mitad del mismo argumento que hace que
-- los wrappers no lleven parametro. Concederles ejecucion seria abrir por detras
-- la lectura de cualquier XP y cualquier racha de cualquier alumno.
revoke execute on function private.education_xp_total(uuid)     from public, anon, authenticated;
revoke execute on function private.education_streak(uuid, text) from public, anon, authenticated;
revoke execute on function public.education_my_progress()       from public, anon;
revoke execute on function public.education_xp_total()          from public, anon;
revoke execute on function public.education_streak(text)        from public, anon;

grant execute on function public.education_my_progress()       to authenticated;
grant execute on function public.education_xp_total()          to authenticated;
grant execute on function public.education_streak(text)        to authenticated;
```

#### La pregunta de `SECURITY DEFINER` contra `force row level security`

`education_events` lleva `force row level security` y sus únicas políticas son `education_events_select_own` e `education_events_insert_own`, ambas con `user_id = auth.uid()`. Una `SECURITY DEFINER` cuyo dueño **no** tuviera `BYPASSRLS` leería la tabla como su dueño y, por RLS, vería solo las filas de quien la llamó — lo que en el diseño anterior significaba «no puede ver el XP de la alumna que le preguntaron».

**Acá el problema desaparece por el acotamiento, no por la propiedad.** Los wrappers de arriba no tienen sobre quién ampliarse: devuelven lo del que llama, que es exactamente el conjunto que `education_events_select_own` admite. El peor caso del escenario —un dueño sin `BYPASSRLS`— es que la función devuelva lo mismo de siempre y no una fila más: **falla cerrado, no filtra**.

Y en esta base el caso ni se da. `supabase db reset` aplica las migraciones como `postgres`, y `postgres` tiene `BYPASSRLS`, así que el dueño de la función salta RLS incluso sobre una tabla con `FORCE`. Verificado en solo lectura contra la base local:

```
$ docker exec -i supabase_db_cemurm psql -U postgres -d postgres -X -A -F'|' \
    -c "select rolname, rolsuper, rolbypassrls from pg_roles
         where rolname in ('postgres','authenticated','anon','service_role') order by 1;"
rolname|rolsuper|rolbypassrls
anon|f|f
authenticated|f|f
postgres|f|t
service_role|f|t

$ … -c "select p.proname, pg_get_userbyid(p.proowner) as owner, p.prosecdef
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'private' and p.prosecdef order by p.proname limit 3;"
proname|owner|prosecdef
add_rehearsal_song|postgres|t
approve_guardian_sharing|postgres|t
assign_musician|postgres|t

$ … -c "select p.oid::regprocedure::text as fn, p.proacl::text as acl,
              has_function_privilege('anon', p.oid::regprocedure::text, 'EXECUTE') as anon_exec,
              has_function_privilege('authenticated', p.oid::regprocedure::text, 'EXECUTE') as auth_exec
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'private' and p.proname = 'is_org_member';"
private.is_org_member(uuid,uuid)|{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}|f|t
```

Que los `SECURITY DEFINER` que ya existen en el repo tengan al mismo dueño no es casualidad: es la razón por la que `org_leave` puede hacer `update org_memberships` sobre una tabla que C1 le pone `FORCE`. Si alguna vez las migraciones se aplicaran con un dueño sin `BYPASSRLS`, estas derivaciones seguirían siendo correctas por el párrafo anterior — y perderían la capacidad de ver filas ajenas, que no necesitan.

**Una anomalía que conviene que un revisor vea, y que no puedo resolver sin escribir en la base.** `pg_default_acl` **no tiene ninguna fila para el schema `private`**, pese a que `0002:42` y `0016:54` ejecutan `alter default privileges in schema private`. Y `private.build_plan_snapshot(uuid)`, que crea `0034_plan_freeze.sql:41` —es decir, después de las dos statements—, conserva el `proacl` por defecto y `anon` puede ejecutarla:

```
$ … -c "select n.nspname from pg_default_acl d
         join pg_namespace n on n.oid = d.defaclnamespace where n.nspname = 'private';"
nspname
(0 rows)

$ … -c "select p.oid::regprocedure::text as fn, coalesce(p.proacl::text,'(null)') as acl,
              has_function_privilege('anon', p.oid::regprocedure::text, 'EXECUTE') as anon_exec,
              has_function_privilege('authenticated', p.oid::regprocedure::text, 'EXECUTE') as auth_exec
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'private' and p.proname = 'build_plan_snapshot';"
private.build_plan_snapshot(uuid)|(null)|t|t
```

**No afirmo por qué.** Dos candidatos —que `ALTER DEFAULT PRIVILEGES` no haya quedado como se espera, o que ese archivo se haya aplicado fuera del runner— y separarlos exige una escritura, que el encargo prohíbe. El caso es que `supabase_migrations.schema_migrations` llega a `0033` mientras `0034` y `0036` sí dejaron funciones en la base, o sea que se aplicaron a mano; eso hace que la segunda hipótesis sea la más probable, pero «más probable» no es «verificada». Lo que sí es un hecho, y es lo que sostiene este bloque: **el default de privilegios de `private` no es observable en esta base**, así que el `revoke`/`grant` explícito no es higiene, es el mecanismo.

---

## 5. C3 — Eventos y asistencia: cero migración

**Este contexto no necesita una línea.** Ya está:

| | |
|---|---|
| Tablas | `events`, `event_participants`, `event_rsvps`, `event_setlists`, `venues` — `0001:241-290` |
| RLS | **4, 4, 3 y 4** políticas en `0016`, en ese orden. Las cuatro de `venues` son de `0004:43-60` |
| Grants | `0016:554-558` devuelve `select, insert, update, delete` a `authenticated` en las tres primeras y `select, insert, update` en `event_rsvps` |
| Decisión de diseño | D3 resuelta: *"Event-owned, read-only for all participants"* |

> **Recuento, con su comando.** Las cifras son **4, 4, 3 y 4**, y este es el comando que las re-deriva —pegado, con sus saltos de línea, produce exactamente eso—:
>
> ```
> $ grep -h "create policy" supabase/migrations/*.sql \
>   | sed -E 's/.*create policy ([a-z_0-9]+) on ([a-z_0-9]+\.[a-z_0-9]+).*/\2 \1/' \
>   | grep -E '^public\.(events|event_participants|event_rsvps|event_setlists) ' \
>   | sort -u \
>   | awk '{print $1}' | sort | uniq -c
>       4 public.event_participants
>       3 public.event_rsvps
>       4 public.events
>       4 public.event_setlists
> ```
>
> El `^public\.` del `grep` no es decorativo y es lo que hacía que este comando no sirviera: el grupo de captura de `sed` emite el nombre **calificado con esquema** (`public.events`), así que un ancla `^(events|…)` no casa con nada y la tubería devuelve **cero líneas** en lugar de un error. El `sort -u` es lo que descuplica los nombres reescritos por `0020_review_batch1.sql:184,201,230`: `event_participants_insert_organizer`, `_update_organizer` y `event_setlists_update_organizer` se crean otra vez **con los mismos nombres**, así que reemplazan y no suman.
>
> Para ver los nombres y no solo el conteo, la misma tubería sin el `awk`:
>
> ```
> $ grep -h "create policy" supabase/migrations/*.sql \
>   | sed -E 's/.*create policy ([a-z_0-9]+) on ([a-z_0-9]+\.[a-z_0-9]+).*/\2 \1/' \
>   | grep -E '^public\.(events|event_participants|event_rsvps|event_setlists) ' \
>   | sort -u
> public.event_participants event_participants_delete_organizer
> public.event_participants event_participants_insert_organizer
> public.event_participants event_participants_select_any_auth
> public.event_participants event_participants_update_organizer
> public.event_rsvps event_rsvps_insert_self
> public.event_rsvps event_rsvps_select_self
> public.event_rsvps event_rsvps_update_self
> public.events events_delete_organizer
> public.events events_insert_organizer
> public.events events_select_any_auth
> public.events events_update_organizer
> public.event_setlists event_setlists_delete_organizer
> public.event_setlists event_setlists_insert_organizer
> public.event_setlists event_setlists_select_participant
> public.event_setlists event_setlists_update_organizer
> ```
>
> Las cifras que circulaban en los borradores de este change (8, 12, 6 y 10) no corresponden a nada que exista en el repositorio.

Lo que falta es BDD de asistencia y cliente. **Nada de esto es una migración**, y decirlo es parte del argumento de por qué C3 va en Hito 9 y no antes.

La **única** reserva: `events.type` está anotado en `0001:243` como *"NOT SETTLED BY THE FEATURES"*, y `event_type` contiene `'mixed-group' | 'sequence-only' | 'full-program'` — que son tipos de *colaboración*, no de evento. Eso es **D3**, decisión de producto, y se resuelve antes de escribir el BDD.

---

## 6. C4 — Inventario y préstamos (3 tablas)

**Estas tres las diseñé yo, sin SQL y sin contrastar.** La auditoría de Education rechazó 12 de 20 tablas propuestas como duplicación pura; este diseño no pasó por ese filtro. Es la parte más débil del change y va marcada como tal.

```sql
-- ═══════════════ 6.1 asset_types ═══════════════
-- Catalogo de QUE clase de equipo existe. specs_schema dice que campos técnicos
-- espera el tipo, para que el formulario de alta no tenga que hardcodear guitarra
-- y amplificador por separado.
create table public.asset_types (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  category      text not null,      -- 'instrument' | 'audio' | 'amplification' | 'accessory' | 'other'
  specs_schema  jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
```

```sql
-- ═══════════════ 6.2 assets ═══════════════
-- UNA UNIDAD FISICA por fila, no un tipo de equipo. Un inventario que cuenta
-- "3 amplifiers" no puede decir cual se rompio ni quien lo tiene.
--
-- org_id + branch_id replican la pertenencia organizacional: un equipo pertenece
-- a una sede. SI el modelo fuera "compartido entre toda la organizacion",
-- branch_id queda NULL y la politica lo resuelve — por eso la decision de
-- producto (por sede o por sistema) NO esta cocida en el schema, y §6.4 dice como.
create table public.assets (
  id           uuid primary key default gen_random_uuid(),
  asset_type_id uuid not null references public.asset_types(id) on delete restrict,
  org_id       uuid not null references public.organizations(id) on delete cascade,
  branch_id    uuid references public.branches(id) on delete set null,
  label        text not null,
  serial       text,
  status       text not null default 'available',
    -- 'available' | 'loaned' | 'maintenance' | 'retired'
  specs        jsonb not null default '{}',   -- marca, modelo, anio, y lo que pida specs_schema
  acquired_at  date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint assets_status_check
    check (status in ('available','loaned','maintenance','retired'))
);
create unique index assets_org_label_unique on public.assets (org_id, label);
create index idx_assets_org_status on public.assets (org_id, status);
```

```sql
-- ═══════════════ 6.3 asset_loans ═══════════════
-- event_id es la vinculacion directa al evento que pide el requerimiento #11.
-- on delete set null: si se cancela el evento, el prestamo NO se borra — el
-- equipo sigue prestado y hay que devolverlo.
create table public.asset_loans (
  id              uuid primary key default gen_random_uuid(),
  asset_id        uuid not null references public.assets(id) on delete cascade,
  holder_user_id  uuid not null references auth.users(id),
  assigned_by     uuid not null references auth.users(id),
  event_id        uuid references public.events(id) on delete set null,
  checked_out_at  timestamptz not null default now(),
  due_at          timestamptz,
  returned_at     timestamptz,
  condition_out   text,
  condition_in    text,
  notes           text,
  constraint asset_loans_return_order
    check (returned_at is null or returned_at >= checked_out_at)
);

-- UN EQUIPO NO PUEDE ESTAR PRESTADO DOS VECES. Indice unico parcial sobre el
-- estado abierto — no sobre (asset_id, holder), porque un equipo vuelve y vuelve
-- a salir. Es la regla que hace que "prestado" sea un estado del DATOS y no un
-- estado que la interfaz mantiene.
create unique index asset_loans_one_open_per_asset
  on public.asset_loans (asset_id) where returned_at is null;

create index idx_asset_loans_holder on public.asset_loans (holder_user_id, checked_out_at desc);
create index idx_asset_loans_event  on public.asset_loans (event_id) where event_id is not null;
```

`condition_out` y `condition_in` son campos distintos a propósito: es lo que permite "se prestó roto" como hallazgo posterior y no como memoria de alguien.

### 6.4 RLS de C4

```sql
alter table public.asset_types enable row level security;
alter table public.assets      enable row level security;
alter table public.asset_loans enable row level security;

alter table public.asset_types force row level security;
alter table public.assets      force row level security;
alter table public.asset_loans force row level security;

revoke all on table public.asset_types from public, anon, authenticated;
revoke all on table public.assets      from public, anon, authenticated;
revoke all on table public.asset_loans from public, anon, authenticated;

-- assets: solo la org que los posee. Un branch_admin ve los de su sede (col 1).
drop policy if exists assets_select_member on public.assets;
create policy assets_select_member on public.assets
  for select to authenticated
  using ((select auth.uid()) is not null and private.is_org_member((select auth.uid()), org_id) is not null);

drop policy if exists assets_select_branch_admin on public.assets;
create policy assets_select_branch_admin on public.assets
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and private.session_role_in((select auth.uid()), org_id, array['branch_admin'])
    and branch_id = any (select private.user_branch_ids((select auth.uid())))
  );

-- El PRESTAMO es lo que cambia el status del asset. El indice parcial de 6.3
-- garantiza unicidad, pero el status en assets.status tiene que seguirlo o el
-- listado miente. Un trigger, no el cliente: dos Prestamos concurrentes desde
-- dos dispositivos dejarian status inconsistent aunque el indice los|frene.
```

> **El trigger de `assets.status` no está escrito.** Es la pieza que convierte el indice parcial en un estado coherente, y sin ella `assets.status = 'loaned'` es una opinion del cliente. Queda como trabajo de la migracion `0041`, no como nota. Marcado, no resuelto.

### Grants de C4

Mismo orden D6 y misma razon que en C2: sin privilegio de tabla, las dos políticas `SELECT` de arriba son inalcanzables y el `revoke all` las deja como decoration.

```sql
-- assets: solo lectura por ahora. Las dos politicas de arriba son SELECT, y la
-- escritura depende del trigger de §6.4 mas el RPC de prestamos de 0041, que
-- todavia no esta escrito. Conceder INSERT aca seria una promesa sin politica
-- detras: inerte hoy y peligroso el dia que la politica llegue.
grant select on table public.assets to authenticated;

-- asset_types: catalogo de que clase de equipo existe. INSERT y UPDATE si,
-- porque el formulario de alta depende de poder ampliarlo. DELETE no: §6.2 lo
-- referencia con ON DELETE RESTRICT, asi que un tipo con filas no se puede borrar
-- de todos modos y concederlo solo abriria una via que rebota en el FK.
grant select, insert, update on table public.asset_types to authenticated;

-- asset_loans: el prestamo se abre (INSERT) y se cierra (UPDATE de returned_at
-- y condition_in). DELETE no: un prestamo es historia, igual que el ledger de XP.
-- OJO: hasta que existan las politias INSERT/UPDATE de esta tabla, estos dos
-- privilegios quedan INERTES — FORCE RLS sin politica los denies igual. El grant
-- fija el contrato de la migracion 0041; la politica que lo hace alcanzable es
-- trabajo abierto, no una nota.
grant select, insert, update on table public.asset_loans to authenticated;
```

---

## 7. Decisiones que este documento no resuelve

| # | Decisión | Por qué no la tomo |
|---|---|---|
| **D1** | Consentimiento de menores para datos educativos | Producto. `guardian_consents` (`0017:81`) solo tiene `public_sharing_approved`. Sin esto, escribir escenarios de menores en BDD sería inventar acuerdo |
| **D2** | Quién matricula y qué ve un admin | Producto. La auditoría lo dejó abierto y el BDD trata la matriculación como precondición, no como flujo |
| **D3** | Qué es un `event` | Producto. `0001:243` lo declara no resuelto |
| **D4** | Bandas: organización o entidad | Producto. Define si se escribe o no la línea de `org_type` en §1.3 |
| **D7** | `UNIQUE(user_id, org_id, branch_id)` defeated por NULL | Es un defecto **preexistente** de `0001:36`. Arreglarlo es una migración sobre datos del seed; no se meter de contrabando en una ampliación |
| **D8** | Qué más ve el docente, si algo | **El mecanismo está resuelto**, no la decisión de producto. Postgres no tiene grants por rol, así que el cap va por columnas para `authenticated` y la fila completa de la alumna sale de `public.education_my_progress()`, un `SECURITY DEFINER` que proyecta lo suyo — está escrito, con su porqué, en el bloque de políticas de `education_progress`. Lo que sigue abierto es si el rol docente necesita una tercera proyección: hoy «quién no ha empezado el curso» lo arma el cliente cruzando `education_enrollments`, y si el BDD lo exige como fila, es una función más, no un privilegio distinto |
| **D9** | Trigger de `assets.status` al abrir/cerrar préstamo | Se puede decidir leyendo los smokes de `0023_substitutions`, que ya resuelven un problema parecido |

---

## 8. Verificación

**Nada de esto se ha ejecutado.** No hay migración escrita, no hay `supabase db reset`, no hay smoke.

Cuando exista, la verificación es:

| Qué | Cómo |
|---|---|
| Aislamiento entre orgs | Smoke SQL con `set_config('role', …, false)` y JWT fijo. Los smokes del repo usan UUID literales, nunca `gen_random_uuid()`, porque no cruza un cambio de rol |
| Los 4 guards de cada RPC | Un smoke por guard, invocando el RPC **como el actor que debe fallar** y esperando la excepción |
| SOD | Un smoke que intente auto-agregarse y espere `raise exception` |
| Idempotencia del ledger | Insertar dos veces el mismo `client_uuid` y verificar una sola fila |
| Un activo no se presta dos veces | Insertar dos préstamos abiertos del mismo `asset_id` y esperar violación del índice parcial |
| `FORCE RLS` | Conectar **como owner** y confirmar que ahora respeta la política — la prueba de S1 no se puede escribir desde el cliente |
| `WITH CHECK` | Un smoke que **intente** escribir un `account_status` inválido y espere rechazo. Un test de lectura nunca lo detecta |
| El cap de columnas de `education_progress` | Un smoke que, **como docente**, intente `select notes, score, attempts from education_progress` y espere `42501`, y que el mismo `select` de las seis columnas sí devuelva la fila. Es el único caso de esta tabla donde el resultado correcto es un error |
| Los wrappers de C2 | Un smoke por wrapper, como la alumna, esperando el valor; y uno que intente `private.education_xp_total('<otro uuid>')` desde `authenticated` y espere `42501`, porque el núcleo no recibe `grant execute` |

El smoke requiere `supabase db reset` antes y **no es idempotente**. Es la convención de `odd/tasks/hito5-substitutions-and-coverage.md`, no un descuido.

---

*Elaborado contra `main` = `a610dd0` el 13 de octubre de 2026. Ninguna línea de este documento se ha aplicado a la base de datos. C1, C2 y C4 no están autorizados a construirse hasta que D1, D2 y D4 estén decididas; C3 no necesita migración y solo espera su BDD.*