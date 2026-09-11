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