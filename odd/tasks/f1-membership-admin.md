# F1 — Membership Admin

**Branch:** `feat/f1-membership-admin` (from `main`)  
**Phase:** F1 (Membership Admin) — blocks F3 (enrollment requires membership RPCs)  
**Risk:** High (security: auth, permissions, guards — direct writes to `org_memberships`)

---

## Specs

**S1** — `add_org_member` RPC: org_admin/org_owner can add a user to an org with a role and optional branch. Returns error if user not found, org not found, or caller not authorized. SOD: org_owner cannot add themselves as owner of another org (self-leave only via existing RPC).

**S2** — `change_member_role` RPC: org_owner can change any member's role within the org. org_admin can change instructor/branch_admin roles but not org_owner. Returns error if membership not found or caller not authorized.

**S3** — `remove_org_member` RPC: org_owner can remove any member (sets status='removed', soft delete). org_admin can remove instructor/branch_admin/member but not org_owner. Returns error if membership not found or caller not authorized.

**S4** — `admin_audit_log` table: records actor_id, actor_org_ids, action, subject_table, subject_id, detail, created_at. FORCE RLS. All membership RPCs write an audit entry.

**S5** — UI `/organization/members`: org members list with roles, add member form, change role, remove member. Gated by module `education`/`inventory` etc.

**S6** — UI `/settings/accounts`: account status view (active/suspended/erased), export, erasure request. F1 scope: view only; export/erasure is Hito 6.

---

## Tasks

| ID | Spec | Route | Commit |
|----|------|-------|--------|
| T1 | S1, S2, S3, S4 | Write `organization-members.feature` BDD (~12 scenarios) | PR #524 (`features/organization-members.feature` + `src/data/repositories/orgMembers.js`) |
| T2 | S1, S2, S3, S4 | Migration `0021_identity_account_lifecycle.sql`: `admin_audit_log`, `FORCE RLS`, 3 RPCs | PR #523 (`supabase/migrations/0021_identity_account_lifecycle.sql`) |
| T3 | S5 | UI `/organization/members` page + route | PR #525 (`src/features/orgs/pages/OrganizationMembers.jsx`, `src/app/router.jsx`) |
| T4 | S6 | UI `/settings/accounts` page + route | PR #526 (`src/features/settings/pages/AccountSettings.jsx`, `src/app/router.jsx`) |

---

## Log

**L1** (user, original): Resolver decisiones D1–D5 para expansión institucional, luego pasar a F1 Membership Admin.

**L2** (assistant): Split F1 into 4 chained PRs of ≤400 changed lines each per AGENTS.md; all gates pass on every slice. Doc counts updated (migrations 44→45; features 48→49; scenarios 776→789).

---

**Next:** Request review of the chain (#523 → #526) from `@davidjesus516`; merge PR1 first so downstream slices unblock.
