-- CEMURM 0046 — Feedback triage + GitHub link
-- Extiende public.feedback con auditoría y vinculación a GitHub Issues
-- Mantiene el flujo submit-only intacto

-- 1) Auditoría y vinculación
-- `on delete set null` is load-bearing, not decoration. 0043 erases a user by
-- deleting only the feedback rows they AUTHORED, then deleting auth.users. An
-- admin who triaged someone else's report is still referenced by that row, so a
-- restrict-by-default FK would abort account erasure with a foreign-key
-- violation. The audit trail keeps the row and loses the actor, which is the
-- correct trade.
alter table public.feedback
  add column if not exists updated_at timestamptz,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists github_issue_number integer,
  add column if not exists github_issue_url text,
  add column if not exists github_repo text default 'davidjesus516/cemurm',
  add column if not exists promoted_at timestamptz,
  add column if not exists promoted_by uuid references auth.users(id) on delete set null;

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
$$ language plpgsql
set search_path = '';

drop trigger if exists trg_feedback_updated_at on public.feedback;
create trigger trg_feedback_updated_at
  before update on public.feedback
  for each row
  execute function public.set_feedback_updated_at();

-- 4) RLS para triage (system_admin)
-- No new helper here on purpose. 0016 already ships
-- `private.session_has_system_role(text)`, which binds `auth.uid()` INSIDE the
-- definer body — a caller cannot supply the uuid it checks. A second helper
-- taking `v_user uuid` would duplicate that and be strictly weaker: anyone with
-- EXECUTE on it (authenticated already has it) would get an "is user X an
-- admin" oracle the day `private` joins [api] schemas. One helper, one shape.
drop policy if exists feedback_select_staff on public.feedback;
create policy feedback_select_staff on public.feedback
  for select to authenticated
  using (private.session_has_system_role('system_admin'));

drop policy if exists feedback_update_staff on public.feedback;
create policy feedback_update_staff on public.feedback
  for update to authenticated
  using (private.session_has_system_role('system_admin'))
  with check (
    private.session_has_system_role('system_admin')
    and updated_by = auth.uid()
  );

-- 5) Triage write permission
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
