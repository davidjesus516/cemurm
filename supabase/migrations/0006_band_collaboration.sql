-- CEMURM 0006 — band collaboration RLS: profiles, bandmate edges, comments, self-accept, realtime
--
-- PR#0 of hito-3-band-collaboration (chained slices; this slice = migration 0006 only).
-- Closes the Hito 3 data gaps: 0002 revoked bandmate_links/invite_codes/shared_comments with
-- zero re-opening policies (deny-by-default forever — the bandmate/comment data layers would
-- 403 on every read from PR#1a/PR#3 on), and setlist_collaborators has no invitee-side UPDATE
-- (acceptance loop is broken: only the owner-management update_owner policy exists).
--
-- Pattern follows 0002/0004 exactly: RLS enable (re-declared so 0006 stands alone, 0004
-- precedent lines 34–39) → revokes → policies → grants (D6 order, 0002 line 129); every
-- policy guarded by the initPlan "(select auth.uid()) is not null" (0002 line 130); scope
-- inheritance via nested single-relation EXISTS subqueries, NO joins (0004 lines 83–85 —
-- the acyclic-policy-graph constraint, 0002 header lines 136–141). New helpers are
-- SECURITY DEFINER with empty search_path + fully-qualified refs (0002 line 55) and
-- execute revoked from public/anon/authenticated (trigger-only entry, 0002 lines 33–39).
-- Design: openspec/changes/hito-3-band-collaboration/design.md — D1 (profiles = 49th table,
-- documented deviation: auth.users is not PostgREST-exposed, bandmate search needs a public
-- identity surface), D2 (username nullable + partial unique index), D3 (publication on the
-- 3 RLS tables so postgres_changes honors RLS per subscriber), D8 (nested EXISTS scope).
-- Spec: openspec/changes/hito-3-band-collaboration/specs/row-level-security/spec.md —
-- RLS 1.1/1.2 (profiles), 2.1 (bandmate pair), 2.2 (shared_comments), 3.1 (self-accept), 4.1 (publication).

-- ══════════════════════ 0.1 PROFILES — IDENTITY SURFACE (D1) ══════════════════════
-- 49th table (documented deviation beyond the 48-table contract): auth.users is not
-- client-queryable, so bandmate search needs a public identity surface. Columns exactly per
-- the RLS spec — id→auth.users CASCADE, display_name, username UNIQUE nullable, instrument,
-- avatar_url. Username is NULLABLE because the signup trigger creates the row pre-username;
-- uniqueness enforced by a partial unique index WHERE username IS NOT NULL (D2).
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  username     text,
  instrument   text,
  avatar_url   text
);

create unique index profiles_username_key on public.profiles (username) where username is not null;

-- signup auto-create (D1): the trigger creates the profile row on auth.users insert, before
-- any username exists. SECURITY DEFINER so the insert lands even though the client cannot
-- write its own profile pre-signup; search_path locked + fully-qualified refs (0002 line 55).
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- trigger-only entry point: lockable via RPC would be a definer footgun (0002 lines 33–39)
revoke all on function public.handle_new_user() from public, anon, authenticated;

alter table public.profiles enable row level security;

-- deny-by-default: auto_expose_new_tables grants defaults on creation — the explicit revoke
-- below re-ships 0002's lock (0002 lines 57–59) before the targeted grants (D6 order).
revoke all on table public.profiles from anon, authenticated;

-- ══════════════════════ 0.2 PROFILES RLS — SELF CRUD + COLUMN-LIMITED SEARCH (RLS 1.1/1.2) ══════════════════════
-- Self policies scope ROWS to the owner (practice_sessions shape, 0002 lines 371–389); the
-- search policy grants any authenticated user row access, but COLUMN visibility is capped by
-- the select-column grant in 0.1's grants below (only id/username/display_name/avatar_url) —
-- instrument stays writable (update grant) without being readable by other users (RLS 1.2).
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using ((select auth.uid()) is not null and id = (select auth.uid()));

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) is not null and id = (select auth.uid()));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using ((select auth.uid()) is not null and id = (select auth.uid()));

drop policy if exists profiles_delete_self on public.profiles;
create policy profiles_delete_self on public.profiles
  for delete to authenticated
  using ((select auth.uid()) is not null and id = (select auth.uid()));

drop policy if exists profiles_select_search on public.profiles;
create policy profiles_select_search on public.profiles
  for select to authenticated
  using ((select auth.uid()) is not null);

