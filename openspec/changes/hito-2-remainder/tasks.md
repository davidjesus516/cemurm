# Tasks: Hito 2 Remainder — Gigs, PWA Updates & Storage, Personal Preferences

## Review Workload Forecast

| PR | Content | Est. | Risk |
|----|---------|------|------|
| #0 | 0004 RLS + user_preferences + org helper | 230 | Low |
| #1a | gigs data CRUD + 0005 public wrapper | 330 | Low |
| #1a-lifecycle | completion chain + venue reuse + offline ops + seed | 250 | Low |
| #1b | gigs UI + routes | 380 | Low |
| #1c | stage completion + played tags | 200 | Low |
| #2a | SW pipeline + IDB v3 + queue ops | 380 | Low |
| #2b | storage screen + eviction | 250 | Low |
| #3 | preferences core | 380 | Medium (borderline) |

Decision needed before apply: No — resolved (maintainer authorized the #1a / #1a-lifecycle split; 0005 fixes the PR#1a PGRST202 blocker)
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

PR#3 contingency: if >400, split annotation rendering into #3b. No `size:exception` otherwise.

### Suggested Work Units

| Unit | Goal | PR | Focused test | Runtime harness | Rollback |
|------|------|-----|--------------|-----------------|----------|
| 0 | 0004 gig/prefs RLS | #0 | `supabase db reset` + SQL checks | 2-user psql session | revert 0004 |
| 1 | gigs data + seed | #1a | `node -e "import('./src/lib/gigs.js').then(m=>m.demo())"` | offline→reconnect walk | revert gigs.js/useGigs/seed |
| 2 | gigs UI + routes | #1b | `pnpm build && pnpm lint` | manual create/edit/cancel walk | revert UI + route diffs |
| 3 | completion + tags | #1c | `pnpm build` | manual post-show complete | revert StageMode/SongDetail |
| 4 | SW + IDB v3 + queue | #2a | `node -e "import('./src/lib/offlineCache.js').then(m=>m.demo())"` + sync demo | dev-browser update + offline walk | redeploy prior SW; revert files |
| 5 | storage + eviction | #2b | `pnpm build` | manual category-clear walk | revert Storage.jsx |
| 6 | preferences | #3 | `node -e "import('./src/lib/transpose.js').then(m=>m.demo())"` | manual settings/stage walk | revert prefs files |

## PR#0 — 0004 Migration (base: main)

- [x] 0.1 Create `supabase/migrations/0004_gig_and_preferences_rls.sql`: `gigs`/`venues` owner policies (`owner_id = auth.uid()`, initPlan guard per 0002 L130)
- [x] 0.2 `performances`/`performance_items`: exists-subquery via `gigs.owner_id`, 4 policies each, UPDATE using+with check (D1)
- [x] 0.3 Add `private.session_org_ids()` SECURITY DEFINER helper (approved scope; org enforcement Hito 4)
- [x] 0.4 Create `user_preferences` (PK `user_id`, typed + jsonb) + owner policies + grants (D2)
- [x] 0.5 RED SQL: demo user sees own rows, second user zero on 4 gig tables, prefs self-only (RLS spec)

## PR#1a — Gigs Data Layer

- [x] 1a.1 Create `src/lib/gigs.js`: data-layer CRUD (gig/venue/performance/items via supabase client, `owner_id`/`org_id` on insert, `resolveOrgId` → `public.session_org_ids()`) + CRUD-focused `demo()`; lifecycle/offline parts deferred
- [x] 1a.2 Create `supabase/migrations/0005_public_session_org_ids.sql` — public SECURITY DEFINER bridge to `private.session_org_ids()` (fixes the PGRST202 blocker; private schema is not exposed to PostgREST)
- [x] 1a.3 Create `src/hooks/useGigs.js` per useSongs pattern (CRUD subset; completion wrapper returns with the lifecycle slice)
- [x] 1a.4 Completion chain: one `performances` + `performance_items` (played|skipped|off_setlist), no duplicates; lifecycle transitions (offline `enqueueOp`/`pendingSync` wrappers → PR#2a 2a.6)
- [x] 1a.5 Venue suggestion/reuse helpers (gigs venue scenarios): `findVenueByName` + case-insensitive `createVenue` reuse
- [x] 1a.6 Seed gig/venue/performance/user_preferences rows in `supabase/seed.sql` (incl. isolation row; live RLS chain verified)

## PR#1b — Gigs UI

- [x] 1b.1 Create `src/components/GigCard.jsx` + `VenueAutocomplete.jsx`
- [x] 1b.2 Create `src/pages/Gigs.jsx`: list + create (one linked setlist)
- [x] 1b.3 Create `src/pages/GigDetail.jsx`: edit/confirm/cancel/reopen + setlist swap
- [x] 1b.4 `/gigs` (read-only) + `/gigs/:id` (read-only) routes in `src/App.jsx`, nav in `AppLayout.jsx`

## PR#1c — Stage Completion + Played Tags

- [x] 1c.1 StageMode post-show "mark played" → `completeGig` writes single performance (spec post-show scenario)
- [x] 1c.2 Played tags + demand count in `src/lib/songs.js`/`SongDetail.jsx`; never tag skipped

## PR#2a — SW Pipeline + IDB v3 + Queue Ops

- [x] 2a.1 RED demo: v3 upgrade preserves kv/outbox rows (threat RED 3)
- [x] 2a.2 v3 lockstep `offlineCache.js`+`offlineQueue.js` ONE commit: additive `<1 kv → <2 outbox → <3 cache-meta` ({bytes,savedAt}), never drop stores (D5)
- [x] 2a.3 RED demo: no `controllerchange` until SKIP_WAITING/next load; activate deletes only foreign-prefix caches (threat RED 1+2)
- [x] 2a.4 `public/sw.js`: versioned caches `cemurm-{shell|songs|pdf|exports|data}-v${VERSION}`, no skipWaiting/claim, cache-meta on put/delete, UPDATE_READY/SKIP_WAITING (D3)
- [x] 2a.5 `src/lib/updateManager.js` + PROD register in `src/main.jsx`: once/session prompt (sessionStorage), defer on `/setlists/:id/stage` (read-only) + `/songs/:id/practice` (read-only), silent offline retry
- [x] 2a.6 `WRITE_OPS` in `src/lib/offlineSync.js` + client `createGig`/`updateGig`/`completeGig` enqueue wrappers (moved from 1a.4): replay-safe complete via existence check; unknown op warn+drop (D6)

## PR#2b — Storage Screen + Eviction

- [x] 2b.1 Create `src/pages/Storage.jsx` + route: total + 4 categories (Songs/PDF/Exports/Setlists+gigs), offline-visible; clear deletes only that prefix (storage spec)
- [x] 2b.2 Quota warning + one-tap cleanup; evict PDF→exports→derived by age (cache-meta); never shell/active setlist/user data

## PR#3 — Preferences

- [ ] 3.1 Create `src/lib/preferences.js` + `src/hooks/usePreferences.js`: read-through `prefs:${userId}`, global/override/practice jsonb (D2)
- [ ] 3.2 Create `src/pages/Settings.jsx` + `/settings` (read-only) route/nav: transpose, capo, default version
- [ ] 3.3 `src/lib/transpose.js` capo helper "Capo N · sounds X"; initial semitones = global+override in StageMode/Practice (D7)
- [ ] 3.4 `ChordProRenderer.jsx`: annotations (`personal_annotations`, anchor `{section,index}`) + substitution (transposed match/render); preserved across transpose
- [ ] 3.5 Version picker → `setlist_items.version_id`; default version opens first, picker offers others (version scenarios)
- [ ] 3.6 Practice key/tempo drive metronome/auto-scroll; stage key unchanged (practice scenarios)