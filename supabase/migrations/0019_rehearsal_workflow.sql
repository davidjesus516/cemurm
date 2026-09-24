-- CEMURM 0019 — Rehearsal Workflow: agendas, publishing, run-throughs, carry-over, agreed-key changes
--
-- Backend of features/rehearsal-workflow.feature (17 scenarios) on top of the 0001
-- rehearsal core (rehearsals / rehearsal_items exist + are deny-by-default since 0002;
-- agenda order comes from the referenced setlist's setlist_items.position — no position
-- column on rehearsal_items, 0001 lines 394-404). Hito 4 slice; base = main (0001-0013
-- only — nothing here references 0014-0018, which live on other branches).
--
-- Scenario map (features/rehearsal-workflow.feature):
--   1  Build agenda from setlist ........ create_rehearsal mirrors setlist_items in
--                                        position order (version_id per item); agreed key
--                                        stays on the setlist item (client join) — no copy.
--   2  Chart readiness flag ............. CLIENT-side: song_versions.is_ready is already
--                                        client-readable (0003); backend guarantees columns.
--   3  Members per song ................. setlist_items.vocal_parts (0001, open part
--                                        vocabulary); publish_rehearsal derives DISTINCT
--                                        assigned user_ids from it into rehearsal_rsvps.
--   4  Songs not in the setlist ......... add_rehearsal_song (agenda extra; the client
--                                        renders 'Not in setlist' by setlist membership).
--   5  Publishing notifies the band ..... publish_rehearsal → rehearsal_rsvps ('invited')
--                                        + public.notify_user ('invitation') per assignee.
--   6  Duration estimate ................ CLIENT-side: song_versions.duration_seconds
--                                        (0001) + agenda rows; no estimate RPC.
--   7  Overrun / timebox ................ CLIENT-side: rehearsals.timebox_minutes vs the
--                                        estimate; trim = mark_rehearsal_outcome
--                                        'quick_review' (scenario 8 drops the slot client-side).
--   8  Trim keeps agenda intact ......... mark_rehearsal_outcome 'quick_review' only.
--   9  Run-through outcome + count ...... record_rehearsal_run (run_count) +
--                                        mark_rehearsal_outcome (outcome).
--  10  Needs-work carries to next agenda  create_rehearsal carry-over: latest
--                                        completed/published rehearsal on the same setlist
--                                        with a needs_work item for the song passes its
--                                        notes forward + sets the OLD item's carry_over_to.
--  11  Notes attach back to the song .... update_rehearsal_note (rehearsal_items.notes;
--                                        NOT chart content — 0001 line 401).
--  12  Chart edit during rehearsal ...... song_versions append-only (0001/0003) — no new
--                                        backend here.
--  13  Agreed key changed by leader ..... change_setlist_item_key + setlist_change_log
--                                        (decider = the acting leader; projection update is
--                                        client-side via the setlist read path).
--  14  Ready chart ≠ polished ........... song_versions.is_ready (0003) and
--                                        rehearsal_items.outcome are independent columns.
--  15  Absent member parts flagged ...... rehearsal_rsvps 'declined' + vocal_parts
--                                        (client flags uncovered parts; the substitution
--                                        link stays the 0001 substitution_requests
--                                        placeholder — untouched this slice).
--  16/17 Offline & sync ................. outbox (0001 schema-only) — client-side queue;
--                                        backend only persists notes/outcomes for replay.
--
-- Architecture follows the repo RPC contract exactly (0010/0012/0013): SECURITY DEFINER
-- cores in `private` (set search_path = '', fully-qualified public. refs, session-bound
-- auth.uid() guards) + one thin `public` wrapper per entry point (PostgREST exposes only
-- public/graphql_public, 0005 lines 3-6). Helper execute is revoked from public/anon then
-- granted to authenticated (0002 lines 33-39, 142-149); private-schema default privileges
-- were locked in 0002 line 42.
--
-- Policy-recursion contract (0002 header lines 136-141): no policy on a table references
-- a relation whose policies reference that table back. Here all cross-table resolution
-- flows through SECURITY DEFINER helpers (session_rehearsal_visible / _writable /
-- session_may_mark_item read rehearsals + org_memberships + event_participants as owner,
-- never through a client policy predicate); rehearsal_rsvps/setlist_change_log policies
-- reference rehearsals/setlists/setlist_collaborators ONE-way (nothing on those tables
-- references the new tables), so the policy graph stays acyclic.
--
-- The events family is deny-by-default on this branch: event-scope membership is resolved
-- ONLY inside definer helpers (never in a client-visible predicate that would error on the
-- missing grants, 0017 note).
--
-- ⚠ DEVIATION (documented): the events family schema (0001 lines 241-267) has NO
-- user→event edge on event_participants (PK (event_id, org_id) — org↔event only; users↔event
-- is event_rsvps.member_id, which is RSVP state, not the participant set). The slice's
-- ep.user_id draft predicate would raise "column ep.user_id does not exist" the moment an
-- event-scope rehearsal row is evaluated. Event-scope membership is therefore resolved as:
-- the session is an ACTIVE member of an org participating in the event via event_participants
-- (still read as SECURITY DEFINER only). Not exercised by this slice's smoke matrix (org-scope
-- only) but correct + live-safe.

