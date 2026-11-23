# Change Proposal: education-institutional-modules

> **Status:** Accepted (2026-11-14) — ADR-012
> **Supersedes:** `ampliar-alcance-institucional` (Moodle integration)
> **Base:** `main` = `f7d8bdc`, 46 migrations, 48 features / 776 scenarios, 36 routes
> **Related docs:** `odd/tasks/education-institutional-decisions.md`, `docs/decisions.md` (ADR-012), `docs/roadmap-ampliacion.md` (this change)

---

## Intent

CEMURM adds **four modular, optional, organization-scoped capability areas** as native extensions within the same repository, same Supabase project, same database, same deployment:

1. **Formación y educación** — courses, offerings, enrollment, sessions, materials, exercises, progress, observations, evaluations.
2. **Actividades y agenda institucional** — classes, workshops, meetings, rehearsals extending the existing `events` table.
3. **Inventario y recursos** — instrument/equipment catalog, assets, loans, inter-branch movements.
4. **Administración institucional y reportes** — cross-module dashboards, audit log, academic transcripts.

The musical core (repertoire, setlists, stage mode, collaboration, offline) **remains unchanged and continues to function without any institutional module enabled**.

---

## Problem

### 1. The academy's 21 requirements describe a real need, not an arbitrary expansion

The original schema (`0001_init.sql`) was written with 44 entities and `organizations.org_type` accepting `'Academy' | 'Church' | 'Orchestra'`. The institutional scope was **designed in from the start** but only partially built (Hitos 1–5). The 11 requirements (21 detailed) complete that original vision.

### 2. ADR-011 (Moodle integration) was a deliberate reversal of the technical evaluation

A 12-candidate evaluation ranked native Supabase highest (4.35/5) vs. Moodle (1.95) because:
- Completion is a single transaction joining the offline outbox
- No external system can own a section selector over `song_versions.section_context`

ADR-011 chose Moodle anyway, optimizing for maintenance load over integration purity. **ADR-012 reverses that decision** because:
- Splitting the musical–educational seam duplicates identity and breaks offline atomicity
- Adds PHP runtime, second database, upgrade cycle, data-processing agreement for minors
- The 67 existing BDD scenarios across `education-*` are product truth and would need rewriting

### 3. `org_memberships` is read-only — the hard blocker

`grant select on table public.organizations, public.branches, public.org_memberships to authenticated` (`0016:552`). Three policies, all `SELECT`. The **only writer** is `private.org_leave` → `public.leave_organization` (self-only). No join, no role change, no removal of others. **Any enrollment system requires membership RPCs first.**

---

## Scope

### In scope — 13 core tables + 3 conditional

| Area | Tables | Phase |
|---|---|---|
| Activation | `organization_modules` | F2 |
| Academic periods | `academic_periods` | F3 |
| Courses & offerings | `education_courses`, `education_course_offerings`, `education_subjects` (cond) | F3 |
| Enrollment | `education_enrollments` (with `withdrawn_at`, tutor consent) | F3 |
| Sessions & spaces | `spaces`, `education_sessions` + `events` extension | F4 |
| Materials | `education_materials` + `charts` bucket RLS migration | F5 |
| Exercises & progress | `education_exercises`, `education_progress`, `education_events` (XP ledger) | F3 |
| Observations | `education_observations`, `org_module_settings` (visibility config) | F6 |
| Evaluations | `education_evaluations`, `education_grades` | F3 |
| Inventory | `inventory_asset_types`, `inventory_assets`, `inventory_loans`, `inventory_movements` (cond) | F7 |

### Out of scope

- Hito 6 (Beta Polish) — unchanged, runs in parallel
- Facturación, contabilidad, ERP, comprobantes fiscales
- LMS externo (Moodle, Canvas, Frappe)
- Motor complejo de evaluaciones automáticas (sin aprobación posterior)
- `user_roles` extension (platform roles only)
- Separate `bands` entity (D4=B: three new tables). D4=A resolved: `org_type='Band'` uses existing `organizations`.

---

## Capabilities

### New capabilities

