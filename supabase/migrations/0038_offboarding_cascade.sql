-- ══════════════════════════════════════════════════════════════════════════════
-- 0038 — Offboarding cascade: leaving an org must stop leaving work behind.
--
-- Requirement source: features/offboarding-cascade.feature
--   :43-47  "Pending substitution requests are auto-cancelled"
--             Then the request closes as cancelled
--             And the leader is notified: "Sofia left — bass part uncovered"
--   :48-52  "A former member cannot be re-assigned"
--             Then the assignment is rejected with "Sofia is no longer a member"
--             And she is excluded from new substitution candidate lists
--
-- Before this migration private.org_leave (0016:437-453) only flipped the
-- membership row to 'former' and stopped there, so an unavailable member could
-- leave with her open substitution request left dangling — never closed, and the
-- leader never told. (Her service_assignments row is deliberately kept, before and
-- after this migration: the plan still lists her on the part; only the request
-- state and the notification change.) And private.assign_musician (0018:462-524)
-- accepted ANY user id as an assignee, former members included. Both halves are
-- closed here.
--
-- Deliberately NOT changed (see odd/tasks/offboarding-cascade.md):
--   · frozen `candidates` arrays on requests created BEFORE the leave. The
--     scenario says "excluded from NEW substitution candidate lists", and new
--     lists already exclude a former member because 0023's
--     public.substitution_candidates filters `m.status = 'active'` (0023:92).
--   · the substitution self-accept path (respond_substitution). Guarding it
--     generically would break cross-org events: 0023's own T10 legitimately
--     assigns a member of org a2 to a service of org a1. The guard below is
--     therefore scoped to the plan editor (assign_musician), which is the path
--     the scenario names ("the leader tries to assign"), NOT a table trigger.
-- ══════════════════════════════════════════════════════════════════════════════

-- ───────────── 1. LEAVE ORGANIZATION — now with the cascade ─────────────
-- Same signature and same grants as 0016 (create or replace keeps the OID, so
-- `grant execute ... to authenticated` survives). Only the body grows.
create or replace function private.org_leave(p_org_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_leaver uuid := (select auth.uid());
  v_name   text;
  r        record;
begin
  if not exists (
    select 1 from public.org_memberships
    where user_id = v_leaver
      and org_id = p_org_id and status = 'active'
  ) then
    raise exception 'Not a member.';
  end if;

  v_name := private.display_name_for(v_leaver);

  -- The cascade, scoped to THIS org: every OPEN request the leaver raised for a
  -- service of the org they are leaving is closed. 'closed' is the model's word
  -- for it (substitution_requests.status ∈ 'open' | 'covered' | 'closed'); the
  -- human word "cancelled" is recorded as detail.kind = 'member_left'.
  -- Requests in any other org — and requests raised by anyone else — are
  -- untouched, frozen `candidates` arrays included.
  for r in
    select sr.id  as request_id,
           sr.assignment_id,
           sa.service_id,
           sa.part,
           s.name        as service_name,
           s.leader_id   as leader_id
    from public.substitution_requests sr
    join public.service_assignments sa on sa.id = sr.assignment_id
    join public.services          s  on s.id  = sa.service_id
    where sr.requested_by = v_leaver
      and sr.status = 'open'
      and s.org_id = p_org_id
  loop
    update public.substitution_requests
    set status = 'closed', resolved_at = now()
    where id = r.request_id;

    -- service_change_log is extensible through detail.kind, not through new
    -- `action` values (0023 writes action='substitution' with kinds
    -- unavailable/send/decline/confirm/cancel/reclaim/overrule, written at
    -- 0023:152, 211, 255, 300, 380, 439 and 508; services.js:532 filters on
    -- action === 'song_swap'). 'member_left' is additive and cannot blank a UI
    -- that switches on `action`.
    insert into public.service_change_log (service_id, actor_id, action, detail)
    values (r.service_id, v_leaver, 'substitution',
            jsonb_build_object('kind', 'member_left',
                               'request_id', r.request_id,
                               'assignment_id', r.assignment_id,
                               'part', r.part));

    -- A leader who is themselves leaving must not be told about their own
    -- departure; a service may also have no leader at all.
    if r.leader_id is not null and r.leader_id <> v_leaver then
      perform public.notify_user(
        r.leader_id, 'system',
        v_name || ' left — ' || r.part || ' part uncovered',
        'The ' || r.part || ' part for ' || r.service_name || ' is uncovered again.',
        jsonb_build_object('route', '/substitutions',
                           'service_id', r.service_id,
                           'request_id', r.request_id));
    end if;
  end loop;

  update public.org_memberships
  set status = 'former', left_at = now()
  where user_id = v_leaver
    and org_id = p_org_id and status = 'active';
end $$;

-- ───────────── 2. A FORMER MEMBER CANNOT BE ASSIGNED ─────────────
-- Body of 0018:462-524 with one guard inserted after the block check: the
-- assignee must hold an ACTIVE membership of the service's org.
--
-- Why the membership is read from org_memberships directly instead of calling
-- private.is_org_member: that helper is session-bound (0002:16-18 filters
-- `user_id = (select auth.uid())`), so it can only ever report the CALLER's own
-- membership and cannot validate a third party. 0023:467-476 already hit this
-- for a leader-chosen substitute and solved it the same way, with the same
-- comment; this mirrors that precedent rather than inventing a new shape.
--
-- The guard is intentionally org-scoped. An event-linked block may legitimately
-- cover a member of a DIFFERENT participating org through the substitution flow
-- (0023 T10: an a2 member on an a1 service). That path does not pass here, and a
-- blanket table trigger would have broken it.
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

  -- 0038: a former member cannot be re-assigned
  -- (features/offboarding-cascade.feature:48-51). Covers "never an active member
  -- of this org" by the same guard, which is the intended reading: the plan
  -- offers the org's own active members.
  if not exists (
    select 1
    from public.org_memberships m
    join public.services s on s.id = p_service_id
    where m.user_id = p_user_id
      and m.org_id = s.org_id
      and m.status = 'active'
  ) then
    raise exception '% is no longer a member', private.display_name_for(p_user_id);
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