-- ══════════════════════ 1. NEW TABLES ══════════════════════
-- rehearsal_rsvps: agenda publish → per-member invitation state (scenario 5 / 15).
create table public.rehearsal_rsvps (
  id           uuid primary key default gen_random_uuid(),
  rehearsal_id uuid not null references public.rehearsals(id) on delete cascade,
  user_id      uuid not null references auth.users(id),
  status       text not null default 'invited',   -- 'invited' | 'confirmed' | 'declined' | 'undecided'
  responded_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (rehearsal_id, user_id)
);
create index idx_rehearsal_rsvps_rehearsal on public.rehearsal_rsvps (rehearsal_id);

-- setlist_change_log: agreed-key changes logged with the acting leader as decider (scenario 13).
create table public.setlist_change_log (
  id         uuid primary key default gen_random_uuid(),
  setlist_id uuid not null references public.setlists(id) on delete cascade,
  actor_id   uuid not null references auth.users(id),
  action     text not null,                        -- 'agreed_key_change'
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_setlist_change_log_setlist on public.setlist_change_log (setlist_id, created_at desc);

-- ══════════════════════ 2. RLS ══════════════════════
-- ══════════════════════ 2.1 DEFINER HELPERS (policies + RPC guards) ══════════════════════
-- session_rehearsal_visible: the rehearsals read scope — created_by = session, OR
-- org-scope member of the rehearsal's org, OR event-scope member of a participating org.
-- Doubles as the 'Rehearsal not found.' guard in the write RPCs. Definer read of
-- rehearsals from within a rehearsals policy is safe (0002 helper precedent: the owner
-- bypasses RLS, so the helper never re-enters the policy).
create function private.session_rehearsal_visible(p_rehearsal_id uuid) returns boolean
  language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.rehearsals r
    where r.id = p_rehearsal_id
      and (
        r.created_by = (select auth.uid())
        or (
          r.scope = 'org'
          and r.org_id is not null
          and private.is_org_member((select auth.uid()), r.org_id) is not null
        )
        or (
          r.scope = 'event'
          and r.event_id is not null
          and exists (
            select 1 from public.event_participants ep
            where ep.event_id = r.event_id
              and exists (
                select 1 from public.org_memberships om
                where om.org_id = ep.org_id
                  and om.user_id = (select auth.uid())
                  and om.status = 'active'
              )
          )
        )
      )
  ) $$;

-- session_rehearsal_writable: rehearsal leader (created_by) and the rehearsal is not
-- completed — the "leader may COMPLETE once, then rows lock read-only" gate (0001 line 388).
create function private.session_rehearsal_writable(p_rehearsal_id uuid) returns boolean
  language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.rehearsals r
    where r.id = p_rehearsal_id
      and r.created_by = (select auth.uid())
      and r.status <> 'completed'
  ) $$;

-- session_may_mark_item: a member (or the leader) may mark outcomes/notes/run counts on an
-- open (non-completed) rehearsal — the rehearsal_items UPDATE scope (doc: "leader
-- creates/publishes; members mark outcomes/notes on assigned songs").
create function private.session_may_mark_item(p_rehearsal_id uuid) returns boolean
  language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.rehearsals r
    where r.id = p_rehearsal_id
      and r.status <> 'completed'
      and (
        r.created_by = (select auth.uid())
        or (
          r.scope = 'org'
          and r.org_id is not null
          and private.is_org_member((select auth.uid()), r.org_id) is not null
        )
        or (
          r.scope = 'event'
          and r.event_id is not null
          and exists (
            select 1 from public.event_participants ep
            where ep.event_id = r.event_id
              and exists (
                select 1 from public.org_memberships om
                where om.org_id = ep.org_id
                  and om.user_id = (select auth.uid())
                  and om.status = 'active'
              )
          )
        )
      )
  ) $$;

-- display_name_for: profiles.display_name → username → 'Someone' (NULL-tolerant identity
-- surface for this slice; profiles is client-readable via 0006 column-capped grants).
create or replace function private.display_name_for(p_user_id uuid) returns text
  language sql security definer stable set search_path = '' as $$
  select coalesce(pr.display_name, pr.username, 'Someone')
  from public.profiles pr
  where pr.id = p_user_id $$;

