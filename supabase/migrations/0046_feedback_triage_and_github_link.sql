-- CEMURM 0046 — Feedback triage + GitHub link
-- Extiende public.feedback con auditoría y vinculación a GitHub Issues
-- Mantiene el flujo submit-only intacto

-- 1) Auditoría y vinculación
alter table public.feedback
  add column if not exists updated_at timestamptz,
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists github_issue_number integer,
  add column if not exists github_issue_url text,
  add column if not exists github_repo text default 'davidjesus516/cemurm',
  add column if not exists promoted_at timestamptz,
  add column if not exists promoted_by uuid references auth.users(id);

-- 2) Índices para búsquedas rápidas en el inbox
create index if not exists idx_feedback_status_created_at
  on public.feedback (status, created_at desc);

create index if not exists idx_feedback_kind_created_at
  on public.feedback (kind, created_at desc);

create index if not exists idx_feedback_github_issue_number
  on public.feedback (github_issue_number)
  where github_issue_number is not null;

-- 3) Trigger para mantener updated_at
create or replace function public.set_feedback_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_feedback_updated_at on public.feedback;
create trigger trg_feedback_updated_at
  before update on public.feedback
  for each row
  execute function public.set_feedback_updated_at();

-- 4) Helper para system_admin
create or replace function private.is_system_admin(v_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = v_user and role = 'system_admin'
  );
$$;

revoke execute on function private.is_system_admin(uuid) from public, anon;
grant execute on function private.is_system_admin(uuid) to authenticated, service_role;

-- 5) RLS para triage (system_admin)
drop policy if exists feedback_select_staff on public.feedback;
create policy feedback_select_staff on public.feedback
  for select to authenticated
  using (private.is_system_admin((select auth.uid())));

drop policy if exists feedback_update_staff on public.feedback;
create policy feedback_update_staff on public.feedback
  for update to authenticated
  using (private.is_system_admin((select auth.uid())))
  with check (
    private.is_system_admin((select auth.uid()))
    and updated_by = auth.uid()
  );

-- 6) Triage write permission
-- The policy is the gate; the grant is the permission. 0033 revoked from
-- `public, anon` only, so `authenticated` kept the Supabase default ALL grant on
-- every new public table — INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/
-- TRIGGER. RLS filters rows, it does not scope columns, and it does not cover
-- TRUNCATE at all, so that residual grant is wider than 0033's stated contract
-- ("no client update/delete: reports are immutable") and wider than triage needs.
-- Reset the ACL to the contract, then grant the triage columns alone. updated_at
-- stays trigger-owned, so it is deliberately not granted.
revoke all on table public.feedback from authenticated;
grant insert, select on table public.feedback to authenticated;
grant update (status, updated_by, github_issue_number, github_issue_url,
              github_repo, promoted_at, promoted_by)
  on table public.feedback to authenticated;
