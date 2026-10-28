-- CEMURM demo seed (dev-only; runs via `supabase db reset` as postgres, never via db push).
-- Idempotent: every insert ends with ON CONFLICT DO NOTHING, so re-running the seed
-- against an existing DB is safe (no duplicates, no errors). Random values (now(),
-- crypt salts) are left untouched on a second run because the conflicting rows are skipped.
-- Deterministic UUIDs per design D8: users …0001/…0002, orgs …00a1/…00a2, branch …00b1;
-- every other row reuses the same 10000000-… pattern with a per-table suffix family so
-- reset → verify stays repeatable. Columns match supabase/migrations/0001_init.sql exactly
-- (48 tables; role/member_status values follow the enums; no invented tables or columns).

-- ── identities (password grant via GoTrue; email_confirmed_at set so tokens work)
-- Note: GoTrue v2 scans the token/phone columns as plain strings, so they get ''
-- (never NULL) or login fails with "converting NULL to string is unsupported".
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change_token_current, email_change,
                        phone, phone_change, phone_change_token, reauthentication_token,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000001', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Demo","lastName":"User","displayName":"Demo User"}', now(), now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'isolation@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000002', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Isolation","lastName":"User","displayName":"Isolation User"}', now(), now()),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'outsider@cemurm.app',
   crypt('password1234', gen_salt('bf')), now(),
   '', '', '', '', '', '+34910000003', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"firstName":"Outsider","lastName":"User","displayName":"Outsider User"}', now(), now())
  on conflict do nothing;

-- ── profiles (0006 trigger auto-creates a row on every auth.users insert above;
--    usernames give the PR#0 RLS walk deterministic search/identity targets) ──
update profiles set username = 'demo', display_name = 'Demo User', instrument = 'guitar'
  where id = '10000000-0000-0000-0000-000000000001';
update profiles set username = 'isolation', display_name = 'Isolation User'
  where id = '10000000-0000-0000-0000-000000000002';
update profiles set username = 'outsider', display_name = 'Outsider User'
  where id = '10000000-0000-0000-0000-000000000003';

-- ── grandfather of the seeded base (0029 §5) ─────────────────────────────────
-- 0029 backfills pre-existing accounts to a verifiably adult date, but
-- `supabase db reset` applies EVERY migration BEFORE seed.sql runs. So on a
-- clean reset 0029 backfills an empty profiles table, and these three accounts
-- are then born with date_of_birth NULL — which the fail-closed gate (0029 §1)
-- locks, leaving every seeded login stuck at the date-of-birth step.
--
-- Production is unaffected and needs nothing here: there the accounts exist
-- before 0029 runs, so 0029's own backfill reaches them. This block is the
-- local mirror of that same grandfather, not a second code path.
--
-- is_minor is never written. The profiles_minor_flag trigger (0017 lines 48-66)
-- is its only legal writer and fires from this UPDATE.
update profiles set date_of_birth = date '2002-10-10'
  where id in (
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003'
  );

-- ── tenancy: orgs, branch, memberships ──
insert into organizations (id, name, org_type, status) values
  ('10000000-0000-0000-0000-0000000000a1', 'Demo Academy', 'Academy', 'active'),
  ('10000000-0000-0000-0000-0000000000a2', 'Isolation Org', 'Academy', 'active')
  on conflict do nothing;

insert into branches (id, org_id, name, city, status) values
  ('10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000a1', 'Sede Centro', 'Madrid', 'active')
  on conflict do nothing;

-- demo = org_owner in Demo Academy; isolation = org_member in Isolation Org (cross-org isolation proof)
insert into org_memberships (user_id, org_id, branch_id, role, status) values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'org_owner', 'active'),
  ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000a2',
   null, 'org_member', 'active')
  on conflict do nothing;

-- ── repertoire: 2 demo-owned songs + 1 isolation-owned ──
insert into songs (id, org_id, branch_id, title, artist, genre, created_by) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Way Maker', 'Sinach', 'worship',
   '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Oceans (Where Feet May Fail)', 'Hillsong UNITED', 'worship',
   '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000a2',
   null, 'Isolation Anthem', 'Isolation Band', 'rock',
   '10000000-0000-0000-0000-000000000002')
  on conflict do nothing;

