-- 0047 setlist share-link smoke (local dev only; fresh reset DB, single run,
-- not idempotent).
--
-- Scope under test (features/export-and-sharing.feature:55-67):
--   * only the setlist owner can mint a link, and every link expires 7 days
--     after creation (the client never supplies expires_at);
--   * redeeming a view-only link grants an accepted, read-only collaborator —
--     and after that the setlist is readable through the ordinary RLS path,
--     not through a bypass;
--   * redeeming an edit link grants can_edit;
--   * redeeming is idempotent and never downgrades edit access;
--   * expired, revoked and unknown tokens are refused with ONE identical
--     message, so a dead link cannot be told apart from a guessed one;
--   * non-owners cannot read the link rows or delete them; the owner can
--     revoke by delete, and a revoked link stops working.
--
-- Run: supabase db reset, then
--   docker exec -i supabase_db_cemurm psql -U postgres -d postgres -X \
--     -v ON_ERROR_STOP=1 -f - < scripts/smoke/0047-setlist-share-links.sql
-- Expects 21 PASS / 0 FAIL.
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
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('60000000-0000-0000-0000-000000000471', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 's47.owner@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000471', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"S47","lastName":"Owner","displayName":"S47 Owner"}', now(), now()),
  ('60000000-0000-0000-0000-000000000472', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 's47.friend@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000472', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"S47","lastName":"Friend","displayName":"S47 Friend"}', now(), now()),
  ('60000000-0000-0000-0000-000000000473', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 's47.stranger@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000473', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"S47","lastName":"Stranger","displayName":"S47 Stranger"}', now(), now())
  on conflict do nothing;

update profiles set username = 's47owner', display_name = 'S47 Owner', instrument = 'keys'
  where id = '60000000-0000-0000-0000-000000000471';
update profiles set username = 's47friend', display_name = 'S47 Friend', instrument = 'bass'
  where id = '60000000-0000-0000-0000-000000000472';
update profiles set username = 's47stranger', display_name = 'S47 Stranger', instrument = 'drums'
  where id = '60000000-0000-0000-0000-000000000473';

insert into public.setlists (id, owner_id, name, visibility)
values ('30000000-0000-0000-0000-000000000471',
        '60000000-0000-0000-0000-000000000471', 'Smoke share set', 'private')
  on conflict do nothing;

select set_config('role', 'postgres', false);
select tmp_assert('pre1 owner has no collaborator rows yet',
  (select count(*) = 0 from public.setlist_collaborators
    where setlist_id = '30000000-0000-0000-0000-000000000471'));

-- ══════════════ T1 owner mints a view-only link; expiry is the server's ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000471","role":"authenticated"}', false);
select share_token as view_token, share_permission as view_perm,
       share_expires_at as view_exp
from public.create_setlist_share_link('30000000-0000-0000-0000-000000000471', 'view')
\gset

select tmp_assert('1 owner mints a view link with permission view',
  (:'view_perm' = 'view'));
select tmp_assert('2 expiry is 7 days after creation, not a client value',
  ((:'view_exp'::timestamptz - now()) between interval '6 days 23 hours'
                                            and interval '7 days 1 hour'));
select set_config('role', 'postgres', false);
select tmp_assert('3 the row stores exactly 7 days and is not revoked yet',
  (select expires_at - created_at = interval '7 days' and revoked_at is null
     from public.setlist_share_links where token = :'view_token'));

-- ══════════════ T2 the client cannot mint or edit its own capability ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000471","role":"authenticated"}', false);
select tmp_expect_error('4 permission is validated, not free text',
  'select * from public.create_setlist_share_link(''30000000-0000-0000-0000-000000000471'', ''owner'')',
  'A share link is either view-only or can edit.');
select tmp_expect_error('5 direct INSERT into the link table is not permitted',
  'insert into public.setlist_share_links (setlist_id, permission, created_by, expires_at)
   values (''30000000-0000-0000-0000-000000000471'', ''edit'',
           ''60000000-0000-0000-0000-000000000471'', now() + interval ''100 years'')',
  '%permission denied%');

select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000472","role":"authenticated"}', false);
select tmp_expect_error('6 a non-owner cannot mint a link',
  'select * from public.create_setlist_share_link(''30000000-0000-0000-0000-000000000471'', ''view'')',
  'Only the setlist owner can create a share link.');

-- ══════════════ T3 the token is not enumerable ══════════════
select tmp_assert('7 a stranger reads zero link rows (RLS)',
  (select count(*) = 0 from public.setlist_share_links));

-- ══════════════ T4 redeeming grants an accepted view-only collaborator ══════════════
select public.redeem_setlist_share(:'view_token') as r_setlist, permission as r_perm
\gset
select tmp_assert('8 redeem returns the setlist and its permission',
  (:'r_setlist' = '30000000-0000-0000-0000-000000000471' and :'r_perm' = 'view'));

