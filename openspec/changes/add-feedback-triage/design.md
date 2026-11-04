# Design: Add Feedback Triage

## Authorization
- Only `system_admin` can access the triage UI and perform triage actions.
- Authorization is enforced at three levels:
  1. **Router/Guard (client)**: `RequireSystemAdmin` guards the route and hides navigation entry.
  2. **RLS (DB)**: `feedback_select_staff` and `feedback_update_staff` use `private.is_system_admin((select auth.uid()))`.
  3. **Edge Function (server)**: `feedback-to-issue` validates the JWT and reads `public.user_roles` with the service-role client to confirm `system_admin` before calling the GitHub API. `private.is_system_admin` cannot be reached from the function: PostgREST does not expose the `private` schema, so an `rpc()` call never resolves.
- `community_moderator` is intentionally excluded. It is scoped to `public.reports` / `moderation_cases` of the public library.

## Database Changes
- Extend `public.feedback` with audit fields (`updated_at`, `updated_by`) and GitHub link fields (`github_issue_number`, `github_issue_url`, `github_repo`, `promoted_at`, `promoted_by`).
- Add indexes to support inbox queries (`status, created_at desc`, `kind, created_at desc`, partial index on `github_issue_number`).
- Add trigger to maintain `updated_at`.
- Add `private.is_system_admin(uuid)` helper with `security definer`, `set search_path = ''` (fully qualified references, matching the repo's other definer helpers), revoked from `public/anon`, granted to `authenticated/service_role`.
- Keep existing `insert/select self` policies intact. Add staff read/update policies.
- Reset the table ACL: Supabase's default privileges hand `authenticated` ALL on every new public table, so `0033`'s revoke from `public/anon` left INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER in place. `0046` revokes it back to `insert, select` and grants `update` on the triage columns only (`updated_at` stays trigger-owned). RLS filters rows; it does not scope columns, and it never covers `TRUNCATE`.

## GitHub Integration
- **Approach**: Start with **GitHub Personal Access Token (PAT)** stored as Supabase secret `GITHUB_TOKEN` with `repo` scope. Design to migrate to a **GitHub App** later (better audit trail/per-repo permissions).
- **Repo**: Fixed to `davidjesus516/cemurm` via `GITHUB_REPO_OWNER` / `GITHUB_REPO_NAME` (or default). Can be made configurable later.
- **Action**: Manual promotion from triage UI via Edge Function `feedback-to-issue`.
- **Post-promotion**: Set `github_issue_number`, `github_issue_url`, `github_repo`, `promoted_at = now()`, `promoted_by = auth.uid()`. Set status to `triaged` after successful creation.
- **Idempotency**: If `github_issue_number` already exists, UI hides the action and shows the issue link.
- **Issue content**: Include kind, message, screen, consent status for diagnostics, feedback id, user id, created_at, origin `CEMURM In-App Feedback`. Only include diagnostics if present (respecting client consent).

## Edge Function: feedback-to-issue
- Path: `supabase/functions/feedback-to-issue/index.ts`
- Auth: Require valid `Authorization: Bearer <access_token>`. Get user via `supabase.auth.getUser`.
- Authz: Confirm `system_admin` with a service-role read of `public.user_roles` (the `private` helper is not PostgREST-exposed). Return 403 if not authorized and 500 if the role read itself fails.
- Input: `{ feedback_id: string }`
- Flow:
  1. Fetch feedback by id (use service role client in function)
  2. If already has `github_issue_number` -> return existing link (idempotent)
  3. Build issue title/body from feedback
  4. Create issue via GitHub REST API `POST /repos/{owner}/{repo}/issues`
  5. Update feedback with link + promotion metadata + set status to `triaged`
- Errors: Return structured errors with clear messages. Do not leak tokens.

## UI
- Feature module: `src/features/feedback-triage/`
- Components: `FeedbackFilters`, `FeedbackInboxTable`, `FeedbackDetailPanel`, `PromoteToIssueButton`
- Hooks: `useFeedbackTriage`, `useSystemAdmin`
- Page: `FeedbackTriagePage`
- Guard: `RequireSystemAdmin` (fail-closed; renders an access-denied state for non-admins rather than redirecting, per the @access scenario; renders `<Outlet />` for admins)
- Route: Mounted at `/feedback-triage` inside the authenticated + guardian-consent subtree, with its own system_admin gate (separate from the org_owner dashboard gate)
- Navigation: Only visible to system_admin
- Behavior: Inbox ordered by `created_at desc` by default. Filters by kind/status. Detail panel shows full context, diagnostics only if present. Status actions update via Supabase with RLS. Promote calls Edge Function and refreshes item.

## Safety & Privacy
- Diagnostics only shown if present (and were consented by the client at submit time). Never infer consent.
- Triage actions do not trigger submitter notifications by default.
- No client-side GitHub token. All GitHub calls go through Edge Function with service role + server-side token.
- `delete` not exposed from client: `authenticated` holds only `insert`, `select` and column-scoped `update` on the triage surface. Updates limited to staff via RLS, and `updated_by` must equal the caller.

## Future Work
- **Bidirectional sync**: Add webhook endpoint for `issues.closed`/`issues.reopened` to update `public.feedback.status`. Requires webhook secret and endpoint configuration.
- **GitHub App migration**: Replace PAT with GitHub App for better permissions and auditability.
- **Triage notes/assignment**: If needed later, can extend table with `triage_notes`, `assigned_to`, etc.
- **Configurable repo/labels**: Allow selecting repo or applying labels based on `kind`/screen.
