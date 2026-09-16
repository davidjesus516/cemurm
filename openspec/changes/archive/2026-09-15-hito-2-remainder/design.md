# Design: Hito 2 Remainder — Gigs, PWA Updates & Storage, Personal Preferences

## Technical Approach

Stacked PRs (4 named → 7 slices) on the Hito 1 layering. 0004 extends the 0002/0003 RLS pattern (exists-subquery scope inheritance). Gigs/preferences data layers clone the `setlists.js` read-through + `enqueueOp` + optimistic `pendingSync` pattern. SW pipeline replaces `skipWaiting()` mid-session activation with versioned caches + waiting-SW next-load activation. IDB v2→v3 lockstep bump adds `cache-meta` for storage accounting. Spec authority: storage categories are Songs / PDF scans / Exports / Setlists and gigs (`pwa-updates-and-storage.feature` L128-133).

## Architecture Decisions

### D1 — RLS shape: performances/performance_items
| Option | Tradeoff | Decision |
|---|---|---|
| exists-subquery to gigs | Matches 0003 (`chart_files`→`songs`); acyclic policy graph (0002 header L136-141) | **Choose** — `exists (select 1 from gigs g, performances p where p.id = performance_items.performance_id and g.id = p.gig_id and g.owner_id = (select auth.uid()))` |
| Joins in USING | Row multiplier; no precedent | Reject |
| Add `owner_id` to performances | Schema change = scope expansion | Reject |

Both tables get 4 policies (select/insert/update/delete) using the same SHAPE; UPDATE `using`+`with check` both written (0002 L130-134).

### D2 — user_preferences shape
| Option | Tradeoff | Decision |
|---|---|---|
| Typed columns + jsonb | Hot render reads typed; evolving prefs flexible | **Choose**: `user_preferences (user_id uuid PK REFERENCES auth.users ON DELETE CASCADE, transpose_offset smallint NOT NULL DEFAULT 0, capo smallint NOT NULL DEFAULT 0, preferences jsonb NOT NULL DEFAULT '{}')` |
| All-columns | Migration per new pref (Hito 3/4/6 drift) | Reject |
| All-jsonb | Untyped hot path | Reject |

PK enforces one row/user. Precedent: `notification_preferences.categories` jsonb. Per-song overrides/versions/practice prefs live in `preferences` jsonb. Client: `src/lib/preferences.js` + `hooks/usePreferences.js`, read-through per setlists.js, cache keys `prefs:${userId}`.

### D3 — SW update pipeline
| Option | Tradeoff | Decision |
|---|---|---|
| Versioned caches + waiting SW | Activates next load, never mid-session | **Choose** |
| Keep `skipWaiting()` | Mid-session swap (current bug) | Reject |

Cache names `cemurm-{shell\|songs\|pdf\|exports\|data}-v${VERSION}`; `install` precaches shell; `activate` deletes only caches not matching current prefixes; NO `clients.claim()` (old SW keeps current tabs). New SW installs → `waiting` → posts `{type:'UPDATE_READY'}` → app prompts once/session (`sessionStorage['cemurm:update-dismissed']` — survives in-session reloads, cleared on tab close = natural start). Route guard: route prefix `/setlists/:id/stage` or `/songs/:id/practice` → suppress prompt + defer. "Update now" → `registration.waiting.postMessage({type:'SKIP_WAITING'})` + reload. Offline check → silent, retry next start; failed download/activation → browser keeps old SW, current version intact.

### D4 — Storage categories & eviction
| Option | Tradeoff | Decision |
|---|---|---|
| Category prefix = cache name | One SW cache per category; clear = `caches.delete` | **Choose** |
| All in one cache | Cannot clear per category | Reject |

**User-authored (never evicted)**: `outbox` store, `pending:` keys, kv values with `data.pendingSync`, raw local gig/performance/practice records. **Derived (evictable)**: Cache Storage entries + non-pending kv read copies of server rows. Category clearing deletes only its cache prefix (plus matching non-pending kv copies); underlying rows untouched. Eviction order: PDF scans → Exports → remaining derived by age (bytes/age from `cache-meta`); shell + active setlist's songs never evicted (critically-low: only shell + active setlist survive).

### D5 — IDB lockstep v3
Upgrade (both `offlineCache.js` and `offlineQueue.js` open version 3, same commit — drift = VersionError disables cache, offlineQueue.js L22-28): `oldVersion<1` → `kv`; `<2` → `outbox`; `<3` → `cache-meta` (per-cache `{bytes, savedAt}` updated on every SW cache put/delete — powers storage screen + eviction age). Strictly additive; the upgrade callback NEVER drops stores. IDB is origin-scoped → SW swap never touches it; queue + `pendingSync` writes survive updates by construction.

