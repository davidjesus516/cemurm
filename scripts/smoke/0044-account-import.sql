-- 0044 account import smoke — core working set re-import (local dev only; fresh reset, single run)
--
-- Requirement: features/account-data-export-and-erasure.feature:29, :75 (D2 scope).
-- Fixtures live in the 30000... band; ids are fixed because they must cross role switches.
--
-- expects 13 PASS / 0 FAIL
set client_min_messages to notice;

create or replace function tmp_assert(p_name text, p_ok boolean) returns void language plpgsql as $$
begin
  if p_ok then raise notice '[PASS] %', p_name;
  else raise notice '[FAIL] %', p_name; end if;
end $$;

create or replace function tmp_expect_error_like(p_name text, p_sql text, p_needle text)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise notice '[FAIL] % (no error raised)', p_name;
exception when others then
  if sqlerrm like '%' || p_needle || '%' then
    raise notice '[PASS] %', p_name;
  else
    raise notice '[FAIL] % (unexpected error: %)', p_name, sqlerrm;
  end if;
end $$;

-- The document an export of the DONOR account would produce. Every identity field names the
-- donor (…902); the importer must ignore all of them.
create or replace function tmp_import_document(p_schema_version text default 'cemurm.account-export/1')
returns jsonb language sql immutable as $fn$
  select jsonb_build_object(
    'schema_version', p_schema_version,
    'exported_at', '2026-10-22T00:00:00.000Z',
    'user_id', '30000000-0000-0000-0000-000000000902',
    'account', jsonb_build_object('id', '30000000-0000-0000-0000-000000000902'),
    'preferences', jsonb_build_object(
      'user_id', '30000000-0000-0000-0000-000000000902',
      'transpose_offset', 2, 'capo', 1, 'preferences', jsonb_build_object('theme', 'dark')
    ),
    'notification_preferences', jsonb_build_object(
      'user_id', '30000000-0000-0000-0000-000000000902',
      'push_enabled', false, 'categories', jsonb_build_object('gigs', false),
      'weekly_digest', true
    ),
    'repertoire', jsonb_build_object(
      'songs', jsonb_build_array(
        jsonb_build_object(
          'id', '30000000-0000-0000-0000-000000000931',
          'org_id', '50000000-0000-0000-0000-000000000911',
          'title', 'Imported Song', 'artist', 'Ana', 'genre', 'rock', 'is_deleted', false,
          'created_by', '30000000-0000-0000-0000-000000000902',
          'created_at', '2026-01-01T00:00:00.000Z', 'updated_at', '2026-01-01T00:00:00.000Z',
          'year', 2020, 'license', 'CC-BY-4.0', 'license_confirmed', true
        ),
        jsonb_build_object(
          'id', '30000000-0000-0000-0000-000000000932',
          'title', 'Deleted Song', 'artist', 'Ana', 'is_deleted', true,
          'created_by', '30000000-0000-0000-0000-000000000902',
          'created_at', '2026-01-02T00:00:00.000Z',
          'license', 'CC-BY-4.0', 'license_confirmed', true
        )
      ),
      'versions', jsonb_build_array(jsonb_build_object(
        'id', '30000000-0000-0000-0000-000000000941',
        'song_id', '30000000-0000-0000-0000-000000000931',
        'name', 'Original', 'number', 1,
        'chart_file_id', '30000000-0000-0000-0000-000000000951',
        'base_key', 'G', 'base_tempo', 120,
        'created_by', '30000000-0000-0000-0000-000000000902',
        'created_at', '2026-01-01T00:00:00.000Z', 'change_note', 'first'
      )),
      'charts', jsonb_build_array(
        jsonb_build_object(
          'id', '30000000-0000-0000-0000-000000000951',
          'song_id', '30000000-0000-0000-0000-000000000931',
          'format', 'chordpro', 'object_key', '30000000-0000-0000-0000-000000000902/a.pdf',
          'content', '[G]hello', 'size_bytes', 9, 'soft_deleted', false,
          'created_at', '2026-01-01T00:00:00.000Z'
        ),
        jsonb_build_object(
          'id', '30000000-0000-0000-0000-000000000952',
          'song_id', '30000000-0000-0000-0000-000000000931',
          'format', 'pdf', 'object_key', '30000000-0000-0000-0000-000000000902/b.pdf',
          'content', null, 'size_bytes', 1234, 'soft_deleted', false,
          'created_at', '2026-01-01T00:00:00.000Z'
        )
      ),
      'tags', jsonb_build_array(jsonb_build_object(
        'id', '30000000-0000-0000-0000-000000000971',
        'user_id', '30000000-0000-0000-0000-000000000902',
        'name', 'worship'
      ))
    ),
    'collections', jsonb_build_array(jsonb_build_object(
      'id', '30000000-0000-0000-0000-000000000981',
      'owner_id', '30000000-0000-0000-0000-000000000902',
      'name', 'Imported Collection', 'visibility', 'private',
      'created_at', '2026-01-01T00:00:00.000Z',
      'songs', jsonb_build_array(
        jsonb_build_object(
          'collection_id', '30000000-0000-0000-0000-000000000981',
          'song_id', '30000000-0000-0000-0000-000000000931', 'position', 1
        ),
        jsonb_build_object(
          'collection_id', '30000000-0000-0000-0000-000000000981',
          'song_id', '30000000-0000-0000-0000-000000000939', 'position', 2
        )
      )
    )),
    'setlists', jsonb_build_array(jsonb_build_object(
      'id', '30000000-0000-0000-0000-000000000991',
      'owner_id', '30000000-0000-0000-0000-000000000902',
      'name', 'Imported Setlist', 'visibility', 'private', 'is_event_setlist', false,
      'created_at', '2026-01-01T00:00:00.000Z', 'updated_at', '2026-01-01T00:00:00.000Z',
      'items', jsonb_build_array(
        jsonb_build_object(
          'id', '30000000-0000-0000-0000-0000000009a1',
          'setlist_id', '30000000-0000-0000-0000-000000000991',
          'song_id', '30000000-0000-0000-0000-000000000931',
          'version_id', '30000000-0000-0000-0000-000000000941',
          'position', 1, 'agreed_key', 'G', 'vocal_parts', '[]'::jsonb, 'notes', 'keep'
        ),
        jsonb_build_object(
          'id', '30000000-0000-0000-0000-0000000009a2',
          'setlist_id', '30000000-0000-0000-0000-000000000991',
          'song_id', '30000000-0000-0000-0000-000000000939',
          'position', 2, 'vocal_parts', '[]'::jsonb, 'notes', 'dropped'
        )
      )
    )),
    'annotations', jsonb_build_array(jsonb_build_object(
      'id', '30000000-0000-0000-0000-0000000009b1',
      'user_id', '30000000-0000-0000-0000-000000000902',
      'song_id', '30000000-0000-0000-0000-000000000931',
      'anchor', jsonb_build_object('line', 1), 'kind', 'note', 'value', 'remember',
      'created_at', '2026-01-01T00:00:00.000Z'
    )),
    'comments', '[]'::jsonb,
    'practice_sessions', '[]'::jsonb,
    'gigs', '[]'::jsonb,
    'performances', '[]'::jsonb,
    'public_contributions', '[]'::jsonb,
    'memberships', '[]'::jsonb,
    'activity', jsonb_build_object('follows', '[]'::jsonb, 'notifications', '[]'::jsonb, 'feedback', '[]'::jsonb),
    'archive', jsonb_build_object('audit', '[]'::jsonb, 'moderation', '[]'::jsonb)
  )
