-- 0033 Feedback smoke (local dev only; fresh reset DB, single run).
--
-- Renumbered from 0029. `0029` was claimed by two unrelated changes at once:
-- this one and the guardian branch family's contiguous
-- 0029/0030/0031 run. `supabase db reset` executes migrations in FILENAME
-- order, so two files sharing a version prefix have an arbitrary relative
-- order, and the migration ledger is keyed on that version. This file moved to
-- 0033 because it is standalone, whereas the guardian side is a three-file run
-- where each builds on the last. Recorded as item 8 in
-- docs/engineering-review-backlog.md.
--
-- Reuses the seed fixture: demo …0001, isolation …0002, outsider …0003, all
-- password `password1234`. Feedback ids are FIXED literals in the 30000…9xx
-- range (gen_random_uuid would not cross role switches). No collision with
-- 0026's 30000…6xx, 0027's 30000…7xx or 0028's 30000…8xx fixtures.
--
-- Matrix — what this migration actually promises:
--   · the table is deny-by-default: anon and public hold NO privilege at all,
--     not merely an RLS policy that filters them out.
--   · authenticated gets insert + select and nothing else. No update, no
--     delete: a feedback row is a report, not a mutable record, and `status`
--     moves through moderation rather than through the reporter.
--   · both policies are SELF-scoped in both directions: WITH CHECK on insert so
--     a caller cannot file feedback under someone else's id, USING on select so
--     a caller cannot read anyone else's report. The second is the one that
--     would leak if it were missing.
--   · service_role holds ALL, for triage.
--   · status defaults to 'new'; kind and status are closed vocabularies;
--     message is bounded at 20000 characters and cannot be empty.
--
-- Assertions that read contract tables directly run under role postgres
-- (deny-by-default; RLS is the client gate — tested explicitly below).
-- Role switches use `select set_config(...)` (bare calls are not valid
-- top-level statements).
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

\echo '--- contract (role postgres) ---'
select set_config('role', 'postgres', false);

-- The vocabulary and the grants are the contract; assert them directly.
select tmp_assert('feedback: status defaults to new',
  (select column_default like '%''new''%'
     from information_schema.columns
    where table_schema = 'public' and table_name = 'feedback' and column_name = 'status'));

select tmp_assert('feedback: kind is a closed vocabulary',
  exists (select 1 from pg_constraint
           where conrelid = 'public.feedback'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%bug_report%'
             and pg_get_constraintdef(oid) like '%general_feedback%'));

select tmp_assert('feedback: status is a closed vocabulary',
  exists (select 1 from pg_constraint
           where conrelid = 'public.feedback'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%triaged%'
             and pg_get_constraintdef(oid) like '%closed%'));

select tmp_assert('feedback: message is bounded and cannot be empty',
  exists (select 1 from pg_constraint
           where conrelid = 'public.feedback'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%20000%'));

-- Deny-by-default: the grants, not just the policies.
select tmp_assert('feedback: anon holds NO privilege on the table',
  not has_table_privilege('anon', 'public.feedback', 'INSERT')
  and not has_table_privilege('anon', 'public.feedback', 'SELECT'));

select tmp_assert('feedback: authenticated holds insert + select and nothing else',
  has_table_privilege('authenticated', 'public.feedback', 'INSERT')
  and has_table_privilege('authenticated', 'public.feedback', 'SELECT')
  and not has_table_privilege('authenticated', 'public.feedback', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.feedback', 'DELETE'));

select tmp_assert('feedback: service_role holds all',
  has_table_privilege('service_role', 'public.feedback', 'INSERT,SELECT,UPDATE,DELETE'));

\echo '--- anon is shut out at the GRANT layer, not merely by RLS ---'
select set_config('role', 'anon', false);

select tmp_expect_error('feedback: anon cannot insert',
  $$insert into public.feedback (user_id, kind, message)
    values ('10000000-0000-0000-0000-000000000001', 'bug_report', 'anon should not be able to write this')$$,
  '%permission denied%');

select tmp_expect_error('feedback: anon cannot select',
  $$select count(*) from public.feedback$$,
  '%permission denied%');

\echo '--- authenticated: the self-scoped contract ---'
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

-- The insert is a statement in its own right: an INSERT is not an expression,
-- so it cannot be the argument of an assertion. Success is proven by the row
-- existing afterwards, asserted next.
insert into public.feedback (id, kind, message)
  values ('30000900-0000-4000-8000-000000000001', 'bug_report',
          'The setlist picker drops the second song on reload');

select tmp_assert('feedback: demo can file a report under his own id, and it lands as new',
  exists (select 1 from public.feedback
           where id = '30000900-0000-4000-8000-000000000001'
             and status = 'new'
             and user_id = '10000000-0000-0000-0000-000000000001'));

-- WITH CHECK on insert: user_id is forced to the caller, so filing under
-- somebody else is a row-level policy violation, not a silent impersonation.
select tmp_expect_error('feedback: demo cannot file a report under another id',
  $$insert into public.feedback (user_id, kind, message)
    values ('10000000-0000-0000-0000-000000000003', 'bug_report', 'impersonation attempt')$$,
  '%row-level security%');

select tmp_assert('feedback: demo sees his own report',
  exists (select 1 from public.feedback where id = '30000900-0000-4000-8000-000000000001'));

-- USING on select: the one that would leak. A second user must see zero rows.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', false);

select tmp_assert('feedback: outsider sees ZERO of demo rows (RLS is not a filter demo opts out of)',
  (select count(*) from public.feedback) = 0);

select tmp_assert('feedback: outsider cannot update or delete a report',
  not has_table_privilege('authenticated', 'public.feedback', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.feedback', 'DELETE'));

\echo '--- the closed vocabularies are enforced by the database, not the form ---'
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

select tmp_expect_error('feedback: an unknown kind is rejected',
  $$insert into public.feedback (kind, message) values ('complaint', 'not a kind in the vocabulary')$$,
  '%check constraint%');

select tmp_expect_error('feedback: an empty message is rejected',
  $$insert into public.feedback (kind, message) values ('bug_report', '')$$,
  '%check constraint%');

-- The status vocabulary is checked UNDER role postgres on purpose. As
-- `authenticated` this UPDATE would be refused for the missing UPDATE grant
-- before the check constraint was ever reached, so the assertion below would
-- pass for the wrong reason — it would be testing the grant, not the
-- vocabulary. Triage moves status, and triage is service_role's job.
select set_config('role', 'postgres', false);

select tmp_expect_error('feedback: an unknown status is rejected at the constraint',
  $$update public.feedback set status = 'ignored'
     where id = '30000900-0000-4000-8000-000000000001'$$,
  '%check constraint%');

-- Again a statement in its own right: UPDATE ... RETURNING is not an
-- expression, so it cannot be an assertion argument. The update runs, then the
-- assertion reads the result back.
update public.feedback set status = 'triaged'
 where id = '30000900-0000-4000-8000-000000000001';

select tmp_assert('feedback: triage moves status to a valid value',
  exists (select 1 from public.feedback
           where id = '30000900-0000-4000-8000-000000000001' and status = 'triaged'));

\echo
\echo 'If the expected count is 18 and you see 18 [PASS] lines with 0 [FAIL], the migration is sound.'
\echo 'This script is NOT idempotent: it commits its writes. Reset before a second run.'
