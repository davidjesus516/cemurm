-- 0021: Published Plan Freeze (Hito 5 — features/published-plan-freeze.feature).
--
-- Publishing a service plan freezes exactly what members execute:
--   · publish_plan        — leader-only; snapshots the live plan into a version,
--                           flips draft→published on first publish, supersedes
--                           the previous published version, logs the change with
--                           the leader as decider, and notifies every assignee.
--   · get_published_plan  — org-member-or-leader read of the latest published/
--                           executed snapshot plus a same-shaped live draft and
--                           draft_changed, so members never see draft edits and
--                           leaders see the "Changed after publish" marker.
--   · list_plan_versions  — leader-only version history (date, decider, reason).
--   · service_completed_freeze trigger — marking a service completed freezes the
--                           executed version (read-only historical mode).
--
-- No direct client access to service_plan_versions: reads/writes happen ONLY
-- through these SECURITY DEFINER RPCs (same pattern as locked helpers in 0006).

create table public.service_plan_versions (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  version_number integer not null,
  status text not null default 'published'
    check (status in ('published', 'superseded', 'executed')),
  snapshot jsonb not null,
  reason text not null default '',
  published_by uuid not null default auth.uid() references auth.users(id),
  published_at timestamptz not null default now(),
  unique (service_id, version_number)
);

alter table public.service_plan_versions enable row level security;

-- The version table is not a client surface: deny direct access (owner RPCs
-- and service_role/SQL console are the only readers).
revoke all on public.service_plan_versions from public, anon, authenticated;
grant select on public.service_plan_versions to service_role;

-- One snapshot shape for BOTH publish and draft comparison (same builder), so
-- draft_changed is structural equality, never a hand-maintained view.
create or replace function private.build_plan_snapshot(p_service_id uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'block_id', b.id,
        'name', b.name,
        'position', b.position,
        'time_budget', b.time_budget,
        'start_offset_minutes', b.start_offset_minutes,
        'songs', coalesce((
          select jsonb_agg(jsonb_build_object(
            'song_id', si.song_id,
            'title', coalesce((select so.title from public.songs so where so.id = si.song_id), 'Unknown'),
            'agreed_key', si.agreed_key
          ) order by si.position)
          from public.setlist_items si
          where si.setlist_id = b.setlist_id
        ), '[]'::jsonb),
        'assignments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'user_id', a.user_id,
            'part', a.part,
            'is_substitute', a.is_substitute,
            'covered_by', a.covered_by,
            'call_lead_minutes', a.call_lead_minutes
          ))
          from public.service_assignments a
          where a.service_id = b.service_id and a.block_id = b.id
        ), '[]'::jsonb)
      ) order by b.position)
      from public.service_blocks b
      where b.service_id = p_service_id
    ), '[]'::jsonb)
  )
$$;

create or replace function public.publish_plan(p_service_id uuid, p_reason text default '')
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_org_id        uuid;
  v_leader        uuid;
  v_status        text;
  v_service_name  text;
  v_snapshot      jsonb;
  v_prev_snapshot jsonb;
  v_version       integer;
  v_changed       boolean := false;
  v_assignee      uuid;
begin
  select s.org_id, s.leader_id, s.status, s.name
    into v_org_id, v_leader, v_status, v_service_name
    from public.services s where s.id = p_service_id;

  if v_org_id is null then
    raise exception 'Service not found';
  end if;
  if v_leader is distinct from (select auth.uid())
     or private.is_org_member((select auth.uid()), v_org_id) is null then
    raise exception 'Only the service leader can publish the plan';
  end if;
  if v_status = 'completed' then
    raise exception 'A completed service is read-only';
  end if;

  v_snapshot := private.build_plan_snapshot(p_service_id);

  select snapshot into v_prev_snapshot
    from public.service_plan_versions
    where service_id = p_service_id and status in ('published', 'executed')
    order by version_number desc
    limit 1;
  v_changed := v_prev_snapshot is not null and v_prev_snapshot <> v_snapshot;

  select coalesce(max(version_number), 0) + 1 into v_version
    from public.service_plan_versions
    where service_id = p_service_id;

  -- Supersede the previous published version FIRST, then insert the new one;
  -- insert-after-supersede inside one transaction leaves the new row published
  -- (an insert-then-supersede order would immediately supersede the new row).
  update public.service_plan_versions
    set status = 'superseded'
    where service_id = p_service_id and status = 'published';

  insert into public.service_plan_versions (service_id, version_number, snapshot, reason)
    values (p_service_id, v_version, v_snapshot, coalesce(p_reason, ''))
    returning version_number into v_version;

  -- First publish flips the service from draft to published; re-publish keeps it.
  if v_status = 'draft' then
    update public.services set status = 'published' where id = p_service_id;
  end if;

  -- Log with the leader as decider (service_change_log is the audit surface).
  insert into public.service_change_log (service_id, actor_id, action, detail)
    values (
      p_service_id,
      (select auth.uid()),
      'publish',
      jsonb_build_object(
        'version', v_version,
        'reason', coalesce(p_reason, ''),
        'changed', v_changed
      )
    );

  -- Notify every distinct assignee; public.notify_user self-suppresses the actor.
  for v_assignee in
    select distinct a.user_id
    from public.service_assignments a
    where a.service_id = p_service_id and a.user_id is not null
  loop
    perform public.notify_user(
      v_assignee,
      'system',
      case when v_version = 1
        then 'Plan published — ' || coalesce(v_service_name, '')
        else 'Plan re-published — ' || coalesce(v_service_name, '')
      end,
      case when v_version = 1
        then 'The plan is now the version members execute.'
        else 'Version ' || v_version
             || case when coalesce(p_reason, '') <> '' then ' (' || p_reason || ')' else '' end
             || ' — previous version stays in history.'
      end,
      jsonb_build_object('service_id', p_service_id, 'version', v_version)
    );
  end loop;

  return v_version;