-- execution locked (0002 lines 33-39 shape): deny public/anon, open for authenticated
revoke execute on function private.session_rehearsal_visible(uuid) from public, anon;
revoke execute on function private.session_rehearsal_writable(uuid) from public, anon;
revoke execute on function private.session_may_mark_item(uuid) from public, anon;
revoke execute on function private.display_name_for(uuid) from public, anon;
grant execute on function private.session_rehearsal_visible(uuid) to authenticated, service_role;
grant execute on function private.session_rehearsal_writable(uuid) to authenticated, service_role;
grant execute on function private.session_may_mark_item(uuid) to authenticated, service_role;
grant execute on function private.display_name_for(uuid) to authenticated, service_role;

-- ══════════════════════ 2.2 REHEARSALS ══════════════════════
-- 0002's DO-loop enabled RLS on these tables; re-declared so 0019 stands alone (0004
-- lines 34-39 precedent). Deny-by-default re-declared before the first targeted grant (D6).
alter table public.rehearsals enable row level security;
alter table public.rehearsal_items enable row level security;
alter table public.rehearsal_rsvps enable row level security;
alter table public.setlist_change_log enable row level security;

revoke all on table public.rehearsals from public, anon, authenticated;
revoke all on table public.rehearsal_items from public, anon, authenticated;
revoke all on table public.rehearsal_rsvps from public, anon, authenticated;
revoke all on table public.setlist_change_log from public, anon, authenticated;

-- rehearsals: SELECT = read scope (created_by OR org member OR event member).
-- INSERT = creator, org-scope only (event-scope rehearsals are created by the events
-- flow, not this slice). UPDATE = leader while not completed; WITH CHECK lets the leader
-- COMPLETE once (planned/published ↔ completed) and then blocks every further edit.
-- DELETE = leader + not completed.
drop policy if exists rehearsals_select_visible on public.rehearsals;
create policy rehearsals_select_visible on public.rehearsals
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and private.session_rehearsal_visible(id)
  );

drop policy if exists rehearsals_insert_leader on public.rehearsals;
create policy rehearsals_insert_leader on public.rehearsals
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and created_by = (select auth.uid())
    and scope = 'org'
    and private.is_org_member((select auth.uid()), org_id) is not null
  );

drop policy if exists rehearsals_update_leader on public.rehearsals;
create policy rehearsals_update_leader on public.rehearsals
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and created_by = (select auth.uid())
    and status <> 'completed'
  )
  with check (
    (select auth.uid()) is not null
    and created_by = (select auth.uid())
    and (status in ('planned', 'published') or status = 'completed')
  );

drop policy if exists rehearsals_delete_leader on public.rehearsals;
create policy rehearsals_delete_leader on public.rehearsals
  for delete to authenticated
  using (
    (select auth.uid()) is not null
    and created_by = (select auth.uid())
    and status <> 'completed'
  );

-- ══════════════════════ 2.3 REHEARSAL_ITEMS ══════════════════════
-- SELECT = read scope through the parent. INSERT/DELETE = leader of the parent + parent
-- not completed (agenda shape is RPC/leader-owned). UPDATE = leader OR org member OR
-- event member (members mark outcomes/notes/run counts) while the parent is NOT
-- completed — expressed through session_may_mark_item so completed rehearsals go
-- read-only for every role, WITH CHECK = same helper (read scope == edit scope).
drop policy if exists rehearsal_items_select_visible on public.rehearsal_items;
create policy rehearsal_items_select_visible on public.rehearsal_items
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and private.session_rehearsal_visible(rehearsal_id)
  );

drop policy if exists rehearsal_items_insert_leader on public.rehearsal_items;
create policy rehearsal_items_insert_leader on public.rehearsal_items
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and private.session_rehearsal_writable(rehearsal_id)
  );

drop policy if exists rehearsal_items_update_member on public.rehearsal_items;
create policy rehearsal_items_update_member on public.rehearsal_items
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and private.session_may_mark_item(rehearsal_id)
  )
  with check (
    (select auth.uid()) is not null
    and private.session_may_mark_item(rehearsal_id)
  );

drop policy if exists rehearsal_items_delete_leader on public.rehearsal_items;
create policy rehearsal_items_delete_leader on public.rehearsal_items
  for delete to authenticated
  using (
    (select auth.uid()) is not null
    and private.session_rehearsal_writable(rehearsal_id)
  );

-- ══════════════════════ 2.4 REHEARSAL_RSVPS ══════════════════════
-- SELECT = rehearsal read scope (agenda shows who confirmed / who has not, scenario 5).
-- INSERT = the leader only, while not completed (publish_rehearsal creates the invited
-- rows as definer; this policy is the client/service-role surface). UPDATE = SELF
-- response only, once, from 'invited' → confirmed/declined/undecided (responded_at is
-- stamped by the rsvp_rehearsal RPC; a client PATCH without the stamp is validated by
-- rsvp_rehearsal on replay). DELETE = leader.
drop policy if exists rehearsal_rsvps_select_visible on public.rehearsal_rsvps;
create policy rehearsal_rsvps_select_visible on public.rehearsal_rsvps
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and private.session_rehearsal_visible(rehearsal_id)
  );