$fn$;

-- ── FIXTURES ────────────────────────────────────────────────────────────────────────────────
select set_config('role', 'postgres', false);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('30000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'import-ana@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34916000001', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Ana","lastName":"Import","displayName":"Ana"}', now(), now()),
  ('30000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'import-beto@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34916000002', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Beto","lastName":"Donor","displayName":"Beto"}', now(), now());

update profiles set display_name = v.display_name
from (values
  ('30000000-0000-0000-0000-000000000901'::uuid, 'Ana'),
  ('30000000-0000-0000-0000-000000000902'::uuid, 'Beto')
) as v(id, display_name)
where profiles.id = v.id;

-- Collision fixture: the donor already owns a song with the id the bundle exports. If the
-- importer reused exported ids as primary keys, this row would be overwritten or the import
-- would fail. Either would be caught below (assertion 2/10).
insert into songs (id, title, artist, created_by, license, license_confirmed) values
  ('30000000-0000-0000-0000-000000000931', 'Donor Song', 'Beto',
   '30000000-0000-0000-0000-000000000902', 'CC-BY-4.0', true);

-- ── 1. IMPORT ───────────────────────────────────────────────────────────────────────────────
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000901","role":"authenticated"}', false);

select public.import_account_data(tmp_import_document())::text as summary \gset

