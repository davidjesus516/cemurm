-- 0021 plan-freeze smoke v4 (local dev only; fresh reset DB, single run).
-- Fixtures as postgres; contract assertions under role/JWT switches.
-- Version-table facts are read ONLY via public RPCs (direct reads are
-- correctly denied to authenticated by the 0021 contract). Notification
-- rows (other users') are verified in a final postgres-side section.
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

-- ── fixtures (postgres): juan + lucia members of a1, service, block, setlist ──
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'juan@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000011', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Juan","lastName":"Garcia","displayName":"Juan Garcia"}', now(), now()),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'lucia@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000012', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Lucia","lastName":"Perez","displayName":"Lucia Perez"}', now(), now())
  on conflict do nothing;

update profiles set username = 'juan', display_name = 'Juan Garcia'
  where id = '30000000-0000-0000-0000-000000000001';
update profiles set username = 'lucia', display_name = 'Lucia Perez'
  where id = '30000000-0000-0000-0000-000000000002';

insert into org_memberships (user_id, org_id, branch_id, role, status) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'org_member', 'active'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'org_member', 'active')
  on conflict do nothing;

insert into public.services (org_id, branch_id, name, status, leader_id, starts_at)
values ('10000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000b1',
        'Sunday 10am', 'draft', '10000000-0000-0000-0000-000000000001', now() + interval '7 days')
returning id \gset svc_

insert into public.setlists (org_id, branch_id, owner_id, name, visibility)
values ('10000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000b1',
        '10000000-0000-0000-0000-000000000001', 'Sunday set', 'org')
returning id \gset sl_

insert into public.setlist_items (setlist_id, song_id, position, agreed_key, vocal_parts)
values (:'sl_id', '20000000-0000-0000-0000-000000000001', 1, 'C', '[]'::jsonb),
       (:'sl_id', '20000000-0000-0000-0000-000000000002', 2, 'G', '[]'::jsonb);

insert into public.service_blocks (service_id, name, position, time_budget, setlist_id, start_offset_minutes)
values (:'svc_id', 'Worship', 1, 20, :'sl_id', 0)
returning id \gset blk_

insert into public.service_assignments (service_id, block_id, user_id, part) values
  (:'svc_id', :'blk_id', '30000000-0000-0000-0000-000000000001', 'piano'),
  (:'svc_id', :'blk_id', '30000000-0000-0000-0000-000000000002', 'lead vocals');

-- ══ T0: no publish yet → published=false, service stays draft ══
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

select tmp_assert('T0 no publish -> published=false',
  (public.get_published_plan(:'svc_id') ->> 'published')::boolean = false
  and (select status from public.services where id = :'svc_id') = 'draft');

-- ══ T1: first publish creates version 1 + flips service to published ══
select public.publish_plan(:'svc_id', '') as t1_version;

select tmp_assert('T1 publish v1 -> service published + version active',
  (select status from public.services where id = :'svc_id') = 'published'
  and (select count(*) from public.list_plan_versions(:'svc_id')) = 1
  and (select version_number from public.list_plan_versions(:'svc_id')) = 1
  and (select status from public.list_plan_versions(:'svc_id')) = 'published');

-- ══ T2: leader draft edit after publish → draft_changed=true, snapshot frozen ══
update public.service_blocks set name = 'Worship v2' where id = :'blk_id';

