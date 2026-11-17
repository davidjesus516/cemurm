-- CEMURM 0021 — Identity & Account Lifecycle: admin_audit_log + membership RPCs
--
-- Slice: features/organization-members.feature (F1 — Membership Admin)
-- Precedes: 0042+ (account export/erasure, Hito 6)
-- Contested: 0047 (claimed by PR #451); using 0021 (self-contained, sorts after 0001).
--
-- Contract shape (0012/0016 convention): SECURITY DEFINER cores in `private`
-- (search_path = '', fully-qualified refs, initPlan auth.uid() guard) + one
-- thin `public` wrapper per entry point; REVOKE from anon/public then GRANT to
-- authenticated. D6 order: revoke all tables → create policies → grant directed.
--
-- Table org_memberships (0001:27) currently has ONLY `grant select` to
-- authenticated (0016:552). Sole writer is self-leave RPC `org_leave` (0016:437).
-- This migration adds writers via SECURITY DEFINER RPCs (T3/T4) plus admin_audit_log.

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. TABLE — admin_audit_log (S4)
-- ══════════════════════════════════════════════════════════════════════════════

create table public.admin_audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid not null references auth.users(id) on delete set null,
  actor_org_ids uuid[],
  action        text not null,               -- 'add_org_member' | 'change_member_role' | 'remove_org_member' | 'enroll_student' | ...
  subject_table text not null,               -- 'org_memberships' | 'education_enrollments' | ...
  subject_id    uuid,
  detail        jsonb not null default '{}',
  created_at    timestamptz not null default now()
);
create index idx_admin_audit_actor on public.admin_audit_log (actor_id, created_at desc);
create index idx_admin_audit_action on public.admin_audit_log (action, created_at desc);
create index idx_admin_audit_subject on public.admin_audit_log (subject_table, subject_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. RLS — admin_audit_log (read-only, append-only via RPC)
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.admin_audit_log enable row level security;
alter table public.admin_audit_log force row level security;

revoke all on table public.admin_audit_log from public, anon, authenticated;

-- No direct SELECT policy: reads happen via F8 analytics RPCs only.
-- Writes happen only via SECURITY DEFINER RPC cores (definer bypasses RLS).
-- Owner (postgres) has BYPASSRLS and can read for audits.

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. RLS — org_memberships: ADD write policies (INSERT/UPDATE via RPC only)
-- ══════════════════════════════════════════════════════════════════════════════

-- org_memberships already has SELECT policies from 0016 (self, org_admin, system_admin).
-- We add INSERT (add_org_member) and UPDATE (change_member_role, remove_org_member)
-- guarded to org_owner/org_admin via session_role_in.

drop policy if exists org_memberships_insert_admin on public.org_memberships;
create policy org_memberships_insert_admin on public.org_memberships
  for insert to authenticated
  with check (
    (select auth.uid()) is not null
    and private.session_role_in((select auth.uid()), org_id, array['org_owner','org_admin'])
  );

drop policy if exists org_memberships_update_admin on public.org_memberships;
create policy org_memberships_update_admin on public.org_memberships
  for update to authenticated
  using (
    (select auth.uid()) is not null
    and private.session_role_in((select auth.uid()), org_id, array['org_owner','org_admin'])
  )
  with check (
    (select auth.uid()) is not null
    and private.session_role_in((select auth.uid()), org_id, array['org_owner','org_admin'])
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. GRANTS — org_memberships (add INSERT/UPDATE for RPC paths)
-- ══════════════════════════════════════════════════════════════════════════════

-- 0016:552 already grants SELECT. Add INSERT/UPDATE so the RPC cores can write.
-- DELETE remains revoked: soft-delete via status='removed', never hard delete.
grant insert, update on table public.org_memberships to authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. RPCs — MEMBERSHIP CORES (private, SECURITY DEFINER)
-- ══════════════════════════════════════════════════════════════════════════════

-- ───────────── 5.1 add_org_member_core ─────────────
create or replace function private.add_org_member_core(
  p_org_id   uuid,
  p_user_id  uuid,
  p_role     text default 'org_member',
  p_branch_id uuid default null
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_caller uuid := (select auth.uid());
  v_org_exists boolean;
  v_user_exists boolean;
  v_is_owner boolean;
begin
  if v_caller is null then
    raise exception 'not authorized';
  end if;

  -- caller must be org_owner or org_admin of the target org
  if not private.session_role_in(v_caller, p_org_id, array['org_owner','org_admin']) then
    raise exception 'not authorized';
  end if;

  select exists(select 1 from public.organizations where id = p_org_id) into v_org_exists;
  if not v_org_exists then
    raise exception 'org not found';
  end if;

  select exists(select 1 from auth.users where id = p_user_id) into v_user_exists;
  if not v_user_exists then
    raise exception 'user not found';
  end if;

  -- SOD: org_owner cannot add themselves as org_owner of another org
  -- (self-leave via leave_organization handles leaving one's own org)
  if p_role = 'org_owner' then
    select exists(
      select 1 from public.org_memberships
      where user_id = v_caller and org_id = p_org_id and role = 'org_owner' and status = 'active'
    ) into v_is_owner;
    if not v_is_owner then
      raise exception 'only org_owner can appoint org_owner';
    end if;
  end if;

  -- Upsert: reactivate removed membership or insert new
  insert into public.org_memberships (user_id, org_id, role, branch_id, status, joined_at)
  values (p_user_id, p_org_id, p_role, p_branch_id, 'active', now())
  on conflict (user_id, org_id, branch_id) do update set
    role = excluded.role,
    branch_id = excluded.branch_id,
    status = 'active',
    joined_at = now(),
    left_at = null;

  -- Audit trail
  insert into public.admin_audit_log (actor_id, actor_org_ids, action, subject_table, subject_id, detail)
  values (
    v_caller,
    (select array_agg(org_id) from public.org_memberships where user_id = v_caller and status = 'active'),
    'add_org_member',
    'org_memberships',
    p_user_id,
    jsonb_build_object('org_id', p_org_id, 'role', p_role, 'branch_id', p_branch_id)
  );
end $$;

-- ───────────── 5.2 change_member_role_core ─────────────
create or replace function private.change_member_role_core(
  p_org_id   uuid,
  p_user_id  uuid,
  p_role     text,
  p_branch_id uuid default null
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_caller uuid := (select auth.uid());
  v_is_owner boolean;
  v_membership_exists boolean;
  v_target_is_owner boolean;
begin
  if v_caller is null then
    raise exception 'not authorized';
  end if;

  -- Only org_owner can change roles (org_admin can change instructor/branch_admin/member roles)
  -- but cannot touch org_owner role
  select exists(
    select 1 from public.org_memberships
    where user_id = v_caller and org_id = p_org_id and role = 'org_owner' and status = 'active'
  ) into v_is_owner;

  if not v_is_owner then
    raise exception 'only org_owner can change member roles';
  end if;

  -- Cannot change org_owner's role (only another org_owner can, via removal + re-add)
  select exists(
    select 1 from public.org_memberships
    where user_id = p_user_id and org_id = p_org_id and role = 'org_owner' and status = 'active'
  ) into v_target_is_owner;

  if v_target_is_owner then
    raise exception 'cannot modify org_owner';
  end if;

  select exists(
    select 1 from public.org_memberships
    where user_id = p_user_id and org_id = p_org_id and status = 'active'
  ) into v_membership_exists;

  if not v_membership_exists then
    raise exception 'membership not found';
  end if;

  update public.org_memberships
  set role = p_role,
      branch_id = p_branch_id
  where user_id = p_user_id and org_id = p_org_id and status = 'active';

  -- Audit trail
  insert into public.admin_audit_log (actor_id, actor_org_ids, action, subject_table, subject_id, detail)
  values (
    v_caller,
    (select array_agg(org_id) from public.org_memberships where user_id = v_caller and status = 'active'),
    'change_member_role',
    'org_memberships',
    p_user_id,
    jsonb_build_object('org_id', p_org_id, 'role', p_role, 'branch_id', p_branch_id)
  );
end $$;

-- ───────────── 5.3 remove_org_member_core ─────────────
create or replace function private.remove_org_member_core(
  p_org_id   uuid,
  p_user_id  uuid,
  p_branch_id uuid default null
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_caller uuid := (select auth.uid());
  v_is_owner boolean;
  v_target_is_owner boolean;
  v_membership_exists boolean;
begin
  if v_caller is null then
    raise exception 'not authorized';
  end if;

  -- Only org_owner can remove members
  select exists(
    select 1 from public.org_memberships
    where user_id = v_caller and org_id = p_org_id and role = 'org_owner' and status = 'active'
  ) into v_is_owner;

  if not v_is_owner then
    raise exception 'only org_owner can remove members';
  end if;

  -- Cannot remove org_owner
  select exists(
    select 1 from public.org_memberships
    where user_id = p_user_id and org_id = p_org_id and role = 'org_owner' and status = 'active'
  ) into v_target_is_owner;

  if v_target_is_owner then
    raise exception 'cannot remove org_owner';
  end if;

  select exists(
    select 1 from public.org_memberships
    where user_id = p_user_id and org_id = p_org_id and status = 'active'
    and (p_branch_id is null or branch_id = p_branch_id)
  ) into v_membership_exists;

  if not v_membership_exists then
    raise exception 'membership not found';
  end if;

  -- Soft delete: set status='removed', left_at=now()
  update public.org_memberships
  set status = 'former', left_at = now()
  where user_id = p_user_id and org_id = p_org_id and status = 'active'
    and (p_branch_id is null or branch_id = p_branch_id);

  -- Audit trail
  insert into public.admin_audit_log (actor_id, actor_org_ids, action, subject_table, subject_id, detail)
  values (
    v_caller,
    (select array_agg(org_id) from public.org_memberships where user_id = v_caller and status = 'active'),
    'remove_org_member',
    'org_memberships',
    p_user_id,
    jsonb_build_object('org_id', p_org_id, 'branch_id', p_branch_id)
  );
end $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. RPCs — PUBLIC WRAPPERS (thin, delegate to private cores)
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function public.add_org_member(
  p_org_id   uuid,
  p_user_id  uuid,
  p_role     text default 'org_member',
  p_branch_id uuid default null
)
returns void
language sql security definer set search_path = '' as $$
  select private.add_org_member_core(p_org_id, p_user_id, p_role, p_branch_id);
$$;

create or replace function public.change_member_role(
  p_org_id   uuid,
  p_user_id  uuid,
  p_role     text,
  p_branch_id uuid default null
)
returns void
language sql security definer set search_path = '' as $$
  select private.change_member_role_core(p_org_id, p_user_id, p_role, p_branch_id);
$$;

create or replace function public.remove_org_member(
  p_org_id   uuid,
  p_user_id  uuid,
  p_branch_id uuid default null
)
returns void
language sql security definer set search_path = '' as $$
  select private.remove_org_member_core(p_org_id, p_user_id, p_branch_id);
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. FUNCTION GRANTS
-- ══════════════════════════════════════════════════════════════════════════════

revoke execute on function private.add_org_member_core(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function private.change_member_role_core(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function private.remove_org_member_core(uuid, uuid, uuid) from public, anon, authenticated;

revoke execute on function public.add_org_member(uuid, uuid, text, uuid) from public, anon;
revoke execute on function public.change_member_role(uuid, uuid, text, uuid) from public, anon;
revoke execute on function public.remove_org_member(uuid, uuid, uuid) from public, anon;

grant execute on function public.add_org_member(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.change_member_role(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.remove_org_member(uuid, uuid, uuid) to authenticated;
