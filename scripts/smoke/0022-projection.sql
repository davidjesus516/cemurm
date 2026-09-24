-- 0022 projection smoke (local dev only; fresh reset DB, single run).
-- Fixtures as postgres; contract assertions under role/JWT switches.
-- Projection SESSION is client/runtime state (not tested here); this matrix
-- covers the backend contract: license gate, typo-fix versioning, block audit,
-- and scope guards on all three RPCs.
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

-- ── fixtures (postgres): juan member of a1; org a1; songs A/B/C with charts ──
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'proj.leader@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000021', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Proj","lastName":"Leader","displayName":"Proj Leader"}', now(), now())
  on conflict do nothing;

update profiles set username = 'projleader', display_name = 'Proj Leader'
  where id = '50000000-0000-0000-0000-000000000001';

insert into org_memberships (user_id, org_id, branch_id, role, status) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'org_member', 'active')
  on conflict do nothing;

insert into public.songs (id, org_id, branch_id, title, artist, genre, created_by)
values
  ('20000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Song A', 'Demo Band', 'worship',
   '50000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Song B', 'Demo Band', 'worship',
   '50000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-0000000000c3', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Song C', 'Demo Band', 'worship',
   '50000000-0000-0000-0000-000000000001')
  on conflict do nothing;

-- charts + version 1 for A and B (baseline for typo-fix).
insert into chart_files (id, song_id, format, object_key, content, size_bytes) values
  ('71000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', 'chordpro',
   '', '{title: Song A}' || E'\n' || '{section: Verse 1}' || E'\n' || '[C]Halelujah', 1),
  ('71000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-0000000000c2', 'chordpro',
   '', '{title: Song B}' || E'\n' || '{section: Verse 1}' || E'\n' || '[G]Bless the Lord', 1)
  on conflict do nothing;

insert into song_versions (id, song_id, name, number, chart_file_id, base_key, base_tempo, is_ready, created_by)
values
  ('72000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', 'Original', 1,
   '71000000-0000-0000-0000-0000000000c1', 'C', 100, true, '50000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-0000000000c2', 'Original', 1,
   '71000000-0000-0000-0000-0000000000c2', 'G', 110, true, '50000000-0000-0000-0000-000000000001')
  on conflict do nothing;

-- Song C: live public_songs entry licensed 'proprietary' (private only) → blocked.
insert into public_songs (id, song_id, contributor_id, license, license_confirmed, status) values
  ('73000000-0000-0000-0000-0000000000c3', '20000000-0000-0000-0000-0000000000c3',
   '50000000-0000-0000-0000-000000000001', 'proprietary', true, 'live')
  on conflict do nothing;

-- service + worship block + setlist (plan the projection starts from).
insert into public.services (org_id, branch_id, name, status, leader_id, starts_at)
values ('10000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000b1',
        'Projection Sunday', 'published', '50000000-0000-0000-0000-000000000001',
        now() + interval '3 days')
returning id \gset svc_

insert into public.setlists (org_id, branch_id, owner_id, name, visibility)
values ('10000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000b1',
        '50000000-0000-0000-0000-000000000001', 'Projection set', 'org')
returning id \gset sl_

insert into public.setlist_items (setlist_id, song_id, position, agreed_key, vocal_parts)
values (:'sl_id', '20000000-0000-0000-0000-0000000000c1', 1, 'C', '[]'::jsonb),
       (:'sl_id', '20000000-0000-0000-0000-0000000000c2', 2, 'G', '[]'::jsonb),
       (:'sl_id', '20000000-0000-0000-0000-0000000000c3', 3, 'D', '[]'::jsonb);

insert into public.service_blocks (service_id, name, position, time_budget, setlist_id, start_offset_minutes)
values (:'svc_id', 'Worship', 1, 20, :'sl_id', 0)
returning id \gset blk_

-- ══ T0: license gate via projection_licenses (leader JWT) ══
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"50000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

select tmp_assert('T0 A projectable',
  (select projectable from public.projection_licenses(
     array['20000000-0000-0000-0000-0000000000c1'::uuid]) where song_id = '20000000-0000-0000-0000-0000000000c1') = true);