-- ── setlist: demo owner + isolation as accepted view-only collaborator + 2 items ──
insert into setlists (id, org_id, branch_id, owner_id, name, visibility) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000001',
   'Demo Setlist', 'shared')
  on conflict do nothing;

insert into setlist_collaborators (setlist_id, user_id, can_edit, accepted_at) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
   false, now())
  on conflict do nothing;

-- ── band: demo ↔ isolation active pair (0006 pair-scope RLS walk target) ──
insert into bandmate_links (user_id, bandmate_id, status, accepted_at) values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
   'active', now())
  on conflict do nothing;

-- PENDING collaborator for outsider (accepted_at NULL): the RLS 3.1 self-accept walk step
-- (outsider accepts before gaining setlist visibility; comment-42501 probe runs pre-accept).
insert into setlist_collaborators (setlist_id, user_id, can_edit) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
   false)
  on conflict do nothing;

insert into setlist_items (id, setlist_id, song_id, position, agreed_key) values
  ('30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 1, 'G'),
  ('30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000002', 2, 'C')
  on conflict do nothing;

-- ── per-user dev rows (demo) ──
insert into practice_sessions (id, user_id, song_id, instrument, started_at, ended_at) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', 'guitar',
   now() - interval '2 hours', now() - interval '118 minutes')
  on conflict do nothing;

insert into personal_annotations (id, user_id, song_id, anchor, kind, value) values
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001',
   '{"section":"Chorus","index":1}', 'note', 'Ring out the open A; watch the F#m voicing')
  on conflict do nothing;

-- unread notification (read_at NULL)
insert into notifications (id, user_id, category, title, body, payload) values
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
   'setlist', 'Collaborator accepted', 'Isolation User accepted the invite to Demo Setlist.',
   '{"setlist_id":"30000000-0000-0000-0000-000000000001"}')
  on conflict do nothing;

insert into device_configs (id, user_id, device_id) values
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'dev-1')
  on conflict do nothing;

-- outbox: one synced entry correlating the first setlist_item insert
insert into outbox (id, user_id, device_id, entity, entity_id, operation, payload, seq, state, synced_at) values
  ('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'dev-1',
   'setlist_items', '30000000-0000-0000-0000-000000000002', 'insert',
   '{"id":"30000000-0000-0000-0000-000000000002","setlist_id":"30000000-0000-0000-0000-000000000001","song_id":"20000000-0000-0000-0000-000000000001","position":1}'::jsonb,
   1, 'synced', now())
  on conflict do nothing;

-- ── scale catalog ──
insert into scale_catalog (id, name, aliases, intervals, cardinality) values
  ('50000000-0000-0000-0000-000000000001', 'Major', array['Ionian'], '{0,2,4,5,7,9,11}', 7)
  on conflict do nothing;

-- ── gigs: venues, gigs, performances (PR#1a hito-2-remainder) ──
-- Venues/gigs match the spec suggestions ("Café La Luna", "Parque El Retiro");
-- gig …002 is completed WITH a performance so the RLS chain and the "played"
-- demand data (performance_items → songs) are provable from seed rows alone.
insert into venues (id, owner_id, name, location, type) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'Café La Luna', 'Calle Luna 3, Madrid', 'bar'),
  ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   'Parque El Retiro', 'Parque del Retiro, Madrid', 'outdoor')
  on conflict do nothing;

insert into gigs (id, org_id, branch_id, owner_id, name, venue_id, scheduled_at, setlist_id, status) values
  ('61000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000001',
   'Friday Gig', '60000000-0000-0000-0000-000000000001',
   now() + interval '2 days', '30000000-0000-0000-0000-000000000001', 'planned'),
  ('61000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000001',
   'Church Sunday Service', '60000000-0000-0000-0000-000000000002',
   now() - interval '7 days', '30000000-0000-0000-0000-000000000001', 'completed'),
  ('61000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000a2',
   null, '10000000-0000-0000-0000-000000000002',
   'Isolation Gig', null, now() + interval '5 days', null, 'planned')
  on conflict do nothing;

