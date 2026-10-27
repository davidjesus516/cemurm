-- ═══════════════════════════════════════════════════════════════
-- 0045 — respond_substitution: reject a responder who is no longer
-- an active member of the request's scope.
--
-- Finding 1 of the offboarding-cascade record
-- (odd/tasks/offboarding-cascade.md, "Findings to carry forward"):
-- respond_substitution gated on the request's FROZEN candidates
-- array. A user in that array who has since left the org (membership
-- 'former', e.g. through the 0038 cascade) could still confirm and
-- self-assign onto the service, because nothing else checked
-- membership on the response path.
--
-- The guard is EVENT-SCOPED on purpose, not org-scoped: the
-- substitution request itself is event-scoped when the block's
-- setlist belongs to an event, and a responder who is an active
-- member of ANY participating org is a legitimate substitute there
-- (0023's T10: a member of org a2 covers a part on a service of
-- org a1). The scope computation mirrors substitution_candidates
-- (0023:57-70) verbatim. A plain org-scoped guard would break that
-- existing scenario.
--
-- Self-contained: create or replace on an existing signature — the
-- grants from 0023:939/950 persist.
-- ═══════════════════════════════════════════════════════════════

-- Candidate responds. First accepted confirm wins: row-locked request; only
-- status 'open' may accept. Accept inserts the substitute's OWN assignment row
-- (is_substitute, covered_by=original), closes the request and notifies the
-- original member + the still-pending candidates ("Position already covered").
-- New in 0045: the responder must still be an ACTIVE member of the request's
-- scope (the service's org, or every org participating in the event the
-- block's setlist belongs to). The frozen candidates array is no longer
-- sufficient on its own.
create or replace function public.respond_substitution(p_request_id uuid, p_accept boolean)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_request    public.substitution_requests%rowtype;
  v_assignment public.service_assignments%rowtype;
  v_service    public.services%rowtype;
  v_org_ids    uuid[];
  v_sub_id     uuid;
  v_existing   uuid;
  v_pending    uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated.';
  end if;
  select * into v_request from public.substitution_requests r
  where r.id = p_request_id for update;   -- first-wins lock
  if v_request.id is null then
    raise exception 'Request not found.';
  end if;
  select * into v_assignment from public.service_assignments a where a.id = v_request.assignment_id;
  select * into v_service from public.services s where s.id = v_assignment.service_id;

  -- 0045 guard: the responder must be an active member of the request's
  -- scope. Org scope = the service's org; when the block's setlist belongs
  -- to an EVENT (event_setlists), the scope spans every participating org,
  -- mirroring substitution_candidates (0023:57-70). Checked BEFORE the
  -- frozen-candidates check so a former member in a stale array gets the
  -- membership rejection, not the candidate rejection.
  v_org_ids := array[v_service.org_id];
  if v_assignment.block_id is not null and exists (
    select 1 from public.service_blocks b
    join public.event_setlists es on es.setlist_id = b.setlist_id
    where b.id = v_assignment.block_id)
  then
    select array_agg(distinct ep.org_id)
      into v_org_ids
    from public.service_blocks b
    join public.event_setlists es on es.setlist_id = b.setlist_id
    join public.event_participants ep on ep.event_id = es.event_id
    where b.id = v_assignment.block_id and ep.org_id is not null;
    v_org_ids := (select array(select distinct unnest(v_org_ids || array[v_service.org_id])));
  end if;

  if not exists (
    select 1 from public.org_memberships m
    where m.user_id = (select auth.uid())
      and m.org_id = any(v_org_ids)
      and m.status = 'active')
  then
    raise exception 'You are no longer an active member of this organization.';
  end if;

  if not exists (select 1 from unnest(v_request.candidates) as c where c = (select auth.uid())) then
    raise exception 'You are not a candidate for this request.';
  end if;
  if v_request.status <> 'open' then
    raise exception 'Position already covered.';
  end if;

  if not p_accept then
    insert into public.substitution_responses (request_id, user_id, status, responded_at)
    values (p_request_id, (select auth.uid()), 'declined', now())
    on conflict (request_id, user_id)
    do update set status = 'declined', responded_at = now();
    insert into public.service_change_log (service_id, actor_id, action, detail)
    values (v_assignment.service_id, (select auth.uid()), 'substitution',
      jsonb_build_object('kind', 'decline', 'request_id', p_request_id,
        'member', (select auth.uid())));
    return null;
  end if;

  -- overlap guard mirror (assign_musician's guard; substitutes are not leaders)
  if v_service.starts_at is not null and exists (
    select 1 from public.service_assignments a0
    join public.service_blocks b0 on b0.id = a0.block_id
    cross join lateral private.block_interval(a0.block_id) ia
    cross join lateral private.block_interval(v_assignment.block_id) inew
    where a0.service_id = v_assignment.service_id
      and a0.user_id = (select auth.uid())
      and a0.block_id is not null
      and ia.start_min < inew.end_min and inew.start_min < ia.end_min)
  then
    raise exception 'You are already assigned to an overlapping block.';
  end if;

  select a.id into v_existing
  from public.service_assignments a
  where a.service_id = v_assignment.service_id
    and a.block_id = v_assignment.block_id
    and a.part = v_assignment.part
    and a.user_id = (select auth.uid())
    and a.is_substitute;
  if v_existing is null then
    insert into public.service_assignments (service_id, block_id, user_id, part, is_substitute, covered_by, decided_by)
    values (v_assignment.service_id, v_assignment.block_id, (select auth.uid()),
            v_assignment.part, true, v_assignment.user_id, null)
    returning id into v_sub_id;
  else
    v_sub_id := v_existing;
  end if;

  update public.substitution_requests set status = 'covered', resolved_at = now()
  where id = p_request_id;

  insert into public.substitution_responses (request_id, user_id, status, responded_at)
  values (p_request_id, (select auth.uid()), 'accepted', now())
  on conflict (request_id, user_id)
  do update set status = 'accepted', responded_at = now();

  insert into public.service_change_log (service_id, actor_id, action, detail)
  values (v_assignment.service_id, (select auth.uid()), 'substitution',
    jsonb_build_object('kind', 'confirm', 'request_id', p_request_id,
      'assignment_id', v_assignment.id, 'part', v_assignment.part,
      'original', v_assignment.user_id, 'substitute', (select auth.uid()),
      'substitute_assignment_id', v_sub_id));

  perform public.notify_user(v_assignment.user_id, 'system',
    'Your ' || v_assignment.part || ' part is covered',
    private.display_name_for((select auth.uid())) || ' will cover your part.',
    jsonb_build_object('route', '/services/' || v_assignment.service_id,
      'service_id', v_assignment.service_id, 'request_id', p_request_id));

  for v_pending in
    select sr.user_id from public.substitution_responses sr
    where sr.request_id = p_request_id
      and sr.user_id <> (select auth.uid())
      and sr.status = 'pending'
  loop
    perform public.notify_user(v_pending, 'system',
      'Position already covered',
      private.display_name_for((select auth.uid())) || ' confirmed first for the ' ||
        v_assignment.part || ' part.',
      jsonb_build_object('route', '/substitutions', 'request_id', p_request_id));
  end loop;

  return v_sub_id;
end $$;
