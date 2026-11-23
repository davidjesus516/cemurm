# CEMURM — Ampliación institucional: modelo de datos de F1–F8

**Estado:** especificación en revisión. **No aplicada.** Ninguna migración de este documento corrió.
**Base:** `main` = `f7d8bdc`, 44 migraciones (`0001`–`0046`, hueco deliberado en `0021`/`0022`).
**Change:** `openspec/changes/education-institutional-modules`
**Alcance:** las tablas de F1 (identidad y membresía), el núcleo académico de F3, la extensión de `events` en F4 y el inventario de F7. Las fases F2, F5, F6 y F8 se especifican en el proposal y en `docs/roadmap-ampliacion.md`; el índice de migraciones está en §9.

> Este documento existe porque la propuesta **no** llevaba DDL. Las tablas del inventario estaban escritas como tabla de markdown, sin SQL, en un documento meant para client's eyes. Acá van con la convención del repo. **La matrícula apunta a la oferta, no al curso** (decisión B1): ese es el cambio de forma que atraviesa todo el núcleo académico.

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

1. **`FORCE ROW LEVEL SECURITY`** (hallazgo S1). Ninguna de las 31 tablas con RLS que existían cuando se escribió este documento la tenía — `grep "force row level security" supabase/migrations/*.sql` no devolvía una fila — así que el owner bypasea las políticas. **Todas las tablas nuevas de este documento llevan `FORCE` salvo `admin_audit_log`**, y la excepción la obliga su propio diseño: ver §3. Es un endurecimiento independiente de la ampliación que pudo haberse tomado antes y no se tomó — ver `proposal.md` §Approach.
2. **Auditoría de actor con contexto de grupo** (hallazgo S3). No existe en el repo. ownCloud registra el grupo del actor además de su id, porque el id solo no reconstruye *qué organización* actuó. La tabla `admin_audit_log` de §1.4 nace de eso.

---

## 1. F1 — Identidad y organización

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

> **Consecuencia que obligó al resto del documento:** el `coalesce(p_role, 'member')` de §2.1 y el `p_role not in ('member', …)` de §2.3 escribían un valor que este CHECK rechaza. Quedaron corregidos en §2.1 y §2.3: el valor por defecto es `org_member` y la lista es la del CHECK.

`org_memberships` también gana un CHECK de branch coherence, porque su `UNIQUE(user_id, org_id, branch_id)` (`0001:36`) ya está defeated por NULLs:

```sql
-- Postgres trata NULLs como distintos en UNIQUE, asi que la misma persona puede
-- tener dos filas (user, org, NULL) — una por sede, sin restriccion. El CHECK no
-- arregla eso; lo hace NOT VALID y una particion por org_id. Ver §6, decision D7.
```

> **Pendiente y marcado como tal:** el `UNIQUE` con `branch_id` nullable es un defecto preexistente de `0001:36`. No lo introduce esta ampliación y **no se arregla acá**: cambiarlo es una migración sobre datos existentes de todos los org_memberships del seed. Queda registrado, no resuelto.

### 1.3 El CHECK de `organizations.org_type` (D4 resuelta: banda = organización)

```sql
alter table public.organizations
  add constraint organizations_org_type_check
  check (org_type is null or org_type in ('Academy', 'Church', 'Orchestra', 'Band'));
-- 'Band' es la adicion. Las otras tres ya estan en 0001:9 y las usan
-- features/organizational-repertoire-model.feature y el seed.
--
-- D4 quedo resuelta como A (proposal, out of scope): una banda usa
-- organizations con org_type = 'Band'. No hay entidad `bands` separada y por
-- eso esta linea SI se escribe. Si la decision se revierte, se cae junto con
-- el requisito #7.
```

### 1.4 Tabla `admin_audit_log` — el hallazgo S3

```sql
-- S3: no existe registro de auditoria en el repo. Cinco migraciones mencionan
-- 'audit' en comentarios y ninguna tiene tabla. Esto no es solo para F1: es la
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

-- append-only: no hay UPDATE ni DELETE policy en §3, y no hay columna de edicion.
-- Un log que se puede corregir no es un log.
```

`actor_id` es `ON DELETE SET NULL` y no `CASCADE`: borrar una cuenta no borra la evidencia de lo que hizo.

---

## 2. Los RPC de F1 — membresía y ciclo de cuenta

