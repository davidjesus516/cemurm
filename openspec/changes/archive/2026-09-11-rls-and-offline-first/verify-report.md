```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:9057a73564454e53bf4eed43444ca8afd26645ff016a694e4f07ffc1d79d1646
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 9/9
scenarios: 18/18
test_command: supabase db reset && supabase db query --local "select count(*) from pg_tables where schemaname='public' and not rowsecurity" && bash /tmp/opencode/verify-matrix.sh
test_exit_code: 0
test_output_hash: sha256:9057a73564454e53bf4eed43444ca8afd26645ff016a694e4f07ffc1d79d1646
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:e2104f0e539423d68988e5cb176ae2dc0eb6823629ccb4b6ffd64430962c5cdc
```

## Verification Report

**Change**: rls-and-offline-first
**Version**: N/A (delta specs, no version field)
**Mode**: Standard (strict_tdd: false, no test runner — openspec/config.yaml)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 12 |
| Tasks complete | 12 |
| Tasks incomplete | 0 |

All tasks checked (`[x]`), native taskProgress allComplete true. Full verification executed.

### Build & Tests Execution

**Build**: ✅ Passed
```text
$ pnpm build
vite v5.4.21 building for production...
✓ 111 modules transformed.
✓ built in 2.17s
BUILD_EXIT=0
(!) chunk >500 kB advisory only (index-Cg1GIRUv.js 515 kB) — pre-existing app bundle, not introduced by this change
```

**Tests**: live harness — `supabase db reset` + `supabase db query --local` migration checks + GoTrue/RLS curl matrix (no test framework exists; config `test_command: ""`)
```text
$ supabase db reset
Applying migration 0001_init.sql...
Applying migration 0002_rls_core.sql...
Seeding data from supabase/seed.sql...
Finished supabase db reset on branch main. (exit 0)
tables=48 enum_types=6 rls_off=0 policies=34 gap_policies=0
helpers proacl: postgres/authenticated/service_role only — anon & public absent (all 4; incl. session_owns_setlist)
gap tables: postgres+service_role grants only (no anon/authenticated, 0 policies)
seed rows: users 2, orgs 2, memberships 2, songs 3, setlists 1, collabs 1, items 2, sessions 1,
           annotations 1, notifications 1, devices 1, outbox 1, scale 1
demo sign-in -> 200 + access_token (sub ...0001); isolation -> 200 (sub ...0002)
duplicate signup -> 422 user_already_exists; wrong password -> 400 invalid_credentials; logout -> 204
RLS matrix: anon songs -> 42501; demo songs -> 2; isolation songs -> 1 (own only);
            demo setlist -> 1; demo PATCH setlist -> 204; isolation PATCH setlist -> 42501;
            isolation setlist read (accepted view-only collab) -> 1; notifications read_at PATCH -> 204,
            title PATCH -> 42501; outbox POST -> 201, self GET -> 2 own rows, foreign user_id -> 42501;
            dmca_notices GET (authed) -> 42501; service_role songs -> 3.
```

**Coverage**: ➖ Not available (no coverage tooling; threshold 0 per config)

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Hardened lookup helpers | Membership lookup | psql proacl + curl cross-user isolation; D7 `session_owns_setlist` present (enmienda) | ✅ COMPLIANT |
| Hardened lookup helpers | No execution for revoked roles | `pg_proc.proacl` — no anon/public ACL on all 4 helpers | ✅ COMPLIANT |
| RLS enabled on all 48 tables | No table left open | `rls_off=0` (48/48 rowsecurity) + `supabase db reset` exit 0 | ✅ COMPLIANT |
| Owner-scoped policies | Demo user reads own song | demo GET songs → 2 rows, both `created_by`=demo | ✅ COMPLIANT |
| Owner-scoped policies | Other user sees zero rows | isolation GET songs → own 1 row only; zero of demo's rows | ✅ COMPLIANT |
| Owner-scoped policies | Anonymous sees zero rows | anon GET songs → 42501 hard deny (zero rows exposed; stricter than `[]`) | ✅ COMPLIANT |
| Owner-scoped policies | Setlist collaborator access | isolation (accepted, view-only) GET setlists → 1; isolation PATCH → 42501; owner PATCH → 204 | ✅ COMPLIANT |
| Owner-scoped policies | Outbox self service | POST 201; self GET → 2 own rows; foreign `user_id` POST → 42501 WITH CHECK | ✅ COMPLIANT |
| Gap tables deny-by-default | Client denied on gap tables | authed GET dmca_notices → 42501; gap grants = postgres+service_role; service_role songs → 3 | ✅ COMPLIANT |
| Demo seed data | Reset produces runnable dev state | `db reset` exit 0 + seed row counts + demo login + RLS reads end-to-end | ✅ COMPLIANT |
| Auth surface unchanged | Existing consumers work unchanged | git: no commits to hooks/pages/components in change window; lint exit 0 zero warnings; build exit 0 | ✅ COMPLIANT |
| Auth surface unchanged | Sign-in returns the session user | GoTrue 200 + access_token; `mapUser` shape (id/email/firstName/lastName/displayName) source-verified | ✅ COMPLIANT |
| Supabase-backed session | Sign in persists a real Supabase session | live password grant → session JWT (sub ...0001); D1 `onAuthStateChange` cache + `getSession` wiring source-verified | ✅ COMPLIANT |
| Supabase-backed session | Sign out clears the session | GoTrue logout → 204; `onAuthStateChange` maps SIGNED_OUT → `cachedSession=null` (auth.js:15-18, 85-92) | ✅ COMPLIANT |
| Errors keyed by error.code | Duplicate signup | live 422 `user_already_exists`; `toAuthError` maps code → app message (auth.js:34-41) | ✅ COMPLIANT |
| Errors keyed by error.code | Wrong password | live 400 `invalid_credentials`; no session issued | ✅ COMPLIANT |
| Demo user seed | Demo sign-in after reset | live `demo@cemurm.app` / `password1234` → 200 + access_token | ✅ COMPLIANT |
| Demo user seed | Demo identity anchors RLS | demo org_owner membership seeded; demo RLS reads resolve as declared | ✅ COMPLIANT |