-- ══════════════════════ 0.3 BANDMATE LINKS + INVITE CODES — PAIR / OWN-ROW RLS (RLS 2.1) ══════════════════════
-- bandmate_links: 0002 revoked both tables (lines 66, 106) with no re-opening policy — the
-- band "edge" was service-role-only. Pair scope: a row is visible/writable by the two users
-- of the pair (user_id OR bandmate_id = auth.uid()). INSERT fixes the initiator on user_id
-- (= the inviter, no self-loops); the invitee's accept/decline path is the UPDATE policy
-- (revoke = either side DELETE). invitation validation (no-self, already-active) is a
-- client-layer guard (PR#1a 1.2), RLS enforces the invariant only (bandmate_id <> auth.uid()).
alter table public.bandmate_links enable row level security;
alter table public.invite_codes enable row level security;

-- re-declare the 0002 deny-by-default lock (harmless — grants were never re-opened; 0004
-- line 258 precedent) before the pair-scope grants (D6 order)
revoke all on table public.bandmate_links from anon, authenticated;
revoke all on table public.invite_codes from anon, authenticated;

drop policy if exists bandmate_links_select_pair on public.bandmate_links;
create policy bandmate_links_select_pair on public.bandmate_links
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and (user_id = (select auth.uid()) or bandmate_id = (select auth.uid()))
  );

drop policy if exists bandmate_links_insert_pair on public.bandmate_links;
create policy bandmate_links_insert_pair on public.bandmate_links
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and bandmate_id <> (select auth.uid())
  );

-- invitee accept/decline (UPDATE status on their own side of the pair) + inviter revoke
drop policy if exists bandmate_links_update_pair on public.bandmate_links;
create policy bandmate_links_update_pair on public.bandmate_links
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and (user_id = (select auth.uid()) or bandmate_id = (select auth.uid()))
  )
  with check (
    (select auth.uid()) is not null
    and (user_id = (select auth.uid()) or bandmate_id = (select auth.uid()))
  );

drop policy if exists bandmate_links_delete_pair on public.bandmate_links;
create policy bandmate_links_delete_pair on public.bandmate_links
  for delete to authenticated
  using (
    (select auth.uid()) is not null
    and (user_id = (select auth.uid()) or bandmate_id = (select auth.uid()))
  );

-- invite_codes: own-row RLS by created_by (the inviter) — selection, generation (proximity
-- codes, PR#1b) and revocation all flow through the inviter's own rows (invite_codes was
-- revoked in 0002 line 66; org-invite admin flows stay service-role per Hito 4).
drop policy if exists invite_codes_select_own on public.invite_codes;
create policy invite_codes_select_own on public.invite_codes
  for select to authenticated
  using ((select auth.uid()) is not null and created_by = (select auth.uid()));

drop policy if exists invite_codes_insert_own on public.invite_codes;
create policy invite_codes_insert_own on public.invite_codes
  for insert to authenticated
  with check ((select auth.uid()) is not null and created_by = (select auth.uid()));

drop policy if exists invite_codes_update_own on public.invite_codes;
create policy invite_codes_update_own on public.invite_codes
  for update to authenticated
  using ((select auth.uid()) is not null and created_by = (select auth.uid()))
  with check ((select auth.uid()) is not null and created_by = (select auth.uid()));

drop policy if exists invite_codes_delete_own on public.invite_codes;
create policy invite_codes_delete_own on public.invite_codes
  for delete to authenticated
  using ((select auth.uid()) is not null and created_by = (select auth.uid()));

-- ══════════════════════ GRANTS AFTER POLICIES (D6 ORDER) ══════════════════════
-- profiles: authenticated gets column-capped select (search surface, RLS 1.2) + self
-- insert/update/delete (schema columns only); service_role keeps full table access (0004
-- line 287 precedent — backend must read unvetted columns). bandmate_links/invite_codes:
-- full CRUD re-opened to authenticated (0002 revoked them; service_role untouched).
grant select (id, username, display_name, avatar_url) on table public.profiles to authenticated;
grant insert (id, display_name, username, instrument, avatar_url) on table public.profiles to authenticated;
grant update (display_name, username, instrument, avatar_url) on table public.profiles to authenticated;
grant delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

grant select, insert, update, delete on table public.bandmate_links to authenticated;
grant select, insert, update, delete on table public.invite_codes to authenticated;

