## Exploration: hito-2-remainder — Gigs & Performance History, PWA Updates & Storage, Personal Preferences & Adaptations

### Current State

**Base that exists (Hito 1 + Hito 2 core, PR #87):** React 18 plain JSX + Vite + Tailwind PWA shell with routes `/`, `/songs`, `/songs/:id`, `/songs/:id/practice`, `/setlists`, `/setlists/:id`, `/setlists/:id/stage`, `/auth`. Data layer is supabase-js against hosted Supabase with owner-scoped RLS (`0002_rls_core.sql`, `0003_chart_content_rls.sql`). Offline: hand-written `public/sw.js` (cache-on-fetch, cache-first GET, network-first nav), IndexedDB read-through cache (`offlineCache.js`) + FIFO write queue (`offlineQueue.js`, DB `cemurm-offline` v2, stores `kv` + `outbox`) drained by `offlineSync.js` — **setlist writes only** (5-op whitelist). Foot pedal maps persist in `device_configs`. Strictly no test framework, no typecheck; verify = `pnpm build` + `pnpm lint` + manual walk.

**Schema surface (0001_init.sql — 48 tables, all present):**
- `venues` (owner_id, name, location, type — no geo), `gigs` (org_id NOT NULL, branch_id, owner_id, name, venue_id, scheduled_at, setlist_id, status planned|confirmed|completed|cancelled, shared_to_branch), `performances` (gig_id — exactly ONE per completed gig, venue_id, performed_at), `performance_items` (performance_id, song_id, version_id, state played|skipped|off_setlist via `play_state` enum, position). Demand-count comment: `COUNT(distinct performance)` per song.
- `setlist_items`: version_id (chosen version), agreed_key, vocal_parts jsonb, notes — supports version preference, agreed key, duet parts at schema level.
- `song_versions`: base_key, base_tempo, owner_id; 0003 RLS notes "only the version owner may rebase" — owner check for rebase at DB level.
- `personal_annotations` (user_id, song_id, anchor jsonb, kind note|chord_substitution, value) + full self-CRUD RLS (0002).
- `device_configs` (user_id, device_id, midi_output, pedal_switches jsonb, display_mode) — pedal-specific today, no generic preference record.
- Server `outbox` (D10) exists with INSERT/SELECT self RLS but is **unused by the client**.

**Per-feature state:**

*Gigs (#44, 18 scenarios) — ~0/18 implemented.* No Gigs page/route/lib/hook anywhere. `gigs`/`venues`/`performances`/`performance_items` are revoked in 0002 (lines 93–96) with **zero policies created** — deny-by-default for authenticated, so even a raw write would 403. StageMode has no post-show/completion flow. Offline queue has no gig ops. Non-goal scenarios are already satisfied by absence.

*PWA Updates & Storage (#47, 18 scenarios) — partial, most missing.* `sw.js` exists but installs with `skipWaiting()` + `clients.claim()`, so a new SW **activates mid-session** — directly violates "update never applies mid-session" and "no prompt/reload during Stage/Practice". No update detection, no updatefound handler (main.jsx registers SW in PROD only), no Material prompt, no storage screen, no `navigator.storage.estimate`/quota logic, no eviction, no tooltips. Offline queue survival across updates holds **by construction** (SW `activate` deletes only Cache API entries `cemurm-v1`, never IDB), but is unproven/uninstrumented. No `manifest.json`/icons in `public/` (only `sw.js`) — app not installable (adjacent gap; not a #47 scenario).

*Preferences (#55, 39 scenarios) — raw capabilities only (~4/39).* transpose.js (pure, semitone-based, no slash-chord roots like C/E, no capo) + StageMode/Practice local transpose state (not persisted). personal_annotations schema+RLS exist, zero UI. setlist_items agreed_key/version_id/vocal_parts exist, zero UI. No `user_preferences` table; `device_configs` is pedal-bound. No capo, no observed-range, no event/band context, no orchestral instruments, no conflict machinery anywhere.

### Gap Analysis Per Feature

| Feature | Scenarios | Implemented | Missing (gap) |
|---|---|---|---|
| Gigs (#44) | 18 | 0 | All: gig CRUD UIs, venue suggestion/reuse, lifecycle (confirm/cancel/complete), performance record (played/skipped/off_setlist), post-show flow, offline gig write path, **RLS migration for 4 tables** |
| PWA Updates (#47) | 18 | ~2 (SW exists; queue survives by construction) | Update detection/background install, no-mid-session activation (fix skipWaiting), once-per-session prompt w/ Later, Stage/Practice deferral, tooltips (hand off to onboarding), silent offline check, failed-download/activation resilience, storage screen w/ category breakdown, per-category clear, quota warning + one-tap cleanup, age-ordered eviction of derived caches only |
| Preferences (#55) | 39 | ~4 (transpose engine, annotations schema+RLS, setlist_items columns) | Everything else. **Major slice:** org/band/event-context scenarios, key-conflict proposals, leader-resolved conflicts, observed-range + setlist fit warnings, range history — these depend on org model (Hito 4), collaboration (Hito 3), analytics (Hito 6) and CANNOT ship in Hito 2 |

### Dependencies Between the Three

1. **Gigs → Preferences**: rebase proposals ("usually performed in D") and observed-range learning read `performance_items`; they need #44's write path first. Even so, those scenarios open "song analytics" (Hito 6) — defer regardless.
2. **Gigs → PWA**: offline gig completion rides the existing IDB queue; #47's "queue survives update" contract must cover gig ops once added. Order: extend the queue (gigs slice) before/with #47 guarantees.
3. **Preferences → Stage/Practice transpose**: preference application is a pure front-end layer over the existing transpose engine + setlist_items columns; no new infra, but needs the preference persistence decision first.
4. **#47 tooltips** → user-onboarding (Hito 6) per feature's own note — contract hand-off, not a blocker.
5. **Gigs → Notifications (Hito 3)**: gig record is the reminder data source; #44 only must store date/time/venue. No Realtime work needed by any of the three.

### Approaches

1. **One change, three chained PR slices, issue-per-slice** — `hito-2-remainder` ships as: (a) Gigs RLS migration + online-first gigs + performance record; (b) offline gig ops + PWA update pipeline + storage screen; (c) personal-preferences slice (org-free scenarios only).
   - Pros: single change matches the three issues; each PR independently verifiable; dependencies (gigs→queue→prefs) ordered naturally; RLS migration lands first as the hard blocker.
   - Cons: largest coordination surface; 400-line review budget forces disciplined slicing.
   - Effort: High (≈3 PRs, notably >400 changed lines each; forecast High).

2. **Gigs and PWA first (#44 + #47), preferences slice deferred to Hito 3** — ship the two data/runtime-safe surfaces now.
   - Pros: #55's non-org scenarios still need a preference-storage decision and are cleanly deferrable; right-sizes Hito 2 remainder to two issues.
   - Cons: the three issues were filed as one "resto de Hito 2" batch; #55's personal offset/capo/annotations are the most user-visible adaptations and would slip a hito.
   - Effort: Medium-High.

3. **Schema-first mini-slice** — migration 0004 (gig RLS + preferences storage decision) as its own PR before any UI.
   - Pros: unblocks everything; tiny review; de-risks the rest.
   - Cons: not a shippable feature alone.
   - Effort: Low. *(Recommended as PR #0 inside approach 1.)*

### Recommendation

Explore only — but the grounded path is **Approach 1 with a schema-first slice**:
1. Migration PR: owner-scoped RLS for `gigs`/`venues`/`performances`/`performance_items` (follow 0003 pattern: revokes already done in 0002, add policies + grants), + preference-storage decision (new `user_preferences` table vs. generalizing `device_configs`; exploration leans new table with kind/value or per-column prefs, keeping `device_configs` pedal-bound).
2. Gigs slice: lib (`src/lib/gigs.js`) + hook + pages (list/detail/create/edit, venue suggestion from prior venues, lifecycle, complete → exactly one `performances` row + `performance_items` with played/skipped/off_setlist), post-show flow entry from StageMode; online only.
3. PWA slice: versioned SW (drop mid-session activation: no unconditional skipWaiting/claim; updatefound → one prompt per session with "Update now/Later"; no prompt in Stage or Practice), silent offline checks, storage screen (categories = what exists today: Songs, Setlists & Gigs, plus 0-byte placeholders for PDF scans/exports per the feature contract), quota warning + one-tap cleanup + age-ordered eviction of derived caches only — never user data.
4. Preferences slice: org-free scenarios only — global offset + per-song override (persisted), capo display ("Capo 2 · sounds D"), version default + setlist-item version picker, personal annotations + chord substitution UI (schema ready), practice key/tempo preferences, annotations preserved across transpose. Explicitly defer to Hito 3+: all band/event/org-context scenarios, agreed-key proposals/conflicts, observed range + setlist fit, range history, orchestral section beyond a single transposing-instrument preference.

### Risks

- **RLS gap is a hard blocker for #44**: zero policies on gig tables → any PR touching them 403s until migration 0004 lands. Must be the first task.
- **Scope: 75 scenarios, ~30% partial at best.** Even the recommended slice is multi-hundred-line; 400-line review budget → chained PRs mandatory (`sdd-tasks` forecast answer will be Yes).
- **SW behavioral conflict**: today's `skipWaiting()` + `clients.claim()` activates mid-session — the #47 update pipeline must remove it, and that changes existing update behavior users may already be relying on.
- **IDB version coordination**: `offlineCache.js`/`offlineQueue.js` share DB version 2 in lockstep; adding gig-cache entities or stores must bump the version in BOTH modules or the cache permanently disables (their documented failure mode). #47 queue-survival tests must cover this.
- **transpose.js ceilings**: no slash-chord roots (C/E) and no capo support; duet "harmony line anchored to chord changes" and capo scenarios need engine or renderer-level extension.
- **No test runner**: 75 BDD scenarios cannot be machine-verified; verification = build + lint + manual scenario walk. Verify phase must state this ceiling explicitly.
- **Deferred-scenario risk in #55**: if the slice boundary is not named in the delta spec, proposal/spec drift will pull org/collaboration/analytics scenarios into Hito 2. Name them explicitly as deferred.
- **Manifest absence**: app not installable; adjacent to #47 (not covered by its scenarios) — flag in proposal so it isn't silently assumed done.

### Affected Areas

- `supabase/migrations/0004_*.sql` (new) — gig RLS + preferences storage; only migration writes allowed, pattern after `0003_chart_content_rls.sql`.
- `src/lib/gigs.js` (new), `src/lib/offlineQueue.js`, `src/lib/offlineSync.js` — gig data layer + queue ops.
- `src/hooks/useGigs.js` (new), `src/pages/Gigs.jsx` + `GigDetail.jsx` (new), `src/App.jsx` — routes.
- `src/pages/StageMode.jsx` — post-show completion flow entry point.
- `public/sw.js`, `src/main.jsx` — update pipeline (remove skipWaiting/claim pattern), updatefound handling.
- `src/lib/offlineCache.js` — storage screen reads (per-category key prefixes); coordinate DB version bump.
- `src/lib/transpose.js` — capo support; slash-chord decision.
- `src/components/notation/` — capo/annotation rendering surface.
- `src/lib/preferences.js` (new), `src/hooks/usePreferences.js` (new), `src/pages/Settings.jsx` (new) — preference persistence + UI.
- `src/pages/Practice.jsx`, `src/pages/SetlistDetail.jsx` — consume preferences (practice key/tempo), version picker + agreed key display.

### Ready for Proposal

Yes — grounded enough to move to `sdd-propose`. The proposal should: fix the org-free slice boundary for #55 (list the deferred scenario classes), mandate migration 0004 first, and carry a chained-PR delivery plan. Tell the user the two open product questions before proposal: (1) okay to defer the org/band/event-context and analytics-fed scenarios of #55 to Hito 3/6? (2) preference storage shape (new `user_preferences` table — recommended — vs. extending `device_configs`).