Esta es la parte que más importa, porque es la que **desbloquea F3, F4 y F7**. El molde es `promote_song_to_system` (`0016:360-430`): wrapper público delgado, core en `private`, y `session_role_in` revalidando `auth.uid()` internamente.

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
-- actualiza, y es lo unico que lo hace en las 44 migraciones. Lo que no existe
-- es alta, cambio de rol ni baja de terceros. Este §2 agrega las tres acciones
-- que faltan y no toca la cuarta.
--
-- POR QUE UN RPC Y NO UNA POLITICA INSERT: org_memberships no tiene politica
-- INSERT, ni grant, ni deberia tenerlos. La escritura organizacional pasa por
-- un punto unico que puede (a) revalidar el actor, (b) escribir la auditoria y
-- (c) negarse con un mensaje que el cliente mapea. Una politica INSERT no tiene
-- ningun sitio donde meter (b).
create or replace function private.add_org_member_core(
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
create or replace function private.remove_org_member_core(
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
create or replace function private.change_member_role_core(
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
  -- los roles elevados, es pregunta de producto; este documento no la acota ni
  -- la restringe por su cuenta.
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
create or replace function private.set_account_status_core(
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
create or replace function public.add_org_member(p_org_id uuid, p_user_id uuid, p_branch_id uuid, p_role text)
returns uuid language sql security definer set search_path = '' as $$
  select private.add_org_member_core(p_org_id, p_user_id, p_branch_id, p_role);
$$;

create or replace function public.remove_org_member(p_membership_id uuid)
returns void language sql security definer set search_path = '' as $$
  select private.remove_org_member_core(p_membership_id);
$$;

create or replace function public.change_member_role(p_membership_id uuid, p_role text)
returns void language sql security definer set search_path = '' as $$
  select private.change_member_role_core(p_membership_id, p_role);
$$;

create or replace function public.set_account_status(p_user_id uuid, p_status text)
returns void language sql security definer set search_path = '' as $$
  select private.set_account_status_core(p_user_id, p_status);
$$;

-- R14 de la auditoría: los privilegios por defecto de `private` difieren entre
-- 0002:42 (revoca a public, anon, authenticated) y 0016:54 (solo public, anon).
-- GANA EL ULTIMO. Cada revoke de abajo tiene que listar los TRES.
revoke execute on function private.add_org_member_core(uuid,uuid,uuid,text)      from public, anon, authenticated;
revoke execute on function private.remove_org_member_core(uuid)                 from public, anon, authenticated;
revoke execute on function private.change_member_role_core(uuid,text)           from public, anon, authenticated;
revoke execute on function private.set_account_status_core(uuid,text)            from public, anon, authenticated;
revoke execute on function public.add_org_member(uuid,uuid,uuid,text)      from public, anon;
revoke execute on function public.remove_org_member(uuid)                 from public, anon;
revoke execute on function public.change_member_role(uuid,text)           from public, anon;
revoke execute on function public.set_account_status(uuid,text)            from public, anon;

grant execute on function private.add_org_member_core(uuid,uuid,uuid,text)      to authenticated;
grant execute on function private.remove_org_member_core(uuid)                 to authenticated;
grant execute on function private.change_member_role_core(uuid,text)           to authenticated;
grant execute on function private.set_account_status_core(uuid,text)            to authenticated;
grant execute on function public.add_org_member(uuid,uuid,uuid,text)      to authenticated;
grant execute on function public.remove_org_member(uuid)                 to authenticated;
grant execute on function public.change_member_role(uuid,text)           to authenticated;
grant execute on function public.set_account_status(uuid,text)            to authenticated;
```

---

## 3. RLS de F1

Orden D6. `org_memberships` **no recibe** política `INSERT`/`UPDATE`/`DELETE`: la escritura pasa por los RPC, y esa es la razón por la que el requerimiento #1 no es "una pantalla más". `leave_organization` (`0016:455-459`) sobrevive intacto —no es una política, es una función `SECURITY DEFINER` con su propio guard— y sigue siendo la única forma en que un miembro modifica una fila de esta tabla sin pasar por los RPC de §2.

```sql
alter table public.org_memberships enable row level security;
alter table public.profiles enable row level security;
alter table public.admin_audit_log enable row level security;

-- S1: el owner bypasea RLS sin FORCE. Ninguna tabla existente del repo lo trae.
-- Todas las tablas nuevas de §4 y §6 lo llevan. admin_audit_log NO: ver el bloque de abajo.
alter table public.org_memberships force row level security;
alter table public.profiles force row level security;

-- ═══ admin_audit_log NO lleva FORCE ROW LEVEL SECURITY, y esto es deliberado ═══
--
-- Todas las tablas nuevas de §4 y §6 lo llevan. Esta no puede, por una razon mecanica y no de gusto:
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

### Grants de F1

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

## 4. F3 — Núcleo académico (9 tablas + 1 condicional)

Diseño de `odd/tasks/education-institutional-decisions.md` (B1, B2, B3, T4, T7, T8) y de la tabla de migraciones de `openspec/changes/education-institutional-modules/proposal.md`. **El diseño anterior de cinco tablas (C2) se retira**: no tenía período, ni oferta, ni evaluación. Lo que lo reemplaza mantiene la misma frontera —`org_id` en el curso es el aislamiento— pero cambia el objetivo de la matrícula: **la oferta** (B1).

La diferencia no es cosmética. Matricular directo al curso no puede expresar "la misma asignatura en distintos períodos" ni "una persona en varias cátedras", que son dos frases del BDD. `education_course_offerings` = curso + período + grupo + sede + instructor opcional, y `education_enrollments.offering_id` apunta ahí.

### 4.1 `academic_periods`

```sql
-- Periodo reutilizable (B1). Vive por organizacion porque el calendario de una
-- academia no es el de otra. status es el ciclo de vida que el acta pide; no es
-- un booleano porque "abierto" y "cerrado" no son lo mismo que "archivado".
create table public.academic_periods (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  starts_on  date not null,
  ends_on    date not null,
  status     text not null default 'planned',  -- 'planned' | 'active' | 'closed'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_periods_name_unique unique (org_id, name),
  constraint academic_periods_range_check check (ends_on >= starts_on),
  constraint academic_periods_status_check check (status in ('planned','active','closed'))
);
create index idx_academic_periods_org on public.academic_periods (org_id, status);
```

### 4.2 `education_courses`

```sql
-- org_id es LA frontera de aislamiento. education_courses es la primera tabla
-- donde "una organizacion" es un limite de lectura y no un adorno: sin esta tabla
-- no hay nada que pueda pertenecer a un curso.
create table public.education_courses (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  branch_id   uuid references public.branches(id) on delete set null,
  title       text not null,
  instrument  text,
  -- CONDICIONAL: sin REFERENCES a proposito. education_subjects es condicional
  -- (§4.3), y una FK a una tabla que puede no existir rompe la migracion. Si la
  -- tabla se crea, el ALTER comentado de §4.3 agrega la FK. Si no se crea, esta
  -- columna se omite junto con la tabla condicional.
  subject_id  uuid,
  status      text not null default 'draft',   -- 'draft' | 'published' | 'archived'
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint education_courses_status_check
    check (status in ('draft','published','archived'))
);
create index idx_education_courses_org on public.education_courses (org_id, status);
```

### 4.3 `education_subjects` — CONDICIONAL

```sql
-- CONDICIONAL (acta, "Tablas netas", fila 3): solo si el catalogo de asignaturas
-- se comparte entre cursos. Si no se crea, education_courses.subject_id no se
-- escribe: una columna uuid sin referente no modela nada.
create table public.education_subjects (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  code       text,
  created_at timestamptz not null default now(),
  constraint education_subjects_name_unique unique (org_id, name)
);
create index idx_education_subjects_org on public.education_subjects (org_id);

-- SOLO si la tabla de arriba existe: la FK que education_courses.subject_id
-- no puede declarar en el CREATE TABLE.
-- alter table public.education_courses
--   add constraint education_courses_subject_fk
--   foreign key (subject_id) references public.education_subjects(id) on delete set null;
```

`education_subjects` **no hereda RLS de nadie**: si se crea, lleva sus propias políticas y su propio grant (§4.13/§4.14), porque RLS no compone entre tablas.

### 4.4 `education_course_offerings` — el objetivo de la matrícula (B1)

```sql
-- La OFERTA es lo que hace expresable el BDD: misma asignatura en periodos
-- distintos, y una persona en varias catedras. group_label es el "grupo" del
-- acta (A/B/turno); no se inventa una tabla de grupos porque el acta no la pide.
--
-- instructor_id es OPCIONAL (B1): una oferta puede existir antes de asignar
-- docente. Es auth.users y no org_memberships porque la membresia cambia de rol
-- y de estado; la autorizacion se resuelve por session_role_in en la politica.
create table public.education_course_offerings (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.education_courses(id) on delete cascade,
  period_id     uuid not null references public.academic_periods(id) on delete restrict,
  branch_id     uuid references public.branches(id) on delete set null,
  group_label   text not null,
  instructor_id uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint education_course_offerings_unique unique (course_id, period_id, group_label)
);
create index idx_offerings_course on public.education_course_offerings (course_id, period_id);
create index idx_offerings_instructor on public.education_course_offerings (instructor_id)
  where instructor_id is not null;
create index idx_offerings_branch on public.education_course_offerings (branch_id)
  where branch_id is not null;
```

La coherencia período↔organización y sede↔organización **no la da la FK**: ambas apuntan a tablas sin `org_id` en la clave. La política de escritura de §4.13 la exige con dos `EXISTS` en el `WITH CHECK`, y esa es la razón por la que no hay un RPC de alta de oferta en este documento — el acta no lo nombra.

### 4.5 `education_enrollments`

```sql
-- DELIBERADAMENTE no tiene la forma de org_memberships. El UNIQUE(user_id, org_id,
-- branch_id) de 0001:36 esta defeated por branch_id NULL — Postgres trata los
-- NULLs como distintos, asi que el mismo (user, org) puede aparecer N veces con
-- branch_id NULL. Aca el UNIQUE es (offering_id, user_id), ambas partes NOT NULL.
--
-- role es POR OFERTA, no un rol de organizacion: un alumni puede ser 'instructor'
-- en una catedra y 'student' en otra. Eso es lo que B1 compra.
--
-- withdrawn_at existe (proposal, "with `withdrawn_at`, tutor consent") porque
-- 'former' no es un estado de matricula: la baja conserva la fila y su fecha.
create table public.education_enrollments (
  id           uuid primary key default gen_random_uuid(),
  offering_id  uuid not null references public.education_course_offerings(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'student',   -- 'student' | 'instructor'
  status       text not null default 'active',    -- 'active' | 'completed' | 'withdrawn'
  enrolled_at  timestamptz not null default now(),
  withdrawn_at timestamptz,
  constraint education_enrollments_unique unique (offering_id, user_id),
  constraint education_enrollments_role_check check (role in ('student','instructor')),
  constraint education_enrollments_status_check check (status in ('active','completed','withdrawn')),
  constraint education_enrollments_withdraw_order
    check (withdrawn_at is null or withdrawn_at >= enrolled_at)
);
create index idx_education_enrollments_user on public.education_enrollments (user_id, status);
create index idx_education_enrollments_offering on public.education_enrollments (offering_id, status);
```

**No hay política `INSERT`/`UPDATE`/`DELETE` sobre esta tabla, y no debe haberla.** La matrícula se escribe solo por los RPC de §4.12 (T4), que revalidan al actor, el consentimiento de menores y la separación de funciones. Es la misma decisión que en `org_memberships` (§3): una política de escritura no tiene dónde escribir la auditoría.

### 4.6 `education_exercises`

```sql
-- NO hay units ni lessons. position es plano y ordered. La auditoría (§C) rechaza
-- la jerarquia: education-courses-and-exercises.feature afirma positively que no
-- hay un nivel unit/lesson que abrir, asi que la jerarquia no se puede colar.
--
-- anchor jsonb es {section, index}, copiado verbatim de shared_comments.anchor
-- (0001). El idioma ya existe en el repo. T7: el ancla musical es OPCIONAL
-- (target_song_id, target_version_id y anchor son nullable) porque no todo
-- material es musical.
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

### 4.7 `education_progress`

```sql
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
-- escribe education_progress_insert_assignment en §4.13.
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

### 4.8 `education_events` — el ledger de XP

```sql
-- POR QUE UN LEDGER Y NO UN CONTADOR: XP total, nivel y racha son sum /
-- count(distinct date) sobre esta tabla. La SUMA ES CONMUTATIVA, asi que dos
-- dispositivos desconectados convergen sin coordinacion. Es lo unico que la cola
-- offline actual maneja bien — y lo unico, porque el contador no lo haria.
--
-- client_uuid es LA clave de idempotencia (R7). Sin UNIQUE, un replay de la cola
-- paga dos veces; con UNIQUE + on conflict do nothing del lado servidor, el
-- replay es un no-op. R7 dice que hoy ningun op es idempotente "por casualidad".
--
-- Append-only. No hay UPDATE ni DELETE policy en §4.13.
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

### 4.9 `education_evaluations`

```sql
-- B3: evaluacion formal (examen o trabajo) de un curso. due_at y max_score son
-- nullable porque una evaluacion puede crearse antes de fijar fecha o escala.
-- No hay tabla de preguntas: el motor complejo de evaluaciones automaticas esta
-- fuera de alcance (proposal, Out of scope).
create table public.education_evaluations (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.education_courses(id) on delete cascade,
  title       text not null,
  kind        text not null,                    -- 'exam' | 'assignment'
  due_at      timestamptz,
  max_score   numeric,
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now(),
  constraint education_evaluations_kind_check check (kind in ('exam','assignment')),
  constraint education_evaluations_max_score_check check (max_score is null or max_score > 0)
);
create index idx_education_evaluations_course on public.education_evaluations (course_id, due_at);
```

### 4.10 `education_grades`

```sql
-- Una calificacion por evaluacion x alumno. La PK compuesta es la misma forma
-- que education_progress y por la misma razon: una sola fila por clave, asi que
-- el replay offline es un no-op.
--
-- graded_by/graded_at son la auditoria minima de "quien califico y cuando".
-- B3 ademas exige `admin_audit_log` (C1/F1): el INSERT/UPDATE de esta tabla
-- debe escribir ahi. El acta no nombra un RPC de calificacion, asi que este
-- documento NO inventa uno; la forma —trigger o funcion— se fija al implementar
-- F3, y la política de escritura de §4.13 es la que hoy la hace alcanzable.
create table public.education_grades (
  evaluation_id uuid not null references public.education_evaluations(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  score         numeric not null,
  feedback      text,
  graded_by     uuid not null references auth.users(id),
  graded_at     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (evaluation_id, user_id)
);
create index idx_education_grades_user on public.education_grades (user_id, graded_at desc);
```

### 4.11 Derivaciones puras de XP y racha

```sql
-- Derivaciones PURAS: reciben p_user_id y no saben quien las llama. Todo lo que
-- sabe quien pregunta esta en el wrapper de §4.15, no aca.
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
--      local no hay NINGUNA entrada de pg_default_acl para el schema `private`.
--      El default no decide nada, asi que la exposicion es la de §2.5: wrapper
--      en `public`, revoke de los tres, grant a authenticated, escrito funcion
--      por funcion.
--
-- La lectura es de la alumna y solo de la alumna. teaching-assignments.feature:105-108
-- dice que Lucia "has practice sessions, a streak, an XP total, and a daily goal
-- of her own" y que Pedro "does not see her practice sessions, their durations,
-- her streak, her XP, or her daily goal"; student-progress.feature:159-163
-- remata que "no other member of the organization can open any of them". Por eso
-- el wrapper NO recibe p_user_id: lo toma de auth.uid().
create or replace function private.education_xp_total(p_user_id uuid)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum(delta), 0)::bigint from public.education_events where user_id = p_user_id;
$$;

-- UNA RACHA ES UNA SECUENCIA CONSECUTIVA. Contar `count(distinct created_at::date)`
-- dentro de una ventana de 30 dias responde "cuantos dias activo", que es otra
-- pregunta, y el BDD la distingue. Tres escenarios la acotan:
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

### 4.12 Cores y wrappers de membresía y matrícula

Los tres cores de **membresía** son los de §2 y no se re-declaran acá: `private.add_org_member_core`, `private.change_member_role_core`, `private.remove_org_member_core`, con sus wrappers `public.add_org_member`, `public.change_member_role` y `public.remove_org_member`. La matrícula los necesita porque un alumno tiene que ser miembro activo de la organización antes de matricularse (T3 → T4), no porque la matrícula los reemplace.

Los dos cores de **matrícula** son T4. El acta prohíbe la auto-matrícula en el BDD, así que la autorización no puede venir de una política `INSERT`: viene de un `SECURITY DEFINER` que revalida al actor y deja la tabla en solo lectura para `authenticated` (§4.14).

> **Literales provisionales.** Los mensajes de error de abajo son texto legible, no los literales BDD: `education-enrollment.feature` se reescribe en F3 y sus cadenas exactas se copian a las funciones cuando existan. No se inventan acá cadenas que el BDD todavía no fijó.

```sql
-- Ofrece el scope de la oferta sin revelar su existencia a quien no es miembro:
-- devuelve boolean, no lanza. El wrapper publico lo usa para el guard de "no
-- autorizado"; la RLS no lo necesita.
create or replace function private.is_org_member_of_offering(p_offering_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.education_course_offerings o
    join public.education_courses c on c.id = o.course_id
    where o.id = p_offering_id
      and private.is_org_member(p_user_id, c.org_id) is not null
  );
$$;

-- ═══════════════ alta de matrícula ═══════════════
-- Guards, en el orden que 0018:459-460 fija: "no visible" primero, "no
-- autorizado" despues. Un guard que confirma existencia antes de autorizar
-- convierte el mensaje de error en un oraculo de ids.
create or replace function private.enroll_student_core(
  p_offering_id uuid,
  p_student_id  uuid,
  p_role        text default 'student'
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := (select auth.uid());
  v_org_id uuid;
  v_minor  boolean;
  v_id     uuid;
begin
  if v_actor is null then
    raise exception 'You must be signed in.';
  end if;

  select c.org_id into v_org_id
  from public.education_course_offerings o
  join public.education_courses c on c.id = o.course_id
  where o.id = p_offering_id;
  if not found then
    raise exception 'Offering not found.';
  end if;

  -- Quien matricula es staff academico DE ESA organizacion. session_role_in
  -- (0002:26) exige status='active' en esa org, asi que el instructor de
  -- "Orquesta Ciudad Norte" no pasa.
  if not private.session_role_in(v_actor, v_org_id,
       array['instructor','branch_admin','org_admin','org_owner']) then
    raise exception 'Only academic staff can enroll students.';
  end if;

  -- El alumno tiene que ser miembro activo de la organizacion. is_org_member
  -- devuelve TEXT y su NULL es "no es miembro" (0002:14); el `is null` es la
  -- negativa.
  if private.is_org_member(p_student_id, v_org_id) is null then
    raise exception 'The student is not a member of the organization.';
  end if;

  -- SOD: nadie se matricula a si mismo. El BDD lo prohibe explicitamente.
  if p_student_id = v_actor then
    raise exception 'A staff member cannot enroll themselves.';
  end if;

  if p_role not in ('student','instructor') then
    raise exception 'Unknown enrollment role.';
  end if;

  -- D1 + B4: un menor necesita consentimiento educativo vigente. Las columnas
  -- educational_data_access y expires_at las agrega la migracion de F6; por eso
  -- esa extension tiene que aterrizar a mas tardar junto con F3, o este guard
  -- no compila. `expires_at` nullable = sin vencimiento explicito.
  select p.is_minor into v_minor from public.profiles p where p.id = p_student_id;
  if coalesce(v_minor, false) and not exists (
    select 1 from public.guardian_consents g
    where g.user_id = p_student_id
      and g.status = 'active'
      and g.educational_data_access
      and (g.expires_at is null or g.expires_at > now())
  ) then
    raise exception 'Guardian consent for educational data is required.';
  end if;

  -- Reactivacion: una matricula retirada vuelve con el mismo id y una fecha de
  -- baja limpia. El `do update` NO toca `role`: un replay no puede re-rolar a
  -- alguien que ya estaba matriculado.
  insert into public.education_enrollments (offering_id, user_id, role, status)
  values (p_offering_id, p_student_id, p_role, 'active')
  on conflict (offering_id, user_id) do update
    set status = 'active', withdrawn_at = null
  returning id into v_id;

  insert into public.admin_audit_log
    (actor_id, actor_org_ids, action, subject_table, subject_id, detail)
  values (v_actor, array[v_org_id], 'enrollment.add', 'education_enrollments', v_id,
          jsonb_build_object('offering_id', p_offering_id, 'user_id', p_student_id, 'role', p_role));

  return v_id;
end $$;
```

```sql
-- ═══════════════ baja de matrícula ═══════════════
-- NO se borra la fila: status pasa a 'withdrawn' y se graba withdrawn_at.
-- Borrar perderia el historial que B3 necesita para reportes y que el BDD de
-- "reactivar" usa como punto de partida.
create or replace function private.withdraw_student_core(p_enrollment_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := (select auth.uid());
  v_org_id uuid;
  v_status text;
begin
  if v_actor is null then
    raise exception 'You must be signed in.';
  end if;

  select c.org_id, e.status into v_org_id, v_status
  from public.education_enrollments e
  join public.education_course_offerings o on o.id = e.offering_id
  join public.education_courses c on c.id = o.course_id
  where e.id = p_enrollment_id;
  if not found then
    raise exception 'Enrollment not found.';
  end if;

  if not private.session_role_in(v_actor, v_org_id,
       array['instructor','branch_admin','org_admin','org_owner']) then
    raise exception 'Only academic staff can withdraw students.';
  end if;

  if v_status = 'withdrawn' then
    raise exception 'The enrollment is already withdrawn.';
  end if;

  update public.education_enrollments
  set status = 'withdrawn', withdrawn_at = now()
  where id = p_enrollment_id;

  insert into public.admin_audit_log
    (actor_id, actor_org_ids, action, subject_table, subject_id, detail)
  values (v_actor, array[v_org_id], 'enrollment.withdraw', 'education_enrollments',
          p_enrollment_id, '{}'::jsonb);
end $$;
```

```sql
-- Wrappers publicos: PostgREST no alcanza `private` (supabase/config.toml:13),
-- asi que la superficie publica solo delega. Mismo patron que §2.5.
create or replace function public.enroll_student(
  p_offering_id uuid,
  p_student_id  uuid,
  p_role        text default 'student'
)
returns uuid language sql security definer set search_path = '' as $$
  select private.enroll_student_core(p_offering_id, p_student_id, p_role);
$$;

create or replace function public.withdraw_student(p_enrollment_id uuid)
returns void language sql security definer set search_path = '' as $$
  select private.withdraw_student_core(p_enrollment_id);
$$;
```

### 4.13 RLS del núcleo académico

Orden D6 por tabla: `enable RLS` → `force` → `revoke all` → políticas → `grant` dirigido (§4.14). **El grafo de políticas tiene que ser acíclico** (`0002:136-141`): cada tabla hija resuelve su scope con un `EXISTS` de una sola relación hacia arriba, y ninguna política mira hacia abajo.

```
academic_periods          -> org_memberships
education_courses         -> org_memberships
education_subjects (cond) -> org_memberships
offerings                 -> education_courses, academic_periods, branches
enrollments               -> offerings -> courses -> org_memberships
exercises                 -> courses -> org_memberships
progress                  -> exercises -> courses -> org_memberships
evaluations               -> courses -> org_memberships
grades                    -> evaluations -> courses -> org_memberships
                          -> enrollments -> offerings -> courses
```

Ninguna flecha apunta hacia abajo. Si una política de `courses` llegara a tocar `progress`, el grafo cierra y Postgres devuelve `42P17` en tiempo de plan, no en desarrollo.

```sql
alter table public.academic_periods           enable row level security;
alter table public.education_courses          enable row level security;
alter table public.education_course_offerings enable row level security;
alter table public.education_enrollments      enable row level security;
alter table public.education_exercises        enable row level security;
alter table public.education_progress         enable row level security;
alter table public.education_events           enable row level security;
alter table public.education_evaluations      enable row level security;
alter table public.education_grades           enable row level security;

alter table public.academic_periods           force row level security;
alter table public.education_courses          force row level security;
alter table public.education_course_offerings force row level security;
alter table public.education_enrollments      force row level security;
alter table public.education_exercises        force row level security;
alter table public.education_progress         force row level security;
alter table public.education_events           force row level security;
alter table public.education_evaluations      force row level security;
alter table public.education_grades           force row level security;

revoke all on table public.academic_periods           from public, anon, authenticated;
revoke all on table public.education_courses          from public, anon, authenticated;
revoke all on table public.education_course_offerings from public, anon, authenticated;
revoke all on table public.education_enrollments      from public, anon, authenticated;
revoke all on table public.education_exercises        from public, anon, authenticated;
revoke all on table public.education_progress         from public, anon, authenticated;
revoke all on table public.education_events           from public, anon, authenticated;
revoke all on table public.education_evaluations      from public, anon, authenticated;
revoke all on table public.education_grades           from public, anon, authenticated;
```

```sql
-- ── academic_periods: la org lo lee, el staff academico lo escribe ──
drop policy if exists academic_periods_select_member on public.academic_periods;
create policy academic_periods_select_member on public.academic_periods
  for select to authenticated
  using ((select auth.uid()) is not null
         and private.is_org_member((select auth.uid()), org_id) is not null);

drop policy if exists academic_periods_write_staff on public.academic_periods;
create policy academic_periods_write_staff on public.academic_periods
  for all to authenticated
  using ((select auth.uid()) is not null
         and private.session_role_in((select auth.uid()), org_id,
              array['instructor','branch_admin','org_admin','org_owner']))
  with check ((select auth.uid()) is not null
         and private.session_role_in((select auth.uid()), org_id,
              array['instructor','branch_admin','org_admin','org_owner']));
```

```sql
-- ── education_courses ──
-- `is_org_member` devuelve TEXT (0002:14) porque su NULL es el "no es miembro";
-- las llamadas que ya existen lo convierten con `is not null` (0016:73,
-- 0018:112, 0019:238, 0034:196, 0035:47 …). Sin eso, `boolean and text` no
-- resuelve y el CREATE POLICY falla en el momento de crearse.
--
-- Y el filtro de status NO es opcional: sin el, un curso en 'draft' es visible
-- para todo miembro de la org. education-courses-and-exercises.feature:18-24
-- afirma lo contrario —"A course stays a draft until the instructor publishes
-- it" — y :21-22 dice que el alumno la ve solo despues de que Pedro publica.
-- El patron de esta politica es el mismo de songs_select_org (0016:129-134):
-- la pertenencia da el alcance y una columna mas da el filtro.
--
-- Las tablas hijas repiten el filtro de draft porque RLS NO compone entre
-- tablas: una politica de exercises no hereda la de courses.
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

-- courses: ESCRIBEN los cuatro roles de planta, no dos. Los 26 escenarios de
-- autoria los lleva Pedro, que es instructor: `Given instructor "Pedro" belongs
-- to "Academia Musical"` (courses-and-exercises.feature:11). El es quien crea el
-- curso (:14), lo publica (:23), mueve un ejercicio de posicion (:46), le apunta
-- una cancion (:57), le escribe instrucciones (:101) y lo quita (:108).
--
-- El rol que NO entra es el quinto: un member de la org —Lucia— no escribe.
drop policy if exists education_courses_write_admin on public.education_courses;
drop policy if exists education_courses_write_staff on public.education_courses;
create policy education_courses_write_staff on public.education_courses
  for all to authenticated
  using ((select auth.uid()) is not null and private.session_role_in((select auth.uid()), org_id, array['instructor','branch_admin','org_admin','org_owner']))
  with check ((select auth.uid()) is not null and private.session_role_in((select auth.uid()), org_id, array['instructor','branch_admin','org_admin','org_owner']));
```

```sql
-- ── education_subjects: SOLO si la tabla condicional se crea ──
-- No hereda la politica del curso: la asignatura existe por organizacion, no por
-- curso, y sin politica propia quedaria con RLS activo y cero filas visibles.
alter table public.education_subjects enable row level security;
alter table public.education_subjects force row level security;
revoke all on table public.education_subjects from public, anon, authenticated;

drop policy if exists education_subjects_select_member on public.education_subjects;
create policy education_subjects_select_member on public.education_subjects
  for select to authenticated
  using ((select auth.uid()) is not null
         and private.is_org_member((select auth.uid()), org_id) is not null);

drop policy if exists education_subjects_write_staff on public.education_subjects;
create policy education_subjects_write_staff on public.education_subjects
  for all to authenticated
  using ((select auth.uid()) is not null
         and private.session_role_in((select auth.uid()), org_id,
              array['instructor','branch_admin','org_admin','org_owner']))
  with check ((select auth.uid()) is not null
         and private.session_role_in((select auth.uid()), org_id,
              array['instructor','branch_admin','org_admin','org_owner']));
```

```sql
-- ── education_course_offerings ──
drop policy if exists education_course_offerings_select_member on public.education_course_offerings;
create policy education_course_offerings_select_member on public.education_course_offerings
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.education_courses c
      where c.id = course_id
        and private.is_org_member((select auth.uid()), c.org_id) is not null
        and (c.status <> 'draft' or c.created_by = (select auth.uid())
             or private.session_role_in((select auth.uid()), c.org_id,
                  array['instructor','branch_admin','org_admin','org_owner']))
    )
  );

-- Escritura: staff del curso, y ADEMAS coherencia de periodo y sede con la
-- organizacion del curso. Sin los dos EXISTS, un staff de la org A puede colgar
-- su oferta de un periodo de la org B adivinando un uuid.
drop policy if exists education_course_offerings_write_staff on public.education_course_offerings;
create policy education_course_offerings_write_staff on public.education_course_offerings
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
    and exists (select 1 from public.academic_periods p
                join public.education_courses cp on cp.id = course_id
                where p.id = period_id and p.org_id = cp.org_id)
    and (branch_id is null or exists (
           select 1 from public.branches b
           join public.education_courses cb on cb.id = course_id
           where b.id = branch_id and b.org_id = cb.org_id))
  );
```

```sql
-- ── education_enrollments: solo LECTURA ──
-- El alumno ve lo suyo; el staff ve las de sus cursos. No hay INSERT/UPDATE/
-- DELETE: la escritura es el RPC de §4.12 (T4). Un grant de escritura aca
-- reabriria la auto-matricula que el BDD prohibe.
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
      select 1
      from public.education_course_offerings o
      join public.education_courses c on c.id = o.course_id
      where o.id = offering_id
        and private.session_role_in((select auth.uid()), c.org_id,
             array['instructor','branch_admin','org_admin','org_owner'])
    )
  );
```

```sql
-- ── education_exercises ──
-- La visibilidad se hereda del curso. UNA sola relacion hacia arriba
-- (0002:136-141), y el filtro de draft se repite por la misma razon que en
-- §4.13 courses: RLS no compone.
drop policy if exists education_exercises_select_member on public.education_exercises;
create policy education_exercises_select_member on public.education_exercises
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (select 1 from public.education_courses c
                where c.id = course_id
                  and private.is_org_member((select auth.uid()), c.org_id) is not null
                  and (c.status <> 'draft' or c.created_by = (select auth.uid())
                       or private.session_role_in((select auth.uid()), c.org_id,
                            array['instructor','branch_admin','org_admin','org_owner'])))
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
```

```sql
-- ── education_progress: aqui vive D8, y es la politica mas importante ──
-- EL ALUMNO: ve y escribe su propia fila.
-- EL DOCENTE: ve status y completed_at de los alumnos de SUS cursos. Y nada mas.
-- No ve notes, ni score, ni attempts si la politica no lo dice: `notes` es una
-- COLUMNA y la protege el grant por columnas de §4.14, no una politica. Una
-- politica de RLS no sabe de columnas.
--
-- LO QUE SE CORRIGIO: el bloque anterior tenia DOS politicas —INSERT y DELETE—
-- y ninguna de SELECT ni de UPDATE, mientras el grant daba la tabla entera. Con
-- FORCE RLS el resultado era el peor: TODO SELECT y TODO UPDATE morian con
-- `42501 new row violates row-level security policy`, sin que el cliente viera
-- por que. De ahi las cinco de abajo.
--
-- ── SELECT del alumno ──
drop policy if exists education_progress_select_own on public.education_progress;
create policy education_progress_select_own on public.education_progress
  for select to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

-- ── SELECT del docente ──
-- Filas de cursos donde es instructor o superior DE SU organizacion. El
-- session_role_in deja afuera al instructor de "Orquesta Ciudad Norte" sin que
-- el curso se revele (:48-53).
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

-- ── INSERT del docente (asignar trabajo) ──
-- teaching-assignments.feature:27-32 y :34-39 se ejecutan con un INSERT sobre
-- la fila de Lucia: el modelo dobla la asignacion en assigned_by/assigned_at.
-- TRES restricciones, cada una atada a un escenario:
--   assigned_by = auth.uid()  -> el docente ve SU propio reparto, :32.
--   status = 'pending'        -> el trabajo entregado entra como Pendiente, :15.
--   el alumno esta matriculado -> :41-46: Sofia no esta en el curso y el INSERT
--                                 no tiene por donde pasar. La matricula ahora
--                                 es contra la OFERTA: se recorre
--                                 exercise -> course -> offering -> enrollment.
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
      join public.education_course_offerings o on o.course_id = c.id
      join public.education_enrollments n
        on n.offering_id = o.id and n.user_id = education_progress.user_id
      where e.id = exercise_id
        and n.status = 'active'
        and private.session_role_in((select auth.uid()), c.org_id,
             array['instructor','branch_admin','org_admin','org_owner'])
    )
  );

-- RETIRAR TRABAJO (teaching-assignments.feature:55-60) queda a medias y hay que
-- decirlo: el DELETE resuelve :59 —"it is no longer on Lucia's learning path as
-- work to do"— y NO :60 —"Pedro's record of what he handed out shows it as
-- withdrawn". education_progress no tiene campo withdrawn y borrar la fila no
-- deja rastro. Cerrar :60 pide `withdrawn_at`/`withdrawn_by` aca, o la tabla
-- `education_work` que el proposal nombra para exactamente esto. No resuelto, y
-- no se resuelve con una politica.
drop policy if exists education_progress_delete_own_assignment on public.education_progress;
create policy education_progress_delete_own_assignment on public.education_progress
  for delete to authenticated
  using (
    (select auth.uid()) is not null
    and assigned_by = (select auth.uid())
    and status = 'pending'
  );

-- ── UPDATE del alumno ──
-- student-progress.feature:41-45 (abrir => in_progress), :19-26 y :66-71
-- (completar graba status y completed_at), :47-51 (rehacer conserva la fecha
-- original y suma un intento), teaching-assignments.feature:111 (la nota
-- privada). Lo que la alumna NO puede mover lo decide el grant por columnas de
-- §4.14: `assigned_by`/`assigned_at` y `score` quedan afuera.
drop policy if exists education_progress_update_own on public.education_progress;
create policy education_progress_update_own on public.education_progress
  for update to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));
```

```sql
-- ── education_events: el ledger es del alumno y NADIE mas ──
-- practice-mode.feature:139 dice que la practica no es visible a los companeros
-- "or the organization"; el XP derivado tampoco lo es.
drop policy if exists education_events_select_own on public.education_events;
create policy education_events_select_own on public.education_events
  for select to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

-- La idempotencia NO vive aca. `client_uuid` es la PRIMARY KEY (§4.8), asi que
-- un replay choca con la clave y el cliente lo resuelve con `on conflict do
-- nothing`. Un `not exists (select 1 from education_events …)` dentro de la
-- politica de la misma tabla es la recursion que 0002:136-141 prohibe: con
-- FORCE, Postgres evalua la politica contra si misma y devuelve 42P17 en plan.
-- El WITH CHECK de INSERT protege columnas; la unicidad la pone el indice. Son
-- dos cosas y hacen falta las dos.
drop policy if exists education_events_insert_own on public.education_events;
create policy education_events_insert_own on public.education_events
  for insert to authenticated
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

-- Sin UPDATE. Sin DELETE. Es un ledger.
```

```sql
-- ── education_evaluations ──
drop policy if exists education_evaluations_select_member on public.education_evaluations;
create policy education_evaluations_select_member on public.education_evaluations
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (select 1 from public.education_courses c
                where c.id = course_id
                  and private.is_org_member((select auth.uid()), c.org_id) is not null
                  and (c.status <> 'draft' or c.created_by = (select auth.uid())
                       or private.session_role_in((select auth.uid()), c.org_id,
                            array['instructor','branch_admin','org_admin','org_owner'])))
  );

drop policy if exists education_evaluations_write_staff on public.education_evaluations;
create policy education_evaluations_write_staff on public.education_evaluations
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
```

```sql
-- ── education_grades ──
-- El alumno ve sus notas; el staff ve las de sus cursos. Escribir es del staff,
-- y `graded_by = auth.uid()` es lo que impide atribuir una nota a otro.
drop policy if exists education_grades_select_own on public.education_grades;
create policy education_grades_select_own on public.education_grades
  for select to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists education_grades_select_staff on public.education_grades;
create policy education_grades_select_staff on public.education_grades
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.education_evaluations v
      join public.education_courses c on c.id = v.course_id
      where v.id = evaluation_id
        and private.session_role_in((select auth.uid()), c.org_id,
             array['instructor','branch_admin','org_admin','org_owner'])
    )
  );

-- INSERT: el docente califica a un alumno matriculado en alguna oferta del
-- curso de la evaluacion, y se atribuye la nota a si mismo. El EXISTS de
-- matricula es la misma regla de :41-46 que usa la asignacion de trabajo.
drop policy if exists education_grades_insert_staff on public.education_grades;
create policy education_grades_insert_staff on public.education_grades
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and graded_by = (select auth.uid())
    and exists (
      select 1
      from public.education_evaluations v
      join public.education_courses c on c.id = v.course_id
      join public.education_course_offerings o on o.course_id = c.id
      join public.education_enrollments n
        on n.offering_id = o.id and n.user_id = education_grades.user_id
      where v.id = evaluation_id
        and n.status = 'active'
        and private.session_role_in((select auth.uid()), c.org_id,
             array['instructor','branch_admin','org_admin','org_owner'])
    )
  );

drop policy if exists education_grades_update_staff on public.education_grades;
create policy education_grades_update_staff on public.education_grades
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.education_evaluations v
      join public.education_courses c on c.id = v.course_id
      where v.id = evaluation_id
        and private.session_role_in((select auth.uid()), c.org_id,
             array['instructor','branch_admin','org_admin','org_owner'])
    )
  )
  with check (
    (select auth.uid()) is not null
    and graded_by = (select auth.uid())
    and exists (
      select 1
      from public.education_evaluations v
      join public.education_courses c on c.id = v.course_id
      where v.id = evaluation_id
        and private.session_role_in((select auth.uid()), c.org_id,
             array['instructor','branch_admin','org_admin','org_owner'])
    )
  );

-- Sin DELETE: una nota es historia, igual que el ledger de XP.
```

### 4.14 Grants del núcleo académico

Orden D6: los `revoke all` de §4.13 van **antes** de las políticas, y estos `grant` dirigidos **después**. Sin esta parte el bloque anterior no hace nada: `revoke all … from authenticated` deja a `authenticated` sin privilegio de tabla, y sin privilegio **la política es inalcanzable** — la fila pasa el `USING` y el INSERT nunca llega a evaluarse. El error sale como `42501 permission denied for table`, no como un fallo de RLS, y por eso no lo detecta ninguna prueba de lectura.

```sql
-- periods y subjects: el catalogo se lee y se mantiene; el DELETE no, porque
-- una oferta puede depender de ellos (period_id es ON DELETE RESTRICT).
grant select, insert, update on table public.academic_periods to authenticated;
grant select, insert, update on table public.education_subjects to authenticated;  -- SOLO si la tabla condicional existe

-- courses: el miembro lo lee (select_member), el staff de la org lo escribe
-- (write_staff). El DELETE no tiene politica: un curso se archiva, no se borra,
-- y el ON DELETE CASCADE de §4.2 lo haria desaparecer con sus ejercicios y el
-- progreso de todos los alumnos.
grant select, insert, update on table public.education_courses to authenticated;

-- offerings: mismo criterio que courses. La oferta se cierra o se archiva en el
-- curso; borrarla se llevaria la matricula (ON DELETE CASCADE de §4.5).
grant select, insert, update on table public.education_course_offerings to authenticated;

-- enrollments: SOLO lectura. Quien matricula es T4 y vive en el RPC de §4.12.
-- Conceder INSERT aca seria reabrir la auto-matricula que el BDD prohibe.
grant select on table public.education_enrollments to authenticated;

-- exercises: se elimina un ejercicio de la lista, la fila se borra
-- (courses-and-exercises.feature:106), y por eso aqui si hay DELETE.
grant select, insert, update, delete on table public.education_exercises to authenticated;

-- events: el alumno lee y escribe SU ledger. Ni UPDATE ni DELETE, porque el
-- BDD exige que un evento equivocado se corrija con otro evento, no editando
-- (education-student-progress.feature:63-68).
grant select, insert on table public.education_events to authenticated;

-- evaluations: el staff crea y corrige la evaluacion. DELETE no: borrarla se
-- lleva las notas por CASCADE.
grant select, insert, update on table public.education_evaluations to authenticated;

-- grades: se leen, se insertan y se corrigen. DELETE no: es historia.
grant select, insert, update on table public.education_grades to authenticated;

-- ── education_progress: los unicos permisos POR COLUMNA del nucleo ──
-- El SELECT va por columnas, y es el corazon del bloque. Dos motivos:
--   · lo que el BDD le da al docente es "which exercises she completed and when"
--     (:107) y "that he gave it to Lucia and when" (:32) — exercise_id, user_id,
--     status, completed_at, assigned_by, assigned_at. Ni `notes` (:111-115), ni
--     `score`, ni `attempts` (la negativa de :108).
--   · `authenticated` es UN SOLO ROL para Lucia y para Pedro, asi que no existe
--     un privilegio que le conceda a uno mas que al otro. El cap de columnas es
--     lo que hace que education_progress_select_staff no pueda abrir `notes`.
-- `notes` vuelve a ser legible para la alumna por el wrapper
-- public.education_my_progress() de §4.15, que proyecta la fila entera desde un
-- SECURITY DEFINER.
--
-- NO substitutes esto por `grant select on table public.education_progress`:
-- reabre `notes` para todo `authenticated` que pase la politica, y el error es
-- invisible porque el `RETURNING` del cliente tampoco lo pide.
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

### 4.15 Wrappers de lectura propia y permisos de función

Mismo patrón que §2.5: núcleo de derivación en `private`, superficie en `public`, `revoke` de los tres y `grant` a `authenticated` escrito función por función.

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
```

```sql
-- ═══ 3. Permisos de funcion ═══
-- `revoke` de los TRES en los nucleos, no de dos: los privilegios por defecto de
-- `private` se reescriben en cada `alter default privileges` y las dos
-- statements del repo no coinciden (0002:42 vs 0016:54). Un privilegio explicito
-- por funcion es lo unico que no depende de ese default.
--
-- Los nucleos NO reciben `grant execute` a `authenticated`, y es deliberado:
-- reciben `p_user_id` (o el id de la oferta), y mantenerlos fuera de la
-- superficie es la segunda mitad del mismo argumento que hace que los wrappers
-- no lleven parametro de usuario. Concederles ejecucion abriria por detras la
-- lectura de cualquier XP, cualquier racha y cualquier matricula.
revoke execute on function private.education_xp_total(uuid)              from public, anon, authenticated;
revoke execute on function private.education_streak(uuid, text)          from public, anon, authenticated;
revoke execute on function private.is_org_member_of_offering(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.enroll_student_core(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function private.withdraw_student_core(uuid)           from public, anon, authenticated;
revoke execute on function public.education_my_progress()                from public, anon;
revoke execute on function public.education_xp_total()                   from public, anon;
revoke execute on function public.education_streak(text)                 from public, anon;
revoke execute on function public.enroll_student(uuid, uuid, text)       from public, anon;
revoke execute on function public.withdraw_student(uuid)                 from public, anon;

grant execute on function public.education_my_progress()                to authenticated;
grant execute on function public.education_xp_total()                   to authenticated;
grant execute on function public.education_streak(text)                 to authenticated;
grant execute on function public.enroll_student(uuid, uuid, text)       to authenticated;
grant execute on function public.withdraw_student(uuid)                 to authenticated;
```

#### La pregunta de `SECURITY DEFINER` contra `force row level security`

`education_events` lleva `force row level security` y sus únicas políticas son `education_events_select_own` e `education_events_insert_own`, ambas con `user_id = auth.uid()`. Una `SECURITY DEFINER` cuyo dueño **no** tuviera `BYPASSRLS` leería la tabla como su dueño y, por RLS, vería solo las filas de quien la llamó.

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
```

Que los `SECURITY DEFINER` que ya existen en el repo tengan al mismo dueño no es casualidad: es la razón por la que `org_leave` puede hacer `update org_memberships` sobre una tabla que F1 le pone `FORCE`. Si alguna vez las migraciones se aplicaran con un dueño sin `BYPASSRLS`, estas derivaciones seguirían siendo correctas por el párrafo anterior — y perderían la capacidad de ver filas ajenas, que no necesitan.

**Una anomalía que conviene que un revisor vea, y que no puedo resolver sin escribir en la base.** `pg_default_acl` **no tiene ninguna fila para el schema `private`**, pese a que `0002:42` y `0016:54` ejecutan `alter default privileges in schema private`. Y `private.build_plan_snapshot(uuid)`, que crea `0034_plan_freeze.sql:41` —es decir, después de las dos statements—, conserva el `proacl` por defecto y `anon` puede ejecutarla. No afirmo por qué: separar las hipótesis exige una escritura, que el encargo de este documento prohíbe. Lo que sí es un hecho es que **el default de privilegios de `private` no es observable en esta base**, así que el `revoke`/`grant` explícito no es higiene, es el mecanismo.

## 5. F4 — Eventos extendidos, espacios y sesiones

**Este contexto ya no es "cero migración".** Lo era con el diseño anterior; B6, T1, T2 y D2 lo cambian. Lo que sigue siendo cierto es que **el calendario no se duplica**: las actividades institucionales extienden `events`, no crean una tabla paralela.

### 5.1 Lo que ya existe y no se toca

| | |
|---|---|
| Tablas | `events`, `event_participants`, `event_rsvps`, `event_setlists`, `venues` — `0001:241-290` |
| RLS | **4, 4, 3 y 4** políticas en `0016`, en ese orden. Las cuatro de `venues` son de `0004:43-60` |
| Grants | `0016:554-558` devuelve `select, insert, update, delete` a `authenticated` en las tres primeras y `select, insert, update` en `event_rsvps` |
| Decisión de diseño | La de `0016`: *"Event-owned, read-only for all participants"* |

> **Recuento, con su comando.** Las cifras son **4, 4, 3 y 4**, y este es el comando que las re-deriva:
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
> El `sort -u` es lo que descuplica los nombres reescritos por `0020_review_batch1.sql:184,201,230`: `event_participants_insert_organizer`, `_update_organizer` y `event_setlists_update_organizer` se crean otra vez **con los mismos nombres**, así que reemplazan y no suman.

### 5.2 Lo que agrega F4

| Objeto | Decisión | Qué es |
|---|---|---|
| `spaces` | T1 | aulas/salones org-scoped, con sede, capacidad y equipamiento. `venues` es owner-scoped y `gigs` depende de eso; no se reutiliza |
| `education_sessions` | T2 | clase fechada con salón e instructor, ligada a una oferta de F3. `rehearsals` es ensayo con setlist, no clase con alumnos |
| `recurrence_patterns` | D2 | `(freq, interval, weekdays[], end_date)`, tabla propia en vez de una cadena iCal |
| `events` extendido | B6 | columnas **nullable** `academic_type`, `space_id`, `recurrence_rule`, `session_number`; las filas musicales existentes no cambian |
| RPC de conflictos | proposal F4 | detecta solapamiento de salón/instructor antes de crear la sesión |

Como las columnas nuevas son nullable y no hay `NOT NULL` sobre eventos existentes, `supabase db reset` no reescribe ninguna fila y el flujo musical (gigs, ensayos, eventos cross-org) sigue igual.

### 5.3 El hallazgo que F4 no puede ignorar

`events_select_any_auth` (`0016:184-187`) es `using ((select auth.uid()) is not null)`: **cualquier usuario autenticado ve todos los eventos**. Hoy eso es aceptable porque un evento musical es una convocatoria; con B6, una clase con `academic_type` y `space_id` pasaría a ser visible para toda la plataforma.

Por eso la extensión de B6 **no es solo DDL**: F4 tiene que acotar la política de `events` para que un evento académico se resuelva por la organización dueña o por participación, igual que el resto del modelo org-scoped. Queda como trabajo de la migración F4, no como nota — y es la razón por la que este documento no puede seguir diciendo "cero migración".

## 6. F7 — Inventario y préstamos

Diseño de F7 (acta, tablas 14–17). **Sigue siendo la parte más débil de la ampliación**, y por la misma razón que antes: no pasó por el filtro que la auditoría de Education aplicó a Education. Lo que cambió es el nombre: `inventory_` en todas las tablas, para que el inventario no se confunda con los activos musicales ni con `services`.

```sql
-- ═══════════════ 6.1 inventory_asset_types ═══════════════
-- Catalogo de QUE clase de equipo existe. specs_schema dice que campos técnicos
-- espera el tipo, para que el formulario de alta no tenga que hardcodear guitarra
-- y amplificador por separado.
--
-- Es un catalogo GLOBAL, no org-scoped: el acta no le da org_id. Si el producto
-- lo quiere por organizacion, es una columna mas y una politica mas; hoy NO la
-- tiene y ese es el limite conocido de esta tabla.
create table public.inventory_asset_types (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  category      text not null,      -- 'instrument' | 'audio' | 'amplification' | 'accessory' | 'other'
  specs_schema  jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  constraint inventory_asset_types_category_check
    check (category in ('instrument','audio','amplification','accessory','other'))
);
```

```sql
-- ═══════════════ 6.2 inventory_assets ═══════════════
-- UNA UNIDAD FISICA por fila, no un tipo de equipo. Un inventario que cuenta
-- "3 amplifiers" no puede decir cual se rompio ni quien lo tiene.
--
-- org_id + branch_id replican la pertenencia organizacional: un equipo pertenece
-- a una sede. SI el modelo fuera "compartido entre toda la organizacion",
-- branch_id queda NULL y la politica lo resuelve.
create table public.inventory_assets (
  id           uuid primary key default gen_random_uuid(),
  asset_type_id uuid not null references public.inventory_asset_types(id) on delete restrict,
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
  constraint inventory_assets_status_check
    check (status in ('available','loaned','maintenance','retired'))
);
create unique index inventory_assets_org_label_unique on public.inventory_assets (org_id, label);
create index idx_inventory_assets_org_status on public.inventory_assets (org_id, status);
```

```sql
-- ═══════════════ 6.3 inventory_loans ═══════════════
-- event_id es la vinculacion directa al evento que pide el requerimiento #11.
-- on delete set null: si se cancela el evento, el prestamo NO se borra — el
-- equipo sigue prestado y hay que devolverlo.
--
-- session_id es la vinculacion a una clase (F4). Son dos columnas y no una
-- polimorfica: el evento y la sesion son tablas distintas con ciclos de vida
-- distintos, y una FK condicional no existe en Postgres.
create table public.inventory_loans (
  id              uuid primary key default gen_random_uuid(),
  asset_id        uuid not null references public.inventory_assets(id) on delete cascade,
  holder_user_id  uuid not null references auth.users(id),
  assigned_by     uuid not null references auth.users(id),
  event_id        uuid references public.events(id) on delete set null,
  session_id      uuid references public.education_sessions(id) on delete set null,  -- F4; F7 depende de F4
  checked_out_at  timestamptz not null default now(),
  due_at          timestamptz,
  returned_at     timestamptz,
  condition_out   text,
  condition_in    text,
  notes           text,
  constraint inventory_loans_return_order
    check (returned_at is null or returned_at >= checked_out_at)
);

-- UN EQUIPO NO PUEDE ESTAR PRESTADO DOS VECES. Indice unico parcial sobre el
-- estado abierto — no sobre (asset_id, holder), porque un equipo vuelve y vuelve
-- a salir. Es la regla que hace que "prestado" sea un estado del DATOS y no un
-- estado que la interfaz mantiene.
create unique index inventory_loans_one_open_per_asset
  on public.inventory_loans (asset_id) where returned_at is null;

create index idx_inventory_loans_holder on public.inventory_loans (holder_user_id, checked_out_at desc);
create index idx_inventory_loans_event  on public.inventory_loans (event_id) where event_id is not null;
```

`condition_out` y `condition_in` son campos distintos a propósito: es lo que permite "se prestó roto" como hallazgo posterior y no como memoria de alguien.

```sql
-- ═══════════════ 6.4 inventory_movements — CONDICIONAL ═══════════════
-- Solo si hay transferencias entre sedes (requisito #21). Sin transferencias, la
-- tabla no se escribe: una fila por mudanza de equipo que nunca ocurre es deuda.
create table public.inventory_movements (
  id             uuid primary key default gen_random_uuid(),
  asset_id       uuid not null references public.inventory_assets(id) on delete cascade,
  from_branch_id uuid references public.branches(id) on delete set null,
  to_branch_id   uuid references public.branches(id) on delete set null,
  moved_by       uuid not null references auth.users(id),
  moved_at       timestamptz not null default now(),
  notes          text,
  constraint inventory_movements_branch_check
    check (from_branch_id is distinct from to_branch_id)
);
create index idx_inventory_movements_asset on public.inventory_movements (asset_id, moved_at desc);
```

### 6.5 RLS de F7

```sql
alter table public.inventory_asset_types enable row level security;
alter table public.inventory_assets      enable row level security;
alter table public.inventory_loans       enable row level security;

alter table public.inventory_asset_types force row level security;
alter table public.inventory_assets      force row level security;
alter table public.inventory_loans       force row level security;

revoke all on table public.inventory_asset_types from public, anon, authenticated;
revoke all on table public.inventory_assets      from public, anon, authenticated;
revoke all on table public.inventory_loans       from public, anon, authenticated;

-- ── inventory_assets: la org que los posee ──
drop policy if exists inventory_assets_select_member on public.inventory_assets;
create policy inventory_assets_select_member on public.inventory_assets
  for select to authenticated
  using ((select auth.uid()) is not null and private.is_org_member((select auth.uid()), org_id) is not null);

-- El branch_admin ve los de su sede (columna 1 del requisito).
drop policy if exists inventory_assets_select_branch_admin on public.inventory_assets;
create policy inventory_assets_select_branch_admin on public.inventory_assets
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and private.session_role_in((select auth.uid()), org_id, array['branch_admin'])
    and branch_id = any (select private.user_branch_ids((select auth.uid())))
  );

-- Escriben los roles administrativos, no el instructor: dar de alta un activo,
-- retirarlo o mandarlo a mantenimiento es administracion de sede. El conjunto es
-- el mas chico que puede correr los escenarios de inventory-assets; si el BDD
-- necesita que un instructor lo haga, esta politica es donde se cambia.
drop policy if exists inventory_assets_write_staff on public.inventory_assets;
create policy inventory_assets_write_staff on public.inventory_assets
  for all to authenticated
  using ((select auth.uid()) is not null
         and private.session_role_in((select auth.uid()), org_id,
              array['branch_admin','org_admin','org_owner']))
  with check ((select auth.uid()) is not null
         and private.session_role_in((select auth.uid()), org_id,
              array['branch_admin','org_admin','org_owner']));

-- ── inventory_loans: el prestamo lo abre y lo cierra el staff de la org del activo ──
drop policy if exists inventory_loans_select_own on public.inventory_loans;
create policy inventory_loans_select_own on public.inventory_loans
  for select to authenticated
  using ((select auth.uid()) is not null and holder_user_id = (select auth.uid()));

drop policy if exists inventory_loans_select_staff on public.inventory_loans;
create policy inventory_loans_select_staff on public.inventory_loans
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (select 1 from public.inventory_assets a
                where a.id = asset_id
                  and private.session_role_in((select auth.uid()), a.org_id,
                       array['branch_admin','org_admin','org_owner']))
  );

drop policy if exists inventory_loans_insert_staff on public.inventory_loans;
create policy inventory_loans_insert_staff on public.inventory_loans
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and assigned_by = (select auth.uid())
    and exists (select 1 from public.inventory_assets a
                where a.id = asset_id
                  and a.status = 'available'
                  and private.session_role_in((select auth.uid()), a.org_id,
                       array['branch_admin','org_admin','org_owner']))
  );

drop policy if exists inventory_loans_update_staff on public.inventory_loans;
create policy inventory_loans_update_staff on public.inventory_loans
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and exists (select 1 from public.inventory_assets a
                where a.id = asset_id
                  and private.session_role_in((select auth.uid()), a.org_id,
                       array['branch_admin','org_admin','org_owner']))
  )
  with check (
    (select auth.uid()) is not null
    and exists (select 1 from public.inventory_assets a
                where a.id = asset_id
                  and private.session_role_in((select auth.uid()), a.org_id,
                       array['branch_admin','org_admin','org_owner']))
  );
```

```sql
-- ── inventory_movements: SOLO si la tabla condicional se crea ──
alter table public.inventory_movements enable row level security;
alter table public.inventory_movements force row level security;
revoke all on table public.inventory_movements from public, anon, authenticated;

drop policy if exists inventory_movements_select_staff on public.inventory_movements;
create policy inventory_movements_select_staff on public.inventory_movements
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (select 1 from public.inventory_assets a
                where a.id = asset_id
                  and private.session_role_in((select auth.uid()), a.org_id,
                       array['branch_admin','org_admin','org_owner']))
  );

