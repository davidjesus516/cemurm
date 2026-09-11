# Design: Supabase data layer — real auth + RLS core (PR #1 = S1+S2)

## Technical Approach

Swap `src/lib/auth.js` mock internals for `supabase.auth` (S1) and lock the 48-table public schema behind owner-scoped RLS with hardened SECURITY DEFINER helpers in a `private` schema + demo seed (S2). Surface (`signUp/signIn/signOut/getSession/getCurrentUser/EMAIL_RE`) and all consumers (useAuth, AuthGuards, pages) stay untouched. S3–S7 are future changes, not designed here.

## Architecture Decisions

| # | Decision | Alternatives | Rationale |
|---|----------|--------------|-----------|
| D1 | Session source = `supabase.auth`; module-level `onAuthStateChange` keeps a cached session; `getSession` returns cached or awaits `supabase.auth.getSession()` mapped to `{ user } \| null` | Poll getSession per call | Subscription keeps session current through refresh/token rotation per spec; single subscription lives for app lifetime (module singleton) |
| D2 | Error mapping branches ONLY on `error.code`; map `user_already_exists`→"An account with this email already exists.", `invalid_credentials`→"Invalid email or password.", `42501`→permission message, `email_address_invalid`/`signup_disabled`→generic; unknown/network (no code) → "Something went wrong. Please try again." | message/status branching | Research Q4: PostgREST/GoTrue codes are stable; messages/status differ by transport. Auth.jsx already renders `error.message` |
| D3 | User shape: `{ id, email, firstName: user_metadata.firstName ?? '', lastName, displayName: user_metadata.displayName \|\| email }`; signUp sends metadata via `options.data` | Read-only profiles table | Zero schema change; seed sets `raw_user_meta_data` |
| D4 | `signUp` local validation (EMAIL_RE, min 8 chars) stays client-side before calling supabase; then `signUp({email,password,options:{data}})`; return `data.session?.user` if present else `data.user` (no-session signup edge: see Open Questions) | Rely on GoTrue errors | Preserves exact existing messages; local dev may return session-less signup |
| D5 | RLS enable: one DO block looping `pg_tables` over `public`, `execute format('alter table public.%I enable row level security')` | 48 explicit statements | Uniform, idempotent, future-proof; verification is query-based (`pg_tables.rowsecurity`), not text-based |
| D6 | Policies: named `{table}_{op}_{scope}` + `drop policy if exists` before each `create policy` — idempotent re-run; grants AFTER policies; `revoke all on <table> from anon, authenticated` for all 48 first (local `auto_expose_new_tables` defaults grants on), then targeted per-policy grants | Trust default grants | Research Q2 ordering: RLS+policies before grants; default grants would leave tables readable |
| D7 | `setlist_collaborators` gets a self-scope policy (`select using (user_id = auth.uid())` + owner-management via `private.session_owns_setlist(setlist_id)`); **ENMIENDA APROBADA (PR 4 apply, 2026-09-10)**: the originally planned `setlist_id in (select id from setlists …)` owner-management fails at PLAN time with `42P17 infinite recursion` (structural setlists→setlist_collaborators→setlists cycle, verified live). A 4th session-bound SECURITY DEFINER helper `session_owns_setlist(setlist_id)` (same hardening: empty search_path, qualified refs, revoke/grant execute) breaks the cycle; collaborator owner-management policies never reference `setlists` directly. | Wrap collaborator lookup in 4th definer helper | Policy subqueries are subject to RLS on referenced tables; without a self-policy the `exists(...)` in setlists/setlist_items policies always returns false (RLS recursion pitfall). Keeps confirmed 3-helper contract + 1 recursion-fix helper (D7 enmienda) |
| D8 | Seed user ids = deterministic literal UUIDs (`10000000-0000-0000-0000-000000000001` demo, `…002` isolation; org `…00a1`, branch `…00b1`) | CTE `insert … returning id`; subselect by email | Deterministic ids make reset→verify repeatable and cross-references trivial; seed runs as postgres (no anon auth.users access concern) |
| D9 | `notifications` mark-read = UPDATE policy `using user_id = auth.uid()` + column grant `grant update(read_at) on notifications to authenticated`; no INSERT/DELETE policies (system writes only) | Full CRUD | Research Q5/schema: notifications INSERT is system-owned |
| D10 | `outbox` PR#1 scope = INSERT + SELECT self only (UPDATE/drain is S6) | Full CRUD now | Spec scenario is insert/select self; YAGNI until drain exists |

