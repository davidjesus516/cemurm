-- CEMURM 0052 — assignable tasks: one collaborator, one task, one status
--
-- Requirement source:
--   features/assignable-tasks.feature (8 scenarios)
--
-- ── THE MODEL IS ONE ROW, ON PURPOSE ──────────────────────────────────────────────────────
-- A task has a creator, an assignee, a title, an optional due date and a status. There is no
-- list, project, tag, comment, priority or attachment entity. The entry rule in
-- docs/engineering-review-backlog.md:5 (implement only what a hito or BDD feature requires)
-- is what keeps this table from growing into a tracker this app does not need.
--
-- ── "COLLABORATOR" MEANS AN ACTIVE BANDMATE ─────────────────────────────────────────────
-- The app already has the notion of two people working together: `bandmate_links`
-- (0001:406), where a row is `pending` until the invitee accepts and `active` afterwards.
-- The insert policy reuses exactly that, in EITHER direction — a bandmate edge is directional
-- (the inviter is `user_id`), and assigning someone a task must not depend on which side
-- invited whom. Reusing the existing relation is the point: there is no second, separately
-- maintained notion of "team" that could drift from the bandmate list.
--
-- Assignment is checked at INSERT only. Removing a bandmate afterwards deliberately leaves
-- the tasks already assigned readable and completable (feature scenario 8): the work exists,
-- and deleting it would be data loss the user did not ask for. The pair simply cannot create
-- NEW tasks for each other.
--
-- ── WHO MAY DO WHAT, AND WHY IT IS SPLIT ACROSS TWO MECHANISMS ───────────────────────────
--   select   creator OR assignee. Nobody else, including a shared org — a task is a private
--            note between two people, not an org document.
--   insert   the creator, assigning an ACTIVE bandmate, never themselves.
--   update   the ASSIGNEE only, and only `status` / `completed_at`.
--   delete   the creator only (withdraw).
--
-- RLS cannot restrict a single policy to individual columns, so the "only status" half is a
-- COLUMN-LEVEL GRANT (`grant update (status, completed_at)`) and the "only the assignee" half
-- is the policy's USING/WITH CHECK. Both are needed: the grant without the policy would let
-- the creator complete someone else's work, and the policy without the grant would let the
-- assignee rewrite the title or hand the task to a third person.
--
-- `completed_at` is kept consistent with `status` by a CHECK, not by a trigger: `done` iff a
-- timestamp is present. That makes a half-written completion impossible from PostgREST too.
--
-- ── GRANTS NAME ALL THREE ROLES (0047) ──────────────────────────────────────────────────
-- `revoke all ... from public, anon` removes nothing from `authenticated`, which carries the
-- inherited `arwdDxtm` from Supabase's default privileges — 0047 exists because two earlier
-- migrations made exactly that mistake and shipped TRUNCATE. Name `authenticated` in the
-- revoke and re-grant only the four operations the screen performs.

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  created_by   uuid not null references auth.users(id) on delete cascade,
  assigned_to  uuid not null references auth.users(id) on delete cascade,
  title        text not null,
  due_at       date,
  status       text not null default 'open',
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  constraint tasks_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint tasks_status check (status in ('open', 'done')),
  constraint tasks_not_self check (assigned_to <> created_by),
  -- `done` iff completed_at is present. `(a) = (b)` on booleans with NULLs would be NULL
  -- rather than true, so both sides are coalesced to be explicit.
  constraint tasks_completion check ((status = 'done') = (completed_at is not null))
);

-- Both halves of the screen list by one person: "assigned to me" and "assigned by me".
create index tasks_assigned_to_idx on public.tasks (assigned_to, status, due_at);
create index tasks_created_by_idx on public.tasks (created_by, status, due_at);

-- New table, so 0002's enable-RLS DO-loop did not see it. Explicit, and before the policies
-- (a policy on a table with RLS off is inert, not an error — the failure would be silent).
alter table public.tasks enable row level security;

revoke all on table public.tasks from public, anon, authenticated;
grant select, insert, delete on table public.tasks to authenticated;
grant update (status, completed_at) on table public.tasks to authenticated;

drop policy if exists tasks_select_party on public.tasks;
create policy tasks_select_party on public.tasks
  for select to authenticated
  using (
    created_by = (select auth.uid())
    or assigned_to = (select auth.uid())
  );

drop policy if exists tasks_insert_creator on public.tasks;
create policy tasks_insert_creator on public.tasks
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and assigned_to <> (select auth.uid())
    and exists (
      select 1
      from public.bandmate_links bl
      where bl.status = 'active'
        and (
          (bl.user_id = created_by and bl.bandmate_id = assigned_to)
          or (bl.user_id = assigned_to and bl.bandmate_id = created_by)
        )
    )
  );

-- USING is the old row (the caller must already be a party), WITH CHECK is the new row (and
-- the caller must be the assignee). The creator therefore cannot complete or reopen: they can
-- only withdraw, which is the DELETE policy below.
drop policy if exists tasks_update_assignee on public.tasks;
create policy tasks_update_assignee on public.tasks
  for update to authenticated
  using (assigned_to = (select auth.uid()))
  with check (assigned_to = (select auth.uid()));

drop policy if exists tasks_delete_creator on public.tasks;
create policy tasks_delete_creator on public.tasks
  for delete to authenticated
  using (created_by = (select auth.uid()));