drop policy if exists inventory_movements_insert_staff on public.inventory_movements;
create policy inventory_movements_insert_staff on public.inventory_movements
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and moved_by = (select auth.uid())
    and exists (select 1 from public.inventory_assets a
                where a.id = asset_id
                  and private.session_role_in((select auth.uid()), a.org_id,
                       array['branch_admin','org_admin','org_owner']))
  );
```

```sql
-- ── inventory_asset_types: catalogo global ──
-- Lo lee cualquier autenticado. Lo ESCRIBE `system_admin`, y no el staff de una
-- org: la tabla no tiene org_id, asi que un tipo insertado por la org A queda
-- visible para todas. Si el producto quiere que cada organizacion amplie su
-- propio catalogo, eso pide `org_id` y una politica org-scoped — es un cambio
-- de forma, no un ajuste de permiso. Queda registrado en §7.
drop policy if exists inventory_asset_types_select_auth on public.inventory_asset_types;
create policy inventory_asset_types_select_auth on public.inventory_asset_types
  for select to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists inventory_asset_types_write_system on public.inventory_asset_types;
create policy inventory_asset_types_write_system on public.inventory_asset_types
  for all to authenticated
  using ((select auth.uid()) is not null and private.session_has_system_role('system_admin'))
  with check ((select auth.uid()) is not null and private.session_has_system_role('system_admin'));
