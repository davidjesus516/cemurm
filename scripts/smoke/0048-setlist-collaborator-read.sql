-- 0048 Setlist collaborator read smoke (local dev only; fresh reset DB, single run).
-- Scope: the migration surface of 0048_setlist_collaborator_read.sql -- the
-- private.is_song_in_readable_setlist helper and the private.setlist_owner_can_read_song
-- helper it delegates to, their EXECUTE grants, the three additive SELECT policies on
-- public.songs, public.song_versions and public.chart_files, and the two new indexes,
-- proven end to end through RLS.
--
-- The gap: an ACCEPTED setlist collaborator from another org reads the setlist and
-- its items but not the songs they point at, so every row renders "(missing song)"
-- and the export serializes to "". isolation (…0002) is exactly that collaborator
-- on the seed's Demo Setlist; outsider (…0003) is a PENDING one (accepted_at NULL)
-- on that setlist and must gain nothing.
--
-- The rule under test: a song in a setlist is readable by an accepted collaborator of
-- that setlist when the setlist's OWNER could already read the song. Three conditions,
-- each with its own attack that it blocks:
--
--   * the caller is an accepted collaborator       -- invitation
--   * the caller is NOT the setlist's owner        -- blocks the self-invite, because
--     setlist_collaborators_insert_owner lets an owner invite THEMSELVES with
--     accepted_at set, manufacturing the first condition on a setlist they created
--   * the owner can read the song                  -- blocks content forgery: the
--     owner vouches for what the setlist contains
--
-- The seed's two shared songs carry no chart_files and no song_versions row, so the
-- chart and version assertions need their own fixtures.
--
-- Five songs, chosen so that each negative control kills a different plausible bug
-- in the helper, and so that no pair of them can be satisfied by a merely plausible
-- policy:
--   * Song A -- demo's org, appended to the Demo Setlist, where isolation IS an
--     accepted collaborator. If the helper forgot `where i.song_id = $2` it would
--     read every song; Song B is what catches that.
--   * Song B -- same org, in NO setlist. Catches a policy that ignores the item
--     entirely (every song readable).
--   * Song C -- same org, in a SECOND demo-owned setlist where isolation is NOT a
--     collaborator but outsider IS accepted. Catches a policy that keeps the
--     `song_id` join and forgets `c.user_id = $1`: without Song C that mutation
--     passes every other assertion in this file.
--   * Song D -- same org, in NO setlist, and the target of the self-invite probe.
--     isolation reaches it by creating its own setlist, inserting it and accepting
--     its own invitation -- the exact attack the owner condition blocks.
--   * Song E -- PERSONAL: outsider's own song, org_id IS NULL and source_org_id
--     IS NULL. Catches a vouch that mirrors the PRE-0020 form of
--     songs_select_system (`org_id is null` alone), which would count any user's
--     personal song as system content -- the leak C1 closed.
--
-- And because outsider is accepted on that second setlist while pending on the
-- Demo Setlist, the same fixture proves the gate is the per-setlist invite rather
-- than org membership -- outsider belongs to no org at all.
--
-- And because demo admits THEMSELVES as an accepted collaborator of their own
-- Demo Setlist (the same pre-existing hole the self-invite probe exercises from
-- the other side), the owner's refusal is pinned by `s.owner_id <> $1` ALONE.
--
-- What this file does NOT prove: PDF/MusicXML charts stay unreachable. The charts
-- bucket is private with owner-folder RLS and 1-hour signed URLs, so a collaborator
-- sees the chart_files row and still cannot download the object. Named finding.
-- It is not pinned here either: a plain DELETE on storage.objects is refused
-- by storage.protect_delete unless the session sets
-- storage.allow_delete_query = 'true', so the smoke would have to opt into
-- that escape hatch to clean up after itself; and pinning a limitation is the
-- wrong kind of test, because the day somebody deliberately fixes cross-org
-- PDF access the suite would fail with a security-sounding message. The
-- independent verifier measured it -- chart_files row visible, storage object
-- NOT -- and the residual is stated in the capability specs and the ODD record.
--
-- Contract reads run under role postgres (RLS would filter them otherwise).
-- Role switches use `select set_config(...)`; bare calls are not valid top-level
-- statements. Fixtures are FIXED literals (gen_random_uuid() would not cross role
-- switches) in the 30000…900-970 and 30000…000-033 ranges, clear of the seed's
-- 30000000-… setlist family and of the 6xx/7xx/8xx/9a/9b/9c fixtures owned by
-- earlier smokes.
-- expects 15 PASS / 0 FAIL -- fourteen contract assertions plus the fixture tidy
-- check, which 0046 also counts (it states 14 and carries 14 notices). If you
-- change the count, change it in odd/tasks/acl-setlist-collaborator-read.md as
-- well: the two must not drift.
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

