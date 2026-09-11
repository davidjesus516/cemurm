-- CEMURM RLS core — part 1 (PR 3 slice): private schema + hardened SECURITY DEFINER helpers, RLS on
-- all public tables, deny-by-default. NO policies/grants yet — those land in part 2 (PR 4).
-- Design: openspec/changes/rls-and-offline-first/design.md — D5 (DO-loop RLS enable), D6 (explicit
-- per-table revoke from anon/authenticated BEFORE policies/grants), helper hardening (line 55):
-- SECURITY DEFINER, empty search_path, fully-qualified refs, execute revoked from public/anon,
-- granted to authenticated/service_role, default privileges revoked.

-- ══════════════════════ 3.1 PRIVATE SCHEMA + HELPERS ══════════════════════
create schema if not exists private;

-- Tenancy guard (R3-001): each helper binds the caller-supplied user_id to the invoking
-- session (auth.uid()), so an arbitrary victim id no longer yields the victim's rows.
-- FIRMA NO CAMBIA — PR 4 policies still pass the row's user_id; mismatch returns no data.
create function private.is_org_member(user_id uuid, org_id uuid) returns text
  language sql security definer stable set search_path = '' as $$
  select role from public.org_memberships
  where user_id = $1 and user_id = (select auth.uid())
    and org_id = $2 and status = 'active' limit 1 $$;  -- NULL = not member

create function private.user_branch_ids(user_id uuid) returns uuid[]
  language sql security definer stable set search_path = '' as $$
  select coalesce(array_agg(branch_id), '{}') from public.org_memberships
  where user_id = $1 and user_id = (select auth.uid())
    and status = 'active' and branch_id is not null $$;

create function private.session_role_in(user_id uuid, org_id uuid, roles text[]) returns boolean
  language sql security definer stable set search_path = '' as $$
  select exists(select 1 from public.org_memberships
    where user_id = $1 and user_id = (select auth.uid())
      and org_id = $2 and status = 'active' and role = any($3)) $$;

-- execution locked: PUBLIC default grant would expose the definer helpers to anon
revoke execute on function private.is_org_member(uuid, uuid) from public, anon;
revoke execute on function private.user_branch_ids(uuid) from public, anon;
revoke execute on function private.session_role_in(uuid, uuid, text[]) from public, anon;

grant execute on function private.is_org_member(uuid, uuid) to authenticated, service_role;
grant execute on function private.user_branch_ids(uuid) to authenticated, service_role;
grant execute on function private.session_role_in(uuid, uuid, text[]) to authenticated, service_role;

-- future private-schema functions inherit the lock, not the unsafe PUBLIC default
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

create index if not exists idx_memberships_org_user on public.org_memberships(org_id, user_id);

-- ══════════════════════ 3.2 RLS ON ALL PUBLIC TABLES (D5) ══════════════════════
-- uniform + idempotent: loops the 48 public tables; auth/storage/realtime schemas untouched
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ══════════════════════ 3.3 REVOKE ALL FROM ANON/AUTHENTICATED (D6, before grants) ══════════════════════
-- local auto_expose_new_tables grants defaults on creation; the explicit revoke below ships
-- deny-by-default across all 48 public tables. Policies + targeted grants arrive in part 2 (PR 4).

-- tenancy (5)
revoke all on table public.organizations from anon, authenticated;
revoke all on table public.branches from anon, authenticated;
revoke all on table public.org_memberships from anon, authenticated;
revoke all on table public.user_roles from anon, authenticated;
revoke all on table public.invite_codes from anon, authenticated;

-- repertoire (7)
revoke all on table public.songs from anon, authenticated;
revoke all on table public.chart_files from anon, authenticated;
revoke all on table public.song_versions from anon, authenticated;
revoke all on table public.tags from anon, authenticated;
revoke all on table public.song_tags from anon, authenticated;
revoke all on table public.song_duplicates from anon, authenticated;
revoke all on table public.external_enrichments from anon, authenticated;

-- setlists, items, collections (5)
revoke all on table public.setlists from anon, authenticated;
revoke all on table public.setlist_collaborators from anon, authenticated;
revoke all on table public.setlist_items from anon, authenticated;
revoke all on table public.collections from anon, authenticated;
revoke all on table public.collection_songs from anon, authenticated;

-- commentary and annotations (2)
revoke all on table public.shared_comments from anon, authenticated;
revoke all on table public.personal_annotations from anon, authenticated;