drop policy if exists rehearsal_rsvps_insert_leader on public.rehearsal_rsvps;
create policy rehearsal_rsvps_insert_leader on public.rehearsal_rsvps
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.rehearsals r
      where r.id = rehearsal_id
        and r.created_by = (select auth.uid())
        and r.status <> 'completed'
    )
  );

drop policy if exists rehearsal_rsvps_update_self on public.rehearsal_rsvps;
create policy rehearsal_rsvps_update_self on public.rehearsal_rsvps
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and status = 'invited'
  )
  with check (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and status in ('confirmed', 'declined', 'undecided')
  );

drop policy if exists rehearsal_rsvps_delete_leader on public.rehearsal_rsvps;
create policy rehearsal_rsvps_delete_leader on public.rehearsal_rsvps
  for delete to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1 from public.rehearsals r
      where r.id = rehearsal_id
        and r.created_by = (select auth.uid())
    )
  );

-- ══════════════════════ 2.5 SETLIST_CHANGE_LOG ══════════════════════
-- SELECT mirrors the 0002 setlist-visibility predicate exactly (setlists_select_member,
-- 0002 lines 176-190: owner OR accepted collaborator) so the change history is readable
-- by exactly the setlist's audience. No client INSERT policy — writes are RPC-only
-- (change_setlist_item_key logs as definer). Acyclic: setlist_collaborators resolves its
-- own parent through private.session_owns_setlist (0002 lines 142-149), so nothing here
-- re-enters setlist_change_log.
drop policy if exists setlist_change_log_select_member on public.setlist_change_log;
create policy setlist_change_log_select_member on public.setlist_change_log
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and (
      exists (
        select 1 from public.setlist_collaborators sc
        where sc.setlist_id = public.setlist_change_log.setlist_id
          and sc.user_id = (select auth.uid())
          and sc.accepted_at is not null
      )
      or exists (
        select 1 from public.setlists s
        where s.id = public.setlist_change_log.setlist_id
          and s.owner_id = (select auth.uid())
      )
    )
  );

-- ══════════════════════ 2.6 TABLE GRANTS AFTER POLICIES (D6 ORDER) ══════════════════════
-- SELECT-only exposure: rehearsals/rehearsal_items/rsvps/log are read by the client;
-- every write is RPC-only EXCEPT the rsvps self-response row (rehearsal_rsvps UPDATE,
-- the only client-visible write surface this slice ships).
grant select on table public.rehearsals to authenticated;
grant select on table public.rehearsal_items to authenticated;
grant select on table public.rehearsal_rsvps to authenticated;
grant select on table public.setlist_change_log to authenticated;
grant update on table public.rehearsal_rsvps to authenticated;

