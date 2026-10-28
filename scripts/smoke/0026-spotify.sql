-- 0026 Spotify enrichment smoke (local dev only; fresh reset DB, single run).
-- Reuses the seed fixture: demo …0001 (owner of song 20000000-…001 'Way Maker'
-- and …002 'Oceans'), isolation/outsider …0002 (owner of song …003). Enrichment
-- row ids are FIXED literals in the 30000…6xx range (gen_random_uuid would need
-- a temp-table bridge that does not cross role switches), connection ids 30000…7xx.
-- Matrix: anon gets NO grants on either table (permission denied everywhere);
-- external_connections is owner-scoped with status flip as the revoke and the
-- unique(user_id, provider) upsert as the reconnect; external_enrichments opens
-- ONLY to authenticated: insert suggestions (state='suggested', source spotify,
-- applied_by=self), update ONLY the row creator (suggested → applied|discarded),
-- and the song owner (created_by) may READ applied provenance on their song even
-- when another user applied it. Assertions that read contract tables directly run
-- under role postgres (deny-by-default; RLS is the client gate). Role switches
-- use `select set_config(...)` (bare calls are not valid top-level statements).
-- expects 24 PASS / 0 FAIL
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
  '0026 table external_connections exists',
  exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'external_connections'
  )
);

select tmp_assert(
  '0026 connection columns present',
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'external_connections'
      and column_name in ('id','user_id','provider','status','created_at'))
  = 5
);

select tmp_assert(
  '0026 unique (user_id, provider) — one row per integration',
  exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'external_connections'
      and c.conname = 'external_connections_user_id_provider_key'
  )
);

select tmp_assert(
  '0026 RLS enabled on external_connections',
  (select relrowsecurity from pg_class where relname = 'external_connections')
);

select tmp_assert(
  '0026 RLS enabled on external_enrichments',
  (select relrowsecurity from pg_class where relname = 'external_enrichments')
);

select tmp_assert(
  '0026 anon holds NO grants on either table',
  not exists (
    select 1 from information_schema.role_table_grants
    where grantee = 'anon'
      and table_name in ('external_connections', 'external_enrichments')
  )
);

-- ══════════════ 2. ANON DENIAL (deny-by-default preserved) ══════════════
select set_config('role','anon',false);
select set_config('request.jwt.claims','{}',false);

select tmp_expect_error(
  '0026 anon SELECT external_connections denied',
  $$select * from public.external_connections$$,
  '%permission denied for table%'
);

select tmp_expect_error(
  '0026 anon INSERT external_connections denied',
  $$insert into public.external_connections (user_id, provider) values ('10000000-0000-0000-0000-000000000001', 'spotify')$$,
  '%permission denied for table%'
);

select tmp_expect_error(
  '0026 anon SELECT external_enrichments denied',
  $$select * from public.external_enrichments$$,
  '%permission denied for table%'
);

select tmp_expect_error(
  '0026 anon INSERT external_enrichments denied',
  $$insert into public.external_enrichments (song_id, source, field, value, state, applied_by)
    values ('20000000-0000-0000-0000-000000000001', 'spotify', 'bpm', '{"bpm": 120}'::jsonb, 'suggested', '10000000-0000-0000-0000-000000000001')$$,
  '%permission denied for table%'
);

-- ══════════════ 3. CONNECTION LIFECYCLE (authenticated demo …0001) ══════════════
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

insert into public.external_connections
  (id, user_id, provider, status)
values
  ('30000000-0000-0000-0000-000000000711', '10000000-0000-0000-0000-000000000001', 'spotify', 'connected');

select tmp_assert(
  '0026 owner insert creates the connection row',
  exists (
    select 1 from public.external_connections c
    where c.id = '30000000-0000-0000-0000-000000000711'
  )
);

select tmp_assert(
  '0026 owner can select own connection (status visible)',
  (select status from public.external_connections c
     where c.id = '30000000-0000-0000-0000-000000000711') = 'connected'
);

select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',false);

select tmp_assert(
  '0026 outsider cannot see owner connection',
  (select count(*) from public.external_connections c
     where c.id = '30000000-0000-0000-0000-000000000711') = 0
);

-- revoke = UPDATE status='revoked' (row persists); reconnect = upsert back.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

update public.external_connections
   set status = 'revoked'
 where id = '30000000-0000-0000-0000-000000000711';

select tmp_assert(
  '0026 revoke flips status to revoked and row persists',
  (select status from public.external_connections c
     where c.id = '30000000-0000-0000-0000-000000000711') = 'revoked'
);

insert into public.external_connections
  (id, user_id, provider, status)
values
  ('30000000-0000-0000-0000-000000000711', '10000000-0000-0000-0000-000000000001', 'spotify', 'connected')
on conflict (user_id, provider) do update set status = 'connected';

select tmp_assert(
  '0026 reconnect upsert flips back to connected',
  (select status from public.external_connections c
     where c.id = '30000000-0000-0000-0000-000000000711') = 'connected'
);

