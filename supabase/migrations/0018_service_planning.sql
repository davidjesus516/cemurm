-- CEMURM 0018 — Service Planning backend: schema additions, services-family RLS, plan RPCs
--
-- Slice: features/service-planning.feature (backend). Base = feat/hito4-service-planning
-- (0001–0013 applied on this branch; intermediate migration numbers live on other
-- feature branches and are intentionally NOT referenced — 0018's next-number gap is
-- structural, not a dependency).
-- The tables services/service_blocks/service_assignments/substitution_requests already
-- exist in 0001 (lines 322/332/342/355); this migration only ADDS columns, switches on
-- RLS + policies for the services family, and ships the plan-edit/validate RPC surface.
-- substitution_requests stays completely untouched this slice (deny-by-default; the
-- substitution UI + coverage flow is a separate feature — here the plan only warns
-- "has no musicians assigned").
--
-- Scenario map (14 BDD scenarios → backend surface):
--  · ordered blocks (S1) / reorder (S3)      → service_blocks.position + reorder_service_blocks
--  · setlist fills a block (S2/S4)           → service_blocks.setlist_id (0001, untouched)
--    + agreed_key carried by setlist_items (0001) — the swap RPC clears it on song change
--  · time budget warns on overrun (S5)       → validate_service_plan 'overrun'
--    (est = declared version duration, else latest version; message = BDD literal)
--  · assign musicians (S6)                   → assign_musician (leader-only) + change_log 'assign'
--  · sequential coverage OK (S7) / overlap   → block intervals [offset, offset+budget];
--    conflicts (S8)                            overlap = same user, intervals intersect
--                                              (assign_musician raises; validate warns)
--  · uncovered block warns (S9)              → validate_service_plan 'uncovered'
--  · call sheet (S10/S11)                    → services.starts_at + call_lead_minutes
--                                              (call time = block start − lead; agreed key
--                                              from setlist_items.vocal/agreed_key — 0001)
--  · members check in (S12)                  → check_in RPC + checkin_self UPDATE policy
--                                              + column grant update (checkin_at)
--  · last-minute song swap (S13)             → swap_block_song (notifies assigned members,
--                                              logs actor as decider, change_log 'song_swap')
--  · plan read-only for members (S14)        → every mutating RPC guards leader + status
--                                              <> 'completed'; member writes raise
--                                              'Only the service leader can edit the plan'
--  · rehearsal outcomes (S15)                → validate_service_plan 'needs_work' (rehearsal_items)
--  · completed service read-only (S16)       → status='completed' freezes rows + RPCs
--  · offline plan/check-in (S17)             → schema only this slice (check_in is replayable);
--                                              service worker + outbox queue are client/Hito 5
--
-- Contracts honored (0002/0013 precedents):
--  · D6 order per table: RLS enable → revoke all (re-ship the 0002 lock) → policies →
--    targeted grants AFTER policies. Anon gets nothing anywhere.
--  · RLS recursion contract (0002 header lines 136-141): child-table policies resolve
--    parent scope via a single-relation EXISTS on services ONLY; services' own policies
--    resolve org access through the 0002 SECURITY DEFINER helper private.is_org_member
--    (session-bound; real signature is is_org_member(user_id uuid, org_id uuid) — the
--    two-arg form, NOT the single-arg shape the plan draft assumed) → the policy graph
--    is acyclic (no table's policy references a table whose policies reference it back).
--  · helpers/RPC cores are SECURITY DEFINER, set search_path = '' and fully-qualified
--    refs everywhere (0002 line 55); public wrappers delegate to the private cores
--    (0010/0011/0012/0013 pattern) so PostgREST (db.schemas = public, graphql_public) can
--    reach them; private cores are locked from public/anon, wrappers authenticated-only.
--  · user-facing strings below are EXACT literals (BDD wording, em-dash U+2014 verbatim)
--    — the client maps them; overlap validation is skipped entirely when
--    services.starts_at IS NULL (no times → no overlap).

-- ══════════════════════ 1. SCHEMA ADDITIONS ══════════════════════
-- services.starts_at — the service day/time the call sheet + overlap checks need
-- (0001 line 322 created services WITHOUT it; add, don't recreate).
alter table public.services add column starts_at timestamptz;

-- service_blocks.start_offset_minutes — minutes after service start; the block's
-- interval is [starts_at + offset, starts_at + offset + time_budget].
alter table public.service_blocks add column start_offset_minutes integer not null default 0;

-- service_assignments.call_lead_minutes — call time = block start − lead (call sheet).
alter table public.service_assignments add column call_lead_minutes integer not null default 15;

-- song swap / reorder / assignment audit (scenario 13: "the change is logged with the
-- leader as decider"); written ONLY by the definer RPCs — no client INSERT policy.
create table public.service_change_log (
  id          uuid primary key default gen_random_uuid(),
  service_id  uuid not null references public.services(id) on delete cascade,
  actor_id    uuid not null references auth.users(id),
  action      text not null,                      -- 'song_swap' | 'reorder' | 'assign' | 'unassign'
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index idx_service_change_log_service on public.service_change_log (service_id, created_at desc);

-- ══════════════════════ 2. RLS — SERVICES FAMILY (D6: enable → revoke → policies → grants) ══════════════════════
-- Visibility scope: org members (via 0002's session-bound private.is_org_member — branch
-- members are org members through org_memberships and share org_id, so ONE org helper
-- covers org + branch rows; the songs org/branch visibility pattern is mirrored, not
-- reinvented) OR the service leader. Write scope: the leader only, and never on a
-- 'completed' service.

alter table public.services enable row level security;
alter table public.service_blocks enable row level security;
alter table public.service_assignments enable row level security;
alter table public.service_change_log enable row level security;

-- re-ship the 0002 lock (0002 lines 97-100) so 0018 stands alone: deny-by-default
-- before the first targeted grant.
revoke all on table public.services from public, anon, authenticated;
revoke all on table public.service_blocks from public, anon, authenticated;
revoke all on table public.service_assignments from public, anon, authenticated;
revoke all on table public.service_change_log from public, anon, authenticated;

-- ── services ──
-- SELECT: org member (helper returns role text; NULL = not member) or leader.
-- INSERT: the leader creating for their own org. UPDATE: leader may edit while not
-- completed — with a WITH CHECK that also admits 'completed', so the leader can
-- COMPLETE the service exactly once (completing passes USING on the old row); once
-- completed, USING excludes the row and no further edits land. DELETE: leader, not completed.
drop policy if exists services_select_member on public.services;
create policy services_select_member on public.services
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and (
      private.is_org_member((select auth.uid()), org_id) is not null
      or leader_id = (select auth.uid())
    )
  );

drop policy if exists services_insert_leader on public.services;
create policy services_insert_leader on public.services
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and leader_id = (select auth.uid())
    and private.is_org_member((select auth.uid()), org_id) is not null
  );

drop policy if exists services_update_leader on public.services;
create policy services_update_leader on public.services
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and leader_id = (select auth.uid())
    and status <> 'completed'
  )
  with check (
    (select auth.uid()) is not null
    and leader_id = (select auth.uid())
    and (status in ('draft', 'published') or status = 'completed')
  );

drop policy if exists services_delete_leader on public.services;
create policy services_delete_leader on public.services
  for delete to authenticated
  using (
    (select auth.uid()) is not null
    and leader_id = (select auth.uid())
    and status <> 'completed'
  );

-- ── service_blocks ──
-- Scope inherits the parent service through a single-relation EXISTS on services
-- (acyclic graph: service_blocks → services only). SELECT = member-or-leader;
-- INSERT/UPDATE/DELETE = leader of the parent + parent not completed.
drop policy if exists service_blocks_select_member on public.service_blocks;
create policy service_blocks_select_member on public.service_blocks
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.services s
      where s.id = public.service_blocks.service_id
        and (
          private.is_org_member((select auth.uid()), s.org_id) is not null
          or s.leader_id = (select auth.uid())
        )
    )
  );