-- ══════════════════════ 3. RPCS (definer core + public wrapper) ══════════════════════
-- ══════════════════════ 3.1 CREATE_REHEARSAL (scenarios 1, 9, 12) ══════════════════════
-- Leader (= creator) builds an org-scope agenda from a setlist: org membership gate,
-- setlist-visibility gate (0002 predicate re-asserted — definer bypasses RLS), insert,
-- then mirror the setlist items in position order. Carry-over contract (scenario 10):
-- for every mirrored song, if the LATEST completed/published rehearsal on the same
-- setlist has a needs_work item for that song, its notes are copied forward and the OLD
-- item's carry_over_to is set to the new rehearsal id (the client renders the tag from
-- rehearsal_items.notes + carry_over_to presence).
create or replace function private.create_rehearsal(
  p_org_id uuid,
  p_name text,
  p_setlist_id uuid,
  p_timebox_minutes integer,
  p_planned_for timestamptz
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor         uuid := (select auth.uid());
  v_rehearsal_id  uuid;
  v_item          record;
  v_prior         uuid;
  v_prior_item_id uuid;
  v_prior_note    text;
begin
  -- initPlan guard (0002 line 130 shape): no session → no rehearsal
  if v_actor is null then
    raise exception 'Not a member.';
  end if;

  -- org gate: an active org member of p_org_id may create (0002 is_org_member, session-bound)
  if private.is_org_member(v_actor, p_org_id) is null then
    raise exception 'Not a member.';
  end if;

  -- setlist gate: the source setlist must be readable under the 0002
  -- setlists_select_member predicate (owner OR accepted collaborator) — re-asserted
  -- explicitly because this definer bypasses RLS.
  if not exists (
    select 1 from public.setlists s
    where s.id = p_setlist_id
      and (
        s.owner_id = v_actor
        or exists (
          select 1 from public.setlist_collaborators c
          where c.setlist_id = s.id
            and c.user_id = v_actor
            and c.accepted_at is not null
        )
      )
  ) then
    raise exception 'Setlist not found.';
  end if;

  insert into public.rehearsals
    (org_id, scope, name, setlist_id, timebox_minutes, status, planned_for, created_by)
  values
    (p_org_id, 'org', p_name, p_setlist_id, p_timebox_minutes, 'planned', p_planned_for, v_actor)
  returning id into v_rehearsal_id;

  -- mirror the setlist agenda in setlist_items.position order (0001 line 180)
  for v_item in
    select si.song_id, si.version_id
    from public.setlist_items si
    where si.setlist_id = p_setlist_id
    order by si.position
  loop
    insert into public.rehearsal_items (rehearsal_id, song_id, version_id)
    values (v_rehearsal_id, v_item.song_id, v_item.version_id);

    -- carry-over: latest completed/published rehearsal referencing this setlist whose
    -- item for the same song was marked needs_work (UNIQUE (rehearsal_id, song_id) ⇒ at
    -- most one such item per prior rehearsal).
    select r0.id into v_prior
    from public.rehearsals r0
    where r0.org_id = p_org_id
      and r0.setlist_id = p_setlist_id
      and r0.id <> v_rehearsal_id
      and r0.status in ('completed', 'published')
      and exists (
        select 1 from public.rehearsal_items pri
        where pri.rehearsal_id = r0.id
          and pri.song_id = v_item.song_id
          and pri.outcome = 'needs_work'
      )
    order by r0.created_at desc, r0.id desc
    limit 1;

    if v_prior is not null then
      select pri.id, pri.notes into v_prior_item_id, v_prior_note
      from public.rehearsal_items pri
      where pri.rehearsal_id = v_prior
        and pri.song_id = v_item.song_id
        and pri.outcome = 'needs_work'
      limit 1;

      -- attach the previous rehearsal's notes to the fresh agenda row
      update public.rehearsal_items
      set notes = v_prior_note
      where rehearsal_id = v_rehearsal_id
        and song_id = v_item.song_id;

      -- link the old item forward to this rehearsal
      update public.rehearsal_items
      set carry_over_to = v_rehearsal_id
      where id = v_prior_item_id;
    end if;
  end loop;

  return v_rehearsal_id;
end $$;

-- ══════════════════════ 3.2 PUBLISH_REHEARSAL (scenario 5) ══════════════════════
-- Leader-only, rehearsal not completed. Flips status → 'published', derives the DISTINCT
-- assigned user_ids from the agenda setlist's vocal_parts (join through
-- rehearsals.setlist_id), inserts an 'invited' rsvp per assignee (UNIQUE absorbs
-- duplicates), and notifies each assignee (self-notifications suppressed by 0008).
create or replace function private.publish_rehearsal(p_rehearsal_id uuid)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_actor     uuid := (select auth.uid());
  v_rehearsal public.rehearsals%rowtype;
  v_member    uuid;
  v_count     integer := 0;
begin
  if v_actor is null then
    raise exception 'Only the leader can publish this rehearsal.';
  end if;
  -- leader + not completed first (0002 line 130 shape via the writable helper)
  if not private.session_rehearsal_writable(p_rehearsal_id) then
    raise exception 'Only the leader can publish this rehearsal.';
  end if;
  if not private.session_rehearsal_visible(p_rehearsal_id) then
    raise exception 'Rehearsal not found.';
  end if;

  select * into v_rehearsal
  from public.rehearsals
  where id = p_rehearsal_id;

  update public.rehearsals
  set status = 'published'
  where id = p_rehearsal_id;

  -- assignees = DISTINCT user_ids across the agenda setlist's vocal_parts
  for v_member in
    select distinct (vp ->> 'user_id')::uuid as user_id
    from public.setlist_items si
    cross join lateral jsonb_array_elements(si.vocal_parts) vp
    where si.setlist_id = v_rehearsal.setlist_id
      and vp ->> 'user_id' is not null
  loop
    insert into public.rehearsal_rsvps (rehearsal_id, user_id, status)
    values (p_rehearsal_id, v_member, 'invited')
    on conflict (rehearsal_id, user_id) do nothing;

    perform public.notify_user(
      v_member,
      'invitation',
      'Rehearsal invitation: ' || coalesce(v_rehearsal.name, ''),
      'You are assigned to songs in this agenda.',
      jsonb_build_object('rehearsal_id', p_rehearsal_id));

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