```

> **El trigger de `inventory_assets.status` sigue sin escribirse** (D9). El índice parcial impide dos préstamos abiertos, pero sin el trigger `status = 'loaned'` es una opinión del cliente: dos préstamos concurrentes desde dos dispositivos no dejan el listado coherente aunque el índice frene el segundo. Es trabajo de la migración F7, no una nota.

### 6.6 Grants de F7

Mismo orden D6 y misma razón que en F3: sin privilegio de tabla, las políticas son inalcanzables.

```sql
-- assets: la org lee, el staff administrativo escribe. DELETE no: un activo se
-- retira (status 'retired'), no se borra, porque sus prestamos son historial.
grant select, insert, update on table public.inventory_assets to authenticated;

-- asset_types: catalogo de QUE clase de equipo existe. INSERT y UPDATE si,
-- porque el formulario de alta depende de poder ampliarlo. DELETE no: §6.2 lo
-- referencia con ON DELETE RESTRICT, asi que un tipo con filas no se puede
-- borrar de todos modos y concederlo solo abriria una via que rebota en el FK.
grant select, insert, update on table public.inventory_asset_types to authenticated;

-- loans: el prestamo se abre (INSERT) y se cierra (UPDATE de returned_at y
-- condition_in). DELETE no: un prestamo es historia, igual que el ledger de XP.
grant select, insert, update on table public.inventory_loans to authenticated;