drop policy if exists service_blocks_insert_leader on public.service_blocks;
create policy service_blocks_insert_leader on public.service_blocks
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.services s
      where s.id = public.service_blocks.service_id
        and s.leader_id = (select auth.uid())
        and s.status <> 'completed'
    )
  );

drop policy if exists service_blocks_update_leader on public.service_blocks;
create policy service_blocks_update_leader on public.service_blocks
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.services s
      where s.id = public.service_blocks.service_id
        and s.leader_id = (select auth.uid())
        and s.status <> 'completed'
    )
  )
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.services s
      where s.id = public.service_blocks.service_id
        and s.leader_id = (select auth.uid())
        and s.status <> 'completed'
    )
  );

drop policy if exists service_blocks_delete_leader on public.service_blocks;
create policy service_blocks_delete_leader on public.service_blocks
  for delete to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.services s
      where s.id = public.service_blocks.service_id
        and s.leader_id = (select auth.uid())
        and s.status <> 'completed'
    )
  );

-- ── service_assignments ──
-- SELECT: member-or-leader scope like blocks. INSERT/DELETE: leader of the parent +
-- parent not completed. The ONLY UPDATE policy is the member's SELF check-in: USING
-- admits the assignee's own row while NOT yet checked in; WITH CHECK requires
-- checkin_at to flip to non-NULL — the member marks THEMSELVES present exactly once
-- (scenario 12). Only the checkin_at column is client-updatable (column grant below);
-- everything else on assignments is RPC-written.
drop policy if exists service_assignments_select_member on public.service_assignments;
create policy service_assignments_select_member on public.service_assignments
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.services s
      where s.id = public.service_assignments.service_id
        and (
          private.is_org_member((select auth.uid()), s.org_id) is not null
          or s.leader_id = (select auth.uid())
        )
    )
  );

