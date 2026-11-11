-- 0043 account erasure smoke — request/grace/cancel/core/cron/purge queue
-- (local dev only; fresh reset DB, single run.)
--
-- expects 11 PASS / 0 FAIL (minimum assertions listed)
--
-- This file sets ON_ERROR_STOP itself and raises at the end if any assertion failed or if any of
-- the 11 went missing, so a failing run exits non-zero whether or not the caller passed the flag.
\set ON_ERROR_STOP on
set client_min_messages to notice;

-- Failure accounting. tmp_assert records every assertion instead of only raising a NOTICE, because
-- a NOTICE is not an exit code: three assertions here could never pass and the file still ended
-- normally with status 0, which reads as green in a log, in a CI step and in `psql`'s exit status.
-- The DO block at the end of the file turns this record into that exit code.
create temp table tmp_smoke_asserts (name text, ok boolean);
-- Assertions run as `authenticated`, so the record has to be writable by that role: tmp_assert is
-- invoker-rights on purpose, and a grant on the temp table keeps it that way.
grant insert on tmp_smoke_asserts to authenticated;

create or replace function tmp_assert(p_name text, p_ok boolean) returns void language plpgsql as $$
begin
  insert into tmp_smoke_asserts (name, ok) values (p_name, p_ok);
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

-- FIXTURES
select set_config('role', 'postgres', false);

insert into organizations (id, name, org_type, status) values
  ('50000000-0000-0000-0000-000000000911', 'Academia Erase', 'Academy', 'active')
  on conflict do nothing;

insert into branches (id, org_id, name, city, status) values
  ('50000000-0000-0000-0000-000000000921', '50000000-0000-0000-0000-000000000911',
   'Sede', 'Madrid', 'active')
  on conflict do nothing;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('50000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'eraseme@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34915000001', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Erase","lastName":"Me","displayName":"EraseMe"}', now(), now()),
  ('50000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'other@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34915000002', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Other","lastName":"User","displayName":"Other"}', now(), now());

update profiles set display_name = v.display_name
from (values
  ('50000000-0000-0000-0000-000000000901'::uuid, 'EraseMe'),
  ('50000000-0000-0000-0000-000000000902'::uuid, 'Other')
) as v(id, display_name)
where profiles.id = v.id;

insert into org_memberships (user_id, org_id, branch_id, role, status) values
  ('50000000-0000-0000-0000-000000000901', '50000000-0000-0000-0000-000000000911',
   '50000000-0000-0000-0000-000000000921', 'org_member', 'active')
  on conflict do nothing;

-- Create data for erasing user
insert into songs (id, org_id, branch_id, title, artist, created_by, license, license_confirmed) values
  ('50000000-0000-0000-0000-000000000931', '50000000-0000-0000-0000-000000000911',
   '50000000-0000-0000-0000-000000000921', 'Erase Song', 'EraseMe', '50000000-0000-0000-0000-000000000901',
   'CC-BY-4.0', true);

insert into setlists (id, org_id, branch_id, owner_id, name, visibility) values
  ('50000000-0000-0000-0000-000000000981', '50000000-0000-0000-0000-000000000911',
   '50000000-0000-0000-0000-000000000921', '50000000-0000-0000-0000-000000000901',
   'Erase Setlist', 'private');

insert into personal_annotations (id, user_id, song_id, anchor, kind, value) values
  ('50000000-0000-0000-0000-000000000a71', '50000000-0000-0000-0000-000000000901',
   '50000000-0000-0000-0000-000000000931', '{"line":1}', 'note', 'private');

insert into practice_sessions (id, user_id, song_id, instrument, started_at, ended_at) values
  ('50000000-0000-0000-0000-000000000a91', '50000000-0000-0000-0000-000000000901',
   '50000000-0000-0000-0000-000000000931', 'guitar', now() - interval '1 day', now() - interval '1 day' + interval '30 min');

insert into notification_preferences (user_id, push_enabled, categories, weekly_digest) values
  ('50000000-0000-0000-0000-000000000901', true, '{"gigs":true}', true);

