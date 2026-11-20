-- 0049 audience-view capability-token smoke (local dev only; fresh reset DB,
-- single run, not idempotent).
--
-- This smoke covers `0049_audience_view.sql`.
--
-- Scope under test (features/export-and-sharing.feature:133-152):
--   · Issuing a token is restricted to the owner or an ACCEPTED EDITOR
--     collaborator. A view-only collaborator and a pending invitee cannot
--     publish a setlist to anonymous strangers.
--   · `get_audience_setlist` is SECURITY DEFINER, so RLS does NOT filter it.
--     The payload must disclose exactly position/title/artist/durationSeconds
--     and nothing else — no chart body, no agreed key, no item notes, no
--     collaborators, no owner.
--   · A token is scoped to ONE setlist: it never returns another setlist's
--     songs, and a token for one setlist cannot be used to read another.
--   · Unknown, malformed, expired and revoked tokens are indistinguishable:
--     all four return NULL, never a partial envelope.
--   · `anon` holds no table grant on audience_views; its only path is the RPC.
--   · The 90-day ceiling holds at the TABLE, not only in the RPC: a direct
--     PostgREST insert that skips `create_audience_view` cannot mint a link
--     that outlives it.
--   · The owner can LIST every link issued for their setlist, including one an
--     editor minted — the query behind the revocation control.
--
-- Run: supabase db reset, then
--   docker exec -i supabase_db_cemurm psql -U postgres -d postgres -X \
--     -v ON_ERROR_STOP=1 -f - < scripts/smoke/0049-audience-view.sql
-- Expects 40 PASS / 0 FAIL.
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
-- The seed gives songs 001/002 no versions at all (seed.sql:199), so the duration
-- assertions need their own. Two versions on Way Maker let the smoke prove the
-- pinned-version preference AND the latest-version fallback.
insert into song_versions (id, song_id, name, number, base_key, base_tempo,
                           duration_seconds, is_ready, owner_id, created_by) values
  ('30000900-0000-4000-8000-000000000001', '20000000-0000-0000-0000-000000000001',
   'Original', 1, 'G', 72, 240, true,
   '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('30000900-0000-4000-8000-000000000002', '20000000-0000-0000-0000-000000000001',
   'Live arrangement', 2, 'G', 68, 999, true,
   '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('30000900-0000-4000-8000-000000000003', '20000000-0000-0000-0000-000000000002',
   'Original', 1, 'C', 66, 300, true,
   '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001')
  on conflict do nothing;

-- Second demo-owned setlist holding a DIFFERENT song: the cross-setlist leak canary.
insert into setlists (id, org_id, branch_id, owner_id, name, visibility) values
  ('30000900-0000-4000-8000-0000000000a1', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000001',
   'Other Setlist', 'private')
  on conflict do nothing;

insert into setlist_items (id, setlist_id, song_id, position) values
  ('30000900-0000-4000-8000-0000000000b1', '30000900-0000-4000-8000-0000000000a1',
   '20000000-0000-0000-0000-000000000004', 1)
  on conflict do nothing;

-- ══════════════ ISSUING A TOKEN ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001"}', false);

select public.create_audience_view('30000000-0000-0000-0000-000000000001', 7) as tok_a \gset
select public.create_audience_view('30000900-0000-4000-8000-0000000000a1', 7) as tok_b \gset

select tmp_assert('1. owner issues a 32-char token', length(:'tok_a') = 32);
select tmp_assert('2. token expires 7 days out', (
  select expires_at between now() + interval '6 days 23 hours'
                        and now() + interval '7 days 1 hour'
  from public.audience_views where token = :'tok_a'
));
select tmp_assert('3. second setlist gets its own token', length(:'tok_b') = 32 and :'tok_b' <> :'tok_a');

select tmp_expect_error('4. expiry ceiling rejects 91 days',
  $$select public.create_audience_view('30000000-0000-0000-0000-000000000001', 91)$$,
  'Audience link expiry must be between 1 and 90 days%');
select tmp_expect_error('5. expiry floor rejects 0 days',
  $$select public.create_audience_view('30000000-0000-0000-0000-000000000001', 0)$$,
  'Audience link expiry must be between 1 and 90 days%');

