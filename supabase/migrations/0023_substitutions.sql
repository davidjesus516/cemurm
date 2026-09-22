-- ═══════════════════════════════════════════════════════════════════════════════
-- 0023_substitutions.sql — Substitutions and Coverage (Hito 5, #81)
--
-- Spec: features/substitutions-and-coverage.feature (17 scenarios)
-- Contract: docs/database-schema-v2.md §2.6 — service_assignments absorbs
--   substitution coverage; substitution_requests drives the lifecycle.
--
-- Design (see odd/tasks/hito5-substitutions-and-coverage.md):
--   • Unavailability IS the open request: member marks an assignment unavailable
--     ⇒ one substitution_requests row (status 'open'). Reclaim closes it.
--   • Per-candidate state lives in a NEW table substitution_responses
--     (documented deviation #50 beyond the 48-table contract; precedent: 0006
--     profiles). substitution_requests.candidates keeps the eligibility
--     snapshot; responses drive first-wins.
--   • A confirmed substitute gets their OWN service_assignments row with
--     is_substitute=true, covered_by=original, decided_by=leader|null. The
--     original row stays untouched — "stored plan is unchanged" in the BDD.
--   • Every lifecycle step writes service_change_log (action 'substitution').
--   • Notifications are emitted INSIDE the definer RPCs via public.notify_user
--     (0008: definer, revoked from authenticated — callable from definer
--     context, 0009 trigger precedent). Category 'system', deep-link payload.
--   • Cross-org event coverage: substitution_context(p_service_id) returns ONLY
--     the caller's assignment blocks + their setlist songs + the event setlist
--     when scope='event'. Never org repertoire. No new grants; one narrow RPC
--     (projection precedent 0022).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ══════════════ 0. PER-CANDIDATE RESPONSE STATE ══════════════
-- deny-by-default surface (client never reads these tables directly; the
-- definer RPCs get_substitution_request / list_substitution_requests own reads).
create table public.substitution_responses (
  request_id   uuid not null references public.substitution_requests(id) on delete cascade,
  user_id      uuid not null references auth.users(id),
  status       text not null,              -- 'pending' | 'accepted' | 'declined'
  responded_at timestamptz,
  primary key (request_id, user_id)
);

alter table public.substitution_responses enable row level security;
revoke all on table public.substitution_responses from public, anon, authenticated;

-- ══════════════ 1. ELIGIBILITY ══════════════
-- Candidates = active org members whose profiles.instrument equals the
-- assignment's part, excluding the assigned member and anyone who already has
-- their own OPEN substitution request (busy). Definition RPC: reads as postgres.
create or replace function public.substitution_candidates(p_assignment_id uuid)
returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  v_assignment public.service_assignments%rowtype;
  v_service    public.services%rowtype;
  v_org_ids    uuid[];
  v_result     uuid[];
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated.';
  end if;
  select * into v_assignment from public.service_assignments a where a.id = p_assignment_id;
  if v_assignment.id is null then
    raise exception 'Assignment not found.';
  end if;
  select * into v_service from public.services s where s.id = v_assignment.service_id;
  -- caller must be the assigned member (self) or the service leader
  if (select auth.uid()) <> v_assignment.user_id
     and not private.service_writable_by_session(v_assignment.service_id) then
    raise exception 'Not allowed.';
  end if;

  -- Candidate org scope: the service's org; when the block's setlist belongs to
  -- an EVENT (event_setlists), candidates span every participating org — the
  -- cross-org event coverage scenario (scope='event').
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

  select coalesce(array_agg(m.user_id order by coalesce(p.display_name, '')), '{}')
    into v_result
  from public.org_memberships m
  join public.profiles p on p.id = m.user_id
  where m.org_id = any(v_org_ids)
    and m.status = 'active'
    and m.user_id <> v_assignment.user_id
    and p.instrument = v_assignment.part
    and not exists (
      select 1 from public.substitution_requests r2
      join public.service_assignments a2 on a2.id = r2.assignment_id
      where a2.user_id = m.user_id and r2.status = 'open');
  return v_result;
end $$;

-- ══════════════ 2. REQUEST LIFECYCLE ══════════════

-- Member marks self unavailable ⇒ open request + leader notification.
-- Idempotent: an already-open request for the assignment is returned.
create or replace function public.mark_unavailable(p_assignment_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_assignment public.service_assignments%rowtype;
  v_scope      text := 'org';
  v_request_id uuid;
  v_existing   uuid;
  v_leader     uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated.';
  end if;
  select * into v_assignment from public.service_assignments a where a.id = p_assignment_id;
  if v_assignment.id is null then
    raise exception 'Assignment not found.';
  end if;
  if v_assignment.user_id <> (select auth.uid()) then
    raise exception 'Only the assigned member can mark this assignment unavailable.';
  end if;

  -- event scope: when the block's setlist belongs to an event, the request is
  -- cross-org eligible (BDD: cross-org event coverage)
  if v_assignment.block_id is not null and exists (
    select 1 from public.service_blocks b
    join public.event_setlists es on es.setlist_id = b.setlist_id
    where b.id = v_assignment.block_id)
  then
    v_scope := 'event';
  end if;

  select r.id into v_existing
  from public.substitution_requests r
  where r.assignment_id = p_assignment_id and r.status = 'open'
  order by r.created_at desc limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.substitution_requests (assignment_id, requested_by, scope, candidates, status)
  values (p_assignment_id, (select auth.uid()), v_scope,
          public.substitution_candidates(p_assignment_id), 'open')
  returning id into v_request_id;

  insert into public.service_change_log (service_id, actor_id, action, detail)
  values (v_assignment.service_id, (select auth.uid()), 'substitution',
    jsonb_build_object('kind', 'unavailable', 'request_id', v_request_id,
      'assignment_id', p_assignment_id, 'part', v_assignment.part,
      'member', v_assignment.user_id));

  select s.leader_id into v_leader from public.services s where s.id = v_assignment.service_id;
  if v_leader is not null then
    perform public.notify_user(v_leader, 'system',
      private.display_name_for(v_assignment.user_id) || ' is unavailable',
      'The ' || v_assignment.part || ' part needs a substitute for this service.',
      jsonb_build_object('route', '/services/' || v_assignment.service_id,
        'service_id', v_assignment.service_id,
        'assignment_id', p_assignment_id, 'request_id', v_request_id));
  end if;

  return v_request_id;
end $$;

-- Leader sends the request ⇒ seed pending responses + notify candidates.
create or replace function public.send_substitution_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_request    public.substitution_requests%rowtype;
  v_assignment public.service_assignments%rowtype;
  v_cand       uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated.';
  end if;
  select * into v_request from public.substitution_requests r where r.id = p_request_id;
  if v_request.id is null then
    raise exception 'Request not found.';
  end if;
  select * into v_assignment from public.service_assignments a where a.id = v_request.assignment_id;
  if not private.service_writable_by_session(v_assignment.service_id) then
    raise exception 'Only the service leader can send the request.';
  end if;
  if v_request.status <> 'open' then
    raise exception 'Request is already resolved.';
  end if;

  insert into public.substitution_responses (request_id, user_id, status)
  select p_request_id, c, 'pending'
  from unnest(v_request.candidates) as c
  on conflict (request_id, user_id) do nothing;

  for v_cand in select unnest(v_request.candidates)
  loop
    perform public.notify_user(v_cand, 'system',
      'Substitution needed: ' || v_assignment.part,
      private.display_name_for(v_request.requested_by) || ' is unavailable' ||
        coalesce(' — ' || (select b.name from public.service_blocks b where b.id = v_assignment.block_id), ''),
      jsonb_build_object('route', '/substitutions',
        'service_id', v_assignment.service_id,
        'request_id', p_request_id, 'assignment_id', v_assignment.id));
  end loop;

  insert into public.service_change_log (service_id, actor_id, action, detail)
  values (v_assignment.service_id, (select auth.uid()), 'substitution',
    jsonb_build_object('kind', 'send', 'request_id', p_request_id,
      'candidates', v_request.candidates));
end $$;

-- Candidate responds. First accepted confirm wins: row-locked request; only
-- status 'open' may accept. Accept inserts the substitute's OWN assignment row
-- (is_substitute, covered_by=original), closes the request and notifies the
-- original member + the still-pending candidates ("Position already covered").
create or replace function public.respond_substitution(p_request_id uuid, p_accept boolean)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_request    public.substitution_requests%rowtype;
  v_assignment public.service_assignments%rowtype;
  v_service    public.services%rowtype;
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

-- Substitute cancel ⇒ their substitute row is removed, the request reopens and
-- the leader is notified with the remaining (not-declined) candidates.
create or replace function public.cancel_substitution(p_request_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_request    public.substitution_requests%rowtype;
  v_assignment public.service_assignments%rowtype;
  v_remaining  uuid[];
  v_leader     uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated.';
  end if;
  select * into v_request from public.substitution_requests r where r.id = p_request_id;
  if v_request.id is null then
    raise exception 'Request not found.';
  end if;
  if v_request.status <> 'covered' then
    raise exception 'Request is not covered.';
  end if;
  select * into v_assignment from public.service_assignments a where a.id = v_request.assignment_id;
  if not exists (
    select 1 from public.service_assignments a
    where a.service_id = v_assignment.service_id
      and a.block_id = v_assignment.block_id
      and a.part = v_assignment.part
      and a.user_id = (select auth.uid())
      and a.is_substitute) then
    raise exception 'Only the current substitute can cancel.';
  end if;

  delete from public.service_assignments
  where service_id = v_assignment.service_id
    and block_id = v_assignment.block_id
    and part = v_assignment.part
    and user_id = (select auth.uid())
    and is_substitute;

  update public.substitution_requests set status = 'open', resolved_at = null
  where id = p_request_id;

  select coalesce(array_agg(c), '{}') into v_remaining
  from (
    select c from unnest(v_request.candidates) as c
    where c <> (select auth.uid())
      and c not in (
        select sr.user_id from public.substitution_responses sr
        where sr.request_id = p_request_id and sr.status = 'declined')
  ) t;

  insert into public.service_change_log (service_id, actor_id, action, detail)
  values (v_assignment.service_id, (select auth.uid()), 'substitution',
    jsonb_build_object('kind', 'cancel', 'request_id', p_request_id,
      'part', v_assignment.part, 'substitute', (select auth.uid()),
      'remaining_candidates', v_remaining));

  select s.leader_id into v_leader from public.services s where s.id = v_assignment.service_id;
  if v_leader is not null then
    perform public.notify_user(v_leader, 'system',
      'A substitute cancelled',
      'The ' || v_assignment.part || ' part is uncovered again. Remaining candidates: ' ||
        coalesce((select string_agg(private.display_name_for(u), ', ' order by private.display_name_for(u))
                  from unnest(v_remaining) as u), 'none'),
      jsonb_build_object('route', '/services/' || v_assignment.service_id,
        'service_id', v_assignment.service_id,
        'request_id', p_request_id, 'candidates', v_remaining));
  end if;
end $$;

-- Original member returns ⇒ every substitute row covering this part is released,
-- open requests close, the released substitute is notified.
create or replace function public.reclaim_assignment(p_assignment_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_assignment public.service_assignments%rowtype;
  v_sub        record;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated.';
  end if;
  select * into v_assignment from public.service_assignments a where a.id = p_assignment_id;
  if v_assignment.id is null then
    raise exception 'Assignment not found.';
  end if;
  if v_assignment.user_id <> (select auth.uid()) then
    raise exception 'Only the assigned member can reclaim this part.';
  end if;

  for v_sub in
    select a.id, a.user_id from public.service_assignments a
    where a.service_id = v_assignment.service_id
      and a.block_id = v_assignment.block_id
      and a.part = v_assignment.part
      and a.is_substitute
      and a.covered_by = (select auth.uid())
  loop
    delete from public.service_assignments where id = v_sub.id;
    perform public.notify_user(v_sub.user_id, 'system',
      'Part reclaimed',
      private.display_name_for(v_assignment.user_id) || ' is back — you are released from the ' ||
        v_assignment.part || ' part.',
      jsonb_build_object('route', '/services/' || v_assignment.service_id,
        'service_id', v_assignment.service_id));
  end loop;

  update public.substitution_requests set status = 'closed', resolved_at = now()
  where assignment_id = p_assignment_id and status in ('open', 'covered');

  insert into public.service_change_log (service_id, actor_id, action, detail)
  values (v_assignment.service_id, (select auth.uid()), 'substitution',
    jsonb_build_object('kind', 'reclaim', 'assignment_id', p_assignment_id,
      'part', v_assignment.part, 'member', v_assignment.user_id));
end $$;

-- Leader overrule: assigns p_substitute_id directly (decided_by=leader), releases
-- every earlier confirmed substitute for the part, closes the request.
create or replace function public.overrule_substitution(p_request_id uuid, p_substitute_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_request    public.substitution_requests%rowtype;
  v_assignment public.service_assignments%rowtype;
  v_service    public.services%rowtype;
  v_sub        record;
  v_sub_id     uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated.';
  end if;
  select * into v_request from public.substitution_requests r where r.id = p_request_id;
  if v_request.id is null then
    raise exception 'Request not found.';
  end if;
  select * into v_assignment from public.service_assignments a where a.id = v_request.assignment_id;
  select * into v_service from public.services s where s.id = v_assignment.service_id;
  if not private.service_writable_by_session(v_assignment.service_id) then
    raise exception 'Only the service leader can overrule.';
  end if;
  -- direct membership check: private.is_org_member is session-bound (only the
  -- caller's own membership), so the leader's choice must be verified against
  -- org_memberships directly (this definer core reads as postgres).
  if not exists (
    select 1 from public.org_memberships m
    where m.user_id = p_substitute_id
      and m.org_id = v_service.org_id
      and m.status = 'active') then
    raise exception 'The chosen substitute is not an active member of this organization.';
  end if;

  for v_sub in
    select a.id, a.user_id from public.service_assignments a
    where a.service_id = v_assignment.service_id
      and a.block_id = v_assignment.block_id
      and a.part = v_assignment.part
      and a.is_substitute
      and a.user_id <> p_substitute_id
  loop
    delete from public.service_assignments where id = v_sub.id;
    perform public.notify_user(v_sub.user_id, 'system',
      'Position reassigned',
      'The leader assigned ' || private.display_name_for(p_substitute_id) ||
        ' to cover the ' || v_assignment.part || ' part instead.',
      jsonb_build_object('route', '/substitutions',
        'service_id', v_assignment.service_id, 'request_id', p_request_id));
  end loop;

  insert into public.service_assignments (service_id, block_id, user_id, part, is_substitute, covered_by, decided_by)
  values (v_assignment.service_id, v_assignment.block_id, p_substitute_id,
          v_assignment.part, true, v_assignment.user_id, (select auth.uid()))
  on conflict (block_id, user_id, part)
  do update set is_substitute = true, covered_by = excluded.covered_by,
                decided_by = excluded.decided_by
  returning id into v_sub_id;

  update public.substitution_requests set status = 'covered', resolved_at = now()
  where id = p_request_id;

  insert into public.service_change_log (service_id, actor_id, action, detail)
  values (v_assignment.service_id, (select auth.uid()), 'substitution',
    jsonb_build_object('kind', 'overrule', 'request_id', p_request_id,
      'part', v_assignment.part, 'original', v_assignment.user_id,
      'substitute', p_substitute_id, 'substitute_assignment_id', v_sub_id,
      'decided_by', (select auth.uid())));

  perform public.notify_user(p_substitute_id, 'system',
    'You cover the ' || v_assignment.part || ' part',
    'The leader assigned you to cover ' || private.display_name_for(v_assignment.user_id) || '.',
    jsonb_build_object('route', '/substitutions',
      'service_id', v_assignment.service_id, 'request_id', p_request_id));
  perform public.notify_user(v_assignment.user_id, 'system',
    'Your ' || v_assignment.part || ' part is covered',
    'The leader assigned ' || private.display_name_for(p_substitute_id) ||
      ' to cover your part.',
    jsonb_build_object('route', '/services/' || v_assignment.service_id,
      'service_id', v_assignment.service_id));

  return v_sub_id;
end $$;

-- ══════════════ 3. READ SURFACE (definer; RLS-free by design) ══════════════

-- Single request + response state. Guarded: leader, original member, or a
-- candidate on the request.
create or replace function public.get_substitution_request(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_request    public.substitution_requests%rowtype;
  v_assignment public.service_assignments%rowtype;
  v_ok         boolean;
  v_responses  jsonb := '[]'::jsonb;
  v_covered    jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated.';
  end if;
  select * into v_request from public.substitution_requests r where r.id = p_request_id;
  if v_request.id is null then
    raise exception 'Request not found.';
  end if;
  select * into v_assignment from public.service_assignments a where a.id = v_request.assignment_id;
  v_ok := private.service_writable_by_session(v_assignment.service_id);
  if not v_ok then
    v_ok := v_assignment.user_id = (select auth.uid())
         or exists (select 1 from unnest(v_request.candidates) as c where c = (select auth.uid()));
  end if;
  if not v_ok then
    raise exception 'Not allowed.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', sr.user_id,
           'name', private.display_name_for(sr.user_id),
           'status', sr.status,
           'responded_at', sr.responded_at) order by sr.responded_at nulls first),
         '[]'::jsonb)
    into v_responses
  from public.substitution_responses sr
  where sr.request_id = p_request_id;

  select null into v_covered;
  if v_request.status = 'covered' then
    select jsonb_build_object('assignment_id', a.id, 'user_id', a.user_id,
                              'name', private.display_name_for(a.user_id))
      into v_covered
    from public.service_assignments a
    where a.service_id = v_assignment.service_id
      and a.block_id = v_assignment.block_id
      and a.part = v_assignment.part
      and a.is_substitute
    limit 1;
  end if;

  return jsonb_build_object(
    'id', v_request.id,
    'assignment_id', v_request.assignment_id,
    'service_id', v_assignment.service_id,
    'block_id', v_assignment.block_id,
    'part', v_assignment.part,
    'original_member', v_assignment.user_id,
    'original_name', private.display_name_for(v_assignment.user_id),
    'requested_by', v_request.requested_by,
    'scope', v_request.scope,
    'status', v_request.status,
    'candidates', v_request.candidates,
    'responses', v_responses,
    'covered_by', v_covered,
    'created_at', v_request.created_at,
    'resolved_at', v_request.resolved_at);
end $$;

-- All substitution requests of a service with response state; leader-only.
create or replace function public.list_substitution_requests(p_service_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_requests jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated.';
  end if;
  if not private.service_writable_by_session(p_service_id) then
    raise exception 'Only the service leader can list substitution requests.';
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', r.id,
             'assignment_id', r.assignment_id,
             'block_id', (select a.block_id from public.service_assignments a where a.id = r.assignment_id),
             'part', (select a.part from public.service_assignments a where a.id = r.assignment_id),
             'original_member', (select a.user_id from public.service_assignments a where a.id = r.assignment_id),
             'original_name', private.display_name_for((select a.user_id from public.service_assignments a where a.id = r.assignment_id)),
             'scope', r.scope,
             'status', r.status,
             'candidates', r.candidates,
             'responses', (select coalesce(jsonb_agg(jsonb_build_object(
                              'user_id', sr.user_id,
                              'name', private.display_name_for(sr.user_id),
                              'status', sr.status,
                              'responded_at', sr.responded_at) order by sr.responded_at nulls first),
                            '[]'::jsonb)
                           from public.substitution_responses sr where sr.request_id = r.id),
             'created_at', r.created_at,
             'resolved_at', r.resolved_at)
         order by r.created_at desc), '[]'::jsonb)
    into v_requests
  from public.substitution_requests r
  where r.assignment_id in (
    select a.id from public.service_assignments a where a.service_id = p_service_id);

  return v_requests;
end $$;

-- Cross-org scoped sub experience: returns the caller's assignment blocks, the
-- songs of those blocks' setlists (chart content via chart_files) and — when a
-- request involved scope='event' — the event setlist songs. NEVER org repertoire.
create or replace function public.substitution_context(p_service_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor    uuid := (select auth.uid());
  v_service  public.services%rowtype;
  v_my_ids   uuid[];
  v_blocks   jsonb := '[]'::jsonb;
  v_event    jsonb;
  v_blk      record;
begin
  if v_actor is null then
    raise exception 'Not authenticated.';
  end if;
  select * into v_service from public.services s where s.id = p_service_id;
  if v_service.id is null then
    raise exception 'Service not found.';
  end if;

  -- caller context: own assignment rows, substitute rows, or pending candidates
  select coalesce(array_agg(a.id), '{}') into v_my_ids
  from public.service_assignments a
  where a.service_id = p_service_id
    and (a.user_id = v_actor or (a.is_substitute and a.covered_by is not null and a.user_id = v_actor));
  if cardinality(v_my_ids) = 0 and not exists (
    select 1 from public.substitution_requests rq
    join public.service_assignments a on a.id = rq.assignment_id
    join unnest(rq.candidates) as c on true
    where a.service_id = p_service_id and rq.status = 'open' and c = v_actor) then
    raise exception 'Not allowed.';
  end if;

  -- blocks for the caller: their assignments (or pending-candidate target blocks)
  for v_blk in
    select distinct b.id, b.name,
           coalesce(a.part, (select a2.part from public.service_assignments a2 where a2.id = rq.assignment_id)) as part,
           a.id as assignment_id,
           a.user_id as assigned_user,
           case when a.is_substitute then 'substitute'
                when a.user_id = v_actor then 'original'
                else 'candidate' end as role
    from public.service_blocks b
    left join lateral (
      select a.* from public.service_assignments a
      where a.service_id = p_service_id and a.block_id = b.id
        and (a.user_id = v_actor or (a.is_substitute and a.user_id = v_actor))
      limit 1
    ) a on true
    left join lateral (
      select rq.* from public.substitution_requests rq
      join public.service_assignments a3 on a3.id = rq.assignment_id
      join unnest(rq.candidates) as c on true
      where a3.service_id = p_service_id and a3.block_id = b.id
        and rq.status = 'open' and c = v_actor
      limit 1
    ) rq on true
    where b.service_id = p_service_id
      and (a.id is not null or rq.id is not null)
  loop
    v_blocks := v_blocks || jsonb_build_array(
      jsonb_build_object(
        'id', v_blk.id,
        'name', v_blk.name,
        'part', v_blk.part,
        'role', v_blk.role,
        'assignment_id', v_blk.assignment_id,
        -- member-side coverage state: the caller's own open/covered request for
        -- this block's original assignment, or the open request they are a
        -- candidate on (candidate role) — lets ServiceDetail render status and
        -- actions without leaking the leader's full request view.
        'request_id', coalesce(
          (select rq2.id from public.substitution_requests rq2
            where rq2.assignment_id = v_blk.assignment_id
              and rq2.status in ('open', 'covered')
            order by rq2.created_at desc limit 1),
          (select rq3.id from public.substitution_requests rq3
            join public.service_assignments a5 on a5.id = rq3.assignment_id
            join unnest(rq3.candidates) as c on true
            where a5.block_id = v_blk.id and rq3.status = 'open' and c = v_actor
            order by rq3.created_at desc limit 1)),
        'request_status', coalesce(
          (select rq2.status from public.substitution_requests rq2
            where rq2.assignment_id = v_blk.assignment_id
              and rq2.status in ('open', 'covered')
            order by rq2.created_at desc limit 1),
          (select rq3.status from public.substitution_requests rq3
            join public.service_assignments a5 on a5.id = rq3.assignment_id
            join unnest(rq3.candidates) as c on true
            where a5.block_id = v_blk.id and rq3.status = 'open' and c = v_actor
            order by rq3.created_at desc limit 1)),
        'covered_name', (select private.display_name_for(sa.user_id)
          from public.service_assignments sa
          where sa.service_id = p_service_id and sa.block_id = v_blk.id
            and sa.part = v_blk.part and sa.is_substitute
          limit 1),
        'songs', coalesce((
          select jsonb_agg(jsonb_build_object(
            'song_id', si.song_id,
            'title', sg.title,
            'artist', sg.artist,
            'version_id', si.version_id,
            'version_name', (select sv.name from public.song_versions sv where sv.id = si.version_id),
            'base_key', (select sv.base_key from public.song_versions sv where sv.id = si.version_id),
            'chart', coalesce(
              (select cf.content from public.chart_files cf
                where cf.id = (select sv.chart_file_id from public.song_versions sv where sv.id = si.version_id)),
              (select cf.content from public.chart_files cf
                where cf.song_id = si.song_id and cf.soft_deleted = false
                order by cf.created_at desc limit 1), '')
          ) order by si.position)
          from public.setlist_items si
          join public.songs sg on sg.id = si.song_id
          join public.service_blocks sb on sb.id = v_blk.id
          where si.setlist_id = sb.setlist_id
        ), '[]'::jsonb))
    );
  end loop;

  -- event context (cross-org scoped): only when the caller's pending/sub request
  -- has scope='event'; returns the event setlist songs, never org repertoire.
  select jsonb_build_object(
    'event_id', e.id,
    'event_name', e.name,
    'songs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'song_id', si.song_id,
        'title', sg.title,
        'artist', sg.artist,
        'version_id', si.version_id,
        'chart', coalesce(
          (select cf.content from public.chart_files cf
            where cf.id = (select sv.chart_file_id from public.song_versions sv where sv.id = si.version_id)),
          (select cf.content from public.chart_files cf
            where cf.song_id = si.song_id and cf.soft_deleted = false
            order by cf.created_at desc limit 1), '')
      ) order by si.position)
      from public.event_setlists es
      join public.setlist_items si on si.setlist_id = es.setlist_id
      join public.songs sg on sg.id = si.song_id
      where es.event_id = e.id and es.visibility in ('event', 'org', 'public')
    ), '[]'::jsonb))
    into v_event
  from public.events e
  where exists (
    select 1 from public.substitution_requests rq4
    join public.service_assignments a4 on a4.id = rq4.assignment_id
    join public.event_setlists es4 on es4.event_id = e.id
    where a4.service_id = p_service_id
      and rq4.scope = 'event'
      and (a4.user_id = v_actor or exists (select 1 from unnest(rq4.candidates) as c where c = v_actor))
    limit 1)
  limit 1;

  return jsonb_build_object(
    'service', jsonb_build_object('id', v_service.id, 'name', v_service.name),
    'blocks', v_blocks,
    'event', v_event,
    'instrument', coalesce((select pr.instrument from public.profiles pr where pr.id = v_actor), ''));