-- ══════════════ FIXTURES (role postgres) ══════════════
select set_config('role','postgres',false);

-- Song A: demo's org and branch, created by demo, appended to the Demo Setlist.
insert into public.songs (id, org_id, branch_id, title, artist, created_by) values
  ('30000900-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1',
   'Smoke Shared Song', 'Smoke Band',
   '10000000-0000-0000-0000-000000000001');

-- Song B: same org and branch, same creator, and deliberately in NO setlist.
insert into public.songs (id, org_id, branch_id, title, artist, created_by) values
  ('30000930-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1',
   'Smoke Unshared Song', 'Smoke Band',
   '10000000-0000-0000-0000-000000000001');

-- Inline ChordPro chart: content carries the payload, object_key is blank.
insert into public.chart_files (id, song_id, format, object_key, content, size_bytes) values
  ('30000910-0000-0000-0000-000000000001',
   '30000900-0000-0000-0000-000000000001',
   'chordpro', '', '[D]Smoke inline [A]chordpro content', 36);

insert into public.song_versions
  (id, song_id, name, number, chart_file_id, base_key, owner_id, created_by) values
  ('30000920-0000-0000-0000-000000000001',
   '30000900-0000-0000-0000-000000000001',
   'Smoke Arrangement', 1, '30000910-0000-0000-0000-000000000001', 'D major',
   '10000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001');

-- Positions 1 and 2 are the seed's; 3 is free under UNIQUE (setlist_id, position).
insert into public.setlist_items (id, setlist_id, song_id, version_id, position, agreed_key) values
  ('30000940-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001',
   '30000900-0000-0000-0000-000000000001',
   '30000920-0000-0000-0000-000000000001',
   3, 'D');

-- A second demo-owned setlist that isolation was never invited to, holding Song C.
-- outsider is the accepted collaborator here -- and nobody there -- so the pair
-- (Song C invisible to isolation, visible to outsider) pins the predicate on
-- `c.user_id = $1` and on `accepted_at is not null` per setlist, not per user.
insert into public.setlists (id, org_id, branch_id, owner_id, name, visibility) values
  ('30000950-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1',
   '10000000-0000-0000-0000-000000000001',
   'Smoke Other Setlist', 'shared');

insert into public.songs (id, org_id, branch_id, title, artist, created_by) values
  ('30000960-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1',
   'Smoke Other Setlist Song', 'Smoke Band',
   '10000000-0000-0000-0000-000000000001');

insert into public.setlist_items (id, setlist_id, song_id, position, agreed_key) values
  ('30000970-0000-0000-0000-000000000001',
   '30000950-0000-0000-0000-000000000001',
   '30000960-0000-0000-0000-000000000001',
   1, 'A');

insert into public.setlist_collaborators (setlist_id, user_id, can_edit, accepted_at) values
  ('30000950-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000003',
   false, now());

-- Song D: demo's org, in no setlist. The self-invite probe tries to reach it.
insert into public.songs (id, org_id, branch_id, title, artist, created_by) values
  ('30001000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1',
   'Smoke Self Invite Target', 'Smoke Band',
   '10000000-0000-0000-0000-000000000001');

insert into public.chart_files (id, song_id, format, object_key, content, size_bytes) values
  ('30001001-0000-0000-0000-000000000001',
   '30001000-0000-0000-0000-000000000001',
   'chordpro', '', '[D]Smoke self invite [A]target', 29);

insert into public.song_versions
  (id, song_id, name, number, chart_file_id, base_key, owner_id, created_by) values
  ('30001002-0000-0000-0000-000000000001',
   '30001000-0000-0000-0000-000000000001',
   'Smoke Arrangement', 1, '30001001-0000-0000-0000-000000000001', 'D major',
   '10000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001');

-- A demo-owned setlist where isolation is an accepted collaborator WITH edit
-- rights, so it can insert a song into it -- the editor-forgery probe.
insert into public.setlists (id, org_id, branch_id, owner_id, name, visibility) values
  ('30001010-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1',
   '10000000-0000-0000-0000-000000000001',
   'Smoke Editor Setlist', 'shared');

insert into public.setlist_collaborators (setlist_id, user_id, can_edit, accepted_at) values
  ('30001010-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000002',
   true, now());

-- Song E: a PERSONAL song -- org_id IS NULL and source_org_id IS NULL, i.e. it
-- belongs to no org at all and only to whoever created it. outsider is in no org
-- either, so this is exactly the shape the 0020 fix reserved: the LIVE
-- songs_select_system asks for `org_id is null and source_org_id is not null`, so
-- a personal song is NOT system content and NOT everybody's. The pre-0020 form
-- (`org_id is null` alone) is the leak C1 closed, and the vouch must not
-- reintroduce it.
insert into public.songs (id, org_id, branch_id, title, artist, created_by) values
  ('30001030-0000-0000-0000-000000000001',
   null, null,
   'Smoke Personal Song', 'Smoke Soloist',
   '10000000-0000-0000-0000-000000000003');

insert into public.chart_files (id, song_id, format, object_key, content, size_bytes) values
  ('30001031-0000-0000-0000-000000000001',
   '30001030-0000-0000-0000-000000000001',
   'chordpro', '', '[D]Smoke personal [A]song', 25);

insert into public.song_versions
  (id, song_id, name, number, chart_file_id, base_key, owner_id, created_by) values
  ('30001033-0000-0000-0000-000000000001',
   '30001030-0000-0000-0000-000000000001',
   'Smoke Personal Arrangement', 1, '30001031-0000-0000-0000-000000000001', 'D major',
   '10000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000003');

-- ══════════════ 1. THE BUG: accepted collaborator reads the shared song ══════════════
select set_config('role','authenticated',false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',false);

select tmp_assert(
  '0048 accepted setlist collaborator reads the shared song title',
  (select count(*) = 1 from public.songs
    where id = '30000900-0000-0000-0000-000000000001'
      and title = 'Smoke Shared Song')
);

select tmp_assert(
  '0048 accepted setlist collaborator reads the chart_files row, inline content included',
  (select count(*) = 1 from public.chart_files
    where id = '30000910-0000-0000-0000-000000000001'
      and content is not null)
);

select tmp_assert(
  '0048 accepted setlist collaborator reads the song_versions row',
  (select count(*) = 1 from public.song_versions
    where id = '30000920-0000-0000-0000-000000000001')
);

-- ══════════════ 2. THE SCOPE CONTROL: membership of a setlist, nothing wider ══════════════
select tmp_assert(
  '0048 collaborator reads 0 rows of the org song that is in no setlist',
  (select count(*) = 0 from public.songs
    where id = '30000930-0000-0000-0000-000000000001')
);

-- The second control, and the one that matters most: Song C sits in a setlist demo
-- owns, in demo's org, with an accepted collaborator -- but that collaborator is not
-- isolation. A helper that keeps `where i.song_id = $2` and forgets `c.user_id = $1`
-- passes every other assertion in this file and fails only here.
select tmp_assert(
  '0048 collaborator reads 0 rows of a song in a setlist they were not invited to',
  (select count(*) = 0 from public.songs
    where id = '30000960-0000-0000-0000-000000000001')
);

-- ══════════════ 3. A PENDING COLLABORATOR GAINS NOTHING ══════════════
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',false);

select tmp_assert(
  '0048 pending collaborator (accepted_at IS NULL) reads neither the song nor its chart',
  (select count(*) = 0 from public.songs
    where id = '30000900-0000-0000-0000-000000000001')
  and (select count(*) = 0 from public.chart_files
    where id = '30000910-0000-0000-0000-000000000001')
);

-- The same user, on a setlist where the invite WAS accepted, reads that setlist's
-- song -- and belongs to no org at all. Together with the assertion above this pins
-- the predicate on the per-setlist invite rather than on org membership or on the
-- user's history.
select tmp_assert(
  '0048 collaborator accepted on another setlist reads that song, org membership irrelevant',
  (select count(*) = 1 from public.songs
    where id = '30000960-0000-0000-0000-000000000001'
      and title = 'Smoke Other Setlist Song')
);

-- ══════════════ 4. THE HELPER IS NOT AN ORACLE ══════════════
-- Both calls are made by isolation, and both ask about somebody else.
--
-- The first one is the load-bearing one: outsider IS an accepted collaborator on the
-- second setlist, and Song C IS in it. The ONLY reason the answer is false is the
-- `$1 = (select auth.uid())` guard. Asking about demo instead would be false for
-- an unrelated reason, and the guard would go untested -- so demo gets its own
-- assertion below, pinned by a DIFFERENT condition.
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',false);

select tmp_assert(
  '0048 helper refuses a foreign user_id that IS an accepted collaborator',
  (select private.is_song_in_readable_setlist(
     '10000000-0000-0000-0000-000000000003'::uuid,
     '30000960-0000-0000-0000-000000000001'::uuid) is false)
);

-- ══════════════ 4b. THE OWNER CONDITION, PINNED ON ITS OWN ══════════════
-- demo owns the Demo Setlist, so `setlist_collaborators_insert_owner` (0002) --
-- whose WITH CHECK is only `session_owns_setlist(setlist_id)`, with no constraint
-- on `user_id` -- lets demo admit THEMSELVES as an accepted collaborator. This
-- insert is that hole, exercised for real, and it is admitted by the pre-existing
-- policy rather than forced by postgres.
--
-- With that row in place, demo now satisfies EVERY condition of the helper:
-- the song is in the setlist, the caller is an accepted collaborator, the
-- invitation is accepted, the owner_id is not null, the tenancy guard matches
-- (the call is made BY demo), and the vouch holds (demo can read Song A -- it
-- is demo's own org). The ONLY thing left denying the call is
-- `s.owner_id <> $1`.
--
-- That is what makes the next assertion a real pin: remove the owner condition
-- and it fails. It does NOT make the owner condition the thing that closes the
-- attack -- the owner-vouches condition is, and the self-invite probe below proves
-- that by failing on its own when the vouch is removed. The owner condition says
-- what the helper's contract means: reading what you shared is the owner's
-- pre-existing business, not this policy's.
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

insert into public.setlist_collaborators (setlist_id, user_id, can_edit, accepted_at) values
  ('30000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   false, now());

-- And the setlist's own owner is refused as well: reading what you shared is the
-- owner's pre-existing business, not this policy's.
select tmp_assert(
  '0048 helper refuses the setlist owner',
  (select private.is_song_in_readable_setlist(
     '10000000-0000-0000-0000-000000000001'::uuid,
     '30000900-0000-0000-0000-000000000001'::uuid) is false)
);

-- ══════════════ 5. THE SELF-INVITE ATTACK ══════════════
-- isolation creates its own setlist, puts a demo-org song into it, and accepts its
-- own invitation. Every one of those writes is allowed by the pre-existing policies:
-- setlists_insert_owner checks only owner_id, setlist_items_insert_member admits
-- the owner, and setlist_collaborators_insert_owner admits the owner inserting a
-- collaborator row -- including one for themselves, with accepted_at set.
--
-- This is the attack that a collaborator-only helper does NOT stop. It must read
-- zero rows of the song.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',false);

insert into public.setlists (id, org_id, branch_id, owner_id, name, visibility) values
  ('30001020-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-0000000000a2',
   null,
   '10000000-0000-0000-0000-000000000002',
   'Smoke Self Invite Setlist', 'shared');

insert into public.setlist_items (id, setlist_id, song_id, position, agreed_key) values
  ('30001021-0000-0000-0000-000000000001',
   '30001020-0000-0000-0000-000000000001',
   '30001000-0000-0000-0000-000000000001',
   1, 'D');

insert into public.setlist_collaborators (setlist_id, user_id, can_edit, accepted_at) values
  ('30001020-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000002',
   false, now());

select tmp_assert(
  '0048 self-invite does NOT grant read of a foreign song',
  (select count(*) = 0 from public.songs
    where id = '30001000-0000-0000-0000-000000000001')
);

-- ══════════════ 6. THE OWNER VOUCHES FOR THE CONTENT ══════════════
-- isolation can edit the third setlist, so it can insert any song into it -- the
-- editor-forgery path. The song used here is isolation's OWN (Isolation Anthem),
-- which isolation can read anyway through her org membership, so the visible row
-- count would prove nothing: what matters is the helper's ANSWER. The setlist's
-- owner is demo, who cannot read a song from another org -- so the helper must
-- refuse it, and a shared setlist never carries what its owner could not read.
select set_config('role','authenticated',false);
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',false);

insert into public.setlist_items (id, setlist_id, song_id, position, agreed_key) values
  ('30001022-0000-0000-0000-000000000001',
   '30001010-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000003',
   1, 'A');

select tmp_assert(
  '0048 an editor cannot share a song the setlist owner cannot read',
  (select private.is_song_in_readable_setlist(
     '10000000-0000-0000-0000-000000000002'::uuid,
     '20000000-0000-0000-0000-000000000003'::uuid) is false)
);

-- The PERSONAL-song case, and the one that decides whether the vouch is honest.
-- isolation inserts the UUID of a song she cannot read -- outsider's personal
-- song, Song E -- into the same setlist she can edit. The insert is allowed:
-- setlist_items_insert_member checks only that the caller can edit, never that
-- the caller can read the song. The READ must not follow.
--
-- It does not, because the setlist's owner (demo) cannot read Song E either:
-- outsider created it, it carries no org, and it is not in the public library.
-- The owner's vouch fails, so nobody gains it -- which is the whole point of the
-- rule. A vouch written as `org_id is null` would call Song E system content
-- (the pre-0020 form of songs_select_system) and hand it over.
insert into public.setlist_items (id, setlist_id, song_id, position, agreed_key) values
  ('30001032-0000-0000-0000-000000000001',
   '30001010-0000-0000-0000-000000000001',
   '30001030-0000-0000-0000-000000000001',
   2, 'D');

select tmp_assert(
  '0048 an editor cannot share another user''s personal song through the setlist',
  (select count(*) = 0 from public.songs
    where id = '30001030-0000-0000-0000-000000000001')
  and (select count(*) = 0 from public.chart_files
    where id = '30001031-0000-0000-0000-000000000001')
  and (select count(*) = 0 from public.song_versions
    where id = '30001033-0000-0000-0000-000000000001')
);

-- And the reason, seen from the other side: the setlist's OWNER cannot read the
-- personal song either, so the vouch is unsatisfiable. This is also the C1 leak
-- staying shut -- a personal song is its creator's, not the system's.
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

select tmp_assert(
  '0048 the setlist owner cannot read another user''s personal song either',
  (select count(*) = 0 from public.songs
    where id = '30001030-0000-0000-0000-000000000001')
  and (select count(*) = 0 from public.chart_files
    where id = '30001031-0000-0000-0000-000000000001')
);

-- ══════════════ 7. NON-REGRESSION: the owner still reads its own song ══════════════
select set_config('request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',false);

select tmp_assert(
  '0048 owner still reads the song, its chart and its version',
  (select count(*) = 1 from public.songs
    where id = '30000900-0000-0000-0000-000000000001')
  and (select count(*) = 1 from public.chart_files
    where id = '30000910-0000-0000-0000-000000000001')
  and (select count(*) = 1 from public.song_versions
    where id = '30000920-0000-0000-0000-000000000001')
);

-- ══════════════ 8. CLEANUP ══════════════
select set_config('role','postgres',false);

delete from public.setlist_items
 where id in ('30000940-0000-0000-0000-000000000001',
              '30000970-0000-0000-0000-000000000001',
              '30001021-0000-0000-0000-000000000001',
              '30001022-0000-0000-0000-000000000001',
              '30001032-0000-0000-0000-000000000001');
delete from public.setlist_collaborators
 where (setlist_id = '30000950-0000-0000-0000-000000000001')
    or (setlist_id = '30001010-0000-0000-0000-000000000001')
    or (setlist_id = '30001020-0000-0000-0000-000000000001');
-- The owner-self-invite row lives on the SEED's Demo Setlist, so it is removed by
-- user_id as well: isolation's and outsider's seed rows on that setlist are the
-- seed's, not this file's, and they must survive.
delete from public.setlist_collaborators
 where setlist_id = '30000000-0000-0000-0000-000000000001'
   and user_id = '10000000-0000-0000-0000-000000000001';
delete from public.song_versions
 where id in ('30000920-0000-0000-0000-000000000001',
              '30001002-0000-0000-0000-000000000001',
              '30001033-0000-0000-0000-000000000001');
delete from public.chart_files
 where id in ('30000910-0000-0000-0000-000000000001',
              '30001001-0000-0000-0000-000000000001',
              '30001031-0000-0000-0000-000000000001');
delete from public.songs
 where id in ('30000900-0000-0000-0000-000000000001',
              '30000930-0000-0000-0000-000000000001',
              '30000960-0000-0000-0000-000000000001',
              '30001000-0000-0000-0000-000000000001',
              '30001030-0000-0000-0000-000000000001');
delete from public.setlists
 where id in ('30000950-0000-0000-0000-000000000001',
              '30001010-0000-0000-0000-000000000001',
              '30001020-0000-0000-0000-000000000001');

select tmp_assert(
  '0048 fixture tidy: items, invites, versions, charts, songs and setlists removed',
  not exists (select 1 from public.setlist_items
               where id in ('30000940-0000-0000-0000-000000000001',
                            '30000970-0000-0000-0000-000000000001',
                            '30001021-0000-0000-0000-000000000001',
                            '30001022-0000-0000-0000-000000000001',
                            '30001032-0000-0000-0000-000000000001'))
  and not exists (select 1 from public.setlist_collaborators
                   where setlist_id in ('30000950-0000-0000-0000-000000000001',
                                        '30001010-0000-0000-0000-000000000001',
                                        '30001020-0000-0000-0000-000000000001'))
  and not exists (select 1 from public.setlist_collaborators
                   where setlist_id = '30000000-0000-0000-0000-000000000001'
                     and user_id = '10000000-0000-0000-0000-000000000001')
  and not exists (select 1 from public.song_versions
                   where id in ('30000920-0000-0000-0000-000000000001',
                                '30001002-0000-0000-0000-000000000001',
                                '30001033-0000-0000-0000-000000000001'))
  and not exists (select 1 from public.chart_files
                   where id in ('30000910-0000-0000-0000-000000000001',
                                '30001001-0000-0000-0000-000000000001',
                                '30001031-0000-0000-0000-000000000001'))
  and not exists (select 1 from public.songs
                   where id in ('30000900-0000-0000-0000-000000000001',
                                '30000930-0000-0000-0000-000000000001',
                                '30000960-0000-0000-0000-000000000001',
                                '30001000-0000-0000-0000-000000000001',
                                '30001030-0000-0000-0000-000000000001'))
  and not exists (select 1 from public.setlists
                   where id in ('30000950-0000-0000-0000-000000000001',
                                '30001010-0000-0000-0000-000000000001',
                                '30001020-0000-0000-0000-000000000001'))
);

reset role;