## Data Flow

```
Auth.jsx → useAuth → lib/auth.js ──→ supabase.auth (GoTrue) ──→ auth.users
                                          │ JWT (access_token)
pages → hooks → lib/*(S4) ──→ PostgREST /rest/v1/{table} ──→ RLS policy
                                          │ (select private.is_org_member(...))  [initPlan]
                                          └─→ private helpers (SECURITY DEFINER) → org_memberships
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/auth.js` | Modify | internals → supabase.auth; exports/validation/shape unchanged |
| `src/lib/supabase.js` | Modify | (option) explicit `auth:{persistSession:true,autoRefreshToken:true}` defaults; currently env-driven, already correct |
| `supabase/migrations/0002_rls_core.sql` | Create | private schema + 3 helpers + RLS + policies + grants |
| `supabase/seed.sql` | Create | demo + isolation users, org/branch/memberships, owner rows |
| `.env.local` | Keep | already has URL+anon key (gitignored — don't commit) |

## Interfaces / Contracts

`src/lib/auth.js` (unchanged surface):

```js
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export async function signUp({ firstName, lastName, displayName, email, password }) // → user
export async function signIn({ email, password })                                   // → user
export async function signOut()                                                     // → void
export async function getSession()                                                  // → { user } | null
export async function getCurrentUser()                                              // → user | null
```

Helpers (`0002_rls_core.sql`), all `SECURITY DEFINER`, `set search_path = ''`, schema-qualified refs, `revoke execute from public, anon` + `grant execute to authenticated, service_role`, `alter default privileges in schema private revoke execute on functions from public, anon, authenticated`:

```sql
create function private.is_org_member(user_id uuid, org_id uuid) returns text
  language sql security definer stable set search_path = '' as $$
  select role from public.org_memberships
  where user_id = $1 and org_id = $2 and status = 'active' limit 1 $$;  -- NULL = not member

create function private.user_branch_ids(user_id uuid) returns uuid[]
  language sql security definer stable set search_path = '' as $$
  select coalesce(array_agg(branch_id), '{}') from public.org_memberships
  where user_id = $1 and status = 'active' and branch_id is not null $$;

create function private.session_role_in(user_id uuid, org_id uuid, roles text[]) returns boolean
  language sql security definer stable set search_path = '' as $$
  select exists(select 1 from public.org_memberships
    where user_id = $1 and org_id = $2 and status = 'active' and role = any($3)) $$;

create index if not exists idx_memberships_org_user on public.org_memberships(org_id, user_id);
```

Policies (all `to authenticated`, thin wrappers with initPlan `(select auth.uid()) is not null` guard; `drop policy if exists` + `create`):

| Table | Policy (USING / WITH CHECK) |
|---|---|
| songs | `created_by = (select auth.uid())` — SELECT/INSERT/UPDATE/DELETE |
| setlists | SELECT: owner `OR exists(c.sc.user_id=(select auth.uid()) and accepted_at is not null)`; INSERT `owner_id = auth.uid()`; UPDATE owner or `can_edit` collab; DELETE owner only |
| setlist_collaborators | SELECT self `user_id = auth.uid()`; full CRUD where setlist owned (see D7) |
| setlist_items | EXISTS over setlists same owner/collab predicate (SELECT: any accepted; writes: owner or `can_edit`) |
| practice_sessions, personal_annotations, device_configs | `user_id = (select auth.uid())` full CRUD |
| notifications | SELECT own; UPDATE own (granted cols: `read_at` only) |
| outbox | INSERT `user_id = auth.uid()`; SELECT own |
| scale_catalog | `for select to authenticated using (true)` |
| org_memberships, organizations, branches + all remaining | RLS ON, no policies, no grants → deny-by-default (helpers bypass via definer) |
| 8 gap tables (dmca_notices, invite_codes, tags, song_tags, song_duplicates, external_enrichments, event_rsvps, event_participants) | RLS ON, no policies/grants → service-role only; revisited at S3 |

Grants after policies: `revoke all on <each of 48> from anon, authenticated`; then `grant select,insert,update,delete` on songs/setlists/setlist_collaborators/setlist_items/practice_sessions/personal_annotations/device_configs → authenticated; `grant select` + `grant update(read_at)` on notifications; `grant select,insert` on outbox; `grant select` on scale_catalog. service_role untouched (default grants retained).

`seed.sql` (runs as postgres; pgcrypto from 0001):

```sql
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'demo@cemurm.app',
        crypt('password1234', gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}',
        '{"firstName":"Demo","lastName":"User","displayName":"Demo User"}', now(), now()),
       ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', …, 'isolation@cemurm.app', …);
```

Rows seeded: org **Demo Academy** (`…00a1`); branch **Sede Centro** (`…00b1`); second org **Isolation Org**; demo = org_owner in Demo Academy, isolation = org_member in Isolation Org (proves cross-org isolation); 2 demo-owned songs + 1 isolation-owned; demo setlist (owner) + 1 accepted view-only collaborator row (isolation) + 2 setlist_items; 1 practice_sessions, 1 personal_annotations, 1 unread notification, 1 device_configs (`dev-1`), 1 outbox row (synced); scale_catalog row **Major** `{0,2,4,5,7,9,11}`.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | — | N/A: no test runner (openspec config), lint+build only |
| Integration | RLS scenarios | psql + curl matrix (below) |
| E2E | demo login | manual `pnpm dev` sign-in demo@cemurm.app / password1234 |

Verification commands (for sdd-apply `## Verification`):

```bash
pnpm lint && pnpm build
supabase stop && supabase start && supabase db reset     # peer: fresh → seed applies
# RLS on all 48 (expect 0):
supabase db -c "select count(*) from pg_tables where schemaname='public' and not rowsecurity;"
# helper exec locked (expect no anon):
supabase db -c "select proacl from pg_proc where proname in ('is_org_member','user_branch_ids','session_role_in');"
# anon sees 0 owner rows:
curl -s 'http://127.0.0.1:54321/rest/v1/songs?select=id,title' -H "apikey: $ANON" -H 'Accept: application/json'
# demo login → token:
curl -s -X POST 'http://127.0.0.1:54321/auth/v1/token?grant_type=password' \
  -H "apikey: $ANON" -H 'Content-Type: application/json' \
  -d '{"email":"demo@cemurm.app","password":"password1234"}'                      # → access_token
# demo reads 2 own songs; isolation (token 2) reads 0; isolation SETLIST read → 1, PATCH name → 42501;
# demo PATCH notifications.read_at → ok, PATCH title → 42501; outbox self insert/select → ok;
# gap: authed GET /rest/v1/dmca_notices → []; service_role psql count → full.
```

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary in the designed code (SQL + JS only). All matrix rows marked N/A with this reason; no RED tests required.

## Migration / Rollout

Rollback: revert `auth.js` to mock + drop `0002_rls_core.sql` → `db reset` restores v1; localStorage intact; seed dev-only (never runs via `db push`). No feature flags. S3–S7 (full RLS matrix, read swap, Dexie cache, outbox drain+Cron+SKIP LOCKED, conflict UI) are future chained PRs.

## Open Questions

- [ ] `signUp` with email confirmations enabled returns session-less signup — local config has no `enable_confirmations` key (default off); seed sets `email_confirmed_at`. If confirmations later enabled, signUp UX degrades to "registered, sign in" — acceptable? (default: yes, spec only requires sign-in path)

## Risks

| File | Risk | Mitigation |
|------|------|------------|
| `0002_rls_core.sql` | Policy subquery RLS recursion (setlist_items→setlists→collaborators) | setlist_collaborators self-policy (D7); thin definer helpers |
| `0002_rls_core.sql` | Ordering: lockout/leak | RLS+policies before grants; explicit revoke; per-table curl in verification |
| `0002_rls_core.sql` | Definer escalation / search_path hijack | private schema, `set search_path=''`, full qualification, execute revokes + default privileges |
| `0002_rls_core.sql` | Helper per-row cost | `(select helper())` initPlan wrapper + `idx_memberships_org_user` |
| `seed.sql` | crypt()/required-columns mismatch breaks demo login | seed runs under postgres (auth schema writable); verification signs in end-to-end |
| `src/lib/auth.js` | v2 shape drift (`data.session`, async getSession) | exact mapping (D1/D3); `error.code` never message |
| `src/lib/auth.js` | Mock localStorage residue (`cemurm.users`/`cemurm.session`) | harmless orphan keys; dev-only reseed (proposal R3 acknowledged) |