### D6 — Offline gig ops
`WRITE_OPS` (offlineSync.js L11-17) gains `createGig`, `updateGig` (incl. setlist swap + status), `completeGig`. Same FIFO array per user — gig ops interleave with setlist ops in creation order (persist across updates via D5). **Replay safety**: `completeGig` is a composite op (gig status + one `performances` + `performance_items`) that checks server for an existing performance per `gig_id` before inserting — exactly one record, never a duplicate. Unknown op → warn + drop; failure → break keeps order (existing semantics).

### D7 — Preferences core UI
| Option | Tradeoff | Decision |
|---|---|---|
| Capo = physical fret int | Display-only; rendered key = base + personal offset; "Capo N · sounds X" (`transposeKey(rendered, capo)`); shapes unchanged | **Choose** (scenario L35-39 fixes rendered C + capo 2 → sounds D) |
| Capo = semitone offset | Double-applies with transpose | Reject |

Slash chords: **DEFERRED** — transpose.js explicitly documents no slash-bass support (L3-4); substitution scenarios use plain chords; the engine change is a documented upgrade path, flag for a later change. StageMode/Practice initial `semitones` = per-song override, falling back to global (override REPLACES global — spec "explicit per-song preference wins"; StageMode L16 resets to 0 today). Annotations render in `ChordProRenderer` from `personal_annotations` (note: anchor `{section,index}`; substitution: match transposed chord token, render transposed target). Practice key/tempo are per-song jsonb prefs (Practice L14-15 hardcode 0 today); stage key unchanged. `/settings` route + `Settings.jsx` for defaults; version picker writes `setlist_items.version_id` (schema exists, 0001 L182).

### D8 — PR slicing (Stacked to main)
| PR | Content | Forecast |
|---|---|---|
| #0 | `0004_gig_and_preferences_rls.sql` (+ `session_org_ids` helper) | ~200, Low |
| #1a | `lib/gigs.js`, `useGigs.js`, seed gig/venue/performance rows | ~330 |
| #1b | `Gigs.jsx`, `GigDetail.jsx`, `GigCard.jsx`, `VenueAutocomplete.jsx`, App routes, nav | ~380 |
| #1c | StageMode completion entry, played-tags + demand (songs.js/SongDetail) | ~200 |
| #2a | IDB v3 lockstep + `cache-meta` + SW versioned pipeline + `update-prompt` UI + queue gig ops | ~380 |
| #2b | Storage screen + quota warning + eviction | ~250 |
| #3 | `lib/preferences.js`, `usePreferences.js`, `Settings.jsx`, transpose/capo/annotation rendering, version picker | ~380, borderline |

**Honest forecast**: PR#1 (gigs) CANNOT fit one 400-line slice → 3 sub-slices (#1a-c). PR#2 → 2 (#2a-b). No `size:exception` unless #3 overruns — acceptable as-is. Chain order preserves dependency: each PR's tables/policies exist via #0 before code references them.

## Data Flow

```
Preferences: prefs:${userId} (IDB) → usePreferences → initial semitones (Stage/Practice)
  → transposeParsed(override ?? global) → annotations overlay → render

Gig complete: StageMode → completeGig → online: insert chain
  └─ offline: enqueueOp → outbox (FIFO) → reconnect → drainPending replay → clear flag

Update: SW installs new caches → waiting → UPDATE_READY → sessionStorage+route guard
  → prompt → SKIP_WAITING + reload | next natural load activates
```

## File Changes

