-- CEMURM 0003 — chart_files + song_versions RLS grants & policies
--
-- Gap closed: 0002 part 1 revokes ALL from anon/authenticated on these two
-- tables (lines 70–71) but part 2 never re-opened them — the Hito 1 data
-- layer (songs content lives in chart_files.content, key/bpm/readiness in
-- song_versions) was left deny-by-default for the authenticated role. Once
-- real clients write songs, every create/read of their content 403s.
--
-- Pattern follows 0002 exactly: policies AFTER revokes, grants AFTER
-- policies (D6 order). Owner scope = songs.created_by for chart_files;
-- song_versions additionally honors its version owner_id (the only user who
-- may rebase a version — design line 113).

-- ══════════════════════ CHART_FILES (content payload of a song) ══════════════════════
-- Visibility inherits the song: the song creator may CRUD its chart files.
drop policy if exists chart_files_select_owner on public.chart_files;
create policy chart_files_select_owner on public.chart_files
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.songs s
      where s.id = public.chart_files.song_id
        and s.created_by = (select auth.uid())
    )
  );

drop policy if exists chart_files_insert_owner on public.chart_files;
create policy chart_files_insert_owner on public.chart_files
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.songs s
      where s.id = public.chart_files.song_id
        and s.created_by = (select auth.uid())
    )
  );

drop policy if exists chart_files_update_owner on public.chart_files;
create policy chart_files_update_owner on public.chart_files
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.songs s
      where s.id = public.chart_files.song_id
        and s.created_by = (select auth.uid())
    )
  );

drop policy if exists chart_files_delete_owner on public.chart_files;
create policy chart_files_delete_owner on public.chart_files
  for delete to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.songs s
      where s.id = public.chart_files.song_id
        and s.created_by = (select auth.uid())
    )
  );

-- ══════════════════════ SONG_VERSIONS (key / tempo / readiness / lineage) ══════════════════════
-- SELECT: song creator, plus the version owner (may always see their own).
-- INSERT/UPDATE/DELETE: song creator AND version owner — a version's owner
-- is the only user who may rebase it (design line 113).
drop policy if exists song_versions_select_owner on public.song_versions;
create policy song_versions_select_owner on public.song_versions
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and (
      owner_id = (select auth.uid())
      or exists (
        select 1 from public.songs s
        where s.id = public.song_versions.song_id
          and s.created_by = (select auth.uid())
      )
    )
  );

drop policy if exists song_versions_insert_owner on public.song_versions;
create policy song_versions_insert_owner on public.song_versions
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and owner_id = (select auth.uid())
    and exists (
      select 1 from public.songs s
      where s.id = public.song_versions.song_id
        and s.created_by = (select auth.uid())
    )
  );

drop policy if exists song_versions_update_owner on public.song_versions;
create policy song_versions_update_owner on public.song_versions
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and owner_id = (select auth.uid())
    and exists (
      select 1 from public.songs s
      where s.id = public.song_versions.song_id
        and s.created_by = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) is not null
    and owner_id = (select auth.uid())
    and exists (
      select 1 from public.songs s
      where s.id = public.song_versions.song_id
        and s.created_by = (select auth.uid())
    )
  );

drop policy if exists song_versions_delete_owner on public.song_versions;
create policy song_versions_delete_owner on public.song_versions
  for delete to authenticated
  using (
    (select auth.uid()) is not null
    and owner_id = (select auth.uid())
    and exists (
      select 1 from public.songs s
      where s.id = public.song_versions.song_id
        and s.created_by = (select auth.uid())
    )
  );

-- ══════════════════════ GRANTS AFTER POLICIES (D6 ORDER) ══════════════════════
grant select, insert, update, delete on table public.chart_files,
  public.song_versions to authenticated;