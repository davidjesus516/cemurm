-- 0039 offboarding handoff guard smoke — WU2: leaving cannot strip the org of a setlist
-- (local dev only; fresh reset DB, single run).
--
-- Verifies the guard added to private.org_leave (two clauses) reaches the
-- expected refusal cases and keeps the 0038 cascade intact on successful leaves.
-- "Org-uses" is exercised through all three of its channels: service block (1),
-- accepted collaborator (2) and org gig (11). Cases 12 and 13 pin the consent
-- filter, one per clause: a pending, unaccepted invitation is not access, so it
-- must neither block the leaver (clause A, 13) nor wedge every other member
-- (clause B, 12). Each new case has its own subject so a mutation in one clause
-- cannot show up as a failure in another's assertion.
--
-- Fixtures reuse seed tenancy (org 10000000-…-a1, branch 10000000-…-b1). All
-- new users/objects use the 90000000-… family. Fixed UUID literals, no
-- gen_random_uuid (doesn't cross role switches). Assertions under role switches;
-- use postgres for direct-table reads that could be filtered by RLS.
-- expects 18 PASS / 0 FAIL

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

create or replace function tmp_expect_ok(p_name text, p_sql text) returns void language plpgsql as $$
declare err text := '';
begin
  begin
    execute p_sql;
  exception when others then
    err := sqlerrm;
  end;
  if err = '' then raise notice '[PASS] %', p_name;
  else raise notice '[FAIL] % (got: %)', p_name, err; end if;
end $$;

create or replace function tmp_capture_error(p_sql text) returns text language plpgsql as $$
declare err text := '';
begin
  begin
    execute p_sql;
  exception when others then
    err := sqlerrm;
  end;
  return err;
end $$;

-- ══════════════ FIXTURES (postgres) ══════════════
select set_config('role', 'postgres', false);

-- 8 users: Lila leaver, Mia receiver, Nora non-member owner, Leo leader/consent-B probe,
-- Quinn clause-B leaver, Ruby literal probe, Tara gig owner, Uma consent-A probe
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','lila.wu2@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),'','','','','', '+34910000051','','','',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Lila","lastName":"Leave","displayName":"Lila Leave"}', now(), now()),
  ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','mia.wu2@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),'','','','','', '+34910000052','','','',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Mia","lastName":"Member","displayName":"Mia Member"}', now(), now()),
  ('90000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','nora.wu2@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),'','','','','', '+34910000053','','','',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Nora","lastName":"Nonmem","displayName":"Nora Nonmem"}', now(), now()),
  ('90000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','leo.wu2@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),'','','','','', '+34910000054','','','',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Leo","lastName":"Lead","displayName":"Leo Lead"}', now(), now()),
  ('90000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','quinn.wu2@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),'','','','','', '+34910000055','','','',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Quinn","lastName":"Q","displayName":"Quinn Q"}', now(), now()),
  ('90000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','ruby.wu2@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),'','','','','', '+34910000056','','','',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Ruby","lastName":"R","displayName":"Ruby R"}', now(), now()),
  ('90000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','tara.wu2@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),'','','','','', '+34910000057','','','',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Tara","lastName":"Gig","displayName":"Tara Gig"}', now(), now()),
  ('90000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','uma.wu2@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),'','','','','', '+34910000058','','','',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Uma","lastName":"Invite","displayName":"Uma Invite"}', now(), now())
on conflict do nothing;

update profiles set username = 'lilawu2', display_name = 'Lila Leave', instrument = 'bass' where id='90000000-0000-0000-0000-000000000001';
update profiles set username = 'miawu2', display_name = 'Mia Member', instrument = 'bass' where id='90000000-0000-0000-0000-000000000002';
update profiles set username = 'norawu2', display_name = 'Nora Nonmem', instrument = 'keys' where id='90000000-0000-0000-0000-000000000003';
update profiles set username = 'leowu2', display_name = 'Leo Lead', instrument = 'keys' where id='90000000-0000-0000-0000-000000000004';
update profiles set username = 'quinnwu2', display_name = 'Quinn Q', instrument = 'vocals' where id='90000000-0000-0000-0000-000000000005';
update profiles set username = 'rubywu2', display_name = 'Ruby R', instrument = 'vocals' where id='90000000-0000-0000-0000-000000000006';
update profiles set username = 'tarawu2', display_name = 'Tara Gig', instrument = 'drums' where id='90000000-0000-0000-0000-000000000007';
update profiles set username = 'umawu2', display_name = 'Uma Invite', instrument = 'drums' where id='90000000-0000-0000-0000-000000000008';

