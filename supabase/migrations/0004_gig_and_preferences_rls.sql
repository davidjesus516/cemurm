-- CEMURM 0004 — gig tables RLS, user_preferences, private.session_org_ids()
--
-- PR#0 of hito-2-remainder (gigs + personal preferences). Closes the Hito 2
-- data gap: 0002 part 1 revoked ALL from anon/authenticated on venues, gigs,
-- performances and performance_items (lines 93–96) but part 2 never re-opened
-- them — the gig data layer would 403 on every read/write from Hito 2 on.
-- Owner scope: gigs/venues compare owner_id directly; performances and
-- performance_items inherit the gig owner through their parent chain
-- (performances.gig_id → gigs.owner_id; performance_items.performance_id →
-- performances → gigs.owner_id) using the 0003 exists-subquery shape —
-- single-relation subqueries, NO joins — keeping the policy graph acyclic
-- (0002 header lines 136–141).
--
-- Pattern follows 0002/0003 exactly: RLS enable → revokes → policies →
-- grants (D6 order); every policy guarded by the initPlan
-- "(select auth.uid()) is not null" (0002 line 130). UPDATE on the chained
-- tables writes USING + WITH CHECK (read scope == edit scope), the 0003
-- song_versions shape. Design: openspec/changes/hito-2-remainder/design.md —
-- D1 (exists-subquery scope inheritance), D2 (user_preferences shape), D2a
-- (session_org_ids helper, orchestrator-approved scope addition: gigs.org_id
-- is NOT NULL but org_memberships is deny-by-default, so the client has no
-- RLS path to resolve its org; real org enforcement stays Hito 4).
--
-- Schema USAGE note (0004 addition): 0002 granted EXECUTE on its private
-- helpers but never USAGE on schema private — live check after reset shows
-- private_usage = f for anon/authenticated/service_role (postgres only), so
-- every helper-backed policy and client call raises "permission denied for
-- schema private". 0004 ships the missing usage grant to the same audience as
-- the EXECUTE grants (authenticated, service_role); anon stays locked out.

-- ══════════════════════ GIG TABLES — RLS + OWNER POLICIES (D1) ══════════════════════
-- venues / gigs carry owner_id NOT NULL (0001 lines 282–302): direct
-- comparison, the songs owner-scope shape (0002 lines 152–170). RLS enable is
-- idempotent — 0002's DO-loop already switched it on; re-declared here so
-- 0004 stands alone and the contract is explicit.
alter table public.venues enable row level security;
alter table public.gigs enable row level security;
alter table public.performances enable row level security;
alter table public.performance_items enable row level security;

-- venues: full CRUD by owner_id
drop policy if exists venues_select_owner on public.venues;
create policy venues_select_owner on public.venues
  for select to authenticated
  using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

drop policy if exists venues_insert_owner on public.venues;
create policy venues_insert_owner on public.venues
  for insert to authenticated
  with check ((select auth.uid()) is not null and owner_id = (select auth.uid()));

drop policy if exists venues_update_owner on public.venues;
create policy venues_update_owner on public.venues
  for update to authenticated
  using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

drop policy if exists venues_delete_owner on public.venues;
create policy venues_delete_owner on public.venues
  for delete to authenticated
  using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

-- gigs: full CRUD by owner_id
drop policy if exists gigs_select_owner on public.gigs;
create policy gigs_select_owner on public.gigs
  for select to authenticated
  using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

drop policy if exists gigs_insert_owner on public.gigs;
create policy gigs_insert_owner on public.gigs
  for insert to authenticated
  with check ((select auth.uid()) is not null and owner_id = (select auth.uid()));

drop policy if exists gigs_update_owner on public.gigs;
create policy gigs_update_owner on public.gigs
  for update to authenticated
  using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

drop policy if exists gigs_delete_owner on public.gigs;
create policy gigs_delete_owner on public.gigs
  for delete to authenticated
  using ((select auth.uid()) is not null and owner_id = (select auth.uid()));

-- performances: visibility inherits the gig owner through gigs.owner_id —
-- single-relation subquery per hop (0003 precedent), chains end at
-- gigs.owner_id = auth.uid(). UPDATE writes USING + WITH CHECK both.
drop policy if exists performances_select_owner on public.performances;
create policy performances_select_owner on public.performances
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.gigs g
      where g.id = public.performances.gig_id
        and g.owner_id = (select auth.uid())
    )
  );

drop policy if exists performances_insert_owner on public.performances;
create policy performances_insert_owner on public.performances
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.gigs g
      where g.id = public.performances.gig_id
        and g.owner_id = (select auth.uid())
    )
  );

drop policy if exists performances_update_owner on public.performances;
create policy performances_update_owner on public.performances
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.gigs g
      where g.id = public.performances.gig_id
        and g.owner_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.gigs g
      where g.id = public.performances.gig_id
        and g.owner_id = (select auth.uid())
    )
  );

