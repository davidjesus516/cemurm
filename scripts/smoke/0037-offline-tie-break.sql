-- 0037 Offline conflict tie-break smoke (local dev only; fresh reset DB, single run).
--
-- Reuses the seed fixture: Demo Setlist 30000000-…-…001 owned by demo …0001,
-- isolation …0002 ACCEPTED view-only collaborator (can_edit false), outsider …0003
-- PENDING collaborator (accepted_at NULL); all password `password1234`. The
-- tie-break fixtures are FIXED literals (gen_random_uuid would not cross role
-- switches): setlist 30000…7e0 owned by demo, songs 20000000-…-7b1..7b9, and the
-- op keys 30000…7f0/7f1/7f2. The 30000…7xx family avoids the seed's
-- 30000000-…-…001 setlist; no collision with 0026's 6xx or 0028's 8xx fixtures.
--
-- Matrix — what this migration actually promises (features/offline-edit-conflict-
-- policy.feature:47-51, finding D):
--   · an op with no prior resolution applies and records rule 'later-timestamp';
--   · a strictly later timestamp applies and records 'later-timestamp';
--   · an EXACT tie resolves on the op key: the greater canonical uuid string applies
--     and records rule 'op-key';
--   · an exact tie with the lesser key is superseded, applies NOTHING and writes NO
--     resolution row — the assertion the whole change exists for;
--   · a superseded op writes NOTHING on the ITEM side too, for BOTH op names;
--   · both reconciled op names are exercised: removeSongFromSetlist applies and can be
--     superseded exactly like addSongToSetlist;
--   · the same pair called in EITHER order reaches the SAME winner (determinism);
--   · the applied rule is READ BACK from the table, not only from the RPC return;
--   · the RPC serializes on the per-pair advisory lock (single-session contention);
--   · the record is append-only: read by setlist members, no client write grant;
--   · a non-editing member / non-member cannot arbitrate, and an op with no identity
--     (null queuedAt/opKey) is refused, never silently applied.
--
-- Assertions that read contract tables directly run under role postgres
-- (deny-by-default; RLS is the client gate — proven explicitly at the member read).
-- Role switches use `select set_config(...)` (bare calls are not valid top-level
-- statements); the RPC's jsonb return is captured with `\gset` so each call runs
-- exactly once (the RPC writes on success).
-- expects 40 PASS / 0 FAIL
set client_min_messages to notice;

create or replace function tmp_assert(p_name text, p_ok boolean) returns void language plpgsql as $$
begin
  if p_ok then raise notice '[PASS] %', p_name;
  else raise notice '[FAIL] %', p_name; end if;
end $$;

create or replace function tmp_expect_error(p_name text, p_sql text, p_like text) returns void language plpgsql as $$
declare err text := '';
begin
  begin
    execute p_sql;
  exception when others then
    err := sqlerrm;
  end;
  if err <> '' and err like p_like then raise notice '[PASS] %', p_name;
  else raise notice '[FAIL] % (got: %)', p_name, err; end if;
end $$;

-- ══════════════ 1. CONTRACT (role postgres) ══════════════
\echo '--- 1. contract (role postgres) ---'
select set_config('role', 'postgres', false);

select tmp_assert(
  '0037 resolution table has exactly the 9 contract columns',
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'setlist_conflict_resolutions') = 9
  and (select count(*) from information_schema.columns
        where table_schema = 'public' and table_name = 'setlist_conflict_resolutions'
          and column_name in ('id', 'setlist_id', 'song_id', 'op_name', 'winner_author_id',
                              'winner_queued_at', 'winner_op_key', 'rule', 'created_at')) = 9
);

select tmp_assert(
  '0037 op_name is the closed vocabulary addSongToSetlist | removeSongFromSetlist',
  exists (select 1 from pg_constraint
           where conrelid = 'public.setlist_conflict_resolutions'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%addSongToSetlist%'
             and pg_get_constraintdef(oid) like '%removeSongFromSetlist%')
);

select tmp_assert(
  '0037 rule is the closed vocabulary later-timestamp | op-key',
  exists (select 1 from pg_constraint
           where conrelid = 'public.setlist_conflict_resolutions'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%later-timestamp%'
             and pg_get_constraintdef(oid) like '%op-key%')
);

select tmp_assert(
  '0037 RLS is enabled on the resolution table',
  (select relrowsecurity from pg_class where relname = 'setlist_conflict_resolutions')
);

