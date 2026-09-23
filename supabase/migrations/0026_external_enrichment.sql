-- ═══════════════════════════════════════════════════════════════════════════════
-- 0026_external_enrichment.sql — External Auto-Tagging from Spotify (Hito 5, #69)
--
-- Spec: features/external-autotagging.feature (9 scenarios)
--
-- Design (see odd/tasks/hito5-spotify-autotagging.md):
--   · external_connections (#41) is ported as the MINIMAL user-scope contract for
--     this feature: one row per (user_id, provider), 'connected'|'revoked'
--     lifecycle. Disconnect (T4) flips status to 'revoked' — the row persists and
--     the unique(user_id, provider) constraint makes a reconnect an upsert back
--     to 'connected'. NO delete grant: revocation is a status flip, never a row
--     deletion (YAGNI delete; #78 owns the full OAuth connect UX later).
--   · external_enrichments (0001 DDL) carried NO grants or policies since 0002
--     revoked anon/authenticated — this migration opens a SELECTIVE surface and
--     adds the three policies from the task contract. NO ALTER, no new columns:
--     applied_by is the owner link for EVERY row (suggested rows are "created by",
--     applied rows record who applied) — one column carries all states, so the
--     0001 DDL stays verbatim (documented deviation note: schema-v2 §3).
--   · Insert policy is suggestion-only (state='suggested', source in ('spotify')):
--     the app proposes, the state machine (suggested → applied|discarded) runs
--     through update, and ONLY the row's creator flips state. The song owner
--     (created_by) may READ applied provenance on their song even when another
--     user applied the suggestion — that is the "applied values readable by song
--     owner" branch of the select policy; the action creator can always read
--     their own rows.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ══════════════ 1. external_connections (contract #41, minimal port) ══════════════
create table public.external_connections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  provider   text not null,                 -- 'spotify' (others land with #78)
  status     text not null default 'connected',  -- 'connected' | 'revoked'
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.external_connections enable row level security;
-- deny-by-default (0023/0025 pattern: revoke from public too — anon/authenticated
-- inherit PUBLIC membership, so revoking direct grants alone is not enough).
revoke all on table public.external_connections from public, anon, authenticated;
grant select, insert, update on table public.external_connections to authenticated;
-- NO delete grant: revocation = status flip, row persists (YAGNI delete).

drop policy if exists external_connections_select_owner on public.external_connections;
create policy external_connections_select_owner on public.external_connections
  for select to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists external_connections_insert_owner on public.external_connections;
create policy external_connections_insert_owner on public.external_connections
  for insert to authenticated
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists external_connections_update_owner on public.external_connections;
create policy external_connections_update_owner on public.external_connections
  for update to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()))
  with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

-- ══════════════ 2. external_enrichments — selective open (0002 revoked all) ══════════════
grant select, insert, update on table public.external_enrichments to authenticated;
-- NO delete — state machine only; no grant to anon.

drop policy if exists external_enrichments_select_owner on public.external_enrichments;
create policy external_enrichments_select_owner on public.external_enrichments
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and (
      applied_by = (select auth.uid())
      or (state = 'applied' and song_id in (
        select id from public.songs where created_by = (select auth.uid())
      ))
    )
  );

drop policy if exists external_enrichments_insert_suggestion on public.external_enrichments;
create policy external_enrichments_insert_suggestion on public.external_enrichments
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and applied_by = (select auth.uid())
    and state = 'suggested'
    and source in ('spotify')
  );

drop policy if exists external_enrichments_update_creator on public.external_enrichments;
create policy external_enrichments_update_creator on public.external_enrichments
  for update to authenticated
  using ((select auth.uid()) is not null and applied_by = (select auth.uid()));