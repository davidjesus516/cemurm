-- ═══════════════════════════════════════════════════════════════
-- 0047 — setlist share links: a token, a permission and a 7-day expiry.
--
-- Requirement source (features/export-and-sharing.feature:55-67):
--   "When I tap \"Share\" and choose \"Copy Link\"
--    Then a link is copied to my clipboard
--    And the link grants view-and-edit access to bandmates
--    And the link contains a token that expires in 7 days"
--   "When I share the link with \"view-only\" permission
--    Then my bandmate receives a read-only link
--    And the bandmate can see the setlist but not edit it"
--
-- Design, and why it is this shape:
--
--   * The link's capability is a row, not a signed claim. There is no server
--     to sign with — the client talks to PostgREST directly — so a token that
--     could be verified offline would have to carry the secret it is verified
--     by. A row is revocable, expirable and auditable, which the scenarios
--     require and a JWT is not.
--
--   * Redeeming a link GRANTS A COLLABORATOR ROW, it does not bypass RLS.
--     The recipient becomes an ordinary accepted collaborator with
--     can_edit = (permission = 'edit'), so every existing read/write policy
--     that already understands collaborators keeps working unchanged, and a
--     view-only link cannot write because can_edit is false — the same gate
--     the owner's own permision picker uses. The alternative (a public read
--     policy keyed on the token) would have needed a second, weaker path
--     through every setlist_item policy.
--
--   * Creation is RPC-only. There is no INSERT policy: a client that could
--     insert its own row could set expires_at itself and mint a link that
--     never expires. The definer function stamps now() + 7 days, so the
--     expiry the scenario asks for is not a client-side convention.
--
--   * Anonymity is NOT claimed. The scenarios say "bandmates" and "my
--     bandmate", and the app's route table is auth-gated; an anonymous holder
--     of a link has no session to attribute the collaborator row to. The
--     redeem function therefore requires authentication, and the route that
--     consumes it sits inside RequireAuth. A signed-out visitor is sent to
--     /auth and currently loses the token — recorded as an open gap in
--     odd/tasks/hito6-n3-product-slice.md rather than papered over.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.setlist_share_links (
  id          uuid primary key default gen_random_uuid(),
  setlist_id  uuid not null references public.setlists(id) on delete cascade,
  -- uuid, not a hand-rolled string: 122 random bits, and the same
  -- capability-token shape 0032 uses for overlay access.
  token       uuid not null default gen_random_uuid(),
  permission  text not null default 'view'
              check (permission in ('view', 'edit')),
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz
);

create unique index if not exists idx_setlist_share_links_token
  on public.setlist_share_links(token);
create index if not exists idx_setlist_share_links_setlist
  on public.setlist_share_links(setlist_id);

alter table public.setlist_share_links enable row level security;
revoke all on table public.setlist_share_links from anon, authenticated;

-- Owner-only visibility. A non-member cannot even learn that a token exists:
-- redemption never reads this table under the caller's role, it goes through
-- the definer function below.
drop policy if exists setlist_share_links_select_owner on public.setlist_share_links;
create policy setlist_share_links_select_owner on public.setlist_share_links
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.setlists s
      where s.id = setlist_share_links.setlist_id
        and s.owner_id = (select auth.uid())
    )
  );

-- Revoking a link is a DELETE, not a status flip: the row is the capability,
-- so removing it is the only way to be sure nothing can redeem it later.
-- (revoked_at stays in the schema for an audited soft-revoke path, and the
-- redeem function refuses it either way.)
drop policy if exists setlist_share_links_delete_owner on public.setlist_share_links;
create policy setlist_share_links_delete_owner on public.setlist_share_links
  for delete to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.setlists s
      where s.id = setlist_share_links.setlist_id
        and s.owner_id = (select auth.uid())
    )
  );

-- No INSERT and no UPDATE policy on purpose: creation is the function below,
-- and nothing in the app edits a link in place.
grant select, delete on table public.setlist_share_links to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Create: owner only, always 7 days. Returns the token the client puts in
-- the copied link; the row is never read back by the caller.
-- ─────────────────────────────────────────────────────────────
create or replace function public.create_setlist_share_link(
  p_setlist_id uuid,
  p_permission text default 'view'
)
returns table (share_token uuid, share_permission text, share_expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor    uuid := (select auth.uid());
  v_owner    uuid;
  v_token    uuid;
  v_expires  timestamptz;
begin
  if v_actor is null then
    raise exception 'Not authenticated.';
  end if;
  if p_permission is null or p_permission not in ('view', 'edit') then
    raise exception 'A share link is either view-only or can edit.';
  end if;

  select s.owner_id into v_owner from public.setlists s where s.id = p_setlist_id;
  if v_owner is null then
    raise exception 'Setlist not found.';
  end if;
  if v_owner <> v_actor then
    raise exception 'Only the setlist owner can create a share link.';
  end if;

  v_expires := now() + interval '7 days';

  insert into public.setlist_share_links (setlist_id, permission, created_by, expires_at)
  values (p_setlist_id, p_permission, v_actor, v_expires)
  returning token into v_token;

  return query select v_token, p_permission, v_expires;
end $$;

revoke all on function public.create_setlist_share_link(uuid, text) from public;
grant execute on function public.create_setlist_share_link(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Redeem: authenticated recipient becomes an accepted collaborator with the
-- permission the link carries. Idempotent — redeeming twice keeps one row and
-- never downgrades edit access that is already held.
-- ─────────────────────────────────────────────────────────────
create or replace function public.redeem_setlist_share(p_token uuid)
returns table (setlist_id uuid, permission text)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor    uuid := (select auth.uid());
  v_link     public.setlist_share_links%rowtype;
  v_owner    uuid;
  v_can_edit boolean;
begin
  if v_actor is null then
    raise exception 'Not authenticated.';
  end if;

  select * into v_link from public.setlist_share_links l where l.token = p_token;
  -- One literal for "unknown", "revoked" and "expired": a holder of a dead
  -- link must not learn which of the three it was.
  if v_link.id is null
     or v_link.revoked_at is not null
     or v_link.expires_at <= now() then
    raise exception 'This share link is invalid or has expired.';
  end if;

  select s.owner_id into v_owner from public.setlists s where s.id = v_link.setlist_id;
  if v_owner is null then
    raise exception 'This share link is invalid or has expired.';
  end if;

  -- The owner opening their own link is a no-op; it must not create a
  -- collaborator row on their own setlist.
  if v_owner <> v_actor then
    select c.can_edit into v_can_edit from public.setlist_collaborators c
    where c.setlist_id = v_link.setlist_id and c.user_id = v_actor;

    if not found then
      insert into public.setlist_collaborators (setlist_id, user_id, can_edit, accepted_at)
      values (v_link.setlist_id, v_actor, (v_link.permission = 'edit'), now());
    else
      -- Never downgrade: an editor who redeems a view-only link stays an
      -- editor, and a pending invite becomes accepted.
      update public.setlist_collaborators c
        set can_edit = c.can_edit or (v_link.permission = 'edit'),
            accepted_at = coalesce(c.accepted_at, now())
      where c.setlist_id = v_link.setlist_id and c.user_id = v_actor;
    end if;
  end if;

  return query select v_link.setlist_id, v_link.permission;
end $$;

revoke all on function public.redeem_setlist_share(uuid) from public;
grant execute on function public.redeem_setlist_share(uuid) to authenticated;