-- isolation (...0002) is an ACCEPTED VIEW-ONLY collaborator on the demo setlist.
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002"}', false);
select tmp_expect_error('6. view-only collaborator cannot publish to the audience',
  $$select public.create_audience_view('30000000-0000-0000-0000-000000000001')$$,
  'Only the owner or an editing collaborator%');

-- outsider (...0003) holds a PENDING invite (accepted_at IS NULL).
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003"}', false);
select tmp_expect_error('7. pending invitee cannot publish to the audience',
  $$select public.create_audience_view('30000000-0000-0000-0000-000000000001')$$,
  'Only the owner or an editing collaborator%');

-- anon holds no EXECUTE grant on the issuing function at all.
select set_config('role', 'anon', false);
select set_config('request.jwt.claims', '{}', false);
select tmp_expect_error('8. anon cannot execute the issuing RPC',
  $$select public.create_audience_view('30000000-0000-0000-0000-000000000001')$$,
  '%permission denied for function create_audience_view%');

-- ══════════════ THE READ PATH (anon, the real audience) ══════════════
select tmp_assert('9. anon reads the setlist name through the token',
  public.get_audience_setlist(:'tok_a')->>'name' = 'Demo Setlist');

select tmp_assert('10. songs are returned in setlist order',
  (select jsonb_agg(e->>'title')
   from jsonb_array_elements(public.get_audience_setlist(:'tok_a')->'songs') e)
  = '["Way Maker", "Oceans (Where Feet May Fail)"]'::jsonb);

select tmp_assert('11. an item with no pinned version falls back to the latest version',
  (public.get_audience_setlist(:'tok_a')->'songs'->0->>'durationSeconds')::int = 999);

select tmp_assert('12. an item with one version gets that duration',
  (public.get_audience_setlist(:'tok_a')->'songs'->1->>'durationSeconds')::int = 300);

-- Pin Way Maker's item to version 1 (240s) while version 2 (999s) stays the latest.
select set_config('role', 'postgres', false);
update public.setlist_items set version_id = '30000900-0000-4000-8000-000000000001'
where id = '30000000-0000-0000-0000-000000000002';
select set_config('role', 'anon', false);

select tmp_assert('13. a pinned version wins over the latest version',
  (public.get_audience_setlist(:'tok_a')->'songs'->0->>'durationSeconds')::int = 240);

select set_config('role', 'postgres', false);
update public.setlist_items set version_id = null
where id = '30000000-0000-0000-0000-000000000002';
select set_config('role', 'anon', false);

-- ── the disclosure slice ──
select tmp_assert('14. the envelope carries exactly id, name and songs', (
  select array_agg(k order by k)
  from jsonb_object_keys(public.get_audience_setlist(:'tok_a')) k
) = array['id', 'name', 'songs']);

select tmp_assert('15. every song carries exactly position, title, artist and durationSeconds', (
  select bool_and(
           (select array_agg(k order by k) from jsonb_object_keys(e) k)
           = array['artist', 'durationSeconds', 'position', 'title'])
  from jsonb_array_elements(public.get_audience_setlist(:'tok_a')->'songs') e
));

select tmp_assert('16. no chart body, agreed key or item note leaks into the envelope',
  not (public.get_audience_setlist(:'tok_a') ?| array['body', 'agreed_key', 'notes', 'chart', 'owner_id']));

-- ── token scoping ──
select tmp_assert('17. a token never returns another setlist''s songs',
  public.get_audience_setlist(:'tok_a')::text not like '%Amazing Grace%');

select tmp_assert('18. the second token returns only its own setlist',
  (select jsonb_agg(e->>'title')
   from jsonb_array_elements(public.get_audience_setlist(:'tok_b')->'songs') e)
  = '["Amazing Grace"]'::jsonb);

-- ── the four indistinguishable failures ──
select tmp_assert('19. an unknown token returns NULL',
  public.get_audience_setlist(repeat('a', 32)) is null);

select tmp_assert('20. a too-short token returns NULL',
  public.get_audience_setlist('abc') is null);

select set_config('role', 'postgres', false);
insert into public.audience_views (setlist_id, token, expires_at, created_by) values
  ('30000000-0000-0000-0000-000000000001', repeat('f', 32), now() - interval '1 minute',
   '10000000-0000-0000-0000-000000000001')
  on conflict do nothing;
