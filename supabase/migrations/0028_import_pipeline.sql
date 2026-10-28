-- ═══════════════════════════════════════════════════════════════════════════════
-- 0028_import_pipeline.sql — Import year/license on songs + song_duplicates access (Hito 5, #78)
--
-- Spec: features/external-integrations.feature (17 scenarios)
--
-- Design (see odd/tasks/hito5-external-integrations.md):
--   · songs gains year + license/license_confirmed — the import contract's
--     declared metadata. year is DECLARED only, never guessed (mirrors
--     base_tempo "declared, never guessed"): it is the MusicBrainz prefill (S1)
--     and the import-conflict home (S8). license uses the EXACT vocabulary of
--     public_songs (0001:442) — 'public-domain' | 'CC-BY-4.0' | 'proprietary' —
--     enforced by a CHECK constraint (separate ADD CONSTRAINT, additive to the
--     0001 DDL); default 'CC-BY-4.0' mirrors public_songs and the
--     license_confirmed=false default keeps every existing song untouched.
--     An import can only land with an explicit confirmation (S9) and
--     attribution shows source + license only when confirmed (S10).
--   · song_duplicates (0001 DDL) carried NO grants or policies since 0002
--     revoked anon/authenticated — this migration opens the SELECTIVE surface
--     the dedupe review needs (S7: possible-duplicate flag, merge/keep
--     decision): authenticated only; a group is readable/insertable/updatable
--     iff it contains ≥1 song OWNED by the user (subquery over songs —
--     `s.id = any(song_ids) and s.created_by = auth.uid()`; policies may
--     subquery, the DML itself cannot). NO delete grant — the dedupe review
--     is an audit trail that persists (merge stays reversible via
--     unmerge_ok; canonical_id set = merged, NULL = reviewed kept-separate).
--   · Import lineage (S6) needs NO new table: songs.source already carries
--     'Imported from OnSong'; the version row carries
--     name/change_note/metadata.import; lineage_source stays a uuid REF
--     (version fork links) — it cannot hold free text, so it is NOT the
--     import record.
--   · external_enrichments (0001:143) already enumerates source
--     'musicbrainz' | 'lrclib' and field 'lyrics' | 'genre' | 'year' — no new
--     vocabulary needed. BUT 0026's insert policy whitelists source in
--     ('spotify') only, while the import pipeline persists musicbrainz/lrclib
--     suggestions through the same suggestEnrichment path — this migration
--     DROPS + RECREATES that policy with the whitelist widened to
--     ('spotify','musicbrainz','lrclib'), keeping the applied_by/state gates
--     intact (deny-by-default for anything else). external_connections (0026)
--     already takes provider 'planningcenter' as a plain text value.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ══════════════ 1. SONGS: YEAR + LICENSE (declared import metadata) ══════════════
alter table public.songs add column year integer;

comment on column public.songs.year is
  'Declared release year (MusicBrainz prefill / import-conflict home); declared metadata only, never guessed.';

alter table public.songs add column license text not null default 'CC-BY-4.0';
alter table public.songs add column license_confirmed boolean not null default false;

alter table public.songs
  add constraint songs_license_check
  check (license in ('public-domain', 'CC-BY-4.0', 'proprietary'));

comment on column public.songs.license is
  'Import license: ''public-domain'' | ''CC-BY-4.0'' | ''proprietary'' — vocabulary mirrors public_songs (0001:442); default CC-BY-4.0.';
comment on column public.songs.license_confirmed is
  'Import requires explicit license confirmation before a song lands (S9); default false keeps existing songs untouched.';

-- ══════════════ 2. song_duplicates — OWNER-SCOPED ACCESS (dedupe review trail) ══════════════
-- 0002 revoked anon/authenticated and no later migration granted back — this
-- opens the selective surface: authenticated only, group of ≥1 song OWNED by
-- the user is select/insert/update-able. No delete — audit rows persist.
grant select, insert, update on table public.song_duplicates to authenticated;

drop policy if exists song_duplicates_select_owner on public.song_duplicates;
create policy song_duplicates_select_owner on public.song_duplicates
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.songs s
      where s.id = any(song_duplicates.song_ids)
        and s.created_by = (select auth.uid())
    )
  );

drop policy if exists song_duplicates_insert_owner on public.song_duplicates;
create policy song_duplicates_insert_owner on public.song_duplicates
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.songs s
      where s.id = any(song_duplicates.song_ids)
        and s.created_by = (select auth.uid())
    )
  );

drop policy if exists song_duplicates_update_owner on public.song_duplicates;
create policy song_duplicates_update_owner on public.song_duplicates
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.songs s
      where s.id = any(song_duplicates.song_ids)
        and s.created_by = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.songs s
      where s.id = any(song_duplicates.song_ids)
        and s.created_by = (select auth.uid())
    )
  );

-- ══════════════ 3. external_enrichments — INSERT POLICY WIDENING (0026 gap) ══════════════
-- 0026's external_enrichments_insert_suggestion whitelists source in ('spotify')
-- only, but the import pipeline persists musicbrainz (genre/year) and lrclib
-- (lyrics) suggestions through the same suggestEnrichment path (feature #78,
-- T2/T5). Recreating the policy ADDITIVELY — the applied_by/state gates are
-- unchanged, and deny-by-default holds for any source outside the three.
drop policy if exists external_enrichments_insert_suggestion on public.external_enrichments;
create policy external_enrichments_insert_suggestion on public.external_enrichments
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and applied_by = (select auth.uid())
    and state = 'suggested'
    and source in ('spotify', 'musicbrainz', 'lrclib')
  );