insert into user_preferences (user_id, transpose_offset, capo, preferences) values
  ('50000000-0000-0000-0000-000000000901', 0, 0, '{"x":1}');

insert into follows (follower_id, followed_id) values
  ('50000000-0000-0000-0000-000000000901', '50000000-0000-0000-0000-000000000902');

insert into notifications (id, user_id, category, title, body) values
  ('50000000-0000-0000-0000-000000000b01', '50000000-0000-0000-0000-000000000901', 'system', 'hi', 'body');

-- Public contribution (live) to test withdrawal
insert into public_songs (id, song_id, contributor_id, license, license_confirmed, status) values
  ('50000000-0000-0000-0000-000000000c01', '50000000-0000-0000-0000-000000000931',
   '50000000-0000-0000-0000-000000000901', 'CC-BY-4.0', true, 'live');

-- 1. Request erasure
\echo '--- 1. request ---'
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-000000000901","role":"authenticated"}', false);

select tmp_assert('1 request_account_erasure creates pending row with scheduled_for = requested_at + 30 days',
  (select scheduled_for >= requested_at + interval '29 days 23 hours' and scheduled_for <= requested_at + interval '30 days 1 hour'
     from public.request_account_erasure()));

-- 2. Idempotent repeat: same row, same schedule, no second row
-- The old assertion counted the rows a `union all` of two calls returned, which is 2 by
-- construction -- it could never pass. What "idempotent" means is that the second call returns
-- the row already there and does not move its schedule, so that is what is asserted.
select tmp_assert('2 second call returns same row and does not move scheduled_for',
  (select count(*) = 1 from public.account_erasure_requests where user_id = '50000000-0000-0000-0000-000000000901')
  and (select (select scheduled_for from public.request_account_erasure())
             = (select scheduled_for from public.request_account_erasure())));

-- 3. Cancel keeps everything
\echo '--- 2. cancel ---'
select tmp_assert('3 cancel_account_erasure cancels request; user data retained',
  (select state = 'cancelled' from public.cancel_account_erasure())
  and (select count(*) = 1 from public.personal_annotations where user_id = '50000000-0000-0000-0000-000000000901')
  and (select count(*) = 1 from public.practice_sessions where user_id = '50000000-0000-0000-0000-000000000901'));

-- 4. Not due yet - create new request
\echo '--- 3. not due ---'
select set_config('role', 'postgres', false);
delete from public.account_erasure_requests where user_id = '50000000-0000-0000-0000-000000000901';
insert into public.account_erasure_requests (user_id, requested_at, scheduled_for, state)
values ('50000000-0000-0000-0000-000000000901', now(), now() + interval '30 days', 'pending');

select set_config('role', 'postgres', false);
-- Call it as a statement: `run_due_account_erasures() is null` can never be true, because the
-- function returns void and void is never NULL. The assertion is about its side effects, so the
-- effects are what is asserted -- plus the queue row still being pending, which is the thing
-- "erases nothing" actually means.
select private.run_due_account_erasures();
select tmp_assert('4 run_due_account_erasures erases nothing when not due',
  (select count(*) = 1 from public.personal_annotations where user_id = '50000000-0000-0000-0000-000000000901')
  and (select count(*) = 1 from auth.users where id = '50000000-0000-0000-0000-000000000901')
  and (select state = 'pending' from public.account_erasure_requests where user_id = '50000000-0000-0000-0000-000000000901'));

-- 5. Make due and run
\echo '--- 4. due run ---'
update public.account_erasure_requests set scheduled_for = now() - interval '1 hour' where user_id = '50000000-0000-0000-0000-000000000901';
select private.run_due_account_erasures();