-- events, gigs, services, performance (12)
revoke all on table public.events from anon, authenticated;
revoke all on table public.event_participants from anon, authenticated;
revoke all on table public.event_rsvps from anon, authenticated;
revoke all on table public.event_setlists from anon, authenticated;
revoke all on table public.venues from anon, authenticated;
revoke all on table public.gigs from anon, authenticated;
revoke all on table public.performances from anon, authenticated;
revoke all on table public.performance_items from anon, authenticated;
revoke all on table public.services from anon, authenticated;
revoke all on table public.service_blocks from anon, authenticated;
revoke all on table public.service_assignments from anon, authenticated;
revoke all on table public.substitution_requests from anon, authenticated;

-- practice, rehearsal, collaboration (6)
revoke all on table public.practice_sessions from anon, authenticated;
revoke all on table public.rehearsals from anon, authenticated;
revoke all on table public.rehearsal_items from anon, authenticated;
revoke all on table public.bandmate_links from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;
revoke all on table public.notification_preferences from anon, authenticated;

-- community and moderation (6)
revoke all on table public.public_songs from anon, authenticated;
revoke all on table public.follows from anon, authenticated;
revoke all on table public.reports from anon, authenticated;
revoke all on table public.moderation_cases from anon, authenticated;
revoke all on table public.rating_restrictions from anon, authenticated;
revoke all on table public.dmca_notices from anon, authenticated;

-- devices, hardware, sync (5)
revoke all on table public.device_configs from anon, authenticated;
revoke all on table public.midi_maps from anon, authenticated;
revoke all on table public.outbox from anon, authenticated;
revoke all on table public.audience_views from anon, authenticated;
revoke all on table public.scale_catalog from anon, authenticated;

-- ══════════════════════ 4.1 POLICIES — OWNER-SCOPED CRUD (PR 4 slice) ══════════════════════
-- Part 2 of 0002 (PR 4): policies + grants on top of part 1 (private helpers, RLS on, revokes).
-- Design: openspec/changes/rls-and-offline-first/design.md — D6 (named "{table}_{op}_{scope}",
-- drop-if-exists + create, grants AFTER policies), D7 (setlist_collaborators self-policy breaks
-- the setlists→collaborators→setlists RLS-recursion chain), initPlan guard
-- "(select auth.uid()) is not null" on every policy (design line 76). Helpers are SESSION-BOUND
-- (R3-001): policies never pass a foreign user_id to them — rows are compared directly to
-- auth.uid(). SELECT/UPDATE note: for UPDATE, WITH CHECK defaults to USING when omitted —
-- WHERE a read scope and an edit scope differ (setlists, setlist_items), both are written so a
-- view-only collaborator's PATCH raises 42501 instead of silently updating 0 rows.
--
-- ⚠ DEVIATION from design D7 (recursion fix) — PostgreSQL detects policy recursion at PLAN time:
-- the setlists SELECT EXISTS on setlist_collaborators, OR-combined with an owner-management policy
-- "setlist_id in (select id from setlists …)", forms a STRUCTURAL setlists → setlist_collaborators
-- → setlists cycle → 42P17 (verified live; D7's self-policy alone does not break it). Fix: 4th
-- session-bound SECURITY DEFINER helper (D7's own rejected fallback, now required) — collaborator
-- policies read ownership through it, so no policy references setlists and the cycle is gone.
create function private.session_owns_setlist(setlist_id uuid) returns boolean
  language sql security definer stable set search_path = '' as $$
  select exists(
    select 1 from public.setlists
    where id = $1 and owner_id = (select auth.uid())) $$;

revoke execute on function private.session_owns_setlist(uuid) from public, anon;
grant execute on function private.session_owns_setlist(uuid) to authenticated, service_role;

-- songs: full CRUD by created_by (design line 80)
drop policy if exists songs_select_owner on public.songs;
create policy songs_select_owner on public.songs
  for select to authenticated
  using ((select auth.uid()) is not null and created_by = (select auth.uid()));

drop policy if exists songs_insert_owner on public.songs;
create policy songs_insert_owner on public.songs
  for insert to authenticated
  with check ((select auth.uid()) is not null and created_by = (select auth.uid()));

drop policy if exists songs_update_owner on public.songs;
create policy songs_update_owner on public.songs
  for update to authenticated
  using ((select auth.uid()) is not null and created_by = (select auth.uid()));

drop policy if exists songs_delete_owner on public.songs;
create policy songs_delete_owner on public.songs
  for delete to authenticated
  using ((select auth.uid()) is not null and created_by = (select auth.uid()));

-- setlists (design line 81): SELECT owner-or-accepted-collab; INSERT owner; UPDATE USING
-- owner-or-accepted-collab (row visible) + WITH CHECK owner-or-can_edit (write gated → view-only
-- collaborator PATCH → 42501); DELETE owner only. The owner branch short-circuits before the
-- collaborator EXISTS, so the setlists → setlist_collaborators chain never re-enters setlists.
drop policy if exists setlists_select_member on public.setlists;
create policy setlists_select_member on public.setlists
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and (
      owner_id = (select auth.uid())
      or exists (
        select 1 from public.setlist_collaborators c
        where c.setlist_id = public.setlists.id
          and c.user_id = (select auth.uid())
          and c.accepted_at is not null
      )
    )
  );

drop policy if exists setlists_insert_owner on public.setlists;
create policy setlists_insert_owner on public.setlists
  for insert to authenticated
  with check ((select auth.uid()) is not null and owner_id = (select auth.uid()));

drop policy if exists setlists_update_member on public.setlists;
create policy setlists_update_member on public.setlists
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and (
      owner_id = (select auth.uid())
      or exists (
        select 1 from public.setlist_collaborators c
        where c.setlist_id = public.setlists.id
          and c.user_id = (select auth.uid())
          and c.accepted_at is not null
      )
    )
  )
  with check (
    (select auth.uid()) is not null
    and (
      owner_id = (select auth.uid())
      or exists (
        select 1 from public.setlist_collaborators c
        where c.setlist_id = public.setlists.id
          and c.user_id = (select auth.uid())
          and c.can_edit
      )
    )
  );