select set_config('role', 'postgres', false);
select tmp_assert('9 redeem created an ACCEPTED, read-only collaborator row',
  (select can_edit = false and accepted_at is not null
     from public.setlist_collaborators
    where setlist_id = '30000000-0000-0000-0000-000000000471'
      and user_id = '60000000-0000-0000-0000-000000000472'));

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000472","role":"authenticated"}', false);
select tmp_assert('10 after redeeming, the setlist is readable through the ordinary RLS path',
  (select count(*) = 1 from public.setlists
    where id = '30000000-0000-0000-0000-000000000471'));

select public.redeem_setlist_share(:'view_token');
select set_config('role', 'postgres', false);
select tmp_assert('11 redeeming twice still leaves one collaborator row',
  (select count(*) = 1 from public.setlist_collaborators
    where setlist_id = '30000000-0000-0000-0000-000000000471'
      and user_id = '60000000-0000-0000-0000-000000000472'));

-- ══════════════ T5 an edit link grants edit, and never downgrades ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000471","role":"authenticated"}', false);
select share_token as edit_token, share_permission as edit_perm
from public.create_setlist_share_link('30000000-0000-0000-0000-000000000471', 'edit')
\gset

select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000473","role":"authenticated"}', false);
select public.redeem_setlist_share(:'edit_token');

select set_config('role', 'postgres', false);
select tmp_assert('12 the edit link grants can_edit = true',
  (select can_edit from public.setlist_collaborators
    where setlist_id = '30000000-0000-0000-0000-000000000471'
      and user_id = '60000000-0000-0000-0000-000000000473'));

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000473","role":"authenticated"}', false);
select public.redeem_setlist_share(:'view_token');
select set_config('role', 'postgres', false);
select tmp_assert('13 redeeming a view link afterwards does NOT downgrade the editor',
  (select can_edit from public.setlist_collaborators
    where setlist_id = '30000000-0000-0000-0000-000000000471'
      and user_id = '60000000-0000-0000-0000-000000000473'));

-- ══════════════ T6 the owner opening their own link adds no collaborator ══════════════
select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000471","role":"authenticated"}', false);
select public.redeem_setlist_share(:'view_token');
select set_config('role', 'postgres', false);
select tmp_assert('14 owner redeeming own link creates no owner collaborator row',
  (select count(*) = 0 from public.setlist_collaborators
    where setlist_id = '30000000-0000-0000-0000-000000000471'
      and user_id = '60000000-0000-0000-0000-000000000471'));

-- ══════════════ T7 expired, revoked and unknown tokens share ONE message ══════════════
update public.setlist_share_links set expires_at = now() - interval '1 second'
 where token = :'view_token';

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000473","role":"authenticated"}', false);
select tmp_expect_error('15 an expired token is refused',
  format('select public.redeem_setlist_share(%L)', :'view_token'),
  'This share link is invalid or has expired.');

select set_config('role', 'postgres', false);
update public.setlist_share_links set revoked_at = now()
 where token = :'edit_token';

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000472","role":"authenticated"}', false);
select tmp_expect_error('16 a revoked token is refused with the same literal',
  format('select public.redeem_setlist_share(%L)', :'edit_token'),
  'This share link is invalid or has expired.');

select tmp_expect_error('17 an unknown token is refused with the same literal',
  'select public.redeem_setlist_share(''00000000-0000-0000-0000-000000000bad'')',
  'This share link is invalid or has expired.');

select set_config('request.jwt.claims', '', false);
select tmp_expect_error('18 redeem requires a session',
  'select public.redeem_setlist_share(''00000000-0000-0000-0000-000000000bad'')',
  'Not authenticated.');

-- ══════════════ T8 only the owner can revoke, and revocation sticks ══════════════
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000472","role":"authenticated"}', false);
delete from public.setlist_share_links where token = :'edit_token';

select set_config('role', 'postgres', false);
select tmp_assert('19 a non-owner delete removed nothing (RLS)',
  (select count(*) = 1 from public.setlist_share_links where token = :'edit_token'));

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000471","role":"authenticated"}', false);
delete from public.setlist_share_links where token = :'edit_token';

select set_config('role', 'postgres', false);
select tmp_assert('20 the owner revoked the link by delete',
  (select count(*) = 0 from public.setlist_share_links where token = :'edit_token'));

select set_config('role', 'authenticated', false);
select set_config('request.jwt.claims',
  '{"sub":"60000000-0000-0000-0000-000000000473","role":"authenticated"}', false);
select tmp_expect_error('21 a deleted token no longer redeems',
  format('select public.redeem_setlist_share(%L)', :'edit_token'),
  'This share link is invalid or has expired.');

-- summary
select set_config('role', 'postgres', false);
select
  (select count(*) from public.setlist_share_links) as links_left,
  (select count(*) from public.setlist_collaborators
    where setlist_id = '30000000-0000-0000-0000-000000000471') as collab_rows;
