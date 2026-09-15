-- CEMURM 0005 — public.session_org_ids() bridge
--
-- PR#1a client-blocker fix: 0004's helper lives in private.session_org_ids(),
-- but PostgREST exposes only config.toml schemas (public + graphql_public) —
-- so supabase.rpc('session_org_ids') from the real client raised PGRST202
-- and gig creation broke in the app.
--
-- 0005 adds a thin SECURITY DEFINER wrapper in schema public that delegates
-- to the private helper. Search path locked like 0004 (empty search_path +
-- fully-qualified refs, 0002 line 55) — no definer-search-path hijack.
-- Grants mirror 0003/0004: revoke from public/anon, execute only to
-- authenticated + service_role. No RLS — pure function file.
create or replace function public.session_org_ids() returns uuid[]
  language sql security definer stable set search_path = '' as $$
  select private.session_org_ids() $$;

revoke execute on function public.session_org_ids() from public, anon;
grant execute on function public.session_org_ids() to authenticated, service_role;