select tmp_assert('T2 draft_changed + snapshot frozen',
  (public.get_published_plan(:'svc_id') ->> 'draft_changed')::boolean = true
  and (public.get_published_plan(:'svc_id') #>> '{snapshot,blocks,0,name}') = 'Worship'
  and (public.get_published_plan(:'svc_id') #>> '{draft,blocks,0,name}') = 'Worship v2');

-- ══ T3: re-publish v2 (reason) supersedes v1 + logs + notifies assignees ══
select public.publish_plan(:'svc_id', 'New opening song') as t3_version;

select tmp_assert('T3 re-publish v2: v1 superseded + log(2)',
  (select count(*) from public.list_plan_versions(:'svc_id')) = 2
  and (select status from public.list_plan_versions(:'svc_id') where version_number = 1) = 'superseded'
  and (select status from public.list_plan_versions(:'svc_id') where version_number = 2) = 'published'
  and (select count(*) from public.service_change_log
       where service_id = :'svc_id' and action = 'publish') = 2);

-- ══ T4: member reads latest published snapshot, no draft leak ══
-- (draft edit AFTER re-publish: member must keep v2, never see the new draft)
update public.service_blocks set name = 'Worship v3' where id = :'blk_id';

select set_config('request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

select tmp_assert('T4 member reads published snapshot (no draft leak)',
  (public.get_published_plan(:'svc_id') ->> 'version_number')::int = 2
  and (public.get_published_plan(:'svc_id') #>> '{snapshot,blocks,0,name}') = 'Worship v2'
  and (public.get_published_plan(:'svc_id') #>> '{draft,blocks,0,name}') = 'Worship v3'
  and (public.get_published_plan(:'svc_id') ->> 'draft_changed')::boolean = true
  and (public.get_published_plan(:'svc_id') #>> '{snapshot,blocks,0,songs,0,agreed_key}') = 'C');

-- ══ T5: non-leader cannot publish; outsider cannot read ══
select tmp_expect_error('T5 non-leader publish blocked',
  format('select public.publish_plan(%L, %L)', :'svc_id', ''),
  '%Only the service leader%');

select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', false);
select tmp_expect_error('T5b outsider cross-org read blocked',
  format('select public.get_published_plan(%L)', :'svc_id'),
  '%Not visible%');

-- ══ T6: anon has no EXECUTE (42501) ══
select set_config('role', 'anon', false);
select set_config('request.jwt.claims', '{}', false);
select tmp_expect_error('T6 anon blocked (no EXECUTE on RPC)',
  format('select public.get_published_plan(%L)', :'svc_id'),
  '%permission denied%');

-- ══ T7: leader-only version history with decider name + reason ══
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

select version_number, status, published_by_name, reason
from public.list_plan_versions(:'svc_id') order by version_number desc;

select tmp_assert('T7 history rows + decider + reason',
  (select count(*) from public.list_plan_versions(:'svc_id')) = 2
  and (select published_by_name from public.list_plan_versions(:'svc_id')
       where version_number = 2) = 'Demo User'
  and (select reason from public.list_plan_versions(:'svc_id')
       where version_number = 2) = 'New opening song');

-- ══ T8: completing the service freezes the executed version ══
update public.services set status = 'completed' where id = :'svc_id';

select tmp_assert('T8 completed -> v2 executed + read-only read',
  (select status from public.list_plan_versions(:'svc_id') where version_number = 2) = 'executed'
  and (public.get_published_plan(:'svc_id') ->> 'status') = 'executed');

-- ══ T9: publish on completed service blocked ══
select tmp_expect_error('T9 completed publish blocked',
  format('select public.publish_plan(%L, %L)', :'svc_id', 'again'),
  '%read-only%');

-- ══ T10: change log records leader as decider with reason ══
select tmp_assert('T10 change log decider + reason on re-publish',
  exists (
    select 1 from public.service_change_log sp
    where sp.service_id = :'svc_id' and sp.action = 'publish'
      and sp.detail ->> 'version' = '2'
      and sp.detail ->> 'reason' = 'New opening song'));

select tmp_assert('T10b first publish logged changed=false',
  exists (
    select 1 from public.service_change_log sp
    where sp.service_id = :'svc_id' and sp.action = 'publish'
      and sp.detail ->> 'version' = '1'
      and sp.detail ->> 'changed' = 'false'));

-- ══ T11 (postgres side): every publish notified both assignees, never the leader ══
select set_config('role', 'postgres', false);

select tmp_assert('T11 publish notified juan + lucia (x2), leader self-suppressed',
  (select count(*) from public.notifications
   where user_id = '30000000-0000-0000-0000-000000000001' and category = 'system') = 2
  and (select count(*) from public.notifications
       where user_id = '30000000-0000-0000-0000-000000000002' and category = 'system') = 2
  and (select count(*) from public.notifications
       where user_id = '10000000-0000-0000-0000-000000000001' and category = 'system') = 0);

-- ══ T12: anon cannot see version rows directly, service_role can ══
select tmp_assert('T12 version table locked to RPCs',
  has_table_privilege('anon', 'public.service_plan_versions', 'SELECT') = false
  and has_table_privilege('authenticated', 'public.service_plan_versions', 'SELECT') = false
  and has_table_privilege('service_role', 'public.service_plan_versions', 'SELECT') = true);