drop policy if exists setlists_delete_owner on public.setlists;
create policy setlists_delete_owner on public.setlists
  for delete to authenticated
  using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

-- setlist_collaborators (D7 + recursion fix): self-scope SELECT resolves the parent
-- setlists/setlist_items EXISTS through the collaborator's OWN row (user_id = auth.uid());
-- full CRUD via owner-management goes through private.session_owns_setlist() so collaborator
-- policies never reference setlists (plan-time recursion, see header), creating/editing invites.
drop policy if exists setlist_collaborators_select_self on public.setlist_collaborators;
create policy setlist_collaborators_select_self on public.setlist_collaborators
  for select to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists setlist_collaborators_select_owner on public.setlist_collaborators;
create policy setlist_collaborators_select_owner on public.setlist_collaborators
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and private.session_owns_setlist(setlist_id)
  );

drop policy if exists setlist_collaborators_insert_owner on public.setlist_collaborators;
create policy setlist_collaborators_insert_owner on public.setlist_collaborators
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and private.session_owns_setlist(setlist_id)
  );

drop policy if exists setlist_collaborators_update_owner on public.setlist_collaborators;
create policy setlist_collaborators_update_owner on public.setlist_collaborators
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and private.session_owns_setlist(setlist_id)
  );

drop policy if exists setlist_collaborators_delete_owner on public.setlist_collaborators;
create policy setlist_collaborators_delete_owner on public.setlist_collaborators
  for delete to authenticated
  using (
    (select auth.uid()) is not null
    and private.session_owns_setlist(setlist_id)
  );

-- setlist_items (design line 83): visibility inherits the setlist scope — SELECT any accepted
-- collaborator; writes owner-or-can_edit. UPDATE USING = read scope, WITH CHECK = edit scope
-- (same 42501 shape as setlists).
drop policy if exists setlist_items_select_member on public.setlist_items;
create policy setlist_items_select_member on public.setlist_items
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.setlists s
      where s.id = public.setlist_items.setlist_id
        and (
          s.owner_id = (select auth.uid())
          or exists (
            select 1 from public.setlist_collaborators c
            where c.setlist_id = s.id
              and c.user_id = (select auth.uid())
              and c.accepted_at is not null
          )
        )
    )
  );

drop policy if exists setlist_items_insert_member on public.setlist_items;
create policy setlist_items_insert_member on public.setlist_items
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.setlists s
      where s.id = public.setlist_items.setlist_id
        and (
          s.owner_id = (select auth.uid())
          or exists (
            select 1 from public.setlist_collaborators c
            where c.setlist_id = s.id
              and c.user_id = (select auth.uid())
              and c.can_edit
          )
        )
    )
  );

