-- 0038 offboarding cascade smoke — slice 2 of 3: THE BLAST RADIUS
-- (local dev only; fresh reset DB, single run).
--
-- Requirement source: features/offboarding-cascade.feature
--   :43-47 Pending substitution requests are auto-cancelled
--   :48-52 A former member cannot be re-assigned
--   :14, :24, :28, :33 nothing deleted, the plan survives the leaver
--
-- Slice 1 added the cascade and the guard (its load-bearing assertions are 8-11,
-- alongside regression guards 1-7 that also hold on a pre-0038 database). Slice 2
-- inserts the members its regression assertions need and APPENDS assertions 12-33:
-- what did NOT change and what must still work. Nothing above reassigns assertion
-- numbers; the inserted block is fixtures and RPC setup, not assertions.
--
-- Reuses the seed tenancy: org 10000000-…-a1 (Demo Academy) + branch …-b1. Fixtures
-- use the 80000000-… family (unused by the seed and by the 0023/0026/0028/0037
-- smokes) with FIXED user literals — gen_random_uuid would not cross role switches.
-- Sofia must be display_name 'Sofia': the title asserted below is the Gherkin literal.
--
-- Assertions that read contract tables directly run under role postgres
-- (deny-by-default surface; the RPCs are the client contract). Role switches use
-- `select set_config(...)` (bare calls are not valid top-level statements); RPC
-- returns are captured with `\gset` so each call runs once.
-- expects 33 PASS / 0 FAIL
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
-- Only the two people slice 1 needs: the leader who gets told, and the member who
-- leaves. The members slice 2's regression assertions need are inserted further
-- down, in their own block.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'nadia.offboard@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000041', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Nadia","lastName":"Leader","displayName":"Nadia Leader"}', now(), now()),
  ('80000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sofia.offboard@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000042', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Sofia","lastName":"Bass","displayName":"Sofia"}', now(), now())
  on conflict do nothing;

update profiles set username = 'nadiaoff', display_name = 'Nadia Leader', instrument = 'keys'
  where id = '80000000-0000-0000-0000-000000000001';
update profiles set username = 'sofiaoff', display_name = 'Sofia', instrument = 'bass'
  where id = '80000000-0000-0000-0000-0000000000a1';

insert into org_memberships (user_id, org_id, branch_id, role, status) values
  ('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'org_member', 'active'),
  ('80000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'org_member', 'active')
  on conflict do nothing;

insert into public.services (org_id, branch_id, name, status, leader_id, starts_at)
values ('10000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000b1',
        'Sunday 10am', 'published', '80000000-0000-0000-0000-000000000001',
        now() + interval '3 days')
returning id \gset svc_

insert into public.service_blocks (service_id, name, position, time_budget, setlist_id, start_offset_minutes)
values (:'svc_id', 'Worship', 1, 20, null, 0)
returning id \gset blk1_

-- Sofia is the leaver whose part the plan must stop advertising as covered.
insert into public.service_assignments (service_id, block_id, user_id, part)
values (:'svc_id', :'blk1_id', '80000000-0000-0000-0000-0000000000a1', 'bass')
returning id \gset sofia_asg_

-- ══════════════ 1. CONTRACT (role postgres) ══════════════
\echo '--- 1. contract (role postgres) ---'
select set_config('role', 'postgres', false);

select tmp_assert(
  '1 0038 replaced both cores with their original signatures',
  (select count(*) = 2 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and ((p.proname = 'org_leave'
            and pg_get_function_identity_arguments(p.oid) = 'p_org_id uuid')
        or (p.proname = 'assign_musician'
            and pg_get_function_identity_arguments(p.oid)
                = 'p_service_id uuid, p_block_id uuid, p_user_id uuid, p_part text')))
);

select tmp_assert(
  '2 authenticated still holds execute on the public wrappers',
  has_function_privilege('authenticated', 'public.leave_organization(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.assign_musician(uuid, uuid, uuid, text)', 'execute')
);

-- ══════════════ 2. anon deny ══════════════
\echo '--- 2. anon deny ---'
select set_config('role', 'anon', false);
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select tmp_expect_error('3 anon cannot leave an organization',
  format('select public.leave_organization(%L)', '10000000-0000-0000-0000-0000000000a1'),
  'permission denied%');
select tmp_expect_error('4 anon cannot assign a musician',
  format('select public.assign_musician(%L, %L, %L, %L)', :'svc_id', :'blk1_id',
         '80000000-0000-0000-0000-0000000000a1', 'bass'),
  'permission denied%');

-- ══════════════ slice-2 fixtures: Ana, Tina, two blocks, two requests ══════════════
\echo '--- slice-2 fixtures: ana, tina, two blocks, two requests ---'
select set_config('role', 'postgres', false);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('80000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ana.offboard@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000043', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Ana","lastName":"Bass","displayName":"Ana"}', now(), now()),
  ('80000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tina.offboard@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000044', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Tina","lastName":"Trumpet","displayName":"Tina Trumpet"}', now(), now())
  on conflict do nothing;

update profiles set username = 'anaoff', display_name = 'Ana', instrument = 'bass'
  where id = '80000000-0000-0000-0000-0000000000a2';
update profiles set username = 'tinaoff', display_name = 'Tina Trumpet', instrument = 'trumpet'
  where id = '80000000-0000-0000-0000-0000000000b1';

-- Ana is a plain active member. Tina is deliberately NOT a member of any org: the
-- "never was a member" side of the same guard.
insert into org_memberships (user_id, org_id, branch_id, role, status) values
  ('80000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'org_member', 'active')
  on conflict do nothing;

insert into public.service_blocks (service_id, name, position, time_budget, setlist_id, start_offset_minutes)
values (:'svc_id', 'Second Set', 2, 20, null, 40)
returning id \gset blk2_

insert into public.service_blocks (service_id, name, position, time_budget, setlist_id, start_offset_minutes)
values (:'svc_id', 'Third Set', 3, 20, null, 80)
returning id \gset blk3_

-- Ana (blk2, bass) owns the request that must SURVIVE Sofia's departure. Nadia covers
-- blk3 herself, so the leader who leaves owns an open request of her own — the only
-- way to exercise the self-notification guard.
insert into public.service_assignments (service_id, block_id, user_id, part)
values (:'svc_id', :'blk2_id', '80000000-0000-0000-0000-0000000000a2', 'bass')
returning id \gset ana_asg_

insert into public.service_assignments (service_id, block_id, user_id, part)
values (:'svc_id', :'blk3_id', '80000000-0000-0000-0000-000000000001', 'bass')
returning id \gset nadia_asg_

-- Both requests are opened BEFORE Sofia raises hers, so Ana's frozen candidate array
-- captures Sofia while Sofia is still an active member with no open request. That is
-- the array whose survival slice 2 asserts.
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
select public.mark_unavailable(:'nadia_asg_id') as id \gset req_nadia_

select set_config('request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-0000000000a2","role":"authenticated"}', false);
select public.mark_unavailable(:'ana_asg_id') as id \gset req_ana_

-- ── other-org fixture for assertion 32 ──
-- The seed gives Sofia no other-org data, so "the isolation org was never touched"
-- was vacuous: no mutation of the cascade's org scope could fail it. This fixture
-- makes her an ACTIVE member of the seed's isolation org (…-a2) with an open request
-- of her own there. Olga leads the isolation service; both use the 80000000-… family.
-- Opened AFTER Ana's request so Ana's frozen candidates still capture Sofia.
select set_config('role', 'postgres', false);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('80000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'olga.offboard@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000045', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Olga","lastName":"Leader","displayName":"Olga Leader"}', now(), now())
  on conflict do nothing;

update profiles set username = 'olgaoff', display_name = 'Olga Leader', instrument = 'keys'
  where id = '80000000-0000-0000-0000-0000000000b2';

-- Sofia's second membership is ACTIVE and must stay so: the cascade is scoped to the
-- org she leaves, so her isolation-org membership and request are out of its reach.
insert into org_memberships (user_id, org_id, branch_id, role, status) values
  ('80000000-0000-0000-0000-0000000000b2', '10000000-0000-0000-0000-0000000000a2',
   null, 'org_member', 'active'),
  ('80000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a2',
   null, 'org_member', 'active');

insert into public.services (org_id, branch_id, name, status, leader_id, starts_at)
values ('10000000-0000-0000-0000-0000000000a2', null, 'Isolation Sunday', 'published',
        '80000000-0000-0000-0000-0000000000b2', now() + interval '3 days')
returning id \gset isvc_

insert into public.service_blocks (service_id, name, position, time_budget, setlist_id, start_offset_minutes)
values (:'isvc_id', 'Isolation Set', 1, 20, null, 0)
returning id \gset iblk_

insert into public.service_assignments (service_id, block_id, user_id, part)
values (:'isvc_id', :'iblk_id', '80000000-0000-0000-0000-0000000000a1', 'bass')
returning id \gset sofia_other_asg_

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-0000000000a1","role":"authenticated"}', false);
select public.mark_unavailable(:'sofia_other_asg_id') as id \gset req_other_

-- ══════════════ 3. Sofia marks herself unavailable ══════════════
\echo '--- 3. sofia marks herself unavailable ---'
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-0000000000a1","role":"authenticated"}', false);
select public.mark_unavailable(:'sofia_asg_id') as id \gset req_sofia_

select tmp_assert('5 sofia can read her org services before leaving',
  (select count(*) > 0 from public.services
    where org_id = '10000000-0000-0000-0000-0000000000a1'));

select set_config('role', 'postgres', false);
select tmp_assert('6 sofia''s request is open on the bass part of Sunday 10am',
  (select sr.status = 'open' and sr.resolved_at is null
          and sa.part = 'bass' and s.name = 'Sunday 10am'
     from public.substitution_requests sr
     join public.service_assignments sa on sa.id = sr.assignment_id
     join public.services s on s.id = sa.service_id
    where sr.id = :'req_sofia_id'));

-- ══════════════ 4. Sofia leaves — the cascade ══════════════
\echo '--- 4. sofia leaves the org ---'
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-0000000000a1","role":"authenticated"}', false);
select public.leave_organization('10000000-0000-0000-0000-0000000000a1');

select set_config('role', 'postgres', false);
select tmp_assert('7 membership is former with left_at set',
  (select status = 'former' and left_at is not null
     from public.org_memberships
    where user_id = '80000000-0000-0000-0000-0000000000a1'
      and org_id = '10000000-0000-0000-0000-0000000000a1'));
select tmp_assert('8 the leaver''s open request is closed (the model''s word for cancelled)',
  (select status = 'closed' and resolved_at is not null
     from public.substitution_requests where id = :'req_sofia_id'));
select tmp_assert('9 the cascade is logged as action=substitution kind=member_left',
  (select count(*) = 1 from public.service_change_log
    where action = 'substitution'
      and detail ->> 'kind' = 'member_left'
      and detail ->> 'request_id' = :'req_sofia_id'
      and service_id = :'svc_id'
      and actor_id = '80000000-0000-0000-0000-0000000000a1'));
select tmp_assert('10 the leader is notified with the exact Gherkin title',
  (select count(*) = 1 from public.notifications n
    where n.user_id = '80000000-0000-0000-0000-000000000001'
      and n.title = 'Sofia left — bass part uncovered'
      and n.payload ->> 'request_id' = :'req_sofia_id'));

-- ══════════════ 5. the assignment guard ══════════════
\echo '--- 5. assignment guard ---'
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
select tmp_expect_error('11 the leader cannot assign the former member',
  format('select public.assign_musician(%L, %L, %L, %L)', :'svc_id', :'blk1_id',
         '80000000-0000-0000-0000-0000000000a1', 'bass'),
  'Sofia is no longer a member%');

-- ══════════════ 6. nothing was deleted, nobody else was touched ══════════════
\echo '--- 6. blast radius: deletions and other members ---'
select set_config('role', 'postgres', false);
select tmp_assert('12 the cascade closed exactly the leaver''s own request, nothing else',
  (select count(*) from public.substitution_requests where status = 'closed') = 1
  and (select count(*) from public.substitution_requests
        where status = 'closed' and id = :'req_sofia_id') = 1);
select tmp_assert('13 nothing was deleted: the membership row still exists',
  (select count(*) = 1 from public.org_memberships
    where user_id = '80000000-0000-0000-0000-0000000000a1'
      and org_id = '10000000-0000-0000-0000-0000000000a1'));
select tmp_assert('14 nothing was deleted: the assignment row still exists',
  (select count(*) = 1 from public.service_assignments where id = :'sofia_asg_id'));
select tmp_assert('15 ana''s request is still open — untouched by sofia''s leave',
  (select status = 'open' and resolved_at is null
     from public.substitution_requests where id = :'req_ana_id'));
select tmp_assert('16 ana''s frozen candidate array still holds sofia',
  (select candidates @> array['80000000-0000-0000-0000-0000000000a1'::uuid]
     from public.substitution_requests where id = :'req_ana_id'));
select tmp_assert('17 no "… left — …" notification was emitted for ana''s request',
  (select count(*) = 0 from public.notifications
    where title like '% left — %'
      and payload ->> 'request_id' = :'req_ana_id'));
select tmp_assert('18 the leader''s own request is open on a service she leads',
  (select sr.status = 'open' and s.leader_id = '80000000-0000-0000-0000-000000000001'
     from public.substitution_requests sr
     join public.service_assignments sa on sa.id = sr.assignment_id
     join public.services s on s.id = sa.service_id
    where sr.id = :'req_nadia_id'));

-- ══════════════ 7. the former member is locked out of the org ══════════════
\echo '--- 7. former member RLS lockout ---'
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-0000000000a1","role":"authenticated"}', false);
select tmp_assert('19 the former member can no longer read the leaving org''s services',
  (select count(*) = 0 from public.services
    where org_id = '10000000-0000-0000-0000-0000000000a1'));

-- ══════════════ 8. the rest of the assignment guard ══════════════
\echo '--- 8. assignment guard, remaining sides ---'
select tmp_expect_error('20 the former member cannot assign herself — the plan is not even visible to her',
  format('select public.assign_musician(%L, %L, %L, %L)', :'svc_id', :'blk3_id',
         '80000000-0000-0000-0000-0000000000a1', 'bass'),
  'Service not found.%');

select set_config('request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
select tmp_expect_error('21 the leader cannot assign a never-member either',
  format('select public.assign_musician(%L, %L, %L, %L)', :'svc_id', :'blk3_id',
         '80000000-0000-0000-0000-0000000000b1', 'bass'),
  '% is no longer a member%');

select public.assign_musician(:'svc_id', :'blk3_id',
  '80000000-0000-0000-0000-0000000000a2', 'bass') as id \gset ana_new_

select set_config('role', 'postgres', false);
select tmp_assert('22 an ACTIVE member is still assignable (the guard is not over-broad)',
  (select count(*) = 1 from public.service_assignments
    where id = :'ana_new_id'
      and user_id = '80000000-0000-0000-0000-0000000000a2'
      and part = 'bass' and not is_substitute));
select tmp_assert('23 the successful assignment is still logged as action=assign',
  (select count(*) = 1 from public.service_change_log
    where service_id = :'svc_id' and action = 'assign'
      and detail ->> 'user_id' = '80000000-0000-0000-0000-0000000000a2'
      and detail ->> 'block_id' = :'blk3_id'));

-- ══════════════ 9. new candidate lists exclude the former member ══════════════
\echo '--- 9. new candidate lists ---'
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
select tmp_assert('24 a former member is absent from NEW candidate lists',
  not (public.substitution_candidates(:'ana_asg_id')
       @> array['80000000-0000-0000-0000-0000000000a1'::uuid]));
select tmp_assert('25 the recomputed list for that assignment is empty (every eligible bass member is non-active or the assigned member)',
  public.substitution_candidates(:'ana_asg_id') = '{}'::uuid[]);

-- ══════════════ 10. leave guards, self-notification, and the last blast radius ══════════════
\echo '--- 10. leave guards and the rest of the blast radius ---'
select set_config('request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-0000000000a1","role":"authenticated"}', false);
select tmp_expect_error('26 a former member cannot leave again',
  format('select public.leave_organization(%L)', '10000000-0000-0000-0000-0000000000a1'),
  'Not a member.%');
select set_config('request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-0000000000b1","role":"authenticated"}', false);
select tmp_expect_error('27 an outsider cannot leave an org she was never in',
  format('select public.leave_organization(%L)', '10000000-0000-0000-0000-0000000000a1'),
  'Not a member.%');

-- The leader leaves the org she leads: her own open request closes, and she is NOT
-- notified about her own departure (leader_id = leaver).
select set_config('request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
select public.leave_organization('10000000-0000-0000-0000-0000000000a1');
select set_config('role', 'postgres', false);
select tmp_assert('28 the leaving leader''s own request is closed by the cascade',
  (select status = 'closed' and resolved_at is not null
     from public.substitution_requests where id = :'req_nadia_id'));
-- The cascade DOES process the leaving leader's own request (the log row below).
-- Whether she is "notified" is NOT observable here: notify_user suppresses
-- self-notifications globally (0008:55), so deleting the 0038:89 leader guard
-- cannot change what this file can observe. Assert the observable half only.
select tmp_assert('29 the leaving leader''s own request is processed by the cascade (logged as member_left); her self-notification is suppressed globally by notify_user, not by the leader guard',
  (select count(*) = 1 from public.service_change_log
    where action = 'substitution'
      and detail ->> 'kind' = 'member_left'
      and detail ->> 'request_id' = :'req_nadia_id'
      and service_id = :'svc_id'
      and actor_id = '80000000-0000-0000-0000-000000000001'));
select tmp_assert('30 the leader''s membership flipped to former, row intact',
  (select status = 'former' and left_at is not null
     from public.org_memberships
    where user_id = '80000000-0000-0000-0000-000000000001'
      and org_id = '10000000-0000-0000-0000-0000000000a1'));

-- Ana leaves too: HER open request is now the leaver's own, so the cascade closes it
-- as well — the scoping rule is "requests the leaver raised", not "not Ana's".
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"80000000-0000-0000-0000-0000000000a2","role":"authenticated"}', false);
select public.leave_organization('10000000-0000-0000-0000-0000000000a1');
select set_config('role', 'postgres', false);
select tmp_assert('31 ana''s own leave closes the request she had raised',
  (select status = 'closed' and resolved_at is not null
     from public.substitution_requests where id = :'req_ana_id'));
select tmp_assert('32 the other org was never touched: sofia''s request there is still open and her membership there still active',
  (select status = 'open' and resolved_at is null
     from public.substitution_requests where id = :'req_other_id')
  and (select count(*) = 1 from public.org_memberships
        where user_id = '80000000-0000-0000-0000-0000000000a1'
          and org_id = '10000000-0000-0000-0000-0000000000a2'
          and status = 'active'));
select tmp_assert('33 all three Demo Academy memberships are former, all rows surviving',
  (select count(*) = 3 from public.org_memberships
    where org_id = '10000000-0000-0000-0000-0000000000a1' and status = 'former'));

\echo
\echo 'If the expected count is 33 and you see 33 [PASS] lines with 0 [FAIL], every contract here holds.'
\echo 'Not all 33 are load-bearing against 0038: assertions 1-7 also pass on a pre-0038 database (they guard'
\echo 'the 0016/0018 contracts). 8-11 are the cascade and the guard; 12-33 are the blast radius around them.'
\echo 'This script is NOT idempotent: it commits its writes. Reset before a second run.'
reset role;