| File | Action | Description |
|---|---|---|
| `supabase/migrations/0004_gig_and_preferences_rls.sql` | Create | gig-table policies, `user_preferences` + policies, `private.session_org_ids()` helper, grants |
| `src/lib/gigs.js` | Create | gig CRUD/lifecycle/performance + venue suggestion, read-through + queue per setlists.js |
| `src/hooks/useGigs.js` | Create | state hook per useSongs.js pattern |
| `src/pages/Gigs.jsx`, `GigDetail.jsx`, `components/GigCard.jsx`, `VenueAutocomplete.jsx` | Create | gig UI |
| `src/pages/Settings.jsx` | Create | preferences UI |
| `src/lib/preferences.js`, `hooks/usePreferences.js` | Create | user_preferences client + hook |
| `src/lib/updateManager.js` | Create | SW registration, UPDATE_READY, prompt state, route guard |
| `src/pages/Storage.jsx` | Create | 4-category storage screen + quota cleanup |
| `public/sw.js` | Modify | versioned caches, no skipWaiting/claim, cache-meta writes, waiting-SW messaging |
| `src/main.jsx` | Modify | SW registration via updateManager (PROD only) |
| `src/lib/offlineCache.js`, `offlineQueue.js` | Modify | lockstep v3 + `cache-meta` store |
| `src/lib/offlineSync.js` | Modify | + createGig/updateGig/completeGig ops |
| `src/lib/transpose.js` | Modify | capo display helper only (sounds-key); slash chords untouched |
| `src/pages/StageMode.jsx`, `Practice.jsx`, `SongDetail.jsx` | Modify | prefs initial transpose; completion entry; annotations/capo rendering |
| `src/components/notation/ChordProRenderer.jsx` | Modify | annotations + chord substitution overlay |
| `src/App.jsx`, `components/layout/AppLayout.jsx` | Modify | gigs/settings/storage routes + nav |
| `supabase/seed.sql` | Modify | gig/venue/performance/user_preferences seed rows |

## Interfaces / Contracts

RLS shape (both performances + performance_items; initPlan guard `(select auth.uid()) is not null` per policy, 0002 L130):

```sql
create policy performances_select_owner on public.performances for select to authenticated
using ((select auth.uid()) is not null and exists (
  select 1 from public.gigs g
  where g.id = public.performances.gig_id and g.owner_id = (select auth.uid())));
```

SW messages: SW→client `{type:'UPDATE_READY'}`; client→SW `{type:'SKIP_WAITING'}` (updateManager listens `navigator.serviceWorker.ready` / `registration.waiting` transitions). Queue ops: `{name:'completeGig', args:[userId, gigId, {status, performance, items}]}` — one op per entity; `cache-meta` records `{bytes, savedAt}` per cache on put/delete.

## Testing Strategy

No test runner (config: strict_tdd false; verify = `pnpm build`). RED via `demo()` assert self-checks (repo pattern, transpose.js L78-101) + SQL sessions against local Supabase.

| Layer | What | Approach |
|---|---|---|
| Unit (demo) | `gigs.js` pure helpers, capo sounds-key, substitution transpose, v3 upgrade path, WRITE_OPS replay, eviction ordering | assert `demo()` |
| Integration | RLS: non-owner reads zero rows on gigs/venues/performances/performance_items; `user_preferences` one-row + self-only; queue survival across SW update | psql/Supabase SQL checks + manual |
| E2E | update activates next load, once-per-session prompt, stage/practice deferral, storage categories + eviction, offline gig create→complete→sync | manual walk |

## Threat Matrix

All five matrix rows **N/A** — no shell commands, subprocesses, VCS/PR automation, or executable-file classification in this change (client-side PWA; the chained-PR mechanics are orchestrator-side, not shipped code). The **SW process-integration boundary** is applicable separately: safe = waiting SW never activates mid-session without user action, IDB untouched, old version keeps serving on failed activate; failure = mid-session swap/blanking or queue loss. RED tests: (1) update downloaded → no `controllerchange` until SKIP_WAITING or next load; (2) activate deletes only foreign-prefix caches; (3) v3 upgrade preserves kv/outbox rows (survival scenario).

## Migration / Rollout

No data migration (additive DDL only). Rollout: PR#0 first (0004 gate — gig code 403s without it); per-PR rollback = revert merged PR; SW rollback = redeploy prior SW, derived caches only, IDB/queue untouched.

## Resolved / Open Questions

- [x] **PR#3 budget edge — determination: accept as-is.** Forecast ~380 < 400. Pre-split only if `sdd-tasks` counts actual changed lines > 400; no design-level `size:exception` needed.
- [x] **Slash-chord deferral — determination: defer.** `transpose.js` L3-4 documents no slash-bass support with an explicit upgrade path; the preferences substitution scenarios (Bm → Dmaj7) use plain chords the engine already transposes. Deferral is inside spec scope; a later change owns the engine.
- [ ] **`private.session_org_ids()` helper — ORCHESTRATOR SIGN-OFF REQUIRED.** `gigs.org_id` is NOT NULL but `org_memberships` is deny-by-default (0002), so the client has no RLS path to resolve its org. The design-forced accommodation is the only pattern-conformant path (alternatives: hardcoded org id — fragile; altering `gigs.org_id` to nullable — schema-contract change, rejected). Real org enforcement stays Hito 4. Decision point: approve the helper in 0004, or defer gig creation until org resolution exists (scope reduction).