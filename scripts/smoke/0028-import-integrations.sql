-- 0028 Import pipeline smoke (local dev only; fresh reset DB, single run).
-- Reuses the seed fixture: demo owner …0001 (owns songs 2000…001 'Way Maker'
-- and …002 'Oceans'), isolation/outsider …0002 (owns …003 'Isolation Anthem';
-- seed …003 is NOT touched — task-doc fixture clash). Storage/version/dup ids
-- are FIXED literals in the 30000…8xx range (gen_random_uuid would need a
-- temp-table bridge that does not cross role switches; no collision with 0026's
-- 30000…6xx/711 or 0027's 30000…7xx fixtures).
-- Matrix: songs gains DECLARED year + license/license_confirmed (defaults keep
-- every existing row untouched; vocabulary mirrors public_songs) enforced by
-- songs_license_check. song_duplicates opens a SELECTIVE surface (0002 revoked
-- all): authenticated only, group of ≥1 song OWNED by the user is
-- select/insert/update-able, NO delete grant — owner sees his groups, outsider
-- sees 0 rows and cannot plant a group without an owned member; owner merge
-- update (canonical_id) lands. Import lineage rides the version row
-- (metadata.import + change_note; lineage_source stays a uuid ref). The
-- external_enrichments INSERT policy widened in 0028 (section 3) accepts
-- spotify + musicbrainz + lrclib suggestions but keeps applied_by/state gates
-- (unknown source denied; outsider suggestion denied).
-- Assertions that read contract tables directly run under role postgres
-- (deny-by-default; RLS is the client gate — tested explicitly below).
-- Role switches use `select set_config(...)` (bare calls are not valid
-- top-level statements).
-- expects 15 PASS / 0 FAIL
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

-- ══════════════ 1. SONGS: YEAR + LICENSE (declared import metadata) ══════════════
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

-- Fresh demo-owned song with EXPLICIT declared metadata (MusicBrainz prefill +
-- license confirmation before landing): year=1998, proprietary, confirmed.
insert into public.songs (id, org_id, branch_id, title, artist, genre, created_by,
                          year, license, license_confirmed)
values ('20000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000a1',
        '10000000-0000-0000-0000-0000000000b1', 'Imported Song (proprietary)', 'Demo Band', 'worship',
        '10000000-0000-0000-0000-000000000001', 1998, 'proprietary', true);

-- Default insert: no year (NULL), license defaults to CC-BY-4.0, unconfirmed.
insert into public.songs (id, org_id, branch_id, title, artist, genre, created_by)
values ('20000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000a1',
        '10000000-0000-0000-0000-0000000000b1', 'Imported Song (defaults)', 'Demo Band', 'worship',
        '10000000-0000-0000-0000-000000000001');

-- License CHECK: value outside the public_songs vocabulary is rejected outright.
select tmp_expect_error(
  '0028 invalid license rejected (songs_license_check)',
  $$insert into public.songs (id, org_id, branch_id, title, created_by, license)
    values ('20000000-0000-0000-0000-0000000000d3', '10000000-0000-0000-0000-0000000000a1',
            '10000000-0000-0000-0000-0000000000b1', 'Imported Song (bad license)',
            '10000000-0000-0000-0000-000000000001', 'weird')$$,
  '%songs_license_check%'
);

-- ══════════════ 2. IMPORT LINEAGE RIDES THE VERSION ROW ══════════════
-- The imported chart becomes song version v1 with metadata.import + a change
-- note; lineage_source stays a uuid ref (version forks), NOT the import record.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

insert into public.song_versions
  (id, song_id, name, number, base_key, base_tempo, is_ready, metadata, change_note, owner_id, created_by)
values
  ('30000000-0000-0000-0000-000000000801', '20000000-0000-0000-0000-0000000000d1',
   'Imported from OnSong', 1, 'G', 70, true,
   '{"import": {"source": "OnSong", "at": "2026-09-24T10:00:00Z"}}'::jsonb,
   'Imported chart (OnSong)',
   '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');

-- ══════════════ 3. song_duplicates — OWNER-SCOPED ACCESS ══════════════
-- Group 811: two demo-owned songs (pure duplicate pair).
insert into public.song_duplicates (id, song_ids)
values ('30000000-0000-0000-0000-000000000811',
        array['20000000-0000-0000-0000-000000000001'::uuid,
              '20000000-0000-0000-0000-000000000002'::uuid]);

-- Group 812: own song + public-library song (both created_by demo …0001) —
-- the realistic import clash (imported "Way Maker" vs a public-domain corpus
-- entry). Proves the ≥1-owned-member semantic, not the whole-group membership.
insert into public.song_duplicates (id, song_ids)
values ('30000000-0000-0000-0000-000000000812',
        array['20000000-0000-0000-0000-000000000001'::uuid,
              '20000000-0000-0000-0000-000000000004'::uuid]);

select tmp_assert(
  '0028 owner sees both duplicate groups (owner-scoped SELECT)',
  (select count(*) from public.song_duplicates d
     where d.id in ('30000000-0000-0000-0000-000000000811',
                    '30000000-0000-0000-0000-000000000812')) = 2
);

-- Outsider (isolation …0002): no group contains an isolation-owned song → 0 rows.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',false);

select tmp_assert(
  '0028 outsider sees 0 duplicate rows',
  (select count(*) from public.song_duplicates) = 0
);

select tmp_expect_error(
  '0028 outsider duplicate insert denied (RLS: no owned member)',
  $$insert into public.song_duplicates (id, song_ids)
    values ('30000000-0000-0000-0000-000000000813',
            array['20000000-0000-0000-0000-000000000001'::uuid,
                  '20000000-0000-0000-0000-000000000002'::uuid])$$,
  '%row-level security%'
);

-- Outsider UPDATE on demo''s group: USING=false filters silently (0 rows).
update public.song_duplicates
   set canonical_id = '20000000-0000-0000-0000-000000000002'
 where id = '30000000-0000-0000-0000-000000000811';

-- ══════════════ 4. external_enrichments — WIDENED INSERT WHITELIST ══════════════
-- 0028 widened 0026's insert policy to spotify + musicbrainz + lrclib so the
-- import pipeline can persist genre/year/lyrics suggestions (T2/T5).
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',false);

select tmp_expect_error(
  '0028 outsider enrichment suggestion denied (applied_by gate)',
  $$insert into public.external_enrichments (id, song_id, source, field, value, state, applied_by)
    values ('30000000-0000-0000-0000-0000000008a4', '20000000-0000-0000-0000-000000000001',
            'musicbrainz', 'genre', '{"genre": "worship"}'::jsonb, 'suggested',
            '10000000-0000-0000-0000-000000000001')$$,
  '%row-level security%'
);

select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

insert into public.external_enrichments (id, song_id, source, field, value, state, applied_by)
values
  ('30000000-0000-0000-0000-0000000008a1', '20000000-0000-0000-0000-000000000001',
   'musicbrainz', 'genre', '{"genre": "worship"}'::jsonb, 'suggested',
   '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-0000000008a2', '20000000-0000-0000-0000-000000000001',
   'lrclib', 'lyrics', '{"lyrics": "Verse line"}'::jsonb, 'suggested',
   '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-0000000008a3', '20000000-0000-0000-0000-000000000001',
   'spotify', 'bpm', '{"bpm": 97}'::jsonb, 'suggested',
   '10000000-0000-0000-0000-000000000001');

select tmp_expect_error(
  '0028 unknown enrichment source still denied (whitelist holds)',
  $$insert into public.external_enrichments (id, song_id, source, field, value, state, applied_by)
    values ('30000000-0000-0000-0000-0000000008a5', '20000000-0000-0000-0000-000000000001',
            'random-site', 'genre', '{"genre": "worship"}'::jsonb, 'suggested',
            '10000000-0000-0000-0000-000000000001')$$,
  '%row-level security%'
);

-- ══════════════ 5. CONTRACT READS (postgres) ══════════════
select set_config('role','postgres',false);

select tmp_assert(
  '0028 migration surface: songs year/license/license_confirmed columns exist',
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'songs'
       and column_name in ('year', 'license', 'license_confirmed')) = 3
);

