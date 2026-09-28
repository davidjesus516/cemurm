-- ═══════════════════════════════════════════════════════════════════════════════
-- 0032_overlay_access_token.sql — the overlay capability is a dedicated token,
--                               NOT the row's primary key
--
-- Spec: features/obs-overlay.feature (10 scenarios after this change)
--
-- Supersedes ONE decision in 0025_overlay_sessions.sql, and only that one. 0025
-- authenticated the public overlay by matching `overlay_sessions.id` — the
-- table's PRIMARY KEY — and returned `song_title`, `song_key` and the full
-- `chart_body`, i.e. the unpublished ChordPro of whatever song is playing.
--
-- WHY the id was the wrong bearer. It is a structurally exposed identifier, not
-- a secret, and the repository says so itself: it is a URL path segment
-- (OVERLAY_URL = (sessionId) => `/overlay/${sessionId}`, consumed by an OBS
-- Browser Source), a route parameter (`/overlay/:sessionId`), and it is
-- mirrored into localStorage (`cemurm:obs:id:<setlistId>`). The same repository
-- already solves this exact problem TWICE on a sibling table:
-- 0017_minors_guardian_consent.sql adds `revocation_token` and
-- 0020_review_batch1.sql adds `sharing_approval_token` — dedicated columns that
-- exist SOLELY to be the secret, while the row's `id` stays an ordinary
-- identifier. 0032 applies that established pattern to the overlay instead of
-- inventing a third shape.
--
-- THE COST THAT WAS NOT HYPOTHETICAL HARDENING. With the id as the capability
-- there was NO way to revoke a leaked overlay URL without visibly stopping the
-- stream: `status` IS the token window, so revoking means disabling means the
-- stream goes dark. And the id cannot be rotated either — `enableOverlay`
-- upserts on ('user_id','setlist_id'), so a new id would fight the stable-URL
-- contract ("the app exposes a stable overlay URL for OBS"). A dedicated token
-- column adds exactly that missing lever: rotate the token, the old URL is dead
-- at its next poll, and the row, the setlist binding and the stream all carry
-- on. That lever is the reason this migration exists.
--
-- WHAT IS NOT CHANGED.
--   · The RLS policies from 0025 are untouched and still deny-by-default (owner
--     lifecycle only: select/insert/update/delete where user_id = auth.uid()).
--     Only the RPC's LOOKUP KEY changes — `access_token` instead of `id`. Table
--     grants are unchanged too: anon still holds NO table grant, so the RPC
--     remains its only path.
--   · overlay_state keeps its contract exactly: SECURITY DEFINER, search_path
--     locked to '', EXECUTE to anon alone, and the same single empty row
--     (false, '', '', '', 0, 0, '') for an unknown, NULL or inactive session —
--     no exception, no oracle.
--   · One row per (user_id, setlist_id) is still the stable-URL contract. The
--     token now rotates WITHIN a row, which the id never could.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ══════════════ 0. CAPABILITY COLUMN ══════════════
-- The secret. It is NOT the primary key and is never accepted as a lookup key,
-- so holding it grants exactly one thing: reading this row's snapshot while it
-- is active. gen_random_uuid() backfills every existing row with a distinct
-- token, which is the revoke lever doing its job — pre-0032 id-based URLs stop
-- resolving here.
alter table public.overlay_sessions
  add column access_token uuid not null default gen_random_uuid();

comment on column public.overlay_sessions.access_token is
  'Bearer capability for the public overlay_state RPC. Dedicated secret on the 0017 revocation_token / 0020 sharing_approval_token pattern: the row id stays an ordinary identifier and is never accepted as a lookup key. Rotatable within the row, so a leaked overlay URL can be revoked without disabling the stream (0032).';

-- ══════════════ 1. CAPABILITY RPC (overlay read path) ══════════════
-- Unauthenticated by design: the OBS Browser Source cannot hold a signed JWT.
-- The token + active status gate the ONLY read of song data; every other caller
-- (including the owner, while inactive) receives the empty row.
--
-- `create or replace` REPLACES 0025's function rather than adding an overload:
-- PostgreSQL keys functions on name + argument TYPES, and both signatures are
-- (uuid), so the body is swapped in place under the same OID. The id-based door
-- is therefore GONE, not deprecated — no second entry point survives that still
-- accepts the primary key, and 0025's grants stay attached to this OID.
create or replace function public.overlay_state(p_access_token uuid)
returns table (active boolean, title text, key text, body text,
               song_index integer, song_total integer, mode text)
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.overlay_sessions%rowtype;
begin
  if p_access_token is null then
    return query select false, '', '', '', 0, 0, '';
    return;
  end if;

  select * into v_row from public.overlay_sessions s where s.access_token = p_access_token;
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

-- Re-asserted rather than assumed: the grants survive the replacement because
-- it is the same OID, and a migration that leaves the anon-only surface implicit
-- is a migration that depends on nobody re-reading 0025.
grant execute on function public.overlay_state(uuid) to anon;
revoke execute on function public.overlay_state(uuid) from public, authenticated;