-- Append-only by GRANT: the record is a history, so the client holds SELECT only —
-- the definer RPC is the only writer.
select tmp_assert(
  '0037 authenticated holds SELECT only on the resolution table',
  has_table_privilege('authenticated', 'public.setlist_conflict_resolutions', 'SELECT')
  and not has_table_privilege('authenticated', 'public.setlist_conflict_resolutions', 'INSERT')
  and not has_table_privilege('authenticated', 'public.setlist_conflict_resolutions', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.setlist_conflict_resolutions', 'DELETE')
);

select tmp_assert(
  '0037 apply_setlist_item_op is SECURITY DEFINER with search_path locked',
  (select bool_and(p.prosecdef) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'apply_setlist_item_op')
  and exists (select 1 from pg_proc p
                join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'apply_setlist_item_op'
                 and array_to_string(p.proconfig, ',') like '%search_path=%')
);

select tmp_assert(
  '0037 RPC execute is authenticated + service_role only (not PUBLIC/anon)',
  exists (select 1 from information_schema.routine_privileges
           where specific_schema = 'public' and specific_name like 'apply_setlist_item_op%'
             and grantee = 'authenticated' and privilege_type = 'EXECUTE')
  and not exists (select 1 from information_schema.routine_privileges
                   where specific_schema = 'public' and specific_name like 'apply_setlist_item_op%'
                     and grantee in ('PUBLIC', 'anon') and privilege_type = 'EXECUTE')
);

select tmp_assert(
  '0037 the latest-resolution index exists',
  exists (select 1 from pg_indexes
           where schemaname = 'public' and tablename = 'setlist_conflict_resolutions'
             and indexname = 'idx_setlist_conflict_resolutions_latest')
);

-- ══════════════ 2. FIXTURES + ARBITRATION (demo …0001 authenticated) ══════════════
\echo '--- 2. fixtures + arbitration (demo authenticated) ---'
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

insert into public.setlists (id, org_id, branch_id, owner_id, name, visibility) values
  ('30000000-0000-0000-0000-0000000007e0', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000001',
   'Tie-break Smoke Setlist', 'private');

insert into public.songs (id, org_id, branch_id, title, created_by) values
  ('20000000-0000-0000-0000-0000000007b1', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Tie-break Song 1', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-0000000007b2', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Tie-break Song 2', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-0000000007b3', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Tie-break Song 3', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-0000000007b4', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Tie-break Song 4', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-0000000007b5', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Tie-break Song 5', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-0000000007b6', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Tie-break Song 6', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-0000000007b7', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Tie-break Song 7', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-0000000007b8', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Tie-break Song 8', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-0000000007b9', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Tie-break Song 9', '10000000-0000-0000-0000-000000000001');

-- ── T1: no prior resolution → apply on the primary order ──
select public.apply_setlist_item_op(
  '30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b1',
  'addSongToSetlist', '2026-10-13T10:00:00Z', '30000000-0000-0000-0000-0000000007f1') as res \gset t1_

select tmp_assert(
  '0037 T1 no prior row applies with rule later-timestamp',
  (:'t1_res')::jsonb ->> 'applied' = 'true'
  and (:'t1_res')::jsonb ->> 'rule' = 'later-timestamp'
  and (:'t1_res')::jsonb ->> 'superseded' = 'false'
);

select set_config('role', 'postgres', false);
select tmp_assert(
  '0037 T1 the applied rule is STORED on the resolution (read back)',
  (select count(*) from public.setlist_conflict_resolutions r
    where r.setlist_id = '30000000-0000-0000-0000-0000000007e0'
      and r.song_id = '20000000-0000-0000-0000-0000000007b1'
      and r.rule = 'later-timestamp') = 1
);
select tmp_assert(
  '0037 T1 the add was applied to the setlist items',
  (select count(*) from public.setlist_items i
    where i.setlist_id = '30000000-0000-0000-0000-0000000007e0'
      and i.song_id = '20000000-0000-0000-0000-0000000007b1') = 1
);

-- ── T2: strictly later timestamp → applies, 'later-timestamp' ──
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
select public.apply_setlist_item_op(
  '30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b2',
  'addSongToSetlist', '2026-10-13T10:00:00Z', '30000000-0000-0000-0000-0000000007f1');
select public.apply_setlist_item_op(
  '30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b2',
  'addSongToSetlist', '2026-10-13T10:05:00Z', '30000000-0000-0000-0000-0000000007f1') as res \gset t2_

select tmp_assert(
  '0037 T2 a strictly later timestamp applies with rule later-timestamp',
  (:'t2_res')::jsonb ->> 'applied' = 'true'
  and (:'t2_res')::jsonb ->> 'rule' = 'later-timestamp'
);

select set_config('role', 'postgres', false);
select tmp_assert(
  '0037 T2 the later write is the stored latest, rule later-timestamp',
  (select r.rule from public.setlist_conflict_resolutions r
    where r.setlist_id = '30000000-0000-0000-0000-0000000007e0'
      and r.song_id = '20000000-0000-0000-0000-0000000007b2'
    order by r.winner_queued_at desc, r.winner_op_key desc limit 1) = 'later-timestamp'
  and (select count(*) from public.setlist_conflict_resolutions r
        where r.setlist_id = '30000000-0000-0000-0000-0000000007e0'
          and r.song_id = '20000000-0000-0000-0000-0000000007b2') = 2
);

-- ── T3: equal timestamp, GREATER op key → applies, 'op-key' ──
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
select public.apply_setlist_item_op(
  '30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b3',
  'addSongToSetlist', '2026-10-13T10:00:00Z', '30000000-0000-0000-0000-0000000007f1');
select public.apply_setlist_item_op(
  '30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b3',
  'addSongToSetlist', '2026-10-13T10:00:00Z', '30000000-0000-0000-0000-0000000007f2') as res \gset t3_

select tmp_assert(
  '0037 T3 an exact tie with the GREATER key applies with rule op-key',
  (:'t3_res')::jsonb ->> 'applied' = 'true'
  and (:'t3_res')::jsonb ->> 'rule' = 'op-key'
  and (:'t3_res')::jsonb ->> 'superseded' = 'false'
);

select set_config('role', 'postgres', false);
select tmp_assert(
  '0037 T3 the op-key rule is STORED on the winning resolution',
  (select r.rule from public.setlist_conflict_resolutions r
    where r.setlist_id = '30000000-0000-0000-0000-0000000007e0'
      and r.song_id = '20000000-0000-0000-0000-0000000007b3'
    order by r.winner_queued_at desc, r.winner_op_key desc limit 1) = 'op-key'
  and (select r.winner_op_key from public.setlist_conflict_resolutions r
        where r.setlist_id = '30000000-0000-0000-0000-0000000007e0'
          and r.song_id = '20000000-0000-0000-0000-0000000007b3'
        order by r.winner_queued_at desc, r.winner_op_key desc limit 1)
      = '30000000-0000-0000-0000-0000000007f2'
);

-- ── T4: equal timestamp, LESSER op key → superseded, NOTHING written ──
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
select public.apply_setlist_item_op(
  '30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b4',
  'addSongToSetlist', '2026-10-13T10:00:00Z', '30000000-0000-0000-0000-0000000007f2');
select public.apply_setlist_item_op(
  '30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b4',
  'addSongToSetlist', '2026-10-13T10:00:00Z', '30000000-0000-0000-0000-0000000007f0') as res \gset t4_

select tmp_assert(
  '0037 T4 an exact tie with the LESSER key is superseded and NOT applied',
  (:'t4_res')::jsonb ->> 'applied' = 'false'
  and (:'t4_res')::jsonb ->> 'superseded' = 'true'
  and (:'t4_res')::jsonb ->> 'rule' is null
);

select set_config('role', 'postgres', false);
select tmp_assert(
  '0037 T4 the superseded call writes NO resolution row',
  (select count(*) from public.setlist_conflict_resolutions r
    where r.setlist_id = '30000000-0000-0000-0000-0000000007e0'
      and r.song_id = '20000000-0000-0000-0000-0000000007b4') = 1
);
select tmp_assert(
  '0037 T4 the surviving resolution is the earlier winner (later-timestamp)',
  (select r.rule from public.setlist_conflict_resolutions r
    where r.setlist_id = '30000000-0000-0000-0000-0000000007e0'
      and r.song_id = '20000000-0000-0000-0000-0000000007b4') = 'later-timestamp'
);

-- ── T5: determinism — the same pair in EITHER order reaches the SAME winner ──
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
-- order A then B on song 7b5
select public.apply_setlist_item_op(
  '30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b5',
  'addSongToSetlist', '2026-10-13T10:00:00Z', '30000000-0000-0000-0000-0000000007f1');
select public.apply_setlist_item_op(
  '30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b5',
  'addSongToSetlist', '2026-10-13T10:00:00Z', '30000000-0000-0000-0000-0000000007f2');
-- order B then A on song 7b6 (a fresh fixture)
select public.apply_setlist_item_op(
  '30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b6',
  'addSongToSetlist', '2026-10-13T10:00:00Z', '30000000-0000-0000-0000-0000000007f2');
select public.apply_setlist_item_op(
  '30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b6',
  'addSongToSetlist', '2026-10-13T10:00:00Z', '30000000-0000-0000-0000-0000000007f1');

select set_config('role', 'postgres', false);
select tmp_assert(
  '0037 T5 order A→B lands on keyB as the winner',
  (select r.winner_op_key from public.setlist_conflict_resolutions r
    where r.setlist_id = '30000000-0000-0000-0000-0000000007e0'
      and r.song_id = '20000000-0000-0000-0000-0000000007b5'
    order by r.winner_queued_at desc, r.winner_op_key desc limit 1)
    = '30000000-0000-0000-0000-0000000007f2'
);
select tmp_assert(
  '0037 T5 order B→A lands on keyB as the winner',
  (select r.winner_op_key from public.setlist_conflict_resolutions r
    where r.setlist_id = '30000000-0000-0000-0000-0000000007e0'
      and r.song_id = '20000000-0000-0000-0000-0000000007b6'
    order by r.winner_queued_at desc, r.winner_op_key desc limit 1)
    = '30000000-0000-0000-0000-0000000007f2'
);
select tmp_assert(
  '0037 T5 both drain orders converge on the SAME winning key',
  (select r.winner_op_key from public.setlist_conflict_resolutions r
    where r.setlist_id = '30000000-0000-0000-0000-0000000007e0'
      and r.song_id = '20000000-0000-0000-0000-0000000007b5'
    order by r.winner_queued_at desc, r.winner_op_key desc limit 1)
  = (select r.winner_op_key from public.setlist_conflict_resolutions r
      where r.setlist_id = '30000000-0000-0000-0000-0000000007e0'
        and r.song_id = '20000000-0000-0000-0000-0000000007b6'
      order by r.winner_queued_at desc, r.winner_op_key desc limit 1)
);
-- The add is idempotent: two applied adds of the same song leave ONE item.
select tmp_assert(
  '0037 add is idempotent: an applied re-add leaves a single item',
  (select count(*) from public.setlist_items i
    where i.setlist_id = '30000000-0000-0000-0000-0000000007e0'
      and i.song_id = '20000000-0000-0000-0000-0000000007b5') = 1
);

-- ── T6: removeSongFromSetlist APPLIES on a later timestamp ──
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
-- Establish song 7b7 present, then remove it with a strictly later queuedAt.
select public.apply_setlist_item_op(
  '30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b7',
  'addSongToSetlist', '2026-10-13T10:00:00Z', '30000000-0000-0000-0000-0000000007f1');
select public.apply_setlist_item_op(
  '30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b7',
  'removeSongFromSetlist', '2026-10-13T10:05:00Z', '30000000-0000-0000-0000-0000000007f1') as res \gset t6_

select tmp_assert(
  '0037 T6 a later remove APPLIES with rule later-timestamp',
  (:'t6_res')::jsonb ->> 'applied' = 'true'
  and (:'t6_res')::jsonb ->> 'rule' = 'later-timestamp'
  and (:'t6_res')::jsonb ->> 'superseded' = 'false'
);

select set_config('role', 'postgres', false);
select tmp_assert(
  '0037 T6 the applied remove deletes the item row',
  (select count(*) from public.setlist_items i
    where i.setlist_id = '30000000-0000-0000-0000-0000000007e0'
      and i.song_id = '20000000-0000-0000-0000-0000000007b7') = 0
);
select tmp_assert(
  '0037 T6 the latest resolution is recorded with op_name removeSongFromSetlist',
  (select r.op_name from public.setlist_conflict_resolutions r
    where r.setlist_id = '30000000-0000-0000-0000-0000000007e0'
      and r.song_id = '20000000-0000-0000-0000-0000000007b7'
    order by r.winner_queued_at desc, r.winner_op_key desc limit 1) = 'removeSongFromSetlist'
);

-- ── T7: a SUPERSEDED remove writes NOTHING on the item side either ──
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
-- 7b8 present; the prior resolution won by the GREATER key 7f2 at 10:00.
select public.apply_setlist_item_op(
  '30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b8',
  'addSongToSetlist', '2026-10-13T10:00:00Z', '30000000-0000-0000-0000-0000000007f2');
-- Same queuedAt, LESSER key 7f0: the remove loses and must write nothing.
select public.apply_setlist_item_op(
  '30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b8',
  'removeSongFromSetlist', '2026-10-13T10:00:00Z', '30000000-0000-0000-0000-0000000007f0') as res \gset t7_

select tmp_assert(
  '0037 T7 a superseded remove is NOT applied (rule null)',
  (:'t7_res')::jsonb ->> 'applied' = 'false'
  and (:'t7_res')::jsonb ->> 'superseded' = 'true'
  and (:'t7_res')::jsonb ->> 'rule' is null
);

select set_config('role', 'postgres', false);
select tmp_assert(
  '0037 T7 the superseded remove leaves the item row in place',
  (select count(*) from public.setlist_items i
    where i.setlist_id = '30000000-0000-0000-0000-0000000007e0'
      and i.song_id = '20000000-0000-0000-0000-0000000007b8') = 1
);
select tmp_assert(
  '0037 T7 the superseded remove writes NO new resolution row',
  (select count(*) from public.setlist_conflict_resolutions r
    where r.setlist_id = '30000000-0000-0000-0000-0000000007e0'
      and r.song_id = '20000000-0000-0000-0000-0000000007b8') = 1
);

-- ══════════════ 3. PERMISSION + IDENTITY GUARDS (authenticated) ══════════════
\echo '--- 3. permission + identity guards ---'
-- Accepted VIEW-ONLY collaborator …0002 on the seed setlist: no edit right.
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
select tmp_expect_error(
  '0037 a view-only collaborator cannot arbitrate an op',
  $$select public.apply_setlist_item_op(
      '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
      'addSongToSetlist', '2026-10-13T11:00:00Z', '30000000-0000-0000-0000-0000000007f1')$$,
  '%No access.%'
);

-- PENDING collaborator …0003 (accepted_at NULL): not yet a member.
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', false);
select tmp_expect_error(
  '0037 a pending collaborator cannot arbitrate an op',
  $$select public.apply_setlist_item_op(
      '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
      'addSongToSetlist', '2026-10-13T11:00:00Z', '30000000-0000-0000-0000-0000000007f1')$$,
  '%No access.%'
);

-- Back to demo (owner of 7e0) for the identity guards: permission passes, then the
-- guard refuses an op that carries no identity — it must NOT silently apply.
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
select tmp_expect_error(
  '0037 an op with a NULL timestamp is refused, not silently applied',
  $$select public.apply_setlist_item_op(
      '30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b1',
      'addSongToSetlist', null, '30000000-0000-0000-0000-0000000007f1')$$,
  '%Missing operation identity.%'
);
select tmp_expect_error(
  '0037 an op with a NULL key is refused, not silently applied',
  $$select public.apply_setlist_item_op(
      '30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b1',
      'addSongToSetlist', '2026-10-13T10:00:00Z', null)$$,
  '%Missing operation identity.%'
);
select tmp_expect_error(
  '0037 an unknown op name is refused',
  $$select public.apply_setlist_item_op(
      '30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b1',
      'moveSongInSetlist', '2026-10-13T10:00:00Z', '30000000-0000-0000-0000-0000000007f1')$$,
  '%Unknown setlist operation.%'
);

-- ══════════════ 4. LOCK ACQUISITION (single session) ══════════════
\echo '--- 4. lock acquisition (single session) ---'
-- Proves the RPC ACQUIRES the per-pair advisory lock — the property the pre-fix
-- arbitration lacked, and the reason it is now order-independent. NOTE the intended
-- "hold the same key with the session-scoped pg_advisory_lock, then call the RPC under a
-- statement_timeout" test CANNOT work: advisory locks are REENTRANT within a session, so
-- the same session never contends with itself and the timeout never fires. Instead we call
-- the RPC inside an explicit transaction (its transaction-scoped lock is held until that
-- transaction ends) and read the lock back from pg_locks, decoding (classid, objid) into
-- the bigint key and matching it to the exact hashtextextended(pair) the RPC computes.
-- Then ROLLBACK so nothing is applied and the lock is released.
-- What this PROVES: the RPC takes an advisory lock on THIS (setlist, song) key, so two
-- concurrent drains of the same pair serialize.
-- What it does NOT prove: true multi-session concurrency is not exercised here — T5's
-- both-orders case covers the decision logic; this covers the lock point.
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
begin;
select public.apply_setlist_item_op(
  '30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b9',
  'addSongToSetlist', '2026-10-13T10:00:00Z', '30000000-0000-0000-0000-0000000007f1');
select tmp_assert(
  '0037 the RPC holds the per-pair advisory lock (read back from pg_locks)',
  exists (
    select 1 from pg_locks
    where locktype = 'advisory'
      and pid = pg_backend_pid()
      and ((classid::bigint << 32) | objid::bigint) = hashtextextended(
            '30000000-0000-0000-0000-0000000007e0' || ':' ||
            '20000000-0000-0000-0000-0000000007b9', 0))
);
rollback;

-- ══════════════ 5. READ SCOPE + APPEND-ONLY (authenticated) ══════════════
\echo '--- 5. read scope + append-only ---'
-- The owner (a setlist member) reads the resolutions of their own setlist.
select tmp_assert(
  '0037 a setlist member reads their setlist resolutions',
  (select count(*) from public.setlist_conflict_resolutions r
    where r.setlist_id = '30000000-0000-0000-0000-0000000007e0') > 0
);

-- isolation …0002 is NOT a collaborator on 7e0 → RLS yields no rows.
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
select tmp_assert(
  '0037 a non-member reads ZERO resolution rows (RLS is the read gate)',
  (select count(*) from public.setlist_conflict_resolutions r
    where r.setlist_id = '30000000-0000-0000-0000-0000000007e0') = 0
);

-- Append-only at the GRANT layer: even the owner cannot mutate the record.
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
select tmp_expect_error(
  '0037 authenticated cannot UPDATE a resolution',
  $$update public.setlist_conflict_resolutions set rule = 'op-key'$$,
  '%permission denied%'
);
select tmp_expect_error(
  '0037 authenticated cannot DELETE a resolution',
  $$delete from public.setlist_conflict_resolutions$$,
  '%permission denied%'
);
select tmp_expect_error(
  '0037 authenticated cannot INSERT a resolution (the RPC is the only writer)',
  $$insert into public.setlist_conflict_resolutions
      (setlist_id, song_id, op_name, winner_author_id, winner_queued_at, winner_op_key, rule)
    values
      ('30000000-0000-0000-0000-0000000007e0', '20000000-0000-0000-0000-0000000007b1',
       'addSongToSetlist', '10000000-0000-0000-0000-000000000001',
       '2026-10-13T10:00:00Z', '30000000-0000-0000-0000-0000000007f1', 'op-key')$$,
  '%permission denied%'
);

-- ══════════════ 6. CLEANUP ══════════════
\echo '--- 6. cleanup ---'
select set_config('role', 'postgres', false);
delete from public.setlist_conflict_resolutions
  where setlist_id = '30000000-0000-0000-0000-0000000007e0';
delete from public.setlist_items
  where setlist_id = '30000000-0000-0000-0000-0000000007e0';
delete from public.setlists
  where id = '30000000-0000-0000-0000-0000000007e0';
delete from public.songs
  where id in ('20000000-0000-0000-0000-0000000007b1', '20000000-0000-0000-0000-0000000007b2',
               '20000000-0000-0000-0000-0000000007b3', '20000000-0000-0000-0000-0000000007b4',
               '20000000-0000-0000-0000-0000000007b5', '20000000-0000-0000-0000-0000000007b6',
               '20000000-0000-0000-0000-0000000007b7', '20000000-0000-0000-0000-0000000007b8',
               '20000000-0000-0000-0000-0000000007b9');

select tmp_assert(
  '0037 fixture tidy: no 7e0 resolutions and no tie-break songs remain',
  (select count(*) from public.setlist_conflict_resolutions
    where setlist_id = '30000000-0000-0000-0000-0000000007e0') = 0
  and (select count(*) from public.songs
        where id in ('20000000-0000-0000-0000-0000000007b1', '20000000-0000-0000-0000-0000000007b2',
                     '20000000-0000-0000-0000-0000000007b3', '20000000-0000-0000-0000-0000000007b4',
                     '20000000-0000-0000-0000-0000000007b5', '20000000-0000-0000-0000-0000000007b6',
                     '20000000-0000-0000-0000-0000000007b7', '20000000-0000-0000-0000-0000000007b8',
                     '20000000-0000-0000-0000-0000000007b9')) = 0
);

\echo
\echo 'If the expected count is 40 and you see 40 [PASS] lines with 0 [FAIL], the migration is sound.'
\echo 'This script is NOT idempotent: it commits its writes. Reset before a second run.'
reset role;