-- memberships in a1 (Demo Academy)
insert into org_memberships (user_id, org_id, branch_id, role, status) values
  ('90000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-0000000000b1','org_member','active'),
  ('90000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-0000000000b1','org_member','active'),
  ('90000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-0000000000b1','org_member','active'),
  ('90000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-0000000000b1','org_member','active'),
  ('90000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-0000000000b1','org_member','active'),
  ('90000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-0000000000b1','org_member','active'),
  ('90000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-0000000000b1','org_member','active')
on conflict do nothing;

-- Nora (non-member of a1) has no a1 membership.

-- service
insert into public.services (org_id, branch_id, name, status, leader_id, starts_at)
values ('10000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-0000000000b1','WU2 Sunday','published','90000000-0000-0000-0000-000000000004', now()+interval '2 days')
returning id \gset svc_
insert into public.service_blocks (service_id, name, position, time_budget, setlist_id, start_offset_minutes)
values (:'svc_id','Block A',1,20,null,0) returning id \gset blk_a_
insert into public.service_blocks (service_id, name, position, time_budget, setlist_id, start_offset_minutes)
-- Block B stays empty for now; SL4 (owned by a non-member) is attached later.
values (:'svc_id','Block B',2,20,null,20) returning id \gset blk_b_
insert into public.service_blocks (service_id, name, position, time_budget, setlist_id, start_offset_minutes)
values (:'svc_id','Block C',3,20,null,40) returning id \gset blk_c_

-- setlists
insert into public.setlists (owner_id, name, visibility)
values ('90000000-0000-0000-0000-000000000001','SL1','shared') returning id \gset sl1_
insert into public.setlists (owner_id, name, visibility)
values ('90000000-0000-0000-0000-000000000001','SL2','shared') returning id \gset sl2_
insert into public.setlists (owner_id, name, visibility)
values ('90000000-0000-0000-0000-000000000001','SL3','private') returning id \gset sl3_

update public.service_blocks set setlist_id = :'sl1_id' where id = (:'blk_a_id')::uuid;
update public.service_blocks set setlist_id = null where id = :'blk_b_id';
update public.service_blocks set setlist_id = null where id = :'blk_c_id';

-- SL2 shared with Mia (active a1 member) as accepted collaborator
insert into public.setlist_collaborators (setlist_id, user_id, can_edit, accepted_at)
values (:'sl2_id','90000000-0000-0000-0000-000000000002',true,now())
on conflict do nothing;

-- assignment + request for Lila (cascade case)
insert into public.service_assignments (service_id, block_id, user_id, part)
values (:'svc_id', :'blk_c_id', '90000000-0000-0000-0000-000000000001', 'bass')
returning id \gset asg_lila_

select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated"}',false);
select public.mark_unavailable(:'asg_lila_id') as req \gset req_lila_

select set_config('role','postgres',false);
select tmp_assert('pre1 SL1 is referenced by service block in a1', (select count(*) >= 1 from public.service_blocks b join public.services s on s.id = b.service_id where b.setlist_id = :'sl1_id' and s.org_id = '10000000-0000-0000-0000-0000000000a1'));
-- ensure Lila's request is open
select tmp_assert('pre2 Lila has an open substitution request',
  (select status='open' and resolved_at is null from public.substitution_requests where id = :'req_lila_req'));

-- ══════════════ 1. Refusal: leaver owns setlist referenced by org service block (clause A disjunct 1) ══════════════
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated"}',false);
select tmp_expect_error('1 leave refused while leaver owns SL1 referenced by service block',
  format('select public.leave_organization(%L)','10000000-0000-0000-0000-0000000000a1'),
  'Transfer the setlists this organization uses before leaving.');

-- ══════════════ 2. Refusal: leaver owns setlist shared with active member (clause A disjunct 2) ══════════════
select set_config('role','postgres',false);
-- isolate disjunct 2: clear SL1 block edge
update public.service_blocks set setlist_id = null where id = (:'blk_a_id')::uuid;

select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated"}',false);
select tmp_expect_error('2 leave refused while leaver owns SL2 shared with active member',
  format('select public.leave_organization(%L)','10000000-0000-0000-0000-0000000000a1'),
  'Transfer the setlists this organization uses before leaving.');