select tmp_assert(
  '0028 explicit year/license insert lands (proprietary, confirmed)',
  exists (
    select 1 from public.songs s
    where s.id = '20000000-0000-0000-0000-0000000000d1'
      and s.year = 1998 and s.license = 'proprietary' and s.license_confirmed = true
  )
);

select tmp_assert(
  '0028 default insert lands (CC-BY-4.0, unconfirmed, year NULL)',
  exists (
    select 1 from public.songs s
    where s.id = '20000000-0000-0000-0000-0000000000d2'
      and s.year is null and s.license = 'CC-BY-4.0' and s.license_confirmed = false
  )
);

select tmp_assert(
  '0028 seeded song untouched: license defaults keep existing rows intact',
  exists (
    select 1 from public.songs s
    where s.id = '20000000-0000-0000-0000-000000000001'
      and s.year is null and s.license = 'CC-BY-4.0' and s.license_confirmed = false
  )
);

select tmp_assert(
  '0028 import lineage rides the version row (metadata.import + change_note)',
  exists (
    select 1 from public.song_versions v
    where v.id = '30000000-0000-0000-0000-000000000801'
      and v.song_id = '20000000-0000-0000-0000-0000000000d1'
      and v.name = 'Imported from OnSong' and v.change_note is not null
      and v.metadata->'import'->>'source' = 'OnSong'
      and v.lineage_source is null
  )
);