drop policy if exists service_assignments_insert_leader on public.service_assignments;
create policy service_assignments_insert_leader on public.service_assignments
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.services s
      where s.id = public.service_assignments.service_id
        and s.leader_id = (select auth.uid())
        and s.status <> 'completed'
    )
  );

drop policy if exists service_assignments_delete_leader on public.service_assignments;
create policy service_assignments_delete_leader on public.service_assignments
  for delete to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.services s
      where s.id = public.service_assignments.service_id
        and s.leader_id = (select auth.uid())
        and s.status <> 'completed'
    )
  );

drop policy if exists service_assignments_checkin_self on public.service_assignments;
create policy service_assignments_checkin_self on public.service_assignments
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and checkin_at is null
  )
  with check (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and checkin_at is not null
  );

-- ── service_change_log ──
-- SELECT for members (scenario 13 audit trail); NO insert/update/delete policy — the
-- definer swap/reorder/assign RPCs are the only writers.
drop policy if exists service_change_log_select_member on public.service_change_log;
create policy service_change_log_select_member on public.service_change_log
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.services s
      where s.id = public.service_change_log.service_id
        and (
          private.is_org_member((select auth.uid()), s.org_id) is not null
          or s.leader_id = (select auth.uid())
        )
    )
  );

-- ── grants AFTER policies (D6) — SELECT-only for the family (writes are RPC-only, the
-- 0001 "community WRITE" design; 0013 follows precedent) plus the single client-writable
-- column; substitution_requests gets NO grant (stays deny-by-default, untouched).
grant select on table public.services to authenticated;
grant select on table public.service_blocks to authenticated;
grant select on table public.service_assignments to authenticated;
grant update (checkin_at) on table public.service_assignments to authenticated;
grant select on table public.service_change_log to authenticated;

-- ══════════════════════ 3. SHARED DEFINER HELPERS (private) ══════════════════════
-- Scope helpers for the RPC cores (definer, so no RLS concern). The RLS policies use
-- the inline EXISTS shape above — these helpers exist for the RPC guard layer only.

-- service visible to the current session: an org member of the service's org, or its leader.
create function private.service_visible_to_session(p_service_id uuid) returns boolean
  language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.services s
    where s.id = p_service_id
      and (select auth.uid()) is not null
      and (
        private.is_org_member((select auth.uid()), s.org_id) is not null
        or s.leader_id = (select auth.uid())
      )
  ) $$;

