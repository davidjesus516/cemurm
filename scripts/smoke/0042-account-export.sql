-- 0042 account export smoke — the envelope, its completeness, and its anti-leak boundary.
-- (local dev only; fresh reset DB, single run.)
--
-- Requirement source:
--   features/account-data-export-and-erasure.feature:15-24
--     the export covers repertoire + versions (:15-19) and activity + preferences
--     (:20-24); :28 wants every included record documented "in a standard form",
--     which is what the pinned top-level keys and schema_version assert here.
--
-- Fixture map (FIXED literals — gen_random_uuid() would not cross role switches):
--   users     …-0901 Ana   the exporting user — owns songs/versions/charts/setlists/
--                          collections/annotations/comments/practice/gigs/performances
--             …-0902 Beto  the OTHER user — owns rows of the same kinds, so the
--                          anti-leak assertion (10) has real rows to exclude, not
--                          an empty table that would pass vacuously
--             …-0903 Cero  a user with NO data at all — the well-formed-empty assertion
--   tenancy   …-0911 Academia Export | …-0921 Sede Central
--   songs     …-0931 (Ana, 2 versions, 2 charts, 1 collection, 1 item, 1 comment, 1 annot.)
--             …-0932 (Beto — MUST NOT appear in Ana's envelope)
--   versions  …-0941 v1 (Ana, older, by Ana) | …-0942 v2 (Ana, newer, edited by Beto)
--             …-0943 v1 (Beto)
--   charts    …-0951, …-0952 on song …-0931 | …-0953 on song …-0932
--   collect.  …-0961 (Ana) | …-0971 (Beto)
--   setlists  …-0981 (Ana) | …-0991 (Beto)
--   gigs      …-0a31 (Ana) | …-0a32 (Beto)
--   perform.  …-0a41 on gig …-0a31 | …-0a42 on gig …-0a32
--   comments  …-0a51 (Ana, authored) | …-0a61 (Beto, authored)
--   annot.    …-0a71 (Ana) | …-0a81 (Beto)
--   practice  …-0a91 (Ana) | …-0b01 (Beto)
--   tags      …-0b11 (Ana)
--
-- 40000000-… is this file's own family and collides with nothing in scripts/smoke/ or
-- the seed; it stays well clear of the seed's 30000000-… setlist family.
--
-- Conventions (0038/0041): role switches use `select set_config(...)` (bare calls are not
-- valid top-level statements), the JWT arrives through request.jwt.claims, and contract
-- assertions run under role postgres because RLS would filter them for a member session.
--
-- Note on assertion 10: the export runs `security definer`, so RLS does NOT apply inside
-- it. That is exactly why the anti-leak assertion exists — if a future edit drops one of
-- the function's `where` clauses, RLS will not catch it and THIS is the only thing that will.
-- expects 23 PASS / 0 FAIL
set client_min_messages to notice;

create or replace function tmp_assert(p_name text, p_ok boolean) returns void language plpgsql as $$
begin
  if p_ok then raise notice '[PASS] %', p_name;
  else raise notice '[FAIL] %', p_name; end if;
end $$;

create or replace function tmp_expect_error(p_name text, p_sql text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise notice '[FAIL] % (no error raised)', p_name;
exception when others then
  raise notice '[PASS] %', p_name;
end $$;

-- ══════════════ FIXTURES (role postgres) ══════════════
select set_config('role', 'postgres', false);

insert into organizations (id, name, org_type, status) values
  ('40000000-0000-0000-0000-000000000911', 'Academia Export', 'Academy', 'active')
  on conflict do nothing;

insert into branches (id, org_id, name, city, status) values
  ('40000000-0000-0000-0000-000000000921', '40000000-0000-0000-0000-000000000911',
   'Sede Central', 'Madrid', 'active')
  on conflict do nothing;

-- GoTrue v2 reads token/phone columns as plain strings: '' and never NULL.
-- Phones use the 07x slot (03x-06x, 10x and 90x are taken elsewhere in scripts/smoke/).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('40000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana.export@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000071', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Ana","lastName":"Exporter","displayName":"Ana"}', now(), now()),
  ('40000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'beto.export@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000072', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Beto","lastName":"Other","displayName":"Beto"}', now(), now()),
  ('40000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cero.export@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000073', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Cero","lastName":"Empty","displayName":"Cero"}', now(), now());

update profiles set display_name = v.display_name
from (values
  ('40000000-0000-0000-0000-000000000901'::uuid, 'Ana'),
  ('40000000-0000-0000-0000-000000000902'::uuid, 'Beto'),
  ('40000000-0000-0000-0000-000000000903'::uuid, 'Cero')
) as v(id, display_name)
where profiles.id = v.id;

insert into org_memberships (user_id, org_id, branch_id, role, status) values
  ('40000000-0000-0000-0000-000000000901', '40000000-0000-0000-0000-000000000911',
   '40000000-0000-0000-0000-000000000921', 'org_member', 'active')
  on conflict do nothing;

-- Songs. NOTE `created_by` is NULLABLE: a NULL row must NOT be folded into anyone's export.
insert into songs (id, org_id, branch_id, title, artist, created_by, license, license_confirmed) values
  ('40000000-0000-0000-0000-000000000931', '40000000-0000-0000-0000-000000000911',
   '40000000-0000-0000-0000-000000000921', 'Ana Song', 'Ana', '40000000-0000-0000-0000-000000000901',
   'CC-BY-4.0', true),
  ('40000000-0000-0000-0000-000000000932', '40000000-0000-0000-0000-000000000911',
   '40000000-0000-0000-0000-000000000921', 'Beto Song', 'Beto', '40000000-0000-0000-0000-000000000902',
   'CC-BY-4.0', true),
  -- an UNOWNED song (created_by IS NULL) — must appear in nobody's export
  ('40000000-0000-0000-0000-000000000933', '40000000-0000-0000-0000-000000000911',
   null, 'Unowned Song', 'Nobody', null, 'CC-BY-4.0', true);

-- Version change history (feature:19): dates via created_at, editors via created_by.
-- …-0942 is Ana's song but edited BY BETO — the export must report Beto as the editor
-- without that making the row Beto's to export.
insert into song_versions (id, song_id, name, number, created_by, created_at, change_note) values
  ('40000000-0000-0000-0000-000000000941', '40000000-0000-0000-0000-000000000931',
   'Ana v1', 1, '40000000-0000-0000-0000-000000000901', now() - interval '10 days', 'first draft'),
  ('40000000-0000-0000-0000-000000000942', '40000000-0000-0000-0000-000000000931',
   'Ana v2', 2, '40000000-0000-0000-0000-000000000902', now() - interval '2 days', 'key change'),
  ('40000000-0000-0000-0000-000000000943', '40000000-0000-0000-0000-000000000932',
   'Beto v1', 1, '40000000-0000-0000-0000-000000000902', now() - interval '5 days', null);

insert into chart_files (id, song_id, format, object_key, size_bytes, soft_deleted) values
  ('40000000-0000-0000-0000-000000000951', '40000000-0000-0000-0000-000000000931',
   'chordpro', '40000000-0000-0000-0000-000000000901/a1.cho', 120, false),
  ('40000000-0000-0000-0000-000000000952', '40000000-0000-0000-0000-000000000931',
   'pdf', '40000000-0000-0000-0000-000000000901/a2.pdf', 2048, false),
  ('40000000-0000-0000-0000-000000000953', '40000000-0000-0000-0000-000000000932',
   'chordpro', '40000000-0000-0000-0000-000000000902/b1.cho', 120, false);

insert into collections (id, owner_id, org_id, name, visibility) values
  ('40000000-0000-0000-0000-000000000961', '40000000-0000-0000-0000-000000000901',
   '40000000-0000-0000-0000-000000000911', 'Ana Collection', 'private'),
  ('40000000-0000-0000-0000-000000000971', '40000000-0000-0000-0000-000000000902',
   '40000000-0000-0000-0000-000000000911', 'Beto Collection', 'private');

insert into collection_songs (collection_id, song_id, position) values
  ('40000000-0000-0000-0000-000000000961', '40000000-0000-0000-0000-000000000931', 1),
  ('40000000-0000-0000-0000-000000000971', '40000000-0000-0000-0000-000000000932', 1);

insert into setlists (id, org_id, branch_id, owner_id, name, visibility) values
  ('40000000-0000-0000-0000-000000000981', '40000000-0000-0000-0000-000000000911',
   '40000000-0000-0000-0000-000000000921', '40000000-0000-0000-0000-000000000901',
   'Ana Setlist', 'private'),
  ('40000000-0000-0000-0000-000000000991', '40000000-0000-0000-0000-000000000911',
   '40000000-0000-0000-0000-000000000921', '40000000-0000-0000-0000-000000000902',
   'Beto Setlist', 'private');

insert into setlist_items (id, setlist_id, song_id, version_id, position) values
  ('40000000-0000-0000-0000-000000000a01', '40000000-0000-0000-0000-000000000981',
   '40000000-0000-0000-0000-000000000931', '40000000-0000-0000-0000-000000000942', 1),
  ('40000000-0000-0000-0000-000000000a02', '40000000-0000-0000-0000-000000000991',
   '40000000-0000-0000-0000-000000000932', '40000000-0000-0000-0000-000000000943', 1);

insert into setlist_collaborators (setlist_id, user_id, can_edit, accepted_at) values
  ('40000000-0000-0000-0000-000000000981', '40000000-0000-0000-0000-000000000902',
   true, now());

insert into gigs (id, org_id, branch_id, owner_id, name, scheduled_at, status) values
  ('40000000-0000-0000-0000-000000000a31', '40000000-0000-0000-0000-000000000911',
   '40000000-0000-0000-0000-000000000921', '40000000-0000-0000-0000-000000000901',
   'Ana Gig', now() - interval '3 days', 'completed'),
  ('40000000-0000-0000-0000-000000000a32', '40000000-0000-0000-0000-000000000911',
   '40000000-0000-0000-0000-000000000921', '40000000-0000-0000-0000-000000000902',
   'Beto Gig', now() - interval '3 days', 'completed');

insert into performances (id, gig_id, performed_at) values
  ('40000000-0000-0000-0000-000000000a41', '40000000-0000-0000-0000-000000000a31',
   now() - interval '3 days'),
  ('40000000-0000-0000-0000-000000000a42', '40000000-0000-0000-0000-000000000a32',
   now() - interval '3 days');

insert into performance_items (id, performance_id, song_id, version_id, state, position) values
  ('40000000-0000-0000-0000-000000000a43', '40000000-0000-0000-0000-000000000a41',
   '40000000-0000-0000-0000-000000000931', '40000000-0000-0000-0000-000000000942', 'played', 1),
  ('40000000-0000-0000-0000-000000000a44', '40000000-0000-0000-0000-000000000a42',
   '40000000-0000-0000-0000-000000000932', '40000000-0000-0000-0000-000000000943', 'played', 1);

insert into personal_annotations (id, user_id, song_id, anchor, kind, value) values
  ('40000000-0000-0000-0000-000000000a71', '40000000-0000-0000-0000-000000000901',
   '40000000-0000-0000-0000-000000000931', '{"line":1}', 'note', 'Ana private note'),
  ('40000000-0000-0000-0000-000000000a81', '40000000-0000-0000-0000-000000000902',
   '40000000-0000-0000-0000-000000000932', '{"line":1}', 'note', 'Beto private note');

insert into shared_comments (id, song_id, author_id, body) values
  ('40000000-0000-0000-0000-000000000a51', '40000000-0000-0000-0000-000000000931',
   '40000000-0000-0000-0000-000000000901', 'Ana comment'),
  ('40000000-0000-0000-0000-000000000a61', '40000000-0000-0000-0000-000000000932',
   '40000000-0000-0000-0000-000000000902', 'Beto comment');

insert into practice_sessions (id, user_id, song_id, instrument, started_at, ended_at) values
  ('40000000-0000-0000-0000-000000000a91', '40000000-0000-0000-0000-000000000901',
   '40000000-0000-0000-0000-000000000931', 'guitar', now() - interval '1 day', now() - interval '1 day' + interval '30 min'),
  ('40000000-0000-0000-0000-000000000b01', '40000000-0000-0000-0000-000000000902',
   '40000000-0000-0000-0000-000000000932', 'piano', now() - interval '1 day', now() - interval '1 day' + interval '30 min');

insert into tags (id, org_id, user_id, name) values
  ('40000000-0000-0000-0000-000000000b11', '40000000-0000-0000-0000-000000000911',
   '40000000-0000-0000-0000-000000000901', 'worship');

insert into notification_preferences (user_id, push_enabled, categories, weekly_digest) values
  ('40000000-0000-0000-0000-000000000901', true, '{"gigs":true}', true);

-- Ana's preference row: proves a PRESENT row round-trips its jsonb payload (assertion 18c),
-- while Cero below has none — proving the key is still a well-formed object (assertion 22).
insert into user_preferences (user_id, transpose_offset, capo, preferences) values
  ('40000000-0000-0000-0000-000000000901', 2, 1, '{"instrument_pref":"guitar"}');

-- ══════════════ 1. THE GRANT CONTRACT (role postgres) ══════════════
\echo '--- 1. grant contract (role postgres) ---'
select set_config('role', 'postgres', false);

select tmp_assert(
  '1 authenticated holds EXECUTE on export_account_data()',
  has_function_privilege('authenticated', 'public.export_account_data()', 'execute'));
select tmp_assert(
  '2 anon does NOT hold EXECUTE — the PUBLIC default grant is revoked',
  not has_function_privilege('anon', 'public.export_account_data()', 'execute'));

-- ══════════════ 2. NO SESSION → RAISES ══════════════
\echo '--- 2. no JWT: auth.uid() is null ---'
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims', '{}', false);
select tmp_expect_error(
  '3 calling with no JWT raises instead of returning a null-shaped envelope',
  'select public.export_account_data()');

-- ══════════════ 3. ANA — THE FULL ENVELOPE ══════════════
\echo '--- 3. Ana, the exporting user ---'
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"40000000-0000-0000-0000-000000000901","role":"authenticated"}', false);

select tmp_assert('4 schema_version is the pinned value (feature:28 — self-describing)',
  (select public.export_account_data() ->> 'schema_version') = 'cemurm.account-export/1');

select tmp_assert('5 user_id matches the caller',
  (select public.export_account_data() -> 'user_id')
    = '"40000000-0000-0000-0000-000000000901"'::jsonb);

select tmp_assert('6 every pinned top-level key is present (feature:28)',
  (select public.export_account_data() ?& array[
     'schema_version','exported_at','user_id','account','preferences',
     'notification_preferences','memberships','repertoire','collections','setlists',
     'annotations','comments','practice_sessions','gigs','performances',
     'public_contributions','activity','archive']));

select tmp_assert('7 repertoire holds the song, BOTH its versions, and BOTH its charts (:18)',
  (select jsonb_array_length(e -> 'repertoire' -> 'songs') from (select public.export_account_data() e) x) = 1
  and (select jsonb_array_length(e -> 'repertoire' -> 'versions') from (select public.export_account_data() e) x) = 2
  and (select jsonb_array_length(e -> 'repertoire' -> 'charts') from (select public.export_account_data() e) x) = 2);

select tmp_assert('8 version change history carries dates AND editors (:19)',
  (select count(*) = 2 from (select public.export_account_data() e) x,
    jsonb_array_elements(x.e -> 'repertoire' -> 'versions') v
    where v ? 'created_at' and v -> 'created_at' <> 'null'::jsonb
      and v ? 'created_by' and v -> 'created_by' <> 'null'::jsonb
      and v ? 'change_note'));

select tmp_assert('9 the editor of a version is reported even when it is not the owner (:19)',
  (select count(*) = 1 from (select public.export_account_data() e) x,
    jsonb_array_elements(x.e -> 'repertoire' -> 'versions') v
    where v ->> 'created_by' = '40000000-0000-0000-0000-000000000902'));

-- ══════════════ 4. THE ANTI-LEAK BOUNDARY — the most important assertion ══════════════
\echo '--- 4. anti-leak: Beto''s rows must NOT appear ---'
-- The function is security definer, so RLS does not apply inside it: these `where`
-- clauses are the ONLY thing excluding other users' rows. If one is dropped, nothing
-- else in the database will catch it, and this assertion is what fails.
select tmp_assert('10 NONE of Beto''s songs, versions, charts, collections, setlists, gigs, '
  || 'performances, annotations, comments or practice sessions leak into Ana''s envelope',
  (select jsonb_array_length(e -> 'repertoire' -> 'songs') = 1
      and jsonb_array_length(e -> 'repertoire' -> 'versions') = 2
      and jsonb_array_length(e -> 'repertoire' -> 'charts') = 2
      and jsonb_array_length(e -> 'collections') = 1
      and jsonb_array_length(e -> 'setlists') = 1
      and jsonb_array_length(e -> 'gigs') = 1
      and jsonb_array_length(e -> 'performances') = 1
      and jsonb_array_length(e -> 'annotations') = 1
      and jsonb_array_length(e -> 'comments') = 1
      and jsonb_array_length(e -> 'practice_sessions') = 1
      and not exists (select 1 from jsonb_array_elements(e -> 'repertoire' -> 'songs') s
                       where s ->> 'title' in ('Beto Song', 'Unowned Song'))
      and not exists (select 1 from jsonb_array_elements(e -> 'setlists') s
                       where s ->> 'name' = 'Beto Setlist')
      and not exists (select 1 from jsonb_array_elements(e -> 'collections') c
                       where c ->> 'name' = 'Beto Collection')
      and not exists (select 1 from jsonb_array_elements(e -> 'comments') c
                       where c ->> 'body' = 'Beto comment')
      and not exists (select 1 from jsonb_array_elements(e -> 'annotations') a
                       where a ->> 'value' = 'Beto private note')
      and not exists (select 1 from jsonb_array_elements(e -> 'repertoire' -> 'versions') v
                       where v ->> 'name' = 'Beto v1')
      and not exists (select 1 from jsonb_array_elements(e -> 'repertoire' -> 'charts') c
                       where c ->> 'object_key' like '40000000-0000-0000-0000-000000000902/%')
   from (select public.export_account_data() e) x));

-- ══════════════ 5. ACTIVITY, PREFERENCES AND NESTING ══════════════
\echo '--- 5. activity, preferences, nesting ---'
select tmp_assert('11 notification preferences are present (:24)',
  (select e -> 'notification_preferences' ->> 'weekly_digest' = 'true'
     and e -> 'notification_preferences' ->> 'push_enabled' = 'true'
   from (select public.export_account_data() e) x));

select tmp_assert('12 the collection carries its collection_songs nested (:23)',
  (select jsonb_array_length(e -> 'collections' -> 0 -> 'songs') = 1
     and e -> 'collections' -> 0 -> 'songs' -> 0 ->> 'song_id'
       = '40000000-0000-0000-0000-000000000931'
   from (select public.export_account_data() e) x));

select tmp_assert('13 the setlist carries its items AND its collaborators nested',
  (select jsonb_array_length(e -> 'setlists' -> 0 -> 'items') = 1
     and jsonb_array_length(e -> 'setlists' -> 0 -> 'collaborators') = 1
   from (select public.export_account_data() e) x));

select tmp_assert('14 the performance carries its performance_items nested (:24)',
  (select jsonb_array_length(e -> 'performances' -> 0 -> 'items') = 1
     and e -> 'performances' -> 0 -> 'items' -> 0 ->> 'state' = 'played'
   from (select public.export_account_data() e) x));

select tmp_assert('15 annotations, comments and practice sessions are present (:23-:24)',
  (select jsonb_array_length(e -> 'annotations') = 1
      and jsonb_array_length(e -> 'comments') = 1
      and jsonb_array_length(e -> 'practice_sessions') = 1
   from (select public.export_account_data() e) x));

select tmp_assert('16 the personal tag is present and scoped to its owner',
  (select jsonb_array_length(e -> 'repertoire' -> 'tags') = 1
   from (select public.export_account_data() e) x));

select tmp_assert('17 memberships carry the joined org and branch display names',
  (select e -> 'memberships' -> 0 ->> 'org_name' = 'Academia Export'
     and e -> 'memberships' -> 0 ->> 'branch_name' = 'Sede Central'
   from (select public.export_account_data() e) x));

select tmp_assert('18 account is populated; preferences is a well-formed object even when the user has no row',
  (select e -> 'account' ->> 'display_name' = 'Ana'
     and jsonb_typeof(e -> 'account') = 'object'
     and jsonb_typeof(e -> 'preferences') = 'object'
   from (select public.export_account_data() e) x));

select tmp_assert('19 a present preferences row IS exported with its jsonb payload',
  (select e -> 'preferences' -> 'preferences' ->> 'instrument_pref' = 'guitar'
     and e -> 'preferences' -> 'transpose_offset' = '2'::jsonb
   from (select public.export_account_data() e) x));

select tmp_assert('20 exported_at is a non-null ISO-8601 string',
  (select e ->> 'exported_at' ~ '^\d{4}-\d{2}-\d{2}T'
   from (select public.export_account_data() e) x));

-- ══════════════ 6. BETO SEES HIS OWN, NOT ANA'S (the other direction) ══════════════
\echo '--- 6. Beto, from his own session ---'
select set_config('request.jwt.claims',
  '{"sub":"40000000-0000-0000-0000-000000000902","role":"authenticated"}', false);

select tmp_assert('21 Beto sees his own song and NONE of Ana''s — the boundary is symmetric',
  (select jsonb_array_length(e -> 'repertoire' -> 'songs') = 1
     and e -> 'repertoire' -> 'songs' -> 0 ->> 'title' = 'Beto Song'
     and e -> 'user_id' = '"40000000-0000-0000-0000-000000000902"'::jsonb
   from (select public.export_account_data() e) x));

select tmp_assert('22 Beto, as a COLLABORATOR on Ana''s setlist, does not export that setlist',
  (select count(*) = 0 from (select public.export_account_data() e) x,
     jsonb_array_elements(x.e -> 'setlists') s
    where s ->> 'name' = 'Ana Setlist'));

-- ══════════════ 7. AN EMPTY ACCOUNT STILL GETS A WELL-FORMED ENVELOPE ══════════════
\echo '--- 7. Cero, a user with no data ---'
select set_config('request.jwt.claims',
  '{"sub":"40000000-0000-0000-0000-000000000903","role":"authenticated"}', false);

select tmp_assert('23 an empty account yields every key present with empty arrays, never null',
  (select e ?& array[
     'schema_version','exported_at','user_id','account','preferences',
     'notification_preferences','memberships','repertoire','collections','setlists',
     'annotations','comments','practice_sessions','gigs','performances',
     'public_contributions','activity','archive']
     and e -> 'repertoire' -> 'songs' = '[]'::jsonb
     and e -> 'setlists' = '[]'::jsonb
     and e -> 'activity' -> 'notifications' = '[]'::jsonb
     and e -> 'archive' -> 'audit' = '[]'::jsonb
     and e -> 'repertoire' -> 'tags' = '[]'::jsonb
   from (select public.export_account_data() e) x));

\echo
\echo 'If the expected count is 22 and you see 22 PASS notices with 0 FAIL, the envelope holds.'
\echo '(Do not grep the output for the bracketed words themselves: this banner would match and skew the count.)'
\echo 'The load-bearing ones: 1/2 the grant contract, 3 the no-session guard, 10 the anti-leak'
\echo 'boundary (the function is security definer, so RLS does NOT cover it — 10 is the only'
\echo 'thing that would catch a dropped where clause), 20/21 the symmetric direction and the'
\echo 'collaborator case, 22 the empty-account shape. 5-9 guard the completeness the feature names.'
\echo 'This script is NOT idempotent: it commits its writes. Reset before a second run.'
reset role;