| Capability | Requirements | Phase |
|---|---|---|
| `module-activation` | Org-scoped feature toggles | F2 |
| `identity-account-lifecycle` | Membership RPCs, account status, audit | F1 |
| `education-courses-exercises` | Courses, offerings, exercises, song anchor | F3 |
| `education-enrollment` | Offering-targeted, tutor consent, withdraw/reactivate | F3 |
| `education-progress-gamification` | XP ledger, streak, daily goal (conserved) | F3 |
| `education-evaluations` | Formal evaluations, grades, audit trail | F3 |
| `education-sessions` | Class occurrences, schedule, rooms, conflicts, recurrence | F4 |
| `education-materials` | PDF/link attachments, visibility, versioning | F5 |
| `education-followup` | Observations, configurable visibility | F6 |
| `institutional-activities` | Extended `events` for academic types | F4 |
| `asset-inventory` | Types, assets, org/branch ownership | F7 |
| `asset-loans` | Loans, returns, overdue, event/session link | F7 |
| `institutional-analytics` | Enrollment trends, attendance, progress, transcripts | F8 |

### Modified capabilities

- `organizational-repertoire-model` — `org_memberships` gains writers (RPCs)
- `analytics-and-insights` — **Rewritten** from personal to institutional (23 → ~30 scenarios)

---

## Approach

### Authorization pattern (replicates `promote_song_to_system`)

```sql
-- Public thin wrapper
create or replace function public.enroll_student(p_offering_id uuid, p_student_id uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Validate internally, never trust arguments
  if not private.is_org_member_of_offering(p_offering_id, auth.uid()) then
    raise exception 'not authorized';
  end if;
  -- Delegate to private core
  perform private.enroll_student_core(p_offering_id, p_student_id, p_role);
end $$;

-- Private core with full validation
create or replace function private.enroll_student_core(...)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Check offering exists, student is org member, tutor consent if minor, unique constraint
  ...
end $$;
```

### Key principles

1. **No direct writes to organizational tables** — only via `SECURITY DEFINER` RPCs
2. **RLS stays org-scoped** — module enforcement in UI/routes + RPC guards (T5)
3. **Module activation ≠ RLS** — default on, `org_owner` disables (B7)
4. **Offline via outbox** — `client_uuid` idempotency for enrollment/progress (T8)
5. **Audit trail required** — `admin_audit_log` with org context (S3)

---

## Affected areas

### Migrations (F1–F7)

| Phase | Migration | Content |
|---|---|---|
| F1 | `004x_identity_account_lifecycle.sql` | `profiles.account_status`, `profiles.created_at`, role CHECK, 3 membership RPCs, `admin_audit_log`, `FORCE RLS`, expanded `profiles` grant |
| F2 | `004y_organization_modules.sql` | `organization_modules` table, default enabled |
| F3 | `004z_education_core.sql` | 10 education tables + RLS + grants |
| F4 | `004a_spaces_sessions_events.sql` | `spaces`, `events` extension, `education_sessions`, conflict RPCs |
| F5 | `004b_education_materials.sql` + bucket RLS | `education_materials`, `charts` bucket org-scoped migration |
| F6 | `004c_observations_consent.sql` | `education_observations`, `org_module_settings`, `guardian_consents` extension |
| F7 | `004d_inventory.sql` | 3–4 inventory tables |

### BDD (new/rewritten)

| File | Phase | Scenarios |
|---|---|---|
| `organization-members.feature` | F1 | ~12 |
| `module-activation.feature` | F2 | ~8 |
| `education-structure.feature` | F3 | ~15 |
| `education-enrollment.feature` | F3 | 21 (rewrite) |
| `education-sessions.feature` | F4 | ~20 |
| `education-materials.feature` | F5 | ~12 |
| `education-followup.feature` | F6 | ~15 |
| `inventory-assets.feature` | F7 | ~15 |
| `inventory-loans.feature` | F7 | ~15 |
| `analytics-institutional.feature` | F8 | ~30 (rewrite) |

**Total: ~10 new/rewritten feature files, ~160 scenarios**

### Code

