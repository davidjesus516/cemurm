-- CEMURM 0048 — an accepted setlist collaborator can read the songs in it
--
-- Gap closed: setlist sharing stopped at the setlist. An accepted collaborator
-- from another org read public.setlists and public.setlist_items but not the
-- rows those items point at — public.songs stayed behind songs_select_owner/_org/
-- _branch, and public.chart_files / public.song_versions behind their own owner
-- policies. The page therefore rendered "(missing song)" on every row and the
-- export serialized to "". Sharing a setlist while withholding its songs is not
-- sharing, so the read path follows setlist membership.
--
-- THE RULE, and why it is shaped this way:
--   A song in a setlist becomes readable to an ACCEPTED COLLABORATOR of that
--   setlist when the setlist's OWNER could already read that song:
--
--   1. The caller is an accepted collaborator on the setlist
--      (setlist_collaborators.accepted_at is not null).
--   2. The setlist's owner can read the song under the PRE-EXISTING scopes
--      (private.setlist_owner_can_read_song below). The person who shares a
--      setlist vouches for the content in it.
--   3. The caller is NOT the setlist's owner (s.owner_id <> $1), with
--      s.owner_id is not null first because setlists.owner_id is nullable.
--
--   Condition 2 is the load-bearing one. It is what stops forged content: the
--   obvious alternative — "the song's org/branch matches the setlist's
--   org/branch" — is forgeable, because setlists_insert_owner (0002) checks
--   only owner_id = auth.uid() and does NOT constrain org_id or branch_id, so
--   any user can create a setlist carrying the victim org's ids and insert a
--   foreign song into it. An attacker can vouch only with a read scope they
--   really have.
--
--   Condition 2 also closes the case where an EDITOR collaborator inserts a
--   song they know the UUID of but cannot otherwise read: the owner cannot
--   read it either, so nobody gains it through the setlist.
--
--   Condition 3 is DEFENCE IN DEPTH against the attack, and the distinction is
--   measured rather than asserted: the owner-vouches condition already blocks the
--   self-invite below on its own, so removing condition 3 does not reopen it.
--   What condition 3 does is say what the helper's contract means: reading what
--   you shared is the owner's pre-existing business, not this policy's.
--
--   It is no longer unmeasured, though. The smoke pins it: demo admits THEMSELVES
--   as an accepted collaborator of the Demo Setlist -- the same pre-existing hole
--   the self-invite below uses -- so every other condition of the helper holds and
--   `s.owner_id <> $1` is the ONLY thing denying the owner's own call. Remove it
--   and that assertion fails.
--
--   One qualifier, because the measurement is not uniform. For SONGS, excluding the
--   owner grants nothing and loses nothing: with the vouch faithful to the live
--   scopes, an owner who could read the song could already read it by other means.
--   For CHART_FILES rows it is NOT uniform: `chart_files_select_owner` keys on
--   `songs.created_by`, so for a song created by somebody else the setlist's owner
--   can be NARROWER than the collaborator, and removing this condition turns the
--   owner's chart read from 0 rows into 1. The song stays gated by the vouch; only
--   the owner-exclusion clause differs.
--
--   The self-invite is the attack a collaborator-only helper does NOT stop.
--   setlist_collaborators_insert_owner (0002) checks only that the caller
--   owns the setlist, so any user can invite THEMSELVES with accepted_at set
--   and manufacture condition 1 on a setlist they created. Condition 2 is what
--   stops that: the attacker cannot vouch for a song they cannot read.
--
--   A pre-existing hole is absorbed rather than trusted: setlists_update_member
--   (0002) lets a can_edit collaborator reassign owner_id, because its WITH
--   CHECK does not constrain the new owner. With conditions 2 and 3 both
--   present, an ownership hijack grants nothing — the hijacker becomes the
--   owner and is then excluded by condition 3, and condition 2 denies the
--   hijacker a song they cannot read.
--
--   The helper answers only about the calling user ($1 = (select auth.uid())),
--   the same tenancy guard private.is_org_member carries. Passing a foreign
--   uuid returns false, never another user's setlist contents.
--
-- Scope, and why it stops where it does:
--   * ADDITIVE SELECT policies only. No INSERT/UPDATE/DELETE policy changes
--     here. (The write policies are unchanged: songs is keyed on created_by
--     plus the pre-existing songs_update_source_org scope; song_versions on
--     its own owner_id and the song's creator; chart_files on the song's
--     creator; setlists INSERT and DELETE are owner-only, and can_edit
--     governs setlists UPDATE and the setlist_items writes.)
--   * No recursion: the chain is songs -> setlist_items -> setlists ->
--     setlist_collaborators -> songs, and nothing points back at songs except
--     the vouch helper, which reads songs as the definer owner with RLS
--     bypassed. The SECURITY DEFINER helper is mandatory for the same reason:
--     setlist_collaborators has own-row RLS, so an invoker-rights helper could
--     not see the row it must find.
--   * This fixes INLINE ChordPro content only. PDF/MusicXML charts stay
--     unreachable: the `charts` bucket is private with owner-folder RLS and
--     1-hour signed URLs, so a cross-org collaborator will see the chart_files
--     row and still fail to download the object. That is a named finding, not a
--     thing this migration claims to fix.
--
-- Indexes: setlist_items carries UNIQUE (setlist_id, position) and
-- idx_setlist_items_orders (setlist_id, position) and had nothing on song_id — a
-- foreign key creates no index in Postgres. Without idx_setlist_items_song every
-- songs read would seq-scan setlist_items once per candidate row. And
-- public_songs had no index on song_id either, although both this helper and
-- the pre-existing songs_select_public_library policy look rows up by it.