select tmp_assert('T0 B projectable',
  (select projectable from public.projection_licenses(
     array['20000000-0000-0000-0000-0000000000c1'::uuid,
           '20000000-0000-0000-0000-0000000000c2'::uuid]) where song_id = '20000000-0000-0000-0000-0000000000c2') = true);

select tmp_assert('T0 C blocked with reason',
  (select projectable from public.projection_licenses(
     array['20000000-0000-0000-0000-0000000000c3'::uuid]) where song_id = '20000000-0000-0000-0000-0000000000c3') = false
  and (select reason from public.projection_licenses(
     array['20000000-0000-0000-0000-0000000000c3'::uuid]) where song_id = '20000000-0000-0000-0000-0000000000c3')
       = 'Not licensed for public projection');

-- ══ T1: record_typo_fix creates version 2 + audit trail ══
select public.record_typo_fix('20000000-0000-0000-0000-0000000000c1',
  '{title: Song A}' || E'\n' || '{section: Verse 1}' || E'\n' || '[C]Hallelujah') as t1_ver;

select tmp_assert('T1 typo fix -> new version 2',
  (select count(*) from public.song_versions where song_id = '20000000-0000-0000-0000-0000000000c1') = 2
  and (select max(number) from public.song_versions where song_id = '20000000-0000-0000-0000-0000000000c1') = 2
  and (select change_note from public.song_versions sv
       where sv.song_id = '20000000-0000-0000-0000-0000000000c1'
       order by sv.number desc limit 1) = 'Fixed lyric typo'
  and (select created_by from public.song_versions sv
       where sv.song_id = '20000000-0000-0000-0000-0000000000c1'
       order by sv.number desc limit 1) = '50000000-0000-0000-0000-000000000001');

select tmp_assert('T1 chart content updated',
  (select cf.content from public.chart_files cf
   join public.song_versions sv on sv.chart_file_id = cf.id
   where sv.song_id = '20000000-0000-0000-0000-0000000000c1'
   order by sv.number desc limit 1) like '%Hallelujah%');

-- ══ T2: scope guards — outsider (other org) and anon ══
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', false);

select tmp_expect_error('T2 outsider license read denied',
  'select public.projection_licenses(array[''20000000-0000-0000-0000-0000000000c1''::uuid])',
  'Not visible to this user');

select tmp_expect_error('T2 outsider typo fix denied',
  'select public.record_typo_fix(''20000000-0000-0000-0000-0000000000c1'', ''{title: Song A}'')',
  'Song not found');

select set_config('role', 'anon', false);
select set_config('request.jwt.claims', '{"role":"anon"}', false);

select tmp_expect_error('T2 anon RPC execute denied',
  'select public.projection_licenses(array[''20000000-0000-0000-0000-0000000000c1''::uuid])',
  'permission denied%');

-- ══ T3: log_projection_blocked audit ══
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"50000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

select public.log_projection_blocked(:'svc_id', '20000000-0000-0000-0000-0000000000c3',
  'Not licensed for public projection');

select tmp_assert('T3 block logged in service_change_log',
  (select count(*) from public.service_change_log
   where service_id = :'svc_id' and action = 'projection_blocked'
     and detail ->> 'song_id' = '20000000-0000-0000-0000-0000000000c3') = 1);

select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', false);

select tmp_expect_error('T3 outsider block log denied',
  'select public.log_projection_blocked(''' || :'svc_id' || ''', ''20000000-0000-0000-0000-0000000000c3'', ''x'')',
  'Service not found');

-- ══ T4: completed service stays auditable for projection events ══
-- (status flip runs as postgres — the 0018 grant on main is SELECT-only for
-- services; leader plan-edit authority belongs to another feature's contract.)
select set_config('role', 'postgres', false);
update public.services set status = 'completed' where id = :'svc_id';

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"50000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

select public.log_projection_blocked(:'svc_id', '20000000-0000-0000-0000-0000000000c3', 'after completion');
select tmp_assert('T4 block logged even after completed (audit, not plan edit)',
  (select status from public.services where id = :'svc_id') = 'completed'
  and (select count(*) from public.service_change_log
       where service_id = :'svc_id' and action = 'projection_blocked') = 2);

-- cleanup: drop helpers so the DB stays clean for the next chain feature.
select set_config('role', 'postgres', false);
drop function if exists tmp_assert;
drop function if exists tmp_expect_error;