-- service writable by the current session: leader and not completed (read-only once done).
create function private.service_writable_by_session(p_service_id uuid) returns boolean
  language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.services s
    where s.id = p_service_id
      and s.leader_id = (select auth.uid())
      and s.status <> 'completed'
  ) $$;

-- computed block interval in minutes-since-service-start: [start_offset_minutes,
-- start_offset_minutes + time_budget]. services.starts_at is deliberately NOT part of
-- this — callers decide whether times exist (no times → no overlap).
create function private.block_interval(p_block_id uuid)
  returns table (start_min integer, end_min integer)
  language sql security definer stable set search_path = '' as $$
  select coalesce(b.start_offset_minutes, 0),
         coalesce(b.start_offset_minutes, 0) + coalesce(b.time_budget, 0)
  from public.service_blocks b
  where b.id = p_block_id $$;

-- human-readable member name for warnings/notifications: display_name → username → 'Someone'.
create or replace function private.display_name_for(p_user_id uuid) returns text
  language sql security definer stable set search_path = '' as $$
  select coalesce(
    (select p.display_name from public.profiles p where p.id = p_user_id),
    (select p.username    from public.profiles p where p.id = p_user_id),
    'Someone') $$;

-- ══════════════════════ 4. RPCs — DEFINER CORE + PUBLIC WRAPPER ══════════════════════
-- ═══════════════ validate_service_plan (core) ═══════════════
-- Returns {warnings: [{kind, message}]}; kind ∈ 'overrun'|'uncovered'|'overlap'|'needs_work'.
-- Overlap warnings are skipped entirely when services.starts_at IS NULL (no times → no overlap).
create or replace function private.validate_service_plan(p_service_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_warnings jsonb := '[]'::jsonb;
  v_service  public.services%rowtype;
  r          record;
  v_est_min  integer;
begin
  -- member-or-leader scope guard; the definer core reads as postgres (RLS irrelevant)
  if not private.service_visible_to_session(p_service_id) then
    raise exception 'Service not found.';
  end if;

  select * into v_service from public.services s where s.id = p_service_id;

  -- 1. OVERRUN: blocks with a setlist AND a time budget. Per-item estimate = the
  --    declared duration of the chosen version, else the latest version's duration,
  --    else 0 (no declared duration → counted as 0, never an invented estimate).
  for r in
    select b.name                                as block_name,
           b.time_budget                         as budget,
           coalesce(sum(coalesce(
             (select sv.duration_seconds from public.song_versions sv where sv.id = si.version_id),
             (select sv2.duration_seconds from public.song_versions sv2
               where sv2.song_id = si.song_id order by sv2.number desc limit 1),
             0)), 0)::bigint                     as est_seconds
    from public.service_blocks b
    join public.setlist_items si on si.setlist_id = b.setlist_id
    where b.service_id = p_service_id
      and b.setlist_id is not null
      and b.time_budget is not null
    group by b.id, b.name, b.time_budget
  loop
    v_est_min := ceil(r.est_seconds::numeric / 60.0)::integer;
    if v_est_min > r.budget then
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'kind', 'overrun',
        'message', r.block_name || ' block: ' || v_est_min || ' minutes estimated — ' ||
                   (v_est_min - r.budget) || ' minutes over budget'));
    end if;
  end loop;

  -- 2. UNCOVERED: blocks with no assignment rows at all
  for r in
    select b.name as block_name
    from public.service_blocks b
    where b.service_id = p_service_id
      and not exists (
        select 1 from public.service_assignments a where a.block_id = b.id)
  loop
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'kind', 'uncovered',
      'message', r.block_name || ' block has no musicians assigned'));
  end loop;

  -- 3. OVERLAP: same user's assignment pairs whose intervals intersect
  --    (start_a < end_b AND start_b < end_a); ONE warning per unordered pair
  --    (a2.id > a1.id dedupes), naming the OTHER overlapping block.
  if v_service.starts_at is not null then
    for r in
      select a1.user_id as u_id, b2.name as other_block
      from public.service_assignments a1
      join public.service_assignments a2
        on a2.service_id = a1.service_id
       and a2.user_id = a1.user_id
       and a2.id > a1.id
      join public.service_blocks b2 on b2.id = a2.block_id
      cross join lateral private.block_interval(a1.block_id) i1
      cross join lateral private.block_interval(a2.block_id) i2
      where a1.service_id = p_service_id
        and a1.block_id is not null
        and a2.block_id is not null
        and i1.start_min < i2.end_min
        and i2.start_min < i1.end_min
    loop
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'kind', 'overlap',
        'message', private.display_name_for(r.u_id) || ' is already assigned to ' ||
                   r.other_block || ' — overlapping times'));
    end loop;
  end if;

  -- 4. NEEDS_WORK: setlist songs carrying ANY rehearsal outcome 'needs_work'
  for r in
    select distinct si.song_id as s_id
    from public.service_blocks b
    join public.setlist_items si on si.setlist_id = b.setlist_id
    where b.service_id = p_service_id
      and exists (
        select 1 from public.rehearsal_items ri
        where ri.song_id = si.song_id and ri.outcome = 'needs_work')
  loop
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'kind', 'needs_work',
      'message', (select sg.title from public.songs sg where sg.id = r.s_id) ||
                 ' needs work — check in rehearsal notes'));
  end loop;

  return jsonb_build_object('warnings', v_warnings);
