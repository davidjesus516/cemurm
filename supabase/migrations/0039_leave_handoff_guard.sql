-- ══════════════════════════════════════════════════════════════════════════════
-- 0039 — Offboarding cascade WU2: a leave cannot strip the org of a setlist.
--
-- Requirement source: features/offboarding-cascade.feature:53-57
--
-- 0038 left private.org_leave able to flip a member to 'former' while she
-- still owned setlists the org uses, so the org's access to them could
-- silently disappear (or leave them in the hands of someone outside the org).
-- This re-creates 0038's body and inserts two guards BEFORE the status flip.
-- The 0038 substitution-request cascade is copied verbatim; WU1's smoke must
-- remain green.
--
-- Clause A: the leaver owns a setlist the org uses. "Org-uses" means any of:
--   · a service_blocks row of any of the org's services references it, OR
--   · a gig of the org references it (gigs.org_id + gigs.setlist_id — the app
--     writes both, src/data/repositories/gigs.js; the seed's own Demo Setlist
--     is used this way by two a1 gigs and by no service block), OR
--   · an ACTIVE member of the org is an ACCEPTED collaborator on it. The
--     accepted_at filter mirrors the RLS that actually grants access —
--     setlists_select_member is owner OR accepted collaborator, so a pending
--     invitation grants nothing and must not block anyone's leave.
-- setlists.org_id is deliberately NOT part of "org-uses": no RLS policy reads
-- it and no app code writes it (the seed is its only writer), so it is a tag,
-- not an access path.
-- Clause B: any org-used setlist sits with an owner who is not an active
-- member of that org. This keeps the scenario's invariant even if a handoff
-- went to a non-member; it is deliberately broader than the scenario.
--
-- Both raise the SAME STATIC literal so it passes through the client's exact-
-- match allowlist (the same defect fixed for 0038). No new RPCs, no new state.
-- ══════════════════════════════════════════════════════════════════════════════

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

  -- 0039 clause A: leaver owns a setlist the org uses
  if exists (
    select 1 from public.setlists sl
    where sl.owner_id = v_leaver
      and (
        exists (
          select 1 from public.service_blocks b
          join public.services s on s.id = b.service_id
          where b.setlist_id = sl.id and s.org_id = p_org_id
        )
        or exists (
          select 1 from public.gigs g
          where g.setlist_id = sl.id and g.org_id = p_org_id
        )
        or exists (
          select 1 from public.setlist_collaborators c
          join public.org_memberships m
            on m.user_id = c.user_id and m.org_id = p_org_id
          where c.setlist_id = sl.id and m.status = 'active'
            and c.accepted_at is not null
        )
      )
  ) then
    raise exception 'Transfer the setlists this organization uses before leaving.';
  end if;

  -- 0039 clause B: org-used setlist with non-active-member owner
  if exists (
    select 1 from public.setlists sl
    where (
        exists (
          select 1 from public.service_blocks b
          join public.services s on s.id = b.service_id
          where b.setlist_id = sl.id and s.org_id = p_org_id
        )
        or exists (
          select 1 from public.gigs g
          where g.setlist_id = sl.id and g.org_id = p_org_id
        )
        or exists (
          select 1 from public.setlist_collaborators c
          join public.org_memberships m
            on m.user_id = c.user_id and m.org_id = p_org_id
          where c.setlist_id = sl.id and m.status = 'active'
            and c.accepted_at is not null
        )
      )
      and not exists (
        select 1 from public.org_memberships m
        where m.user_id = sl.owner_id
          and m.org_id = p_org_id
          and m.status = 'active'
      )
  ) then
    raise exception 'Transfer the setlists this organization uses before leaving.';
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