-- ══════════════════════ 0.4 SETLIST COLLABORATOR SELF-ACCEPT (RLS 3.1) ══════════════════════
-- 0002 gap fix: setlist_collaborators had ONLY the owner-management UPDATE (update_owner,
-- 0002 lines 255–261) — an invitee had no RLS path to set accepted_at, so acceptance was
-- broken (the shared-setlist invite loop could never close). This policy lets the invitee
-- update their OWN row (user_id = auth.uid()), design contract verbatim. Owner-management
-- policies stay untouched. ⚠ known wrinkle (design contract accepted): the invitee can also
-- flip can_edit on their own row — column grants are role-wide, they cannot split by row;
-- the RLS spec 3.1 only asserts setlists-PATCH denial for view-only, which 0002 preserves.
drop policy if exists setlist_collaborators_update_self on public.setlist_collaborators;
create policy setlist_collaborators_update_self on public.setlist_collaborators
  for update to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

-- ══════════════════════ 0.5 SHARED_COMMENTS — 3-HOP EXISTS SCOPE (RLS 2.2) ══════════════════════
-- 0002 revoked shared_comments (line 85) with zero re-opening policies. Scope = exactly the
-- arrangement/setlist band: song → setlist_items → setlists → (owner OR accepted
-- setlist_collaborators), nested single-relation EXISTS, NO joins (D8, 0004 shape). The hop
-- graph stays acyclic: setlist_collaborators policies resolve the parent setlist through the
-- private.session_owns_setlist() definer helper (0002 lines 136–141), so the chain terminates
-- instead of re-entering setlists. INSERT additionally pins author_id to the session (songs
-- insert shape, 0002 lines 157–160) — any scoped member may post, but never as someone else.
alter table public.shared_comments enable row level security;

-- re-declare the 0002 deny-by-default lock (grant was never re-opened) before the scoped
-- grants (D6 order); anon stays locked out everywhere, service_role untouched
revoke all on table public.shared_comments from anon, authenticated;

drop policy if exists shared_comments_select_scoped on public.shared_comments;
create policy shared_comments_select_scoped on public.shared_comments
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.setlist_items i
      where i.song_id = public.shared_comments.song_id
        and exists (
          select 1 from public.setlists s
          where s.id = i.setlist_id
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
  );

drop policy if exists shared_comments_insert_scoped on public.shared_comments;
create policy shared_comments_insert_scoped on public.shared_comments
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and public.shared_comments.author_id = (select auth.uid())
    and exists (
      select 1 from public.setlist_items i
      where i.song_id = public.shared_comments.song_id
        and exists (
          select 1 from public.setlists s
          where s.id = i.setlist_id
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
  );

grant select, insert on table public.shared_comments to authenticated;

-- ══════════════════════ 0.6 UPDATED_AT TRIGGERS + REALTIME PUBLICATION (RLS 4.1) ══════════════════════
-- Design data flow (design.md line 27): "write → setlist_items → bump setlists.updated_at
-- (trigger) → postgres_changes → members refetch". Two triggers, one per direction:
--  · setlists_bump_updated_at — BEFORE UPDATE on setlists, keeps updated_at fresh on direct
--    owner edits (rename/visibility) without a client write ordering contract.
--  · setlist_items_bump_setlists_updated_at — AFTER INSERT/UPDATE/DELETE on setlist_items,
--    propagates item edits to the parent row so the PR#2b reconcile guard has a truthful
--    server-`updated_at` to compare pre-replay. SECURITY DEFINER + locked search_path +
--    fully-qualified refs (0002 line 55): the definer write bypasses RLS, so any
--    item-editing member (owner or can_edit, per the item policies) bumps the parent without
--    tripping the setlists WITH CHECK on the way. Trigger-only entry — execute revoked.
create function public.touch_setlists_updated_at() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger setlists_bump_updated_at
  before update on public.setlists
  for each row execute function public.touch_setlists_updated_at();

create function public.bump_setlists_updated_at() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  update public.setlists set updated_at = now()
  where id = coalesce(new.setlist_id, old.setlist_id);
  return null;
end $$;

revoke all on function public.touch_setlists_updated_at() from public, anon, authenticated;
revoke all on function public.bump_setlists_updated_at() from public, anon, authenticated;

create trigger setlist_items_bump_setlists_updated_at
  after insert or update or delete on public.setlist_items
  for each row execute function public.bump_setlists_updated_at();

-- Realtime publication (D3, RLS 4.1): postgres_changes subscriptions deliver only rows the
-- subscriber's RLS policies can read, so publishing the setlist trio lets a collaborator
-- receive live changes while a non-member receives nothing. All three tables are RLS-enabled
-- (0002 DO-loop + re-declared above/here); no non-RLS table is added to the publication.
alter publication supabase_realtime add table public.setlists;
alter publication supabase_realtime add table public.setlist_items;
alter publication supabase_realtime add table public.setlist_collaborators;