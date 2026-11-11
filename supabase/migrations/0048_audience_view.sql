-- CEMURM 0048 — audience view: expiring capability token read path (N3 unit 3)
--
-- Requirement source:
--   features/export-and-sharing.feature:133-152 (audience view, 3 scenarios)
--
-- ── THE TABLE ALREADY EXISTED AND WAS NEVER REACHABLE ────────────────────────────────────
-- `public.audience_views` was created by 0001:539 with the model the feature needs — an
-- unguessable `token`, a `expires_at` window, an optional `user_id`/`push_token` pair for the
-- "notify me on update" opt-in, and `created_by` as the setlist owner. 0002:122 then revoked
-- every table privilege and no migration has granted one since, so the table has been dead
-- weight for 44 migrations. This file is the grant + the read path, not a new model.
--
-- Precedent: 0025_overlay_sessions.sql — the same shape (uncontrolled public URL, capability
-- row, unauthenticated RPC, uuid IS the authorization). Read it before changing anything here.
--
-- ── WHY THE TOKEN AND NOT THE SETLIST ID ─────────────────────────────────────────────────
-- The audience member is, by definition, not the owner and not necessarily a collaborator.
-- A read path keyed on `setlist_id` gated by `owner_id = auth.uid()` would only ever serve the
-- owner their own setlist — it would prove nothing about the feature. The QR/deep link carries
-- a token; the row that holds it is the entire permission. The same conclusion is recorded in
-- `src/domain/setlist/shareTargets.js` (T2): a link that grants access on its own needs its own
-- token and its own policies.
--
-- ── THE PRIVACY SLICE IS THE FUNCTION'S WHOLE JOB ────────────────────────────────────────
-- `get_audience_setlist` is SECURITY DEFINER, so RLS does NOT filter what it returns. Every
-- column it names is a deliberate disclosure decision:
--
--   disclosed   position, title, artist, duration  (what an audience reads between songs)
--   withheld    chart body, chord body, agreed_key, item notes, collaborators, owner,
--               org/branch, visibility, version ids, any song the setlist does not hold
--
-- The smoke's anti-leak assertion is the one that must never be weakened: a token for one
-- setlist must return that setlist's titles and nothing that belongs to another.
--
-- ── SOFT-DELETED SONGS STILL RENDER ──────────────────────────────────────────────────────
-- 0001:181 — "retire keeps past setlists rendering". A retired song must still appear in a
-- setlist that already held it, so this function does NOT filter `songs.is_deleted`. Filtering
-- would silently shorten a historical setlist the audience already watched.
--
-- ── DURATION RESOLUTION ──────────────────────────────────────────────────────────────────
-- `songs` has no duration column; `song_versions.duration_seconds` does (0001:108), and
-- `setlist_items.version_id` may be NULL ("picker default"). The lateral join prefers the
-- pinned version and falls back to the song's highest-numbered version. A NULL duration stays
-- NULL — the audience sees no time rather than an invented one.
--
-- ── GRANTS: NAME `authenticated` IN THE REVOKE (0047) ────────────────────────────────────
-- `revoke all ... from public, anon` removes nothing from `authenticated`, which carries the
-- inherited `arwdDxtm` from Supabase's default privileges. 0047 exists because two earlier
-- migrations made exactly that mistake and shipped TRUNCATE. This one names all three roles
-- and re-grants only what the client surface needs.

-- ══════════════ 1. OWNER LIFECYCLE (table grants + policies) ══════════════
revoke all on table public.audience_views from public, anon, authenticated;
grant select, insert, delete on table public.audience_views to authenticated;

-- RLS is already enabled on every public table by 0002's DO-loop; the policies below are the
-- only rows an authenticated caller may touch. `(select auth.uid())` is the 0002 initPlan
-- guard (design line 76): evaluated once per statement, not once per row.
-- The owner sees EVERY link issued for their setlist, not only their own: they
-- are the party accountable for it, and PostgreSQL applies the SELECT policy to
-- DELETE as well (a row that cannot be read cannot be deleted), so scoping this
-- to `created_by` would silently make the revocation below impossible for a
-- token an editor issued.
drop policy if exists audience_views_select_owner on public.audience_views;
create policy audience_views_select_owner on public.audience_views
  for select to authenticated
  using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.setlists s
      where s.id = setlist_id and s.owner_id = (select auth.uid())
    )
  );

-- Issuing a token is NOT the same act as reading a shared setlist: it exposes the setlist to
-- anonymous strangers who hold no account. The rule is therefore narrower than 0025's
-- visibility-only check — the caller must be the OWNER, or an ACCEPTED collaborator with
-- `can_edit`. A view-only collaborator (Lucia) and a pending invitee cannot publish; the
-- organizer shares (features/export-and-sharing.feature:143).
--
-- The EXISTS runs under the caller's own RLS, so a setlist they cannot see is indistinguishable
-- from one that does not exist. `created_by` must be the caller: the token is issued in their
-- name. 0002's design D7 keeps the setlists -> setlist_collaborators -> setlists chain
-- recursion-free through the collaborators self-policy.
drop policy if exists audience_views_insert_owner on public.audience_views;
create policy audience_views_insert_owner on public.audience_views
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1
      from public.setlists s
      where s.id = setlist_id
        and (
          s.owner_id = (select auth.uid())
          or exists (
            select 1
            from public.setlist_collaborators c
            where c.setlist_id = s.id
              and c.user_id = (select auth.uid())
              and c.can_edit
              and c.accepted_at is not null
          )
        )
    )
  );

