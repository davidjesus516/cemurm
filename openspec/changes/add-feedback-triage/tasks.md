# Tasks: Add Feedback Triage

## 1) Spec
- [x] Create `features/feedback-triage.feature`
- [x] Create `openspec/changes/add-feedback-triage/proposal.md`
- [x] Create `openspec/changes/add-feedback-triage/design.md`
- [x] Create `openspec/changes/add-feedback-triage/specs/feedback-triage/spec.md`
- [x] Create `openspec/changes/add-feedback-triage/tasks.md`

## 2) Database
- [x] Create migration `supabase/migrations/0046_feedback_triage_and_github_link.sql`
  - [x] Add audit + GitHub link columns to `public.feedback`
  - [x] Add indexes
  - [x] Add `public.set_feedback_updated_at()` trigger
  - [x] Add `private.is_system_admin(uuid)`
  - [x] Add RLS policies for system_admin (select/update)
  - [x] Reset the table ACL and grant `update` on the triage columns only (the Supabase default ACL gave `authenticated` ALL)
- [x] Create smoke test `scripts/smoke/0046-feedback-triage.sql` (15 PASS)
- [x] Verify with `supabase db reset` locally (0046 applied, smoke 15 PASS / 0 FAIL)

## 3) Edge Function
- [x] Create `supabase/functions/feedback-to-issue/index.ts`
- [ ] Document secrets in `docs/local-dev.md` (PAT + GitHub App notes)
- [ ] Test locally with `supabase functions serve` and curl
- [x] Handle authz, idempotency, errors (JWT -> `user_roles` service-role check -> 403/500; already-promoted returns the existing link)

## 4) UI
- [x] Create `src/features/feedback-triage/` structure
  - [x] `components/FeedbackFilters.jsx`
  - [x] `components/FeedbackInboxTable.jsx`
  - [x] `components/FeedbackDetailPanel.jsx`
  - [x] `components/PromoteToIssueButton.jsx`
  - [x] `hooks/useFeedbackTriage.js`
  - [x] `hooks/useSystemAdmin.js`
  - [x] `pages/FeedbackTriagePage.jsx`
  - [x] `services/feedbackTriageService.js`
  - [x] `index.js`
- [x] Create `src/app/guards/RequireSystemAdmin.jsx` (access-denied state + `<Outlet />`)
- [x] Add route in `src/app/router.jsx` guarded by `RequireAuth` + `RequireSystemAdmin`
- [ ] Add navigation entry visible only to system_admin
- [x] Wire service to Supabase and Edge Function

## 5) QA & Docs
- [x] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (all green; `deno check` too)
- [ ] Manual test: access control, filters, status changes, promote to issue
- [x] Verify RLS behavior for anon/authenticated/system_admin (`scripts/smoke/0046-feedback-triage.sql`)
- [ ] Update `docs/features-overview.md` / `docs/mvp-scope.md` with feedback triage
- [ ] Update `AGENTS.md`/`docs/local-dev.md` if needed
