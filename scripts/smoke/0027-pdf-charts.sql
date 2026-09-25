-- 0027 PDF charts Storage smoke (local dev only; fresh reset DB, single run).
-- Reuses the seed fixture: demo …0001 (owner of song 20000000-…001 'Way Maker'),
-- isolation/outsider …0002. Storage object / chart / version ids are FIXED
-- literals in the 30000…7xx range (gen_random_uuid would need a temp-table
-- bridge that does not cross role switches; no collision with 0026's 30000…6xx
-- enrichment and 30000…711 connection fixtures).
-- Matrix: bucket 'charts' stays PRIVATE (public=false — tech-spec R2 signed-
-- URLs-only direction); storage.objects carries NO grants for anon (deny-by-
-- default) while authenticated holds the stock storage grants — the four
-- pdf_objects_* policies are the ONLY gate, scoped to bucket 'charts' + owner
-- folder (first path segment = auth.uid()::text). Owner writes/reads under his
-- folder; outsider sees 0 rows and cannot plant an object under demo's folder
-- (WITH CHECK violation). chart_files/song_versions append-only flow: PDF
-- chart row (content NULL, object_key = storage path) + version v2 row → both
-- versions 1 AND 2 present (previous scan preserved). Oversized guard is
-- APP-SIDE (validatePdfFile, 10 MB product cap; 50 MiB stack cap) — the DB
-- still accepts an oversized row by design (asserted as such).
-- Assertions that read contract tables directly run under role postgres
-- (deny-by-default; RLS is the client gate). Role switches use
-- `select set_config(...)` (bare calls are not valid top-level statements).
-- expects 10 PASS / 0 FAIL
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

-- ══════════════ 1. BUCKET + POLICY SURFACE (postgres) ══════════════
select tmp_assert(
  '0027 bucket charts exists and stays PRIVATE (public=false)',
  (select count(*) from storage.buckets where id = 'charts' and public = false) = 1
);

select tmp_assert(
  '0027 storage.objects policies scoped to bucket charts (>= 3)',
  (select count(*) from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and (qual like '%charts%' or with_check like '%charts%')) >= 3
);

-- ══════════════ 2. OWNER-FOLDER RLS ON STORAGE OBJECTS ══════════════
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

-- Owner writes under his own folder: name = <uid>/<uuid>.pdf (owner folder IS
-- the RLS boundary; the uuid suffix makes the key unguessable).
insert into storage.objects (id, bucket_id, name, owner_id, metadata)
values (
  '30000000-0000-0000-0000-000000000781',
  'charts',
  '10000000-0000-0000-0000-000000000001/11111111-2222-3333-4444-555555555555.pdf',
  '10000000-0000-0000-0000-000000000001',
  '{"size": 1024, "mimetype": "application/pdf"}'::jsonb
);

select tmp_assert(
  '0027 owner insert under own folder lands and reads back',
  exists (
    select 1 from storage.objects o
    where o.id = '30000000-0000-0000-0000-000000000781'
  )
);

select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',false);

select tmp_assert(
  '0027 outsider cannot see owner object',
  (select count(*) from storage.objects o
     where o.id = '30000000-0000-0000-0000-000000000781') = 0
);

select tmp_expect_error(
  '0027 outsider cannot plant object under demo folder (WITH CHECK violation)',
  $$insert into storage.objects (id, bucket_id, name, owner_id, metadata)
    values ('30000000-0000-0000-0000-000000000782', 'charts',
            '10000000-0000-0000-0000-000000000001/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pdf',
            '10000000-0000-0000-0000-000000000002', '{"size": 1024}'::jsonb)$$,
  '%row-level security%'
);

-- ══════════════ 3. PDF CHART FLOW (append-only versions) ══════════════
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

-- v1 scan: chart_files row, format 'pdf', content NULL, object_key = storage
-- path, size_bytes > 0.
insert into public.chart_files (id, song_id, format, object_key, content, size_bytes)
values (
  '30000000-0000-0000-0000-000000000701',
  '20000000-0000-0000-0000-000000000001',
  'pdf',
  '10000000-0000-0000-0000-000000000001/11111111-2222-3333-4444-555555555555.pdf',
  null,
  1024
);