-- ══════════════ THE OWNER'S READ SCOPE, EVALUATED FOR SOMEONE ELSE ══════════════
-- The five pre-existing song scopes, asked about the setlist's owner instead of
-- the caller: songs_select_owner (created_by), songs_select_system,
-- songs_select_org (org-level song, active member of that org),
-- songs_select_branch (branch song, active member of that branch) and
-- songs_select_public_library (a live public_songs row).
--
-- songs_select_system is the LIVE one, not the original. 0016 wrote
-- `org_id is null` alone; 0020 and 0040 tightened it to
-- `org_id is null and source_org_id is not null` — the C1 fix, because the
-- loose form counted every personal song of every user as system content.
-- The vouch must mirror the TIGHTENED form. With the loose form it answers
-- "the owner can read this" for a stranger's personal song, and an editor who
-- knows that song's UUID could then read it through the setlist: measured, the
-- loose form grants one song per user that the live scopes deny.
--
-- SECURITY DEFINER is what lets it read org_memberships, whose RLS shows a
-- user only their own rows. It is NOT granted to authenticated: it answers
-- "can this person read this song", and that question must not be askable from
-- the outside. It is reachable only from the helper below, which runs as its
-- owner and therefore may call it.
create function private.setlist_owner_can_read_song(owner_id uuid, song_id uuid) returns boolean
  language sql security definer stable set search_path = '' as $$
  select exists (
    select 1
    from public.songs s
    where s.id = $2
      and (
        s.created_by = $1
        or (s.org_id is null and s.source_org_id is not null)
        or (s.org_id is not null and s.branch_id is null and exists (
              select 1 from public.org_memberships m
              where m.user_id = $1 and m.org_id = s.org_id and m.status = 'active'))
        or (s.branch_id is not null and exists (
              select 1 from public.org_memberships m
              where m.user_id = $1 and m.branch_id = s.branch_id and m.status = 'active'))
        or exists (
              select 1 from public.public_songs ps
              where ps.song_id = s.id and ps.status = 'live')
      )
  ) $$;

-- not callable from outside: PUBLIC's default EXECUTE is revoked explicitly,
-- because `alter default privileges in schema private` leaves no pg_default_acl
-- row behind and therefore does NOT cover functions created later.
revoke execute on function private.setlist_owner_can_read_song(uuid, uuid) from public, anon, authenticated;

create function private.is_song_in_readable_setlist(user_id uuid, song_id uuid) returns boolean
  language sql security definer stable set search_path = '' as $$
  select exists (
    select 1
    from public.setlist_items i
    join public.setlists s on s.id = i.setlist_id
    join public.setlist_collaborators c on c.setlist_id = s.id
    where i.song_id = $2
      and c.user_id = $1
      and c.accepted_at is not null
      and s.owner_id is not null
      and s.owner_id <> $1
      and $1 = (select auth.uid())
      and private.setlist_owner_can_read_song(s.owner_id, $2)
  ) $$;

-- execution locked: PUBLIC default grant would expose the definer helpers
revoke execute on function private.is_song_in_readable_setlist(uuid, uuid) from public, anon;
grant execute on function private.is_song_in_readable_setlist(uuid, uuid) to authenticated, service_role;

-- ══════════════════ SONGS — READ VIA AN ACCEPTED SETLIST INVITE ══════════════════
-- OR-scope on top of 0016's level-scoped read policies: a song referenced by a
-- setlist the caller accepted an invite to becomes readable by that caller, as
-- long as the setlist's owner could read it too.
-- Metadata only by construction; chart payloads keep their own policies below.
drop policy if exists songs_select_via_setlist on public.songs;
create policy songs_select_via_setlist on public.songs
  for select to authenticated
  using (private.is_song_in_readable_setlist((select auth.uid()), id));

-- ══════════════════ SONG_VERSIONS — SAME SCOPE, KEYED BY song_id ══════════════════
drop policy if exists song_versions_select_via_setlist on public.song_versions;
create policy song_versions_select_via_setlist on public.song_versions
  for select to authenticated
  using (private.is_song_in_readable_setlist((select auth.uid()), song_id));

-- ══════════════════ CHART_FILES — SAME SCOPE, KEYED BY song_id ══════════════════
-- chart_files.song_id is NOT NULL, so no hop through song_versions is needed.
drop policy if exists chart_files_select_via_setlist on public.chart_files;
create policy chart_files_select_via_setlist on public.chart_files
  for select to authenticated
  using (private.is_song_in_readable_setlist((select auth.uid()), song_id));

create index if not exists idx_setlist_items_song on public.setlist_items(song_id);
create index if not exists idx_public_songs_song on public.public_songs(song_id);
