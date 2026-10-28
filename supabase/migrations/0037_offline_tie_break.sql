-- CEMURM 0037 — Offline conflict tie-break: one arbitration RPC + its append-only record
--
-- Closes finding D (odd/tasks/music-theory-discrepancies.md), the last of the ten
-- discrepancies. features/offline-edit-conflict-policy.feature:47-51 requires that two
-- conflicting writes carrying the SAME timestamp apply a RECORDED tie-break rule, and
-- that the applied rule is STORED with the resolution so every device reaches the same
-- result. Record: odd/tasks/offline-conflict-tie-break.md.
--
-- WHY AN RPC AND NOT A TRIGGER. The existing item write path
-- (setlist_items_bump_setlists_updated_at, 0006:284-297) can only stamp
-- setlists.updated_at from the SERVER clock — it cannot see the client's queuedAt or the
-- op's key. The deciding value must be visible to BOTH writers, and the item change and
-- the resolution write must be atomic (one call, one transaction), which a trigger on
-- setlist_items cannot do. So the arbitration lives in this RPC: it reads the latest
-- resolution for (setlist, song), decides, and only then performs the item change and
-- inserts the resolution row in the same function call.
--
-- WHY THE KEY IS A PER-OP uuid, NOT THE AUTHOR ID. (queuedAt, opKey) has to be a genuine
-- total order: a uuid v4 pair never collides, while the author id does — the same user
-- on two devices at the same millisecond still ties, and seq cannot break it (seq is
-- per-queue, so two devices collide at 0). The uuid also carries no authorship meaning:
-- no user is ranked above another by "lexicographically greater id". The client mirror
-- ADDED IN WU2 (src/domain/setlist/collab.js) WILL compare op.opKey the same way; the rule
-- is stated in both languages against the same fixtures (see the smoke file). It does not
-- exist yet — the client half is WU2, deliberately not in this migration.
--
-- WHY THE COMPARISON IS ON TEXT FOR THE KEY AND ON THE VALUE FOR THE TIMESTAMP. The
-- client mirror added in WU2 will compare the canonical uuid STRING, so the server
-- compares ::text too —
-- the shared contract is the string order, not an implicit binary uuid order. The
-- timestamp, by contrast, is compared on the resolved timestamptz VALUE (a strict `>`
-- and an `=`), never on a rendered form.
--
-- Precedents: move_setlist_items (0009:56-89) — the closest setlist-item mutating RPC,
-- whose permission check and lock-then-open execute grants this file mirrors; the setlist
-- member policies (0002:176-368); the bump trigger contract (0006:262-305). Refs:
-- setlists / setlist_collaborators / setlist_items (0001:155-190),
-- private.session_owns_setlist (0002:142-149).
--
-- Sections: 1 append-only record table · 2 RLS + grants · 3 arbitration RPC + grants.

-- ══════════════════════ 1. APPEND-ONLY RESOLUTION RECORD ══════════════════════
-- One row per APPLIED resolution: which op won, when it was queued, under which key, and
-- (the feature:51 half) by which rule. The table is append-only by GRANT, not by trigger:
-- clients get SELECT only, so an update or a delete is refused at the privilege layer
-- before RLS is ever consulted. The comparator's "latest row" read and the audit trail
-- are the same rows — one storage site, not two.
create table public.setlist_conflict_resolutions (
  id                uuid primary key default gen_random_uuid(),
  setlist_id        uuid not null references public.setlists(id) on delete cascade,
  song_id           uuid not null references public.songs(id) on delete cascade,
  op_name           text not null
                      check (op_name in ('addSongToSetlist', 'removeSongFromSetlist')),
  winner_author_id  uuid not null references auth.users(id),
  winner_queued_at  timestamptz not null,
  winner_op_key     uuid not null,
  rule              text not null check (rule in ('later-timestamp', 'op-key')),
  created_at        timestamptz not null default now()
);

-- The comparator read: the latest row for (setlist, song), ordered by
-- (winner_queued_at desc, winner_op_key desc). The index matches that order so the
-- LIMIT 1 lookup under the RPC is an index scan, not a sort over the pair's history.
create index idx_setlist_conflict_resolutions_latest
  on public.setlist_conflict_resolutions
     (setlist_id, song_id, winner_queued_at desc, winner_op_key desc);