-- movements: SOLO si la tabla condicional se crea.
grant select, insert on table public.inventory_movements to authenticated;
```

## 7. Decisiones que este documento no resuelve

Las decisiones que bloqueaban el arranque **ya están resueltas**: D1 (consentimiento de tutor) = A, D2 (recurrencia) = C, D3 (visibilidad de observaciones) = C, D4 (bucket) = C, D5 (`module_key`) = los cinco valores del acta. Están en `odd/tasks/education-institutional-decisions.md` y no se reabren acá. Lo que sigue abierto es esto:

| # | Decisión | Por qué no la tomo |
|---|---|---|
| **D7** | `UNIQUE(user_id, org_id, branch_id)` defeated por `branch_id` NULL | Es un defecto **preexistente** de `0001:36`. Arreglarlo es una migración sobre datos del seed; no se mete de contrabando en una ampliación |
| **D8** | Qué más ve el docente, si algo | **El mecanismo está resuelto**, no la decisión de producto. Postgres no tiene grants por rol, así que el cap va por columnas para `authenticated` y la fila completa de la alumna sale de `public.education_my_progress()`, un `SECURITY DEFINER` que proyecta lo suyo. Lo que sigue abierto es si el rol docente necesita una tercera proyección: hoy «quién no ha empezado el curso» lo arma el cliente cruzando `education_enrollments`, y si el BDD lo exige como fila, es una función más, no un privilegio distinto |
| **D9** | Trigger de `inventory_assets.status` al abrir/cerrar préstamo | Se puede decidir leyendo los smokes de `0023_substitutions`, que ya resuelven un problema parecido |
| **Retiro de trabajo asignado** | `teaching-assignments.feature:60` pide que el docente vea lo que entregó como *withdrawn* | `education_progress` no tiene `withdrawn_at`/`withdrawn_by` y borrar la fila no deja rastro. Cerrarlo pide esas columnas o la tabla `education_work` que el proposal nombra. No se resuelve con una política |
| **S1** | `FORCE ROW LEVEL SECURITY` en las tablas existentes | F1 lo aplica a las que toca; las demás son una migración aparte y un endurecimiento independiente, no parte del alcance |
| **S3** | `admin_audit_log` solo registra lo que cada fase le escribe | F1 lo estrena; F3–F7 deciden su punto de escritura. El esquema ya lo soporta |
| **Alcance del catálogo `inventory_asset_types`** | Es global (sin `org_id`), y por eso su escritura queda en `system_admin`; si cada organización debe ampliarlo, la tabla necesita `org_id` y una política org-scoped |

## 8. Verificación

**Nada de esto se ha ejecutado.** No hay migración escrita, no hay `supabase db reset`, no hay smoke.

Cuando exista, la verificación es:

| Qué | Cómo |
|---|---|
| Aislamiento entre orgs | Smoke SQL con `set_config('role', …, false)` y JWT fijo. Los smokes del repo usan UUID literales, nunca `gen_random_uuid()`, porque no cruza un cambio de rol |
| Los guards de cada RPC | Un smoke por guard, invocando el RPC **como el actor que debe fallar** y esperando la excepción |
| SOD de membresía | Un smoke que intente auto-agregarse, auto-cambiarse el rol y auto-quitarse el rol, y espere `raise exception` |
| SOD de matrícula | Un smoke que intente que el propio staff se matricule y espere la excepción; otro que intente matricular a un no-miembro |
| Consentimiento de menores | Un menor sin `educational_data_access` vigente no se matricula; con el permiso y `expires_at` futuro sí. Requiere F6 o la extensión de `guardian_consents` aplicada junto con F3 |
| Reactivación | Retirar una matrícula y volver a matricular la misma oferta: una sola fila, `status='active'`, `withdrawn_at` nulo |
| Oferta como objetivo | Dos ofertas del mismo curso en períodos distintos aceptan a la misma persona; dos matrículas en la misma oferta no |
| Idempotencia del ledger | Insertar dos veces el mismo `client_uuid` y verificar una sola fila |
| Un activo no se presta dos veces | Insertar dos préstamos abiertos del mismo `asset_id` y esperar violación del índice parcial |
| `FORCE RLS` | Conectar **como owner** y confirmar que ahora respeta la política — la prueba de S1 no se puede escribir desde el cliente |
| `WITH CHECK` | Un smoke que **intente** escribir un `account_status` inválido y espere rechazo. Un test de lectura nunca lo detecta |
| El cap de columnas de `education_progress` | Un smoke que, **como docente**, intente `select notes, score, attempts from education_progress` y espere `42501`, y que el mismo `select` de las seis columnas sí devuelva la fila. Es el único caso de esta tabla donde el resultado correcto es un error |
| Los wrappers de F3 | Un smoke por wrapper, como la alumna, esperando el valor; y uno que intente `private.education_xp_total('<otro uuid>')` desde `authenticated` y espere `42501`, porque el núcleo no recibe `grant execute` |

El smoke requiere `supabase db reset` antes y **no es idempotente**. Es la convención de `odd/tasks/hito5-substitutions-and-coverage.md`, no un descuido.

## 9. Fase → migración: índice rápido

Este es el puente entre `docs/roadmap-ampliacion.md` §5 y la implementación. **Los nombres son los del proposal; los números NO están fijados.**

> **El próximo número libre es `0047`, y está contestado.** El PR #451 abierto reclama `0047_public_table_privileges.sql` (decisión T6). Un número libre en `main` no es libre *para una rama*: se consume cuando el PR que lo lleva mergea. Por eso esta tabla no asigna números definitivos — **recontar al implementar** con `git branch -r | xargs -I{} git ls-tree --name-only {} -- supabase/migrations/` y revisar el estado del PR, no solo la rama.

| Fase | Migración (nombre del proposal) | Contenido | BDD | Smoke |
|---|---|---|---|---|
| **F0** | — | ADR-012, `roadmap-ampliacion.md` §5, change `education-institutional-modules`, corrección de encabezados | — | — |
| **F1** | `004x_identity_account_lifecycle.sql` | `profiles.account_status/created_at`, CHECK de `role`, `admin_audit_log`, 3 RPC de membresía, `FORCE RLS`, grant ampliado | `organization-members.feature` (~12) | `scripts/smoke/<n>-identity.sql` |
| **F2** | `004y_organization_modules.sql` | `organization_modules` con los cinco `module_key` de D5, default `true` | `module-activation.feature` (~8) | `scripts/smoke/<n>-modules.sql` |
| **F3** | `004z_education_core.sql` | 9 tablas núcleo + `education_subjects` (cond.) + `guardian_consents` (`educational_data_access`, `expires_at`) + RLS + grants + RPC de matrícula | `education-structure.feature` (~15) + `education-enrollment.feature` (21, reescrito) | `scripts/smoke/<n>-education-core.sql` |
| **F4** | `004a_spaces_sessions_events.sql` | `spaces`, `education_sessions`, `recurrence_patterns`, extensión de `events`, RPC de conflictos | `education-sessions.feature` (~20) | `scripts/smoke/<n>-sessions.sql` |
| **F5** | `004b_education_materials.sql` + RLS del bucket | `education_materials`; bucket `education_materials` org-scoped (D4) | `education-materials.feature` (~12) | `scripts/smoke/<n>-materials.sql` |
| **F6** | `004c_observations_consent.sql` | `education_observations` (visibilidad D3), `org_module_settings` (cond.), flujo de tutor D1 | `education-followup.feature` (~15) | `scripts/smoke/<n>-followup.sql` |
| **F7** | `004d_inventory.sql` | `inventory_asset_types`, `inventory_assets`, `inventory_loans`, `inventory_movements` (cond.) | `inventory-assets.feature` (~15), `inventory-loans.feature` (~15) | `scripts/smoke/<n>-inventory.sql` |
| **F8** | — (vistas/RPC, cero tablas) | agregación institucional por módulo | `analytics-and-insights.feature` reescrito (~30) | `scripts/smoke/<n>-analytics.sql` |

**Orden de dependencia:** F1 → (F2, F3) → F4 → (F5, F6, F7) → F8. F0 no toca la base.

**Regla de numeración, resumida:** `supabase db reset` ejecuta *todos* los `.sql` en orden de nombre, así que el número es también el orden de dependencia. Una migración autocontenida toma el primer número libre real; una que deba ordenarse antes de otra existente no puede simplemente tomar `0047`. Las únicas ranuras libres dentro del rango actual son `0021` y `0022`, reservadas a propósito: usarlas exige una razón, no una prisa.

---

*Elaborado contra `main` = `f7d8bdc` el 15 de noviembre de 2026. Ninguna línea de este documento se ha aplicado a la base de datos. F1–F8 están autorizadas por ADR-012; la primera unidad es F1-1 (BDD de membresía) y la migración de F1 no se escribe hasta que ese BDD exista.*
