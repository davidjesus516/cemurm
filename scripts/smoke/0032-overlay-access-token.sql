-- 0032 Overlay access-token smoke (local dev only; fresh reset DB, single run).
-- Reuses the seed fixture: Demo Setlist 30000000-…-…001 owned by demo …0001,
-- isolation …0002 accepted view-only collaborator, …0003 pending collaborator
-- (accepted_at NULL). Session id, old token and rotated token are FIXED
-- literals in the 30000…6xx range (gen_random_uuid would need a temp-table
-- bridge that does not cross role switches; no collision with 0026's
-- 30000…6xx/711, 0027's 30000…7xx or 0028's 30000…8xx fixtures, nor with the
-- seed's 30000000-…-…001 setlist).
-- Matrix: `overlay_state` now takes p_access_token and matches on the
-- dedicated access_token column. THE PRIMARY KEY IS NOT A CREDENTIAL — the
-- active row's own id returns the empty row while its token returns the full
-- state, which is the whole point of 0032 (0025 authenticated on the pk).
-- Only ONE overlay_state exists, with one IN parameter named p_access_token
-- (no id-accepting overload survives — pg keys functions on name + arg TYPES,
-- so create or replace swapped the body in place). SECURITY DEFINER +
-- locked search_path + anon-only EXECUTE are re-asserted. Unknown/NULL token
-- ⇒ empty row, no oracle. INACTIVE ⇒ empty row (spec scenario 8). ROTATION
-- (the capability 0032 adds): the old token stops resolving while the new one
-- serves the same snapshot on the SAME row, still active — a leaked URL is
-- revoked without ending the stream. anon still holds no table grant, and the
-- 0025 RLS policies are untouched: pending outsider sees nothing and cannot
-- plant a row. Assertions that read contract tables directly run under role
-- postgres (deny-by-default; RLS is the client gate). Role switches use
-- `select set_config(...)` (bare calls are not valid top-level statements).
-- expects 22 PASS / 0 FAIL
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
  '0032 access_token column exists on overlay_sessions',
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'overlay_sessions'
      and column_name = 'access_token'
  )
);

-- Every row gets a token without an explicit write (backfill of live rows).
select tmp_assert(
  '0032 access_token is NOT NULL with a default',
  (select is_nullable = 'NO' and column_default is not null
     from information_schema.columns
    where table_schema = 'public' and table_name = 'overlay_sessions'
      and column_name = 'access_token')
);

-- The id stays an ordinary identifier: still the pk, and NOT a unique key on
-- the capability (the id is no longer the secret).
select tmp_assert(
  '0032 id is still the primary key (an identifier, not the capability)',
  exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'overlay_sessions' and c.contype = 'p'
      and c.conname = 'overlay_sessions_pkey'
  )
);

-- The id-based door is GONE: exactly one overlay_state, one IN parameter, and
-- that parameter is p_access_token. A surviving id overload would fail this.
select tmp_assert(
  '0032 overlay_state takes p_access_token only — no id-accepting overload',
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'overlay_state'
      and p.pronargs = 1) = 1
  and (select count(*) from information_schema.parameters
        where specific_schema = 'public'
          and specific_name like 'overlay_state%'
          and parameter_mode = 'IN'
          and parameter_name = 'p_access_token'
          and data_type = 'uuid') = 1
);

select tmp_assert(
  '0032 overlay_state stays SECURITY DEFINER with search_path locked',
  (select bool_and(p.prosecdef) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'overlay_state')
  and exists (select 1 from pg_proc p
                join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'overlay_state'
                 and array_to_string(p.proconfig, ',') like '%search_path=%')
);

select tmp_assert(
  '0032 EXECUTE is anon-only (granted to anon, PUBLIC + authenticated revoked)',
  exists (select 1 from information_schema.routine_privileges
           where specific_schema = 'public'
             and specific_name like 'overlay_state%'
             and grantee = 'anon' and privilege_type = 'EXECUTE')
  and not exists (select 1 from information_schema.routine_privileges
                   where specific_schema = 'public'
                     and specific_name like 'overlay_state%'
                     and grantee in ('PUBLIC', 'authenticated')
                     and privilege_type = 'EXECUTE')
);

-- 0025's RLS is untouched: enabled, still deny-by-default to anon.
select tmp_assert(
  '0032 RLS still enabled on overlay_sessions (0025 policies unchanged)',
  (select relrowsecurity from pg_class where relname = 'overlay_sessions')
);

-- ══════════════ 2. OWNER LIFECYCLE (authenticated demo …0001) ══════════════
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

insert into public.overlay_sessions
  (id, access_token, user_id, setlist_id, status, mode,
   song_index, song_total, song_title, song_key, chart_body)