-- ══════════════ Prepare for handoff: restore block edge and transfer SL1/SL2 to Mia ══════════════
select set_config('role','postgres',false);
update public.service_blocks set setlist_id = :'sl1_id' where id = (:'blk_a_id')::uuid;

-- Mia becomes accepted collaborator on SL1 so transfer can proceed; SL2 already has Mia
insert into public.setlist_collaborators (setlist_id, user_id, can_edit, accepted_at)
values (:'sl1_id','90000000-0000-0000-0000-000000000002',true,now())
on conflict do nothing;

-- transfer SL1 and SL2 to Mia (Lila is current owner)
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated"}',false);
select public.transfer_setlist_ownership(:'sl1_id','90000000-0000-0000-0000-000000000002');
select public.transfer_setlist_ownership(:'sl2_id','90000000-0000-0000-0000-000000000002');

select set_config('role','postgres',false);
select tmp_assert('3 handoff: SL1 now owned by Mia', (select count(*)=1 from public.setlists where id=:'sl1_id' and owner_id='90000000-0000-0000-0000-000000000002'));
select tmp_assert('4 handoff: SL2 now owned by Mia', (select count(*)=1 from public.setlists where id=:'sl2_id' and owner_id='90000000-0000-0000-0000-000000000002'));

-- ══════════════ 5. SL3 (not org-used) does not block; successful leave also asserts handoff + cascade ══════════════
-- SL3 owned by Lila, no block edge in a1, no active a1 collaborator
select tmp_expect_ok('5 leave succeeds after handoff; non-org-used SL3 does not block (cascade fires)',
  format('select public.leave_organization(%L)','10000000-0000-0000-0000-0000000000a1'));

-- post-leave assertions
select tmp_assert('6 Lila membership is former',
  (select status='former' and left_at is not null from public.org_memberships where user_id='90000000-0000-0000-0000-000000000001' and org_id='10000000-0000-0000-0000-0000000000a1'));
select tmp_assert('7 SL3 still owned by Lila and not org-used by a1',
  (select count(*)=1 from public.setlists sl where sl.id=:'sl3_id' and sl.owner_id='90000000-0000-0000-0000-000000000001'
   and not exists (select 1 from public.service_blocks b join public.services s on s.id=b.service_id where b.setlist_id=sl.id and s.org_id='10000000-0000-0000-0000-0000000000a1')
   and not exists (select 1 from public.setlist_collaborators c join public.org_memberships m on m.user_id=c.user_id and m.org_id='10000000-0000-0000-0000-0000000000a1' where c.setlist_id=sl.id and m.status='active')));
select tmp_assert('8 cascade fired: Lila request closed and log written',
  (select (sr.status='closed' and sr.resolved_at is not null) from public.substitution_requests sr where sr.id=:'req_lila_req')
  and (select count(*)>=1 from public.service_change_log scl where scl.service_id=:'svc_id' and scl.action='substitution' and scl.detail->>'kind'='member_left' and scl.detail->>'request_id'=:'req_lila_req' and scl.actor_id='90000000-0000-0000-0000-000000000001'));

-- ══════════════ Clause B: org-used setlist owned by non-member blocks another leaver ══════════════
select set_config('role','postgres',false);
insert into public.setlists (owner_id, name, visibility)
values ('90000000-0000-0000-0000-000000000003','SL4','shared') returning id \gset sl4_
update public.service_blocks set setlist_id = :'sl4_id' where id = :'blk_b_id';

select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"90000000-0000-0000-0000-000000000005","role":"authenticated"}',false);
select tmp_expect_error('9 clause B: org-used setlist owned by non-member blocks Quinn',
  format('select public.leave_organization(%L)','10000000-0000-0000-0000-0000000000a1'),
  'Transfer the setlists this organization uses before leaving.');

-- ══════════════ Literal exactness via capture (matches client allowlist) ══════════════
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"90000000-0000-0000-0000-000000000006","role":"authenticated"}',false);
select tmp_assert('10 refusal literal is exactly the client-mapped string',
  (select tmp_capture_error(format('select public.leave_organization(%L)','10000000-0000-0000-0000-0000000000a1'))
     = 'Transfer the setlists this organization uses before leaving.'));