select set_config('role', 'anon', false);

select tmp_assert('21. an expired token returns NULL',
  public.get_audience_setlist(repeat('f', 32)) is null);

-- A retired song must still render: 0001:181 keeps past setlists readable.
select set_config('role', 'postgres', false);
update public.songs set is_deleted = true where id = '20000000-0000-0000-0000-000000000002';
select set_config('role', 'anon', false);

select tmp_assert('22. a soft-deleted song still renders in the audience view',
  (select jsonb_array_length(public.get_audience_setlist(:'tok_a')->'songs')) = 2);

select set_config('role', 'postgres', false);
update public.songs set is_deleted = false where id = '20000000-0000-0000-0000-000000000002';

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001"}', false);
delete from public.audience_views where token = :'tok_a';

select set_config('role', 'anon', false);
select tmp_assert('23. a revoked token returns NULL',
  public.get_audience_setlist(:'tok_a') is null);

-- ══════════════ GRANTS AND RLS ══════════════
select tmp_expect_error('24. anon holds no SELECT grant on audience_views',
  $$select count(*) from public.audience_views$$,
  '%permission denied for table audience_views%');

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002"}', false);

select tmp_assert('25. a collaborator cannot see the owner''s token rows',
  (select count(*) from public.audience_views where token = :'tok_b') = 0);

select tmp_expect_error('26. a collaborator cannot mint a token in someone else''s name',
  $$insert into public.audience_views (setlist_id, token, expires_at, created_by)
    values ('30000000-0000-0000-0000-000000000001', repeat('e', 32), now() + interval '1 day',
            '10000000-0000-0000-0000-000000000001')$$,
  '%new row violates row-level security policy%');

with gone as (
  delete from public.audience_views where token = :'tok_b' returning 1
)
select tmp_assert('27. a collaborator cannot delete the owner''s token',
  (select count(*) from gone) = 0);

select set_config('role', 'postgres', false);
select tmp_assert('28. the owner''s token survived the collaborator''s delete attempt',
  exists (select 1 from public.audience_views where token = :'tok_b'));

select tmp_assert('29. no audience_views row outlived the run with a NULL owner', (
  select count(*) from public.audience_views where created_by is null
) = 0);

-- ══════════════ VERIFIER ADDENDUM (independent review, 2026-11-11) ══════════════
-- Assertions 30-37 came out of the independent verification of this slice. 37 is
-- the one that found a real defect: the delete policy was scoped to `created_by`,
-- so an owner could not revoke a link an editor collaborator had issued — and a
-- removed editor's public link would keep serving for up to 90 days with nobody
-- able to turn it off.
set client_min_messages to notice;

select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001"}',false);
select public.create_audience_view('30000000-0000-0000-0000-000000000001', 7) as tok_v \gset
select set_config('role','anon',false);
select set_config('request.jwt.claims','{}',false);

select tmp_assert('30. no key outside the disclosed set, at any depth', (
  select array_agg(distinct k order by k)
  from public.get_audience_setlist(:'tok_v') p,
       lateral jsonb_path_query(p,'$.**') v,
       lateral jsonb_object_keys(case when jsonb_typeof(v)='object' then v else '{}'::jsonb end) k
) = array['artist','durationSeconds','id','name','position','songs','title']);

select tmp_assert('31. exactly one envelope object plus one per song', (
  select count(*) from public.get_audience_setlist(:'tok_v') p, lateral jsonb_path_query(p,'$.**') v
  where jsonb_typeof(v)='object'
) = 1 + jsonb_array_length(public.get_audience_setlist(:'tok_v')->'songs'));

select tmp_assert('32. null/short/16/31/33/uppercase/trailing-space tokens all return NULL', (
  public.get_audience_setlist(null) is null
  and public.get_audience_setlist(repeat('0',15)) is null
  and public.get_audience_setlist(repeat('0',16)) is null
  and public.get_audience_setlist(repeat('0',31)) is null
  and public.get_audience_setlist(repeat('0',33)) is null
  and public.get_audience_setlist(upper(:'tok_v')) is null
  and public.get_audience_setlist(:'tok_v'||' ') is null));