-- ══════════════════════ 3.3 RSVP_REHEARSAL (scenario 5) ══════════════════════
-- A member answers their own invitation exactly once, from 'invited'. The RLS self-update
-- policy (rehearsal_rsvps_update_self) is the row guard; this RPC adds the status
-- vocabulary validation and stamps responded_at. The definer re-asserts the same
-- invariants (user_id = auth.uid(), current status 'invited') — a second answer after the
-- row left 'invited' raises.
create or replace function private.rsvp_rehearsal(p_rehearsal_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'You are not invited to this rehearsal.';
  end if;

  if p_status is null or p_status not in ('confirmed', 'declined', 'undecided') then
    raise exception 'Invalid status.';
  end if;

  update public.rehearsal_rsvps
  set status = p_status, responded_at = now()
  where rehearsal_id = p_rehearsal_id
    and user_id = v_actor
    and status = 'invited';

  if not found then
    raise exception 'You are not invited to this rehearsal.';
  end if;
end $$;

-- ══════════════════════ 3.4 ADD_REHEARSAL_SONG (scenario 4) ══════════════════════
-- Leader-only, rehearsal not completed. Adds a song to the agenda WITHOUT touching the
-- setlist (the client renders 'Not in setlist' by joining setlist membership). One row per
-- (rehearsal, song) — duplicates refused.
create or replace function private.add_rehearsal_song(p_rehearsal_id uuid, p_song_id uuid)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_actor       uuid := (select auth.uid());
  v_new_item_id uuid;
begin
  if v_actor is null then
    raise exception 'Only the leader can add songs to this rehearsal.';
  end if;
  if not private.session_rehearsal_writable(p_rehearsal_id) then
    raise exception 'Only the leader can add songs to this rehearsal.';
  end if;
  if not private.session_rehearsal_visible(p_rehearsal_id) then
    raise exception 'Rehearsal not found.';
  end if;

  if exists (
    select 1 from public.rehearsal_items
    where rehearsal_id = p_rehearsal_id and song_id = p_song_id
  ) then
    raise exception 'Song already in the agenda.';
  end if;

  insert into public.rehearsal_items (rehearsal_id, song_id)
  values (p_rehearsal_id, p_song_id)
  returning id into v_new_item_id;

  return v_new_item_id;
end $$;

-- ══════════════════════ 3.5 RECORD_REHEARSAL_RUN (scenario 9) ══════════════════════
-- A member (or the leader) increments run_count on an open rehearsal's agenda item.
-- Guard chain: visible ('Rehearsal not found.') → item belongs to the rehearsal ('Song not
-- in the agenda.') → the write itself is gated by session_may_mark_item, so a completed
-- rehearsal silently blocks it (0 rows via the same predicate the RLS policy enforces).
create or replace function private.record_rehearsal_run(p_rehearsal_id uuid, p_item_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'Rehearsal not found.';
  end if;
  if not private.session_rehearsal_visible(p_rehearsal_id) then
    raise exception 'Rehearsal not found.';
  end if;
  if not exists (
    select 1 from public.rehearsal_items
    where id = p_item_id and rehearsal_id = p_rehearsal_id
  ) then
    raise exception 'Song not in the agenda.';
  end if;

  update public.rehearsal_items
  set run_count = run_count + 1
  where id = p_item_id
    and rehearsal_id = p_rehearsal_id
    and private.session_may_mark_item(p_rehearsal_id);
end $$;

-- ══════════════════════ 3.6 MARK_REHEARSAL_OUTCOME (scenarios 8, 9, 14) ══════════════════════
-- Same authority shape as record_rehearsal_run; outcome vocabulary
-- ('polished' | 'needs_work' | 'quick_review') validated before the write.
create or replace function private.mark_rehearsal_outcome(p_rehearsal_id uuid, p_item_id uuid, p_outcome text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'Rehearsal not found.';
  end if;
  if not private.session_rehearsal_visible(p_rehearsal_id) then
    raise exception 'Rehearsal not found.';
  end if;
  if not exists (
    select 1 from public.rehearsal_items
    where id = p_item_id and rehearsal_id = p_rehearsal_id
  ) then
    raise exception 'Song not in the agenda.';
  end if;
  if p_outcome is null or p_outcome not in ('polished', 'needs_work', 'quick_review') then
    raise exception 'Invalid outcome.';
  end if;

  update public.rehearsal_items
  set outcome = p_outcome
  where id = p_item_id
    and rehearsal_id = p_rehearsal_id
    and private.session_may_mark_item(p_rehearsal_id);
end $$;

-- ══════════════════════ 3.7 UPDATE_REHEARSAL_NOTE (scenario 11) ══════════════════════
-- Same authority shape; rehearsal_items.notes carries the rehearsal history back to the
-- song (never chart content — 0001 line 401). NULL clears the note.
create or replace function private.update_rehearsal_note(p_rehearsal_id uuid, p_item_id uuid, p_note text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'Rehearsal not found.';
  end if;
  if not private.session_rehearsal_visible(p_rehearsal_id) then
    raise exception 'Rehearsal not found.';
  end if;
  if not exists (
    select 1 from public.rehearsal_items
    where id = p_item_id and rehearsal_id = p_rehearsal_id
  ) then
    raise exception 'Song not in the agenda.';
  end if;

  update public.rehearsal_items
  set notes = p_note
  where id = p_item_id
    and rehearsal_id = p_rehearsal_id
    and private.session_may_mark_item(p_rehearsal_id);
end $$;

-- ══════════════════════ 3.8 COMPLETE_REHEARSAL (scenario 14) ══════════════════════
-- Leader closes the rehearsal once; the update is additionally guarded by
-- status <> 'completed' so a repeat call reports 'already completed' and afterwards the
-- row is read-only for every role (rehearsals policies + session_* helpers).
create or replace function private.complete_rehearsal(p_rehearsal_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'Only the leader can complete this rehearsal.';
  end if;
  -- leader gate is created_by only (a completed row still belongs to its leader)
  if not exists (
    select 1 from public.rehearsals r
    where r.id = p_rehearsal_id and r.created_by = v_actor
  ) then
    raise exception 'Only the leader can complete this rehearsal.';
  end if;
  if not private.session_rehearsal_visible(p_rehearsal_id) then
    raise exception 'Rehearsal not found.';
  end if;

  update public.rehearsals
  set status = 'completed'
  where id = p_rehearsal_id
    and status <> 'completed';

  if not found then
    raise exception 'Rehearsal not found or already completed.';
  end if;
end $$;

-- ══════════════════════ 3.9 CHANGE_SETLIST_ITEM_KEY (scenario 13) ══════════════════════
-- Agreed-key authority: the setlist owner/accepted collaborator (0002 predicate mirror)
-- OR the leader (created_by) of any org-scope rehearsal referencing the setlist that is
-- not completed (a band leader bends the key mid-rehearsal without setlist ownership).
-- Key must be non-empty; the item must belong to the setlist; the change is logged with
-- the acting user as decider (setlist_change_log.action 'agreed_key_change').
create or replace function private.change_setlist_item_key(p_setlist_id uuid, p_item_id uuid, p_agreed_key text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor   uuid := (select auth.uid());
  v_song_id uuid;
  v_old_key text;
begin
  if v_actor is null then
    raise exception 'Invalid key.';
  end if;

  if p_agreed_key is null or btrim(p_agreed_key) = '' then
    raise exception 'Invalid key.';
  end if;

  -- authority: setlist owner/accepted-collaborator OR rehearsal leader on an open
  -- org-scope rehearsal that references this setlist
  if not (
    exists (
      select 1 from public.setlists s
      where s.id = p_setlist_id
        and (
          s.owner_id = v_actor
          or exists (
            select 1 from public.setlist_collaborators c
            where c.setlist_id = s.id
              and c.user_id = v_actor
              and c.accepted_at is not null
          )
        )
    )
    or exists (
      select 1 from public.rehearsals r
      where r.setlist_id = p_setlist_id
        and r.scope = 'org'
        and r.status <> 'completed'
        and r.created_by = v_actor
    )
  ) then
    raise exception 'Only the setlist owner or the rehearsal leader can change the agreed key.';
  end if;

  select si.song_id, si.agreed_key into v_song_id, v_old_key
  from public.setlist_items si
  where si.id = p_item_id and si.setlist_id = p_setlist_id;

  if not found then
    raise exception 'Item not found in the setlist.';
  end if;

  update public.setlist_items si
  set agreed_key = p_agreed_key
  where si.id = p_item_id and si.setlist_id = p_setlist_id;

  insert into public.setlist_change_log (setlist_id, actor_id, action, detail)
  values (
    p_setlist_id,
    v_actor,
    'agreed_key_change',
    jsonb_build_object(
      'item_id', p_item_id,
      'song_id', v_song_id,
      'old_key', v_old_key,
      'new_key', p_agreed_key,
      'decider', v_actor
    )
  );
end $$;

-- ══════════════════════ 3.10 PUBLIC WRAPPERS + EXECUTE GRANTS ══════════════════════
-- Thin PostgREST-reachable entry points (0005 lines 3-6); the definer logic stays in
-- `private` (0010/0012 pattern). Locked from public/anon, opened for authenticated only.
create or replace function public.create_rehearsal(
  p_org_id uuid,
  p_name text,
  p_setlist_id uuid,
  p_timebox_minutes integer,
  p_planned_for timestamptz
)
returns uuid
language sql security definer set search_path = '' as $$
  select private.create_rehearsal(p_org_id, p_name, p_setlist_id, p_timebox_minutes, p_planned_for);
$$;

create or replace function public.publish_rehearsal(p_rehearsal_id uuid)
returns integer
language sql security definer set search_path = '' as $$
  select private.publish_rehearsal(p_rehearsal_id);
$$;

create or replace function public.rsvp_rehearsal(p_rehearsal_id uuid, p_status text)
returns void
language sql security definer set search_path = '' as $$
  select private.rsvp_rehearsal(p_rehearsal_id, p_status);
$$;

create or replace function public.add_rehearsal_song(p_rehearsal_id uuid, p_song_id uuid)
returns uuid
language sql security definer set search_path = '' as $$
  select private.add_rehearsal_song(p_rehearsal_id, p_song_id);
$$;

create or replace function public.record_rehearsal_run(p_rehearsal_id uuid, p_item_id uuid)
returns void
language sql security definer set search_path = '' as $$
  select private.record_rehearsal_run(p_rehearsal_id, p_item_id);
$$;

create or replace function public.mark_rehearsal_outcome(p_rehearsal_id uuid, p_item_id uuid, p_outcome text)
returns void
language sql security definer set search_path = '' as $$
  select private.mark_rehearsal_outcome(p_rehearsal_id, p_item_id, p_outcome);
$$;

create or replace function public.update_rehearsal_note(p_rehearsal_id uuid, p_item_id uuid, p_note text)
returns void
language sql security definer set search_path = '' as $$
  select private.update_rehearsal_note(p_rehearsal_id, p_item_id, p_note);
$$;

create or replace function public.complete_rehearsal(p_rehearsal_id uuid)
returns void
language sql security definer set search_path = '' as $$
  select private.complete_rehearsal(p_rehearsal_id);
$$;

create or replace function public.change_setlist_item_key(p_setlist_id uuid, p_item_id uuid, p_agreed_key text)
returns void
language sql security definer set search_path = '' as $$
  select private.change_setlist_item_key(p_setlist_id, p_item_id, p_agreed_key);
$$;

-- private-schema default-revoke convention (0002 lines 33-42): lock the cores, then open
-- them for authenticated only; anon stays locked everywhere.
revoke execute on function private.create_rehearsal(uuid, text, uuid, integer, timestamptz) from public, anon;
revoke execute on function private.publish_rehearsal(uuid) from public, anon;
revoke execute on function private.rsvp_rehearsal(uuid, text) from public, anon;
revoke execute on function private.add_rehearsal_song(uuid, uuid) from public, anon;
revoke execute on function private.record_rehearsal_run(uuid, uuid) from public, anon;
revoke execute on function private.mark_rehearsal_outcome(uuid, uuid, text) from public, anon;
revoke execute on function private.update_rehearsal_note(uuid, uuid, text) from public, anon;
revoke execute on function private.complete_rehearsal(uuid) from public, anon;
revoke execute on function private.change_setlist_item_key(uuid, uuid, text) from public, anon;
grant execute on function private.create_rehearsal(uuid, text, uuid, integer, timestamptz) to authenticated;
grant execute on function private.publish_rehearsal(uuid) to authenticated;
grant execute on function private.rsvp_rehearsal(uuid, text) to authenticated;
grant execute on function private.add_rehearsal_song(uuid, uuid) to authenticated;
grant execute on function private.record_rehearsal_run(uuid, uuid) to authenticated;
grant execute on function private.mark_rehearsal_outcome(uuid, uuid, text) to authenticated;
grant execute on function private.update_rehearsal_note(uuid, uuid, text) to authenticated;
grant execute on function private.complete_rehearsal(uuid) to authenticated;
grant execute on function private.change_setlist_item_key(uuid, uuid, text) to authenticated;

revoke execute on function public.create_rehearsal(uuid, text, uuid, integer, timestamptz) from public, anon;
revoke execute on function public.publish_rehearsal(uuid) from public, anon;
revoke execute on function public.rsvp_rehearsal(uuid, text) from public, anon;
revoke execute on function public.add_rehearsal_song(uuid, uuid) from public, anon;
revoke execute on function public.record_rehearsal_run(uuid, uuid) from public, anon;
revoke execute on function public.mark_rehearsal_outcome(uuid, uuid, text) from public, anon;
revoke execute on function public.update_rehearsal_note(uuid, uuid, text) from public, anon;
revoke execute on function public.complete_rehearsal(uuid) from public, anon;
revoke execute on function public.change_setlist_item_key(uuid, uuid, text) from public, anon;
grant execute on function public.create_rehearsal(uuid, text, uuid, integer, timestamptz) to authenticated;
grant execute on function public.publish_rehearsal(uuid) to authenticated;
grant execute on function public.rsvp_rehearsal(uuid, text) to authenticated;
grant execute on function public.add_rehearsal_song(uuid, uuid) to authenticated;
grant execute on function public.record_rehearsal_run(uuid, uuid) to authenticated;
grant execute on function public.mark_rehearsal_outcome(uuid, uuid, text) to authenticated;
grant execute on function public.update_rehearsal_note(uuid, uuid, text) to authenticated;
grant execute on function public.complete_rehearsal(uuid) to authenticated;
grant execute on function public.change_setlist_item_key(uuid, uuid, text) to authenticated;