end $$;

-- ═══════════════ assign_musician (core) ═══════════════
-- Leader-only; guards in reachable order: not visible → 'Service not found.', not
-- leader (or completed) → leader error, block not in this service → 'Block not found.',
-- then the overlap guard (only when the service has a day/time) and finally the insert +
-- audit log. The UNIQUE(block_id, user_id, part) constraint backstops duplicates.
create or replace function private.assign_musician(
  p_service_id uuid,
  p_block_id   uuid,
  p_user_id    uuid,
  p_part       text
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor        uuid := (select auth.uid());
  v_block_name   text;
  v_assignment_id uuid;
  r              record;
begin
  if v_actor is null then
    raise exception 'Only the service leader can edit the plan.';
  end if;
  if not private.service_visible_to_session(p_service_id) then
    raise exception 'Service not found.';
  end if;
  if not private.service_writable_by_session(p_service_id) then
    raise exception 'Only the service leader can edit the plan.';
  end if;

  select b.name into v_block_name
  from public.service_blocks b
  where b.id = p_block_id and b.service_id = p_service_id;
  if v_block_name is null then
    raise exception 'Block not found.';
  end if;

  -- overlap: any of the target user's EXISTING assignments in this service whose
  -- interval intersects the new block's interval → reject (BDD literal, scenario 8).
  if exists (select 1 from public.services s where s.id = p_service_id and s.starts_at is not null) then
    for r in
      select b2.name as existing_block
      from public.service_assignments a
      join public.service_blocks b2 on b2.id = a.block_id
      cross join lateral private.block_interval(a.block_id) ia
      cross join lateral private.block_interval(p_block_id) inew
      where a.service_id = p_service_id
        and a.user_id = p_user_id
        and a.block_id is not null
        and ia.start_min < inew.end_min
        and inew.start_min < ia.end_min
    loop
      raise exception '% is already assigned to % — overlapping times',
        private.display_name_for(p_user_id), r.existing_block;
    end loop;
  end if;

  insert into public.service_assignments
    (service_id, block_id, user_id, part, is_substitute, decided_by)
  values
    (p_service_id, p_block_id, p_user_id, p_part, false, v_actor)
  returning id into v_assignment_id;

  insert into public.service_change_log (service_id, actor_id, action, detail)
  values (p_service_id, v_actor, 'assign',
          jsonb_build_object('block_id', p_block_id, 'user_id', p_user_id, 'part', p_part));

  return v_assignment_id;
end $$;

-- ═══════════════ reorder_service_blocks (core) ═══════════════
-- Leader-only. p_block_ids must be EXACTLY the service's block ids (same set, no
-- duplicates) — else 'Block not found.'; the array order IS the new order. Two-pass
-- rewrite keeps UNIQUE(service_id, position) satisfied at every statement.
create or replace function private.reorder_service_blocks(p_service_id uuid, p_block_ids uuid[])
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_ids   uuid[];
  v_n     integer;