select tmp_assert(
  '0028 outsider update silently filtered (canonical_id untouched)',
  not exists (
    select 1 from public.song_duplicates d
    where d.id = '30000000-0000-0000-0000-000000000811'
      and d.canonical_id = '20000000-0000-0000-0000-000000000002'
  )
);

-- Owner merge decision: canonical_id set + decider recorded (audit trail).
update public.song_duplicates
   set canonical_id = '20000000-0000-0000-0000-000000000001',
       decided_by = '10000000-0000-0000-0000-000000000001',
       decided_at = now()
 where id = '30000000-0000-0000-0000-000000000811';

select tmp_assert(
  '0028 owner merge update lands (canonical_id set)',
  exists (
    select 1 from public.song_duplicates d
    where d.id = '30000000-0000-0000-0000-000000000811'
      and d.canonical_id = '20000000-0000-0000-0000-000000000001'
      and d.decided_by = '10000000-0000-0000-0000-000000000001'
      and d.decided_at is not null
  )
);

select tmp_assert(
  '0028 musicbrainz + lrclib + spotify suggestions all persist (3 rows)',
  (select count(*) from public.external_enrichments e
     where e.id in ('30000000-0000-0000-0000-0000000008a1',
                    '30000000-0000-0000-0000-0000000008a2',
                    '30000000-0000-0000-0000-0000000008a3')
       and e.state = 'suggested') = 3
);

-- ══════════════ 6. CLEANUP (postgres) ══════════════
delete from public.external_enrichments
 where id in ('30000000-0000-0000-0000-0000000008a1',
              '30000000-0000-0000-0000-0000000008a2',
              '30000000-0000-0000-0000-0000000008a3');
delete from public.song_duplicates
 where id in ('30000000-0000-0000-0000-000000000811',
              '30000000-0000-0000-0000-000000000812');
delete from public.song_versions
 where id = '30000000-0000-0000-0000-000000000801';
delete from public.songs
 where id in ('20000000-0000-0000-0000-0000000000d1',
              '20000000-0000-0000-0000-0000000000d2');

select tmp_assert(
  '0028 fixture tidy: songs/version/dups/enrichments removed',
  (select count(*) from public.songs s
     where s.id::text like '20000000-0000-0000-0000-0000000000d%') = 0
  and (select count(*) from public.song_versions v
        where v.id = '30000000-0000-0000-0000-000000000801') = 0
  and (select count(*) from public.song_duplicates d
        where d.id::text like '30000000-0000-0000-0000-00000000081%') = 0
  and (select count(*) from public.external_enrichments e
        where e.id::text like '30000000-0000-0000-0000-0000000008a%') = 0
);

reset role;