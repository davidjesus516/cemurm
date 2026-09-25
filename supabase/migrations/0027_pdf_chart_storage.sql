-- ═══════════════════════════════════════════════════════════════════════════════
-- 0027_pdf_chart_storage.sql — Charts Storage bucket + owner-scoped RLS (Hito 5, #76)
--
-- Spec: features/pdf-scan-charts.feature (9 scenarios)
--
-- Design (see odd/tasks/hito5-pdf-scan-charts.md):
--   · chart_files already carries the contract (0001): 'pdf' is IN the
--     chart_format enum, content is NULL for PDF rows (object_key = Storage
--     path), size_bytes records the upload size. NO DDL change on
--     chart_files/songs/song_versions — this migration is ONLY the Storage
--     surface: one private bucket + owner-folder RLS on storage.objects.
--   · Bucket stays PRIVATE (public=false) — tech-spec R2 direction: signed
--     URLs only, no public bucket. public may NEVER be flipped; direct
--     object reads go through storage-object createSignedUrl, which the
--     storage service authorizes separately from table RLS.
--   · Object keys are `${auth.uid()}/${uuid}.pdf`: the FIRST path segment IS
--     the RLS boundary. Every policy is scoped to bucket 'charts' +
--     owner-folder so (a) an authenticated user can only see/write their own
--     scans and (b) the object key itself is unguessable (uuid suffix).
--   · Insert additionally requires an authenticated uid (nothing anonymous
--     ever lands here). Select/update/delete are owner-folder only — replace
--     = NEW object + NEW chart row (append-only versions), which is exactly
--     the update/delete-scope the Storage API needs and nothing more.
--   · Size limits: PRODUCT cap 10 MB enforced app-side (src/lib/pdfCharts.js
--     validatePdfFile, pre-upload) — the chart_files row is only written AFTER
--     validation; stack file_size_limit "50MiB" (supabase/config.toml) is the
--     hard server cap. Server-side trigger validation is deliberately deferred
--     (documented limitation) — the app guard + upload cap cover the feature
--     contract today.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ══════════════ 1. BUCKET (private — signed URLs only) ══════════════
insert into storage.buckets (id, name, public)
values ('charts', 'charts', false)
on conflict (id) do nothing;

-- ══════════════ 2. OWNER-FOLDER RLS (bucket 'charts' only) ══════════════
-- Owner folder = first path segment = auth.uid()::text. The LIKE guard is a
-- fast pre-filter; foldername() is the authoritative boundary.

drop policy if exists pdf_objects_insert_owner on storage.objects;
create policy pdf_objects_insert_owner on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'charts'
    and (select auth.uid()) is not null
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name like (select (auth.uid())::text || '/%')
  );

drop policy if exists pdf_objects_select_owner on storage.objects;
create policy pdf_objects_select_owner on storage.objects
  for select to authenticated
  using (
    bucket_id = 'charts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists pdf_objects_update_owner on storage.objects;
create policy pdf_objects_update_owner on storage.objects
  for update to authenticated
  using (
    bucket_id = 'charts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'charts'
    and (select auth.uid()) is not null
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name like (select (auth.uid())::text || '/%')
  );

drop policy if exists pdf_objects_delete_owner on storage.objects;
create policy pdf_objects_delete_owner on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'charts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );