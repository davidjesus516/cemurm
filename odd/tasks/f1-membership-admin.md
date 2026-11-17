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
| T1 | S1, S2, S3, S4 | Write `organization-members.feature` BDD (~12 scenarios) | `f1-bdd` |
| T2 | S1, S2, S3, S4 | Migration `0047_identity_account_lifecycle.sql`: `admin_audit_log`, `FORCE RLS`, 3 RPCs | `f1-migration` |
| T3 | S5 | UI `/organization/members` page | `f1-ui-members` |
| T4 | S6 | UI `/settings/accounts` page | `f1-ui-accounts` |

---

## Log

**L1** (user, original): Resolver decisiones D1–D5 para expansión institucional, luego pasar a F1 Membership Admin.

**L2** (assistant): D1–D5 resueltas:
- D1=A: `educational_data_access` booleana + `expires_at` en `guardian_consents`
- D2=C: tabla `recurrence_patterns` para recurrencia
- D3=C: columna `visibility` (`staff_only | student_and_staff`) en `education_observations`
- D4=C: bucket nuevo `education_materials` (org-scoped), `charts` intacto
- D5=5 módulos: `education`, `sessions`, `materials`, `observations`, `inventory` (todos enabled=true por defecto)

**L3** (assistant): Guardado en `odd/tasks/education-institutional-decisions.md` y `openspec/changes/education-institutional-modules/proposal.md`.

---

**Next:** T1 — Write `organization-members.feature` BDD (~12 scenarios).
