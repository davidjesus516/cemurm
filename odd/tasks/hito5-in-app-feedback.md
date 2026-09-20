# Hito 5 — In-App Feedback and Bug Reporting (#74)

## Objective
Beta users send feedback or bug reports from inside the app: kind toggle (Bug report / General feedback), account + screen context attached, optional screenshot, explicit consent before device/log diagnostics, offline queueing, and a non-blocking submit that preserves drafts on failure. Logged-out users get the public issue tracker URL instead of a live form.

## BDD
`features/in-app-feedback.feature` (8 scenarios): form opens from main menu with kind choice; general feedback submits with account + "Thanks, your feedback was sent"; bug report submits with screen context + optional screenshot; logged-out shows public issue tracker URL + sign-in explanation; explicit consent gates device/log diagnostics (without consent, report sends without device details); reported bug never blocks the app; offline submit queues with "pending" flag and sends on reconnect; unreachable service shows "Could not send, retry or copy your text" without losing the draft.

## Authorized scope
- Submit-only client surface. **No staff triage UI** (BDD has no moderator/staff scenarios) — owner reads reports via `service_role` (SQL console) or a future triage surface.
- Offline replay reuses the existing `offlineQueue`/`offlineSync` mechanism (op `{ name: 'submitFeedback', args: [payload] }`), not the schema-only `outbox` table.
- Screenshot attached as a capped base64 data URL inside `diagnostics` jsonb; no storage bucket in this slice.
- Migration `0020_feedback.sql` (no cross-branch deps; builds on merged main).

## Tasks
- [x] TB1 — Migration 0020: `feedback` table (id, user_id default auth.uid(), kind check, message check, screen, diagnostics jsonb, status default 'new', created_at), RLS insert-self + select-self only, no client update/delete; anon deny; grants authenticated only.
- [x] TB2 — Live validation: `supabase db reset` (0001→0019 + 0020 clean), RLS smoke as demo/isolation/anon (insert self OK + row has user_id=me; cross-user select denied; anon insert denied; diagnostics null vs present per consent flag).
- [x] TF1 — `src/lib/feedback.js`: `submitFeedback({kind, message, screen, diagnostics})` → direct PostgREST insert; offline path `enqueueOp(userId, { name: 'submitFeedback', args })` + dispatcher case in `offlineSync` drain; failure surfaces typed error (draft preserved upstream).
- [x] TF2 — Feedback UI: button in AppLayout header ("main menu") → feedback form (modal): kind toggle, message, auto-captured screen (current route), optional screenshot attach (capped), consent checkbox "attach device info and logs" shown for bug reports (diagnostics built ONLY when checked), success confirmation exact "Thanks, your feedback was sent"; logged-out renders the public issue tracker URL + explanation instead of the form; submit is fire-and-forget (never blocks navigation/app).
- [x] TF3 — Failure + offline states: "Could not send, retry or copy your text" with retry + copy-text actions, draft preserved; offline submit queues and flushes on reconnect (`startOfflineSync` surface).
- [x] CHK — `pnpm lint` (zero warnings) + `pnpm build` green; route/nav wiring verified.

## Validation evidence
- `supabase db reset` on FULL 0001→0020 + seed: PASS (first time the complete merged chain resets — 0014 ARRAY[] and 0019 display_name_for duplicates fixed first: commits `894845a` on main, `1ee9615` on this branch).
- RLS smoke (postgres→authenticated + jwt claims, port 54322, seed users): T0 auth.uid()=demo ✓; T1 demo insert returns row `user_id=demo, screen=/setlists` ✓; T2 bug_report with diagnostics → `has_diagnostics=t` ✓; T3 demo sees own rows=2 ✓; T4 isolation sees 0 (cross-user deny) + own insert `user_id=isolation` ✓; T5 anon insert→42501 permission denied ✓; T6 demo update/delete→0 rows (RLS silent deny) ✓.
- `pnpm lint` zero warnings; `pnpm build` ✓ 3.41s.
- Note: `set_config(..., true)` (is_local) is transaction-scoped — validation must use `false` so JWT claims persist across statements.

## Commits (work units)
- `1ee9615` fix(migrations): make display_name_for replaceable across service+rehearsal slices
- Commit A: feat(feedback): add self-scoped feedback table (migration 0020)
- Commit B: feat(feedback): data layer with diagnostics consent + offline replay
- Commit C: feat(feedback): feedback form + header entry point + task doc evidence

## Acceptance criteria
- All 8 BDD scenarios satisfiable by the surface; migration applies from a clean reset alongside 0001–0019; lint+build green; offline queue op replays after reconnect; failure path keeps the draft text.

## Verification commands (each task)
- Backend: `supabase db reset` + psql smoke matrix (as validated T2 style from hito4).
- Frontend: `pnpm lint && pnpm build`; structural readback of routes/nav.

## Delivery
- auto-chain (session), chain strategy stacked-to-main, PR once per feature in the Hito 5 order (Feedback → Display → Freeze → Projection → Substitutions → MIDI → OBS → Auto-Tagging → PDF → Integrations); size:exception documented in PR body (expected diff > 400 lines, maintainer-accepted for the milestone chain).

## Review status (RDD)
- To fill after commit: assess tier + preflight outcome. Session policy: native review deferred (immutable transport unsupported on OpenCode runtime, gentle-ai 3.1.0); sync block resolved 2026-09-20 (plugin repaired by user), preflight now `stop / immutable_review_transport_unsupported` — capability limit, not environment.