-- CEMURM 0042 — account data export: the server-side envelope (privacy slice, N2 unit 3)
--
-- Requirement source:
--   features/account-data-export-and-erasure.feature:15-19 — repertoire + versions:
--     every song, version and chart the user authored, plus "the version change
--     history with dates and editors".
--   features/account-data-export-and-erasure.feature:20-24 — activity + preferences:
--     comments, annotations, collections, practice history, performance records and
--     notification preferences.
--   features/account-data-export-and-erasure.feature:28 — "every included record in a
--     standard form": hence ONE versioned, self-describing envelope with pinned
--     top-level keys, so the later importer (:29, WU5) dispatches on schema_version
--     instead of guessing the shape it was handed.
--   This file is WU1 of odd/tasks/account-data-export-and-erasure.md — the server
--   boundary only. The client bundle/ZIP (WU2) and the re-importer (WU5) consume it.
--
-- ── THE LOAD-BEARING HAZARD: security definer BYPASSES RLS ────────────────────────────────
-- `security definer` is what lets ONE call assemble a complete cross-table envelope; a
-- plain `authenticated` call would be shredded by RLS into whatever the per-table owner
-- policies happen to allow. The consequence, verified empirically on the live stack
-- before this file was written:
--
--   select count(*) from public.songs                                 --> 10  (every row)
--   select count(*) from public.songs where created_by = auth.uid()   --> 9   (mine only)
--
-- RLS does NOT protect this function. Every `where` below is therefore MANDATORY and is
-- the ONLY thing standing between a caller and other users' data — which is why the
-- smoke's anti-leak assertion is the one that must never be weakened.
--
-- ── Scope discipline ──────────────────────────────────────────────────────────────────────
-- Only rows ATTRIBUTABLE to auth.uid() are included; a table with no user column does not
-- belong here. Nothing widens to the org — the requirement is "MY data", not "my org's".
-- Tables the feature does not name (events, services, rehearsals, substitutions,
-- device_configs, outbox, ...) are out of scope by docs/engineering-review-backlog.md:5.
--
-- ── Two attribution hazards this file respects ────────────────────────────────────────────
--  1. `setlists.owner_id` is NOT NULL and `songs.created_by` is NULLABLE, so songs filter
--     with `= v_uid` and NEVER with coalesce — a coalesce would fold unowned rows into the
--     result. A NULL created_by simply does not match, which is correct (ODD record D3:
--     NULL means "no attributable author").
--  2. `chart_files` has NO user column and is reached ONLY through a song the user
--     authored. Its format column is an enum, so it is cast to text for JSON portability.
--
-- ── Archive vs. working set (ODD record D2) ───────────────────────────────────────────────
-- `archive` holds notifications, follows, feedback and moderation records: real user data
-- that must be exportable, but with no meaningful re-import semantics, so it ships
-- read-only and the future importer skips it.
--
-- ── Shape rules the smoke pins ────────────────────────────────────────────────────────────
--  · `exported_at` is an explicit ISO-8601 UTC string via `to_char`, NOT `now()::text`:
--    PostgreSQL renders that with a SPACE ("2026-10-22 22:16:16.69+00"), which is not
--    ISO-8601 and not what a later consumer should have to parse. Assertion 20 pins it.
--  · Every array is coalesced to '[]' and every object to '{}', so an account with no
--    data still yields a well-formed envelope and never a bare null.
--
-- ── Grants (0002:33-42 / 0012:133-143 convention) ─────────────────────────────────────────
-- The PUBLIC default EXECUTE grant is revoked from public AND anon, then opened for
-- authenticated only — so anon is shut out even before the uid guard raises for it.