-- ══════════════ 4. ENRICHMENT SUGGESTIONS + STATE MACHINE (demo) ══════════════
insert into public.external_enrichments
  (id, song_id, source, field, value, state, applied_by)
values
  ('30000000-0000-0000-0000-000000000601', '20000000-0000-0000-0000-000000000001', 'spotify', 'bpm',  '{"bpm": 97}'::jsonb, 'suggested', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000602', '20000000-0000-0000-0000-000000000001', 'spotify', 'key',  '{"key": "E major"}'::jsonb, 'suggested', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000603', '20000000-0000-0000-0000-000000000001', 'spotify', 'album_art', '{"album_art": {"url": "https://i.scdn.co/image/mock"}}'::jsonb, 'suggested', '10000000-0000-0000-0000-000000000001');

select tmp_assert(
  '0026 owner insert suggestion rows (bpm/key/album_art) reads back',
  (select count(*) from public.external_enrichments e
     where e.id in ('30000000-0000-0000-0000-000000000601','30000000-0000-0000-0000-000000000602','30000000-0000-0000-0000-000000000603')) = 3
);

-- state machine: 2 → applied, 1 → discarded (app enforces the order; RLS gates who).
update public.external_enrichments
   set state = 'applied'
 where id in ('30000000-0000-0000-0000-000000000601', '30000000-0000-0000-0000-000000000602');

update public.external_enrichments
   set state = 'discarded'
 where id = '30000000-0000-0000-0000-000000000603';

select tmp_assert(
  '0026 owner flips 2 applied + 1 discarded',
  (select count(*) from public.external_enrichments e
     where song_id = '20000000-0000-0000-0000-000000000001' and state = 'applied') = 2
  and (select count(*) from public.external_enrichments e
     where e.id = '30000000-0000-0000-0000-000000000603' and state = 'discarded') = 1
);

select tmp_assert(
  '0026 owner reads applied rows by song_id',
  (select count(*) from public.external_enrichments e
     where e.song_id = '20000000-0000-0000-0000-000000000001'
       and e.state = 'applied') = 2
);

-- Isolation probes (outsider …0002): cannot see or update demo''s rows.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',false);

select tmp_assert(
  '0026 outsider cannot see owner enrichment rows',
  (select count(*) from public.external_enrichments e
     where e.id in ('30000000-0000-0000-0000-000000000601','30000000-0000-0000-0000-000000000602','30000000-0000-0000-0000-000000000603')) = 0
);

-- Update probes run as STANDALONE statements (PostgreSQL forbids DML in
-- subquery expressions); the proof is the row remaining unchanged.
update public.external_enrichments
   set state = 'discarded'
 where id = '30000000-0000-0000-0000-000000000601';

select set_config('role','postgres',false);
select tmp_assert(
  '0026 outsider update on owner row → row unchanged (USING filter)',
  (select state = 'applied' from public.external_enrichments e
     where e.id = '30000000-0000-0000-0000-000000000601')
);

-- ══════════════ 5. SONG-OWNER READ BRANCH (cross-user applied provenance) ══════════════
-- Outsider inserts a suggestion for demo's song (insert policy: any authentic
-- user may propose a suggestion) and applies it — a row whose applied_by is NOT
-- the song owner. The song owner must still read it as applied provenance.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',false);

insert into public.external_enrichments
  (id, song_id, source, field, value, state, applied_by)
values
  ('30000000-0000-0000-0000-000000000604', '20000000-0000-0000-0000-000000000001', 'spotify', 'bpm', '{"bpm": 120}'::jsonb, 'suggested', '10000000-0000-0000-0000-000000000002');

select tmp_assert(
  '0026 any authenticated user may suggest for a song',
  exists (
    select 1 from public.external_enrichments e
    where e.id = '30000000-0000-0000-0000-000000000604'
  )
);

update public.external_enrichments
   set state = 'applied'
 where id = '30000000-0000-0000-0000-000000000604';

select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

select tmp_assert(
  '0026 song owner reads outsider-applied row (applied provenance)',
  (select count(*) from public.external_enrichments e
     where e.id = '30000000-0000-0000-0000-000000000604'
       and e.state = 'applied') = 1
);

-- ══════════════ 6. CLEANUP (postgres) ══════════════
select set_config('role','postgres',false);
delete from public.external_enrichments
 where id in ('30000000-0000-0000-0000-000000000601','30000000-0000-0000-0000-000000000602',
              '30000000-0000-0000-0000-000000000603','30000000-0000-0000-0000-000000000604');
delete from public.external_connections
 where id = '30000000-0000-0000-0000-000000000711';

select tmp_assert(
  '0026 fixture tidy: enrichment rows removed',
  (select count(*) from public.external_enrichments) = 0
);

select tmp_assert(
  '0026 fixture tidy: connection rows removed',
  (select count(*) from public.external_connections) = 0
);

reset role;