-- ══════════════════════ 2. RLS + GRANTS (D6 ORDER) ══════════════════════
alter table public.setlist_conflict_resolutions enable row level security;

-- deny-by-default: auto_expose_new_tables grants defaults on creation — the explicit
-- revoke re-ships 0002's lock (0002 lines 57-59) before the targeted grant. anon and
-- authenticated only (repo convention, 0017:104): service_role keeps full access.
revoke all on table public.setlist_conflict_resolutions from anon, authenticated;

-- Read scope = the setlist item read scope (0002:274-292): the owner or any ACCEPTED
-- collaborator — view-only collaborators read the record too, exactly as they read the
-- items it arbitrates. Writes have no policy and no grant: every row is written by the
-- SECURITY DEFINER RPC below. The policy references setlists/collaborators only, and the
-- setlists policies never reference this table, so there is no plan-time recursion.
drop policy if exists setlist_conflict_resolutions_select_member
  on public.setlist_conflict_resolutions;
create policy setlist_conflict_resolutions_select_member
  on public.setlist_conflict_resolutions
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.setlists s
      where s.id = public.setlist_conflict_resolutions.setlist_id
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

-- Append-only: SELECT only. No INSERT (the definer RPC owns the write), no UPDATE, no
-- DELETE — the record is a history, not a mutable row.
grant select on table public.setlist_conflict_resolutions to authenticated;

-- ══════════════════════ 3. ARBITRATION RPC ══════════════════════
-- The arbiter. Order of operations matters:
--   1. identity + edit permission (mirrors move_setlist_items, 0009:65-71);
--   2. reject an op with no identity (null queuedAt/opKey) — see the guard comment;
--   3. take the per-pair advisory lock — serializes read-decide-write (see the lock note);
--   4. read the latest resolution for (setlist, song);
--   5. decide: later timestamp wins ('later-timestamp'); on an EXACT tie the greater
--      op key wins ('op-key'); anything older is superseded and writes NOTHING;
--   6. on a win only: perform the item change AND insert the resolution row. Both happen
--      in this one function call, so they cannot be separated by a client crash between
--      two statements — the reason this is an RPC and not a trigger-then-insert pair.
-- The item change mirrors the shipped client write path (setlists.js addSongToSetlist /
-- removeSongFromSetlist): add is IDEMPOTENT (no duplicate when the song is present) and
-- takes position = max + 1; remove deletes the matching item.
create function public.apply_setlist_item_op(
  p_setlist_id  uuid,
  p_song_id     uuid,
  p_op_name     text,
  p_queued_at   timestamptz,
  p_op_key      uuid
) returns jsonb
  language plpgsql security definer set search_path = '' as $$
declare
  v_actor          uuid := (select auth.uid());
  v_last_queued_at timestamptz;
  v_last_op_key    uuid;
  v_rule           text;
