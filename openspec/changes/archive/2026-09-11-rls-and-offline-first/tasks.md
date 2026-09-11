# Tasks: Real auth + RLS core (PR #1 = S1+S2)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,100 (1,000–1,200) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-chain |
| Chain strategy | pending — recommendation: stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | S1 auth swap (auth.js + supabase.js) | PR 1 | `pnpm lint && pnpm build`; signUp fresh user curl token | `pnpm dev` real sign-up (demo login needs seed → PR 2) | Revert `src/lib/auth.js`, `src/lib/supabase.js` → mock returns |
| 2 | seed.sql demo/isolation data | PR 2 | `supabase db reset` passes; demo password-grant curl → 200 | `supabase stop && supabase start && supabase db reset` | Delete `supabase/seed.sql` |
| 3 | 0002 v1: private helpers + RLS-on + revokes | PR 3 | `supabase db -c "select count(*) from pg_tables where schemaname='public' and not rowsecurity;"` → 0; proacl no anon | `db reset` + anon/authed curl → 0 rows | Revert 0002_rls_core.sql part 1 |
| 4 | 0002 v2: policies + grants | PR 4 | Full curl matrix (demo 2 songs; isolation 0; PATCH → 42501; outbox self) | `db reset` + token curls per user | Revert 0002_rls_core.sql part 2 |

Dependencies: PR 4 ← PR 3 (cumulative migration file) and PR 2 (demo/isolation users for matrix); PR 2 unblocks PR 1 demo-login E2E. Slices land independently to main in order — app data reads stay mock until S4, so transient deny-by-default (PR 3) regresses nothing in-app → stacked-to-main. Fallback: feature-branch-chain if team wants one integration point.

## Phase 1: S1 — Real auth behind unchanged surface (PR 1)

- [x] 1.1 Rewrite `src/lib/auth.js`: keep exports `EMAIL_RE/signUp/signIn/signOut/getSession/getCurrentUser` + local validation; delegate to `supabase.auth`; map via D1 (module-level `onAuthStateChange` cache) and D3 (user_metadata shape); branch errors only on `error.code` (D2). — Verify: `pnpm lint && pnpm build`; consumers unchanged.
- [x] 1.2 Add explicit `auth:{persistSession:true,autoRefreshToken:true}` defaults to `src/lib/supabase.js`. — Verify: lint+build; `pnpm dev` boots.
- [x] 1.3 Confirm `.env.local` (read-only) holds `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. — Verify: fresh signUp via UI resolves.

### Apply Progress — PR 1 slice (work unit `pr1-auth-swap`, attempt 1/2)

Work Unit Evidence:

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm lint` → zero warnings; `pnpm build` → built in 1.50s, 109 modules transformed |
| Runtime harness command/scenario and exact result | Live GoTrue curls vs `supabase start` (127.0.0.1:54321): fresh signup → 200 + `displayName` persisted in metadata; duplicate signup → 422 `error_code:user_already_exists`; wrong password → 400 `invalid_credentials`; correct password → 200 + `access_token`; `pnpm dev` boot → HTTP 200 on localhost:5173 |
| Rollback boundary | `git checkout -- src/lib/auth.js` restores the mock; remove the auth-options block from `src/lib/supabase.js` (file was already untracked pre-batch); `useAuth.jsx`/`AuthGuards.jsx`/pages untouched |

Status: tasks 1.1–1.3 complete → PR 1 slice ready for verify. Chained PR 1 of 4 (stacked-to-main), authored diff ≈ 151 changed lines (budget ≤ 400).

## Phase 2: S2a — Demo seed (PR 2)

- [x] 2.1 Create `supabase/seed.sql` (D8 deterministic UUIDs `…0001`/`…0002`/`…00a1`/`…00b1`): auth.users demo+isolation (crypt bf, email_confirmed_at), orgs, org_memberships, 2 demo songs + 1 isolation, setlist + accepted collaborator + 2 setlist_items, 1 each practice_sessions/personal_annotations/notification/device_configs/dev-, 1 outbox, scale_catalog Major. — Verify: `supabase db reset`; demo token curl 200.

### Apply Progress — PR 2b slice (work unit `pr2-seed`, attempt 1/2)

Work Unit Evidence:

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `supabase db reset` (CLI 2.117.0, `/home/david_jesus516/node_modules/.bin/supabase`) → exit 0; `Applying migration 0001_init.sql...` then `Seeding data from supabase/seed.sql...` then `Finished supabase db reset on branch feat/supabase-infra-config`; psql row counts: auth.users 2, organizations 2, branches 1, org_memberships 2, songs 3, setlists 1, setlist_collaborators 1, setlist_items 2, practice_sessions 1, personal_annotations 1, notifications 1, device_configs 1, outbox 1, scale_catalog 1 |
| Runtime harness command/scenario and exact result | Live GoTrue vs `supabase start` stack (127.0.0.1:54321): password grant `demo@cemurm.app`/`password1234` → `access_token` (JWT sub `10000000-0000-0000-0000-000000000001`); `GET /rest/v1/songs?select=id,title,created_by` with Bearer → HTTP 200, 3 seeded songs (2 demo + 1 isolation, all visible because RLS is PR 4) |
| Rollback boundary | Delete `supabase/seed.sql` (only file created this slice; `tasks.md` checkbox + progress are SDD doc state, revert with git) → `db reset` reverts to pre-seed broken state; nothing else changed |

