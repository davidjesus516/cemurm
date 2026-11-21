-- CEMURM 0047 — narrow the two table ACLs that still carry the inherited full grant
--
-- Issue source: #428 (the systemic finding), #429 (this data fix is its item 2).
--
-- ── WHAT WAS WRONG ───────────────────────────────────────────────────────────────────────
-- Supabase's default privileges grant `arwdDxtm` (ALL) on every new table in `public` to
-- `anon`, `authenticated` and `service_role`. A migration that writes
--
--   revoke all on table public.x from public, anon;
--
-- removes nothing from `authenticated`, which was never named — and the following
-- `grant select on ... to authenticated` only re-affirms a privilege it already had. Two
-- migrations in this repository did exactly that, so two tables shipped holding TRUNCATE,
-- REFERENCES and TRIGGER that no statement ever asked for:
--
--   account_erasure_requests  (0043: `revoke ... from public, anon` + `grant select`)
--   overlay_sessions          (0025: `revoke ... from public, anon` + `grant select, insert,
--                              update, delete`, which is a deliberate grant that the same
--                              revoke failed to narrow)
--
-- Measured on `main` after `supabase db reset` (@ 44 migrations), schema `public`, 61 tables:
--
--   authenticated: select 48, insert 31, update 28, delete 23, truncate 2, references 2, trigger 2
--   anon:          0 tables with any table privilege
--   the two tables above: relacl = {postgres=arwdDxtm,authenticated=arwdDxtm,service_role=arwdDxtm}
--
-- ── WHY IT MATTERS ───────────────────────────────────────────────────────────────────────
-- RLS filters rows; it does not filter verbs. It cannot refuse TRUNCATE at all, because
-- TRUNCATE evaluates no row predicate, so the ACL is the only control that exists. REFERENCES
-- and TRIGGER are equally outside any policy. Nothing can exploit this through PostgREST
-- today (it emits no TRUNCATE), which is why this is defence in depth and not an active
-- breach — but a `security definer` function, a maintenance script or a restored dump
-- inherits the verb without any gate in this repository being able to see it. That gate is
-- `scripts/check-table-privileges.sh`, shipped in the same change.
--
-- ── WHAT THIS MIGRATION DOES ─────────────────────────────────────────────────────────────
-- Names `authenticated` in the revoke and re-grants only what each table's own migration and
-- client code need. Nothing else in the schema is touched: the other 59 tables were already
-- narrowed by hand, and the 23 that keep DELETE keep it (see the ratchet in the gate).
--
-- `revoke all ... from public` is not redundant with the named roles: PUBLIC is a pseudo-role
-- every role inherits, so a grant to PUBLIC cannot be removed by revoking from a role.

-- 1) Erasure requests: select-own only. Written exclusively by security-definer RPCs
--    (`request_account_erasure`, `cancel_account_erasure`, `private.erase_account_core`), which
--    run as the table owner and are unaffected by client-role grants.
revoke all on table public.account_erasure_requests from public, anon, authenticated;
grant select on table public.account_erasure_requests to authenticated;

-- 2) Overlay sessions: the four verbs 0025 granted on purpose, and only those. The overlay
--    itself reads through the `overlay_state(uuid)` RPC as `anon`, which holds no table grant.
revoke all on table public.overlay_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.overlay_sessions to authenticated;

-- ── WHAT THIS DOES NOT FIX ──────────────────────────────────────────────────────────────────
-- New tables still inherit `arwdDxtm` from the default privileges, so migration 0048 and every
-- one after it is born identical to the two above unless its author names `authenticated`.
-- Changing the default privileges themselves is a separate decision (it would require every
-- existing migration to grant explicitly, and would silently change 59 tables' worth of
-- assumptions), so the mechanism chosen here is the gate: it fails the build on a new table
-- that inherits TRUNCATE instead of trusting whoever writes 0048 to remember.