end $$;

-- ══════════════ 4. COVERAGE WARNING (validate extension) ══════════════
-- OR REPLACE of the 0018 private core (same signature), reproducing its four
-- blocks and adding block 5: an open substitution request on an assignment
-- without a confirmed substitute warns "Bass part uncovered — Lucia absent".
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

  -- 5. SUBSTITUTION: an assignment with an OPEN substitution request and no
  --    confirmed substitute ⇒ "Bass part uncovered — Lucia absent". The warning
  --    clears only when a substitute confirms (request status changes).
  for r in
    select b.name as block_name, a.part as part_name, a.user_id as absent_id
    from public.substitution_requests rq
    join public.service_assignments a on a.id = rq.assignment_id
    join public.service_blocks b on b.id = a.block_id
    where rq.status = 'open'
      and a.service_id = p_service_id
      and not exists (
        select 1 from public.service_assignments a2
        where a2.service_id = a.service_id
          and a2.block_id = a.block_id
          and a2.part = a.part
          and a2.is_substitute)
  loop
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'kind', 'substitution',
      'message', r.part_name || ' part uncovered — ' ||
                 private.display_name_for(r.absent_id) || ' absent'));
  end loop;

  return jsonb_build_object('warnings', v_warnings);
end $$;

-- ══════════════ 5. GRANTS — execute to authenticated only ══════════════
grant execute on function public.substitution_candidates(uuid) to authenticated;
grant execute on function public.mark_unavailable(uuid) to authenticated;
grant execute on function public.send_substitution_request(uuid) to authenticated;
grant execute on function public.respond_substitution(uuid, boolean) to authenticated;
grant execute on function public.cancel_substitution(uuid) to authenticated;
grant execute on function public.reclaim_assignment(uuid) to authenticated;
grant execute on function public.overrule_substitution(uuid, uuid) to authenticated;
grant execute on function public.get_substitution_request(uuid) to authenticated;
grant execute on function public.list_substitution_requests(uuid) to authenticated;
grant execute on function public.substitution_context(uuid) to authenticated;

revoke execute on function public.substitution_candidates(uuid) from public, anon;
revoke execute on function public.mark_unavailable(uuid) from public, anon;
revoke execute on function public.send_substitution_request(uuid) from public, anon;
revoke execute on function public.respond_substitution(uuid, boolean) from public, anon;
revoke execute on function public.cancel_substitution(uuid) from public, anon;
revoke execute on function public.reclaim_assignment(uuid) from public, anon;
revoke execute on function public.overrule_substitution(uuid, uuid) from public, anon;
revoke execute on function public.get_substitution_request(uuid) from public, anon;
revoke execute on function public.list_substitution_requests(uuid) from public, anon;
revoke execute on function public.substitution_context(uuid) from public, anon;