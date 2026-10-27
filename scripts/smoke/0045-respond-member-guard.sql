-- 0045 respond-substitution member guard smoke (local dev only; fresh reset DB,
-- single run, not idempotent).
--
-- Reverse migration ordering note: the smoke names do NOT track migration
-- numbers; this smoke covers `0045_respond_member_guard.sql`.
--
-- Scope under test (odd/tasks/offboarding-cascade.md, finding 1): a responder
-- present in a frozen substitution candidates array who is no longer an ACTIVE
-- member of the request's scope must be rejected — on ACCEPT and on DECLINE —
-- before anything is written; and the scope must be EVENT-based (participating
-- orgs), so the cross-org event accept (0023's T10) keeps working.
--
-- Every rejected respond must be a whole-op rejection: no substitute row, no
-- opening of the request, no substitution_responses row, no confirm log.
--
-- Fixture surgery note: the frozen candidates array is deliberately injected
-- (T5, T9) — the guard is about RESPONSE gating, not candidate generation,
-- which substitution_candidates already excludes former members from.
-- Run: supabase db reset, then
--   docker exec -i supabase_db_cemurm psql -U postgres -d postgres -X \
--     -v ON_ERROR_STOP=1 -f - < scripts/smoke/0045-respond-member-guard.sql
-- Expects 14 PASS / 0 FAIL.
set client_min_messages to notice;

create or replace function tmp_assert(p_name text, p_ok boolean) returns void language plpgsql as $$
begin
  if p_ok then raise notice '[PASS] %', p_name; else raise notice '[FAIL] %', p_name; end if;
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
insert into organizations (id, name, org_type, status) values
  ('10000000-0000-0000-0000-0000000004a1', 'Guard Academy', 'Academy', 'active'),
  ('10000000-0000-0000-0000-0000000004a2', 'Guard Other Academy', 'Academy', 'active')
  on conflict do nothing;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('60000000-0000-0000-0000-000000000451', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'g45.leader@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000451', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"G45","lastName":"Leader","displayName":"Guard Leader"}', now(), now()),
  ('60000000-0000-0000-0000-000000000452', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'g45.sofia@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000452', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Sofia","lastName":"Guard","displayName":"Sofia"}', now(), now()),
  ('60000000-0000-0000-0000-000000000453', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'g45.ana@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000453', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Ana","lastName":"Guard","displayName":"Ana"}', now(), now()),
  ('60000000-0000-0000-0000-000000000454', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'g45.tina@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000454', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Tina","lastName":"Guard","displayName":"Tina"}', now(), now())
  on conflict do nothing;

update profiles set username = 'g45leader', display_name = 'Guard Leader', instrument = 'keys'
  where id = '60000000-0000-0000-0000-000000000451';
update profiles set username = 'g45sofia', display_name = 'Sofia', instrument = 'trumpet'
  where id = '60000000-0000-0000-0000-000000000452';
update profiles set username = 'g45ana',   display_name = 'Ana', instrument = 'trumpet'
  where id = '60000000-0000-0000-0000-000000000453';
update profiles set username = 'g45tina', display_name = 'Tina', instrument = 'trumpet'
  where id = '60000000-0000-0000-0000-000000000454';

insert into org_memberships (user_id, org_id, branch_id, role, status) values
  ('60000000-0000-0000-0000-000000000451', '10000000-0000-0000-0000-0000000004a1', null,
   'org_member', 'active'),
  ('60000000-0000-0000-0000-000000000452', '10000000-0000-0000-0000-0000000004a1', null,
   'org_member', 'active'),
  ('60000000-0000-0000-0000-000000000453', '10000000-0000-0000-0000-0000000004a1', null,
   'org_member', 'active'),
  ('60000000-0000-0000-0000-000000000454', '10000000-0000-0000-0000-0000000004a2', null,
   'org_member', 'active')
  on conflict do nothing;

-- Songs D1 (Sunday setlist 1), D2 (setlist 2), E (event setlist).
insert into public.songs (id, org_id, branch_id, title, artist, genre, created_by)
values
  ('20000000-0000-0000-0000-000000000451', '10000000-0000-0000-0000-0000000004a1',
   null, 'Song g45-1', 'Guard Smoke', 'worship', '60000000-0000-0000-0000-000000000451'),
  ('20000000-0000-0000-0000-000000000452', '10000000-0000-0000-0000-0000000004a1',
   null, 'Song g45-2', 'Guard Smoke', 'worship', '60000000-0000-0000-0000-000000000451'),
  ('20000000-0000-0000-0000-000000000453', '10000000-0000-0000-0000-0000000004a1',
   null, 'Song g45-e', 'Guard Smoke', 'worship', '60000000-0000-0000-0000-000000000451')
  on conflict do nothing;

insert into chart_files (id, song_id, format, object_key, content, size_bytes) values
  ('71000000-0000-0000-0000-000000000451', '20000000-0000-0000-0000-000000000451', 'chordpro',
   '', '{title: Song g45-1}' || E'\n' || '[F]Body', 1),
  ('71000000-0000-0000-0000-000000000452', '20000000-0000-0000-0000-000000000452', 'chordpro',
   '', '{title: Song g45-2}' || E'\n' || '[G]Body', 1),
  ('71000000-0000-0000-0000-000000000453', '20000000-0000-0000-0000-000000000453', 'chordpro',
   '', '{title: Song g45-e}' || E'\n' || '[C]Body', 1)
  on conflict do nothing;

insert into song_versions (id, song_id, name, number, chart_file_id, base_key, base_tempo, is_ready, created_by)
values
  ('72000000-0000-0000-0000-000000000451', '20000000-0000-0000-0000-000000000451', 'Original', 1,
   '71000000-0000-0000-0000-000000000451', 'F', 100, true, '60000000-0000-0000-0000-000000000451'),
  ('72000000-0000-0000-0000-000000000452', '20000000-0000-0000-0000-000000000452', 'Original', 1,
   '71000000-0000-0000-0000-000000000452', 'G', 100, true, '60000000-0000-0000-0000-000000000451'),
  ('72000000-0000-0000-0000-000000000453', '20000000-0000-0000-0000-000000000453', 'Original', 1,
   '71000000-0000-0000-0000-000000000453', 'C', 100, true, '60000000-0000-0000-0000-000000000451')
  on conflict do nothing;

-- S1: org-scoped Sunday-type service, TWO trumpet blocks (accept test on block
-- 1; decline test needs its own open request, carved from block 2).
insert into public.services (org_id, branch_id, name, status, leader_id, starts_at)
values ('10000000-0000-0000-0000-0000000004a1', null, 'Guard Sunday', 'published',
        '60000000-0000-0000-0000-000000000451', now() + interval '3 days')
returning id \gset svc_

insert into public.setlists (org_id, branch_id, owner_id, name, visibility)
values ('10000000-0000-0000-0000-0000000004a1', null,
        '60000000-0000-0000-0000-000000000451', 'Guard Sunday set', 'org')
returning id \gset sl_

insert into public.setlist_items (setlist_id, song_id, position, agreed_key, vocal_parts)
values (:'sl_id', '20000000-0000-0000-0000-000000000451', 1, 'F', '[]'::jsonb);

insert into public.service_blocks (service_id, name, position, time_budget, setlist_id, start_offset_minutes)
values (:'svc_id', 'Praise', 1, 20, :'sl_id', 0)
returning id \gset blk_

insert into public.service_assignments (service_id, block_id, user_id, part)
values (:'svc_id', :'blk_id', '60000000-0000-0000-0000-000000000452', 'trumpet')
returning id \gset sofia_

insert into public.setlists (org_id, branch_id, owner_id, name, visibility)
values ('10000000-0000-0000-0000-0000000004a1', null,
        '60000000-0000-0000-0000-000000000451', 'Guard Sunday set 2', 'org')
returning id \gset sl2_

insert into public.setlist_items (setlist_id, song_id, position, agreed_key, vocal_parts)
values (:'sl2_id', '20000000-0000-0000-0000-000000000452', 1, 'G', '[]'::jsonb);

insert into public.service_blocks (service_id, name, position, time_budget, setlist_id, start_offset_minutes)
values (:'svc_id', 'Worship', 2, 20, :'sl2_id', 20)
returning id \gset blk2_

insert into public.service_assignments (service_id, block_id, user_id, part)
values (:'svc_id', :'blk2_id', '60000000-0000-0000-0000-000000000453', 'trumpet')
returning id \gset ana_

-- S2: festival service whose block setlist belongs to an EVENT spanning
-- org 4a1 ∪ 4a2 — the cross-org positive control.
insert into public.services (org_id, branch_id, name, status, leader_id, starts_at)
values ('10000000-0000-0000-0000-0000000004a1', null, 'Guard Festival', 'published',
        '60000000-0000-0000-0000-000000000451', now() + interval '10 days')
returning id \gset svc_e_

insert into public.setlists (org_id, branch_id, owner_id, name, visibility)
values ('10000000-0000-0000-0000-0000000004a1', null,
        '60000000-0000-0000-0000-000000000451', 'Guard Festival set', 'org')
returning id \gset sl_e_

insert into public.setlist_items (setlist_id, song_id, position, agreed_key, vocal_parts)
values (:'sl_e_id', '20000000-0000-0000-0000-000000000453', 1, 'C', '[]'::jsonb);

insert into public.service_blocks (service_id, name, position, time_budget, setlist_id, start_offset_minutes)
values (:'svc_e_id', 'Festival Set', 1, 30, :'sl_e_id', 0)
returning id \gset blk_e_

insert into public.service_assignments (service_id, block_id, user_id, part)
values (:'svc_e_id', :'blk_e_id', '60000000-0000-0000-0000-000000000452', 'trumpet')
returning id \gset sofia_e_

insert into public.events (id, type, name, status, organizer_id)
values ('40000000-0000-0000-0000-000000000451', 'mixed-group', 'Guard Festival',
        'scheduled', '60000000-0000-0000-0000-000000000451')
on conflict do nothing;

insert into public.event_participants (event_id, org_id) values
  ('40000000-0000-0000-0000-000000000451', '10000000-0000-0000-0000-0000000004a1'),
  ('40000000-0000-0000-0000-000000000451', '10000000-0000-0000-0000-0000000004a2')
  on conflict do nothing;

insert into public.event_setlists (event_id, org_id, group_name, setlist_id, sequence, visibility)
values ('40000000-0000-0000-0000-000000000451', '10000000-0000-0000-0000-0000000004a1',
        'Group 1', :'sl_e_id', 1, 'event');

-- ══════════════ PRE (postgres) ══════════════
select set_config('role', 'postgres', false);
select tmp_assert('pre1 four memberships, three in 4a1 one in 4a2',
  (select count(*) = 4 from org_memberships
    where org_id in ('10000000-0000-0000-0000-0000000004a1','10000000-0000-0000-0000-0000000004a2')));

-- ══════════════ T1 org-scoped request with frozen candidates = [ana] ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000452","role":"authenticated"}', false);
select public.mark_unavailable(:'sofia_id') as id \gset req1_

select set_config('role', 'postgres', false);
select tmp_assert('1 request is org-scoped', (
  select scope = 'org' from public.substitution_requests where id = :'req1_id'));
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-000000000451","role":"authenticated"}', false);
select public.send_substitution_request(:'req1_id');
select set_config('role', 'postgres', false);
select tmp_assert('2 frozen candidates = [ana]',
  (select candidates = array['60000000-0000-0000-0000-000000000453'::uuid]
     from public.substitution_requests where id = :'req1_id'));

-- ══════════════ T ana leaves; her frozen-candidate respond is refused ══════════════
update org_memberships set status = 'former'
  where user_id = '60000000-0000-0000-0000-000000000453'
    and org_id = '10000000-0000-0000-0000-0000000004a1';

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000453","role":"authenticated"}', false);
select tmp_expect_error('3 former-member ACCEPT refused (exact literal)',
  format('select public.respond_substitution(%L, true)', :'req1_id'),
  'You are no longer an active member of this organization.');

select tmp_expect_error('4 former-member DECLINE refused (same literal)',
  format('select public.respond_substitution(%L, false)', :'req1_id'),
  'You are no longer an active member of this organization.');

select set_config('role', 'postgres', false);
select tmp_assert('5 refused responds wrote NOTHING (no substitute row)',
  (select count(*) = 0 from public.service_assignments
   where service_id = :'svc_id' and part = 'trumpet' and is_substitute));
select tmp_assert('6 request untouched, nothing beyond the pending row send created',
  (select (select status = 'open' from public.substitution_requests where id = :'req1_id')
      and (select count(*) = 0 from public.substitution_responses
           where request_id = :'req1_id'
             and user_id = '60000000-0000-0000-0000-000000000453'
             and status in ('accepted', 'declined'))));

-- ══════════════ T5 member of ANY org ≠ member of SCOPE (event-based, not generic) ══════════════
-- Inject tina (active member of 4a2 only) into the frozen array of the org-1
-- request. A generic "is an active member somewhere" guard would let her in.
update public.substitution_requests
  set candidates = candidates || array['60000000-0000-0000-0000-000000000454'::uuid]
  where id = :'req1_id';

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000454","role":"authenticated"}', false);
select tmp_expect_error('5b foreign-member in frozen array refused (scope is the service org)',
  format('select public.respond_substitution(%L, true)', :'req1_id'),
  'You are no longer an active member of this organization.');

-- ══════════════ T6 membership restored: the same accept now succeeds ══════════════
select set_config('role', 'postgres', false);
update org_memberships set status = 'active'
  where user_id = '60000000-0000-0000-0000-000000000453'
    and org_id = '10000000-0000-0000-0000-0000000004a1';

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000453","role":"authenticated"}', false);
select public.respond_substitution(:'req1_id', true) as id \gset sub_

select set_config('role', 'postgres', false);
select tmp_assert('6 restored accept creates the substitute row (covered_by sofia)',
  (select is_substitute and covered_by = '60000000-0000-0000-0000-000000000452'
     from public.service_assignments where id = :'sub_id'));

-- confirm log count guards the whole-op rejection property
select tmp_assert('7 exactly one confirm log on S1 so far',
  (select count(*) = 1 from public.service_change_log
   where service_id = :'svc_id' and action = 'substitution'
     and detail ->> 'kind' = 'confirm'));

-- ══════════════ T8 open the block-2 request BEFORE the event scope test, ══════════════
-- so ana is busy at substitution_candidates time and the event candidates
-- provably span the participating orgs ([tina], not [ana, tina]).
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000453","role":"authenticated"}', false);
select public.mark_unavailable(:'ana_id') as id \gset req3_

-- ══════════════ T9 event scope: cross-org accept still works (0023 T10 shape) ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000452","role":"authenticated"}', false);
select public.mark_unavailable(:'sofia_e_id') as id \gset req2_

select set_config('role', 'postgres', false);
select tmp_assert('8 event request spans participating orgs (tina, not ana)',
  (select candidates = array['60000000-0000-0000-0000-000000000454'::uuid]
     from public.substitution_requests where id = :'req2_id'));

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-000000000451","role":"authenticated"}', false);
select public.send_substitution_request(:'req2_id');
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000454","role":"authenticated"}', false);
select public.respond_substitution(:'req2_id', true) as id \gset sub_e_

select set_config('role', 'postgres', false);
select tmp_assert('9 cross-org event accept creates the substitute row',
  (select is_substitute and covered_by = '60000000-0000-0000-0000-000000000452'
     from public.service_assignments where id = :'sub_e_id'));

-- ══════════════ T10 decline-also-gated, beyond the accept path ══════════════
-- Ana (still active, request req3 already open) now leaves. The guard is being
-- tested response-side, so she is injected into req3's FROZEN candidates array
-- (had she been a candidate at generation time the array would already be
-- frozen) before the decline is attempted.
update org_memberships set status = 'former'
  where user_id = '60000000-0000-0000-0000-000000000453'
    and org_id = '10000000-0000-0000-0000-0000000004a1';
update public.substitution_requests
  set candidates = candidates || array['60000000-0000-0000-0000-000000000453'::uuid]
  where id = :'req3_id';

-- back to ana's session for the attempted decline
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000453","role":"authenticated"}', false);
select tmp_expect_error('10 former-member DECLINE refused on block-2 request',
  format('select public.respond_substitution(%L, false)', :'req3_id'),
  'You are no longer an active member of this organization.');

select set_config('role', 'postgres', false);
select tmp_assert('11 no responses row written by the refused decline',
  (select count(*) = 0 from public.substitution_responses
   where request_id = :'req3_id'
     and user_id = '60000000-0000-0000-0000-000000000453'));

-- summary
select
  (select count(*) from public.service_assignments a
   join public.service_blocks b on b.id = a.block_id
   where a.is_substitute) as substitute_rows,
  (select count(*) from public.substitution_requests) as requests;