insert into performances (id, gig_id, venue_id, performed_at) values
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002',
   '60000000-0000-0000-0000-000000000002', now() - interval '7 days' + interval '90 minutes')
  on conflict do nothing;

-- Church Sunday Service actually played both setlist songs (version_id NULL:
-- no song_versions rows are seeded). Demand for both songs = 1 performance.
insert into performance_items (id, performance_id, song_id, version_id, state, position) values
  ('63000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', null, 'played', 1),
  ('63000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000002', null, 'played', 2)
  on conflict do nothing;

insert into user_preferences (user_id, transpose_offset, capo, preferences) values
  ('10000000-0000-0000-0000-000000000001', 2, 1, '{}'::jsonb)
  on conflict do nothing;

-- ── public library (S4.1): public-domain corpus + one CC-BY-4.0 contribution ──
-- Deterministic UUID families (S4.1 doc: 3–5 public-domain entries + 1 licensed
-- entry so the license filter is testable). New per-table families, no
-- collision with existing rows:
--   songs:         20000000-… (continues the existing songs family, …004–…008)
--   chart_files:   71000000-… (first chart rows ever seeded)
--   song_versions: 72000000-… (first version rows ever seeded)
--   public_songs:  73000000-… (first public entries ever seeded)
-- The public_songs suffix mirrors its source song's suffix (…004 ↔ …004) so
-- the join is obvious at a glance. Contributor = demo user …0001 for every
-- entry; license_confirmed = true and status = 'live' so the catalog READ path
-- (0010 RLS + view) is exercisable from seed alone. org_id/branch_id NULL =
-- system-level songs (0001 lines 72–73, 84–85). Chart bodies are abbreviated
-- (2 verses / verse+chorus) ChordPro with inline chords + lyric text, so every
-- version computes is_ready = true under both the RPC's key+body contract and
-- the full readiness.js rule (base key + chord line + lyric text).
-- The 'CC-BY-4.0' row stands in for the community-contribution flow (S4.2),
-- where that license is the public_songs table default (0001 line 442).

insert into songs (id, org_id, branch_id, title, artist, genre, created_by) values
  ('20000000-0000-0000-0000-000000000004', null, null, 'Amazing Grace', 'John Newton', 'hymn',
   '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000005', null, null, 'Scarborough Fair', 'Traditional', 'folk',
   '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000006', null, null, 'Oh! Susanna', 'Stephen Foster', 'folk',
   '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000007', null, null, 'Shenandoah', 'Traditional', 'folk',
   '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000008', null, null, 'Down to the River to Pray', 'Traditional', 'gospel',
   '10000000-0000-0000-0000-000000000001')
  on conflict do nothing;