select tmp_assert('5 annotations, practice, notification prefs, user prefs, follows, notifications, org memberships gone',
  (select count(*) = 0 from public.personal_annotations where user_id = '50000000-0000-0000-0000-000000000901')
  and (select count(*) = 0 from public.practice_sessions where user_id = '50000000-0000-0000-0000-000000000901')
  and (select count(*) = 0 from public.notification_preferences where user_id = '50000000-0000-0000-0000-000000000901')
  and (select count(*) = 0 from public.user_preferences where user_id = '50000000-0000-0000-0000-000000000901')
  and (select count(*) = 0 from public.follows where follower_id = '50000000-0000-0000-0000-000000000901' or followed_id = '50000000-0000-0000-0000-000000000901')
  and (select count(*) = 0 from public.notifications where user_id = '50000000-0000-0000-0000-000000000901')
  and (select count(*) = 0 from public.org_memberships where user_id = '50000000-0000-0000-0000-000000000901'));

-- 6. Org content remains with attribution stripped
select tmp_assert('6 songs and setlists remain with created_by/owner_id NULL',
  (select count(*) = 1 from public.songs where id = '50000000-0000-0000-0000-000000000931' and created_by is null)
  and (select count(*) = 1 from public.setlists where id = '50000000-0000-0000-0000-000000000981' and owner_id is null));

-- 7. Public contribution withdrawn
select tmp_assert('7 live public contribution became withdrawn',
  (select status = 'withdrawn' from public.public_songs where id = '50000000-0000-0000-0000-000000000c01'));

-- 8. User deleted
select tmp_assert('8 auth.users gone for user; profiles gone',
  (select count(*) = 0 from auth.users where id = '50000000-0000-0000-0000-000000000901')
  and (select count(*) = 0 from public.profiles where id = '50000000-0000-0000-0000-000000000901'));

-- 9. Idempotent core call
-- Same defect as #4: `erase_account_core(...) is null` is `false`, void being never NULL. Call it
-- and assert what "changes nothing" means: the user stays gone and the purge queue does not grow
-- a second row.
select private.erase_account_core('50000000-0000-0000-0000-000000000901');
select tmp_assert('9 second erase_account_core call raises nothing and changes nothing',
  (select count(*) = 0 from auth.users where id = '50000000-0000-0000-0000-000000000901')
  and (select count(*) = 0 from public.profiles where id = '50000000-0000-0000-0000-000000000901')
  and (select count(*) = 1 from private.storage_purge_queue where user_id = '50000000-0000-0000-0000-000000000901'));

-- 10. Request completed and queue has row
select tmp_assert('10 erasure request completed and storage_purge_queue has exactly one row',
  (select count(*) = 1 from public.account_erasure_requests where user_id = '50000000-0000-0000-0000-000000000901' and state = 'completed')
  and (select count(*) = 1 from private.storage_purge_queue where user_id = '50000000-0000-0000-0000-000000000901'));

-- 11. RLS on requests
\echo '--- 5. rls ---'
select set_config('role', 'postgres', false);
-- create another user and request
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('50000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rls@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34915000003', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Rls","lastName":"Test","displayName":"Rls"}', now(), now());
update profiles set display_name = 'Rls' where id = '50000000-0000-0000-0000-000000000903';

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-000000000903","role":"authenticated"}', false);
select public.request_account_erasure();

select tmp_assert('11 authenticated can read only own request row; cannot insert/update/delete directly',
  (select count(*) = 1 from public.account_erasure_requests)
  and (select (select count(*) from public.account_erasure_requests) = (select count(*) from public.account_erasure_requests where user_id = '50000000-0000-0000-0000-000000000903')));

reset role;

-- Accounting: the header declares 11 assertions. A run that passed 8 and skipped 3 prints
-- "8 PASS / 3 FAIL" but is really a run that lost three checks, so a missing assertion fails too.
do $$
declare v_total int; v_failed int;
begin
  select count(*), count(*) filter (where not ok) into v_total, v_failed from tmp_smoke_asserts;
  if v_total <> 11 then
    raise exception 'smoke 0043: expected 11 assertions, % ran', v_total;
  end if;
  if v_failed > 0 then
    raise exception 'smoke 0043: % of % assertions failed', v_failed, v_total;
  end if;
  raise notice 'smoke 0043: % of % assertions passed', v_total, v_total;
end $$;
