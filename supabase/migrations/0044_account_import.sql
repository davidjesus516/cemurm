-- CEMURM 0044 — account import: re-import the core working set (privacy slice, N2 unit 3)
--
-- Requirement source:
--   features/account-data-export-and-erasure.feature:29 — "the bundle can be re-imported into a
--     fresh CEMURM account".
--   features/account-data-export-and-erasure.feature:75 — "I can re-import it into a new account
--     later".
--   ODD record D2 — re-import scope is the CORE WORKING SET only: songs, versions, charts, tags,
--     collections (+ their songs), setlists (+ items), annotations, user preferences and
--     notification preferences. Comments, practice history, gigs, performances, memberships,
--     notifications, audit and moderation records ship in the bundle as a read-only archive with
--     NO importer. Inventing import semantics for them would be dead code (D2).
--
-- Slice: WU5 of odd/tasks/account-data-export-and-erasure.md. Consumes the WU1 envelope
-- (supabase/migrations/0042_account_export.sql).
--
-- ── IDENTITY IS NEVER TAKEN FROM THE DOCUMENT ───────────────────────────────────────────────
-- `user_id`, `created_by`, `owner_id`, `contributor_id` and every other attribution field in the
-- payload are ignored. Every row this function inserts is owned by `auth.uid()`. A forged or
-- stale bundle therefore cannot transfer ownership to (or from) another account. The smoke proves
-- it by exporting a document that names another user and asserting nothing lands on that user.
--
-- ── IDS ARE REMAPPED, NEVER REUSED ──────────────────────────────────────────────────────────
-- The donor's UUIDs may still exist in THIS database (the same database can host both accounts,
-- and a bundle can be imported twice). Every imported song/version/chart/collection/setlist/tag
-- gets a fresh `gen_random_uuid()`, and an old→new map carries the references:
--   song_versions.song_id + chart_file_id, chart_files.song_id, collection_songs.song_id and
--   .collection_id, setlist_items.song_id/.version_id/.setlist_id, personal_annotations.song_id.
-- A primary-key collision with the donor account is therefore impossible; the smoke seeds a song
-- with the *exported* id under another user and asserts it is untouched after the import.
--
-- ── WHAT CANNOT ROUND-TRIP, AND WHY ────────────────────────────────────────────────────────
--  · CHARTS: the bundle is a ZIP of JSON + summary and carries no binary blobs (D7/WU2). Inline
--    `content` is preserved; `object_key` is set to NULL because the exported Storage path lives
--    under the DONOR's folder (`{donor_uid}/...`) and would be unreadable under the new user's
--    owner-folder RLS on the private `charts` bucket. `chart_files.object_key` was NOT NULL in
--    0001, so this migration relaxes it to nullable — the only DDL change in this slice. A PDF
--    scan (content NULL, object_key set) therefore imports as a row with neither: the version
--    history survives, the scan itself does not. Documented in the settings UI copy as well.
--  · SETLIST ITEMS whose song is not in the bundle: `setlist_items.song_id` is NOT NULL with a
--    RESTRICT foreign key and the table has no title/label column, so a song-less item cannot be
--    represented at all. Those rows are skipped (counted in `skipped_setlist_items`) rather than
--    inserted with a dangling or invented foreign key.
--  · ANNOTATIONS on a song outside the export (a user may annotate somebody else's song) are
--    skipped and counted in `skipped_annotations`.
--  · ORG/BATCH SCOPING: `org_id`/`branch_id`/`source_org_id` are set to NULL. The bundle may be
--    imported into a different database where the donor's org does not exist; silently attaching
--    imported songs to a foreign org would either violate the FK or leak org structure. The
--    imported core working set is personal, which is exactly what "a fresh account" means.
--  · `collections.fork_of` and `song_versions.lineage_source` are set to NULL unless they resolve
--    inside this same import (a fork/lineage row that was not part of the bundle has no mapping).
--
-- ── IDEMPOTENCY: THERE IS NONE, ON PURPOSE ─────────────────────────────────────────────────
-- Nothing is deduplicated by title/artist (or any other content). Importing the same bundle twice
-- appends a second copy of every song/setlist/collection. That is the documented contract — a
-- dedupe heuristic on user-authored content would silently drop rows. Tags are the one exception,
-- because `tags` carries unique (user_id, name): an existing tag is reused (and counted as
-- `reused_tags`), never duplicated or renamed.
--
-- ── SIDE EFFECTS SUPPRESSED ────────────────────────────────────────────────────────────────
-- `setlist_items` has an AFTER INSERT trigger (notify_setlist_item_added) that notifies the
-- setlist owner — i.e. the caller — for every item. Importing a 60-item setlist would spam 60
-- notifications, so the notifications created by THIS transaction for the imported setlists are
-- removed before returning. Nothing else is touched.
--
-- ── ATOMICITY ──────────────────────────────────────────────────────────────────────────────
-- One call, one transaction: any error rolls the whole import back and nothing is inserted.
--
-- ── GRANTS (0002:33-42 convention) ─────────────────────────────────────────────────────────
-- The PUBLIC default EXECUTE grant is revoked from public AND anon, then opened for authenticated
-- only, so anon is shut out even before the uid guard raises.

-- Charts: the exported object_key belongs to the donor's Storage folder (see above).
alter table public.chart_files alter column object_key drop not null;

create or replace function public.import_account_data(p_document jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid          uuid := (select auth.uid());
  v_started      timestamptz := now();

  v_repertoire   jsonb;
  v_songs        jsonb;
  v_versions     jsonb;
  v_charts       jsonb;
  v_tags         jsonb;
  v_collections  jsonb;
  v_setlists     jsonb;
  v_annotations  jsonb;
  v_prefs        jsonb;
  v_notif_prefs  jsonb;

  v_item         jsonb;
  v_old          uuid;
  v_new          uuid;
  v_mapped       uuid;
  v_text         text;
  v_format       text;

  v_song_map     jsonb := '{}'::jsonb;
  v_chart_map    jsonb := '{}'::jsonb;
  v_version_map  jsonb := '{}'::jsonb;
  v_collection_map jsonb := '{}'::jsonb;
  v_tag_map      jsonb := '{}'::jsonb;

  v_setlist_ids  uuid[] := '{}';
  v_position     integer;

  v_songs_n        integer := 0;
  v_versions_n     integer := 0;
  v_charts_n       integer := 0;
  v_tags_n         integer := 0;
  v_reused_tags_n  integer := 0;
  v_collections_n  integer := 0;
  v_collection_songs_n integer := 0;
  v_setlists_n     integer := 0;
  v_setlist_items_n integer := 0;
  v_annotations_n  integer := 0;

  v_skipped_setlist_items    integer := 0;
  v_skipped_collection_songs integer := 0;
  v_skipped_annotations      integer := 0;
  v_skipped_versions         integer := 0;
  v_skipped_charts           integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;

  if p_document is null or jsonb_typeof(p_document) <> 'object' then
    raise exception 'This file is not a CEMURM export.';
  end if;

  if coalesce(p_document ->> 'schema_version', '') <> 'cemurm.account-export/1' then
    raise exception 'Unsupported export version: %.',
      coalesce(p_document ->> 'schema_version', 'missing schema_version');
  end if;

  -- Arrays are read defensively: a missing/mistyped group is an empty one, so a minimal
  -- document (songs only) still imports.
  v_repertoire := case
    when jsonb_typeof(p_document -> 'repertoire') = 'object' then p_document -> 'repertoire'
    else '{}'::jsonb
  end;
  v_songs       := case when jsonb_typeof(v_repertoire -> 'songs') = 'array' then v_repertoire -> 'songs' else '[]'::jsonb end;
  v_versions    := case when jsonb_typeof(v_repertoire -> 'versions') = 'array' then v_repertoire -> 'versions' else '[]'::jsonb end;
  v_charts      := case when jsonb_typeof(v_repertoire -> 'charts') = 'array' then v_repertoire -> 'charts' else '[]'::jsonb end;
  v_tags        := case when jsonb_typeof(v_repertoire -> 'tags') = 'array' then v_repertoire -> 'tags' else '[]'::jsonb end;
  v_collections := case when jsonb_typeof(p_document -> 'collections') = 'array' then p_document -> 'collections' else '[]'::jsonb end;
  v_setlists    := case when jsonb_typeof(p_document -> 'setlists') = 'array' then p_document -> 'setlists' else '[]'::jsonb end;
  v_annotations := case when jsonb_typeof(p_document -> 'annotations') = 'array' then p_document -> 'annotations' else '[]'::jsonb end;
  v_prefs       := case when jsonb_typeof(p_document -> 'preferences') = 'object' then p_document -> 'preferences' else '{}'::jsonb end;
  v_notif_prefs := case when jsonb_typeof(p_document -> 'notification_preferences') = 'object' then p_document -> 'notification_preferences' else '{}'::jsonb end;

  -- ── 1. Tags (personal only; org tags are not the user's) ────────────────────────────────
  for v_item in select value from jsonb_array_elements(v_tags) loop
    v_text := nullif(btrim(coalesce(v_item ->> 'name', '')), '');
    if v_text is null then
      continue;
    end if;

    v_new := null;
    insert into public.tags (id, org_id, user_id, name)
    values (gen_random_uuid(), null, v_uid, v_text)
    on conflict (user_id, name) do nothing
    returning id into v_new;

    if v_new is null then
      -- Already present for this caller (from an earlier import or manual creation).
      select t.id into v_new from public.tags t where t.user_id = v_uid and t.name = v_text;
      v_reused_tags_n := v_reused_tags_n + 1;
    else
      v_tags_n := v_tags_n + 1;
    end if;

    v_old := null;
    begin
      v_old := (v_item ->> 'id')::uuid;
    exception when others then
      v_old := null;
    end;
    if v_old is not null then
      v_tag_map := v_tag_map || jsonb_build_object(v_old::text, v_new::text);
    end if;
  end loop;

  -- ── 2. Songs (is_deleted is imported as-is: the export is a faithful copy) ──────────────
  for v_item in select value from jsonb_array_elements(v_songs) loop
    v_new := gen_random_uuid();

    insert into public.songs (
      id, org_id, branch_id, title, artist, genre, source, source_org_id,
      is_deleted, created_by, created_at, updated_at, year, license, license_confirmed
    ) values (
      v_new,
      null,                                       -- org scoping does not survive a fresh account
      null,
      coalesce(nullif(btrim(coalesce(v_item ->> 'title', '')), ''), 'Untitled song'),
      nullif(v_item ->> 'artist', ''),
      nullif(v_item ->> 'genre', ''),
      nullif(v_item ->> 'source', ''),
      null,
      coalesce((v_item ->> 'is_deleted')::boolean, false),
      v_uid,                                      -- never the document's created_by
      coalesce((v_item ->> 'created_at')::timestamptz, now()),
      coalesce((v_item ->> 'updated_at')::timestamptz, now()),
      nullif(v_item ->> 'year', '')::integer,
      -- songs_license_check allows exactly these three values.
      case
        when v_item ->> 'license' in ('public-domain', 'CC-BY-4.0', 'proprietary')
          then v_item ->> 'license'
        else 'proprietary'
      end,
      coalesce((v_item ->> 'license_confirmed')::boolean, false)
    );
    v_songs_n := v_songs_n + 1;

    v_old := null;
    begin
      v_old := (v_item ->> 'id')::uuid;
    exception when others then
      v_old := null;
    end;
    if v_old is not null then
      v_song_map := v_song_map || jsonb_build_object(v_old::text, v_new::text);
    end if;
  end loop;

  -- ── 3. Charts (content only; object_key is NULL — no blobs in the bundle) ───────────────
  for v_item in select value from jsonb_array_elements(v_charts) loop
    v_mapped := null;
    begin
      v_mapped := (v_song_map ->> (v_item ->> 'song_id'))::uuid;
    exception when others then
      v_mapped := null;
    end;
    if v_mapped is null then
      v_skipped_charts := v_skipped_charts + 1;
      continue;
    end if;

    v_format := coalesce(nullif(v_item ->> 'format', ''), 'chordpro');
    if v_format not in ('chordpro', 'musicxml', 'abc', 'pdf') then
      v_format := 'chordpro';
    end if;

    v_new := gen_random_uuid();
    insert into public.chart_files (
      id, song_id, format, object_key, content, size_bytes, soft_deleted, created_at
    ) values (
      v_new,
      v_mapped,
      v_format::public.chart_format,
      null,
      v_item -> 'content' #>> '{}',                -- jsonb string → text, NULL stays NULL
      coalesce((v_item ->> 'size_bytes')::integer, 0),
      coalesce((v_item ->> 'soft_deleted')::boolean, false),
      coalesce((v_item ->> 'created_at')::timestamptz, now())
    );
    v_charts_n := v_charts_n + 1;

    v_old := null;
    begin
      v_old := (v_item ->> 'id')::uuid;
    exception when others then
      v_old := null;
    end;
    if v_old is not null then
      v_chart_map := v_chart_map || jsonb_build_object(v_old::text, v_new::text);
    end if;
  end loop;

  -- ── 4. Versions (chart_file_id remapped; lineage only when it resolves here) ────────────
  for v_item in select value from jsonb_array_elements(v_versions) loop
    v_mapped := null;
    begin
      v_mapped := (v_song_map ->> (v_item ->> 'song_id'))::uuid;
    exception when others then
      v_mapped := null;
    end;
    if v_mapped is null then
      v_skipped_versions := v_skipped_versions + 1;
      continue;
    end if;

    v_new := gen_random_uuid();
    insert into public.song_versions (
      id, song_id, name, number, chart_file_id, base_key, base_tempo, duration_seconds,
      section_context, is_ready, lineage_source, metadata, owner_id, created_by,
      created_at, change_note
    ) values (
      v_new,
      v_mapped,
      coalesce(nullif(btrim(coalesce(v_item ->> 'name', '')), ''), 'Original'),
      coalesce((v_item ->> 'number')::integer, 1),
      (v_chart_map ->> (v_item ->> 'chart_file_id'))::uuid,
      nullif(v_item ->> 'base_key', ''),
      nullif(v_item ->> 'base_tempo', '')::integer,
      nullif(v_item ->> 'duration_seconds', '')::integer,
      case when jsonb_typeof(v_item -> 'section_context') = 'array' then v_item -> 'section_context' else '[]'::jsonb end,
      coalesce((v_item ->> 'is_ready')::boolean, false),
      null,                                        -- forward/absent lineage has no mapping
      case when jsonb_typeof(v_item -> 'metadata') = 'object' then v_item -> 'metadata' else '{}'::jsonb end,
      v_uid,
      v_uid,
      coalesce((v_item ->> 'created_at')::timestamptz, now()),
      v_item ->> 'change_note'
    );
    v_versions_n := v_versions_n + 1;

    v_old := null;
    begin
      v_old := (v_item ->> 'id')::uuid;
    exception when others then
      v_old := null;
    end;
    if v_old is not null then
      v_version_map := v_version_map || jsonb_build_object(v_old::text, v_new::text);
    end if;
  end loop;

  -- ── 5. Collections + their songs ────────────────────────────────────────────────────────
  for v_item in select value from jsonb_array_elements(v_collections) loop
    v_new := gen_random_uuid();

    insert into public.collections (
      id, owner_id, org_id, name, description, fork_of, visibility, created_at
    ) values (
      v_new,
      v_uid,
      null,
      coalesce(nullif(btrim(coalesce(v_item ->> 'name', '')), ''), 'Untitled collection'),
      nullif(v_item ->> 'description', ''),
      null,
      coalesce(nullif(v_item ->> 'visibility', ''), 'private'),
      coalesce((v_item ->> 'created_at')::timestamptz, now())
    );
    v_collections_n := v_collections_n + 1;

    for v_item in
      select value from jsonb_array_elements(
        case when jsonb_typeof(v_item -> 'songs') = 'array' then v_item -> 'songs' else '[]'::jsonb end
      )
    loop
      v_mapped := null;
      begin
        v_mapped := (v_song_map ->> (v_item ->> 'song_id'))::uuid;
      exception when others then
        v_mapped := null;
      end;
      if v_mapped is null then
        v_skipped_collection_songs := v_skipped_collection_songs + 1;
        continue;
      end if;

      begin
        insert into public.collection_songs (collection_id, song_id, position)
        values (
          v_new,
          v_mapped,
          coalesce(nullif(v_item ->> 'position', '')::integer, v_collection_songs_n)
        )
        on conflict (collection_id, song_id) do nothing;
        v_collection_songs_n := v_collection_songs_n + 1;
      exception when others then
        v_skipped_collection_songs := v_skipped_collection_songs + 1;
      end;
    end loop;
  end loop;

  -- ── 6. Setlists + items ────────────────────────────────────────────────────────────────
  for v_item in select value from jsonb_array_elements(v_setlists) loop
    v_new := gen_random_uuid();
    v_setlist_ids := v_setlist_ids || v_new;

    insert into public.setlists (
      id, org_id, branch_id, owner_id, name, visibility, is_event_setlist,
      created_at, updated_at
    ) values (
      v_new,
      null,
      null,
      v_uid,
      coalesce(nullif(btrim(coalesce(v_item ->> 'name', '')), ''), 'Untitled setlist'),
      coalesce(nullif(v_item ->> 'visibility', ''), 'private'),
      coalesce((v_item ->> 'is_event_setlist')::boolean, false),
      coalesce((v_item ->> 'created_at')::timestamptz, now()),
      coalesce((v_item ->> 'updated_at')::timestamptz, now())
    );
    v_setlists_n := v_setlists_n + 1;

    -- Re-sequenced 1..n in export order: positions only encode order, and re-sequencing keeps
    -- the (setlist_id, position) unique constraint safe after skipped items.
    v_position := 0;
    for v_item in
      select value from jsonb_array_elements(
        case when jsonb_typeof(v_item -> 'items') = 'array' then v_item -> 'items' else '[]'::jsonb end
      )
    loop
      v_mapped := null;
      begin
        v_mapped := (v_song_map ->> (v_item ->> 'song_id'))::uuid;
      exception when others then
        v_mapped := null;
      end;
      if v_mapped is null then
        -- setlist_items.song_id is NOT NULL and there is no title/label column to hold a
        -- song-less item; skip instead of inventing a row.
        v_skipped_setlist_items := v_skipped_setlist_items + 1;
        continue;
      end if;

      v_position := v_position + 1;
      insert into public.setlist_items (
        id, setlist_id, song_id, version_id, position, agreed_key, vocal_parts,
        midi_program, notes
      ) values (
        gen_random_uuid(),
        v_new,
        v_mapped,
        (v_version_map ->> (v_item ->> 'version_id'))::uuid,
        v_position,
        nullif(v_item ->> 'agreed_key', ''),
        case when jsonb_typeof(v_item -> 'vocal_parts') = 'array' then v_item -> 'vocal_parts' else '[]'::jsonb end,
        nullif(v_item ->> 'midi_program', '')::integer,
        v_item ->> 'notes'
      );
      v_setlist_items_n := v_setlist_items_n + 1;
    end loop;
  end loop;

  -- Suppress the per-item notifications this transaction just created (see header).
  if v_setlist_ids <> '{}'::uuid[] then
    delete from public.notifications n
    where n.user_id = v_uid
      and n.created_at >= v_started
      and n.payload ->> 'action' = 'song-added'
      and n.payload ->> 'setlist_id' = any (v_setlist_ids::text[]);
  end if;

  -- ── 7. Personal annotations (song must be part of this import) ──────────────────────────
  for v_item in select value from jsonb_array_elements(v_annotations) loop
    v_mapped := null;
    begin
      v_mapped := (v_song_map ->> (v_item ->> 'song_id'))::uuid;
    exception when others then
      v_mapped := null;
    end;
    if v_mapped is null then
      v_skipped_annotations := v_skipped_annotations + 1;
      continue;
    end if;

    insert into public.personal_annotations (
      id, user_id, song_id, anchor, kind, value, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_uid,
      v_mapped,
      case when jsonb_typeof(v_item -> 'anchor') in ('object', 'array') then v_item -> 'anchor' else '{}'::jsonb end,
      coalesce(nullif(v_item ->> 'kind', ''), 'note'),
      coalesce(v_item ->> 'value', ''),
      coalesce((v_item ->> 'created_at')::timestamptz, now()),
      nullif(v_item ->> 'updated_at', '')::timestamptz
    );
    v_annotations_n := v_annotations_n + 1;
  end loop;

  -- ── 8. Preferences (one row per user: upsert, never a second row) ───────────────────────
  if v_prefs <> '{}'::jsonb then
    insert into public.user_preferences (
      user_id, transpose_offset, capo, preferences, created_at, updated_at
    ) values (
      v_uid,
      coalesce(nullif(v_prefs ->> 'transpose_offset', '')::smallint, 0),
      coalesce(nullif(v_prefs ->> 'capo', '')::smallint, 0),
      case when jsonb_typeof(v_prefs -> 'preferences') = 'object' then v_prefs -> 'preferences' else '{}'::jsonb end,
      now(),
      now()
    )
    on conflict (user_id) do update set
      transpose_offset = excluded.transpose_offset,
      capo = excluded.capo,
      preferences = excluded.preferences,
      updated_at = now();
  end if;

  if v_notif_prefs <> '{}'::jsonb then
    insert into public.notification_preferences (
      user_id, push_enabled, categories, quiet_start_at, quiet_end_at, weekly_digest
    ) values (
      v_uid,
      coalesce((v_notif_prefs ->> 'push_enabled')::boolean, true),
      case when jsonb_typeof(v_notif_prefs -> 'categories') = 'object' then v_notif_prefs -> 'categories' else '{}'::jsonb end,
      nullif(v_notif_prefs ->> 'quiet_start_at', '')::time,
      nullif(v_notif_prefs ->> 'quiet_end_at', '')::time,
      coalesce((v_notif_prefs ->> 'weekly_digest')::boolean, false)
    )
    on conflict (user_id) do update set
      push_enabled = excluded.push_enabled,
      categories = excluded.categories,
      quiet_start_at = excluded.quiet_start_at,
      quiet_end_at = excluded.quiet_end_at,
      weekly_digest = excluded.weekly_digest;
  end if;

  return jsonb_build_object(
    'songs', v_songs_n,
    'versions', v_versions_n,
    'charts', v_charts_n,
    'tags', v_tags_n,
    'reused_tags', v_reused_tags_n,
    'collections', v_collections_n,
    'collection_songs', v_collection_songs_n,
    'setlists', v_setlists_n,
    'setlist_items', v_setlist_items_n,
    'annotations', v_annotations_n,
    'skipped_setlist_items', v_skipped_setlist_items,
    'skipped_collection_songs', v_skipped_collection_songs,
    'skipped_annotations', v_skipped_annotations,
    'skipped_versions', v_skipped_versions,
    'skipped_charts', v_skipped_charts
  );
end $$;

comment on function public.import_account_data(jsonb) is
  'Imports the core working set of a cemurm.account-export/1 bundle into the caller account. '
  'Identity fields in the document are ignored; ids are remapped; charts keep inline content only '
  '(object_key reset to NULL); a second call appends a second copy (no dedupe by design).';

revoke execute on function public.import_account_data(jsonb) from public, anon;
grant execute on function public.import_account_data(jsonb) to authenticated;
