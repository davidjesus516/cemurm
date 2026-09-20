# Hito 5 — Published Plan Freeze (#80)

## Objective
Publishing a service plan must freeze exactly what members execute. A publish creates a versioned snapshot; edits after publish live only in the draft (flagged "Changed after publish") until a re-publish; members always read the last published/executed snapshot; re-publish keeps history with reason and notifies assignees; completing a service freezes the executed version into read-only history.

## BDD
`features/published-plan-freeze.feature` (9 scenarios): publish snapshots the plan (members see the published version as authoritative); edit after publish → new draft + "Changed after publish" marker while members keep the published version; draft never reaches members; offline members keep the exact published snapshot (client cache is the published payload, no leak); swapped chart after publish is flagged on the block + re-publish notifies Juan/Lucia + change logged with leader as decider; only the published version executes; intentional re-publish replaces the executed-with members seeing marker + reason (previous stays in history); version history lists every publish with date/decider/reason + intermediate drafts marked "not executed"; completed service shows read-only historical mode referencing the executed version.

## Authorized scope
- Migration `0021_plan_freeze.sql`:
  - `public.service_plan_versions` (id, service_id FK cascade, version_number, status published|superseded|executed, snapshot jsonb, reason, published_by default auth.uid(), published_at) with unique (service_id, version_number); RLS enabled + NO direct client access (revoke all from public/anon/authenticated; select → service_role only).
  - Definer RPCs: `public.publish_plan(uuid, text)` (leader-only, status<>completed; builds snapshot; inserts version; draft→published on first publish; supersedes previous; logs `service_change_log` action `publish` with leader as decider; notifies every assignee via `public.notify_user` — self-suppressed actor; returns version_number), `public.get_published_plan(uuid)` (org-member-or-leader; returns {published, version_number, status, published_at, published_by, reason, snapshot, draft, draft_changed} — draft built with the SAME snapshot builder), `public.list_plan_versions(uuid)` (leader-only; version history with decider display name via `private.display_name_for`).
  - Trigger `service_completed_freeze` on `services` UPDATE of status → marks latest published version `executed` on completion.
  - Private helper `private.build_plan_snapshot(uuid)` (shared by publish + compare).
- Frontend: `src/lib/services.js` (publishPlan, getPublishedPlan, listPlanVersions RPC calls) + `src/pages/ServiceDetail.jsx`:
  - Leader: Publish/Re-publish with optional reason replaces the plain status flip; "Changed after publish" badge when draft ≠ snapshot; version history modal; keep live draft editor.
  - Member: plan section renders the PUBLISHED snapshot (blocks/songs/keys/assignments) with a "changed after publish" notice when draft_changed; no draft data leaks.
  - Completed: read-only historical mode + "Executed version N" reference.

## Tasks
- [x] TP1 — Migration 0021: table + RPCs + trigger + grants; `supabase db reset` (full chain 0001→0021 + seed) PASS.
- [x] TP2 — RLS/RPC smoke (live psql matrix 15/15): T0 baseline no-publish; T1 publish v1 flips draft→published + version active; T2 draft edit → draft_changed=true + snapshot frozen; T3 re-publish v2 supersedes v1 + log(2); T4 member reads v2 snapshot, no draft leak (post-re-publish edit stays in draft); T5 non-leader publish blocked; T5b outsider cross-org read blocked; T6 anon no EXECUTE; T7 history rows + decider 'Demo User' + reason; T8 completed → v2 'executed' + read-only read; T9 publish-on-completed blocked; T10/T10b change log decider/reason/changed flags; T11 notifications system x2 per assignee, leader self-suppressed; T12 version table locked (anon/auth no SELECT, service_role yes).
- [x] TP3 — services.js RPC wrappers (publishPlan, getPublishedPlan, listPlanVersions).
- [x] TP4 — ServiceDetail leader surface: publish/re-publish with reason, "Changed after publish" badge + block flag, version history modal.
- [x] TP5 — ServiceDetail member/read path: snapshot rendering, no-draft-leak guarantee, completed historical mode w/ executed version caption.
- [x] CHK — `pnpm lint` (zero warnings) + `pnpm build` green.

## Evidence (frontend)
- Live E2E (real GoTrue password-grant JWT vs local stack via supabase-js 2.116, same .rpc() calls + arg names as the wrappers): 9/9 PASS —
  leader demo: getPublishedPlan {published:true, version_number:1, draft_changed:true}; snapshot blocks[0] "Worship" + songs C,G,D; listPlanVersions v1 + decider "Demo User" + reason "UI validation publish"; publishPlan re-publish returns v2; getPublishedPlan post-re-publish v2 + draft_changed=false.
  member juan: getPublishedPlan reads v2 snapshot (block still "Worship", no draft leak); listPlanVersions blocked ("Only the service leader can view version history").
- `.env.local` points at the CLOUD project (kspnacfcietqikbufcka.supabase.co), NOT local — local E2E ran with LOCAL_SUPABASE_URL/KEY overrides; file itself untouched (user-owned dev config).

## Evidence (0021)
- Migration: `supabase/migrations/0021_plan_freeze.sql` (table + `private.build_plan_snapshot` + `publish_plan` + `get_published_plan` + `list_plan_versions` + `service_completed_freeze` trigger + grants).
- Bugs found & fixed during validation: (1) insert-then-supersede order superseded the NEW version → reversed (supersede-first, insert-second) after live smoke caught v1='superseded'; (2) repo-health: 0018 granted authenticated only SELECT on services/service_blocks/service_assignments, but the leader UI mutates them directly (createService/updateServiceStatus/createBlock/updateBlock/deleteBlock/unassignMusician) → grants restored in 0021 (insert/update services, insert/update/delete blocks, delete assignments).
- Full-chain reset PASS (with local-only 0019 `display_name_for` OR REPLACE fix that PR #143 already carries to main; not committed here to avoid merge conflict).
- RLS matrix: 15/15 PASS (script mirrored at `scripts/smoke/0021-plan-freeze.sql`).

## Acceptance criteria
All 9 BDD scenarios satisfiable: versioned publish, draft isolation, flag + notify + log on re-publish, executed-version freeze on completion, history with reasons.

## Verification commands (each task)
- `pnpm lint && pnpm build`; `supabase db reset`; RLS smoke script (psql matrix, port 54322).

## Delivery
- auto-chain (session), stacked-to-main; PR 3/10 of the Hito 5 chain; size:exception documented (backend RPCs + ServiceDetail surgery > 400 lines, maintainer-accepted).

## Review status (RDD)
- Session policy: native review deferred (`immutable_review_transport_unsupported` on OpenCode runtime); recorded per-Hito-5-doc, not re-prompted.