-- 0022: Congregation Projection (Hito 5 — features/congregation-projection.feature).
--
-- The projection SESSION is pure client/runtime state (schema contract: realtime
-- surface, not persistent rows) — the operator device owns the slide deck and the
-- congregation display follows over a BroadcastChannel popup. This migration adds
-- ONLY the small backend contract the BDD needs:
--
--   · projection_licenses        — per-song projection gate. A song with a live
--                                  public_songs entry licensed 'proprietary' is
--                                  blocked ("Not licensed for public projection");
--                                  a permissive/absent entry is projectable (the
--                                  org owns its unpublished repertoire).
--   · record_typo_fix            — live lyric fix: updates the latest chart content
--                                  and creates a NEW song_versions entry (next
--                                  number, change_note 'Fixed lyric typo', editor
--                                  = auth.uid(), timestamp = created_at).
--   · log_projection_blocked     — audit the block into service_change_log (action
--                                  'projection_blocked') so the operator sees it.
--
-- All three are SECURITY DEFINER RPCs: authenticated callers get EXECUTE only,
-- never new table access (same pattern as the 0018/0021 service cores and the
-- locked helpers in 0006). song_versions/chart_files writes stay behind the RPC;
-- the projection surface never touches songs/setlists/audience_views directly.

-- ══════════════════════ projection_licenses (RPC) ══════════════════════
-- Batch gate for a deck build. Scope: every non-NULL org the songs belong to must
-- contain the caller (system-level songs, org_id NULL, are org-shared repertoire
-- and pass). Status: only a LIVE public_songs entry counts; superseded/removed
-- entries do not gate projection.
create or replace function public.projection_licenses(p_song_ids uuid[])
returns table (song_id uuid, projectable boolean, reason text)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := (select auth.uid());
  v_org_id uuid;
begin
  if v_uid is null or p_song_ids is null or cardinality(p_song_ids) = 0 then
    raise exception 'No songs selected';
  end if;

  -- Scope: caller must be an org member of every org the songs live in.
  for v_org_id in
    select distinct s.org_id
    from public.songs s
    where s.id = any(p_song_ids) and s.org_id is not null
  loop
    if private.is_org_member(v_uid, v_org_id) is null then
      raise exception 'Not visible to this user';
    end if;
  end loop;

  return query
    select s.id                                                            as song_id,
           coalesce(ps.license, '') <> 'proprietary'                       as projectable,
           case when ps.license = 'proprietary'
                then 'Not licensed for public projection'
                else ''::text end                                          as reason
    from unnest(p_song_ids) as s(id)
    left join lateral (
      select ps.license
      from public.public_songs ps
      where ps.song_id = s.id and ps.status = 'live'
      limit 1
    ) ps on true;
end $$;

-- ══════════════════════ record_typo_fix (RPC) ══════════════════════
-- Live lyric fix from the operator console. Writes stay inside one transaction:
--   1. Update the latest chart's inline content (size_bytes kept honest).
--   2. Insert a NEW song_versions row — next number, change_note
--      'Fixed lyric typo', created_by = the operator (editor), created_at now.
-- Returns the new version number. A song with no prior chart gets one created.
create or replace function public.record_typo_fix(p_song_id uuid, p_body text)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := (select auth.uid());
  v_org_id uuid;
  v_chart  uuid;
  v_number integer;
  v_prev   public.song_versions%rowtype;
begin
  if v_uid is null then
    raise exception 'Song not found';
  end if;

  select s.org_id into v_org_id from public.songs s where s.id = p_song_id;
  if v_org_id is null then
    raise exception 'Song not found';
  end if;
  if private.is_org_member(v_uid, v_org_id) is null then
    raise exception 'Song not found';
  end if;

  if coalesce(p_body, '') = '' then
    raise exception 'Lyric text cannot be empty';
  end if;

  -- Latest chart + version as the baseline.
  select sv.chart_file_id into v_chart
  from public.song_versions sv
  where sv.song_id = p_song_id
  order by sv.number desc
  limit 1;

  if v_chart is null then
    insert into public.chart_files (song_id, format, object_key, content, size_bytes)
    values (p_song_id, 'chordpro', '', p_body, length(p_body))
    returning id into v_chart;
  else
    update public.chart_files
    set content = p_body, size_bytes = length(p_body)
    where id = v_chart;
  end if;

  select * into v_prev
  from public.song_versions sv
  where sv.song_id = p_song_id
  order by sv.number desc
  limit 1;

  v_number := coalesce(v_prev.number, 0) + 1;

  insert into public.song_versions
    (song_id, name, number, chart_file_id, base_key, base_tempo, duration_seconds,
     section_context, is_ready, owner_id, created_by, change_note)
  values
    (p_song_id,
     coalesce(v_prev.name, 'Version ' || v_number),
     v_number,
     v_chart,
     v_prev.base_key,
     v_prev.base_tempo,
     v_prev.duration_seconds,
     v_prev.section_context,
     v_prev.is_ready,
     v_prev.owner_id,
     v_uid,
     'Fixed lyric typo');

  return v_number;
end $$;

-- ══════════════════════ log_projection_blocked (RPC) ══════════════════════
-- Block audit: the operator attempted to project a song without projection
-- rights; record it in the service's change log (member-readable via 0018's
-- select policy). This is an audit record, not a plan mutation — completed
-- services stay read-only for plan edits but keep auditable projection events.
create or replace function public.log_projection_blocked(
  p_service_id uuid,
  p_song_id    uuid,
  p_reason     text
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not private.service_visible_to_session(p_service_id) then
    raise exception 'Service not found';
  end if;

  insert into public.service_change_log (service_id, actor_id, action, detail)
  values (p_service_id, v_uid, 'projection_blocked',
          jsonb_build_object(
            'song_id', p_song_id,
            'reason', coalesce(p_reason, 'Not licensed for public projection')));
end $$;

-- Authenticated callers get EXECUTE on the RPCs only; anon/public never.
grant execute on function public.projection_licenses(uuid[]) to authenticated;
grant execute on function public.record_typo_fix(uuid, text) to authenticated;
grant execute on function public.log_projection_blocked(uuid, uuid, text) to authenticated;
revoke execute on function public.projection_licenses(uuid[]) from public, anon;
revoke execute on function public.record_typo_fix(uuid, text) from public, anon;
revoke execute on function public.log_projection_blocked(uuid, uuid, text) from public, anon;