-- 0023 substitutions smoke (local dev only; fresh reset DB, single run).
-- Matrix: anonymous deny; mark_unavailable (request open, candidates by
-- instrument, leader notified); member-only guard; validate warning appears +
-- clears; leader send (pending responses + candidate notifications);
-- first-wins accept (+ block of second accept); cancel reopens + leader
-- notified with remaining candidates; reclaim releases + notifies; overrule
-- records decided_by and releases earlier confirms; cross-org event scope
-- (scope='event', candidates span event orgs, substitution_context returns
-- only assigned/event songs, direct org read remains RLS-denied).
-- Assertions that read contract tables directly run under role postgres
-- (deny-by-default surface; the RPCs are the client contract).
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

-- ══════════════ FIXTURES (postgres) ══════════════
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sub.leader@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000031', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Subs","lastName":"Leader","displayName":"Subs Leader"}', now(), now()),
  ('60000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'lucia.subs@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000032', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Lucia","lastName":"Subs","displayName":"Lucia"}', now(), now()),
  ('60000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pedro.subs@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000033', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Pedro","lastName":"Subs","displayName":"Pedro"}', now(), now()),
  ('60000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rosa.subs@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000034', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Rosa","lastName":"Subs","displayName":"Rosa"}', now(), now()),
  ('60000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'juan.subs@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000035', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Juan","lastName":"Subs","displayName":"Juan"}', now(), now()),
  ('60000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mario.subs@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000036', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Mario","lastName":"Subs","displayName":"Mario"}', now(), now()),
  ('60000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'jorge.subs@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000037', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Jorge","lastName":"Subs","displayName":"Jorge"}', now(), now()),
  ('60000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'outsider.subs@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000038', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Outsider","lastName":"Trumpet","displayName":"Tina Trumpet"}', now(), now())
  on conflict do nothing;

update profiles set username = 'subsleader', display_name = 'Subs Leader', instrument = 'keys'
  where id = '60000000-0000-0000-0000-000000000001';
update profiles set username = 'lucia',     display_name = 'Lucia',     instrument = 'bass'
  where id = '60000000-0000-0000-0000-0000000000a1';
update profiles set username = 'pedro',     display_name = 'Pedro',     instrument = 'bass'
  where id = '60000000-0000-0000-0000-0000000000a2';
update profiles set username = 'rosa',      display_name = 'Rosa',      instrument = 'bass'
  where id = '60000000-0000-0000-0000-0000000000a3';
update profiles set username = 'juan',      display_name = 'Juan',      instrument = 'guitar'
  where id = '60000000-0000-0000-0000-0000000000a4';
update profiles set username = 'mario',     display_name = 'Mario',     instrument = 'drums'
  where id = '60000000-0000-0000-0000-0000000000a5';
update profiles set username = 'jorge',     display_name = 'Jorge',     instrument = 'trumpet'
  where id = '60000000-0000-0000-0000-0000000000a6';
update profiles set username = 'tinat',     display_name = 'Tina Trumpet', instrument = 'trumpet'
  where id = '60000000-0000-0000-0000-0000000000b1';

insert into org_memberships (user_id, org_id, branch_id, role, status) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'org_member', 'active'),
  ('60000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'org_member', 'active'),
  ('60000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'org_member', 'active'),
  ('60000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'org_member', 'active'),
  ('60000000-0000-0000-0000-0000000000a4', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'org_member', 'active'),
  ('60000000-0000-0000-0000-0000000000a5', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'org_member', 'active'),
  ('60000000-0000-0000-0000-0000000000a6', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'org_member', 'active'),
  ('60000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000a2',
   null, 'org_member', 'active')
  on conflict do nothing;

-- songs: D is in the worship setlist; E is a1-private (must never leak to a
-- cross-org substitute); F fills the event setlist; H is a1-private outside it.
insert into public.songs (id, org_id, branch_id, title, artist, genre, created_by)
values
  ('20000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Song D', 'Demo Band', 'worship',
   '60000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Song E (private)', 'Demo Band', 'worship',
   '60000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-0000000000d3', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Song F (festival)', 'Demo Band', 'worship',
   '60000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-0000000000d4', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Song H (private)', 'Demo Band', 'worship',
   '60000000-0000-0000-0000-000000000001')
  on conflict do nothing;

insert into chart_files (id, song_id, format, object_key, content, size_bytes) values
  ('71000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-0000000000d1', 'chordpro',
   '', '{title: Song D}' || E'\n' || '{section: Verse 1}' || E'\n' || '[F]Some body', 1),
  ('71000000-0000-0000-0000-0000000000d2', '20000000-0000-0000-0000-0000000000d2', 'chordpro',
   '', '{title: Song E}' || E'\n' || '[G]Private chart', 1),
  ('71000000-0000-0000-0000-0000000000d3', '20000000-0000-0000-0000-0000000000d3', 'chordpro',
   '', '{title: Song F}' || E'\n' || '[C]Festival tune', 1),
  ('71000000-0000-0000-0000-0000000000d4', '20000000-0000-0000-0000-0000000000d4', 'chordpro',
   '', '{title: Song H}' || E'\n' || '[A]Private tune', 1)
  on conflict do nothing;

insert into song_versions (id, song_id, name, number, chart_file_id, base_key, base_tempo, is_ready, created_by)
values
  ('72000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-0000000000d1', 'Original', 1,
   '71000000-0000-0000-0000-0000000000d1', 'F', 100, true, '60000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-0000000000d2', '20000000-0000-0000-0000-0000000000d2', 'Original', 1,
   '71000000-0000-0000-0000-0000000000d2', 'G', 100, true, '60000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-0000000000d3', '20000000-0000-0000-0000-0000000000d3', 'Original', 1,
   '71000000-0000-0000-0000-0000000000d3', 'C', 100, true, '60000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-0000000000d4', '20000000-0000-0000-0000-0000000000d4', 'Original', 1,
   '71000000-0000-0000-0000-0000000000d4', 'A', 100, true, '60000000-0000-0000-0000-000000000001')
  on conflict do nothing;

-- Sunday service: no event link → org scope.
insert into public.services (org_id, branch_id, name, status, leader_id, starts_at)
values ('10000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000b1',
        'Sunday 10am', 'published', '60000000-0000-0000-0000-000000000001',
        now() + interval '3 days')
returning id \gset svc_

insert into public.setlists (org_id, branch_id, owner_id, name, visibility)
values ('10000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000b1',
        '60000000-0000-0000-0000-000000000001', 'Subs Sunday set', 'org')
returning id \gset sl_

insert into public.setlist_items (setlist_id, song_id, position, agreed_key, vocal_parts)
values (:'sl_id', '20000000-0000-0000-0000-0000000000d1', 1, 'F', '[]'::jsonb);

insert into public.service_blocks (service_id, name, position, time_budget, setlist_id, start_offset_minutes)
values (:'svc_id', 'Worship', 1, 20, :'sl_id', 0)
returning id \gset blk_

insert into public.service_assignments (service_id, block_id, user_id, part)
values (:'svc_id', :'blk_id', '60000000-0000-0000-0000-0000000000a1', 'bass')
returning id \gset lucia_

-- Festival service: block setlist belongs to an EVENT → event-scoped requests.
insert into public.services (org_id, branch_id, name, status, leader_id, starts_at)
values ('10000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000b1',
        'Festival Nacional Set', 'published', '60000000-0000-0000-0000-000000000001',
        now() + interval '10 days')
returning id \gset svc_e_

insert into public.setlists (org_id, branch_id, owner_id, name, visibility)
values ('10000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000b1',
        '60000000-0000-0000-0000-000000000001', 'Subs event set', 'org')
returning id \gset sl_e_

insert into public.setlist_items (setlist_id, song_id, position, agreed_key, vocal_parts)
values (:'sl_e_id', '20000000-0000-0000-0000-0000000000d3', 1, 'C', '[]'::jsonb);

insert into public.service_blocks (service_id, name, position, time_budget, setlist_id, start_offset_minutes)
values (:'svc_e_id', 'Festival Set', 1, 30, :'sl_e_id', 0)
returning id \gset blk_e_

insert into public.service_assignments (service_id, block_id, user_id, part)
values (:'svc_e_id', :'blk_e_id', '60000000-0000-0000-0000-0000000000a6', 'trumpet')
returning id \gset jorge_

insert into public.events (id, type, name, status, organizer_id)
values ('40000000-0000-0000-0000-0000000000e1', 'mixed-group', 'Festival Nacional',
        'scheduled', '60000000-0000-0000-0000-000000000001')
on conflict do nothing;

insert into public.event_participants (event_id, org_id) values
  ('40000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000a1'),
  ('40000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000a2')
  on conflict do nothing;

insert into public.event_setlists (event_id, org_id, group_name, setlist_id, sequence, visibility)
values ('40000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000a1',
        'Group 1', :'sl_e_id', 1, 'event');

-- ══════════════ T0 anon deny ══════════════
select set_config('role', 'anon', false);
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tmp_expect_error('T0 anon mark_unavailable denied',
  format('select public.mark_unavailable(%L)', :'lucia_id'), 'permission denied%');

-- ══════════════ T1 mark_unavailable (Lucia) ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000000a1","role":"authenticated"}', false);

select public.mark_unavailable(:'lucia_id') as id \gset req1_

select set_config('role', 'postgres', false);
select tmp_assert('T1 request open org-scope for assigned member',
  (select status = 'open' and scope = 'org'
     from public.substitution_requests where id = :'req1_id'));

select tmp_assert('T1 candidates = bass members only (Pedro, Rosa)',
  (select candidates @> array['60000000-0000-0000-0000-0000000000a2'::uuid,
                             '60000000-0000-0000-0000-0000000000a3'::uuid]
      and not candidates @> array['60000000-0000-0000-0000-0000000000a4'::uuid]
      and not candidates @> array['60000000-0000-0000-0000-0000000000a5'::uuid]
      and not candidates @> array['60000000-0000-0000-0000-0000000000b1'::uuid]
      and cardinality(candidates) = 2
     from public.substitution_requests where id = :'req1_id'));

select tmp_assert('T1 leader notified',
  (select count(*) from public.notifications n
   where n.user_id = '60000000-0000-0000-0000-000000000001'
     and n.payload ->> 'request_id' = :'req1_id'
     and n.body like '%bass%') = 1);

-- ══════════════ T2 member-only guard ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000000a2","role":"authenticated"}', false);
select tmp_expect_error('T2 non-member mark_unavailable denied',
  format('select public.mark_unavailable(%L)', :'lucia_id'), 'Only the assigned member%');

select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000000b1","role":"authenticated"}', false);
select tmp_expect_error('T2 outsider mark_unavailable denied',
  format('select public.mark_unavailable(%L)', :'lucia_id'), 'Only the assigned member%');

-- ══════════════ T3 validate warning appears ══════════════
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000000a1","role":"authenticated"}', false);
select tmp_assert('T3 substitution warning shown',
  (select count(*) = 1
     from jsonb_array_elements(
       (select public.validate_service_plan(:'svc_id') -> 'warnings')) w
   where w ->> 'kind' = 'substitution'
     and w ->> 'message' like '%bass part uncovered — Lucia absent%'));

-- ══════════════ T4 leader send ══════════════
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
select public.send_substitution_request(:'req1_id');

select set_config('role', 'postgres', false);
select tmp_assert('T4 pending responses seeded',
  (select count(*) = 2 from public.substitution_responses
   where request_id = :'req1_id' and status = 'pending'));

select tmp_assert('T4 candidates notified',
  (select count(*) = 2 from public.notifications n
   join unnest((select candidates from public.substitution_requests where id = :'req1_id')) c on c = n.user_id
   where n.payload ->> 'request_id' = :'req1_id'));

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000000a2","role":"authenticated"}', false);
select tmp_expect_error('T4 member cannot send (leader-only)',
  format('select public.send_substitution_request(%L)', :'req1_id'), 'Only the service leader%');

-- ══════════════ T5 first-wins ══════════════
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000000a2","role":"authenticated"}', false);
select public.respond_substitution(:'req1_id', true) as id \gset sub1_

select set_config('role', 'postgres', false);
select tmp_assert('T5 substitute row created (covered_by = Lucia)',
  (select is_substitute and covered_by = '60000000-0000-0000-0000-0000000000a1'
           and part = 'bass' and decided_by is null
     from public.service_assignments where id = :'sub1_id'));

select tmp_assert('T5 request covered + resolved',
  (select status = 'covered' and resolved_at is not null
     from public.substitution_requests where id = :'req1_id'));

select tmp_assert('T5 original notified',
  (select count(*) = 1 from public.notifications n
   where n.user_id = '60000000-0000-0000-0000-0000000000a1'
     and n.title like '%bass part is covered%'));

select tmp_assert('T5 pending candidates notified (position taken)',
  (select count(*) = 1 from public.notifications n
   where n.user_id = '60000000-0000-0000-0000-0000000000a3'
     and n.title = 'Position already covered'));

select set_config('role', 'authenticated', false);
select tmp_expect_error('T5 second accept blocked (first-wins)',
  format('select public.respond_substitution(%L, true)', :'req1_id'), 'Position already covered%');

-- ══════════════ T6 warning cleared ══════════════
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000000a1","role":"authenticated"}', false);
select tmp_assert('T6 substitution warning cleared after confirm',
  (select count(*) = 0
     from jsonb_array_elements(
       (select public.validate_service_plan(:'svc_id') -> 'warnings')) w
   where w ->> 'kind' = 'substitution'));

-- ══════════════ T7 cancel reopens ══════════════
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000000a2","role":"authenticated"}', false);
select public.cancel_substitution(:'req1_id');

select set_config('role', 'postgres', false);
select tmp_assert('T7 substitute row removed + request reopened',
  (select NOT exists (select 1 from public.service_assignments where id = :'sub1_id'))
  and (select status = 'open' and resolved_at is null
       from public.substitution_requests where id = :'req1_id'));

select tmp_assert('T7 leader notified with remaining candidates (Rosa)',
  (select count(*) = 1 from public.notifications n
   where n.user_id = '60000000-0000-0000-0000-000000000001'
     and n.title = 'A substitute cancelled'
     and n.payload ->> 'candidates' like '%60000000-0000-0000-0000-0000000000a3%'
     and n.payload ->> 'candidates' not like '%60000000-0000-0000-0000-0000000000a2%'));

-- ══════════════ T8 reclaim ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000000a3","role":"authenticated"}', false);
select public.respond_substitution(:'req1_id', true) as id \gset sub2_
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000000a1","role":"authenticated"}', false);
select public.reclaim_assignment(:'lucia_id');

select set_config('role', 'postgres', false);
select tmp_assert('T8 reclaimed: substitute released + request closed',
  (select NOT exists (select 1 from public.service_assignments where id = :'sub2_id'))
  and (select status = 'closed' from public.substitution_requests where id = :'req1_id'));

select tmp_assert('T8 released substitute notified',
  (select count(*) = 1 from public.notifications n
   where n.user_id = '60000000-0000-0000-0000-0000000000a3'
     and n.title = 'Part reclaimed'));

-- ══════════════ T9 overrule ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000000a1","role":"authenticated"}', false);
select public.mark_unavailable(:'lucia_id') as id \gset req2_
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
select public.send_substitution_request(:'req2_id');
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000000a2","role":"authenticated"}', false);
select public.respond_substitution(:'req2_id', true) as id \gset sub3_
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
select public.overrule_substitution(:'req2_id', '60000000-0000-0000-0000-0000000000a4') as id \gset sub4_

select set_config('role', 'postgres', false);
select tmp_assert('T9 overrule: leader-decided substitute + earlier released',
  (select exists (select 1 from public.service_assignments
                  where id = :'sub4_id' and user_id = '60000000-0000-0000-0000-0000000000a4'
                    and is_substitute and covered_by = '60000000-0000-0000-0000-0000000000a1'
                    and decided_by = '60000000-0000-0000-0000-000000000001'))
  and NOT exists (select 1 from public.service_assignments where id = :'sub3_id'));

select tmp_assert('T9 overrule closes request',
  (select status = 'covered' from public.substitution_requests where id = :'req2_id'));

-- ══════════════ T10 cross-org event scope ══════════════
-- Jorge (a1 trumpet) unavailability on the EVENT-linked block: scope='event',
-- candidates span a1 ∪ a2 (Tina, trumpet) — NOT bass players.
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000000a6","role":"authenticated"}', false);
select public.mark_unavailable(:'jorge_id') as id \gset req3_

select set_config('role', 'postgres', false);
select tmp_assert('T10 request is event-scoped',
  (select scope = 'event' from public.substitution_requests where id = :'req3_id'));

select tmp_assert('T10 candidates span event orgs (Tina from Org B)',
  (select candidates = array['60000000-0000-0000-0000-0000000000b1'::uuid]
     from public.substitution_requests where id = :'req3_id'));

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
select public.send_substitution_request(:'req3_id');

select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000000b1","role":"authenticated"}', false);
select public.respond_substitution(:'req3_id', true) as id \gset sub5_

select set_config('role', 'postgres', false);
select tmp_assert('T10 outsider confirm creates substitute row',
  (select is_substitute and covered_by = '60000000-0000-0000-0000-0000000000a6'
     from public.service_assignments where id = :'sub5_id'));

-- context: outsider sees ONLY the festival block song (Song F) + event setlist,
-- never Song H (a1 private) and never Sunday service content.
select set_config('role', 'authenticated', false);
select public.substitution_context(:'svc_e_id') as ctx \gset ctx_

select tmp_assert('T10 context block role = substitute + song F',
  (select (select count(*) from jsonb_array_elements((:'ctx_ctx')::jsonb -> 'blocks') b
           where b ->> 'role' = 'substitute' and b ->> 'part' = 'trumpet') = 1
    and (select count(*) from jsonb_array_elements((:'ctx_ctx')::jsonb -> 'blocks') b,
              jsonb_array_elements(b -> 'songs') s
          where s ->> 'song_id' = '20000000-0000-0000-0000-0000000000d3') = 1));

select tmp_assert('T10 context never leaks a1-private repertoire',
  (select count(*) from jsonb_array_elements((:'ctx_ctx')::jsonb -> 'blocks') b,
              jsonb_array_elements(b -> 'songs') s
    where s ->> 'song_id' in ('20000000-0000-0000-0000-0000000000d4',
                              '20000000-0000-0000-0000-0000000000d1',
                              '20000000-0000-0000-0000-0000000000d2')) = 0);

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000000b1","role":"authenticated"}', false);
select tmp_assert('T10 direct songs read remains RLS-denied',
  (select count(*) = 0 from public.songs
   where org_id = '10000000-0000-0000-0000-0000000000a1'
     and not is_deleted));

select set_config('role', 'authenticated', false);
select tmp_expect_error('T10 outsider denied Sunday context',
  format('select public.substitution_context(%L)', :'svc_id'), 'Not allowed.%');

select tmp_assert('T10 candidate can read own request responses',
  (select public.get_substitution_request(:'req3_id') -> 'status' = '"covered"'));

select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-0000000000a2","role":"authenticated"}', false);
select tmp_expect_error('T10 list requests is leader-only',
  format('select public.list_substitution_requests(%L)', :'svc_e_id'), 'Only the service leader%');

-- ══════════════ T11 history log (change_log rows for every step) ══════════════
select set_config('role', 'postgres', false);
select tmp_assert('T11 lifecycle steps logged (Sunday service: 10)',
  (select count(*) = 10 from public.service_change_log
   where service_id = :'svc_id' and action = 'substitution'
     and detail ->> 'kind' in ('unavailable','send','confirm','cancel','reclaim','overrule')));

-- summary
select
  (select count(*) from pg_proc where proname in
    ('substitution_candidates','mark_unavailable','send_substitution_request',
     'respond_substitution','cancel_substitution','reclaim_assignment',
     'overrule_substitution','get_substitution_request',
     'list_substitution_requests','substitution_context') and pronamespace = 'public'::regnamespace)
  as rpc_count;