Gotchas fixed during apply: (1) D8 suffix `…00a1`/`…00b1` needs a 12-char last UUID group (`10000000-…00000000a1`), first draft had 10 → `invalid input syntax for type uuid` 22P02; (2) GoTrue v2.196.0 scans `auth.users` token/phone columns as plain strings — NULL `confirmation_token` → 500 `converting NULL to string is unsupported`, and `phone=''` collides on `users_phone_key` (non-partial index) → distinct dummy phones `+34910000001`/`+34910000002`.

Status: task 2.1 complete → PR 2b slice ready for verify. Chained PR 2b of 5 (stacked-to-main), authored diff ≈ 785 lines (seed.sql + untracked 0001_init.sql committed in this PR), maintainer-approved size:exception.

## Phase 3: S2b — Helpers + RLS-on + deny-by-default (PR 3)

- [x] 3.1 Create `supabase/migrations/0002_rls_core.sql` (part 1): `private` schema; 3 SECURITY DEFINER helpers (`is_org_member`, `user_branch_ids`, `session_role_in`) with `set search_path=''`, qualified refs; `revoke execute from public,anon` + `grant to authenticated,service_role` + default-privileges revoke; index `org_memberships(org_id,user_id)`. — Verify: `select proacl from pg_proc where proname in ('is_org_member','user_branch_ids','session_role_in')` — anon absent. — Applied in PR 3 slice, landed via PR #85 (commit 2d2e510).
- [x] 3.2 Same file: DO block looping `pg_tables` → `alter table public.%I enable row level security` on all 48 (D5). — Verify: count of `not rowsecurity` public tables = 0. — Applied in PR 3 slice, landed via PR #85 (commit 2d2e510).
- [x] 3.3 Same file: `revoke all on <each 48> from anon, authenticated` (D6, policies-before-grants). — Verify: `db reset`; anon and authed curl on `songs` → 0 rows. — Applied in PR 3 slice, landed via PR #85 (commit 2d2e510); deny-by-default verified in 4.1/4.3 matrix runs.

## Phase 4: S2c — Policies + grants (PR 4)

- [x] 4.1 Same file (append): `drop policy if exists` + `create policy` to `authenticated` with `(select auth.uid()) is not null` guard: songs by `created_by`; setlists owner-or-accepted-collab (writes `can_edit`); setlist_collaborators self-policy (D7); setlist_items EXISTS over setlists; sessions/annotations/device_configs by `user_id`. — Verify: demo curl `songs` → 2; setlist read → 1. — Applied with D7 recursion fix: owner-management policies read through new SECURITY DEFINER `private.session_owns_setlist(uuid)` (42P17 without it, see 4.1 header comment).
- [x] 4.2 Same file: notifications SELECT own + UPDATE own `grant update(read_at)` (D9); outbox INSERT+SELECT self (D10); scale_catalog `for select using(true)`. — Verify: demo PATCH `read_at` ok, PATCH `title` → 42501; outbox self insert/select ok. — scale_catalog uses uniform initPlan guard instead of bare `using (true)` (identical for authenticated).
- [x] 4.3 Same file: grants AFTER policies (D6): CRUD to authenticated on scoped tables; select/insert on outbox; notifications select+update(read_at); scale_catalog select; 8 gap tables + org/branches/memberships RLS-on no grants; service_role untouched. — Verify: isolation user → 0 songs; PATCH setlist name → 42501; authed GET `dmca_notices` → []; service_role psql → full. — Isolation sees 1 own song (seed gives isolation one song; matrix "0" stale); authed gap-table GET → 42501/403 permission denied (no grants = hard deny, not []); isolation PATCH setlist → 42501 verified.

## Phase 5: Verification + cleanup (PR 4 tail)

- [x] 5.1 Run full curl matrix per design Testing Strategy (all tokens, all tables). — Verify: matrix green end-to-end. — Full matrix run: demo 2 songs / isolation own-song 1 / setlist read 1 / owner PATCH 200 / isolation PATCH 42501 / read_at 200 + title 42501 / outbox POST 201 + self GET / gap-table hard deny / service_role full.
- [x] 5.2 `pnpm lint && pnpm build`; confirm hooks/guards/pages untouched; note S3 gap-table revisit + mock localStorage orphan keys as accepted residue. — Verify: lint zero warnings. — `pnpm lint` zero warnings; `pnpm build` ✓ 1.64s; src/ untouched (only 0002_rls_core.sql modified).

Rollback: revert PR commits per unit boundary above → `db reset` restores v1; localStorage intact; seed dev-only (never via `db push`).