drop policy if exists setlist_items_update_member on public.setlist_items;
create policy setlist_items_update_member on public.setlist_items
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.setlists s
      where s.id = public.setlist_items.setlist_id
        and (
          s.owner_id = (select auth.uid())
          or exists (
            select 1 from public.setlist_collaborators c
            where c.setlist_id = s.id
              and c.user_id = (select auth.uid())
              and c.accepted_at is not null
          )
        )
    )
  )
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.setlists s
      where s.id = public.setlist_items.setlist_id
        and (
          s.owner_id = (select auth.uid())
          or exists (
            select 1 from public.setlist_collaborators c
            where c.setlist_id = s.id
              and c.user_id = (select auth.uid())
              and c.can_edit
          )
        )
    )
  );

drop policy if exists setlist_items_delete_member on public.setlist_items;
create policy setlist_items_delete_member on public.setlist_items
  for delete to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.setlists s
      where s.id = public.setlist_items.setlist_id
        and (
          s.owner_id = (select auth.uid())
          or exists (
            select 1 from public.setlist_collaborators c
            where c.setlist_id = s.id
              and c.user_id = (select auth.uid())
              and c.can_edit
          )
        )
    )
  );

-- practice_sessions, personal_annotations, device_configs: full CRUD by user_id (design line 84)
drop policy if exists practice_sessions_select_self on public.practice_sessions;
create policy practice_sessions_select_self on public.practice_sessions
  for select to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists practice_sessions_insert_self on public.practice_sessions;
create policy practice_sessions_insert_self on public.practice_sessions
  for insert to authenticated
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists practice_sessions_update_self on public.practice_sessions;
create policy practice_sessions_update_self on public.practice_sessions
  for update to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists practice_sessions_delete_self on public.practice_sessions;
create policy practice_sessions_delete_self on public.practice_sessions
  for delete to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists personal_annotations_select_self on public.personal_annotations;
create policy personal_annotations_select_self on public.personal_annotations
  for select to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists personal_annotations_insert_self on public.personal_annotations;
create policy personal_annotations_insert_self on public.personal_annotations
  for insert to authenticated
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists personal_annotations_update_self on public.personal_annotations;
create policy personal_annotations_update_self on public.personal_annotations
  for update to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists personal_annotations_delete_self on public.personal_annotations;
create policy personal_annotations_delete_self on public.personal_annotations
  for delete to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists device_configs_select_self on public.device_configs;
create policy device_configs_select_self on public.device_configs
  for select to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists device_configs_insert_self on public.device_configs;
create policy device_configs_insert_self on public.device_configs
  for insert to authenticated
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists device_configs_update_self on public.device_configs;
create policy device_configs_update_self on public.device_configs
  for update to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists device_configs_delete_self on public.device_configs;
create policy device_configs_delete_self on public.device_configs
  for delete to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

-- ══════════════════════ 4.2 SPECIAL TABLES — NOTIFICATIONS, OUTBOX, SCALE CATALOG ══════════════════════
-- notifications (D9): SELECT own + UPDATE own; the update(read_at) COLUMN grant (4.3) turns
-- PATCH read_at into 200 and PATCH title into 42501. No INSERT/DELETE — system writes only.
drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self on public.notifications
  for select to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications
  for update to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

-- outbox (D10): INSERT + SELECT self only; UPDATE/drain is S6.
drop policy if exists outbox_insert_self on public.outbox;
create policy outbox_insert_self on public.outbox
  for insert to authenticated
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists outbox_select_self on public.outbox;
create policy outbox_select_self on public.outbox
  for select to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

-- scale_catalog: read-only reference data for authenticated (design line 87)
drop policy if exists scale_catalog_select_all on public.scale_catalog;
create policy scale_catalog_select_all on public.scale_catalog
  for select to authenticated
  using ((select auth.uid()) is not null);

-- ══════════════════════ 4.3 GRANTS AFTER POLICIES (D6 ORDER) ══════════════════════
-- Part 1 revoked all from anon/authenticated; these targeted grants re-open ONLY the scoped
-- tables. Anon gets nothing anywhere; the 8 gap tables + org/branches/org_memberships + every
-- remaining public table stay deny-by-default for clients; service_role untouched (default grants).
grant select, insert, update, delete on table public.songs, public.setlists,
  public.setlist_collaborators, public.setlist_items, public.practice_sessions,
  public.personal_annotations, public.device_configs to authenticated;

grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

grant select, insert on table public.outbox to authenticated;

grant select on table public.scale_catalog to authenticated;