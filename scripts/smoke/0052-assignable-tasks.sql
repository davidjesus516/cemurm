-- 0052 assignable-tasks smoke (local dev only; fresh reset DB, single run, not idempotent).
--
-- Covers `0052_assignable_tasks.sql`. The smoke filenames do NOT track migration numbers;
-- this one happens to match because it was written with the migration.
--
-- Scope under test — the four permissions this table has, each from both sides:
--   select  creator and assignee only; a third party sees nothing.
--   insert  the creator, an ACTIVE bandmate in either direction, never self.
--   update  the assignee only, and only status/completed_at (column grant).
--   delete  the creator only. An assignee or a third party leaves the row in place.
-- Plus the deliberate freeze: removing the bandmate edge leaves an existing task readable
-- and completable, while a NEW assignment between the same pair is refused.
--
-- Run: supabase db reset, then
--   docker exec -i supabase_db_cemurm psql -U postgres -d postgres -X \
--     -v ON_ERROR_STOP=1 -f - < scripts/smoke/0052-assignable-tasks.sql
-- Expects 15 PASS / 0 FAIL.
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
-- 51 creator (Ana), 52 active bandmate (Lucia), 53 third party (Marco),
-- 54 pending invite only (Pedro).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('60000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 't50.ana@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000052', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Ana","lastName":"Task","displayName":"Ana"}', now(), now()),
  ('60000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 't50.lucia@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000052', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Lucia","lastName":"Task","displayName":"Lucia"}', now(), now()),
  ('60000000-0000-0000-0000-000000000053', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 't50.marco@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000053', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Marco","lastName":"Task","displayName":"Marco"}', now(), now()),
  ('60000000-0000-0000-0000-000000000054', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 't50.pedro@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000054', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Pedro","lastName":"Task","displayName":"Pedro"}', now(), now())
  on conflict do nothing;

update profiles set username = 't50ana',   display_name = 'Ana'   where id = '60000000-0000-0000-0000-000000000052';
update profiles set username = 't50lucia', display_name = 'Lucia' where id = '60000000-0000-0000-0000-000000000052';
update profiles set username = 't50marco', display_name = 'Marco' where id = '60000000-0000-0000-0000-000000000053';
update profiles set username = 't50pedro', display_name = 'Pedro' where id = '60000000-0000-0000-0000-000000000054';

-- Lucia invited Ana; the edge is directional and ACTIVE. Pedro's invite is still pending.
insert into public.bandmate_links (user_id, bandmate_id, status, accepted_at) values
  ('60000000-0000-0000-0000-000000000052', '60000000-0000-0000-0000-000000000052', 'active', now()),
  ('60000000-0000-0000-0000-000000000052', '60000000-0000-0000-0000-000000000054', 'pending', null)
  on conflict do nothing;

-- ══════════════ INSERT: the rule is "creator + ACTIVE bandmate, either direction" ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000052","role":"authenticated"}', false);

insert into public.tasks (created_by, assigned_to, title, due_at)
values ('60000000-0000-0000-0000-000000000052', '60000000-0000-0000-0000-000000000052',
        'Book the rehearsal room', '2026-11-30')
returning id \gset t1_

select set_config('role', 'postgres', false);
select tmp_assert('1 creator assigns to an ACTIVE bandmate (reverse-direction edge)',
  (select count(*) = 1 from public.tasks where id = :'t1_id'));

select set_config('role', 'authenticated', false);
select tmp_expect_error('2 refused: assignee is not a bandmate at all',
  $$insert into public.tasks (created_by, assigned_to, title)
    values ('60000000-0000-0000-0000-000000000052', '60000000-0000-0000-0000-000000000053', 'Nope')$$,
  '%row-level security%');

select tmp_expect_error('3 refused: assignee invite is still pending',
  $$insert into public.tasks (created_by, assigned_to, title)
    values ('60000000-0000-0000-0000-000000000052', '60000000-0000-0000-0000-000000000054', 'Nope')$$,
  '%row-level security%');

select tmp_expect_error('4 refused: assigning to yourself',
  $$insert into public.tasks (created_by, assigned_to, title)
    values ('60000000-0000-0000-0000-000000000052', '60000000-0000-0000-0000-000000000052', 'Nope')$$,
  '%');

-- ══════════════ SELECT: the two parties only ══════════════
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000052","role":"authenticated"}', false);
select tmp_assert('5 assignee lists exactly the task assigned to her',
  (select count(*) = 1 from public.tasks where id = :'t1_id'));

select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000053","role":"authenticated"}', false);
select tmp_assert('6 third party sees nothing',
  (select count(*) = 0 from public.tasks where id = :'t1_id'));

-- ══════════════ UPDATE: assignee, status/completed_at only ══════════════
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000052","role":"authenticated"}', false);
update public.tasks set status = 'done', completed_at = now() where id = :'t1_id';

select set_config('role', 'postgres', false);
select tmp_assert('7 assignee completes: status done, completion recorded',
  (select status = 'done' and completed_at is not null from public.tasks where id = :'t1_id'));

-- A second, still-open task proves the creator cannot complete someone else's work and that
-- the column grant blocks a rewrite. Both are needed: RLS alone would allow status changes by
-- any party, and the column grant alone would allow the creator to complete it.
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000052","role":"authenticated"}', false);
insert into public.tasks (created_by, assigned_to, title)
values ('60000000-0000-0000-0000-000000000052', '60000000-0000-0000-0000-000000000052', 'Send the setlist PDF')
returning id \gset t2_

update public.tasks set status = 'done', completed_at = now() where id = :'t2_id';

select set_config('role', 'postgres', false);
select tmp_assert('8 creator cannot complete the assignee''s open task',
  (select status = 'open' and completed_at is null from public.tasks where id = :'t2_id'));

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000052","role":"authenticated"}', false);
select tmp_expect_error('9 assignee cannot retitle a task',
  format('update public.tasks set title = %L where id = %L', 'Rewritten', :'t2_id'),
  '%permission denied%');

select tmp_expect_error('10 assignee cannot hand the task to a third person',
  format('update public.tasks set assigned_to = %L where id = %L',
         '60000000-0000-0000-0000-000000000053', :'t2_id'),
  '%permission denied%');

-- ══════════════ DELETE: creator only ══════════════
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000053","role":"authenticated"}', false);
delete from public.tasks where id = :'t2_id';

select set_config('role', 'postgres', false);
select tmp_assert('11 third party cannot delete: row still present',
  (select count(*) = 1 from public.tasks where id = :'t2_id'));

-- ══════════════ FREEZE: removing the edge erases neither side of an existing task ══════════════
delete from public.bandmate_links
  where user_id in ('60000000-0000-0000-0000-000000000052', '60000000-0000-0000-0000-000000000052')
    and bandmate_id in ('60000000-0000-0000-0000-000000000052', '60000000-0000-0000-0000-000000000052');

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000052","role":"authenticated"}', false);
select tmp_assert('12 removed bandmate still reads the task already assigned',
  (select count(*) = 1 from public.tasks where id = :'t2_id'));

select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000052","role":"authenticated"}', false);
select tmp_expect_error('13 removed bandmate cannot be assigned a NEW task',
  $$insert into public.tasks (created_by, assigned_to, title)
    values ('60000000-0000-0000-0000-000000000052', '60000000-0000-0000-0000-000000000052', 'Nope')$$,
  '%row-level security%');

-- ══════════════ ANON: no client grant, so no row and no policy evaluation ══════════════
select set_config('role', 'anon', false);
select tmp_expect_error('14 anon cannot read tasks',
  format('select count(*) from public.tasks where id = %L', :'t2_id'),
  '%permission denied%');

-- ══════════════ WITHDRAW: creator deletes, both sides lose the row ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000052","role":"authenticated"}', false);
delete from public.tasks where id = :'t2_id';

select set_config('role', 'postgres', false);
select tmp_assert('15 creator withdraws: row gone for both sides',
  (select count(*) = 0 from public.tasks where id = :'t2_id'));
