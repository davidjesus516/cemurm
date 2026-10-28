-- 0024 MIDI program mapping smoke (local dev only; fresh reset DB, single run).
-- Reuses the seed fixture: Demo Setlist 30000000-…-…001 owned by demo …0001,
-- items …002/…003 (songs 2000..0001/2000..0002), isolation …0002 accepted
-- view-only collaborator, outsider …0003 pending collaborator (accepted_at NULL).
-- Matrix: column present + default NULL; CHECK rejects 128/-1; owner update
-- pass + clear back to NULL; view-only collaborator denied on change;
-- pending collaborator denied. Assertions that read contract tables directly
-- run under role postgres (deny-by-default surface; RLS is the client gate).
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

-- ══════════════ 1. SCHEMA (postgres) ══════════════
select tmp_assert(
  '0024 column midi_program exists on setlist_items',
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'setlist_items'
      and column_name = 'midi_program'
  )
);

select tmp_assert(
  '0024 midi_program defaults to NULL on seed items',
  not exists (
    select 1 from public.setlist_items where midi_program is not null
  )
);

-- ══════════════ 2. CONSTRAINT (postgres) ══════════════
select tmp_expect_error(
  '0024 CHECK rejects program 128',
  $$update public.setlist_items set midi_program = 128
    where id = '30000000-0000-0000-0000-000000000002'$$,
  '%setlist_items_midi_program_check%'
);

select tmp_expect_error(
  '0024 CHECK rejects program -1',
  $$update public.setlist_items set midi_program = -1
    where id = '30000000-0000-0000-0000-000000000002'$$,
  '%setlist_items_midi_program_check%'
);

-- ══════════════ 3. OWNER WRITE (authenticated demo) ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', false);

update public.setlist_items
  set midi_program = 45
  where id = '30000000-0000-0000-0000-000000000002';

select tmp_assert(
  '0024 owner can map program 45',
  exists (
    select 1 from public.setlist_items
    where id = '30000000-0000-0000-0000-000000000002' and midi_program = 45
  )
);

update public.setlist_items
  set midi_program = null
  where id = '30000000-0000-0000-0000-000000000002';

select tmp_assert(
  '0024 owner can clear mapping back to NULL',
  exists (
    select 1 from public.setlist_items
    where id = '30000000-0000-0000-0000-000000000002' and midi_program is null
  )
);

-- ══════════════ 4. NON-EDITING WRITES DENIED ══════════════
-- view-only collaborator: accepted (passes USING) but can_edit=false (fails
-- WITH CHECK on a value change).
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', false);

select tmp_expect_error(
  '0024 view-only collaborator cannot write a mapping',
  $$update public.setlist_items
    set midi_program = 30
    where id = '30000000-0000-0000-0000-000000000002'$$,
  '%row-level security%'
);

-- pending collaborator: accepted_at NULL (fails the USING clause) — RLS
-- filters the row and the UPDATE affects 0 rows without raising (unlike the
-- WITH CHECK denial above, which errors). Security assertion: value unchanged.
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', false);

update public.setlist_items
  set midi_program = 30
  where id = '30000000-0000-0000-0000-000000000002';

-- The value check runs under postgres: the outsider cannot see the row at all
-- (read RLS filters it), so the assert itself would be filtered otherwise.
-- Claims persist across the role switch (request.jwt.claims survives).
select set_config('role', 'postgres', false);

select tmp_assert(
  '0024 pending collaborator write is filtered (value unchanged)',
  exists (
    select 1 from public.setlist_items
    where id = '30000000-0000-0000-0000-000000000002' and midi_program is null
  )
);

-- ══════════════ RESTORE (postgres, keeps reseed deterministic) ══════════════
select set_config('role', 'postgres', false);