values
  ('30000000-0000-0000-0000-0000000006b2', '30000000-0000-0000-0000-0000000006c1',
   '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   'active', 'title', 1, 6, 'Song B', 'C', '[C] World');

select tmp_assert(
  '0032 owner insert lands the row with its token',
  exists (select 1 from public.overlay_sessions s
           where s.id = '30000000-0000-0000-0000-0000000006b2'
             and s.access_token = '30000000-0000-0000-0000-0000000006c1')
);

-- ══════════════ 3. THE TOKEN IS THE CAPABILITY, THE PK IS NOT (anon) ══════════════
select set_config('role','anon',false);
select set_config('request.jwt.claims','{}',false);

select tmp_assert(
  '0032 anon RPC: the access token returns full state',
  (select active and title = 'Song B' and key = 'C' and body = '[C] World'
          and song_index = 1 and song_total = 6 and mode = 'title'
     from public.overlay_state('30000000-0000-0000-0000-0000000006c1'))
);

-- THE HEADLINE. The row is active and its token is valid, so the only reason
-- the pk lookup fails is that the pk is not the lookup key. Under 0025 this
-- exact call returned the song title, key and full ChordPro body.
select tmp_assert(
  '0032 anon RPC: the PRIMARY KEY does NOT grant access (empty row)',
  not coalesce((select active
                  from public.overlay_state('30000000-0000-0000-0000-0000000006b2')), false)
  and coalesce((select title
                  from public.overlay_state('30000000-0000-0000-0000-0000000006b2')), '') = ''
  and coalesce((select body
                  from public.overlay_state('30000000-0000-0000-0000-0000000006b2')), '') = ''
);

select tmp_assert(
  '0032 anon RPC: UNKNOWN token returns inactive + empty',
  not coalesce((select active
                  from public.overlay_state('30000000-0000-0000-0000-0000000006ff')), false)
  and coalesce((select title
                  from public.overlay_state('30000000-0000-0000-0000-0000000006ff')), '') = ''
);

select tmp_assert(
  '0032 anon RPC: NULL token returns inactive + empty',
  not coalesce((select active from public.overlay_state(null)), false)
);

select tmp_expect_error(
  '0032 anon direct table SELECT denied (deny-by-default, RPC is the only path)',
  $$select * from public.overlay_sessions$$,
  '%permission denied%'
);

-- ══════════════ 4. MID-STREAM DISABLE (spec scenario 8) ══════════════
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

update public.overlay_sessions
   set status = 'inactive'
 where id = '30000000-0000-0000-0000-0000000006b2';

select set_config('role','anon',false);
select set_config('request.jwt.claims','{}',false);

select tmp_assert(
  '0032 disabled mid-stream: the VALID token serves inactive with NO song data',
  not coalesce((select active
                  from public.overlay_state('30000000-0000-0000-0000-0000000006c1')), false)
  and coalesce((select title
                  from public.overlay_state('30000000-0000-0000-0000-0000000006c1')), '') = ''
  and coalesce((select body
                  from public.overlay_state('30000000-0000-0000-0000-0000000006c1')), '') = ''
);

-- ══════════════ 5. ROTATION (the capability 0032 adds) ══════════════
-- Re-activate, then rotate the token ONLY. The id, the setlist binding and the
-- status must all survive — that is the whole point: a leaked URL is revoked
-- without ending the stream.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);
update public.overlay_sessions
   set status = 'active'
 where id = '30000000-0000-0000-0000-0000000006b2';
update public.overlay_sessions
   set access_token = '30000000-0000-0000-0000-0000000006c2'
 where id = '30000000-0000-0000-0000-0000000006b2';

select set_config('role','anon',false);
select set_config('request.jwt.claims','{}',false);

select tmp_assert(
  '0032 rotation invalidates the OLD token (leaked URL is dead)',
  not coalesce((select active
                  from public.overlay_state('30000000-0000-0000-0000-0000000006c1')), false)
  and coalesce((select body
                  from public.overlay_state('30000000-0000-0000-0000-0000000006c1')), '') = ''
);

select tmp_assert(
  '0032 rotation: the NEW token serves the same snapshot',
  (select active and title = 'Song B' and body = '[C] World'
     from public.overlay_state('30000000-0000-0000-0000-0000000006c2'))
);

-- Contract read under postgres: same row, same setlist, STILL ACTIVE — the
-- stream never stopped.
select set_config('role','postgres',false);
select tmp_assert(
  '0032 rotation kept the SAME row active (stream keeps running)',
  (select count(*) from public.overlay_sessions s
     where s.id = '30000000-0000-0000-0000-0000000006b2'
       and s.setlist_id = '30000000-0000-0000-0000-000000000001'
       and s.status = 'active'
       and s.access_token = '30000000-0000-0000-0000-0000000006c2') = 1
);

-- ══════════════ 6. EXECUTE SCOPE + RLS ISOLATION ══════════════
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

select tmp_expect_error(
  '0032 authenticated owner CANNOT call the anon-only RPC',
  $$select * from public.overlay_state('30000000-0000-0000-0000-0000000006c2')$$,
  '%permission denied%'
);

-- Accepted view-only collaborator …0002 cannot see the owner's row.
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',false);

select tmp_assert(
  '0032 accepted collaborator cannot see owner row',
  (select count(*) from public.overlay_sessions s
     where s.id = '30000000-0000-0000-0000-0000000006b2') = 0
);

-- Pending outsider …0003 (accepted_at NULL): cannot see the setlist → no row,
-- and cannot plant one (0025's INSERT policy WITH CHECK is unchanged).
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',false);

select tmp_assert(
  '0032 pending outsider cannot see owner row',
  (select count(*) from public.overlay_sessions s
     where s.id = '30000000-0000-0000-0000-0000000006b2') = 0
);

select tmp_expect_error(
  '0032 pending outsider cannot plant a session (setlist invisible)',
  $$insert into public.overlay_sessions
      (id, access_token, user_id, setlist_id, status)
    values
      ('30000000-0000-0000-0000-0000000006d1', '30000000-0000-0000-0000-0000000006d2',
       '10000000-0000-0000-0000-000000000003',
       '30000000-0000-0000-0000-000000000001', 'active')$$,
  '%row-level security%'
);

-- ── cleanup ──
select set_config('role','postgres',false);
delete from public.overlay_sessions where id = '30000000-0000-0000-0000-0000000006b2';

select tmp_assert(
  '0032 fixture tidy: no overlay_sessions rows remain',
  (select count(*) from public.overlay_sessions) = 0
);

reset role;
