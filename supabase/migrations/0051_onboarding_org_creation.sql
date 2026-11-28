-- CEMURM 0051 — onboarding: create an organization and its branches (feature S2)
--
-- SECURITY TRUST BOUNDARY — READ THIS FIRST
-- ---------------------------------------------------------------------------
-- `organizations`, `branches` and `org_memberships` are all RLS-enabled and
-- authenticated has no INSERT grant on them (0002_rls_core.sql). The two RPCs
-- below are the narrow server-side writes that scenarios 5 and 8 of
-- features/user-onboarding.feature require:
--
--   * create_organization: any authenticated user may create a NEW org. They
--     become its org_owner on the primary branch. Nothing existing is mutated,
--     so there is no privilege to escalate into -- ownership of a fresh org is
--     the intended outcome, not a bypass of somebody else's tenancy.
--   * add_org_branch: only an ACTIVE org_owner/org_admin of that specific org
--     may add a branch. The authorization reuses `private.session_role_in`
--     (0002:26-30), the same guard 0021's membership cores use.
--
-- Both functions are SECURITY DEFINER owned by the migration role (postgres),
-- run with `search_path = ''`, and reference every relation with an explicit
-- schema. Both write an `admin_audit_log` row, matching the invariant stated
-- in 0021 ("writes happen only via SECURITY DEFINER RPC cores") and the audit
-- trail that private.add_org_member_core emits at 0021:164-173.
--
-- No RLS policy and no table grant is widened. EXECUTE is revoked from public
-- and anon and granted to authenticated only. Inputs are trimmed and bounded;
-- no dynamic SQL is built from user input.

create or replace function public.create_organization(
  p_name        text,
  p_org_type    text,
  p_branch_name text,
  p_city        text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_name      text := nullif(btrim(p_name), '');
  v_branch    text := nullif(btrim(p_branch_name), '');
  v_org_type  text := nullif(btrim(p_org_type), '');
  v_city      text := nullif(btrim(p_city), '');
  v_org_id    uuid;
  v_branch_id uuid;
begin
  if v_uid is null then
    raise exception 'Organization details are invalid.';
  end if;
  if v_name is null or v_branch is null
     or char_length(v_name) > 200 or char_length(v_branch) > 200
     or (v_city is not null and char_length(v_city) > 200)
     or (v_org_type is not null and char_length(v_org_type) > 80) then
    raise exception 'Organization details are invalid.';
  end if;

  insert into public.organizations (name, org_type)
  values (v_name, v_org_type)
  returning id into v_org_id;

  insert into public.branches (org_id, name, city)
  values (v_org_id, v_branch, v_city)
  returning id into v_branch_id;

  insert into public.org_memberships (user_id, org_id, branch_id, role, status, joined_at)
  values (v_uid, v_org_id, v_branch_id, 'org_owner', 'active', now());

  insert into public.admin_audit_log
    (actor_id, actor_org_ids, action, subject_table, subject_id, detail)
  values (
    v_uid,
    array[v_org_id],
    'create_organization',
    'organizations',
    v_org_id,
    jsonb_build_object('org_name', v_name, 'org_type', v_org_type,
                       'branch_id', v_branch_id, 'branch_name', v_branch)
  );

  return jsonb_build_object(
    'org_id', v_org_id,
    'org_name', v_name,
    'role', 'org_owner',
    'branch_id', v_branch_id,
    'branch_name', v_branch
  );
end $$;

create or replace function public.add_org_branch(
  p_org_id uuid,
  p_name   text,
  p_city   text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_name      text := nullif(btrim(p_name), '');
  v_city      text := nullif(btrim(p_city), '');
  v_branch_id uuid;
begin
  if v_uid is null then
    raise exception 'Branch details are invalid.';
  end if;
  if v_name is null or char_length(v_name) > 200
     or (v_city is not null and char_length(v_city) > 200) then
    raise exception 'Branch details are invalid.';
  end if;
  if not private.session_role_in(v_uid, p_org_id, array['org_owner', 'org_admin']) then
    raise exception 'Branch details are invalid.';
  end if;
  if exists (
    select 1 from public.branches
    where org_id = p_org_id and lower(name) = lower(v_name)
  ) then
    raise exception 'Branch details are invalid.';
  end if;

  insert into public.branches (org_id, name, city)
  values (p_org_id, v_name, v_city)
  returning id into v_branch_id;

  insert into public.admin_audit_log
    (actor_id, actor_org_ids, action, subject_table, subject_id, detail)
  values (
    v_uid,
    array[p_org_id],
    'add_org_branch',
    'branches',
    v_branch_id,
    jsonb_build_object('org_id', p_org_id, 'branch_name', v_name, 'city', v_city)
  );

  return jsonb_build_object(
    'org_id', p_org_id,
    'branch_id', v_branch_id,
    'branch_name', v_name,
    'city', v_city
  );
end $$;

revoke all on function public.create_organization(text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_organization(text, text, text, text) to authenticated;

revoke all on function public.add_org_branch(uuid, text, text) from public, anon, authenticated;
grant execute on function public.add_org_branch(uuid, text, text) to authenticated;