| Layer | Paths |
|---|---|
| Domain | `src/domain/education/` (state machines, derivations, rules) |
| Repositories | `src/data/repositories/education.js`, `inventory.js`, `identity.js` |
| Features | `src/features/education/`, `activities/`, `inventory/`, `organization/` |
| Routes | `/education/*`, `/activities/*`, `/inventory/*`, `/organization/*` (gated by `organization_modules`) |
| RPCs | 12+ `SECURITY DEFINER` functions in `private` schema |

---

## Verification

### Database verification (manual, not in CI)

| What | How |
|---|---|
| Org isolation | Smoke SQL with `set_config('role', …)` + fixed UUIDs |
| SOD guards | Smoke as actor who must fail, expect exception |
| Write leakage | Attempt insert into another org, expect 42501 |
| `FORCE RLS` | Connect as owner, confirm policy respected |
| XP/streak logic | `src/domain/education/` with `@ts-check`, Vitest node |
| Offline idempotency | `client_uuid` dedup in outbox drain |

### JS verification (CI)

`pnpm test && pnpm typecheck && pnpm lint && pnpm build`

> **Note:** None of these four touch the database. Smoke tests are manual and require `supabase db reset` + `-v ON_ERROR_STOP=1`.

---

## Rollback

Each phase is independently reversible without data loss:

- **F1** — Revert membership RPCs, `admin_audit_log`, `profiles` columns. `leave_organization` survives.
- **F2** — Drop `organization_modules`. Modules default on → no behavior change.
- **F3** — Drop 10 education tables. Musical catalog untouched.
- **F4** — Drop `spaces`, `education_sessions`, revert `events` columns. `events` core unchanged.
- **F5** — Drop `education_materials`, revert `charts` bucket RLS (script provided).
- **F6** — Drop `education_observations`, `org_module_settings`, revert `guardian_consents`.
- **F7** — Drop inventory tables.
- **S1 (`FORCE RLS`)** — Only change whose rollback reduces security. Fix is policy, not removal.

---

## Frozen decisions (from ADR-012)

1. **Hito 6 untouched** — privacy obligations first, runs in parallel
2. **Dependency order** — F1 → (F2, F3) → F4 → (F5, F6, F7) → F8
3. **BDD before code** — 10 new/rewritten feature files before any migration
4. **Schema noun** — `education_work` not `education_assignments` (D6). The proposal correctly uses `education_work` throughout; `education_assignments` does not appear in this document.
5. **Zero `songs` columns** — `UPDATE` capped by column grant since `0020`
6. **`database-schema-v2.md` not updated here** — design target, known debt
7. **`user_roles` frozen** — platform roles only
8. **Smokes non-idempotent** — require `supabase db reset` + `ON_ERROR_STOP=1`

---

## Resolved decisions (D1–D5)

| ID | Topic | Decision | Phase |
|---|---|----------|-------|
| **D1** | Tutor consent flow | **A (simple)**: boolean `educational_data_access` + `expires_at` in `guardian_consents`. Revocable by tutor from UI. | F3/F6 |
| **D2** | `recurrence_rule` format | **C (own table)**: `recurrence_patterns(freq, interval, weekdays[], end_date)`. | F4 |
| **D3** | Observations visibility | **C (per-observation)**: `visibility` column in `education_observations` with enum `staff_only | student_and_staff`. | F6 |
| **D4** | `charts` bucket migration | **C (new bucket)**: new bucket `education_materials` (org-scoped); `charts` stays user-scoped for musical assets. | F5 |
| **D5** | `module_key` values | `education`, `sessions`, `materials`, `observations`, `inventory` — all `enabled=true` by default. | F2–F7 |

---

## References

- ADR-012: `docs/decisions.md` (full context, alternatives, consequences)
- Decision record: `odd/tasks/education-institutional-decisions.md` (matrices, phases, tables)
- Roadmap: `docs/roadmap-ampliacion.md` (this change)
- Audit: `odd/tasks/cemurm-education-audit.md` (original 5-table MVP analysis)
- Precedent: `0016:360-430` (`promote_song_to_system`), `0002:26-30` (`session_role_in`)

---

*Accepted 2026-11-14 by product owner. Supersedes `ampliar-alcance-institucional` (Moodle). No implementation authorized until F0 documentation PRs land and F1 membership RPCs are verified.*