begin
  -- 1. Identity + edit permission. Re-asserted because definers bypass RLS (the RPC's
  --    own gate): owner, or an ACCEPTED collaborator with can_edit. A view-only
  --    collaborator and a pending invitee are refused with the same raw surface error
  --    as move_setlist_items ('No access.' is not in USER_ERRORS → generic client text).
  if v_actor is null
     or not (private.session_owns_setlist(p_setlist_id)
             or exists (select 1 from public.setlist_collaborators c
                        where c.setlist_id = p_setlist_id and c.user_id = v_actor
                          and c.accepted_at is not null and c.can_edit)) then
    raise exception 'No access.';
  end if;

  -- 2. An op with no identity cannot be arbitrated, so the RPC REFUSES it rather than
  --    inventing a decision. A missing queuedAt is a distinct, already-shipped case —
  --    finding H owns "the change lost its timestamp" on the client — and must NOT be
  --    absorbed here as an equal-timestamp tie: applying a null timestamp would write a
  --    resolution the rule never actually ordered. winner_queued_at and winner_op_key are
  --    NOT NULL, so an apply with either null is impossible anyway; failing loudly
  --    surfaces a mis-wired call site instead of silently converting it into a no-op.
  if p_queued_at is null or p_op_key is null then
    raise exception 'Missing operation identity.';
  end if;

  -- Same reasoning for an unknown op name: without this guard a superseded call with a
  -- bad name would no-op silently, while an applying one would only be caught later by
  -- the table's op_name check. One guard makes every path consistent.
  if p_op_name is null
     or p_op_name not in ('addSongToSetlist', 'removeSongFromSetlist') then
    raise exception 'Unknown setlist operation.';
  end if;

  -- 3. Serialize on the (setlist, song) pair BEFORE reading it. Under READ COMMITTED (the
  --    Postgres default) two concurrent drains of the SAME pair would both read "no prior
  --    row" and both apply — and because setlist_items carries UNIQUE (setlist_id, position)
  --    (0001:188), two concurrent adds of the same song raise 23505 instead of one returning
  --    "superseded". The winner would then be ARRIVAL-ORDER-dependent, which is the exact
  --    non-determinism this function exists to remove. The TRANSACTION-scoped advisory lock
  --    makes the read-decide-write atomic per pair and releases automatically on commit or
  --    abort. The key hashes the two ids: a collision between DISTINCT pairs only
  --    over-serializes them, it never changes a decision. Taken AFTER the guards, so an
  --    unauthorized call never takes a lock. (pg_advisory_xact_lock and hashtextextended
  --    live in pg_catalog, which `set search_path = ''` still searches implicitly.)
  perform pg_advisory_xact_lock(
    hashtextextended(p_setlist_id::text || ':' || p_song_id::text, 0));

  -- 4. Latest existing resolution for this (setlist, song): greatest (queued_at, op_key).
  select r.winner_queued_at, r.winner_op_key
    into v_last_queued_at, v_last_op_key
  from public.setlist_conflict_resolutions r
  where r.setlist_id = p_setlist_id and r.song_id = p_song_id
  order by r.winner_queued_at desc, r.winner_op_key desc
  limit 1;

  -- 5. Decide. `not found` ⇒ no prior row ⇒ the first write wins on the primary order.
  if not found then
    v_rule := 'later-timestamp';
  elsif p_queued_at > v_last_queued_at then
    v_rule := 'later-timestamp';
  elsif p_queued_at = v_last_queued_at then
    -- Exact tie: the canonical string order of the two uuids is the shared contract
    -- (the WU2 client mirror will compare strings). Greater key wins; equal-or-lesser
    -- loses.
    if p_op_key::text > v_last_op_key::text then
      v_rule := 'op-key';
    else
      return jsonb_build_object('applied', false, 'rule', null, 'superseded', true);
    end if;
  else
    return jsonb_build_object('applied', false, 'rule', null, 'superseded', true);
  end if;

  -- 6. Apply the item change and record the resolution TOGETHER.
  if p_op_name = 'addSongToSetlist' then
    -- Idempotent, like the client online path: insert only when absent. position =
    -- max + 1 (empty setlist ⇒ max is null ⇒ position 0), matching setlists.js:572-584.
    insert into public.setlist_items (setlist_id, song_id, position)
    select p_setlist_id, p_song_id,
           coalesce((select max(i.position) from public.setlist_items i
                     where i.setlist_id = p_setlist_id), -1) + 1
    where not exists (
      select 1 from public.setlist_items i
      where i.setlist_id = p_setlist_id and i.song_id = p_song_id);
  else
    delete from public.setlist_items i
    where i.setlist_id = p_setlist_id and i.song_id = p_song_id;
  end if;

  insert into public.setlist_conflict_resolutions
    (setlist_id, song_id, op_name, winner_author_id, winner_queued_at, winner_op_key, rule)
  values
    (p_setlist_id, p_song_id, p_op_name, v_actor, p_queued_at, p_op_key, v_rule);

  return jsonb_build_object('applied', true, 'rule', v_rule, 'superseded', false);
end $$;

-- lock-then-open: revoke the PUBLIC default grant (a definer RPC must not be anon-callable),
-- then open it to authenticated (the setlist edit surface) and service_role.
revoke all on function public.apply_setlist_item_op(uuid, uuid, text, timestamptz, uuid)
  from public, anon;
grant execute on function public.apply_setlist_item_op(uuid, uuid, text, timestamptz, uuid)
  to authenticated, service_role;