select set_config('role','postgres',false);
insert into public.audience_views (setlist_id, token, expires_at, created_by)
values ('30000000-0000-0000-0000-000000000001', repeat('9',32), now(), '10000000-0000-0000-0000-000000000001')
on conflict do nothing;
select set_config('role','anon',false);

select tmp_assert('33. a token expiring exactly at now() is dead',
  public.get_audience_setlist(repeat('9',32)) is null);

select set_config('role','postgres',false);
update public.setlist_collaborators set can_edit = true, accepted_at = null
 where setlist_id='30000000-0000-0000-0000-000000000001' and user_id='10000000-0000-0000-0000-000000000003';
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000003"}',false);

select tmp_expect_error('34. a pending invitee with can_edit=true cannot publish',
  $$select public.create_audience_view('30000000-0000-0000-0000-000000000001')$$,
  'Only the owner or an editing collaborator%');

select set_config('role','postgres',false);
insert into public.setlists (id, org_id, branch_id, owner_id, name, visibility)
values ('30000900-0000-4000-8000-0000000000c1','10000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-0000000000b1','10000000-0000-0000-0000-000000000001','Empty Setlist','private')
on conflict do nothing;
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001"}',false);
select public.create_audience_view('30000900-0000-4000-8000-0000000000c1', 7) as tok_e \gset
select set_config('role','anon',false);

select tmp_assert('35. an empty setlist returns songs: []',
  public.get_audience_setlist(:'tok_e')->'songs' = '[]'::jsonb);

select set_config('role','postgres',false);
delete from public.setlists where id='30000900-0000-4000-8000-0000000000c1';
select set_config('role','anon',false);

select tmp_assert('36. deleting the setlist kills its token',
  public.get_audience_setlist(:'tok_e') is null);

-- The defect the independent verification found: an EDITOR issues the token,
-- the OWNER must still be able to revoke it.
select set_config('role','postgres',false);
update public.setlist_collaborators set can_edit = true, accepted_at = now()
 where setlist_id='30000000-0000-0000-0000-000000000001' and user_id='10000000-0000-0000-0000-000000000002';
select set_config('role','authenticated',false);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002"}',false);
select public.create_audience_view('30000000-0000-0000-0000-000000000001', 30) as tok_ed \gset
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001"}',false);
with gone as (delete from public.audience_views where token = :'tok_ed' returning 1)
select tmp_assert('37. the setlist owner can revoke an editor-issued token',
  (select count(*) from gone) = 1);

-- A token inserted directly through PostgREST must still be 32 hex chars.
select tmp_expect_error('38. a guessable short token is rejected by the table',
  $$insert into public.audience_views (setlist_id, token, expires_at, created_by)
    values ('30000000-0000-0000-0000-000000000001', repeat('a',16), now() + interval '1 day',
            '10000000-0000-0000-0000-000000000001')$$,
  '%audience_views_token_format%');

-- B2 (independent review): the RPC's 1..90 window is not the only enforcement
-- point. A client that skips the RPC inserts straight through the policy, so the
-- CEILING has to exist on the table. Without it this insert succeeds and the
-- token serves the setlist to `anon` until 2099 — a link that never expires on a
-- table whose whole model is "expiry enforced on read".
select tmp_expect_error('39. a direct insert cannot outlive the 90-day ceiling',
  $$insert into public.audience_views (setlist_id, token, expires_at, created_by)
    values ('30000000-0000-0000-0000-000000000001', repeat('b',32),
            now() + interval '10 years', '10000000-0000-0000-0000-000000000001')$$,
  '%audience_views_expiry_ceiling%');

-- B3 (independent review): the owner must be able to SEE the links, or the
-- revocation control has no product path. An editor mints one; the owner's own
-- SELECT has to return it — 0049's select policy is scoped to the SETLIST, not
-- to `created_by`, precisely so this row is visible and revocable.
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002"}',false);
select public.create_audience_view('30000000-0000-0000-0000-000000000001', 30) as tok_list \gset
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001"}',false);
select tmp_assert('40. the owner lists the link an editor issued for their setlist',
  (select count(*) from public.audience_views
   where setlist_id = '30000000-0000-0000-0000-000000000001'
     and token = :'tok_list') = 1);