-- Revocation is broader than issuance ON PURPOSE. An editor who has since been
-- removed from the setlist must not leave a live public link behind, and the
-- owner is the party accountable for the setlist — so the OWNER can revoke any
-- token issued for their setlist, whoever minted it. Scoping this to
-- `created_by` alone would strand exactly that case: the editor is gone, the
-- link keeps serving for up to 90 days, and nobody can turn it off.
drop policy if exists audience_views_delete_owner on public.audience_views;
create policy audience_views_delete_owner on public.audience_views
  for delete to authenticated
  using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.setlists s
      where s.id = setlist_id and s.owner_id = (select auth.uid())
    )
  );

-- A token inserted DIRECTLY through PostgREST never passes through the RPC, so
-- the 32-hex-char shape the RPC guarantees needs to hold at the table too: a
-- publisher who inserted a short, guessable token would be handing out a link
-- anyone could brute force. The expiry window cannot be a constraint (`now()`
-- is not immutable), so 1..90 days stays an RPC invariant and the owner's
-- revocation above is the control that makes it safe.
alter table public.audience_views
  add constraint audience_views_token_format check (token ~ '^[0-9a-f]{32}$');

-- ══════════════ 2. ISSUE A TOKEN (owner side) ══════════════
-- SECURITY INVOKER on purpose: the caller's own RLS does the authorization (the SELECT sees
-- only visible setlists, the INSERT is gated by the policy above). A definer function here
-- would have to re-implement both checks and could drift from them.
create or replace function public.create_audience_view(
  p_setlist_id uuid,
  p_days integer default 7
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_token text;
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;

  -- 7 days is the documented default (0001:542). The ceiling keeps a link from outliving the
  -- setlist it exposes by so much that revocation is the only defence anyone remembers.
  if p_days is null or p_days < 1 or p_days > 90 then
    raise exception 'Audience link expiry must be between 1 and 90 days.';
  end if;

  -- Mirrors the insert policy below for a readable error. The POLICY is the authority: RLS
  -- evaluates on the INSERT whatever this check says, so a drift here cannot widen access.
  if not exists (
    select 1
    from public.setlists s
    where s.id = p_setlist_id
      and (
        s.owner_id = v_uid
        or exists (
          select 1
          from public.setlist_collaborators c
          where c.setlist_id = s.id
            and c.user_id = v_uid
            and c.can_edit
            and c.accepted_at is not null
        )
      )
  ) then
    raise exception 'Only the owner or an editing collaborator may share a setlist with the audience.';
  end if;

  -- 32 hex chars from a v4 uuid: 122 bits of entropy, no pgcrypto dependency. The UNIQUE
  -- constraint on `token` is the collision backstop; a duplicate raises and issues nothing.
  insert into public.audience_views (setlist_id, token, expires_at, created_by)
  values (
    p_setlist_id,
    replace(gen_random_uuid()::text, '-', ''),
    now() + make_interval(days => p_days),
    v_uid
  )
  returning token into v_token;

  return v_token;
end $$;

revoke execute on function public.create_audience_view(uuid, integer) from public, anon;
grant execute on function public.create_audience_view(uuid, integer) to authenticated;

-- ══════════════ 3. THE READ PATH (audience side) ══════════════
-- SECURITY DEFINER: an anonymous viewer holds no table grant and no row policy, and the whole
-- envelope has to be assembled in one call. Expired, revoked and unknown tokens are
-- INDISTINGUISHABLE — all three return NULL, so a probe learns nothing about which setlists
-- exist. A partial envelope is never returned: either the token is live or the answer is null.
create or replace function public.get_audience_setlist(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_setlist_id uuid;
  result       jsonb;
begin
  -- Cheap sanity gate before touching the table. A real token is 32 chars; anything shorter
  -- cannot be one, so it never reaches the index lookup.
  if p_token is null or length(p_token) < 16 then
    return null;
  end if;

  select av.setlist_id into v_setlist_id
  from public.audience_views av
  where av.token = p_token
    and av.expires_at > now();

  if v_setlist_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'id',   s.id,
    'name', s.name,
    'songs', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'position',        si.position,
          'title',           so.title,
          'artist',          so.artist,
          'durationSeconds', dv.duration_seconds
        ) order by si.position
      )
      from public.setlist_items si
      join public.songs so on so.id = si.song_id
      -- Pinned version first, else the song's highest-numbered version (see header).
      left join lateral (
        select sv.duration_seconds
        from public.song_versions sv
        where sv.song_id = so.id
        order by (sv.id = si.version_id) desc, sv.number desc
        limit 1
      ) dv on true
      where si.setlist_id = v_setlist_id
    ), '[]'::jsonb)
  ) into result
  from public.setlists s
  where s.id = v_setlist_id;

  return result;
end $$;

-- The PUBLIC default EXECUTE grant is revoked first, then the two roles that need it are
-- named. `authenticated` is included deliberately and is the one deviation from 0025: an
-- audience member who has the app installed is logged in, and 0025's anon-only grant would
-- make the feature work for strangers but not for the congregation it targets. The token
-- remains the entire authorization either way, so the wider role does not widen the data.
revoke execute on function public.get_audience_setlist(text) from public, anon, authenticated;
grant execute on function public.get_audience_setlist(text) to anon, authenticated;