drop policy if exists performances_delete_owner on public.performances;
create policy performances_delete_owner on public.performances
  for delete to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.gigs g
      where g.id = public.performances.gig_id
        and g.owner_id = (select auth.uid())
    )
  );

-- performance_items: two hops up — performance_id → performances → gigs.
-- Nested single-relation exists (no joins); the inner hop repeats the outer
-- gig check so WITH CHECK cannot re-point an item into a foreign gig's
-- performance.
drop policy if exists performance_items_select_owner on public.performance_items;
create policy performance_items_select_owner on public.performance_items
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.performances p
      where p.id = public.performance_items.performance_id
        and exists (
          select 1 from public.gigs g
          where g.id = p.gig_id
            and g.owner_id = (select auth.uid())
        )
    )
  );

drop policy if exists performance_items_insert_owner on public.performance_items;
create policy performance_items_insert_owner on public.performance_items
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.performances p
      where p.id = public.performance_items.performance_id
        and exists (
          select 1 from public.gigs g
          where g.id = p.gig_id
            and g.owner_id = (select auth.uid())
        )
    )
  );

drop policy if exists performance_items_update_owner on public.performance_items;
create policy performance_items_update_owner on public.performance_items
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.performances p
      where p.id = public.performance_items.performance_id
        and exists (
          select 1 from public.gigs g
          where g.id = p.gig_id
            and g.owner_id = (select auth.uid())
        )
    )
  )
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.performances p
      where p.id = public.performance_items.performance_id
        and exists (
          select 1 from public.gigs g
          where g.id = p.gig_id
            and g.owner_id = (select auth.uid())
        )
    )
  );

drop policy if exists performance_items_delete_owner on public.performance_items;
create policy performance_items_delete_owner on public.performance_items
  for delete to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.performances p
      where p.id = public.performance_items.performance_id
        and exists (
          select 1 from public.gigs g
          where g.id = p.gig_id
            and g.owner_id = (select auth.uid())
        )
    )
  );

-- ══════════════════════ PRIVATE.SESSION_ORG_IDS() HELPER (D2a) ══════════════════════
-- Session-bound (R3-001, 0002 line 13): NO caller-supplied user_id — binds to
-- auth.uid() directly, so an arbitrary victim id cannot leak another user's
-- org membership. SECURITY DEFINER + empty search_path + fully-qualified refs
-- (0002 line 55); execute revoked from public/anon, granted only to
-- authenticated/service_role (0002 lines 33–39). Distinct: one org id per
-- membership row, even across branch rows. Real org enforcement stays Hito 4.
create function private.session_org_ids() returns uuid[]
  language sql security definer stable set search_path = '' as $$
  select coalesce(array_agg(distinct org_id), '{}') from public.org_memberships
  where user_id = (select auth.uid()) and status = 'active' $$;

revoke execute on function private.session_org_ids() from public, anon;
grant execute on function private.session_org_ids() to authenticated, service_role;

-- helper calls evaluate under the client role (RLS policies + client SELECT):
-- without schema USAGE even the EXECUTE grant above cannot reach the function
-- (verified live: authenticated private_usage = f after 0002). Same audience
-- as the EXECUTE grants; anon must never reach the definer helpers.
grant usage on schema private to authenticated, service_role;

-- ══════════════════════ USER_PREFERENCES — SELF-ONLY (D2) ══════════════════════
-- One row per user (PK user_id), typed hot-path columns + jsonb for evolving
-- per-song overrides/versions/practice prefs (D2). Self-scope by user_id, the
-- practice_sessions shape (0002 lines 371–389).
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  transpose_offset smallint not null default 0,
  capo smallint not null default 0,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

-- deny-by-default: auto_expose_new_tables grants defaults on creation — the
-- explicit revoke below re-ships 0002's lock (0002 lines 57–59) before the
-- targeted self-only grants (D6 order).
revoke all on table public.user_preferences from anon, authenticated;

drop policy if exists user_preferences_select_owner on public.user_preferences;
create policy user_preferences_select_owner on public.user_preferences
  for select to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists user_preferences_insert_owner on public.user_preferences;
create policy user_preferences_insert_owner on public.user_preferences
  for insert to authenticated
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists user_preferences_update_owner on public.user_preferences;
create policy user_preferences_update_owner on public.user_preferences
  for update to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists user_preferences_delete_owner on public.user_preferences;
create policy user_preferences_delete_owner on public.user_preferences
  for delete to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

-- ══════════════════════ GRANTS AFTER POLICIES (D6 ORDER) ══════════════════════
-- 0002 part 1 revoked the gig tables; these targeted grants re-open ONLY the
-- owner-scoped gig tables + user_preferences to authenticated. Anon gets
-- nothing anywhere; service_role gets the new table's grants explicitly.
grant select, insert, update, delete on table public.user_preferences
  to authenticated, service_role;

grant select, insert, update, delete on table public.venues, public.gigs,
  public.performances, public.performance_items, public.user_preferences
  to authenticated;