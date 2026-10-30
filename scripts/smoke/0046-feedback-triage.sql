-- 0046 Feedback triage smoke (local dev only; fresh reset DB, single run).
-- Scope: the migration surface of 0046_feedback_triage_and_github_link.sql --
-- the seven audit/GitHub columns on public.feedback, the three inbox indexes,
-- the updated_at trigger, private.is_system_admin, the column-scoped UPDATE
-- grant that makes feedback_update_staff reachable (0033 granted only
-- insert+select), the absence of a DELETE grant, and the resulting RLS
-- behaviour end to end.
-- The write path is round-tripped, not just inspected: the demo user …0001
-- (no system_admin row in the seed) cannot update …0002's report, then the same
-- UPDATE lands once a system_admin row exists and the trigger stamps
-- updated_at. anon has no privilege on the table at all.
-- Contract reads run under role postgres (RLS would filter them otherwise).
-- Role switches use `select set_config(...)`; bare calls are not valid
-- top-level statements. Fixtures are FIXED literals in the 30000…9c range,
-- clear of the seed's 30000000-… setlist family and of the 6xx/7xx/8xx/9a/9b
-- fixtures owned by the earlier smokes.
-- expects 15 PASS / 0 FAIL
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

-- ══════════════ 1. SCHEMA SURFACE ══════════════
select set_config('role','postgres',false);

select tmp_assert(
  '0046 feedback gains the seven triage columns',
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'feedback'
       and column_name in ('updated_at', 'updated_by', 'github_issue_number',
                           'github_issue_url', 'github_repo', 'promoted_at',
                           'promoted_by')) = 7
);

select tmp_assert(
  '0046 three inbox indexes exist',
  (select count(*) from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'i'
      and c.relname in ('idx_feedback_status_created_at',
                        'idx_feedback_kind_created_at',
                        'idx_feedback_github_issue_number')) = 3
);

select tmp_assert(
  '0046 trg_feedback_updated_at exists on public.feedback',
  exists (
    select 1 from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'feedback'
       and t.tgname = 'trg_feedback_updated_at' and not t.tgisinternal
  )
);

-- ══════════════ 2. HELPER + PRIVILEGES ══════════════
select tmp_assert(
  '0046 private.is_system_admin(uuid) exists',
  exists (
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and p.proname = 'is_system_admin'
       and p.pronargs = 1
  )
);

select tmp_assert(
  '0046 authenticated can execute private.is_system_admin',
  has_function_privilege('authenticated', 'private.is_system_admin(uuid)', 'EXECUTE')
);

-- The regression T6 closes: 0033 granted only insert+select, so the
-- feedback_update_staff policy had no permission behind it. 0046 grants UPDATE
-- on the triage columns alone, so user-authored content stays unwritable and
-- updated_at stays trigger-owned.
select tmp_assert(
  '0046 authenticated updates the triage columns, not user content',
  has_column_privilege('authenticated', 'public.feedback', 'status', 'UPDATE')
  and has_column_privilege('authenticated', 'public.feedback', 'updated_by', 'UPDATE')
  and has_column_privilege('authenticated', 'public.feedback', 'github_issue_number', 'UPDATE')
  and has_column_privilege('authenticated', 'public.feedback', 'github_issue_url', 'UPDATE')
  and has_column_privilege('authenticated', 'public.feedback', 'github_repo', 'UPDATE')
  and has_column_privilege('authenticated', 'public.feedback', 'promoted_at', 'UPDATE')
  and has_column_privilege('authenticated', 'public.feedback', 'promoted_by', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.feedback', 'user_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.feedback', 'kind', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.feedback', 'message', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.feedback', 'diagnostics', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.feedback', 'screen', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.feedback', 'created_at', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.feedback', 'updated_at', 'UPDATE')
);

-- 0033 deliberately kept reports immutable: triage may correct a status, never
-- erase the report. The Supabase default ACL handed `authenticated` ALL on the
-- table, so 0046 revokes it back to insert/select plus the triage columns.
select tmp_assert(
  '0046 authenticated does not hold DELETE on public.feedback',
  not has_table_privilege('authenticated', 'public.feedback', 'DELETE')
);

-- TRUNCATE is the one destructive verb RLS cannot filter (no row predicate is
-- evaluated), so the ACL has to deny it.
select tmp_assert(
  '0046 authenticated does not hold TRUNCATE on public.feedback',
  not has_table_privilege('authenticated', 'public.feedback', 'TRUNCATE')
);

-- ══════════════ 3. NON-ADMIN UPDATE IS FILTERED ══════════════
select set_config('role','postgres',false);

insert into public.feedback (id, user_id, kind, message, status)
values ('30000000-0000-0000-0000-0000000009c1',
        '10000000-0000-0000-0000-000000000002',
        'bug_report', '0046 smoke fixture: report owned by the isolation user', 'new');

select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

-- feedback_select_staff widens reads to system admins. …0001 holds no
-- system_admin row yet at this point, so …0002's report must stay invisible.
do $$
declare visible integer;
begin
  select count(*) into visible
    from public.feedback
   where id = '30000000-0000-0000-0000-0000000009c1';
  perform tmp_assert('0046 non-admin select sees 0 rows of another user''s report', visible = 0);
end $$;

do $$
declare touched integer;
begin
  update public.feedback
     set status = 'triaged'
   where id = '30000000-0000-0000-0000-0000000009c1';
  get diagnostics touched = row_count;
  perform tmp_assert('0046 non-admin update touches 0 rows', touched = 0);
end $$;

select set_config('role','postgres',false);

select tmp_assert(
  '0046 other user''s report untouched after non-admin update',
  exists (
    select 1 from public.feedback
     where id = '30000000-0000-0000-0000-0000000009c1'
       and status = 'new' and updated_at is null
  )
);

-- ══════════════ 4. SYSTEM_ADMIN UPDATE LANDS + TRIGGER ══════════════
select set_config('role','postgres',false);

insert into public.user_roles (user_id, role)
values ('10000000-0000-0000-0000-000000000001', 'system_admin')
on conflict do nothing;

select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

do $$
declare touched integer;
begin
  update public.feedback
     set status = 'triaged',
         updated_by = '10000000-0000-0000-0000-000000000001'
   where id = '30000000-0000-0000-0000-0000000009c1';
  get diagnostics touched = row_count;
  perform tmp_assert('0046 system_admin update touches 1 row', touched = 1);
end $$;

select set_config('role','postgres',false);

select tmp_assert(
  '0046 updated_at is stamped by the trigger',
  exists (
    select 1 from public.feedback
     where id = '30000000-0000-0000-0000-0000000009c1'
       and status = 'triaged' and updated_at is not null
  )
);

-- ══════════════ 5. ANON HAS NO ACCESS ══════════════
select set_config('role','anon',false);

select tmp_expect_error(
  '0046 anon cannot select public.feedback',
  $$select 1 from public.feedback$$,
  '%permission denied%'
);

-- ══════════════ 6. CLEANUP ══════════════
select set_config('role','postgres',false);

delete from public.feedback
 where id = '30000000-0000-0000-0000-0000000009c1';
delete from public.user_roles
 where user_id = '10000000-0000-0000-0000-000000000001' and role = 'system_admin';

select tmp_assert(
  '0046 fixture tidy: feedback row and role grant removed',
  not exists (
    select 1 from public.feedback
     where id = '30000000-0000-0000-0000-0000000009c1'
  )
  and not exists (
    select 1 from public.user_roles
     where user_id = '10000000-0000-0000-0000-000000000001' and role = 'system_admin'
  )
);

reset role;
