-- CEMURM 0020 — In-App Feedback: beta feedback + bug reports (submit-only)
--
-- Backend of features/in-app-feedback.feature (8 scenarios). Hito 5 slice; base =
-- merged main (0001–0019). No cross-branch deps: feedback is a brand-new table
-- (the 48-table 0001 schema has no feedback surface; the schema-v2 outbox row
-- lists in-app-feedback among consumers, but the outbox queue is client-owned
-- and client-side here — the feedback offline path reuses src/lib/offlineQueue).
--
-- Scope decision: SUBMIT-ONLY. The BDD file has no staff/moderator scenarios, so
-- there is no client triage surface. Reports are immutable client POST rows
-- (insert + self-select only); the owner reads them via service_role/SQL console
-- or a future triage surface. Consent for diagnostics is enforced by the client
-- payload (the report simply omits `diagnostics` without consent) — the row shape
-- allows diagnostics to be NULL.
--
-- Scenario map (features/in-app-feedback.feature):
--   1 form opens from main menu .......... CLIENT: button in AppLayout header +
--                                        kind toggle; no backend here.
--   2 general feedback submits ............ INSERT (self, account context via
--                                        user_id default auth.uid()).
--   3 bug report w/ screen + screenshot ... screen column + diagnostics.screenshot
--                                        (data URL, client-capped); same INSERT.
--   4 logged out lists issue tracker ...... CLIENT: auth gate renders the public
--                                        tracker URL; no server write possible
--                                        (anon insert denied below).
--   5 consent before diagnostics ........... diagnostics NULL when not consented
--                                        (client builds payload conditionally).
--   6 reported bug does not block ......... CLIENT: fire-and-forget submit.
--   7 offline queues, sends on reconnect .. CLIENT: enqueueOp + offlineSync
--                                        dispatcher replays the SAME INSERT.
--   8 failure surfaced, draft kept ........ CLIENT: typed error + draft retained.

-- ══════════════════════ 1. TABLE ══════════════════════
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('bug_report', 'general_feedback')),
  message text not null check (length(message) between 1 and 20000),
  screen text,
  diagnostics jsonb,
  status text not null default 'new' check (status in ('new', 'triaged', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- ══════════════════════ 2. RLS ══════════════════════
-- Submit: own rows only; the default user_id = auth.uid() makes account context
-- unambiguous at insert time (and at offline replay time).
create policy feedback_insert_self on public.feedback
  for insert to authenticated
  with check (user_id = auth.uid());

-- Read: own rows only (client confirmation / retry context).
create policy feedback_select_self on public.feedback
  for select to authenticated
  using (user_id = auth.uid());

-- No client update/delete: reports are immutable records for triage.

-- ══════════════════════ 3. EXECUTE LOCK + GRANTS ══════════════════════
revoke all on table public.feedback from public, anon;
grant insert, select on public.feedback to authenticated;
grant all on table public.feedback to service_role;