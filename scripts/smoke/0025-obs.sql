-- 0025 OBS overlay session smoke (local dev only; fresh reset DB, single run).
-- Reuses the seed fixture: Demo Setlist 30000000-…-…001 owned by demo …0001,
-- isolation …0002 accepted view-only collaborator, …0003 pending collaborator
-- (accepted_at NULL). Session ids are FIXED literals (gen_random_uuid would need
-- a temp-table bridge that does not cross role switches).
-- Matrix: capability RPC returns FULL state only for a known ACTIVE session —
-- unknown/inactive/null ⇒ empty row (no song data); direct table reads denied
-- for anon (no grants); EXECUTE anon-only (authenticated caller gets permission
-- denied); owner lifecycle owns flip active/inactive; accepted collaborator may
-- plant their OWN overlay for a visible setlist but cannot touch the owner's
-- row; pending outsider cannot plant anything. Assertions that read contract
-- tables directly run under role postgres (deny-by-default; RLS is the client
-- gate). Role switches use `select set_config(...)` (bare calls are not valid
-- top-level statements).
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

-- ══════════════ 1. SCHEMA (postgres) ══════════════
select tmp_assert(
  '0025 table overlay_sessions exists',
  exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'overlay_sessions'
  )
);

select tmp_assert(
  '0025 capability columns present',
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'overlay_sessions'
      and column_name in ('id','user_id','setlist_id','status','mode',
                          'song_index','song_total','song_title','song_key','chart_body'))
  = 10
);

select tmp_assert(
  '0025 unique (user_id, setlist_id) — one stable URL per setlist',
  exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'overlay_sessions' and c.conname = 'overlay_sessions_user_id_setlist_id_key'
  )
);

select tmp_assert(
  '0025 RLS enabled',
  (select relrowsecurity from pg_class where relname = 'overlay_sessions')
);

-- ══════════════ 2. OWNER LIFECYCLE (authenticated demo …0001) ══════════════
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

insert into public.overlay_sessions
  (id, user_id, setlist_id, status, mode, song_index, song_total, song_title, song_key, chart_body)
values
  ('00000000-0000-0000-0000-00000000b055', '10000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001', 'active', 'title', 1, 6, 'Song A', 'G', '[G] Hello');

select tmp_assert(
  '0025 owner insert creates the session row',
  exists (select 1 from public.overlay_sessions s where s.id = '00000000-0000-0000-0000-00000000b055')
);

select tmp_assert(
  '0025 owner can select own row (URL recovery after reload)',
  (select count(*) from public.overlay_sessions s
     where s.id = '00000000-0000-0000-0000-00000000b055') = 1
);

update public.overlay_sessions
   set mode = 'chords', song_index = 2, song_total = 6,
       song_title = 'Song B', song_key = 'C', chart_body = '[C] World'
 where id = '00000000-0000-0000-0000-00000000b055';

select tmp_assert(
  '0025 owner update flips mode + snapshot',
  exists (
    select 1 from public.overlay_sessions s
    where s.id = '00000000-0000-0000-0000-00000000b055'
      and s.mode = 'chords' and s.song_index = 2 and s.song_title = 'Song B'
  )
);

-- ══════════════ 3. CAPABILITY RPC (anon — the OBS CEF caller) ══════════════
select set_config('role','anon',false);
select set_config('request.jwt.claims','{}',false);

select tmp_assert(
  '0025 anon RPC: ACTIVE session returns full state',
  (select active and title = 'Song B' and body = '[C] World'
          and song_index = 2 and song_total = 6 and mode = 'chords'
     from public.overlay_state('00000000-0000-0000-0000-00000000b055'))
);

select tmp_assert(
  '0025 anon RPC: UNKNOWN session returns inactive + empty',
  not coalesce((select active from public.overlay_state('00000000-0000-0000-0000-00000000dead')), false)
  and coalesce((select title from public.overlay_state('00000000-0000-0000-0000-00000000dead')), '') = ''
);

select tmp_assert(
  '0025 anon RPC: NULL session returns inactive + empty',
  not coalesce((select active from public.overlay_state(null)), false)
);

