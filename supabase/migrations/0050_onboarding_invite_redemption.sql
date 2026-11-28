-- CEMURM 0050 — onboarding: atomic org-invite redemption (feature S2)
--
-- SECURITY TRUST BOUNDARY — READ THIS FIRST
-- ---------------------------------------------------------------------------
-- The invite CODE is the authorization. A joining user is by definition NOT an
-- org_owner/org_admin, so they cannot use the existing membership writers:
-- private.add_org_member_core re-checks the CALLER's admin role via auth.uid()
-- (0021:120) and public.add_org_member is only a thin definer wrapper over it.
-- Calling either from here with the joiner's JWT would raise 'not authorized'.
-- This function therefore performs the same deterministic reactivate-or-insert
-- (0021:146-162) itself, with the code standing in for the admin role check.
-- It is the ONLY membership writer a non-admin uses, and it is deliberately
-- narrow: one code, one org, one join, one consumption.
--
-- What the code proves, and what it does NOT:
--   * invite_codes is own-row RLS (0006:145-181): the inviter can insert/read/
--     revoke their own codes, but a joiner cannot SELECT the raw row. This
--     SECURITY DEFINER reads it on their behalf and discloses only org id/name,
--     role and the default branch -- never the code, creator, expiry or row id.
--   * Because ANY authenticated user may insert an invite_codes row (RLS only
--     checks created_by = auth.uid()), this function additionally verifies at
--     redemption time that created_by is still an active org_owner/org_admin
--     of the target org. A self-minted code for somebody else's org is rejected.
--   * A code may not mint a privileged role. Only 'org_member' -- the role the
--     feature assigns -- is accepted, so a self-minted role='org_owner' code
--     cannot escalate the holder into ownership.
--   * All four failure modes (unknown, wrong kind, expired, used -- plus the
--     two self-minting guards above and a missing auth.uid()) raise the SAME
--     exception text. The RPC is not a code oracle.
--   * No RLS policy is weakened and no table grant is widened. Execute is
--     granted to authenticated only; anon and public are explicitly revoked.
--
-- Duration: no expiry is minted here; the inviter supplies expires_at with the
-- 7-day default from the client (domain/onboarding/invite.js). This function
-- only enforces that the stored expiry is still in the future.

create or replace function public.redeem_org_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_code   public.invite_codes%rowtype;
  v_org    public.organizations%rowtype;
  v_branch public.branches%rowtype;
begin
  -- One message for every rejection: never reveal why a code failed.
  if v_uid is null then
    raise exception 'This invite code is invalid or has expired.';
  end if;

  -- Lock the row FOR UPDATE so concurrent redemptions cannot both observe an
  -- unused code. The second waiter re-reads used_at after the lock is granted.
  select * into v_code
  from public.invite_codes
  where code = p_code
  for update;

  if not found
     or v_code.kind <> 'org_invite'
     or v_code.used_at is not null
     or v_code.expires_at <= now()
     or v_code.role <> 'org_member'
     or v_code.org_id is null then
    raise exception 'This invite code is invalid or has expired.';
  end if;

  -- The creator's authority is checked AT REDEMPTION, not at insert: RLS lets
  -- any authenticated row in, so the code alone is not proof of ownership.
  if not exists (
    select 1 from public.org_memberships
    where user_id = v_code.created_by
      and org_id = v_code.org_id
      and role in ('org_owner', 'org_admin')
      and status = 'active'
  ) then
    raise exception 'This invite code is invalid or has expired.';
  end if;

  select * into v_org from public.organizations where id = v_code.org_id;
  if not found then
    raise exception 'This invite code is invalid or has expired.';
  end if;

  -- "Primary/default branch": there is no is_default column, so the org's
  -- oldest active branch is the deterministic default (Sede Centro in the seed).
  -- A NULL branch means an org-level membership, which is still a valid join.
  select * into v_branch
  from public.branches
  where org_id = v_code.org_id and status = 'active'
  order by created_at asc, id asc
  limit 1;

  -- Reactivate-or-insert (0021:146-162). branch_id is compared with IS NOT
  -- DISTINCT FROM because NULL is distinct from every NULL in a UNIQUE key.
  update public.org_memberships
  set role = v_code.role,
      status = 'active',
      joined_at = case when status = 'active' then joined_at else now() end,
      left_at = null
  where user_id = v_uid
    and org_id = v_code.org_id
    and branch_id is not distinct from v_branch.id;

  if not found then
    insert into public.org_memberships (user_id, org_id, branch_id, role, status, joined_at)
    values (v_uid, v_code.org_id, v_branch.id, v_code.role, 'active', now());
  end if;

  -- Audit trail, matching private.add_org_member_core (0021:164-173). Every
  -- SECURITY DEFINER membership write emits this row; redemption is no exception.
  insert into public.admin_audit_log (actor_id, actor_org_ids, action, subject_table, subject_id, detail)
  values (
    v_uid,
    array[v_code.org_id],
    'add_org_member',
    'org_memberships',
    v_uid,
    jsonb_build_object('org_id', v_code.org_id, 'role', v_code.role, 'branch_id', v_branch.id)
  );

  -- Atomically consume the code in the same transaction as the membership.
  update public.invite_codes set used_at = now() where id = v_code.id;

  return jsonb_build_object(
    'org_id', v_org.id,
    'org_name', v_org.name,
    'role', v_code.role,
    'branch_id', v_branch.id,
    'branch_name', v_branch.name
  );
end $$;

revoke all on function public.redeem_org_invite(text) from public, anon, authenticated;
grant execute on function public.redeem_org_invite(text) to authenticated;