end $$;

-- Members (and the leader) always read the latest published/executed snapshot;
-- the live draft is returned only for the "Changed after publish" comparison.
create or replace function public.get_published_plan(p_service_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org_id     uuid;
  v_leader     uuid;
  v_status     text;
  v_row        public.service_plan_versions%rowtype;
  v_draft      jsonb;
begin
  select s.org_id, s.leader_id, s.status
    into v_org_id, v_leader, v_status
    from public.services s where s.id = p_service_id;

  if v_org_id is null then
    raise exception 'Service not found';
  end if;
  if v_leader is distinct from (select auth.uid())
     and private.is_org_member((select auth.uid()), v_org_id) is null then
    raise exception 'Not visible to this user';
  end if;

  v_draft := private.build_plan_snapshot(p_service_id);

  select * into v_row
    from public.service_plan_versions
    where service_id = p_service_id and status in ('published', 'executed')
    order by version_number desc
    limit 1;

  if not found then
    return jsonb_build_object('published', false, 'draft', v_draft, 'draft_changed', false);
  end if;

  return jsonb_build_object(
    'published', true,
    'version_number', v_row.version_number,
    'status', v_row.status,
    'published_at', v_row.published_at,
    'published_by', v_row.published_by,
    'reason', v_row.reason,
    'snapshot', v_row.snapshot,
    'draft', v_draft,
    'draft_changed', v_draft <> v_row.snapshot
  );
end $$;

-- Leader-only version history: date, decider display name, reason, status.
create or replace function public.list_plan_versions(p_service_id uuid)
returns table (
  version_number   integer,
  status           text,
  published_at     timestamptz,
  published_by     uuid,
  published_by_name text,
  reason           text
)
language plpgsql security definer set search_path = '' as $$
declare
  v_org_id uuid;
  v_leader uuid;
  v_status text;
begin
  select s.org_id, s.leader_id, s.status
    into v_org_id, v_leader, v_status
    from public.services s where s.id = p_service_id;

  if v_org_id is null then
    raise exception 'Service not found';
  end if;
  if v_leader is distinct from (select auth.uid()) then
    raise exception 'Only the service leader can view version history';
  end if;

  return query
    select v.version_number, v.status, v.published_at, v.published_by,
           coalesce(private.display_name_for(v.published_by), 'Unknown'),
           v.reason
    from public.service_plan_versions v
    where v.service_id = p_service_id
    order by v.version_number desc;
end $$;

-- Marking a service completed freezes the executed version for read-only history.
create or replace function private.freeze_executed_version()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.service_plan_versions
      set status = 'executed'
      where service_id = new.id and status = 'published';
  end if;
  return new;
end $$;

create trigger service_completed_freeze
  before update of status on public.services
  for each row execute function private.freeze_executed_version();

-- Authenticated callers get EXECUTE on the RPCs only; never table access.
grant execute on function public.publish_plan(uuid, text) to authenticated;
grant execute on function public.get_published_plan(uuid) to authenticated;
grant execute on function public.list_plan_versions(uuid) to authenticated;
revoke execute on function public.publish_plan(uuid, text) from public, anon;
revoke execute on function public.get_published_plan(uuid) from public, anon;
revoke execute on function public.list_plan_versions(uuid) from public, anon;

-- ── repo-health (discovered by live smoke on the merged 0018 contract) ──
-- The service-leader UI mutates services, blocks and assignments DIRECTLY
-- through PostgREST (createService/updateServiceStatus in src/lib/services.js,
-- createBlock/updateBlock/deleteBlock, unassignMusician), but 0018 granted
-- authenticated only SELECT on those tables, so every live service status
-- flip, block CRUD and unassign hit "permission denied" before RLS could
-- authorize the leader. The freeze feature depends on the leader draft-edit
-- path ("edit after publish → Changed after publish") and the completed
-- freeze, so restore the grants the policies already anticipate (policies
-- remain the authority: leader-only, not completed).
grant insert, update on public.services to authenticated;
grant insert, update, delete on public.service_blocks to authenticated;
grant delete on public.service_assignments to authenticated;