select tmp_assert('1 summary counts match the document (2 songs, 1 version, 2 charts, 1 tag, 1 collection/1 song, 1 setlist/1 item, 1 annotation; 1 skipped item + 1 skipped collection song)',
  (:'summary'::jsonb ->> 'songs')::int = 2
  and (:'summary'::jsonb ->> 'versions')::int = 1
  and (:'summary'::jsonb ->> 'charts')::int = 2
  and (:'summary'::jsonb ->> 'tags')::int = 1
  and (:'summary'::jsonb ->> 'reused_tags')::int = 0
  and (:'summary'::jsonb ->> 'collections')::int = 1
  and (:'summary'::jsonb ->> 'collection_songs')::int = 1
  and (:'summary'::jsonb ->> 'setlists')::int = 1
  and (:'summary'::jsonb ->> 'setlist_items')::int = 1
  and (:'summary'::jsonb ->> 'annotations')::int = 1
  and (:'summary'::jsonb ->> 'skipped_setlist_items')::int = 1
  and (:'summary'::jsonb ->> 'skipped_collection_songs')::int = 1
  and (:'summary'::jsonb ->> 'skipped_annotations')::int = 0);

-- Data assertions run as postgres (RLS would otherwise filter them).
select set_config('role', 'postgres', false);

select tmp_assert('2 imported songs/versions/charts are owned by the caller with NEW ids and is_deleted preserved',
  (select count(*) = 2 from songs
     where created_by = '30000000-0000-0000-0000-000000000901'
       and title in ('Imported Song', 'Deleted Song')
       and id not in ('30000000-0000-0000-0000-000000000931', '30000000-0000-0000-0000-000000000932'))
  and (select is_deleted from songs
     where created_by = '30000000-0000-0000-0000-000000000901' and title = 'Deleted Song') = true
  and (select count(*) = 1 from song_versions
     where created_by = '30000000-0000-0000-0000-000000000901'
       and id <> '30000000-0000-0000-0000-000000000941')
  and (select count(*) = 2 from chart_files c
     join songs s on s.id = c.song_id
     where s.created_by = '30000000-0000-0000-0000-000000000901'
       and c.id not in ('30000000-0000-0000-0000-000000000951', '30000000-0000-0000-0000-000000000952')));

select tmp_assert('3 song_versions.song_id and chart_files.song_id point at the NEW song ids (no dangling references)',
  (select count(*) = 0 from song_versions v
     where v.created_by = '30000000-0000-0000-0000-000000000901'
       and not exists (select 1 from songs s where s.id = v.song_id
                       and s.created_by = '30000000-0000-0000-0000-000000000901'))
  and (select count(*) = 0 from chart_files c
     where not exists (select 1 from songs s where s.id = c.song_id))
  and (select count(*) = 1 from song_versions v
     join chart_files c on c.id = v.chart_file_id
     join songs s on s.id = v.song_id
     where v.created_by = '30000000-0000-0000-0000-000000000901'
       and s.title = 'Imported Song'
       and c.content = '[G]hello'));

select tmp_assert('4 charts keep inline content; object_key is NULL for both text and PDF rows (no blobs in the bundle)',
  (select count(*) = 1 from chart_files c
     where c.content = '[G]hello' and c.object_key is null and c.format = 'chordpro')
  and (select count(*) = 1 from chart_files c
     where c.format = 'pdf' and c.content is null and c.object_key is null and c.size_bytes = 1234));

