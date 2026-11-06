# Change: Add Feedback Triage

## Why
In-app feedback is currently submit-only. As the project grows we need a controlled way to review bugs/suggestions and bridge them to the existing GitHub workflow without losing traceability between the app and issues.

## What Changes
- Add BDD spec for feedback triage (system_admin only)
- Extend `public.feedback` with audit + GitHub link fields
- Add RLS policies to allow system_admin to read/update feedback
- Add `private.is_system_admin` helper
- Create `supabase/functions/feedback-to-issue` Edge Function
- Add `src/features/feedback-triage/` UI with inbox, filters, detail, status changes and "Promote to GitHub Issue"
- Add route guarded by system_admin

## Impact
- Affected specs: feedback-triage (new)
- Affected code: migrations, supabase/functions, src/features, src/app/router
- No breaking changes to existing submit flow