begin
  if v_actor is null then
    raise exception 'Only the service leader can edit the plan.';
  end if;
  if not private.service_writable_by_session(p_service_id) then
    raise exception 'Only the service leader can edit the plan.';
  end if;

  if p_block_ids is null then
    raise exception 'Block not found.';
  end if;

  select array_agg(b.id order by b.position) into v_ids
  from public.service_blocks b
  where b.service_id = p_service_id;

  -- exact-set validation: same length, every provided id belongs to the service,
  -- no repeated ids (a repeated id in a valid-length array would shrink the set).
  if v_ids is null
     or cardinality(v_ids) <> cardinality(p_block_ids)
     or exists (select 1 from unnest(p_block_ids) x where not (x = any(v_ids)))
     or exists (select 1 from unnest(p_block_ids) x group by x having count(*) > 1)
  then
    raise exception 'Block not found.';
  end if;

  v_n := cardinality(p_block_ids);

  -- pass 1: unique negative positions; pass 2: final 0-based positions.
  for i in 0 .. v_n - 1 loop
    update public.service_blocks
    set position = -(i + 1)
    where id = p_block_ids[i + 1] and service_id = p_service_id;
  end loop;
  for i in 0 .. v_n - 1 loop
    update public.service_blocks
    set position = i
    where id = p_block_ids[i + 1] and service_id = p_service_id;
  end loop;

  insert into public.service_change_log (service_id, actor_id, action, detail)
  values (p_service_id, v_actor, 'reorder', jsonb_build_object('block_ids', p_block_ids));
end $$;