insert into chart_files (id, song_id, format, object_key, content, size_bytes) values
  ('71000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'chordpro',
   'seed/amazing-grace.chordpro',
   $chordpro${title: Amazing Grace}
{artist: John Newton}
{key: G}
{section: Verse 1}
[G]Amazing [D]grace, how [G]sweet the [Em]sound
That [C]saved a [D]wretch like [G]me
[G]I once was [D]lost, but [G]now am [Em]found
Was [C]blind, but [D]now I [G]see
{section: Verse 2}
'Twas [G]grace that [D]taught my [G]heart to [Em]fear
And [C]grace my [D]fears re-[G]lieved
How [G]precious [D]did that [G]grace ap-[Em]pear
The [C]hour I [D]first be-[G]lieved$chordpro$,
   octet_length($chordpro${title: Amazing Grace}
{artist: John Newton}
{key: G}
{section: Verse 1}
[G]Amazing [D]grace, how [G]sweet the [Em]sound
That [C]saved a [D]wretch like [G]me
[G]I once was [D]lost, but [G]now am [Em]found
Was [C]blind, but [D]now I [G]see
{section: Verse 2}
'Twas [G]grace that [D]taught my [G]heart to [Em]fear
And [C]grace my [D]fears re-[G]lieved
How [G]precious [D]did that [G]grace ap-[Em]pear
The [C]hour I [D]first be-[G]lieved$chordpro$)),
  ('71000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'chordpro',
   'seed/scarborough-fair.chordpro',
   $chordpro${title: Scarborough Fair}
{artist: Traditional}
{key: Em}
{section: Verse 1}
[Em]Are you going to [D]Scarborough [Em]Fair
[G]Parsley, [D]sage, rose-[Em]mary and [B7]thyme
[Em]Remember [D]me to one who lives [Em]there
[G]For she once was a [B7]true love of [Em]mine
{section: Verse 2}
[Em]Tell her to [D]make me a [Em]cambric [B7]shirt
[G]Without [D]any [Em]seam or needle[B7]work
[Em]And then she'll [D]be a true [Em]love of [B7]mine
[G]For she once was a [B7]true love of [Em]mine$chordpro$,
   octet_length($chordpro${title: Scarborough Fair}
{artist: Traditional}
{key: Em}
{section: Verse 1}
[Em]Are you going to [D]Scarborough [Em]Fair
[G]Parsley, [D]sage, rose-[Em]mary and [B7]thyme
[Em]Remember [D]me to one who lives [Em]there
[G]For she once was a [B7]true love of [Em]mine
{section: Verse 2}
[Em]Tell her to [D]make me a [Em]cambric [B7]shirt
[G]Without [D]any [Em]seam or needle[B7]work
[Em]And then she'll [D]be a true [Em]love of [B7]mine
[G]For she once was a [B7]true love of [Em]mine$chordpro$)),
  ('71000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', 'chordpro',
   'seed/oh-susanna.chordpro',
   $chordpro${title: Oh! Susanna}
{artist: Stephen Foster}
{key: F}
{section: Verse 1}
[F]I came from Alabama with my [C7]banjo on my [F]knee
I'm [F]going to Louisiana, my [C7]true love for to [F]see
It [F]rained all night the day I left, the [C7]weather it was [F]dry
The [F]sun so hot I froze to death, Su[C7]sanna, don't you [F]cry
{section: Chorus}
Oh, [F]Susanna, oh don't you cry for [C7]me
For I [F]come from Alabama with my [C7]banjo on my [F]knee$chordpro$,
   octet_length($chordpro${title: Oh! Susanna}
{artist: Stephen Foster}
{key: F}
{section: Verse 1}
[F]I came from Alabama with my [C7]banjo on my [F]knee
I'm [F]going to Louisiana, my [C7]true love for to [F]see
It [F]rained all night the day I left, the [C7]weather it was [F]dry
The [F]sun so hot I froze to death, Su[C7]sanna, don't you [F]cry
{section: Chorus}
Oh, [F]Susanna, oh don't you cry for [C7]me
For I [F]come from Alabama with my [C7]banjo on my [F]knee$chordpro$)),
  ('71000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', 'chordpro',
   'seed/shenandoah.chordpro',
   $chordpro${title: Shenandoah}
{artist: Traditional}
{key: F}
{section: Verse 1}
[F]Oh Shenan[C7]doah, I [F]long to [C7]see you
[F]A[C7]way, you rolling [F]river
[F]Oh Shenan[C7]doah, I [F]long to [C7]see you
[F]A[C7]way, I'm bound a[F]way
'Cross the [C7]wide Mis[F]souri
{section: Verse 2}
[F]For seven [C7]years I [F]longed to [C7]see her
[F]A[C7]way, you rolling [F]river
[F]For seven [C7]years I [F]longed to [C7]see her
[F]A[C7]way, I'm bound a[F]way
'Cross the [C7]wide Mis[F]souri$chordpro$,
   octet_length($chordpro${title: Shenandoah}
{artist: Traditional}
{key: F}
{section: Verse 1}
[F]Oh Shenan[C7]doah, I [F]long to [C7]see you
[F]A[C7]way, you rolling [F]river
[F]Oh Shenan[C7]doah, I [F]long to [C7]see you
[F]A[C7]way, I'm bound a[F]way
'Cross the [C7]wide Mis[F]souri
{section: Verse 2}
[F]For seven [C7]years I [F]longed to [C7]see her
[F]A[C7]way, you rolling [F]river
[F]For seven [C7]years I [F]longed to [C7]see her
[F]A[C7]way, I'm bound a[F]way
'Cross the [C7]wide Mis[F]souri$chordpro$)),
  ('71000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008', 'chordpro',
   'seed/down-to-the-river.chordpro',
   $chordpro${title: Down to the River to Pray}
{artist: Traditional}
{key: G}
{section: Verse 1}
[G]As I went down in the [C]river to [G]pray
Studying about that [D]good old [G]way
And who shall wear the [C]starry [G]crown
[G]Good Lord, show me the [D]way
{section: Chorus}
[G]O sisters, let's go [C]down, let's go [G]down
Come on down, [D]come on [G]down
[G]O sisters, let's go [C]down
[G]Down to the [D]river to [G]pray$chordpro$,
   octet_length($chordpro${title: Down to the River to Pray}
{artist: Traditional}
{key: G}
{section: Verse 1}
[G]As I went down in the [C]river to [G]pray
Studying about that [D]good old [G]way
And who shall wear the [C]starry [G]crown
[G]Good Lord, show me the [D]way
{section: Chorus}
[G]O sisters, let's go [C]down, let's go [G]down
Come on down, [D]come on [G]down
[G]O sisters, let's go [C]down
[G]Down to the [D]river to [G]pray$chordpro$))
  on conflict do nothing;

insert into song_versions (id, song_id, name, number, chart_file_id, base_key, base_tempo,
                           duration_seconds, is_ready, owner_id, created_by) values
  ('72000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'Original', 1,
   '71000000-0000-0000-0000-000000000004', 'G', 66, 150, true,
   '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'Original', 1,
   '71000000-0000-0000-0000-000000000005', 'Em', 84, 180, true,
   '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', 'Original', 1,
   '71000000-0000-0000-0000-000000000006', 'F', 104, 120, true,
   '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', 'Original', 1,
   '71000000-0000-0000-0000-000000000007', 'F', 76, 210, true,
   '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008', 'Original', 1,
   '71000000-0000-0000-0000-000000000008', 'G', 88, 150, true,
   '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001')
  on conflict do nothing;

insert into public_songs (id, song_id, contributor_id, license, license_confirmed, status) values
  ('73000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004',
   '10000000-0000-0000-0000-000000000001', 'public-domain', true, 'live'),
  ('73000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005',
   '10000000-0000-0000-0000-000000000001', 'public-domain', true, 'live'),
  ('73000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006',
   '10000000-0000-0000-0000-000000000001', 'public-domain', true, 'live'),
  ('73000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007',
   '10000000-0000-0000-0000-000000000001', 'public-domain', true, 'live'),
  ('73000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008',
   '10000000-0000-0000-0000-000000000001', 'CC-BY-4.0', true, 'live')
  on conflict do nothing;
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- MUSIC-THEORY REPRODUCTION FIXTURES
--
-- Two songs whose ChordPro bodies contain, on purpose, every input the
-- music-theory findings are about, so the behaviour can be SEEN in the app rather
-- than only asserted at the module level, and a reviewer can compare a branch
-- against main without inventing data.
--
-- Every token is load-bearing. Do not "tidy" one of them.
--
--   {key: C major}    explicit scale, so the degree view has a scale to derive
--                     from: fix-degree-quality-derivation (#217).
--   [am]              a LOWERCASE root. CHORD_RE is uppercase-only, so today this
--                     chord is left untransposed while its neighbours move:
--                     fix-unspecified-silent-wrong (#224) finding 1.
--   [E♭] [C♯7]        the UNICODE accidentals (U+266D / U+266F). Only the letter
--                     is matched today, so the accidental rides into the output
--                     and [E♭] renders as the nonsense "Fb♭":
--                     fix-unspecified-silent-wrong (#224) finding 2.
--                     NOTE E♭ and not B♭: B♭ is the same pitch as the [Bb] below,
--                     and a substitution anchored to "Bb" would hijack it once
--                     #224 normalises ♭ to b. Measuring the first draft of this
--                     fixture is what caught that.
--   [Bb]              the chord the seeded substitution is anchored to. C is a
--                     SHARP-spelled key, so the reverse lookup respells the anchor
--                     and the substitution silently misses:
--                     fix-unspecified-silent-wrong (#224) finding 3.
--   [Am] [G]          degrees 6 and 5 of C major; Am's derived quality is MINOR
--                     and today qualityForDegree returns 'power' for every degree
--                     of every scale — 0 correct out of 49 measured:
--                     fix-degree-quality-derivation (#217).
--
-- The SECOND song repeats the body under a FLAT key (Eb) for one reason only: a
-- flat-spelled key is the case that exposes fix-key-spelling-preference (#219).
-- With capo 1, F must render as Gb, because the key's own spelling says flat.
-- Today the spelling comes from a hardcoded six-name set that does not contain
-- Gb's result, so it renders F#. This is a different song on purpose — the two
-- findings cannot both be visible from one key, since #219 is exactly the change
-- that decides which way #224's anchor lookup respells.
--
-- Ids are in the 30000… range, which AGENTS.md reserves for fixtures so they
-- cannot collide with the seed's own 30000000-… setlist family.
-- ═══════════════════════════════════════════════════════════════════════════════

insert into songs (id, org_id, branch_id, title, artist, genre, created_by) values
  ('30000600-0000-4000-8000-000000000001', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Music Theory Fixture', 'Test harness',
   'worship', '10000000-0000-0000-0000-000000000001'),
  ('30000600-0000-4000-8000-000000000002', '10000000-0000-0000-0000-0000000000a1',
   '10000000-0000-0000-0000-0000000000b1', 'Music Theory Fixture (flat key)',
   'Test harness', 'worship', '10000000-0000-0000-0000-000000000001')
  on conflict do nothing;

insert into chart_files (id, song_id, format, object_key, content, size_bytes) values
  ('30000800-0000-4000-8000-000000000001', '30000600-0000-4000-8000-000000000001',
   'chordpro', 'seed/music-theory-fixture.chordpro',
   $chordpro${title: Music Theory Fixture}
  {key: C major}
  {section: Verse 1}
  [am]A [Dm]minor chord, lowercase root
  [E♭]A unicode flat, U+266D
  {section: Chorus}
  [Bb]Anchored chord
  [C♯7]A unicode sharp, U+266F
  [Am]Degree six, derived minor
  [G]Degree five, derived major$chordpro$,
   258),
  ('30000800-0000-4000-8000-000000000002', '30000600-0000-4000-8000-000000000002',
   'chordpro', 'seed/music-theory-fixture-flat.chordpro',
   $chordpro${title: Music Theory Fixture}
  {key: Fm}
  {section: Verse 1}
  [E]Only chord that lands on an accidental at +2
  [C]Lands on a natural, for contrast$chordpro$,
   66)
  on conflict do nothing;

insert into song_versions (id, song_id, name, number, chart_file_id, base_key, base_tempo,
                           duration_seconds, is_ready, owner_id, created_by) values
  ('30000700-0000-4000-8000-000000000001', '30000600-0000-4000-8000-000000000001',
   'Original', 1, '30000800-0000-4000-8000-000000000001', 'C', 92, 210, true,
   '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('30000700-0000-4000-8000-000000000002', '30000600-0000-4000-8000-000000000002',
   'Original', 1, '30000800-0000-4000-8000-000000000002', 'F', 92, 210, true,
   '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001')
  on conflict do nothing;

-- Written the way a musician would write it. On this SHARP-spelled chart the
-- reverse lookup respells 'Bb' away from what the musician typed, so today this
-- substitution silently does nothing and the chord is simply left alone.
insert into personal_annotations (id, user_id, song_id, anchor, kind, value) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000001',
   '30000600-0000-4000-8000-000000000001',
   '{"chord":"Bb"}', 'chord_substitution', 'C')
  on conflict do nothing;