select tmp_assert(
  '0027 pdf chart row insert ok (format pdf, content NULL, object_key set)',
  exists (
    select 1 from public.chart_files c
    where c.id = '30000000-0000-0000-0000-000000000701'
      and c.format = 'pdf' and c.content is null
      and c.object_key like '10000000-0000-0000-0000-000000000001/%'
      and c.size_bytes > 0
  )
);

-- v1 version row.
insert into public.song_versions
  (id, song_id, name, number, chart_file_id, base_key, base_tempo, is_ready, owner_id, created_by)
values
  ('30000000-0000-0000-0000-000000000071', '20000000-0000-0000-0000-000000000001',
   'Original', 1, '30000000-0000-0000-0000-000000000701', 'G', 66, true,
   '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');

-- v2 scan (replace): NEW chart row + NEW version number 2; v1 stays untouched.
insert into public.chart_files (id, song_id, format, object_key, content, size_bytes)
values (
  '30000000-0000-0000-0000-000000000702',
  '20000000-0000-0000-0000-000000000001',
  'pdf',
  '10000000-0000-0000-0000-000000000001/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pdf',
  null,
  2048
);

insert into public.song_versions
  (id, song_id, name, number, chart_file_id, base_key, base_tempo, is_ready, owner_id, created_by)
values
  ('30000000-0000-0000-0000-000000000072', '20000000-0000-0000-0000-000000000001',
   'Corrected scan', 2, '30000000-0000-0000-0000-000000000702', 'G', 66, true,
   '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');

select tmp_assert(
  '0027 replace keeps BOTH versions (v1 preserved, v2 appended)',
  (select count(*) from public.song_versions v
     where v.song_id = '20000000-0000-0000-0000-000000000001') = 2
  and (select v2.chart_file_id from public.song_versions v2
        where v2.id = '30000000-0000-0000-0000-000000000072') = '30000000-0000-0000-0000-000000000702'
  and (select count(*) from public.chart_files c
        where c.song_id = '20000000-0000-0000-0000-000000000001' and c.soft_deleted = false) = 2
);

-- Oversized guard is APP-side (validatePdfFile, 10 MB; stack 50 MiB) — the DB
-- has no size constraint by design, so an oversized row is still accepted.
insert into public.chart_files (id, song_id, format, object_key, content, size_bytes)
values (
  '30000000-0000-0000-0000-000000000703',
  '20000000-0000-0000-0000-000000000001',
  'pdf',
  '10000000-0000-0000-0000-000000000001/cccccccc-dddd-eeee-ffff-000000000000.pdf',
  null,
  20 * 1024 * 1024
);

select tmp_assert(
  '0027 oversized chart row accepted at DB (size cap is app-side)',
  exists (
    select 1 from public.chart_files c
    where c.id = '30000000-0000-0000-0000-000000000703'
      and c.size_bytes = 20 * 1024 * 1024
  )
);

-- ══════════════ 4. CLEANUP (postgres) ══════════════
select set_config('role','postgres',false);
delete from public.song_versions
 where id in ('30000000-0000-0000-0000-000000000071', '30000000-0000-0000-0000-000000000072');
delete from public.chart_files
 where id in ('30000000-0000-0000-0000-000000000701', '30000000-0000-0000-0000-000000000702',
              '30000000-0000-0000-0000-000000000703');
-- storage.objects has a protect_objects_delete trigger that requires the
-- storage.allow_delete_query setting to be flipped before direct SQL deletes
-- (the app always deletes through the Storage API; the smoke uses the
-- documented escape hatch to keep the fixture tidy).
select set_config('storage.allow_delete_query', 'true', false);
delete from storage.objects
 where id = '30000000-0000-0000-0000-000000000781';
select set_config('storage.allow_delete_query', 'false', false);

select tmp_assert(
  '0027 fixture tidy: chart/version rows removed',
  (select count(*) from public.song_versions v
     where v.song_id = '20000000-0000-0000-0000-000000000001') = 0
  and (select count(*) from public.chart_files c
        where c.song_id = '20000000-0000-0000-0000-000000000001') = 0
);

select tmp_assert(
  '0027 fixture tidy: storage object removed',
  (select count(*) from storage.objects where id = '30000000-0000-0000-0000-000000000781') = 0
);

reset role;