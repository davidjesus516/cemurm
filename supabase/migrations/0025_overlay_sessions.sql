-- ═══════════════════════════════════════════════════════════════════════════════
-- 0025_overlay_sessions.sql — OBS Overlay for Streaming (Hito 5, #66)
--
-- Spec: features/obs-overlay.feature (8 scenarios)
--
-- Documented contract deviation: docs/database-schema-v2.md §1.9 classified
--   overlay_sessions as YAGNI ("Pure client/runtime state — realtime surface, not
--   persistent rows") and §2.10.2 mapped obs-overlay sessions to
--   audience_views-style expiring tokens. The OBS Browser Source runs in a
--   SEPARATE Chromium/CEF process, so BroadcastChannel and localStorage (External
--   Display #62 / Projection #79 patterns) never cross browser instances; and
--   Supabase Realtime with an anon SELECT policy would leak EVERY active session
--   and its snapshot to any anonymous subscriber — the capability breaks. The
--   honest model for an uncontrolled public URL is one minimal capability row
--   (precedent: substitution_responses documented deviation in 0023) + an
--   unauthenticated polling RPC: the unguessable session uuid IS the expiring
--   token, and status active|inactive IS the token window. One row per
--   (user, setlist) ⇒ stable overlay URL across streams; enable/disable flips
--   status; overlay_state returns NO song data unless active.
--
-- Design (see odd/tasks/hito5-obs-overlay.md):
--   · Table is deny-by-default: owner lifecycle only (select/insert/update/delete
--     where user_id = auth.uid()). No other read or write surface at all.
--   · overlay_state(p_session_id) — SECURITY DEFINER, search_path locked.
--     Inactive/unknown session ⇒ (false, '', '', '', 0, 0, '') — the overlay
--     serves "inactive" with zero song data, satisfying both the outside-session
--     no-leak scenario and the mid-stream disable scenario at the next poll.
--     EXECUTE granted ONLY to anon — the CEF source holds no JWT; the uuid is
--     the entire authorization.
--   · Composition is NOT part of the contract: the channel pushes the chart body
--     resolved by the stage (song.body); transpose is personal performance state
--     and stays on the operator side.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ══════════════ 0. SESSION ROW (capability + lifecycle) ══════════════
create table public.overlay_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  setlist_id  uuid not null references public.setlists(id),
  status      text not null default 'inactive',   -- 'active' | 'inactive'
  mode        text not null default 'title',      -- 'title' | 'chords' (operator override)
  song_index  integer not null default 0,         -- 0-based position in the setlist
  song_total  integer not null default 0,         -- setlist length ("3 / 6" indicator)
  song_title  text not null default '',
  song_key    text not null default '',
  chart_body  text not null default '',           -- raw ChordPro body of the current chart
  updated_at  timestamptz not null default now(),
  unique (user_id, setlist_id)
);

alter table public.overlay_sessions enable row level security;
-- Client surface (unlike 0023's substitution_responses): the operator UI inserts,
-- updates and reads its own row directly through supabase-js, so authenticated
-- holds table-level grants and the policies below enforce the owner/setlist
-- scope. anon deliberately gets NO table grant (deny-by-default direct reads);
-- its only path is the capability RPC.
revoke all on table public.overlay_sessions from public, anon;
grant select, insert, update, delete on table public.overlay_sessions to authenticated;

-- Owner lifecycle only (0002 style). The operator UI needs select to recover
-- the session id after a reload (stable URL); the overlay itself never reads
-- the table directly — it goes through overlay_state.
create policy overlay_sessions_select_owner on public.overlay_sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Insert/update also require the target setlist to be VISIBLE to the caller
-- (setlists_select_member: owner-or-accepted-collab) — the WITH CHECK EXISTS
-- evaluates that policy as the current user, so a pending outsider cannot plant
-- a junk session for a setlist they cannot see, while an accepted (even
-- view-only) collaborator performing the same show gets their own overlay.
create policy overlay_sessions_insert_owner on public.overlay_sessions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.setlists s where s.id = setlist_id)
  );

create policy overlay_sessions_update_owner on public.overlay_sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.setlists s where s.id = setlist_id)
  );

create policy overlay_sessions_delete_owner on public.overlay_sessions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ══════════════ 1. CAPABILITY RPC (overlay read path) ══════════════
-- Unauthenticated by design: the OBS Browser Source cannot hold a signed JWT.
-- The uuid capability + active status gate the ONLY read of song data; every
-- other caller (including the owner, while inactive) receives the empty row.
create or replace function public.overlay_state(p_session_id uuid)
returns table (active boolean, title text, key text, body text,
               song_index integer, song_total integer, mode text)
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.overlay_sessions%rowtype;
begin
  if p_session_id is null then
    return query select false, '', '', '', 0, 0, '';
    return;
  end if;

  select * into v_row from public.overlay_sessions s where s.id = p_session_id;
  if v_row.id is null or v_row.status <> 'active' then
    return query select false, '', '', '', 0, 0, '';
    return;
  end if;

  return query
    select true,
           v_row.song_title,
           v_row.song_key,
           v_row.chart_body,
           v_row.song_index,
           v_row.song_total,
           v_row.mode;
end $$;

grant execute on function public.overlay_state(uuid) to anon;
revoke execute on function public.overlay_state(uuid) from public, authenticated;

-- ══════════════ 2. UPDATED_AT (0006 trigger convention) ══════════════
create function public.touch_overlay_sessions_updated_at() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger overlay_sessions_bump_updated_at
  before update on public.overlay_sessions
  for each row execute function public.touch_overlay_sessions_updated_at();

revoke all on function public.touch_overlay_sessions_updated_at() from public, anon, authenticated;