create or replace function public.export_account_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  result jsonb;
begin
  -- Same phrasing the repo's other auth-bound RPCs use (0013:63, :86 and 8 more).
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;

  select jsonb_build_object(
    'schema_version', 'cemurm.account-export/1',
    -- to_char with the ISO-8601 'T' separator. `now()::text` renders with a SPACE
    -- ("2026-10-22 22:16:16.69+00"), which is not ISO-8601 and is not what a later
    -- consumer should have to parse. Verified by the smoke's assertion 19.
    'exported_at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'user_id', v_uid,

    -- ── account + preferences ───────────────────────────────────────────────
    'account', coalesce((
      select to_jsonb(p) from (
        select id, display_name, username, instrument, avatar_url,
               date_of_birth, is_minor
        from public.profiles where id = v_uid
      ) p
    ), '{}'::jsonb),

    'preferences', coalesce((
      select to_jsonb(pr) from (
        select user_id, transpose_offset, capo, preferences, created_at, updated_at
        from public.user_preferences where user_id = v_uid
      ) pr
    ), '{}'::jsonb),

    'notification_preferences', coalesce((
      select to_jsonb(np) from (
        select user_id, push_enabled, categories, quiet_start_at, quiet_end_at,
               weekly_digest
        from public.notification_preferences where user_id = v_uid
      ) np
    ), '{}'::jsonb),

    -- ── memberships, with org and branch display names joined in ─────────────
    'memberships', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.joined_at) from (
        select om.id, om.user_id, om.org_id, o.name as org_name,
               om.branch_id, b.name as branch_name, om.role, om.status::text as status,
               om.joined_at, om.left_at
        from public.org_memberships om
        left join public.organizations o on o.id = om.org_id
        left join public.branches b on b.id = om.branch_id
        where om.user_id = v_uid
      ) m
    ), '[]'::jsonb),

    -- ── repertoire: songs → versions → charts, plus the user's own tags ──────
    'repertoire', jsonb_build_object(
      -- Songs the user AUDITED (created_by = uid). Nullable column: `=` filters out
      -- unowned rows, which is the intent — never widen with coalesce.
      'songs', coalesce((
        select jsonb_agg(to_jsonb(s) order by s.created_at) from (
          select id, org_id, branch_id, title, artist, genre, source, source_org_id,
                 is_deleted, created_by, created_at, updated_at, year, license,
                 license_confirmed
          from public.songs where created_by = v_uid
        ) s
      ), '[]'::jsonb),

      -- Version change history (feature:19). `created_at` is the date and `created_by`
      -- the editor; `change_note` carries the why. owner_id is included when present.
      'versions', coalesce((
        select jsonb_agg(to_jsonb(v) order by v.song_id, v.number) from (
          select id, song_id, name, number, chart_file_id, base_key, base_tempo,
                 duration_seconds, section_context, is_ready, lineage_source,
                 metadata, owner_id, created_by, created_at, change_note
          from public.song_versions
          where song_id in (select id from public.songs where created_by = v_uid)
        ) v
      ), '[]'::jsonb),

      -- Charts are reached ONLY through an authored song: chart_files has no user column.
      'charts', coalesce((
        select jsonb_agg(to_jsonb(c) order by c.created_at) from (
          select id, song_id, format::text as format, object_key, content, size_bytes,
                 soft_deleted, created_at
          from public.chart_files
          where song_id in (select id from public.songs where created_by = v_uid)
        ) c
      ), '[]'::jsonb),

      -- Personal tags only: org tags (user_id IS NULL) are not the user's to export.
      'tags', coalesce((
        select jsonb_agg(to_jsonb(t) order by t.name) from (
          select id, org_id, user_id, name from public.tags where user_id = v_uid
        ) t
      ), '[]'::jsonb)
    ),

    -- ── collections, each with its songs nested ──────────────────────────────
    'collections', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.created_at) from (
        select col.id, col.owner_id, col.org_id, col.name, col.description,
               col.fork_of, col.visibility, col.created_at,
               coalesce((
                 select jsonb_agg(to_jsonb(cs) order by cs.position) from (
                   select collection_id, song_id, position
                   from public.collection_songs where collection_id = col.id
                 ) cs
               ), '[]'::jsonb) as songs
        from public.collections col
        where col.owner_id = v_uid
      ) c
    ), '[]'::jsonb),

    -- ── setlists, each with items and collaborators nested ───────────────────
    'setlists', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.created_at) from (
        select sl.id, sl.org_id, sl.branch_id, sl.owner_id, sl.name, sl.visibility,
               sl.is_event_setlist, sl.created_at, sl.updated_at,
               coalesce((
                 select jsonb_agg(to_jsonb(si) order by si.position) from (
                   select id, setlist_id, song_id, version_id, position, agreed_key,
                          vocal_parts, midi_program, notes
                   from public.setlist_items where setlist_id = sl.id
                 ) si
               ), '[]'::jsonb) as items,
               coalesce((
                 select jsonb_agg(to_jsonb(sc) order by sc.invited_at) from (
                   select setlist_id, user_id, can_edit, invited_at, accepted_at
                   from public.setlist_collaborators where setlist_id = sl.id
                 ) sc
               ), '[]'::jsonb) as collaborators
        from public.setlists sl
        where sl.owner_id = v_uid
      ) s
    ), '[]'::jsonb),

    -- ── activity records authored by the user ────────────────────────────────
    'annotations', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at) from (
        select id, user_id, song_id, anchor, kind, value, created_at, updated_at
        from public.personal_annotations where user_id = v_uid
      ) a
    ), '[]'::jsonb),

    'comments', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.created_at) from (
        select id, song_id, version_id, anchor, parent_id, author_id, body,
               resolved, deleted, created_at, updated_at
        from public.shared_comments where author_id = v_uid
      ) c
    ), '[]'::jsonb),

    'practice_sessions', coalesce((
      select jsonb_agg(to_jsonb(ps) order by ps.started_at) from (
        select id, user_id, song_id, version_id, instrument, started_at, ended_at,
               offline_sync
        from public.practice_sessions where user_id = v_uid
      ) ps
    ), '[]'::jsonb),

    -- ── gigs the user OWNS, plus the performances of those gigs ──────────────
    'gigs', coalesce((
      select jsonb_agg(to_jsonb(g) order by g.scheduled_at) from (
        select id, org_id, branch_id, owner_id, name, venue_id, scheduled_at,
               setlist_id, status, shared_to_branch, created_at
        from public.gigs where owner_id = v_uid
      ) g
    ), '[]'::jsonb),

    -- Performances are reached through an owned gig (performances has no user column),
    -- and each carries its items — the setlist actually played (feature:24).
    'performances', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.performed_at) from (
        select pe.id, pe.gig_id, pe.venue_id, pe.performed_at,
               coalesce((
                 select jsonb_agg(to_jsonb(pi) order by pi.position) from (
                   select id, performance_id, song_id, version_id, state::text as state,
                          position
                   from public.performance_items where performance_id = pe.id
                 ) pi
               ), '[]'::jsonb) as items
        from public.performances pe
        where pe.gig_id in (select id from public.gigs where owner_id = v_uid)
      ) p
    ), '[]'::jsonb),

    -- ── public library contributions by this user ────────────────────────────
    'public_contributions', coalesce((
      select jsonb_agg(to_jsonb(pub) order by pub.updated_at) from (
        select id, song_id, contributor_id, license, license_confirmed, lineage,
               linked_copies, status, updated_at
        from public.public_songs where contributor_id = v_uid
      ) pub
    ), '[]'::jsonb),

    -- ── lighter activity streams ─────────────────────────────────────────────
    'activity', jsonb_build_object(
      'follows', coalesce((
        select jsonb_agg(to_jsonb(f) order by f.created_at) from (
          select follower_id, followed_id, created_at
          from public.follows where follower_id = v_uid
        ) f
      ), '[]'::jsonb),
      'notifications', coalesce((
        select jsonb_agg(to_jsonb(n) order by n.created_at) from (
          select id, user_id, category, title, body, payload, read_at, created_at
          from public.notifications where user_id = v_uid
        ) n
      ), '[]'::jsonb),
      'feedback', coalesce((
        select jsonb_agg(to_jsonb(fb) order by fb.created_at) from (
          select id, user_id, kind, message, screen, diagnostics, status, created_at
          from public.feedback where user_id = v_uid
        ) fb
      ), '[]'::jsonb)
    ),

    -- ── read-only archive: exportable, no importer (D2) ──────────────────────
    'archive', jsonb_build_object(
      -- Personal audit trail. setlist_change_log is the setlist editing history; the
      -- actor column is the user, so only their own actions are exported.
      'audit', coalesce((
        select jsonb_agg(to_jsonb(al) order by al.created_at) from (
          select scl.id, scl.setlist_id, scl.actor_id, scl.action, scl.detail,
                 scl.created_at
          from public.setlist_change_log scl
          where scl.actor_id = v_uid
        ) al
      ), '[]'::jsonb),
      -- Moderation records where this user decided; appeals are followed through
      -- public_songs they contributed. Read-only on purpose (D2).
      'moderation', coalesce((
        select jsonb_agg(to_jsonb(mc) order by mc.created_at) from (
          select mc.id, mc.public_song_id, mc.reason_counts, mc.grounds, mc.decision,
                 mc.decider_id, mc.appeal_of, mc.decided_at, mc.notes, mc.created_at
          from public.moderation_cases mc
          where mc.decider_id = v_uid
        ) mc
      ), '[]'::jsonb)
    )
  ) into result;

  return result;
end $$;

-- private-schema default-revoke convention (0002:33-42): lock the entry point, then
-- open it for authenticated only; anon and public stay locked.
revoke execute on function public.export_account_data() from public, anon;
grant execute on function public.export_account_data() to authenticated;
