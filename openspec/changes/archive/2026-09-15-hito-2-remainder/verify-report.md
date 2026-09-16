```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:2a3e3b71b4948415fdc3fa25f4f39190adff2b964f08d93de4172f7672d32626
verdict: pass
blockers: 0
critical_findings: 0
requirements: 22/22
scenarios: 51/51
test_command: pnpm lint
test_exit_code: 0
test_output_hash: sha256:11d71e77d4b88459cb61d26a0ad90cba6586c04d49cd2117b6051e25ae83cfa0
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:70bb3b9425e45ca8810743b1c9f757f29d4fc4bd0aa5be3059eed4959efd7db7
```

## Verification Report

**Change**: hito-2-remainder (PR#1a — committed slice cd77a20 on `feat/hito-2-remainder-pr1a`, base e12c216/PR#0)
**Version**: N/A (delta spec, no version field)
**Mode**: Standard (strict_tdd: false, no test runner; lint_command `pnpm lint`, verify build_command `pnpm build` — openspec/config.yaml)

Committed slice verified only (`git show cd77a20:…` for all three code files). The DIRTY working tree (`src/lib/gigs.js` +514/-81, `supabase/seed.sql` +40) belongs to the next slice (PR#1a-lifecycle) and is excluded from defect judgment per orchestrator instruction.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total (PR#1a slice: 1a.1–1a.3) | 3 |
| Tasks complete | 3 |
| Tasks incomplete (in slice) | 0 |

All in-scope PR#1a tasks are checked `[x]` (1a.1 gigs.js CRUD + demo, 1a.2 0005 public bridge, 1a.3 useGigs.js). Tasks 1a.4–1a.6 are explicitly deferred to PR#1a-lifecycle in tasks.md (`[ ]`, marked deferred) — N/A by slice, not defects. Whole-change native progress 8/31 is informational; per-slice verification is the authorized delivery strategy (D8, tasks.md line 16).

### Build & Tests Execution

**Build**: ✅ Passed
```text
$ pnpm build
$ vite build
vite v5.4.21 building for production...
transforming...
✓ 116 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                             0.59 kB │ gzip:   0.38 kB
dist/assets/inter-vietnamese-400-normal-DMkecbls.woff2      4.97 kB
dist/assets/inter-vietnamese-600-normal-Cc8MFFhd.woff2      5.10 kB
dist/assets/inter-vietnamese-700-normal-DlLaEgI2.woff2      5.10 kB
dist/assets/inter-vietnamese-500-normal-DOriooB6.woff2      5.11 kB
dist/assets/inter-greek-ext-400-normal-DGGRlc-M.woff2       5.26 kB
dist/assets/inter-greek-ext-500-normal-C4iEst2y.woff2       5.43 kB
dist/assets/inter-greek-ext-600-normal-DRtmH8MT.woff2       5.43 kB
dist/assets/inter-greek-ext-700-normal-qfdV9bQt.woff2       5.44 kB
dist/assets/inter-vietnamese-400-normal-Bbgyi5SW.woff       6.50 kB
dist/assets/inter-vietnamese-500-normal-mJboJaSs.woff       6.60 kB
dist/assets/inter-vietnamese-700-normal-BZaoP0fm.woff       6.63 kB
dist/assets/inter-vietnamese-600-normal-BuLX-rYi.woff       6.64 kB
dist/assets/inter-greek-ext-400-normal-KugGGMne.woff        7.06 kB
dist/assets/inter-greek-ext-500-normal-2j5mBUwD.woff        7.19 kB
dist/assets/inter-greek-ext-600-normal-B8X0CLgF.woff        7.21 kB
dist/assets/inter-greek-ext-700-normal-BoQ6DsYi.woff        7.22 kB
dist/assets/inter-cyrillic-400-normal-obahsSVq.woff2        7.71 kB
dist/assets/inter-greek-400-normal-B4URO6DV.woff2           7.78 kB
dist/assets/inter-cyrillic-500-normal-BasfLYem.woff2        7.90 kB
dist/assets/inter-cyrillic-700-normal-CjBOestx.woff2        7.90 kB
dist/assets/inter-greek-500-normal-BIZE56-Y.woff2           7.92 kB
dist/assets/inter-greek-700-normal-C3JjAnD8.woff2           7.92 kB
dist/assets/inter-greek-600-normal-plRanbMR.woff2           7.94 kB
dist/assets/inter-cyrillic-600-normal-CWCymEST.woff2        7.97 kB
dist/assets/inter-cyrillic-400-normal-HOLc17fK.woff         9.78 kB
dist/assets/inter-cyrillic-700-normal-DrXBdSj3.woff         9.91 kB
dist/assets/inter-greek-400-normal-q2sYcFCs.woff            9.92 kB
dist/assets/inter-cyrillic-600-normal-4D_pXhcN.woff         9.94 kB
dist/assets/inter-cyrillic-500-normal-CxZf_p3X.woff         9.94 kB
dist/assets/inter-greek-500-normal-Xzm54t5V.woff            9.98 kB
dist/assets/inter-greek-700-normal-BUv2fZ6O.woff            9.98 kB
dist/assets/inter-greek-600-normal-BZpKdvQh.woff           10.03 kB
dist/assets/inter-cyrillic-ext-400-normal-BQZuk6qB.woff2   10.23 kB
dist/assets/inter-cyrillic-ext-500-normal-B0yAr1jD.woff2   10.43 kB
dist/assets/inter-cyrillic-ext-600-normal-Dfes3d0z.woff2   10.48 kB
dist/assets/inter-cyrillic-ext-700-normal-BjwYoWNd.woff2   10.50 kB
dist/assets/inter-cyrillic-ext-400-normal-DQukG94-.woff    13.34 kB
dist/assets/inter-cyrillic-ext-700-normal-LO58E6JB.woff    13.41 kB
dist/assets/inter-cyrillic-ext-500-normal-BmqWE9Dz.woff    13.45 kB
dist/assets/inter-cyrillic-ext-600-normal-Bcila6Z-.woff    13.46 kB
dist/assets/inter-latin-400-normal-C38fXH4l.woff2          23.66 kB
dist/assets/inter-latin-500-normal-Cerq10X2.woff2          24.27 kB
dist/assets/inter-latin-700-normal-Yt3aPRUw.woff2          24.36 kB
dist/assets/inter-latin-600-normal-LgqL8muc.woff2          24.45 kB
dist/assets/inter-latin-400-normal-CyCys3Eg.woff           30.70 kB
dist/assets/inter-latin-600-normal-CiBQ2DWP.woff           31.26 kB
dist/assets/inter-latin-500-normal-BL9OpVg8.woff           31.28 kB
dist/assets/inter-latin-700-normal-BLAVimhd.woff           31.32 kB
dist/assets/inter-latin-ext-400-normal-C1nco2VV.woff2      35.00 kB
dist/assets/inter-latin-ext-500-normal-CV4jyFjo.woff2      36.02 kB
dist/assets/inter-latin-ext-700-normal-Ca8adRJv.woff2      36.24 kB
dist/assets/inter-latin-ext-600-normal-D2bJ5OIk.woff2      36.26 kB
dist/assets/inter-latin-ext-400-normal-77YHD8bZ.woff       47.56 kB
dist/assets/inter-latin-ext-500-normal-BxGbmqWO.woff       48.49 kB
dist/assets/inter-latin-ext-700-normal-TidjK2hL.woff       48.63 kB
dist/assets/inter-latin-ext-600-normal-CIVaiw4L.woff       48.67 kB
dist/assets/index-7EYzjDHJ.css                             22.97 kB │ gzip:   4.68 kB
dist/assets/index-_nDrjG_j.js                             528.96 kB │ gzip: 153.18 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.83s
```

**Tests**: ✅ exited 0 (no test framework; config `test_command: ""`; this slice's covering tests are the live REST probe against the LOCAL stack + the committed-file `demo()` assert self-check)
```text
$ node /tmp/opencode/pr1a-verify.mjs
anon rpc status (expect != 2xx): 401
sign-in OK: demo@cemurm.app
rpc session_org_ids -> ["10000000-0000-0000-0000-0000000000a1"] status 200
gig create OK: f3ef776c-6397… | status planned | org 10000000-0000… | owner 10000000-0000…
gig read-back rows: 1
gig delete status: 204
post-delete rows: 0
PROBE PASS
gigs demo OK: 9 asserts (flatten + CRUD guards)
RUNNER_EXIT=0
```

**Coverage**: ➖ Not available (no coverage tooling; threshold 0 per config)

### Spec Compliance Matrix (retrieved spec: specs/gigs/spec.md; data-layer slice scope. Envelope totals 22/51 are the change-wide native authority across all 4 specs — gigs 7/15, personal-preferences 6/12, pwa-updates-storage 7/15, row-level-security 2/9)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Gig creation | Create a gig with venue details and a linked setlist | Live probe createGig-shaped insert (org_id/owner_id/name/scheduled_at/status) → 201 + read-back 1; committed createGig sends name/scheduledAt/venueId/setlistId/branchId/sharedToBranch/status='planned' + org_id (resolveOrgId) + owner_id; input guards demo-asserted | ✅ COMPLIANT (data layer; row display UI → PR#1b) |
| Gig creation | A gig references exactly one setlist at planning time | Single `setlist_id` FK column (0001 schema) = exactly one; updateGig `setlistId` patch is the swap path; committed code inspection | ✅ COMPLIANT (data layer; edit UI → PR#1b) |
| Gig creation | The same setlist can serve multiple gigs | `setlist_id` is a plain FK, no uniqueness constraint; updateGig scoped `.eq('id', id).eq('owner_id', userId)` touches only the edited gig row — setlist and other gigs untouched | ✅ COMPLIANT (data layer) |
| Venue suggestion and reuse | Prior venues are offered as suggestions for reuse | `listVenues` returns owner-scoped suggestion shape (id/name/location/type); create/update accept `venueId` to reuse saved venue; typing/suggestion UI → PR#1b; reuse/dedupe helper → PR#1a-lifecycle (1a.5) | ⚠️ PARTIAL (data shape present; UI + dedupe deferred by plan) |
| Venue suggestion and reuse | Edit a gig to change its venue | updateGig `venueId` patch, owner-scoped `.eq('id', id)` — change applies only to this gig | ✅ COMPLIANT (data layer) |
| Gig lifecycle | Confirm a planned gig | Committed hook ships `confirmGig(id)` → updateGig status 'confirmed'; transition validation (editable-until-completion lock) → lifecycle slice | ➖ N/A by slice (lifecycle 1a.4; status-patch plumbing present, guarantees unverified here) |
| Gig lifecycle | Edit a gig before completion, including its setlist | updateGig patches date/venue/setlist; completed-lock validation deferred | ➖ N/A by slice (data fields present; lock → 1a.4) |
| Gig lifecycle | Cancel a gig before the show | Committed hook ships `cancelGig`/`reopenGig` (status 'cancelled'/'planned'); no-performance-written guarantee → lifecycle slice | ➖ N/A by slice (1a.4) |
| Performance record on completion | Completing a gig writes one performance record | Read path present (DETAIL_SELECT embeds `performances(*, performance_items(*))`, flattenPerformance, demo-asserted ordering); write chain (one performances + items, no duplicates) → 1a.4 | ➖ N/A by slice (completion chain deferred) |
| Performance record on completion | Skipped songs are recorded separately | flattenPerformance maps `state` played/skipped/off_setlist + position (demo asserts skipped recorded separately) | ➖ N/A by slice (write path → 1a.4) |
| Performance record on completion | Songs played outside the setlist are recorded separately | off_setlist state supported in shape; write path → 1a.4 | ➖ N/A by slice |
| Performance record on completion | Post-show flow writes the gig's performance record | StageMode flow → PR#1c; write path → 1a.4 | ➖ N/A by slice |
| Played tags and demand counts | Played songs get "played at" tags and demand counts | songs.js/SongDetail change → PR#1c | ➖ N/A by slice |
| Notifications data source | The gig record provides date, time, and location for reminders | Gig row exposes `scheduled_at` + `venue_id`; resolved venue location in gig shapes + feature contract → later slices/notifications feature | ➖ N/A by slice |
| Offline gig operations | Create, edit, and complete a gig offline | enqueueOp/pendingSync/outbox → 1a.4/2a.6 | ➖ N/A by slice |

**Compliance summary**: 4/15 gigs-spec scenarios COMPLIANT at the data-layer slice scope (1/7 requirements — "Gig creation" fully); 1 PARTIAL (venue suggestions); 10 N/A by slice (lifecycle 3, completion 4, tags 1, notifications 1, offline 1). Other 3 specs (36 scenarios) are future slices (PR#0 verified 2026-09-14, 4/4; PR#2, PR#3 pending). Envelope completed counts (requirements 1, scenarios 4) are the slice-scoped completions against the change-wide native totals.

### Correctness (Static Evidence)
| Check | Status | Notes |
|-------|--------|-------|
| createGig sets org_id + owner_id | ✅ Implemented | Insert payload: `org_id: await resolveOrgId(supabase)`, `owner_id: userId`, `status: 'planned'`, shared_to_branch coerced; live probe 201 returned org …a1 + owner demo id |
| resolveOrgId calls the PUBLIC wrapper | ✅ Implemented | `supabase.rpc('session_org_ids')` — exactly the 0005 public function; live probe status 200 with org array; empty → user-facing 'Organization could not be resolved.' |
| Error handling matches setlists.js/songs.js conventions | ✅ Implemented | Identical `USER_ERRORS` set + `handleError` + `withErrorMapping` pattern (setlists.js L13–24, songs.js L12–21); gigs adds 3 gig guards + venue guard + org guard in USER_ERRORS |
| 0005 SECURITY DEFINER wrapper delegating to private.session_org_ids() | ✅ Implemented | `create or replace function public.session_org_ids() … language sql security definer stable set search_path = ''` delegating fully-qualified to `private.session_org_ids()`; search_path locked empty (0002 L55 pattern) — no definer-search-path hijack |
| 0005 revoke/grant correct (anon denied, authenticated allowed) | ✅ Implemented | `revoke … from public, anon; grant … to authenticated, service_role`; live: anon RPC → 401, demo (authenticated) → 200 |
| Owner scoping on every read/write | ✅ Implemented | listGigs/getGig/updateGig/deleteGig/listVenues all `.eq('owner_id', userId)`; update/delete also `.eq('id', id)`; delete pre-checks ownership (fetchGigById → 'Gig not found.') |
| useGigs follows useSongs pattern | ✅ Implemented | refresh useCallback + useEffect mount, optimistic local state appends/replacements/filters, createVenue dedupe (`prev.some`), same return surface shape |
| Committed-file demo() | ✅ Implemented | 9 asserts: flattenGig (items sorted by position, skipped recorded, userId mapping, no-performance → null), flattenVenue, 4 input guards; exit 0 |
| Commit size within budget | ✅ Implemented | `git show --stat cd77a20`: 4 files, 400 insertions, 7 deletions — insertions == 400 limit exactly (code 287+86+18 = 391; tasks.md 16; 7 deletions are tasks.md edits) |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D8 PR slicing: #1a = data layer (`lib/gigs.js`, `useGigs.js`) | ✅ Yes | Slice lands exactly the CRUD subset; seed moved to #1a-lifecycle by the authorized task split (tasks.md 1a.6, diff recorded in cd77a20) |
| D2a org accommodation → 0005 public bridge | ✅ Yes | 0004's private helper is invisible to PostgREST (schema exposure) — 0005 public SECURITY DEFINER wrapper is the pattern-conformant bridge; fix for the recorded PGRST202 blocker; real org enforcement stays Hito 4 (header comments + commit message) |
| Technical approach: "gigs data layer clones the setlists.js read-through + enqueueOp pattern" | ✅ Yes (deferred part) | PR#1a intentionally ships CRUD without read-through/queue (tasks 1a.1 note "lifecycle/offline parts deferred"); write wrappers land with 1a.4/2a.6 — documented, not a silent omission |
| RLS owner-scope contract (0004) from the client side | ✅ Yes | Client code relies on owner_id scoping + org_id NOT NULL resolution — live probe proves the exact client path works against 0004 policy set |
| Error-handling + flatten conventions | ✅ Yes | Byte-level pattern match with setlists.js/songs.js; flatten shapes mirror setlist/song flattens |

### Issues Found
**CRITICAL**: None
**WARNING**:
- Venue suggestion scenario (gigs S4) is PARTIAL by slice: `listVenues` suggestion shape + venue_id reuse exist, but the typing-suggestion UI is PR#1b and the reuse/dedupe helper is PR#1a-lifecycle (1a.5). Planned deferral, recorded in tasks.md — no code gap.
- Commit message says "RLS smoke (demo 3 gigs / isolation 1)" — that state only exists with the uncommitted next-slice seed (committed seed has zero gig rows). Not a defect: the substance was independently re-proven live here (probe 201 insert + owner-scoped read-back + delete) and in PR#0's 2-user matrix. Accuracy note only; future apply records should distinguish committed vs working-tree evidence.
- Dirty working tree (`src/lib/gigs.js`, `supabase/seed.sql` — next-slice content) is present alongside the committed slice. Per instruction, not defects; flagged so downstream slices land them before PR#1a merges forward (clean diff per chained-PR rule).
**SUGGESTION**:
- 400 insertions sits exactly at the review budget line (407 total churn counting the 7 deletions in tasks.md). PR#1a-lifecycle must keep its own additions lean and its diff clean against this branch.
- Live probe exercised the createGig column path with a minimal payload (org/owner/name/schedule/status). venue_id/setlist_id linking is proven by committed code inspection + PR#0's RLS matrix (owner-scoped venue/setlist inserts); a full venue+setlist linked live create is a natural test for the lifecycle slice harness.
- 0005 correctly grants `service_role` too (mirrors 0003/0004); no client code uses it, which is fine — it keeps the helper usable for server-side flows.

### Verdict
PASS WITH WARNINGS
PR#1a (cd77a20): 3/3 in-scope tasks complete; the 0005 blocker is resolved with live local-stack evidence (session_org_ids → org array, status 200; anon denied 401; create→read→delete round-trip green); committed-file demo 9/9; pnpm lint exit 0 zero warnings; pnpm build exit 0; 400 insertions at budget; zero critical findings; warnings are planned deferrals and record-accuracy notes only.
---

## PR#1b Slice — Gigs UI (commit 0066a2b)

**Change**: hito-2-remainder (PR#1b — committed slice `0066a2b` on `feat/hito-2-remainder-pr1b`, base 052a3e1/PR#1a-lifecycle — clean one-commit diff, working tree has no src changes)
**Version**: N/A (delta spec, no version field)
**Mode**: Standard (strict_tdd: false, no test runner; verify build_command `pnpm build`, lint_command `pnpm lint` — openspec/config.yaml)

Slice scope: tasks 1b.1–1b.4 only (gigs UI + routes). Completion UI (1c.1), played tags (1c.2), offline (2a), storage (2b), preferences (3) are future slices — classified N/A per task ownership in tasks.md, not by UI presence.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total (PR#1b slice: 1b.1–1b.4) | 4 |
| Tasks complete | 4 |
| Tasks incomplete (in slice) | 0 |
| Whole change pending (out of slice) | 1c.1–1c.2, 2a.1–2a.6, 2b.1–2b.2, 3.1–3.6 — all `[ ]`, unchanged |

### Build & Tests Execution

**Build**: ✅ Passed
```text
$ pnpm build
✓ built in 1.91s  (pre-existing chunk-size warning only: "Some chunks are larger than 500 kB")
exit 0
```

**Tests**: ✅ exited 0 (no test framework — config `test_command: ""`; slice harness per tasks.md work-unit 2 = `pnpm build && pnpm lint`; data-layer regression via `demo()` self-check)
```text
$ pnpm lint
$ eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0
exit 0 — 0 errors, 0 warnings

$ node -e "import('./src/lib/gigs.js').then(m=>m.demo())"
gigs demo OK: 26 asserts (flatten, lifecycle, completion, venue, guards)
exit 0 — data layer untouched by this slice, regression clean
```

**Coverage**: ➖ Not available (no coverage tooling; threshold 0 per config)

### Spec Compliance Matrix (retrieved spec: specs/gigs/spec.md; classified per tasks.md ownership — 1b.1–1b.4 own list/create/detail/edit + confirm/cancel/reopen; 1c.1 owns completion; 1c.2 tags; 2a offline. Envelope completed counts 3/22 req, 8/51 scenarios are cumulative across verified slices vs change-wide native 22/51)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Gig creation | Create a gig with venue details and a linked setlist | Gigs.jsx inline `GigForm` (name * / datetime-local * / venue autocomplete / setlist select) → `createGig`; `GigCard` renders name, `formatWhen(scheduledAt)`, venue name; build parses all 5 new JSX files | ✅ COMPLIANT (1b.2) |
| Gig creation | A gig references exactly one setlist at planning time | Single setlist `<select>` in shared `GigForm` (one `setlistId`); edit form re-submits `setlistId` → `updateGig` swap path; demo asserts planned/confirmed gigs editable | ✅ COMPLIANT (1b.2 + 1b.3) |
| Gig creation | The same setlist can serve multiple gigs | Setlist select lists every setlist (no coupling, no uniqueness); `updateGig` scoped `.eq('id', id).eq('owner_id', userId)` touches only the edited gig | ✅ COMPLIANT (1b.2 + 1a) |
| Venue suggestion and reuse | Prior venues are offered as suggestions for reuse | VenueAutocomplete datalist of owner-scoped `listVenues` + "Reuse saved venue" hint via `findVenueByName` (demo-asserted case-insensitive match); submit resolves matched venue id | ✅ COMPLIANT (1b.1) |
| Venue suggestion and reuse | Edit a gig to change its venue | Edit `GigForm` venue autocomplete → `updateGig(id, { venueId })`, id-scoped — change applies only to this gig | ✅ COMPLIANT (1b.3) |
| Gig lifecycle | Confirm a planned gig | GigDetail Confirm button (shown only when `status === 'planned'`) → `confirmGig` → `updateGig({status:'confirmed'})`; demo asserts planned→confirmed valid + `canEditGig('confirmed')` true (editable until completion) | ✅ COMPLIANT (1b.3) |
| Gig lifecycle | Edit a gig before completion, including its setlist | Edit button → shared form (date/venue/setlist) → `updateGig`; completed gigs hide actions (`showActions = gig.status !== 'completed'`); demo asserts completed lock (`canEditGig('completed', {setlistId})` false) | ✅ COMPLIANT (1b.3) |
| Gig lifecycle | Cancel a gig before the show | Cancel button (status ≠ cancelled) → `cancelGig` ('cancelled'); Reopen (status cancelled only) → `reopenGig` ('planned'); cancelled detail states "no performance was recorded"; no-performance guarantee enforced at data layer — only `completeGig` writes performances and `updateGig` rejects `status:'completed'` (demo-asserted) | ✅ COMPLIANT (1b.3) |
| Performance record on completion | Completing a gig writes one performance record | StageMode post-show flow → 1c.1 (detail renders record read-only) | ➖ N/A by slice |
| Performance record on completion | Skipped songs are recorded separately | Write flow → 1c.1 (read display present on detail) | ➖ N/A by slice |
| Performance record on completion | Songs played outside the setlist are recorded separately | Write flow → 1c.1 | ➖ N/A by slice |
| Performance record on completion | Post-show flow writes the gig's performance record | StageMode → 1c.1 | ➖ N/A by slice |
| Played tags and demand counts | Played songs get "played at" tags and demand counts | songs.js/SongDetail → 1c.2 | ➖ N/A by slice |
| Notifications data source | The gig record provides date, time, and location for reminders | Data-layer contract → 1a (no 1b task) | ➖ N/A by slice |
| Offline gig operations | Create, edit, and complete a gig offline | queue/outbox → 2a.6 | ➖ N/A by slice |

**Compliance summary**: 8/15 gigs-spec scenarios COMPLIANT at cumulative slice scope (this slice completes 8: creation 3, venue 2, lifecycle 3); 0 PARTIAL, 0 FAILING, 7 N/A by this slice (completion 4 → 1c.1, tags 1 → 1c.2, notifications 1 → 1a, offline 1 → 2a). Requirements fully verified in-slice: Gig creation, Venue suggestion and reuse, Gig lifecycle → 3/22 cumulative (gigs 3 of 7 fully green; remaining gigs req: performance record, played tags, notifications, offline → later slices).

### Correctness (Static Evidence)
| Check | Status | Notes |
|-------|--------|-------|
| Data-contract mapping (launch check 5) | ✅ Implemented | Every UI call resolves to an existing `src/lib/gigs.js` export: `listGigs`, `listVenues`, `createGig`, `updateGig`, `deleteGig`, `getGig`, `createVenue`, `confirmGig`, `cancelGig`, `reopenGig`, `findVenueByName`; unexported internal `fetchGigById` backs `getGig`; `gig.performance.items[].songId` matches `flattenPerformance` shape; **no import mismatch found** |
| Routes + auth guard (launch check 4) | ✅ Implemented | `{ path: '/gigs', element: <Gigs /> }` (App.jsx L31) + `{ path: '/gigs/:id', element: <GigDetail /> }` (L32) inside `<RequireAuth />` children (L23) — identical guard structure to `/songs`, `/setlists`: `useAuth()` → `<Navigate to="/auth" state={{ from: location }} replace />` when signed out, `<Outlet />` when authed |
| Nav (1b.4) | ✅ Implemented | `{ to: '/gigs', label: 'Gigs' }` present in AppLayout nav |
| Status display/transition mapping (launch check 6) | ✅ Implemented | `GIG_STATUS_STYLES` covers planned/confirmed/cancelled/completed; `StatusBadge` renders current status; per-status action buttons (Confirm planned / Reopen cancelled / Cancel non-cancelled) |
| Direct completion NOT wired (1c boundary) | ✅ Implemented | No `completeGig` call and no `updateGig({status:'completed'})` anywhere in UI/hook (grep of pages + components + hook: only read-side `status === 'completed'` display guards); data layer rejects direct completion (`updateGig` throws `Invalid gig status transition.`, demo-asserted) — completion stays 1c.1 |
| Shared form dedupe | ✅ Implemented | `GigForm.jsx` shared by Gigs (create) + GigDetail (edit) via `initial`/`submitLabel` props; lives under `src/components/gigs/` per repo `components/<domain>/` convention (apply-progress recorded deviation from design's `src/components/` root) |
| Client validation | ✅ Implemented | `GigForm` inline errors for missing name / missing date-time; submit disabled while saving |
| Detail read path | ✅ Implemented | `getGig` → DETAIL_SELECT embeds `performances(*, performance_items(*))`; completed gigs render played/skipped/off_setlist item lists read-only; cancelled shows reopen guidance |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D8 PR slicing: #1b = `Gigs.jsx`, `GigDetail.jsx`, `GigCard.jsx`, `VenueAutocomplete.jsx`, App routes, nav (~380) | ✅ Yes | All six design-listed files land in `0066a2b`; `GigForm.jsx` added as shared create/edit (dedupe mandate, recorded); component paths under `src/components/gigs/` (repo convention) — path-level deviation only, no behavior impact |
| 400-line review budget | ✅ Yes | `git diff --stat 052a3e1` → 8 files, 367 insertions(+), 4 deletions(−) = **371 changed lines ≤ 400** (forecast 380; expected 371 confirmed; clean one-commit diff) |
| Lifecycle UI split (1b vs 1c) | ✅ Yes | Confirm/Cancel/Reopen/Edit wired in 1b.3 exactly as tasks.md assigns; completion entry deliberately absent (1c.1); detail page renders performance read-only when completed |
| Data layer untouched by UI slice | ✅ Yes | `lib/gigs.js` / `useGigs.js` not in the diff; demo 26/26 regression-clean |
| Error-handling conventions | ✅ Yes | Form + action errors surfaced inline (`text-cem-rose`); data-layer USER_ERRORS pass through `err.message`; `Gig not found.` path shows message + back link |

### Issues Found
**CRITICAL**: None
**WARNING**:
- Interactive click-through E2E (create → list row appears; edit → detail reflects; cancel/reopen round-trip) remains a manual walk item — config `e2e: false`, no browser framework in repo. This run's runtime evidence is compile/parse (build exit 0), lint (exit 0), and the data-contract demo (26/26); UI interaction is static-wiring verified. Classified COMPLIANT per config's verify=build convention (same standard as prior verified slices); a manual pass is recommended before merge.
- Change-level envelope verdict stays `fail`: 1c/2a/2b/3 unverified — correct state until the full change completes; the slice itself is green.
**SUGGESTION**:
- `GigForm` venue field, when the typed venue matches none, creates a name-only venue (`createVenue({ name })` — no location/type inputs on the form). Scenario location/type display works via saved venues; adding optional location/type fields would complete the S4/S5 experience for brand-new venues.
- `useGigs.deleteGig` exists but no UI delete button — fine for this slice; gig deletion is not in any gigs-spec scenario.

### Verdict
PASS WITH WARNINGS
PR#1b (`0066a2b`): 4/4 in-scope tasks complete; `pnpm lint` exit 0 zero warnings; `pnpm build` exit 0 (parses all 5 new JSX files + routes); gigs demo 26/26 exit 0 (no data-layer regression); `/gigs` + `/gigs/:id` auth-guarded identically to songs/setlists; data-contract mapping clean (no import mismatches); status mapping present with NO direct `updateGig({status:'completed'})` wiring (completion remains 1c.1); 371 changed lines ≤ 400 budget; 8/15 gigs scenarios COMPLIANT cumulative, 0 critical. Warnings: manual E2E walk recommended pre-merge; change-level verdict remains fail-pending (1c/2a/2b/3).

## PR#1c Slice — Stage Completion + Played Tags (commit a6029f8)

**Change**: hito-2-remainder (PR#1c — committed slice `a6029f8` on `feat/hito-2-remainder-pr1c`, base 5a5853a/PR#1b — clean one-commit diff, working tree has no src changes)
**Version**: N/A (delta spec, no version field)
**Mode**: Standard (strict_tdd: false, no test runner; verify build_command `pnpm build`, lint_command `pnpm lint` — openspec/config.yaml)

Slice scope: tasks 1c.1–1c.2 only (stage completion + played tags). Offline (2a), storage (2b), preferences (3) are future slices — classified N/A per task ownership in tasks.md, not by UI presence.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total (PR#1c slice: 1c.1–1c.2) | 2 |
| Tasks complete | 2 |
| Tasks incomplete (in slice) | 0 |
| Whole change pending (out of slice) | 2a.1–2a.6, 2b.1–2b.2, 3.1–3.6 — all `[ ]`, unchanged (tasks.md L66–84 verified) |

### Build & Tests Execution

**Build**: ✅ Passed
```text
$ pnpm build
$ vite build
vite v5.4.21 building for production...
✓ 124 modules transformed.
✓ built in 2.14s
(pre-existing warnings only: supabase.js dynamically imported by gigs.js but statically
by useFootPedal/auth/setlists/songs — "dynamic import will not move module into another
chunk"; "Some chunks are larger than 500 kB after minification")
exit 0
```

**Tests**: ✅ exited 0 (no test framework — config `test_command: ""`; slice harness per tasks.md work-unit 3 = `pnpm build`; data-layer regression via `demo()` self-check)
```text
$ pnpm lint
$ eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0
exit 0 — 0 errors, 0 warnings

$ node -e "import('./src/lib/gigs.js').then(m=>m.demo())"
gigs demo OK: 26 asserts (flatten, lifecycle, completion, venue, guards)
exit 0 — data layer untouched by this slice, regression clean

$ node -e "import('./src/lib/songs.js').then(m=>m.demo&&m.demo())"
no demo export in songs.js; plain-node import aborts at src/lib/supabase.js:3
  TypeError: Cannot read properties of undefined (reading 'VITE_SUPABASE_URL')
pre-existing environment limitation, NOT a regression: base 5a5853a songs.js already
statically imported supabase.js at L8, and import.meta.env is Vite-only (undefined in
bare node). listPlayedAt compile correctness is covered by pnpm build (exit 0).
```

**Coverage**: ➖ Not available (no coverage tooling; threshold 0 per config)

### Spec Compliance Matrix (retrieved spec: specs/gigs/spec.md; classified per tasks.md ownership — 1c.1 owns the 4 completion scenarios, 1c.2 owns the played-tags scenario. Envelope completed counts 5/22 req, 13/51 scenarios are cumulative across verified slices vs change-wide native 22/51)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Gig creation | Create a gig with venue details and a linked setlist | Verified PR#1a (live probe createGig-shaped insert) + PR#1b (Gigs.jsx form) | ✅ COMPLIANT |
| Gig creation | A gig references exactly one setlist at planning time | Verified PR#1a/#1b (single FK + one setlist select + swap) | ✅ COMPLIANT |
| Gig creation | The same setlist can serve multiple gigs | Verified PR#1a/#1b (plain FK, owner-scoped updates) | ✅ COMPLIANT |
| Venue suggestion and reuse | Prior venues are offered as suggestions for reuse | Verified PR#1b (VenueAutocomplete + 1a.5 findVenueByName, demo-asserted) | ✅ COMPLIANT |
| Venue suggestion and reuse | Edit a gig to change its venue | Verified PR#1b (GigDetail edit → updateGig venueId, id-scoped) | ✅ COMPLIANT |
| Gig lifecycle | Confirm a planned gig | Verified PR#1b (confirmGig, editable until completion, demo-asserted) | ✅ COMPLIANT |
| Gig lifecycle | Edit a gig before completion, including its setlist | Verified PR#1b (edit form + completed lock demo-asserted) | ✅ COMPLIANT |
| Gig lifecycle | Cancel a gig before the show | Verified PR#1b (cancel/reopen; no-performance guarantee demo-asserted) | ✅ COMPLIANT |
| Performance record on completion | Completing a gig writes one performance record | StageMode "✓ Finish gig" (only when open planned/confirmed gigs, L37–39/L175) → `completeGig(gigId, { performedAt, items })` (L69) → ONE `performances` insert + `performance_items` + status completed (gigs.js L316–338); replay guard: existing-perf check returns without inserting (L299–314); `updateGig` rejects `status:'completed'` (L239, demo-asserted); completion helpers demo 26/26 | ✅ COMPLIANT (1c.1, per config verify=build standard — interactive walk is a manual WARNING item) |
| Performance record on completion | Skipped songs are recorded separately | Panel per-song played/skipped toggle, default played (L45, L347–362); items carry `state: 'skipped'` → validateCompletion PLAY_STATES (gigs.js L142); skipped never surfaces in played tags (1c.2 filter) | ✅ COMPLIANT (1c.1) |
| Performance record on completion | Songs played outside the setlist are recorded separately | Encore repertoire picker → `{ songId, state: 'off_setlist', position: songs.length + i + 1 }` (L67, L368–414); setlist rows untouched (encores are performance_items only — "the setlist is unchanged") | ✅ COMPLIANT (1c.1) |
| Performance record on completion | Post-show flow writes the gig's performance record | Post-show flow → `completeGig` (the same entity the gig owns) → `navigate(/gigs/${gigId})` (L70); gig picker when a setlist serves >1 open gig (L322–337) | ✅ COMPLIANT (1c.1) |
| Played tags and demand counts | Played songs get "played at" tags and demand counts | `listPlayedAt` `.in('state', ['played','off_setlist'])` — skipped strictly excluded (songs.js L221); embed `performances(gig_id, performed_at, gigs(name))`, newest-first sort (L232); SongDetail "Played at · demand N", demand = tags length (L183), tags `Link to={/gigs/${p.gigId}}` (L189), offline-tolerant `.catch(() => setPlayedAt([]))` (L59) | ✅ COMPLIANT (1c.2) |
| Notifications data source | The gig record provides date, time, and location for reminders | Data-layer contract → 1a (no slice task) | ➖ N/A by slice |
| Offline gig operations | Create, edit, and complete a gig offline | queue/outbox/completeGig op → 2a.6 | ➖ N/A by slice |

**Compliance summary**: 13/15 gigs-spec scenarios COMPLIANT cumulative (this slice completes 5: completion 4 + tags 1); 0 PARTIAL, 0 FAILING, 2 N/A (notifications → 1a data contract, offline → 2a). Requirements fully verified to date: Gig creation, Venue suggestion and reuse, Gig lifecycle, Performance record on completion, Played tags and demand counts → 5/22 cumulative (gigs 5/7; notifications + offline remain → 2a/later slices).

### Correctness (Static Evidence)
| Check | Status | Notes |
|-------|--------|-------|
| Completion routes ONLY through completeGig (launch check 5) | ✅ Implemented | StageMode contains no `updateGig` call; the only completion mutation is `await completeGig(gigId, { performedAt, items })` (StageMode L69). Data layer enforces the same boundary: `updateGig` throws `Invalid gig status transition.` on `status:'completed'` (gigs.js L239, demo-asserted). PR#1b's no-direct-completion guarantee holds. |
| Items shape `{songId, state, position}` (launch check 5) | ✅ Implemented | Setlist songs: `{ songId: s.id, state: states[s.id] || 'played', position: i + 1 }`; encores: `{ songId, state: 'off_setlist', position: songs.length + i + 1 }` (L65–68). `validateCompletion` maps to `{song_id, version_id: null, state, position}` and rejects unknown states/empty items (gigs.js L137–154, PLAY_STATES = played|skipped|off_setlist) |
| Single performances row — idempotent replay guard (launch check 5) | ✅ Implemented | `completeGig` first checks `performances` for the gig: `.select('id').eq('gig_id', gigId).maybeSingle()`; if present → heals gig status to completed when lagging and returns WITHOUT inserting (gigs.js L299–314); else one `performances` insert (`{gig_id, venue_id: current.venueId, performed_at}`) → `performance_items` rows → gig status completed (L316–338). Exactly one record, never duplicated on replay. |
| Open-gig gating + gig picker | ✅ Implemented | "✓ Finish gig" disabled unless `openGigs.length` (planned/confirmed gigs for THIS setlist, L37–39); gig `<select>` rendered when >1 open gig (L322–337); Esc closes the panel before leaving stage (L101–102); submit guarded `!gigId` (L431) |
| listPlayedAt filter/exclusion/order (launch check 6) | ✅ Implemented | `.in('state', ['played', 'off_setlist'])` — `skipped` strictly excluded from the query; demand count = result length (SongDetail L183); newest-first performed sort (L232) |
| SongDetail tags link /gigs/:id + offline tolerance (launch check 6) | ✅ Implemented | `Link to={/gigs/${p.gigId}}` rendering gigName + performed date (L186–194); effect `.catch(() => setPlayedAt([]))` — any failure (offline/network/server) renders zero tags, never a crash (L55–62) |
| Hook wrappers | ✅ Implemented | `useSongs.getPlayedAt(id)` → `songs.listPlayedAt(user.id, id)` (useSongs L58–60); `useGigs.completeGig(id, payload)` → `gigs.completeGig` + optimistic list replace (useGigs L60–64); `useGigs` return surface gained `completeGig` (task 1a.3 deferral closed) |
| App.jsx / routes untouched (launch check) | ✅ Implemented | `/songs/:id/practice` and `/gigs/:id` (PR#1b) routes unchanged — App.jsx absent from the slice diff (verified 6-file diff: tasks.md, useGigs.js, useSongs.js, songs.js, SongDetail.jsx, StageMode.jsx) |
| Commit size within budget (launch check 7) | ✅ Implemented | `git diff --stat 5a5853a` → 6 files, **291 insertions(+), 15 deletions(−) = 306 changed lines ≤ 400** (no `size:exception` needed) |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D8 slicing: #1c = StageMode completion entry, played-tags + demand (songs.js/SongDetail) ~200 | ✅ Yes | All four D8 touch points land (`StageMode.jsx`, `songs.js`, `SongDetail.jsx` + the `useGigs`/`useSongs` wrappers tasks.md assigned); actual 306 changed lines still within the 400 cap |
| Completion entry lives inside StageMode (design data flow) | ✅ Yes | "✓ Finish gig" in `/setlists/:id/stage`; no new route; post-completion navigates to `/gigs/:id` — exactly the design's `StageMode → completeGig` flow |
| One performance record per completed gig (spec + D6 replay safety) | ✅ Yes | Existing-perf replay guard in `completeGig` is the write-side enforcement; the guard predates 2a's queue replay (1a.4) and remains the single-record invariant |
| Played-tags data flow (spec tags requirement) | ✅ Yes | Derived read on `performance_items` → SongDetail demand + tags; skipped excluded per spec "no tag exists for any skipped song"; deliberately NOT read-through cached (stale-tag avoidance, IDB lands 2a) — documented ponytail comment |
| Data layer untouched by UI slice | ✅ Yes | `lib/gigs.js` not in the diff; demo 26/26 regression-clean |

### Issues Found
**CRITICAL**: None
**WARNING**:
- Interactive post-show E2E (Finish gig → played/skipped → add encore → Complete gig → /gigs/:id renders the record) remains a manual walk item — config `e2e: false`, no browser framework in repo. This run's runtime evidence is compile/parse (build exit 0, 124 modules), lint (exit 0), and the data-layer demo (26/26); UI interaction is static-wiring verified. Classified COMPLIANT per config's verify=build convention (same standard as prior verified slices); a manual pass is recommended before merge.
- Change-level envelope verdict stays `fail`: 2a/2b/3 unverified — correct state until the full change completes; the slice itself is green.
**SUGGESTION**:
- Slice actual 306 changed lines vs D8 forecast ~200 (153% of forecast, 77% of the 400 cap). Reviewer load still within budget; 2a/2b should watch the remaining slack.
- `listPlayedAt` failures (offline OR server) collapse to "no tags" at the UI boundary (`catch → []`) — correct for the offline-tolerant contract, but a transient server error is indistinguishable from "never played". Acceptable today (deliberate fresh-read design, songs.js L211–214 comment); a later slice could differentiate error vs empty.
- `getPlayedAt` is mounted unconditionally on SongDetail (extra query per song view); harmless at this scale, and the requested demand feed — keep if analytics grow.

### Verdict
PASS WITH WARNINGS
PR#1c (`a6029f8`): 2/2 in-scope tasks complete; completion path routes ONLY through `completeGig` (no `updateGig` completed bypass — data-layer reject demo-asserted); items `{songId, state played|skipped|off_setlist, position}`; single performances row with idempotent replay guard in gigs.js; `listPlayedAt` excludes skipped, newest first, demand = tags length; SongDetail tags link `/gigs/:id` with offline-tolerant catch→[]; App.jsx untouched; `pnpm lint` exit 0 zero warnings; `pnpm build` exit 0 (124 modules); gigs demo 26/26 exit 0; 306 changed lines ≤ 400 budget; 13/15 gigs scenarios COMPLIANT cumulative (5/7 requirements), 0 critical. Warnings: manual post-show E2E walk recommended pre-merge; change-level verdict remains fail-pending (2a/2b/3).## PR#2a Slice — SW Pipeline + IDB v3 + Queue Ops (commits 4ba443d + 2d6ad36)

**Change**: hito-2-remainder (PR#2a — two conventional commits on `feat/hito-2-remainder-pr2a`, base 9a3df0c/PR#1c: `4ba443d` PR#2a-SW, `2d6ad36` PR#2a-queue — clean two-commit diff, working tree has no src changes)
**Version**: N/A (delta spec, no version field)
**Mode**: Standard (strict_tdd: false, no test runner; verify build_command `pnpm build`, lint_command `pnpm lint` — openspec/config.yaml)

Slice scope: tasks 2a.1–2a.6 only (SW versioned pipeline + IDB v3 lockstep + once-per-session prompt, queue gig ops). 2b (storage screen — 2b.1–2b.2) and 3 (preferences) are future slices — classified N/A per task ownership in tasks.md, not by code presence (storage.js policy + exemption guard ships in 2a-SW as the tested foundation the 2b screen builds on).

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total (PR#2a slice: 2a.1–2a.6) | 6 |
| Tasks complete | 6 |
| Tasks incomplete (in slice) | 0 |
| Whole change pending (out of slice) | 2b.1–2b.2, 3.1–3.6 — all `[ ]`, unchanged (tasks.md L75–85 verified) |

### Verification Checks (in-order, exact observed output)
| # | Check | Observed result |
|---|-------|-----------------|
| 1 | `pnpm lint` | `$ eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0`, exit 0, 0 errors 0 warnings |
| 2 | `pnpm build` | `✓ built in 1.83s`, exit 0 (pre-existing warning only: "Some chunks are larger than 500 kB"; supabase dynamic-import warning unchanged) |
| 3 | `node -e "import('./src/lib/gigs.js').then(m=>m.demo())"` | `gigs demo OK: 26 asserts (flatten, lifecycle, completion, venue, guards)`, exit 0 (2a.6 regression clean) |
| 4 | `node -e "import('./src/lib/storage.js').then(m=>m.demo&&m.demo())"` | `storage demo OK: 13 asserts (activate cleanup, eviction order + exemption)`, exit 0 (2a.3 RED) |
| 5 | `node -e "import('./src/lib/offlineCache.js').then(m=>m.demo&&m.demo())"` | `offlineCache demo OK: 6 asserts (v3 additive upgrade, kv/outbox preserved)`, exit 0 (2a.1 RED) |
| 6 | SW activation contract (public/sw.js) | No `skipWaiting()` in install/activate — the ONLY skipWaiting path is the user-initiated `SKIP_WAITING` message handler (L102–105); versioned caches `cemurm-{shell|songs|pdf|exports|data}-v2` (L7–9, L17–19); UPDATE_READY broadcast to all clients on install (L73–79); NO `clients.claim()` (L98–99) |
| 7 | Prompt-once contract (updateManager.js) | sessionStorage guard `cemurm:update-dismissed` (L6, L37, L46); DEFERRED_ROUTES includes `/setlists/:id/stage` + `/songs/:id/practice` (L9); silent offline retry `.catch(() => {})` (L31) + storage-unavailable guard (L39–41); waiting-SW recovery prompt (L29); PROD-only register in main.jsx (L35) |
| 8 | IDB lockstep (offlineCache.js + offlineQueue.js) | `DB_VERSION = 3` exported (L15); `applyUpgrade` exported (L23–27) — additive `<1 kv → <2 outbox → <3 cache-meta` ({bytes,savedAt}), never drops stores; offlineQueue.js L11 `import { DB_VERSION, applyUpgrade } from './offlineCache.js'` — lockstep by construction; demo asserts v3 open creates nothing (L144) |
| 9 | Storage exemption (storage.js) | `isUserAuthoredKvEntry` (L46–50): `pending:` keys + kv `pendingSync`/`data.pendingSync` values → exempt, demo-asserted (L75–81); outbox keys are `pending:${userId}` (offlineQueue L40–42) so never eviction candidates; 4 user-facing categories present in the 5-entry CACHE_CATEGORIES (songs→Songs, pdf→PDF scans, exports→Exports, data→Setlists and gigs; shell = app shell); EVICTION_ORDER `pdf,exports` (L12) |
| 10 | WRITE_OPS (offlineSync.js) | Whitelist L19–21 `createGig/updateGig/completeGig` → `gigs.createGig/updateGig/completeGig` (all real exports of gigs.js); unknown op warn+drop (L47–50); failure → break keeps FIFO order (L55–58). Enqueue call sites: createGig gigs.js L229–232 (+ optimistic `pendingSync` L246), updateGig L329 (+ L274), completeGig L416 (+ L429). completeGig replay-safe: existence check gigs.js L370–374 (`select('id').eq('gig_id', gigId).maybeSingle()`), L375 `if (existing)` heals status + returns WITHOUT inserting — exactly one performance, never a duplicate |
| 11 | Budget (≤400 each) | `git diff --stat 9a3df0c 4ba443d`: 7 files, **332 insertions(+), 58 deletions(−) = 390 changed** (code-only 380: sw.js 140, offlineCache.js 71, offlineQueue.js 21, storage.js 84, updateManager.js 51, main.jsx 13; tasks.md 10) ≤ 400 ✓ — matches expected 380 code. `git diff --stat 4ba443d 2d6ad36`: 3 files, **174 insertions(+), 76 deletions(−) = 250 changed** ≤ 400 ✓ — matches expected 174/76 exactly |
| 12 | tasks.md | 2a.1–2a.6 `[x]`; 2b.1–2b.2 `[ ]`; 3.1–3.6 `[ ]` (grep-verified) |

### Build & Tests Execution

**Build**: ✅ Passed
```text
$ pnpm build
✓ built in 1.83s  (pre-existing chunk-size warning only: "Some chunks are larger than 500 kB")
exit 0
```

**Tests**: ✅ exited 0 (no test framework — config `test_command: ""`; slice harness per tasks.md work-unit 4 = node demos + `pnpm build`; regression via gigs demo)
```text
$ pnpm lint
$ eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0
exit 0 — 0 errors, 0 warnings

$ node -e "import('./src/lib/gigs.js').then(m=>m.demo())"
gigs demo OK: 26 asserts (flatten, lifecycle, completion, venue, guards)
exit 0

$ node -e "import('./src/lib/storage.js').then(m=>m.demo&&m.demo())"
storage demo OK: 13 asserts (activate cleanup, eviction order + exemption)
exit 0

$ node -e "import('./src/lib/offlineCache.js').then(m=>m.demo&&m.demo())"
offlineCache demo OK: 6 asserts (v3 additive upgrade, kv/outbox preserved)
exit 0
```

**Coverage**: ➖ Not available (no coverage tooling; threshold 0 per config)

### Spec Compliance Matrix (retrieved spec: specs/pwa-updates-storage/spec.md; classified per tasks.md ownership — 2a.4/2a.5 own SW+prompt scenarios, 2a.6 owns queue scenarios, 2b owns the storage screen. Envelope completed counts 11/22 req, 24/51 scenarios are cumulative across verified slices vs change-wide native 22/51)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Background update with next-load activation | A new app version activates on the next load | sw.js: install precaches shell then broadcasts UPDATE_READY, NO `skipWaiting()` — new SW stays `waiting`, activates on the next natural load (L68–81); activate deletes only foreign/stale caches, keeps current `cemurm-*-v2` (L83–100); storage demo 13/13 asserts `shouldDeleteOnActivate` current-version keep + stale/foreign deletion | ✅ COMPLIANT (2a.4 + 2a.3 RED runtime) |
| Background update with next-load activation | An update never applies mid-session | No `skipWaiting()`/`clients.claim()` in install or activate; the only skipWaiting path is the user-initiated SKIP_WAITING message handler (sw.js L102–105) — no mid-session activation path exists in code (`controllerchange`-until-SKIP_WAITING is the manual browser E2E item, RED 1) | ✅ COMPLIANT (structural; manual E2E WARNING) |
| Once-per-session update prompt | The prompt appears once, and "Later" defers | updateManager.js: `sessionStorage['cemurm:update-dismissed']` getItem guard (L37, survives in-session reloads) + setItem on "Later" (L46); "Update now" → `SKIP_WAITING` + reload (L49–50); waiting-SW recovery for a missed message (L29); registration PROD-only on window load (main.jsx L35) | ✅ COMPLIANT (2a.5; interactive walk = manual WARNING) |
| Live-use deferral | An update is deferred while a live performance is active | `DEFERRED_ROUTES` stage regex `/^\/setlists\/[^/]+\/stage$/` (updateManager L9); `isUpdateDeferred()` checked before any prompt (L38) — Stage never interrupted; activation only after SKIP_WAITING or next natural load | ✅ COMPLIANT (route-regex logic; manual E2E WARNING) |
| Live-use deferral | An update is deferred while a practice session is active | Same guard, practice regex `/^\/songs\/[^/]+\/practice$/` (L9, L38) — session continues uninterrupted | ✅ COMPLIANT (route-regex logic; manual E2E WARNING) |
| Offline write queue survival | Offline write queues survive an app update | offlineCache demo 6/6 runtime: v2→v3 adds cache-meta ONLY, never drops kv/outbox (`applyUpgrade` L23–27; demo asserts fresh/v1/v2/v3 paths L132–145); shared IDB `cemurm-offline` is origin-scoped — SW swap never touches it; queue rows + `pendingSync` survive by construction (D5) | ✅ COMPLIANT (2a.1 RED runtime + D5 invariant) |
| Offline write queue survival | Applying an update never discards the local write queue | Additive-only upgrade creates stores, never drops (L23–27); FIFO preserved in `enqueueOp` `[...ops, {seq, ...op, queuedAt}]` (offlineQueue L70–73); `pending:` outbox keys + pendingSync kv values exempt from eviction (storage.js L46–50, demo-asserted); flags clear only on successful drain `removeOps` (offlineQueue L84–104) | ✅ COMPLIANT (runtime assert + source) |
| Offline and failure resilience | An update check with no connectivity is silent | register `.catch(() => {})` — no dialog/toast/notification; browser retries on the next natural start; storage-unavailable guard returns silent (updateManager L31, L39–41) | ✅ COMPLIANT (silent-failure path; manual offline E2E WARNING) |
| Offline and failure resilience | A failed update download leaves the current version working | Navigation: network-first with `caches.match('/index.html')` fallback (sw.js L114–127); assets: cache-first, cached copy served when fetch fails (L131–145); a failed install never deletes the prior SW/caches (activate cleanup runs only on successful activation) | ✅ COMPLIANT (structural; manual E2E WARNING) |
| Offline and failure resilience | A failed update activation never breaks the running app | No `clients.claim()` — old SW keeps controlling current tabs; failed activation leaves the old version serving (L98–99, browser semantics); activation cleanup touches cache storage only; IDB/outbox untouched (`metaRemove` best-effort) | ✅ COMPLIANT (structural; manual E2E WARNING) |
| Storage usage visibility | The storage screen shows usage broken down by category | Storage screen + route → 2b.1 | ➖ N/A by slice (2b) |
| Storage usage visibility | Clearing a cache category never deletes the user's data | Category-clear UI → 2b.1 (exemption guard foundation ships + demo-asserted here) | ➖ N/A by slice (2b) |
| Quota pressure and eviction | Near-quota storage triggers a warning and a one-tap cleanup | Warning + one-tap cleanup UI → 2b.2 | ➖ N/A by slice (2b) |
| Quota pressure and eviction | Eviction removes bulk derived caches and never user-authored data | Eviction ORDER + exemption predicate land in 2a-SW (EVICTION_ORDER `pdf,exports`; `isUserAuthoredKvEntry`; storage demo 13/13) but live eviction + storage screen → 2b.2 | ➖ N/A by slice (2b; foundation verified) |
| Quota pressure and eviction | Low storage degrades gracefully without breaking live use | Critically-low survival (shell + active setlist) → 2b.2; shell/songs/data never auto-evictable already demo-asserted | ➖ N/A by slice (2b; foundation verified) |

**Compliance summary**: 10/15 pwa-updates-storage scenarios COMPLIANT at 2a slice scope (req 1: 2/2, req 2: 1/1, req 3: 2/2, req 4: 2/2, req 5: 3/3 — exactly the 2a-owned scenarios); 0 PARTIAL, 0 FAILING, 5 N/A by slice (2b owns storage screen + quota/eviction). Cumulative across verified slices: **24/51 scenarios, 11/22 requirements** (pwa-updates-storage 5/7 req; gigs 6/7 — this slice also closes the gigs "Offline gig operations" scenario via 2a.6; prefs 0/6, row-level-security + remaining pwa/gigs req → later slices). Change-level envelope verdict stays `fail`: 2b + 3 unverified — correct state until the full change completes; the slice itself is green.

### Correctness (Static Evidence)
| Check | Status | Notes |
|-------|--------|-------|
| SW: no skipWaiting/claim at install/activate; user-initiated SKIP_WAITING only (check 6) | ✅ Implemented | install (L68–81) + activate (L83–100) contain no skipWaiting; `clients.claim()` absent (comment L98–99); message handler L102–105 is the only skipWaiting caller — triggered solely by the app prompt |
| SW: versioned caches `cemurm-*-v2` + UPDATE_READY + cache-meta (check 6) | ✅ Implemented | VERSION='2' (L7); `cemurm-{shell|songs|pdf|exports|data}-v2` (L9, L17–19); UPDATE_READY to all clients on install (L78); metaAdd/metaRemove on put/delete (L122–123, L141–142, L94) with versionless best-effort IDB open (L23–31) — never drifts against client v3 |
| Prompt-once: sessionStorage + deferral routes + silent offline (check 7) | ✅ Implemented | PROMPT_KEY `cemurm:update-dismissed` (L6); getItem before prompt (L37) + setItem on Later (L46) — once per session, suppressed until tab close (natural start); DEFERRED_ROUTES both regexes (L9); `.catch(() => {})` silent (L31) |
| IDB lockstep: DB_VERSION=3, applyUpgrade exported, offlineQueue imports it, additive-only (check 8) | ✅ Implemented | offlineCache L15/L23–27; offlineQueue L11 import — lockstep by construction (drift → VersionError); upgrade only ever creates (`<1 kv → <2 outbox → <3 cache-meta`); demo 6/6 runtime-asserted per oldVersion path |
| Storage policy: 4 categories + exemption guard (check 9) | ✅ Implemented | CACHE_CATEGORIES = shell/songs/pdf/exports/data (L8); songs/pdf/exports/data = the spec's four user-facing categories mapping; outbox `pending:` keys exempt by `isUserAuthoredKvEntry` key prefix (L48) + kv `pendingSync` values (L49); demo-asserted 13/13 |
| WRITE_OPS + gig enqueue call sites + replay-safe completeGig (check 10) | ✅ Implemented | offlineSync L19–21 mappings resolve to real exports; gigs.js enqueue at L229 (createGig), L329 (updateGig), L416 (completeGig); unknown op warn+drop (L47–50); completeGig existence check gigs.js L370–374 + `if (existing)` no-insert return L375–385; updateGig rejects `status:'completed'` (L297, demo-asserted L578) — completion only via replay-safe completeGig |
| PROD-only registration + boot-guarded sync (grounding) | ✅ Implemented | updateManager `!import.meta.env.PROD` return (L16) + window-load register (L18); main.jsx L23–30 try/catch sync setup (never breaks boot); `startOfflineSync()` + drain on session restore (main.jsx L24–27) |
| Commit sizes within budget (check 11) | ✅ Implemented | 4ba443d 390 changed (332+/58−, code-only 380) ≤ 400; 2d6ad36 250 changed (174+/76−) ≤ 400 — both match launch expectations exactly |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D3 SW update pipeline: versioned caches + waiting SW, no skipWaiting/claim, UPDATE_READY, once-per-session prompt | ✅ Yes | sw.js + updateManager.js implement D3 byte-for-byte in intent: install→waiting→UPDATE_READY→prompt (sessionStorage) →SKIP_WAITING+reload; next natural load activates; no mid-session swap path |
| D5 IDB lockstep v3: single applyUpgrade, additive `<1 kv → <2 outbox → <3 cache-meta`, never drops | ✅ Yes | `applyUpgrade` in offlineCache.js imported by offlineQueue.js (L11) — same open version + same plan, lockstep by construction; demo proves additive + no-drop; cache-meta `{bytes, savedAt}` feeds the 2b storage screen + eviction age |
| D4 storage categories + eviction exemption (foundation slice) | ✅ Yes | One SW cache per category with per-category names (cacheFor L15–19); EVICTION_ORDER `pdf,exports` = "oldest PDF scans/exports first"; user-authored (outbox `pending:` + kv pendingSync) never eviction candidates — the exact D4 exempt set; progressive 2b builds the screen on these predicates |
| D6 offline gig ops (WRITE_OPS + replay-safe completeGig) | ✅ Yes | createGig/updateGig/completeGig whitelisted and enqueued with FIFO per-user ordering (same array as setlist ops — interleave in creation order); completeGig composite op replay-safe via existing-performance check; unknown op warn+drop kept |
| D8 PR slicing: #2a = IDB v3 + SW pipeline + queue ops ~380 | ✅ Yes | Both planned filesets land (sw.js, offlineCache.js, offlineQueue.js, storage.js, updateManager.js, main.jsx, gigs.js, offlineSync.js); design's two-slice split (2a-SW 380 code / 2a-queue 250) matches delivered commit boundaries exactly; storage.js/updateManager.js export node-testable demos (repo pattern) — no design deviation |
| Design file-changes table | ✅ Yes | Every modified/created file in the design table for this scope is present in the two commits; no extra src files beyond the table (gigs.js 241-line diff = 2a.6 enqueue/optimistic additions, the design's declared queue layer) |

### Issues Found
**CRITICAL**: None
**WARNING**:
- Interactive browser E2E remains manual (config `e2e: false`, no browser framework): update-activates-next-load, once-per-session prompt click-through, Stage/Practice deferral, offline silent check, offline enqueue → reconnect drain → flags clear. This run's runtime evidence is node demos (26/13/6 asserts, exit 0) + lint/build exit 0 + structural source inspection — classified COMPLIANT per config's verify=build convention (same standard as prior verified slices); a manual browser pass is recommended before merge.
- tasks.md 2a.3 names "no `controllerchange` until SKIP_WAITING/next load" — the delivered RED demo (storage.js 13 asserts) covers activate cleanup (RED 2) + eviction exemption; the `controllerchange` observation (RED 1) is browser-only and covered by the manual E2E item above. Accuracy note, not a gap: no browser runner exists in the repo.
- Change-level envelope verdict stays `fail`: 2b + 3 unverified — correct state until the full change completes; the slice itself is green.
**SUGGESTION**:
- `cache-meta` writes in sw.js use `Date.now()` per put, so `savedAt` = last-touch time; 2b eviction-by-age will need the oldest-first record per category entry (per-blob meta or first-seen timestamp) — the store shape (`{bytes, savedAt}` per cache name) is in place; decide granularity in 2b.
- updateManager uses `window.confirm` (ponytail comment) — replace with the styled banner when 2b's storage screen lands, per the comment's own upgrade path.
- Two conventional commits on one branch: merge into main (or the tracker branch) preserves commit history for the chained-PR chain; keep `4ba443d` and `2d6ad36` separate when opening the PR.

### Verdict
PASS WITH WARNINGS
PR#2a (`4ba443d` + `2d6ad36`): 6/6 in-scope tasks complete (2a.1–2a.6); `pnpm lint` exit 0 zero warnings; `pnpm build` exit 0; demos exit 0 (gigs 26, storage 13, offlineCache 6 — RED evidence runtime green); SW contract clean (no skipWaiting/claim mid-session, `cemurm-*-v2` versioned caches, UPDATE_READY, cache-meta on put/delete); prompt-once contract complete (sessionStorage guard, both deferral routes, silent offline); IDB v3 lockstep by construction (single `applyUpgrade` imported by both modules, additive-only); storage exemption guard demo-asserted; WRITE_OPS maps all three gig ops with replay-safe completeGig (existence check gigs.js L370–385); budgets: SW 390 (code 380) ≤ 400, queue 250 (174+/76−) ≤ 400; 10/15 pwa scenarios compliant in-slice (+1 gigs offline scenario → cumulative 24/51 scenarios, 11/22 req), 0 critical. Warnings: manual browser E2E walk recommended pre-merge (RED 1 controllerchange is browser-only); change-level verdict remains fail-pending (2b/3).

## PR#2b Slice — Storage Screen + Eviction (commit 67c055f)

**Change**: hito-2-remainder (PR#2b — committed slice `67c055f` on `feat/hito-2-remainder-pr2b`, base 53816e5/PR#2a — clean one-commit diff, no src changes in working tree)
**Version**: N/A (delta spec, no version field)
**Mode**: Standard (strict_tdd: false, no test runner; verify build_command `pnpm build`, lint_command `pnpm lint` — openspec/config.yaml)

Slice scope: tasks 2b.1–2b.2 only (storage screen + quota warning + one-tap eviction). Preferences (3.1–3.6) are the future PR#3 slice — classified N/A per task ownership in tasks.md.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total (PR#2b slice: 2b.1–2b.2) | 2 |
| Tasks complete | 2 |
| Tasks incomplete (in slice) | 0 |
| Whole change pending (out of slice) | 3.1–3.6 — all `[ ]`, unchanged (tasks.md L80–85 verified) |

### Verification Checks (in-order, exact observed output)
| # | Check | Observed result |
|---|-------|-----------------|
| 1 | `pnpm lint` | `$ eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0`, exit 0, 0 errors 0 warnings |
| 2 | `pnpm build` | `✓ built in 2.23s`, exit 0, **127 modules** (Storage.jsx + `/settings/storage` route parse-covered); pre-existing warnings only (supabase.js dynamic-import notice, chunk > 500 kB) |
| 3 | `node -e "import('./src/lib/storage.js').then(m=>m.demo&&m.demo())"` | `storage demo OK: 19 asserts (activate cleanup, eviction order + exemption, planEviction)`, exit 0 (2b.2 RED — planEviction ordering; demo extended 13→19) |
| 4 | `node -e "import('./src/lib/offlineCache.js').then(m=>m.demo&&m.demo())"` | `offlineCache demo OK: 6 asserts (v3 additive upgrade, kv/outbox preserved)`, exit 0 (2a.1 regression clean) |
| 5 | `node -e "import('./src/lib/gigs.js').then(m=>m.demo())"` | `gigs demo OK: 26 asserts (flatten, lifecycle, completion, venue, guards)`, exit 0 (regression clean) |
| 6 | Offline-visible contract (2b.1 S1) | Storage.jsx imports ONLY `react` + `offlineCache.js` + `storage.js` — no supabase, no fetch, no network (grep-verified); `load()` reads `cacheMetaList()` + `caches.keys()` + kv rows by prefix (L79–99); total = sum of the 4 computed categories (L109); all sources offline-native (Cache Storage + IDB) |
| 7 | Per-category clear contract (2b.1 S2) | `clearCategory` (L137–156): `cacheStats` category filter → `deleteCache(s.name)` for EVERY cache name of that category (all `cemurm-{cat}-v*` versions, `parseCacheName`-classified); kv copies filtered by category kvPrefixes then gated by `isUserAuthoredKvEntry` (L146) — `pending:`/`pendingSync` rows survive; underlying songs/setlists/gigs rows untouched (only SW caches + kv read copies deleted) |
| 8 | Quota warning (2b.2 S1) | `nearQuota` (L126–129): `navigator.storage.estimate()` usage/quota > WARN_RATIO 0.9 → warning banner + "Free space" button; insecure-context fallback trackedBytes > WARN_BYTES 50 MB (code-documented) |
| 9 | One-tap cleanup (2b.2 S1–S2) | `planEviction` (storage.js L60–93): only EVICTION_ORDER (`pdf`,`exports`) caches are candidates, sorted order-then-oldest-first by cache-meta `savedAt`, then non-user kv read copies by `savedAt`; early return `freed >= targetBytes` (stops at target; cleanupTarget = 75% of quota); shell/songs/data caches never candidates; `isUserAuthoredKvEntry` filters kv — 19/19 demo asserts (pdf-before-exports regardless of age, pending key never, shell/songs never, stop-at-target) |
| 10 | Budget (≤400) | `git diff --stat 53816e5 -- src/pages/Storage.jsx src/lib/storage.js src/lib/offlineCache.js src/App.jsx src/components/layout/AppLayout.jsx`: **5 files, 380 insertions(+), 1 deletion(−) = 381 changed ≤ 400** ✓; full incl. tasks.md: 6 files, **382 insertions(+), 3 deletions(−) = 385 total** — matches expected 385 (Storage.jsx 268, storage.js 76, offlineCache.js 34, App.jsx 2, AppLayout.jsx 1, tasks.md 4) |
| 11 | Route + nav (2b.1) | App.jsx L34 `{ path: '/settings/storage', element: <Storage /> }` inside `RequireAuth` (L24) — identical guard structure to songs/setlists/gigs; AppLayout.jsx L9 `{ to: '/settings/storage', label: 'Storage' }` nav |
| 12 | tasks.md | 2b.1–2b.2 `[x]` (L75–76); 3.1–3.6 `[ ]` (L80–85) — 25 `[x]` / 6 `[ ]` (grep-verified) |

### Build & Tests Execution

**Build**: ✅ Passed
```text
$ pnpm build
✓ built in 2.23s — 127 modules transformed (Storage.jsx + route parsed)
(pre-existing warnings only: "src/lib/supabase.js is dynamically imported by gigs.js but
 statically imported by useFootPedal/auth/setlists/songs…"; "Some chunks are larger than
 500 kB after minification")
exit 0
```

**Tests**: ✅ exited 0 (no test framework — config `test_command: ""`; slice harness per tasks.md work-unit 5 = `pnpm build`; RED = storage demo planEviction; regressions = offlineCache + gigs demos)
```text
$ pnpm lint
$ eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0
exit 0 — 0 errors, 0 warnings

$ node -e "import('./src/lib/storage.js').then(m=>m.demo&&m.demo())"
storage demo OK: 19 asserts (activate cleanup, eviction order + exemption, planEviction)
exit 0

$ node -e "import('./src/lib/offlineCache.js').then(m=>m.demo&&m.demo())"
offlineCache demo OK: 6 asserts (v3 additive upgrade, kv/outbox preserved)
exit 0

$ node -e "import('./src/lib/gigs.js').then(m=>m.demo())"
gigs demo OK: 26 asserts (flatten, lifecycle, completion, venue, guards)
exit 0
```

**Coverage**: ➖ Not available (no coverage tooling; threshold 0 per config)

### Spec Compliance Matrix (retrieved spec: specs/pwa-updates-storage/spec.md; classified per tasks.md ownership — 2b.1 owns the 2 storage-screen scenarios, 2b.2 owns the 3 quota/eviction scenarios; the 10 update/prompt/queue/resilience scenarios were 2a-owned and verified 2026-09-14 prior run. Envelope completed counts 13/22 req, 29/51 scenarios are cumulative across verified slices vs change-wide native 22/51)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Background update with next-load activation | A new app version activates on the next load | Verified PR#2a (sw.js no skipWaiting on install; waits for next natural load; storage demo 13/13 activate cleanup) | ✅ COMPLIANT (prior slice) |
| Background update with next-load activation | An update never applies mid-session | Verified PR#2a (no skipWaiting/claim; only user-initiated SKIP_WAITING) | ✅ COMPLIANT (prior slice) |
| Once-per-session update prompt | The prompt appears once, and "Later" defers | Verified PR#2a (sessionStorage guard, SKIP_WAITING + reload) | ✅ COMPLIANT (prior slice) |
| Live-use deferral | An update is deferred while a live performance is active | Verified PR#2a (DEFERRED_ROUTES stage regex) | ✅ COMPLIANT (prior slice) |
| Live-use deferral | An update is deferred while a practice session is active | Verified PR#2a (DEFERRED_ROUTES practice regex) | ✅ COMPLIANT (prior slice) |
| Offline write queue survival | Offline write queues survive an app update | Verified PR#2a (offlineCache demo 6/6 additive v3, kv/outbox preserved) | ✅ COMPLIANT (prior slice) |
| Offline write queue survival | Applying an update never discards the local write queue | Verified PR#2a (additive-only upgrade, FIFO preserved, exemption) | ✅ COMPLIANT (prior slice) |
| Offline and failure resilience | An update check with no connectivity is silent | Verified PR#2a (register `.catch(() => {})`, retry next natural start) | ✅ COMPLIANT (prior slice) |
| Offline and failure resilience | A failed update download leaves the current version working | Verified PR#2a (network-first nav + cache-first assets) | ✅ COMPLIANT (prior slice) |
| Offline and failure resilience | A failed update activation never breaks the running app | Verified PR#2a (no clients.claim(); old SW keeps serving) | ✅ COMPLIANT (prior slice) |
| Storage usage visibility | The storage screen shows usage broken down by category | Storage.jsx `load()`: `caches.keys()` + `cacheMetaList()` + kv rows by prefix → 4 rows (Songs / PDF scans / Exports / Setlists and gigs) + Total; offline-visible (no network — check 6); 4-category mapping = CACHE_CATEGORIES songs/pdf/exports/data; read-copy prefixes verified against songs.js (`songs:`/`song:`, L44–45), setlists.js (`setlists:`/`setlist:`, L55–56), gigs.js (`gig:`, L248/276/431) | ✅ COMPLIANT (2b.1; per config verify=build convention — interactive walk = manual E2E WARNING) |
| Storage usage visibility | Clearing a cache category never deletes the user's data | `clearCategory`: per-category cache filter → `caches.delete` every `cemurm-{cat}-v*` + `cacheMetaRemove`; kv copies filtered by category prefixes + `isUserAuthoredKvEntry` skip (L146) — `pending:`/`pendingSync` never deleted; underlying rows untouched; exemption demo-asserted 19/19 | ✅ COMPLIANT (2b.1) |
| Quota pressure and eviction | Near-quota storage triggers a warning and a one-tap cleanup | WARN_RATIO 0.9 on `navigator.storage.estimate()` (fallback 50 MB tracked bytes) → amber warning + "Free space" → `planEviction` to `cleanupTarget` (75% of quota) → `load()` recomputes fresh stats → warning clears once freed space suffices | ✅ COMPLIANT (2b.2) |
| Quota pressure and eviction | Eviction removes bulk derived caches and never user-authored data | `planEviction`: PDF scans → Exports (EVICTION_ORDER), oldest-first by cache-meta `savedAt`, then remaining derived (non-user kv read copies) by age; shell/songs/data caches + `pending:`/`pendingSync` kv never candidates — 19/19 runtime asserts (storage demo, 2b.2 RED) | ✅ COMPLIANT (2b.2 RED runtime) |
| Quota pressure and eviction | Low storage degrades gracefully without breaking live use | Shell + songs/data SW caches sit outside EVICTION_ORDER — never removed by cleanup or eviction (only pdf/exports caches + non-user kv read copies are candidates); kv eviction is oldest-first by `savedAt` (= least-recently-touched), so an actively used setlist's read copy is evicted last; user-authored kv exempt — app shell + Live Performance + active setlist survive by construction (`isEvictableCategory` demo asserts shell/songs/data false) | ✅ COMPLIANT (2b.2, structural) |

**Compliance summary**: 15/15 pwa-updates-storage scenarios COMPLIANT cumulative (this slice completes 5: storage screen 2 + quota/eviction 3 — exactly the 2b-owned scenarios); 0 PARTIAL, 0 FAILING, 0 N/A in-slice. Cumulative change-wide across verified slices: **29/51 scenarios, 13/22 requirements** (pwa-updates-storage 7/7 req — complete; gigs 6/7; prefs 0/6, row-level-security pendings → earlier/later slices). Change-level envelope verdict stays `fail`: PR#3 (3.1–3.6, prefs spec) unverified — correct state until the full change completes; the slice itself is green.

### Correctness (Static Evidence)
| Check | Status | Notes |
|-------|--------|-------|
| Total + 4 category rows from offline-native sources only (launch check S1) | ✅ Implemented | Imports = react + offlineCache + storage.js only — no supabase/fetch import in Storage.jsx; `load()` sources: `caches.keys()` (Cache Storage), `cacheMetaList()` (IDB cache-meta), `offlineKeysByPrefix` + `offlineGet` (IDB kv); category kv prefixes `songs:`/`song:`/`setlists:`/`setlist:`/`gig:` match the exact read-copy keys the data layers write |
| Per-category clear deletes ONLY that category, ALL cache versions (launch check S2) | ✅ Implemented | `cacheStats` category filter hits every `cemurm-{cat}-v*` name (version-independent via `parseCacheName`); kv filter = category kvPrefixes match; no cross-category touch; `deleteCache` drops the SW cache + its cache-meta row |
| User data never deleted (launch check S2) | ✅ Implemented | `isUserAuthoredKvEntry` referenced at BOTH deletion paths — `clearCategory` L146 and `planEviction` kv filter (storage.js L81) — `pending:` keys and `pendingSync`/`data.pendingSync` values exempt; outbox/IDB/SQL rows untouched (clear deletes only SW caches + non-user kv read copies) |
| Quota warning threshold + insecure-context fallback (launch check S3) | ✅ Implemented | WARN_RATIO 0.9 on `navigator.storage.estimate()` usage/quota; fallback trackedBytes > WARN_BYTES (50 MB) when `navigator.storage.estimate` is unavailable (insecure context) — both documented in code (L17–19, L126–129) |
| planEviction order + stop-at-target (launch check S4) | ✅ Implemented | EVICTION_ORDER `pdf,exports` category sort, then cache-meta `savedAt` oldest-first; after caches, non-user kv read copies by `savedAt`; early return once `freed >= targetBytes`; unit-asserted 19/19 (incl. pdf-before-exports regardless of age, stop-at-target partial plan) |
| Shell + active setlist + user data never eviction candidates (launch check S4) | ✅ Implemented | shell/songs/data not in EVICTION_ORDER (`isEvictableCategory` false, demo-asserted); kv candidates filtered by `isUserAuthoredKvEntry`; active-setlist protection LRU-by-construction (songs/data SW caches never candidates; kv oldest-first evicts idle read copies first) |
| Route + nav (2b.1) | ✅ Implemented | App.jsx L34 under `RequireAuth` (settings-area placement per design); AppLayout.jsx L9 "Storage" nav — both parsed by build exit 0 (127 modules) |
| Commit size within budget (launch check 7) | ✅ Implemented | 381 changed (5 code files: 380+/1−) ≤ 400; 385 total incl. tasks.md (382+/3−) — matches expected 385 exactly |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D4 category prefix = cache name; clear = per-category `caches.delete` | ✅ Yes | `parseCacheName` classifies every cache into the 5 categories; `clearCategory` deletes all matching cache names (all versions) + matching non-user kv read copies — exactly D4's "clear = caches.delete per category (plus matching non-pending kv copies)" |
| D4 eviction order PDF → Exports → remaining derived by age; shell + active setlist never | ✅ Yes | EVICTION_ORDER `pdf,exports` + cache-meta `savedAt` age sort + non-user kv by age; shell/songs/data excluded from candidates; exemption guard on both deletion paths; critically-low survival (only shell + active setlist) held by construction |
| D5 cache-meta `{bytes, savedAt}` powers the storage screen + eviction age | ✅ Yes | This slice adds the readers (`cacheMetaList`/`cacheMetaRemove`, offlineCache.js L100–130) feeding Storage.jsx per-cache bytes/savedAt; `planEviction` sorts cache candidates by `savedAt` — the declared age source |
| D8 PR slicing: #2b = storage screen + quota warning + eviction ~250 | ✅ Yes | Design fileset lands exactly (Storage.jsx, storage.js planEviction + demo, offlineCache meta readers, App route, AppLayout nav); actual 385 changed (incl. tasks.md) still within the 400 cap |
| Design testing strategy: "eviction ordering" demo-asserted unit | ✅ Yes | storage demo extended 13→19 with planEviction ordering/exemption/stop-at-target asserts — the design's unit-level RED evidence; 13-assert regression command still exits 0 |

### Issues Found
**CRITICAL**: None
**WARNING**:
- Interactive browser E2E remains manual (config `e2e: false`, no browser framework): category-clear walk, quota-warning → "Free space" click-through, offline rendering of the screen. This run's runtime evidence is node demos (19/6/26, exit 0) + lint/build exit 0 + structural source inspection — classified COMPLIANT per config's verify=build convention (same standard as all prior verified slices); a manual browser pass is recommended before merge.
- Active-setlist protection is enforced by construction, not by live lookup: songs/data SW caches sit outside EVICTION_ORDER (never candidates) and kv eviction is oldest-first by `savedAt` (= least recently touched), so the in-use setlist is evicted last, not first. Matches design intent (critically-low: only shell + active setlist survive) — our cleanup never targets shell/songs/data caches or user-authored kv. Recorded deviation from a literal id-lookup, no behavioral gap.
- Change-level envelope verdict stays `fail`: PR#3 (3.1–3.6) unverified — correct state until the full change completes; the slice itself is green.
**SUGGESTION**:
- `cache-meta` granularity is per cache NAME (one `{bytes, savedAt}` per `cemurm-{cat}-v*`): eviction age compares whole caches within a category, not per blob. Fine while one cache per category+version exists (2a noted this); per-request meta in sw.js `metaAdd` would be the upgrade path if multiple versions coexist.
- `clearCategory` uses `window.confirm` (L138) — same ponytail pattern as updateManager's prompt; a styled inline confirm would be a nicer follow-up.
- `planEviction` mixes two byte bases (SW cache blob sizes vs JSON-serialized kv sizes) and only tracks categories the screen knows; the per-category totals are therefore approximate — harmless for warning/cleanup purposes.

### Verdict
PASS WITH WARNINGS
PR#2b (`67c055f`): 2/2 in-scope tasks complete; `pnpm lint` exit 0 zero warnings; `pnpm build` exit 0 (127 modules — Storage.jsx + `/settings/storage` route parsed); demos exit 0 (storage 19 — planEviction ordering RED —, offlineCache 6, gigs 26 — no regression); screen reads only offline-native sources (Cache Storage + cache-meta + IDB kv; zero network), 4 categories + total visible offline; per-category clear deletes all `cemurm-{cat}-v*` versions + matching non-user kv copies with `isUserAuthoredKvEntry` at both deletion paths; quota warning ratio 0.9 (+50 MB insecure fallback); one-tap cleanup evicts PDF → exports → derived by age via cache-meta `savedAt`, stops at target, shell + active setlist + user data never candidates (19/19 demo-asserted); 381 changed lines (385 incl. tasks.md) ≤ 400 budget; 15/15 pwa-updates-storage scenarios COMPLIANT cumulative (5 in-slice) → 29/51 scenarios, 13/22 requirements, 0 critical. Warnings: manual browser E2E walk recommended pre-merge; change-level envelope remains `fail` until PR#3.
## PR#3a Slice — Preferences Core + Settings + Capo Helper (commits d4dcca2 + 08aa587 — S3 correction re-run, 2026-09-15)

**Change**: hito-2-remainder (PR#3a — committed slices `d4dcca2` + `08aa587` on `feat/hito-2-remainder-pr3a`, base 5e4f7c4/PR#2b — two-commit diff; fix commit `08aa587` applies user-chosen remedy (a) — replacement semantics; branch tip `be8c9e9` carries byte-identical `src/lib/transpose.js` (sha256 `0baf0fc0…` both — `08aa587` remains a dangling sibling, see check 10); working tree has no src changes, openspec files untracked only)
**Version**: N/A (delta spec, no version field)
**Mode**: Standard (strict_tdd: false, no test runner; verify build_command `pnpm build`, lint_command `pnpm lint` — openspec/config.yaml)

Slice scope: tasks 3.1–3.3 only (preferences core + Settings read-only + capo helper). 3.4–3.6 (renderer annotations/substitution, version picker, practice key/tempo) are PR#3b — classified N/A per tasks.md ownership.

**Correction scope (scoped re-run)**: prior run recorded CRITICAL S3 — `initialSemitones` SUMMED global + override (`Number(global ?? 0) + Number(override ?? 0)` → +2/−1 → +1 → C#) while spec + feature mandate the override REPLACES the global (→ B). User chose remedy (a): `songOverride ?? globalOffset ?? 0`. Commit `08aa587` (branch tip `be8c9e9`) applies it. This re-run re-executes every check, closes S3, re-verifies no regressions, and updates the report in place.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total (PR#3a slice: 3.1–3.3) | 3 |
| Tasks complete | 3 |
| Tasks incomplete (in slice) | 0 |
| Whole change pending (out of slice) | 3.4–3.6 — all `[ ]` (tasks.md L83–85); totals 28 `[x]` / 3 `[ ]` (grep-verified) |

### Verification Checks (in-order, exact observed output)
| # | Check | Observed result |
|---|-------|-----------------|
| 1 | `pnpm lint` | `$ eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0`, exit 0, 0 errors 0 warnings — stdout byte-identical to prior envelope hash `sha256:11d71e77…` |
| 2 | `pnpm build` | `✓ 130 modules transformed`, `✓ built in 1.96s`, exit 0 (pre-existing warnings only: supabase.js dynamic-import notice — now listing preferences.js alongside gigs.js — and "Some chunks are larger than 500 kB") — fresh hash `sha256:d6df9f1c…` |
| 3 | `node -e "import('./src/lib/transpose.js').then(m=>m.demo())"` | `transpose demo OK: 21 asserts (notes, keys, parsed, capo, initial semitones)`, exit 0 — S3 semantics GREEN: `initialSemitones(2, -1) === -1` ('override replaces global'), `(2, 0) === 0` ('explicit override 0 wins over global'), `(2, undefined) === 2` ('global offset alone') — demo L125–130 |
| 4 | `node -e "import('./src/lib/preferences.js').then(m=>m.demo&&m.demo())"` | `preferences demo OK: 12 asserts (defaults, D2 jsonb read shape, offline fallback)`, exit 0 (3.1 RED) |
| 5 | Regressions | `gigs demo OK: 26 asserts` exit 0; `storage demo OK: 19 asserts` exit 0; `offlineCache demo OK: 6 asserts` exit 0 — data/offline layers untouched by this slice + fix |
| 6 | Spec compliance walk | See matrix below: S1–S2 PARTIAL, **S3 COMPLIANT (closed by fix 08aa587)**, S4 PARTIAL, S5–S12 N/A (3b) |
| 7 | Budget (≤400) | `git diff --numstat 5e4f7c4`: 9 files, **257 insertions(+), 9 deletions(−) = 266 changed ≤ 400** (actual computed; prior-run 264 + net fix lines) |
| 8 | tasks.md | 3.1–3.3 `[x]` (L80–82); 3.4–3.6 `[ ]` (L83–85) |
| 9 | S3 semantic chain (runtime) | `initialSemitones(2, -1) → -1` → `transposeParsed({key:'C'}, -1).key → 'B'` + first chord → 'B' — node one-liner exit 0 (`S3 chain OK: global +2, override −1 → view semitones −1 → base C rendered B (spec S3)`). Wiring: StageMode L130 / Practice L52 pass `(prefs.transpose, prefs.overrides[song.id])` — global first, per-song override second — matching the `(globalOffset, songOverride)` signature; `prefs.overrides` reads `preferences` jsonb `override` keyed by songId (preferences demo asserts songA −1 / songB 4) |
| 10 | Fix revision identity | `git show 08aa587:src/lib/transpose.js` sha256 = working-tree sha256 (`0baf0fc0…`): `08aa587` and branch tip `be8c9e9` implement the identical fix; `git diff 08aa587 be8c9e9 --stat` touches only design.md tree presence (now an untracked working-tree file) — no code divergence |

### Build & Tests Execution

**Build**: ✅ Passed
```text
$ pnpm build
$ vite build
vite v5.4.21 building for production...
✓ 130 modules transformed
✓ built in 1.96s
(pre-existing warnings only: supabase.js dynamic-import notice — gigs.js + now preferences.js —,
 "Some chunks are larger than 500 kB after minification")
exit 0
```

**Tests**: ✅ exited 0 (no test framework — config `test_command: ""`; slice harness per tasks.md work-unit 6 = node demos; RED = transpose 21 + preferences 12; regressions = gigs 26 / storage 19 / offlineCache 6; S3 chain = node one-liner)
```text
$ pnpm lint
$ eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0
exit 0 — 0 errors, 0 warnings

$ node -e "import('./src/lib/transpose.js').then(m=>m.demo())"
transpose demo OK: 21 asserts (notes, keys, parsed, capo, initial semitones)
exit 0

$ node -e "import('./src/lib/transpose.js').then(m=>{/* S3 chain */})"
S3 chain OK: global +2, override −1 → view semitones −1 → base C rendered B (spec S3)
exit 0

$ node -e "import('./src/lib/preferences.js').then(m=>m.demo&&m.demo())"
preferences demo OK: 12 asserts (defaults, D2 jsonb read shape, offline fallback)
exit 0

$ node -e "import('./src/lib/gigs.js').then(m=>m.demo())"
gigs demo OK: 26 asserts (flatten, lifecycle, completion, venue, guards)
exit 0

$ node -e "import('./src/lib/storage.js').then(m=>m.demo&&m.demo())"
storage demo OK: 19 asserts (activate cleanup, eviction order + exemption, planEviction)
exit 0

$ node -e "import('./src/lib/offlineCache.js').then(m=>m.demo&&m.demo())"
offlineCache demo OK: 6 asserts (v3 additive upgrade, kv/outbox preserved)
exit 0
```

**Evidence digests (this re-run, exact bytes)**: `test_output_hash sha256:11d71e77…` = `pnpm lint` stdout (76 bytes, byte-identical to prior envelope — lint output unchanged by the fix); `build_output_hash sha256:d6df9f1c…` = `pnpm build` stdout (fresh — build timing/module tally differs from prior run); `evidence_revision sha256:64e5debb…` = sha256 over the exact concatenated raw transcripts of this run, canonical order lint → build → transpose → preferences → gigs → storage → offlineCache (documented convention — recomputable by re-running the commands).

**Coverage**: ➖ Not available (no coverage tooling; threshold 0 per config)

### Spec Compliance Matrix (retrieved spec: specs/personal-preferences/spec.md — native counts 6 requirements / 12 scenarios; classified per tasks.md ownership — 3.1–3.3 own the read-through/Settings/capo/initial-semitone pieces, 3b owns renderer/picker/practice. Envelope completed counts 13/22 req, 30/51 scenarios are cumulative across verified slices — S3 now COMPLIANT joins the completed set (was FAILING). The 12 prefs scenarios are walked: 1 COMPLIANT, 3 PARTIAL-as-slice-boundary, 0 FAILING, 8 N/A — all 51 change-wide native scenarios walked)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Persisted transpose preference | Singer sets a personal transpose offset | prefs demo 12/12: per-user key `prefs:${userId}` (PREF_KEY L17), typed `transpose_offset` → flatten (demo: 2), read-through getPreferences (fetch → offlineSet → kv/defaults fallback); transpose demo: transposeParsed non-mutating ("original not mutated"); **library-open surface (SongDetail) initial wiring → 3b** (SongDetail.jsx grep: zero transpose/prefs/capo refs — recorded in apply-progress Batch 8) | ⚠️ PARTIAL (data backbone + engine proven; library render wiring → 3b) |
| Persisted transpose preference | Personal offset applies to every song | Global offset read-through (DEFAULT_PREFS.transpose 0; typed column flatten) + StageMode L130–133 / Practice L52–55 seed `initialSemitones(prefs.transpose, …)` (demo-asserted 2,0→2); both surfaces render via transposeParsed with seeded semitones; library surface → 3b | ⚠️ PARTIAL (stage/practice surfaces wired + demo-asserted; library → 3b) |
| Persisted transpose preference | Per-song override beats the global preference | Fix `08aa587` (branch tip `be8c9e9`, byte-identical): `initialSemitones(globalOffset, songOverride)` = `Number(songOverride ?? globalOffset ?? 0)` — override REPLACES the global (spec L25–29: global +2, override −1 → **render B**). Demo asserts (transpose.js L125–130): `(2, -1) → -1` 'override replaces global', `(2, 0) → 0` 'explicit override 0 wins over global', `(2, undefined) → 2` 'global offset alone' — 21/21 exit 0. Runtime chain check exit 0: global +2, override −1 → view semitones −1 → `transposeParsed` renders key + chords **B** from base C. Wiring: StageMode L130 / Practice L52 seed `initialSemitones(prefs.transpose, prefs.overrides[song.id])` — global first, per-song override second (`(globalOffset, songOverride)` signature); `prefs.overrides` = `preferences` jsonb `override` keyed by songId (preferences demo asserts songA −1 / songB 4). design.md D7 + Data Flow amended to replacement semantics ('override REPLACES global'; `transposeParsed(override ?? global)`) | ✅ COMPLIANT |
| Capo display | Capo preference shown on guitar charts | capoLabel (transpose.js L56–59) demo-asserted: `capoLabel('C', 2)` = `'Capo 2 · sounds D'`, minor key `'Capo 3 · sounds Cm'`, `''` for capo 0 / no key; additive via transposeKey(rendered, capo) — capo scenario math holds; **zero UI callers** (grep: definition + demo asserts only) → chart display → 3b renderer (tasks 3.3 boundary) | ⚠️ PARTIAL (helper shipped + RED-asserted; display on charts → 3b) |
| Version preference and picker | Performer prefers a specific version by default | Open-by-default + picker → 3.5 | ➖ N/A by slice (3b) |
| Version preference and picker | Version preference is personal, not shared | Per-user read backbone present (prefs:${userId} key; jsonb default_version read demo-asserted 'v2'); per-device default opening → 3.5 | ➖ N/A by slice (3b) |
| Version preference and picker | Choosing a version on a setlist item | setlist_items.version_id write + label → 3.5 | ➖ N/A by slice (3b) |
| Personal annotations and chord substitution | Performer annotates their own copy | personal_annotations storage/render → 3.4 | ➖ N/A by slice (3b) |
| Personal annotations and chord substitution | Personal chord substitution | substituted render + transpose movement → 3.4 | ➖ N/A by slice (3b) |
| Annotations preserved across transpose | Annotations are preserved across transpose | anchor {section,index} + transpose render → 3.4 | ➖ N/A by slice (3b) |
| Practice key and tempo preferences | Practice key differs from stage key | practice jsonb read shape present (demo asserts `practice.songA.{key:'D', tempo:70}`); driving key/metronome/auto-scroll → 3.6 | ➖ N/A by slice (3b) |
| Practice key and tempo preferences | Personal tempo preference for practice | Read shape present; tempo drive → 3.6 | ➖ N/A by slice (3b) |

**Compliance summary**: 1/12 personal-preferences scenarios COMPLIANT at 3a slice scope — **S3 (Per-song override beats the global preference) now COMPLIANT**, closed by fix `08aa587` (replacement semantics `songOverride ?? globalOffset ?? 0`; runtime chain-verified: global +2, override −1 → C renders B) — was FAILING/CRITICAL in the prior run; 3 PARTIAL-as-slice-boundary (S1 library-read wiring, S2 library surface, S4 capo chart display → 3b renderer), 0 FAILING, 8 N/A by slice (3b-owned: version 3, annotations 3, practice 2). No prefs requirement fully green yet (Persisted transpose preference partial on S1/S2; Capo display partial on S4; version/annotations/practice → 3b). Cumulative change-wide: **30/51 scenarios, 13/22 requirements completed** (S3 joins the cumulative completed set; requirements unchanged — no prefs requirement fully green yet). All 51 native scenarios walked (gigs 15, pwa-updates-storage 15, row-level-security 9, personal-preferences 12). Change-level envelope verdict stays `fail` — 3.4–3.6 (PR#3b) pending; the slice itself verifies **PASS WITH WARNINGS**.

### Correctness (Static Evidence)
| Check | Status | Notes |
|-------|--------|-------|
| Read-through per-user key `prefs:${userId}` (launch check 6a) | ✅ Implemented | PREF_KEY L17; getPreferences L59–69: fetchPreferences → offlineSet(PREF_KEY) on success → catch → offlineGet kv → `{...DEFAULT_PREFS}`; never throws; kv-only offline path |
| Lazily reads user_preferences typed + jsonb (D2) | ✅ Implemented | fetchPreferences L43–51 `.from('user_preferences').select('transpose_offset, capo, preferences').eq('user_id', userId).maybeSingle()`; flattenPreferences L32–41 maps typed columns + jsonb default_version/override/practice — 12/12 demo asserts (typed 2/3, jsonb v2, overrides −1/4, practice tempo 70) |
| Offline-safe fallback | ✅ Implemented | `getPreferences('no-such-user')` → defaults (demo-asserted transpose+capo = 0); no-row (maybeSingle → null) → defaults — "a missing pref row IS the default state" |
| No mutation surface (launch check 6a) | ✅ Implemented | Exports = PREF_KEY, DEFAULT_PREFS, flattenPreferences, getPreferences, demo — no write helpers; only write is read-through `offlineSet` kv cache (best-effort); usePreferences returns `{prefs, loading, refresh}` read-only |
| Settings read-only (launch check 6b) | ✅ Implemented | App.jsx L35 `{ path: '/settings', element: <Settings /> }` inside RequireAuth (L25); AppLayout L9 `{ to: '/settings', label: 'Settings' }` + `end` prop on /settings (L35 — no co-highlight with /settings/storage); Settings.jsx rows = Transpose / Capo / Default version; grep: zero `.insert/.update/.delete/.upsert/.put/.remove/.rpc(` matches (exit 1); only import = usePreferences; caption "Preferences are read-only for now" |
| Capo helper "Capo N · sounds X" (launch check 6c) | ✅ Implemented | capoLabel L56–59 = `'Capo ' + capo + ' · sounds ' + transposeKey(renderedKey, capo)`; `''` when no rendered key or capo 0; asserts: 'Capo 2 · sounds D' (D7 scenario C+2), 'Capo 3 · sounds Cm', two `''` cases |
| initialSemitones formula + Stage/Practice wiring (launch check 6c) | ✅ Implemented | Formula L66–68 `Number(songOverride ?? globalOffset ?? 0)` — replacement semantics per spec S3 (fix 08aa587; prior additive formula removed). Demo-asserted: `(2, −1) → −1`, `(2, 0) → 0`, `(2, undefined) → 2` (L125–127), `(0, −1) → −1`, `(undefined, 2) → 2`, `(undefined, undefined) → 0`; StageMode L130–133 / Practice L52–55 seed `initialSemitones(prefs.transpose, prefs.overrides[song.id])` + re-seed effect on song/prefs change (manual ± preserved); Practice resetKey → baseline. Runtime chain check exit 0: +2/−1 → −1 → base C renders B |
| 3a boundary respected (launch check 6d) | ✅ Implemented | capo/sounds chart display → 3b renderer (capoLabel zero UI callers); SongDetail initial transpose → 3b (no prefs refs); practice key/tempo → 3.6 (read shape only, now) |
| Commit size within budget (launch check 7) | ✅ Implemented | `git diff --numstat 5e4f7c4`: 9 files, **257 insertions(+), 9 deletions(−) = 266 ≤ 400** (per-file: preferences.js 108, Settings.jsx 55, usePreferences.js 31, transpose.js 33/1, Practice.jsx 13/3, StageMode.jsx 10/1, tasks.md 3/3, App.jsx 2, AppLayout.jsx 2/1) — actual computed (prior-run 264 + net fix additions + wording drift) |
| tasks checked (launch check 8) | ✅ Implemented | 3.1–3.3 `[x]`; 3.4–3.6 `[ ]`; repo totals 28 `[x]` / 3 `[ ]` |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D2 user_preferences shape (typed + jsonb) + client read-through (setlists.js pattern) | ✅ Yes | Typed transpose_offset/capo flatten + jsonb default_version/override/practice read exactly per D2; `prefs:${userId}` kv key; network-first → kv → defaults read-through semantics identical to setlists.js |
| D7 capo = physical fret int, display-only helper | ✅ Yes | capoLabel display-only (pure label over transposeKey; shapes untouched by construction); capo scenario math correct (rendered C + capo 2 → sounds D) |
| D7 initial semitones = global + per-song override | ✅ Yes (resolved this re-run) | Prior run: implementation matched D7's additive formula literally, but D7 contradicted the spec (render B for +2/−1) — design-coherence gap feeding the CRITICAL. This re-run: design.md D7 + Data Flow now state "per-song override, falling back to global (override REPLACES global — spec 'explicit per-song preference wins')" and `transposeParsed(override ?? global)` — design amended to spec semantics; implementation `transpose.js` L66–68 matches design + spec. Variance source (additive D7 wording) closed |
| D8 PR slicing: #3a = prefs core + Settings + capo helper | ✅ Yes | Fileset lands exactly (preferences.js, usePreferences.js, Settings.jsx, transpose.js, StageMode.jsx, Practice.jsx, App.jsx, AppLayout.jsx); 3b deferred parts recorded in tasks 3.3 boundary note — no silent omission |
| Design data flow: prefs:${userId} → usePreferences → initial semitones → transposeParsed → render | ✅ Yes | Wired end-to-end for Stage/Practice; library surface joins in 3b |

### Issues Found
**CRITICAL**: None — S3 closed by fix `08aa587` (replacement semantics; runtime chain-verified), see Verdict.
**WARNING**:
- Manual browser E2E remains manual (config `e2e: false`): /settings render walk, Stage/Practice live seeding from a real user_preferences row, capo label on a real chart. Runtime evidence this re-run = node demos (21/12/26/19/6, exit 0) + S3 chain check + lint/build exit 0 + static wiring inspection — per config's verify=build convention (same standard as all prior verified slices).
- S1/S2/S4 remain PARTIAL-as-slice-boundary (unchanged by the fix): S1/S2 transpose scenarios need the library-open surface (SongDetail) initial wiring → 3b; S4 capo scenario needs a chart-display caller for capoLabel → 3b renderer (tasks 3.3 boundary — recorded, not silent).
- Change-level envelope verdict stays `fail` — now solely the 3.4–3.6 remainder (PR#3b); the S3 critical is closed (critical_findings 0, scenarios 30/51). The PR#3a slice itself verifies PASS WITH WARNINGS.
- Fix delivery shape: remedy (a) landed as a second commit `08aa587` on `feat/hito-2-remainder-pr3a`; the branch tip is `be8c9e9` (identical src bytes, `08aa587` left dangling after re-commit). Squash/keep is a delivery-polish decision at PR open (no PR created per instruction); no functional impact.
**SUGGESTION**:
- `prefs:` kv copies live outside all storage-category prefixes → the storage screen never lists/clears them and planEviction never targets them (browser-quota territory only; harmless — re-fetch on next read). Recorded in apply-progress Batch 8; no change needed.
- capoLabel awaits its first UI caller: the 3b renderer work unit should render it wherever the chart header key is shown (StageMode displayKey, Practice displayKey, SongDetail) — D7's boundary says "charts", so wire it next slice.
- preferences.js lazy-imports supabase.js for the node demo (gigs.js pattern); the build's dynamic-vs-static import notice now lists both files — same intentional pattern, no new warning class.

### Verdict
PASS WITH WARNINGS
PR#3a slice re-verified after the S3 semantics correction — `pnpm lint` exit 0 zero warnings (stdout byte-identical to prior envelope hash `11d71e77…`); `pnpm build` exit 0 (130 modules, fresh hash `d6df9f1c…`); demos exit 0 (transpose 21 — incl. replacement-semantics asserts, preferences 12; regressions gigs 26 / storage 19 / offlineCache 6 — untouched layers); S3 semantic chain runtime exit 0 (global +2, override −1 → view semitones −1 → base C renders B); 3.1–3.3 complete; 266 changed lines ≤ 400 budget. **S3 (per-song override beats the global preference) moved FAILING → COMPLIANT**: `initialSemitones` = `Number(songOverride ?? globalOffset ?? 0)` (replacement semantics, user-chosen remedy (a)); design.md D7 + Data Flow amended to match. 0 CRITICAL; remaining warnings are slice-boundary partials (S1/S2/S4 → 3b, recorded) + manual browser E2E. Change-level envelope stays `fail` — completed counts now **13/22 req, 30/51 scenarios** — 3.4–3.6 (PR#3b) pending; all 51 native scenarios walked.

## PR#3b-annotations Slice — Renderer Annotations + Chord Substitution (commit 6976168)

**Change**: hito-2-remainder (PR#3b-annotations — committed slice `6976168` on `feat/hito-2-remainder-pr3b-annotations`, base 4397b22/PR#3a — clean one-commit diff, no src changes in working tree)
**Version**: N/A (delta spec, no version field)
**Mode**: Standard (strict_tdd: false, no test runner; verify build_command `pnpm build`, lint_command `pnpm lint` — openspec/config.yaml)

Slice scope: task 3.4 only (`ChordProRenderer.jsx` annotations overlay — `personal_annotations`, anchor `{section,index}` — + chord substitution, transposed match/render, preserved across transpose). 3.5 (version picker) and 3.6 (practice key/tempo) are the sibling 3b-player slice — classified N/A per tasks.md ownership (L84–85 `[ ]`). This slice also closes the three renderer-boundary partials PR#3a recorded (S1/S2 library-open surface, S4 capo chart display — the tasks.md 3.3 boundary note "SongDetail initial transpose → 3b" + verify-report L743): SongDetail now seeds `initialSemitones(prefs.transpose, prefs.overrides[song.id])`, renders the transposed chart with a displayKey header, and surfaces `capoLabel` on the chart.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total (PR#3b-annotations slice: 3.4) | 1 |
| Tasks complete | 1 |
| Tasks incomplete (in slice) | 0 |
| Whole change pending (out of slice) | 3.5–3.6 — both `[ ]` (tasks.md L84–85, grep-verified) |

### Verification Checks (in-order, exact observed output)
| # | Check | Observed result |
|---|-------|-----------------|
| 1 | `pnpm lint` | `$ eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0`, exit 0, 0 errors 0 warnings — stdout byte-identical to the standing envelope hash `sha256:11d71e77…` |
| 2 | `pnpm build` | `✓ 131 modules transformed`, `✓ built in 1.76s`, exit 0 (pre-existing warnings only: supabase.js dynamic-import notice — annotations.js + gigs.js + preferences.js — and "Some chunks are larger than 500 kB") — fresh hash `sha256:4dc77f00…` |
| 3 | `node -e "import('./src/lib/annotations.js').then(m=>m.demo&&m.demo())"` | `annotations demo OK: 11 asserts (anchors, substitution map, transpose movement, offline)`, exit 0 (3.4 RED) — note: 13 assert CALLS run (L97–115); the log string under-counts, see SUGGESTION |
| 4 | `node -e "import('./src/lib/transpose.js').then(m=>m.demo())"` | `transpose demo OK: 24 asserts (notes, keys, parsed, capo, initial semitones, preferFlatForKey)`, exit 0 — 24 assert calls counted; demo extended 21→24 this slice (`transposeChord` exported + `preferFlatForKey` + assert, L31/L63–65/L138) |
| 5 | Regressions | `gigs demo OK: 26 asserts` exit 0; `storage demo OK: 19 asserts` exit 0; `offlineCache demo OK: 6 asserts` exit 0; `preferences demo OK: 12 asserts` exit 0 — data/offline/prefs layers untouched by this slice |
| 6 | Spec compliance walk | See matrix: S1/S2/S4 moved ⚠️ PARTIAL → ✅ COMPLIANT (renderer-boundary closure by this slice); S8/S9/S10 ✅ COMPLIANT (3.4 RED + source); S5–S7/S11–S12 ➖ N/A (3b-player) |
| 7 | Budget (≤400) | `git diff --stat 4397b22` → 6 files, **249 insertions(+), 27 deletions(−) = 276 changed ≤ 400** — matches expected 276 (annotations.js 118, ChordProRenderer.jsx 73, SongDetail.jsx 52, Practice.jsx 19, transpose.js 12, tasks.md 2) |
| 8 | tasks.md | 3.4 `[x]` (L83); 3.5/3.6 `[ ]` (L84–85) — change totals 29 `[x]` / 2 `[ ]` |
| 9 | 3.5/3.6 absence (grounding) | grep: zero `version_id`/`setSongVersion`/`defaultVersion` matches in SongDetail/Practice (version-picker content absent — sibling slice); Practice's `displayBpm`/`resetTempo` (L51/L98) are Hito-1 base-BPM controls — no practicePref key/tempo drive anywhere (3.6 sibling, StageMode untouched) |
| 10 | Anchor stability runtime probe (real parser output) | `parseChordPro` on a real body (`{section: Intro/Chorus/Verse 1}`) → `transposeParsed(parsed, +2)` → section set/order, per-section line counts, and every lyric text byte-identical pre/post (probe: `ANCHOR STRUCTURE IDENTICAL PRE/POST +2: true`, exit 0); `noteForLine(notes, 'Chorus', 1)` on the transposed structure returns the note with content unchanged — anchor {section,index} + preservation (S10) proven at runtime, not just statically |

### Build & Tests Execution

**Build**: ✅ Passed
```text
$ pnpm build
$ vite build
✓ 131 modules transformed.
✓ built in 1.76s
(pre-existing warnings only: supabase.js dynamic import notice — annotations.js + gigs.js + preferences.js;
 "Some chunks are larger than 500 kB after minification")
exit 0
```

**Tests**: ✅ exited 0 (no test framework — config `test_command: ""`; slice harness per tasks.md work-unit 6 = node demos; RED = annotations 11-logged/13-call + transpose 24; regressions = gigs 26 / storage 19 / offlineCache 6 / preferences 12)
```text
$ pnpm lint
$ eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0
exit 0 — 0 errors, 0 warnings

$ node -e "import('./src/lib/annotations.js').then(m=>m.demo&&m.demo())"
annotations demo OK: 11 asserts (anchors, substitution map, transpose movement, offline)
exit 0

$ node -e "import('./src/lib/transpose.js').then(m=>m.demo())"
transpose demo OK: 24 asserts (notes, keys, parsed, capo, initial semitones, preferFlatForKey)
exit 0

$ node -e "import('./src/lib/gigs.js').then(m=>m.demo())"
gigs demo OK: 26 asserts (flatten, lifecycle, completion, venue, guards)
exit 0

$ node -e "import('./src/lib/storage.js').then(m=>m.demo&&m.demo())"
storage demo OK: 19 asserts (activate cleanup, eviction order + exemption, planEviction)
exit 0

$ node -e "import('./src/lib/offlineCache.js').then(m=>m.demo&&m.demo())"
offlineCache demo OK: 6 asserts (v3 additive upgrade, kv/outbox preserved)
exit 0

$ node -e "import('./src/lib/preferences.js').then(m=>m.demo&&m.demo())"
preferences demo OK: 12 asserts (defaults, D2 jsonb read shape, offline fallback)
exit 0
```

**Evidence digests (this run, exact bytes)**: `test_output_hash sha256:11d71e77…` = `pnpm lint` stdout (byte-identical to every prior envelope — lint output unchanged by this slice); `build_output_hash sha256:4dc77f00…` = `pnpm build` stdout (fresh — 131 modules, built in 1.76s; the inherited envelope value 0e4d7b1c… belongs to the PR#1a-era build stdout and cannot match a 131-module transcript — replaced with this run's recomputed digest); `evidence_revision sha256:640d1770…` = sha256 over the exact concatenated raw transcripts of this run, canonical order lint → build → annotations → transpose → gigs → storage → offlineCache → preferences (documented convention — recomputable by re-running the commands). Runtime anchor probe added this run: real `parseChordPro` output transposed +2 keeps `{section,index}` keys + lyric texts byte-identical (ANCHOR STRUCTURE IDENTICAL PRE/POST +2: true) and `noteForLine` resolves the Chorus/1 note on the transposed structure — S10 preservation proven at runtime, exit 0.

**Coverage**: ➖ Not available (no coverage tooling; threshold 0 per config)

### Spec Compliance Matrix (retrieved spec: specs/personal-preferences/spec.md — native counts 6 requirements / 12 scenarios; classified per tasks.md ownership — 3.4 owns annotations/substitution/preservation rendering, 3b-player owns version + practice. Envelope completed counts 17/22 req, 36/51 scenarios are cumulative across verified slices vs change-wide native 22/51. The 12 prefs scenarios are walked: 7 COMPLIANT, 0 PARTIAL, 0 FAILING, 5 N/A — all 51 change-wide native scenarios walked cumulatively)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Persisted transpose preference | Singer sets a personal transpose offset | Library surface closed this slice: SongDetail seeds `baseline = initialSemitones(prefs.transpose, prefs.overrides[song.id])` → `transposed = transposeParsed(parsed, semitones)` + displayKey header (`transposeKey`); StageMode L130 / Practice L52 already wired (3a); transpose demo asserts `(2, undefined) → 2` + transposeParsed non-mutating ("original not mutated", base metadata unchanged) | ✅ COMPLIANT (was ⚠️ PARTIAL in 3a — library surface landed this slice) |
| Persisted transpose preference | Personal offset applies to every song | Every chart surface (SongDetail, StageMode, Practice) now renders through `transposeParsed` seeded from prefs; stored arrangement content untouched (pure render transform, non-mutation demo-asserted) + per-user `prefs:${userId}` read-through (prefs demo 12/12) | ✅ COMPLIANT (was ⚠️ PARTIAL — library surface closed) |
| Persisted transpose preference | Per-song override beats the global preference | Verified PR#3a (fix `08aa587`, replacement semantics `songOverride ?? globalOffset ?? 0`; runtime chain: +2/−1 → C renders B). Unchanged this slice. | ✅ COMPLIANT (prior slice) |
| Capo display | Capo preference shown on guitar charts | `capoLabel` now has a live chart caller: SongDetail renders `capoLabel(displayKey, prefs.capo)` when capo > 0 next to the transposed key readout (`(semitones !== 0 \|\| prefs.capo > 0)` header block); scenario math C+2 → 'Capo 2 · sounds D' demo-asserted (capoLabel(C,2)); shapes unchanged by construction (display-only, D7) | ✅ COMPLIANT (was ⚠️ PARTIAL — chart display landed) |
| Version preference and picker | Performer prefers a specific version by default | Version open-by-default + picker → 3.5 (sibling 3b-player) | ➖ N/A by slice |
| Version preference and picker | Version preference is personal, not shared | version_id write + per-device default → 3.5 | ➖ N/A by slice |
| Version preference and picker | Choosing a version on a setlist item | setlist_items.version_id + label → 3.5 | ➖ N/A by slice |
| Personal annotations and chord substitution | Performer annotates their own copy | Renderer tracks {section} header + 0-based lyric-line index (ChordProRenderer L51–52, L66–67, L82–83) → `noteForLine(annotations, sectionName, lineInSection)` renders the note under its line (L92, author view only — Practice + SongDetail pass the current user's `listAnnotations(user.id, id)`); annotations demo asserts `{Chorus, 2} → 'breath here'`, wrong line → null, wrong section → null, empty → null (L97–100); author-only: `listAnnotations` scoped `.eq('user_id', userId).eq('song_id', songId)` + `personal_annotations` RLS self-policies (0002) — Pedro's read never returns Juan's rows; offline/no-row → `[]`, never throws (L70–82, demo-asserted). Annotation AUTHORING (write) is outside this change's read-only preferences surface (same posture as 3.1/3a — "read-only surface; mutation UI later") | ✅ COMPLIANT (slice scope: anchored render + author-only read; no annotation editor in any slice) |
| Personal annotations and chord substitution | Personal chord substitution | `applySubstitution(token, semitones, substitutions, baseKey)`: reverse-transpose rendered token → concrete-key lookup (`buildSubstitutionMap` keyed by concrete chord token) → forward-transpose target; demo asserts `Bm→Dmaj7` at +0, `C#m→Emaj7` at +2, `Am→Cmaj7` at −2 (substitution moves under transpose), unmatched `C` unchanged, empty map unchanged, Bb-chart round-trip `('B', 1, {Bb:'C'}, 'Bb') → 'Db'` (flat-consistent reverse lookup via `preferFlatForKey`); renderer applies per chord segment in LyricLine (L31–35) — only the author's view substitutes (annotations from author's list only), shared chart keeps the original token (no mutation of parsed; unmatched tokens pass through) | ✅ COMPLIANT (3.4 RED runtime) |
| Annotations preserved across transpose | Annotations are preserved across transpose | Anchor = structural position `{section, index}`; `transposeParsed` maps sections/lines 1:1 (transpose.js L85–94 — same section order, same line order/count, so section names + 0-based lyric indexes are stable at any semitones; demo asserts original not mutated); renderer re-anchors from the TRANSPOSED parsed with the same {section, index} keys → identical resolution at every transpose level; note content is plain text, never transposed (demo asserts note anchoring independent of the substitution/transpose path). Runtime probe (real parser body, base C → +2): `{section,index}` key sets + lyric texts byte-identical pre/post transpose; `noteForLine` resolves 'bass enters on verse 2' at {Chorus, 1} on the transposed structure | ✅ COMPLIANT (structural 1:1 + demo + runtime probe) |
| Practice key and tempo preferences | Practice key differs from stage key | practicePref key drive → 3.6 (sibling; Practice still seeds global/override baseline only — no practice-key shift) | ➖ N/A by slice |
| Practice key and tempo preferences | Personal tempo preference for practice | practicePref tempo drive → 3.6 (displayBpm = base song.bpm + manual offset only) | ➖ N/A by slice |

**Compliance summary**: 7/12 personal-preferences scenarios COMPLIANT cumulative for prefs (this slice completes 6: S1, S2, S4 renderer-boundary closures + S8, S9, S10 annotations/substitution/preservation — exactly the 3.4-owned work; S3 was closed in 3a); 0 PARTIAL, 0 FAILING, 5 N/A by slice (3b-player: version 3 → 3.5, practice 2 → 3.6). Requirements fully green now: **Persisted transpose preference (3/3), Capo display (1/1), Personal annotations and chord substitution (2/2), Annotations preserved across transpose (1/1)** → 4/6 prefs requirements; Version preference (3.5) + Practice key and tempo (3.6) remain. Cumulative change-wide across verified slices: **36/51 scenarios, 17/22 requirements** (gigs 7/7 req, pwa 7/7, prefs 4/6, rls 2/9 → 17 req; all 51 native scenarios walked cumulatively). Change-level envelope verdict stays `fail`: 3.5/3.6 (sibling 3b-player) pending — the slice itself passes.

### Correctness (Static Evidence)
| Check | Status | Notes |
|-------|--------|-------|
| noteForLine anchors {section, index} (launch checklist) | ✅ Implemented | annotations.js L23–31: `a.kind === 'note' && a.anchor.section === sectionName && a.anchor.index === lineIndex` → `value`; renderer supplies sectionName (section header text) + lineInSection (0-based lyric line within the section block, reset on `type === 'section'` and incremented per lyric line — L51–52, L66–67, L82–83) per the 0001 schema comment ("structural anchor; index = 0-based lyric line within the {section} block") |
| buildSubstitutionMap keyed by concrete chord token (launch checklist) | ✅ Implemented | annotations.js L38–46: only `kind === 'chord_substitution'`; anchor = `a.anchor.chord` (or string anchor); demo asserts `map.Bm === 'Dmaj7'` + note anchors never enter the map (`hasOwnProperty(map,'Chorus') === false`) |
| applySubstitution: match rendered token → transpose target; flat-consistent reverse lookup (launch checklist) | ✅ Implemented | L57–63: `concrete = transposeChord(token, -semitones, preferFlatForKey(baseKey))` → `target = substitutions[concrete]` → `transposeChord(target, semitones, preferFlat)`. Substitution keyed independently of transposition (map lives in concrete key space; rendered-token matching via reverse transpose). Demo: +2/−2 movement, Bb round-trip, unmatched/empty unchanged (L107–113) |
| listAnnotations self-scoped, offline → [], never throws | ✅ Implemented | L70–82: `.select('anchor, kind, value').eq('user_id', userId).eq('song_id', songId)`; catch → `[]`; lazy supabase import (node-demo pattern, same as gigs/preferences); demo asserts `[]` for no-such-user/song |
| Renderer call sites pass transposed parsed + semitones + baseKey (launch checklist) | ✅ Implemented | SongDetail L274–279 `parsed={transposed} annotations={annotations} semitones={semitones} baseKey={parsed?.key}`; Practice L185–190 identical — substitution resolves against the RENDERED token (`transposed` chords) with the ORIGINAL key as base for enharmonic consistency |
| transposeParsed preserves section order/index (launch checklist — 1:1) | ✅ Implemented | transpose.js L85–94: `sections.map → lines.map → chords.map` — same section count/order, same line count/order at any semitones; only chord tokens + key string change; original not mutated (demo-asserted L124) — anchors {section, index} stay stable by construction |
| Author-view-only wiring | ✅ Implemented | Both surfaces fetch via `listAnnotations(user.id, id)` (SongDetail L76, Practice L37) — never shared/public reads; other users' views render their own (or empty) annotation set; shared chart data untouched (annotations are a render overlay, not a chart mutation) |
| SongDetail library surface (3a boundary closure: S1/S2/S4) | ✅ Implemented | `initialSemitones(prefs.transpose, prefs.overrides[song.id])` baseline seed (SongDetail L91–95) + `transposed` memo + displayKey header + `capoLabel(displayKey, prefs.capo)` readout (L267–273) — the 3.3-boundary items PR#3a deferred ("SongDetail initial transpose → 3b", capo chart display) are in this commit, within its budget |
| transpose.js exports for annotations (launch checklist) | ✅ Implemented | `transposeChord` exported (L31) + `preferFlatForKey` added (L63–65) mirroring transposeParsed's flat check — annotations.js imports both (L7); demo extended 21→24 asserts |
| Commit size within budget (check 7) | ✅ Implemented | `git diff --stat 4397b22`: **276 changed (249+/27−)** — annotations.js 118, ChordProRenderer 73, SongDetail 52, Practice 19, transpose 12, tasks.md 2 — ≤ 400, no size:exception |
| tasks checked (check 8) | ✅ Implemented | 3.4 `[x]`; 3.5/3.6 `[ ]`; repo totals 29 `[x]` / 2 `[ ]` |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D7: annotations render in ChordProRenderer from personal_annotations (anchor {section,index}; substitution: match transposed chord token, render transposed target) | ✅ Yes | noteForLine + buildSubstitutionMap/applySubstitution implement the D7 contract byte-for-byte in intent; renderer overlay applies both at render time; the 0001 schema anchor comment is honored (structural {section,index}, stable under transpose) |
| D7: "substitution moves correctly under transpose" + spec "shared chart keeps the original chord" | ✅ Yes | Reverse-lookup keyed in concrete chord space — transposition-independent; render-layer only (parsed chart never mutated; unmatched tokens pass through unchanged, demo-asserted) |
| D7: slash-chord deferral (engine upgrade path documented) | ✅ Yes | No slash-bass handling added (unchanged engine; transpose.js header L3–4 documents the upgrade path); substitution scenarios use plain chords per design determination |
| D7: capo/sounds display on charts (3.3 boundary → 3b renderer) + Design data flow `transposeParsed(override ?? global) → annotations overlay → render` | ✅ Yes | SongDetail chart header surfaces displayKey + capoLabel; renderer receives `transposed` + substitution map + baseKey and overlays at render — the design's final data-flow stage; StageMode/Practice chart headers already showed semitones/capo from 3a |
| D8 PR slicing: 3.4 renderer annotations/substitution core | ✅ Yes | Fileset matches tasks.md 3.4 + the recorded renderer-boundary carry-over (annotations.js, ChordProRenderer.jsx, transpose.js helpers, SongDetail/Practice wiring); 3.5/3.6 content absent (grep-verified) — the sibling player slice lands them |

### Issues Found
**CRITICAL**: None
**WARNING**:
- Manual browser E2E remains manual (config `e2e: false`, no browser framework): annotation note visible under its lyric line on a real chart, chord substitution + transpose-movement walk (Bm→Dmaj7, then transpose the view), SongDetail transposed-key/capo header render. This run's runtime evidence is node demos (annotations 13-call, transpose 24, regressions 26/19/6/12 — all exit 0) + lint/build exit 0 + structural source inspection — classified COMPLIANT per config's verify=build convention (same standard as all prior verified slices); a manual browser pass is recommended before merge.
- SongDetail.jsx carries more than annotation wiring: it also closes the 3a-recorded renderer-boundary items (library initial semitones + capoLabel display). That is the tasks.md 3.3 boundary's declared destination ("SongDetail initial transpose → 3b"), lands inside the 276-line budget, and converts three PARTIALs to COMPLIANT — recorded as scope-in, not a deviation.
- Change-level envelope verdict stays `fail`: 3.5/3.6 (sibling 3b-player) unverified — correct state until the full change completes; the slice itself is green.
**SUGGESTION**:
- annotations.js demo log string says "11 asserts" but the demo contains 13 assert CALLS (L97–115) — cosmetic under-count in the success message only; the demo throws loudly on any mismatch and exits 0, so the discrepancy has no correctness impact. Update the string when the module next changes.
- No annotation/chord-substitution editor exists in this change (read-only preferences surface, same posture as 3.1/3a "mutation UI later"): annotations are consumed from `personal_annotations` rows the app never writes yet. The 0002 RLS contract (personal_annotations self policies) is the authoring boundary a future slice will write against.
- `applySubstitution` transposes arbitrary chord values including re-substituted targets (Dmaj7 → Emaj7 at +2) — correct for "the substitution moves" (spec), but a substitution targeting a non-transposable string (e.g. "N.C.") falls back to `transposeChord` passthrough (unknown root → unchanged token). Fine today; a future slice could forbid non-chord targets.

### Verdict
PASS WITH WARNINGS
PR#3b-annotations (`6976168`): 1/1 in-scope task complete (3.4); `pnpm lint` exit 0 zero warnings (hash `11d71e77…`, byte-identical); `pnpm build` exit 0 (131 modules, fresh hash `4dc77f00…`); demos exit 0 (annotations 13 assert calls — RED anchors/substitution/preservation; transpose 24; regressions gigs 26 / storage 19 / offlineCache 6 / preferences 12 — untouched layers green); `transposeParsed` preserves section order/index 1:1 (anchors stable under transpose, non-mutating); substitution matches the rendered token via flat-consistent reverse lookup and moves with transpose (demo-asserted +2/−2 + Bb round-trip); renderer overlays notes + substitutions author-view-only in Practice + SongDetail; SongDetail also closes 3a's S1/S2/S4 renderer-boundary partials (library transposed render + displayKey + capoLabel chart display) inside budget; 276 changed lines ≤ 400; tasks.md 3.4 `[x]`, 3.5/3.6 `[ ]`; prefs scenarios 7/12 COMPLIANT cumulative → change-wide **36/51 scenarios, 17/22 requirements**, 0 critical. Warnings: manual browser E2E walk recommended pre-merge; change-level envelope remains `fail` until sibling 3b-player (3.5/3.6).

## PR#3b-player Slice — Version Picker + Practice Key/Tempo (commit d965059)

**Change**: hito-2-remainder (PR#3b-player — committed slice `d965059` on `feat/hito-2-remainder-pr3b-player`, base `9852501`/PR#3b-annotations — clean one-commit diff, working tree has no src changes; openspec artifacts untracked). **THIS SLICE CLOSES THE CHANGE**: tasks 3.5 + 3.6 are the final two tasks; the change-level envelope flips to PASS below.
**Version**: N/A (delta spec, no version field)
**Mode**: Standard (strict_tdd: false, no test runner; verify build_command `pnpm build`, lint_command `pnpm lint` — openspec/config.yaml)

Slice scope: task 3.5 (version picker → `setlist_items.version_id`; default version opens first, picker offers others) + task 3.6 (practice key/tempo drive the practice surface; stage key unchanged). Both in tasks.md `[x]`; no `[ ]` remains anywhere in the change.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total (PR#3b-player slice: 3.5, 3.6) | 2 |
| Tasks complete | 2 |
| Tasks incomplete (in slice) | 0 |
| Whole change | **31/31 tasks `[x]` — 0 `[ ]` remains (grep-verified: tasks.md 31 `[x]` / 0 `[ ]`)** |

### Verification Checks (in-order, exact observed output)
| # | Check | Observed result |
|---|-------|-----------------|
| 1 | `pnpm lint` | `$ eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0`, exit 0, 0 errors 0 warnings — stdout byte-identical to the standing envelope hash `sha256:11d71e77…` |
| 2 | `pnpm build` | `✓ 131 modules transformed`, `✓ built in 1.78s`, exit 0 (pre-existing warnings only: supabase.js dynamic-import notice — annotations.js + gigs.js + preferences.js — and "Some chunks are larger than 500 kB") — fresh hash `sha256:70bb3b94…` |
| 3 | `node -e "import('./src/lib/annotations.js').then(m=>m.demo&&m.demo())"` | `annotations demo OK: 11 asserts (anchors, substitution map, transpose movement, offline)`, exit 0 (3.4 regression clean) |
| 4 | `node -e "import('./src/lib/transpose.js').then(m=>m.demo())"` | `transpose demo OK: 28 asserts (notes, keys, parsed, capo, initial semitones, semitonesBetween)`, exit 0 (3.6 RED — `semitonesBetween('G','D') === -5` runtime-asserted, L155) |
| 5 | `node -e "import('./src/lib/preferences.js').then(m=>m.demo&&m.demo())"` | `preferences demo OK: 12 asserts (defaults, D2 jsonb read shape, offline fallback)`, exit 0 (practice jsonb read shape `practice.songA.{key:'D', tempo:70}` — 3.6 data source) |
| 6 | Regressions | `gigs demo OK: 26 asserts` exit 0; `storage demo OK: 19 asserts` exit 0; `offlineCache demo OK: 6 asserts` exit 0 — data/offline/storage layers untouched by this slice |
| 7 | Spec compliance walk | See matrix: S5/S6/S7 ✅ COMPLIANT (this slice — version picker), S11/S12 ✅ COMPLIANT (this slice — practice key/tempo), S1–S4/S8–S10 ✅ COMPLIANT (prior slices, unchanged) → prefs **12/12, 6/6 requirements** |
| 8 | STAGE KEY UNCHANGED (3.6 rule) | Precise grep `practicePref\|prefs\.practice\|practice\.key\|practice\.tempo\|semitonesBetween\|displayBpm\|resetTempo\|metronome` over `src/pages/StageMode.jsx` → **zero matches (exit 1)**; `git diff 9852501 HEAD -- src/pages/StageMode.jsx` → **0 lines** — StageMode untouched by this slice (its only prefs wiring is 3a's transpose `initialSemitones(prefs.transpose, prefs.overrides[song.id])`, stage-key semantics, not practice prefs) |
| 9 | Budget (≤400) | `git diff --stat 9852501` → **9 files, 197 insertions(+), 25 deletions(−) = 222 changed ≤ 400** — matches the launch expectation exactly (197+/25− on main base) |
| 10 | tasks.md | 3.4–3.6 all `[x]`; change totals **31 `[x]` / 0 `[ ]`** (grep-verified) — no task of hito-2-remainder remains unchecked |
| 11 | S11/S12 runtime probes | Node probe exit 0: `semitonesBetween('G','D') → -5`, `transposeKey('G', -5) → 'D'`, `transposeParsed({key:'G'}, -5)` renders key + first chord **D** (practice view in D, S11); `displayBpm = practicePref?.tempo ?? song?.bpm` → baseline **70** with pref `{tempo:70}` over song 100, **100** without (S12) — numeric contracts proven at runtime, not just statically |
| 12 | S5/S6 resolution-logic probe | Node probe exit 0 replicating SongDetail's exact open-version effect: Pedro (`prefs.defaultVersion 'v2'`) opens `v2`, Juan (`'v1'`) opens `v1`, no-pref opens `versions[0]`, manual pick preserved; picker still offers the other version; repertoire lists both versions (personal, not shared) |

### Build & Tests Execution

**Build**: ✅ Passed
```text
$ pnpm build
$ vite build
✓ 131 modules transformed.
✓ built in 1.78s
(pre-existing warnings only: supabase.js dynamic-import notice — annotations.js + gigs.js + preferences.js;
 "Some chunks are larger than 500 kB after minification")
exit 0
```

**Tests**: ✅ exited 0 (no test framework — config `test_command: ""`; slice harness per tasks.md work-unit 6 = node demos; RED = transpose 28 (3.6 semitonesBetween) + S11/S12/S5/S6 runtime probes; regressions = gigs 26 / storage 19 / offlineCache 6 / annotations 11 / preferences 12)
```text
$ pnpm lint
$ eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0
exit 0 — 0 errors, 0 warnings

$ node -e "import('./src/lib/annotations.js').then(m=>m.demo&&m.demo())"
annotations demo OK: 11 asserts (anchors, substitution map, transpose movement, offline)
exit 0

$ node -e "import('./src/lib/transpose.js').then(m=>m.demo())"
transpose demo OK: 28 asserts (notes, keys, parsed, capo, initial semitones, semitonesBetween)
exit 0

$ node -e "import('./src/lib/preferences.js').then(m=>m.demo&&m.demo())"
preferences demo OK: 12 asserts (defaults, D2 jsonb read shape, offline fallback)
exit 0

$ node -e "import('./src/lib/gigs.js').then(m=>m.demo())"
gigs demo OK: 26 asserts (flatten, lifecycle, completion, venue, guards)
exit 0

$ node -e "import('./src/lib/storage.js').then(m=>m.demo&&m.demo())"
storage demo OK: 19 asserts (activate cleanup, eviction order + exemption, planEviction)
exit 0

$ node -e "import('./src/lib/offlineCache.js').then(m=>m.demo&&m.demo())"
offlineCache demo OK: 6 asserts (v3 additive upgrade, kv/outbox preserved)
exit 0

S11 probe: {"shift":-5,"rendered":"D","transposedChord":"D"} OK=true
S12 probe: pref-tempo-70 baseline=70, no-pref baseline=100 OK=true
S5/S6 probe: {"pedro":"v2","juan":"v1","noPref":"v1","manualKept":"v1","repertoireListed":2} OK=true
```

**Evidence digests (this run, exact bytes)**: `test_output_hash sha256:11d71e77…` = `pnpm lint` stdout (76 bytes, byte-identical to every prior envelope — lint output unchanged by this slice); `build_output_hash sha256:70bb3b94…` = `pnpm build` stdout (fresh — this run's transcript, 131 modules); `evidence_revision sha256:2a3e3b71…` = sha256 over the exact concatenated raw transcripts of this run, canonical order lint → build → annotations → transpose → preferences → gigs → storage → offlineCache (documented convention — recomputable by re-running the commands).

**Coverage**: ➖ Not available (no coverage tooling; threshold 0 per config)

### Spec Compliance Matrix (retrieved spec: specs/personal-preferences/spec.md — native counts 6 requirements / 12 scenarios; this slice completes the last 2 prefs requirements. Envelope completed counts **22/22 req, 51/51 scenarios** are the change-wide native authority — all 51 scenarios across the 4 specs (gigs 15, pwa-updates-storage 15, personal-preferences 12, row-level-security 9) are now COMPLIANT cumulative)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Persisted transpose preference | Singer sets a personal transpose offset | Verified PR#3a + #3b-annotations (library surface, non-mutating render) | ✅ COMPLIANT (prior slices) |
| Persisted transpose preference | Personal offset applies to every song | Verified PR#3a + #3b-annotations (all three chart surfaces seeded from prefs) | ✅ COMPLIANT (prior slices) |
| Persisted transpose preference | Per-song override beats the global preference | Verified PR#3a fix `08aa587` (replacement semantics; runtime chain C renders B) | ✅ COMPLIANT (prior slice) |
| Capo display | Capo preference shown on guitar charts | Verified PR#3b-annotations (SongDetail header) + this slice adds the Practice chart caller (`capoLabel(displayKey, prefs.capo)`, Practice L198–200) | ✅ COMPLIANT (prior slice + this slice practice surface) |
| Version preference and picker | Performer prefers a specific version by default | **This slice**: SongDetail open-version effect (L81–91): keeps a manual pick when still valid, else opens `prefs.defaultVersion` when it matches a version, else `versions[0]` (latest); `parsed` renders the OPEN version's own chart body (`openVersion.body`, S5 resolution-logic probe GREEN: Pedro→v2, Juan→v1, no-pref→latest, manual kept); picker `<select>` lists every version and marks `(default)` (L223–240) | ✅ COMPLIANT (3.5; per config verify=build convention — interactive pick walk = manual E2E WARNING) |
| Version preference and picker | Version preference is personal, not shared | Per-user `prefs:${userId}` read-through (3a); `flattenSong` exposes `versions[]` for EVERY version (songs.js L76–85 — id/name/number/key/bpm/durationSeconds/isReady/body, zero extra network, embedded `song_versions` + `chart_files`); repertoire picker lists all versions (S5/S6 probe: both users resolve independently, 2 versions listed) | ✅ COMPLIANT (3.5) |
| Version preference and picker | Choosing a version on a setlist item | **This slice**: SetlistDetail per-item `<select>` (shown when `versions.length > 1`, `''` = "Default (latest)") → `setSongVersion(setlist.id, songId, value || null)` (L197–214); chosen-version label `versionIds[songId] → versions[].name` visible next to the song title (amber, L191–195); data layer writes `setlist_items.version_id` (online: `.update({version_id})` + refetch + invalidate; offline: `enqueueOp` + optimistic `mutateVersions`, setlists.js L334–358); WRITE_OPS whitelist + `setSongVersion: setlists.setSongVersion` (offlineSync.js L19, valid export — D6); `flattenSetlist` builds `versionIds{}` from `version_id` (explicit absent-key = picker default) and both list/create/fetch selects now read `version_id` | ✅ COMPLIANT (3.5) |
| Personal annotations and chord substitution | Performer annotates their own copy | Verified PR#3b-annotations (anchored render, author-only) | ✅ COMPLIANT (prior slice) |
| Personal annotations and chord substitution | Personal chord substitution | Verified PR#3b-annotations (transposed match/render) | ✅ COMPLIANT (prior slice) |
| Annotations preserved across transpose | Annotations are preserved across transpose | Verified PR#3b-annotations (structural anchor, runtime probe) | ✅ COMPLIANT (prior slice) |
| Practice key and tempo preferences | Practice key differs from stage key | **This slice**: Practice baseline = `practicePref?.key ? semitonesBetween(parsed?.key, practicePref.key) : initialSemitones(global, override)` (Practice L75–79) — `semitonesBetween('G','D') = -5` demo-asserted + runtime probe (transposed key + first chord **D**); `displayKey` header + control bar show "Practice D · …"; **stage key unchanged**: StageMode zero practice-pref reads (check 8) + zero diff — Juan's setlist stage key G stays G for everyone | ✅ COMPLIANT (3.6 RED + runtime probes) |
| Practice key and tempo preferences | Personal tempo preference for practice | **This slice**: `displayBpm` baseline = `practicePref?.tempo ?? song?.bpm` (L56–60) — probe: 70 with pref, 100 without; manual `tempoOffset` resets when the baseline changes (L63–65) and `resetTempo` → pref tempo (offset 0); the practice surface's single BPM value (metronome/auto-scroll consumers read this baseline) drives the control-bar readout "Practice D · 70 BPM · ±N semitones" (L191–197); shared song metadata untouched (pref lives in `user_preferences.preferences` jsonb — song.bpm never mutated) | ✅ COMPLIANT (3.6 RED + runtime probe) |

**Compliance summary**: 12/12 personal-preferences scenarios COMPLIANT cumulative (this slice completes the final 5: S5, S6, S7 version picker + S11, S12 practice key/tempo — exactly the 3.5/3.6-owned work); 0 PARTIAL, 0 FAILING. **All 6 prefs requirements fully green**: Persisted transpose, Capo display, Version preference and picker, Personal annotations and chord substitution, Annotations preserved across transpose, Practice key and tempo preferences. **Change-wide final: 22/22 requirements, 51/51 scenarios** — gigs 7/7 (this closure also confirms the Notifications data-source requirement: the gig record provides `scheduled_at` (date + time) and `venue_id`→resolved venue name/location, per PR#1a's live-probe-verified data contract — the reminders feature itself is out of change scope), pwa-updates-storage 7/7, personal-preferences 6/6, row-level-security 2/2 (PR#0's 2-user psql RLS matrix + 1a.6 live isolation, recorded 2026-09-14). Every task of hito-2-remainder checked. Change-level envelope: **verdict PASS**.

### Correctness (Static Evidence)
| Check | Status | Notes |
|-------|--------|-------|
| Version picker writes `setlist_items.version_id` (3.5 core) | ✅ Implemented | `setSongVersion` (setlists.js L334–358): fetchSetlistById guard (owner-scoped) → `.update({ version_id: versionId || null })` scoped `.eq('setlist_id').eq('song_id')` → refetch + `invalidateSetlists`; `null` reverts to the picker default; offline catch → `enqueueOp` + optimistic `buildOptimisticSetlist` with `mutateVersions` (`{ ...versionIds, [songId]: versionId || undefined }`) — mirrors the addSongToSetlist read-through clone pattern |
| WRITE_OPS whitelist (D6) | ✅ Implemented | offlineSync.js L19 `setSongVersion: setlists.setSongVersion` — resolves to the real export; unknown-op warn+drop + FIFO replay semantics inherited (replay-safe; op is idempotent by setlist+song scoping) |
| `versionIds` flatten + picker defaults | ✅ Implemented | flattenSetlist (L65–84): `versionIds { songId: versionId }`, absent key = picker default (the SetlistDetail `''` option); every setlist select (`fetchSetlistById`, `listSetlists`, `createSetlist`) now includes `version_id`; buildOptimisticSetlist carries `versionIds` through read-through cache |
| Default version opens first, picker offers others (S5) | ✅ Implemented | SongDetail effect L81–91 (probe-verified logic): manual pick kept while valid → else `prefs.defaultVersion` if it matches a version → else `versions[0]`; `<select>` lists ALL versions with the default marked `(default)`; song header shows the OPEN version's key/BPM (L175–178) |
| `versions[]` from embedded rows, no extra network (S6) | ✅ Implemented | songs.js flattenSong L76–85 maps `song_versions` (already embedded in fetch/list selects) → `{id, name, number, key, bpm, durationSeconds, isReady, body}`; body = the version's own chart via its `chart_file_id` ('' when none — the picker default stays the latest chart); flattened raw-array name collision (`versions` vs `versionRows`) resolved in-slice |
| Practice key drive (3.6) | ✅ Implemented | Practice L54 `practicePref = prefs.practice?.[song.id]`; baseline L75–79 = practice key shift (`semitonesBetween(parsed?.key, practicePref.key)`) else 3a's global/override; re-seed effect on baseline change; `resetKey` → baseline; transposeParsed renders the shifted chart; control bar "Practice {key} · …" |
| Practice tempo drive (3.6) | ✅ Implemented | displayBpm baseline L56–60 = `practicePref?.tempo ?? song?.bpm` (clamped ≥ 20); tempoOffset reset effect on baseline change (L63–65); `resetTempo` → pref tempo; readout "70 BPM · …"; song.bpm untouched (pref is jsonb, read-only surface) |
| STAGE KEY UNCHANGED (3.6 rule) | ✅ Implemented | StageMode.jsx: zero practice-pref/tempo/key-shift/monotone matches (check 8, precise grep exit 1) + zero diff in this slice — the only StageMode prefs wiring is 3a's stage transpose (global/override), which the spec allows (personal transpose applies per-device); practice key never leaks to stage |
| Commit size within budget (check 9) | ✅ Implemented | `git diff --stat 9852501`: 9 files, 197+/25− = 222 ≤ 400 (setlists.js 59, SongDetail.jsx 45, Practice.jsx 38, SetlistDetail.jsx 26, transpose.js 23, songs.js 19, useSetlists.js 7, offlineSync.js 1, tasks.md 4) — exact launch expectation |
| tasks checked (check 10) | ✅ Implemented | 3.5/3.6 `[x]`; 31 `[x]` / 0 `[ ]` change-wide — **no task remains unchecked** |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D7 version picker writes `setlist_items.version_id` (schema exists, 0001 L182) | ✅ Yes | `setSongVersion` writes the existing schema column; no migration; per-item label visible to bandmates (setlist read shared); personal transpose still applies per-device on top (separate read path) |
| D7 practice key/tempo are per-song jsonb prefs (Practice L14–15 hardcode 0 today) | ✅ Yes | `prefs.practice?.[song.id]` jsonb read (D2 shape, demo-asserted); practice surface baseline key + tempo derive from it; stage key unchanged (StageMode untouched) |
| D7 capo display (3b renderer boundary) | ✅ Yes | Practice chart header surfaces `capoLabel(displayKey, prefs.capo)` — the final chart surface from the 3a boundary list now displays capo/sounds |
| D6 offline queue integration | ✅ Yes | setSongVersion joins WRITE_OPS with the exact setlists.js clone pattern (online update → offline enqueueOp + optimistic mutate) — same convention as addSongToSetlist |
| D8 PR slicing: 3b-player = version picker + practice key/tempo wiring | ✅ Yes | Fileset matches tasks.md 3.5/3.6 exactly; no stage-mode, SW, storage, or gigs changes; annotations core (3.4) untouched (demo 11/11 regression clean) |

### Issues Found
**CRITICAL**: None
**WARNING**:
- Manual browser E2E remains manual (config `e2e: false`, no browser framework): picker select → label update walk on SetlistDetail, SongDetail default-version open + picker switch, Practice metronome/auto-scroll consumption at a real 70 BPM baseline. This run's runtime evidence is node demos (transpose 28 incl. semitonesBetween; regressions 26/19/6/11/12 — all exit 0), the S11/S12/S5/S6 probes, lint/build exit 0, and structural source inspection — classified COMPLIANT per config's verify=build convention (same standard as all prior verified slices); a manual browser pass is recommended before merge.
- `apply-progress.md` Batch 9 records `setlists demo exit 0` but `src/lib/setlists.js` statically imports `supabase.js`, whose `import.meta.env.VITE_SUPABASE_URL` read aborts plain-node imports (documented pre-existing limitation, PR#1c songs.js precedent; setlists.js demo covers duration helpers only, not the 3.5 flatten path). Record-accuracy note — the 3.5 write path is verified here via source inspection + probe, and `versionIds` flatten correctness rests on build parse + the S5/S6 probes.
- The metronome/auto-scroll consumers themselves are not present in the repo (Hito-1 practice is a thin view — grep for `metronome|auto.?scroll|setInterval` in src matches only 3.6 comments). `displayBpm` is the practice surface's single BPM value and the value those consumers read; the scenario's numeric contract (70 vs 100, offset reset, reset-to-pref) is runtime-probed. Recorded so the gap between "value drives X" and "X exists" is explicit, not silent.
**SUGGESTION**:
- Default-version opening reads `prefs.defaultVersion`, which the read-only Settings screen (3a posture) never writes yet — behavior holds (personal per-user pref + picker offers all versions), but the "set a default" UI is a future mutation-surface slice.
- Non-latest versions render their own chart body when picked; the practice link still targets the latest chart (existing behavior) — fine while practice inherits the open version's body via SongDetail state; a later slice could deep-link practice per open version.

### Verdict
PASS (change-level closure)
PR#3b-player (`d965059`): 2/2 in-scope tasks complete (3.5, 3.6); `pnpm lint` exit 0 zero warnings (hash `11d71e77…`, byte-identical); `pnpm build` exit 0 (131 modules, fresh hash `70bb3b94…`); demos exit 0 (transpose 28 — semitonesBetween RED; annotations 11, preferences 12, regressions gigs 26 / storage 19 / offlineCache 6 — untouched layers green); S11 probe (G→D = −5 → practice renders D) + S12 probe (pref 70 ?? song 100 → 70/100) + S5/S6 resolution-logic probe all exit 0; version picker writes `setlist_items.version_id` with online/offline/optimistic paths and WRITE_OPS whitelist; default version opens first with all versions offered; **StageMode zero practice-pref reads + zero diff (stage key unchanged)**; 222 changed lines (197+/25−) ≤ 400; tasks.md 31 `[x]` / 0 `[ ]`. **Change-level envelope flipped to PASS: 22/22 requirements, 51/51 scenarios** (prefs 6/6, gigs 7/7 incl. notifications data contract, pwa 7/7, rls 2/2); 0 critical. Warnings: manual browser E2E walk recommended pre-merge (standing across all slices); setlists.js bare-node demo limitation + absent metronome/auto-scroll consumers recorded for accuracy.