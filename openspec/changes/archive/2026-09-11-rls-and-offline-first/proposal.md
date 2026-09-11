# Proposal: Supabase data layer — real auth + RLS core

## Intent

App: 100% localStorage + mocks, zero RLS, `db reset` broken (seed.sql missing). Offline-first needs real server path first. PR #1: real auth + owner-scoped RLS (S1+S2 of 7).

## Scope

### In Scope (PR #1 = S1+S2)
- **S1 auth**: `src/lib/auth.js` internals → `supabase.auth` (signUp/signInWithPassword/signOut/getSession/onAuthStateChange); surface unchanged → useAuth/guards/pages untouched; demo user seeded.
- **S2 RLS core**: `private` schema + 3 SECURITY DEFINER helpers (`is_org_member`, `user_branch_ids`, `session_role_in`); RLS on 48 tables; owner-scoped policies (songs, setlists owner+collaborators, setlist_items, practice_sessions, personal_annotations, notifications, device_configs, outbox self, scale_catalog).
- **Seed**: `seed.sql` (demo org/branch/member/user/owner rows) → `db reset` passes.
- **8 gap tables**: (service-role only, deny-by-default); confirmed decision, revisited before S3.

### Out of Scope
- S3 full RLS matrix (org/branch/system/event/library, public_songs anon, moderation).
- S4 read-path swap; S5-S7 offline (Dexie cache, outbox drain + Cron + SKIP LOCKED, conflict UI).

## Capabilities

Contract for sdd-spec. `openspec/specs/` empty.

### New Capabilities
- `user-auth`: real Supabase auth behind unchanged lib/auth.js surface + demo seed.
- `row-level-security`: private helpers, RLS + owner-scoped policies, seed.sql.

### Modified Capabilities
None.

## Approach

(obs #173):
- Helpers: SECURITY DEFINER, `set search_path=''`, revoke execute public/anon, grant authenticated+service_role; policies = thin `using (select private.is_org_member(...))` + `auth.uid()` null-check.
- Policies BEFORE grants; default-privileges revoke; index `org_memberships(org_id, user_id)`.
- S1: same exports; branch on `error.code`; session via `onAuthStateChange`.
- S6 future: drain edge fn re-checks user JWT → `42501` → conflict.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/auth.js` | Modified | internals → supabase.auth |
| `src/lib/supabase.js` | Modified | env-driven client |
| `.env.local` | New | URL + anon key |
| `supabase/migrations/0002_rls_core.sql` | New | RLS core |
| `supabase/seed.sql` | New | demo data |
| hooks/guards/pages | None | untouched |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Definer escalation | Low | private schema, search_path='' |
| Policy/grant ordering (lockout/leak) | Med | policies first; curl per table |
| Mock ids orphaned | High | dev reseed; localStorage unchanged |
| Helper perf per-row | Med | initPlan + index |

## Rollback Plan

Revert PR commits (auth.js→mock, drop 0002). `db reset` → v1. localStorage intact; seeds dev-only.

## Dependencies

Local Supabase (`supabase start`); supabase-js ^2.116.0 (installed); `.env.local`.

## Success Criteria

- [ ] `db reset` passes (48 tables + RLS + seed)
- [ ] Demo user signs in, reads own song via RLS
- [ ] Other user sees 0 rows of first's song
- [ ] anon: 0 rows on owner tables
- [ ] lib/auth.js surface unchanged; `pnpm lint` clean
- [ ] outbox self insert/select works authenticated