-- ══════════════ Clause A via a GIG: the org's gig references the setlist ══════════════
select set_config('role','postgres',false);
-- Clean clause B's fixture: SL4 stops being org-used, so from here on every
-- org-used setlist is owned by an active member (SL1/SL2 by Mia, SL5 by Tara)
-- and a refusal can only come from clause A.
update public.service_blocks set setlist_id = null where id = :'blk_b_id';
insert into public.setlists (owner_id, name, visibility)
values ('90000000-0000-0000-0000-000000000007','SL5','shared') returning id \gset sl5_
insert into public.gigs (org_id, owner_id, name, scheduled_at, setlist_id)
values ('10000000-0000-0000-0000-0000000000a1','90000000-0000-0000-0000-000000000007','WU2 Gig',now()+interval '3 days',:'sl5_id');

select tmp_assert('pre3 SL5 is org-used by a gig only (no block, no accepted collaborator)',
  (select count(*) >= 1 from public.gigs g where g.setlist_id=:'sl5_id' and g.org_id='10000000-0000-0000-0000-0000000000a1')
  and not exists (select 1 from public.service_blocks b join public.services s on s.id=b.service_id where b.setlist_id=:'sl5_id' and s.org_id='10000000-0000-0000-0000-0000000000a1')
  and not exists (select 1 from public.setlist_collaborators c where c.setlist_id=:'sl5_id'));

select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"90000000-0000-0000-0000-000000000007","role":"authenticated"}',false);
select tmp_expect_error('11 leave refused while leaver owns SL5 used by an org gig',
  format('select public.leave_organization(%L)','10000000-0000-0000-0000-0000000000a1'),
  'Transfer the setlists this organization uses before leaving.');

-- ══════════════ Consent filter, clause B side: a PENDING invite must not wedge other members ══════════════
select set_config('role','postgres',false);
-- SL4 stays with Nora (not an active member) and its only tie to a1 becomes an
-- invitation Mia never accepted. It must therefore not be "org-used" any more,
-- or clause B would refuse every member's leave.
insert into public.setlist_collaborators (setlist_id, user_id, can_edit, accepted_at)
values (:'sl4_id','90000000-0000-0000-0000-000000000002',true,null)
on conflict do nothing;

select tmp_assert('pre4 SL4 is tied to a1 only by a pending invitation',
  (select accepted_at is null from public.setlist_collaborators where setlist_id=:'sl4_id' and user_id='90000000-0000-0000-0000-000000000002')
  and not exists (select 1 from public.gigs g where g.setlist_id=:'sl4_id' and g.org_id='10000000-0000-0000-0000-0000000000a1')
  and not exists (select 1 from public.service_blocks b join public.services s on s.id=b.service_id where b.setlist_id=:'sl4_id' and s.org_id='10000000-0000-0000-0000-0000000000a1'));

select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"90000000-0000-0000-0000-000000000004","role":"authenticated"}',false);
select tmp_expect_ok('12 pending invite on a non-member setlist does not block Leo leave',
  format('select public.leave_organization(%L)','10000000-0000-0000-0000-0000000000a1'));

-- ══════════════ Consent filter, clause A side: a PENDING invite is not usage of the leaver's setlist ══════════════
select set_config('role','postgres',false);
insert into public.setlists (owner_id, name, visibility)
values ('90000000-0000-0000-0000-000000000008','SL6','shared') returning id \gset sl6_
insert into public.setlist_collaborators (setlist_id, user_id, can_edit, accepted_at)
values (:'sl6_id','90000000-0000-0000-0000-000000000002',true,null)
on conflict do nothing;

select tmp_assert('pre5 SL6 is tied to a1 only by a pending invitation',
  (select accepted_at is null from public.setlist_collaborators where setlist_id=:'sl6_id' and user_id='90000000-0000-0000-0000-000000000002')
  and not exists (select 1 from public.gigs g where g.setlist_id=:'sl6_id' and g.org_id='10000000-0000-0000-0000-0000000000a1')
  and not exists (select 1 from public.service_blocks b join public.services s on s.id=b.service_id where b.setlist_id=:'sl6_id' and s.org_id='10000000-0000-0000-0000-0000000000a1'));

select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"90000000-0000-0000-0000-000000000008","role":"authenticated"}',false);
select tmp_expect_ok('13 a pending invitation is not org usage: Uma leave completes',
  format('select public.leave_organization(%L)','10000000-0000-0000-0000-0000000000a1'));

\echo
\echo 'If the expected count is 18 and you see 18 [PASS] lines with 0 [FAIL], the handoff guard holds.'
\echo 'This script is NOT idempotent: reset before a second run.'
reset role;