**Compliance summary**: 18/18 scenarios compliant

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Auth surface unchanged | ✅ Implemented | `EMAIL_RE/signUp/signIn/signOut/getSession/getCurrentUser` exports, signatures, return shapes intact (auth.js:8-107) |
| Supabase-backed session | ✅ Implemented | supabase.auth delegation + module-level `onAuthStateChange` cache (D1); `auth:{persistSession,autoRefreshToken}` in supabase.js |
| Errors keyed by error.code | ✅ Implemented | branch only on `error.code` (D2): user_already_exists / invalid_credentials / 42501 / generic fallback |
| Hardened lookup helpers | ✅ Implemented | 3 helpers + enmienda D7 `session_owns_setlist`; all SECURITY DEFINER, `search_path=''`, execute locked to authenticated+service_role |
| RLS enabled on all 48 tables | ✅ Implemented | `rls_off=0`; policies (34) created before grants (D6) |
| Owner-scoped policies | ✅ Implemented | songs/setlists/setlist_items/collaborators/notifications(D9)/device_configs/outbox(D10)/scale_catalog per design |
| Gap tables deny-by-default | ✅ Implemented | 8 gap tables: RLS on, 0 policies, postgres+service_role only |
| Demo seed data | ✅ Implemented | D8 deterministic UUIDs; 2 users, 2 orgs, demo = org_owner, isolation = org_member (cross-org isolation) |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 session source + onAuthStateChange cache | ✅ Yes | auth.js:12-18 module singleton |
| D2 error.code branching | ✅ Yes | auth.js:34-41; live code checks match |
| D3 user shape from user_metadata | ✅ Yes | auth.js:21-30 `mapUser` |
| D4 signUp local validation + session fallback | ✅ Yes | auth.js:43-70 |
| D5 DO-block RLS enable | ✅ Yes | verified via `rls_off=0` (not text) |
| D6 policies-before-grants, revoke all first | ✅ Yes | anon 42501, gap grants absent, targeted grants effective |
| D7 session_owns_setlist enmienda | ✅ Yes | 4th SECURITY DEFINER helper present; collaborator read/write works live |
| D8 deterministic seed UUIDs | ✅ Yes | `…0001/…0002/…00a1/…00b1` verified in row data |
| D9 notifications UPDATE(read_at) column grant | ✅ Yes | read_at 204, title 42501 |
| D10 outbox INSERT+SELECT self | ✅ Yes | 201 / self-read / foreign user_id WITH CHECK 42501 |
| scale_catalog uniform initPlan guard | ✅ Yes (cosmetic) | tasks 4.2 note; equivalent for authenticated (allowed deviation, not spec-breaking) |

### Issues Found
**CRITICAL**: None
**WARNING**:
- Scenario wording drift (row-level-security spec: "zero rows are returned"): anon on owner tables and authenticated on gap tables receive **42501 hard deny**, not empty payloads — strictly stronger than specified (zero data exposed). Security intent fully met; observable HTTP contract differs from scenario prose. Revisited at S3.
- Build emits Vite chunk-size advisory (index bundle 515 kB > 500 kB) — pre-existing app bundle, not introduced by this change; informational.
**SUGGESTION**:
- row-level-security spec "Other user sees zero rows" GIVEN says "no ownership" but seed gives isolation one own song (tasks 4.3 already corrected the stale "0" reading); verified property is zero rows *of the demo user's data*. Wording refinement at S3.
- outbox POST clients must supply `seq` (NOT NULL, UNIQUE(device_id,seq)) — hidden in 0001 schema; worth a code comment or client util when S6 drain lands.
- App-level sign-out/`getCurrentUser()===null` is manual-E2E only (no JS runtime harness; design declares E2E manual). GoTrue side and subscription wiring proven live + by source.

### Verdict
PASS WITH WARNINGS
18/18 scenarios compliant, 12/12 tasks complete, zero blockers, zero critical findings; two nonblocking warnings (observable HTTP contract stricter than scenario prose on denied tables; pre-existing chunk-size advisory).