select tmp_assert('5 setlist item without an importable song is skipped, counted, and no dangling FK is inserted',
  (:'summary'::jsonb ->> 'skipped_setlist_items')::int = 1
  and (select count(*) = 1 from setlist_items si
     join setlists sl on sl.id = si.setlist_id
     where sl.owner_id = '30000000-0000-0000-0000-000000000901')
  and (select count(*) = 0 from setlist_items si
     where si.song_id = '30000000-0000-0000-0000-000000000939')
  and (select count(*) = 1 from setlist_items si
     join setlists sl on sl.id = si.setlist_id
     where sl.owner_id = '30000000-0000-0000-0000-000000000901'
       and si.position = 1 and si.agreed_key = 'G' and si.notes = 'keep'));

select tmp_assert('6 preferences and notification preferences land on the caller rows with the document values',
  (select transpose_offset = 2 and capo = 1 and preferences ->> 'theme' = 'dark'
     from user_preferences where user_id = '30000000-0000-0000-0000-000000000901')
  and (select push_enabled = false and weekly_digest = true
         and categories ->> 'gigs' = 'false'
     from notification_preferences where user_id = '30000000-0000-0000-0000-000000000901')
  and (select count(*) = 0 from user_preferences where user_id = '30000000-0000-0000-0000-000000000902'));

-- ── 2. REJECTIONS ───────────────────────────────────────────────────────────────────────────
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000901","role":"authenticated"}', false);

select tmp_expect_error_like(
  '7 wrong schema_version raises a readable exception',
  $$select public.import_account_data(tmp_import_document('cemurm.account-export/2'))$$,
  'Unsupported export version');

select set_config('role', 'postgres', false);
select tmp_assert('7b rejected import inserted nothing (still exactly 2 songs for the caller)',
  (select count(*) = 2 from songs where created_by = '30000000-0000-0000-0000-000000000901'));

select tmp_assert('8 anon has no EXECUTE grant on import_account_data(jsonb)',
  has_function_privilege('anon', 'public.import_account_data(jsonb)', 'execute') = false);

select set_config('role', 'anon', false);
select tmp_expect_error_like(
  '8b anon call is refused by privileges',
  $$select public.import_account_data('{"schema_version":"cemurm.account-export/1"}'::jsonb)$$,
  'permission denied');

-- ── 3. SECOND IMPORT APPENDS (documented: no dedupe by design) ──────────────────────────────
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000901","role":"authenticated"}', false);

select public.import_account_data(tmp_import_document())::text as summary2 \gset

select tmp_assert('9 re-importing the same document appends a second copy (2 → 4 songs; tags reused, not duplicated)',
  (:'summary2'::jsonb ->> 'songs')::int = 2
  and (:'summary2'::jsonb ->> 'tags')::int = 0
  and (:'summary2'::jsonb ->> 'reused_tags')::int = 1);

select set_config('role', 'postgres', false);
select tmp_assert('9b after two imports the caller owns 4 songs and the tag name exists once',
  (select count(*) = 4 from songs where created_by = '30000000-0000-0000-0000-000000000901')
  and (select count(*) = 1 from tags
         where user_id = '30000000-0000-0000-0000-000000000901' and name = 'worship'));

-- ── 4. IDENTITY IS IGNORED ──────────────────────────────────────────────────────────────────
select tmp_assert('10 identity fields naming another user do not transfer ownership; the donor row is untouched',
  (select count(*) = 1 from songs where id = '30000000-0000-0000-0000-000000000931'
     and title = 'Donor Song' and created_by = '30000000-0000-0000-0000-000000000902')
  and (select count(*) = 0 from songs
     where created_by = '30000000-0000-0000-0000-000000000902'
       and title in ('Imported Song', 'Deleted Song'))
  and (select count(*) = 0 from setlists where owner_id = '30000000-0000-0000-0000-000000000902')
  and (select count(*) = 0 from collections where owner_id = '30000000-0000-0000-0000-000000000902')
  and (select count(*) = 0 from personal_annotations where user_id = '30000000-0000-0000-0000-000000000902')
  and (select count(*) = 2 from setlists where owner_id = '30000000-0000-0000-0000-000000000901')
  and (select count(*) = 2 from personal_annotations where user_id = '30000000-0000-0000-0000-000000000901'));

reset role;