select tmp_expect_error(
  '0025 anon direct table SELECT denied (deny-by-default)',
  $$select * from public.overlay_sessions$$,
  '%permission denied%'
);

-- ══════════════ 4. MID-STREAM DISABLE (spec scenario 8) ══════════════
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

update public.overlay_sessions
   set status = 'inactive'
 where id = '00000000-0000-0000-0000-00000000b055';

select set_config('role','anon',false);
select set_config('request.jwt.claims','{}',false);

select tmp_assert(
  '0025 disabled mid-stream: anon RPC serves inactive with NO song data',
  not coalesce((select active from public.overlay_state('00000000-0000-0000-0000-00000000b055')), false)
  and coalesce((select title from public.overlay_state('00000000-0000-0000-0000-00000000b055')), '') = ''
  and coalesce((select body from public.overlay_state('00000000-0000-0000-0000-00000000b055')), '') = ''
);

-- Re-enable for the RLS isolation probes below (row stays active).
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);
update public.overlay_sessions
   set status = 'active'
 where id = '00000000-0000-0000-0000-00000000b055';

select set_config('role','postgres',false);

select tmp_assert(
  '0025 re-enabled: RPC active again',
  (select active from public.overlay_state('00000000-0000-0000-0000-00000000b055'))
);

-- ══════════════ 5. EXECUTE SCOPE + RLS ISOLATION ══════════════
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

select tmp_expect_error(
  '0025 authenticated owner CANNOT call the anon-only RPC',
  $$select * from public.overlay_state('00000000-0000-0000-0000-00000000dead')$$,
  '%permission denied%'
);

-- Accepted view-only collaborator …0002: may plant THEIR OWN overlay for a
-- visible setlist, but cannot touch the owner row.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',false);

select tmp_assert(
  '0025 accepted collaborator cannot see owner row',
  (select count(*) from public.overlay_sessions s
     where s.id = '00000000-0000-0000-0000-00000000b055') = 0
);

-- Update probes run as STANDALONE statements (PostgreSQL forbids DML in
-- subquery expressions); the proof is the row remaining unchanged.
update public.overlay_sessions
   set status = 'inactive'
 where id = '00000000-0000-0000-0000-00000000b055';

insert into public.overlay_sessions
  (id, user_id, setlist_id, status, mode, song_index, song_total, song_title)
values
  ('00000000-0000-0000-0000-00000000c011', '10000000-0000-0000-0000-000000000002',
   '30000000-0000-0000-0000-000000000001', 'active', 'title', 0, 6, 'Song A');

select tmp_assert(
  '0025 accepted collaborator may own an overlay for a visible setlist',
  (select count(*) from public.overlay_sessions s
     where s.id = '00000000-0000-0000-0000-00000000c011') = 1
);

-- Contract read under postgres: the owner row must be UNTOUCHED by the
-- collaborator's update attempt (RLS USING filter → 0 rows changed).
select set_config('role','postgres',false);
select tmp_assert(
  '0025 accepted collaborator update on owner row → row unchanged (USING filter)',
  (select status = 'active' and song_title = 'Song B'
     from public.overlay_sessions s
     where s.id = '00000000-0000-0000-0000-00000000b055')
);

-- Pending outsider …0003 (accepted_at NULL): cannot see the setlist → no row.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',false);

select tmp_assert(
  '0025 pending outsider cannot see owner row',
  (select count(*) from public.overlay_sessions s
     where s.id = '00000000-0000-0000-0000-00000000b055') = 0
);

select tmp_expect_error(
  '0025 pending outsider cannot plant a session (setlist invisible)',
  $$insert into public.overlay_sessions
      (id, user_id, setlist_id, status)
    values
      ('00000000-0000-0000-0000-00000000d0dd', '10000000-0000-0000-0000-000000000003',
       '30000000-0000-0000-0000-000000000001', 'active')$$,
  '%row-level security%'
);

-- ── cleanup: remove the collaborator's probe row (keep the demo owner row) ──
select set_config('role','postgres',false);
delete from public.overlay_sessions where user_id = '10000000-0000-0000-0000-000000000002';

select tmp_assert(
  '0025 fixture tidy: only the owner demo row remains',
  (select count(*) from public.overlay_sessions) = 1
);

reset role;