-- ═══════════════ swap_block_song (core) ═══════════════
-- Leader-only. Swaps the song inside the block's setlist (position kept; version +
-- agreed key reset — the new song starts at picker default and the leader re-agrees),
-- notifies every assigned member of the block (self-suppressed), logs the swap with
-- the leader as decider (scenario 13).
create or replace function private.swap_block_song(
  p_service_id  uuid,
  p_block_id    uuid,
  p_old_song_id uuid,
  p_new_song_id uuid
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor          uuid := (select auth.uid());
  v_block          public.service_blocks%rowtype;
  v_service_name   text;
  v_new_song_title text;
  r                record;
begin
  if v_actor is null then
    raise exception 'Only the service leader can edit the plan.';
  end if;
  if not private.service_writable_by_session(p_service_id) then
    raise exception 'Only the service leader can edit the plan.';
  end if;

  select * into v_block
  from public.service_blocks b
  where b.id = p_block_id and b.service_id = p_service_id;

  if v_block.id is null or v_block.setlist_id is null then
    raise exception 'Block has no setlist.';
  end if;

  update public.setlist_items
  set song_id = p_new_song_id, version_id = null, agreed_key = null
  where setlist_id = v_block.setlist_id and song_id = p_old_song_id;

  if not found then
    raise exception 'Song not found in the block''s setlist.';
  end if;

  select s.name into v_service_name from public.services s where s.id = p_service_id;
  select sg.title into v_new_song_title from public.songs sg where sg.id = p_new_song_id;

  -- notify EVERY distinct assignee of the block (notify_user self-suppresses the actor)
  for r in
    select distinct a.user_id as assignee_id
    from public.service_assignments a
    where a.block_id = p_block_id and a.user_id <> v_actor
  loop
    perform public.notify_user(
      r.assignee_id, 'system',
      'Song swap in ' || coalesce(v_service_name, ''),
      coalesce(v_new_song_title, '') || ' replaced in block ' || v_block.name,
      jsonb_build_object('service_id', p_service_id, 'block_id', p_block_id, 'song_id', p_new_song_id));
  end loop;

  insert into public.service_change_log (service_id, actor_id, action, detail)
  values (p_service_id, v_actor, 'song_swap',
          jsonb_build_object('block_id', p_block_id, 'old_song_id', p_old_song_id,
                             'new_song_id', p_new_song_id, 'decided_by', v_actor));
end $$;

-- ═══════════════ check_in (core) ═══════════════
-- The ASSIGNED user marks themselves present once: guard = parent service not
-- completed; the conditional UPDATE only flips checkin_at from NULL. A second call
-- (or a call on someone else's / a nonexistent assignment) updates 0 rows → error.
create or replace function private.check_in(p_assignment_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor  uuid := (select auth.uid());
  v_status text;
begin
  if v_actor is null then
    raise exception 'Assignment not found or already checked in.';
  end if;

  select s.status into v_status
  from public.services s
  join public.service_assignments a on a.service_id = s.id
  where a.id = p_assignment_id;

  if v_status = 'completed' then
    raise exception 'Service is already completed.';
  end if;

  update public.service_assignments
  set checkin_at = now()
  where id = p_assignment_id and user_id = v_actor and checkin_at is null;

  if not found then
    raise exception 'Assignment not found or already checked in.';
  end if;
end $$;

-- ═══════════════ public wrappers (0012/0013 pattern) ═══════════════
create or replace function public.validate_service_plan(p_service_id uuid)
returns jsonb
language sql security definer set search_path = '' as $$
  select private.validate_service_plan(p_service_id);
$$;

create or replace function public.assign_musician(
  p_service_id uuid,
  p_block_id   uuid,
  p_user_id    uuid,
  p_part       text
)
returns uuid
language sql security definer set search_path = '' as $$
  select private.assign_musician(p_service_id, p_block_id, p_user_id, p_part);
$$;

create or replace function public.reorder_service_blocks(p_service_id uuid, p_block_ids uuid[])
returns void
language sql security definer set search_path = '' as $$
  select private.reorder_service_blocks(p_service_id, p_block_ids);
$$;

create or replace function public.swap_block_song(
  p_service_id  uuid,
  p_block_id    uuid,
  p_old_song_id uuid,
  p_new_song_id uuid
)
returns void
language sql security definer set search_path = '' as $$
  select private.swap_block_song(p_service_id, p_block_id, p_old_song_id, p_new_song_id);
$$;

create or replace function public.check_in(p_assignment_id uuid)
returns void
language sql security definer set search_path = '' as $$
  select private.check_in(p_assignment_id);
$$;

-- ══════════════════════ 5. EXECUTE GRANTS (0012/0013 mirror) ══════════════════════
-- private-schema default-revoke convention (0002 lines 33-42 + 0004 usage grant): lock
-- every entry point from public/anon (defensive re-declaration — the defaults already
-- revoke public/anon/authenticated for private-schema functions), then open the public
-- wrappers for authenticated only; anon stays locked everywhere. The private cores and
-- helpers are callable by the definer chain (postgres owner) regardless.
revoke execute on function private.service_visible_to_session(uuid) from public, anon;
revoke execute on function private.service_writable_by_session(uuid) from public, anon;
revoke execute on function private.block_interval(uuid) from public, anon;
revoke execute on function private.display_name_for(uuid) from public, anon;

revoke execute on function private.validate_service_plan(uuid) from public, anon;
revoke execute on function public.validate_service_plan(uuid) from public, anon;
grant execute on function private.validate_service_plan(uuid) to authenticated;
grant execute on function public.validate_service_plan(uuid) to authenticated;

revoke execute on function private.assign_musician(uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.assign_musician(uuid, uuid, uuid, text) from public, anon;
grant execute on function private.assign_musician(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.assign_musician(uuid, uuid, uuid, text) to authenticated;

revoke execute on function private.reorder_service_blocks(uuid, uuid[]) from public, anon;
revoke execute on function public.reorder_service_blocks(uuid, uuid[]) from public, anon;
grant execute on function private.reorder_service_blocks(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_service_blocks(uuid, uuid[]) to authenticated;

revoke execute on function private.swap_block_song(uuid, uuid, uuid, uuid) from public, anon;
revoke execute on function public.swap_block_song(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function private.swap_block_song(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.swap_block_song(uuid, uuid, uuid, uuid) to authenticated;

revoke execute on function private.check_in(uuid) from public, anon;
revoke execute on function public.check_in(uuid) from public, anon;
grant execute on function private.check_in(uuid) to authenticated;
grant execute on function public.check_in(uuid) to authenticated;