# Proposal: Hito 2 Remainder — Gigs, PWA Updates & Storage, Personal Preferences

## Intent

Ship remaining Hito 2 surfaces: gigs + performance history (#44 0/18, gig tables 403), safe updates + storage (#47 ~2/18, `skipWaiting()` activates mid-session), preferences core (#55 ~4/39). Migration 0004 first.

## Scope

### In Scope
- **0004**: owner RLS on gig tables; new `user_preferences` (owner RLS, one row/user); `device_configs` unchanged.
- **Gigs (online)**: CRUD, venue suggestion/reuse, lifecycle planned→confirmed→completed/cancelled, completion → one `performances` + `performance_items` (played/skipped/off_setlist), StageMode post-show entry, played-tag display.
- **PWA**: versioned SW (activate-on-next-load; one prompt/session; never Stage/Practice), offline/failure resilience, queue gig ops + survival, storage screen (4 categories), quota cleanup, eviction of derived caches only.
- **Preferences core**: persisted default transpose + per-song override, capo display, default version + picker, annotations + chord substitution UI, practice key/tempo, annotations preserved across transpose.

### Out of Scope
- **#55 boundary** (Hito 3/4/6): event/band/org contexts, agreed-key proposals/conflicts, duet/multi-vocal, rebase, annotation→fork, orchestral, range/history.
- Tooltips→onboarding; export deletion→export feature; gigs org visibility; manifest/icons flagged; non-goals by absence.

## Capabilities

### New Capabilities
- `gigs`: CRUD, lifecycle, performance records, offline ops.
- `pwa-updates-storage`: update pipeline, no-interruption, storage, eviction.
- `personal-preferences`: persistence, transpose/capo, version/annotation UI.

### Modified Capabilities
- `row-level-security`: gig tables + `user_preferences` policies.

## Approach

**Stacked PRs to main**: PR#0 migration 0004 (~200 lines, Low) → PR#1 gigs → PR#2 pwa (queue ops first) → PR#3 preferences. Budget High → sub-splits at tasks; size:exception fallback.

`main ← PR#0 → PR#1 (0004) → PR#2 (queue ops) → PR#3 (0004)`

## Affected Areas

- New: `supabase/migrations/0004_*.sql`; `src/lib/gigs.js`, `hooks/useGigs.js`, `pages/Gigs.jsx`/`GigDetail.jsx`; `src/lib/preferences.js`, `hooks/usePreferences.js`, `pages/Settings.jsx`.
- Modified: `src/App.jsx`, `StageMode.jsx`; `offlineQueue.js`/`offlineSync.js`/`offlineCache.js` (lockstep IDB version); `public/sw.js`, `src/main.jsx`; `transpose.js`, `components/notation/`; `Practice.jsx`, `SetlistDetail.jsx`.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| IDB version drift disables cache | Med | Lockstep bump; survival scenario |
| SW change breaks existing users | Med | Versioned SW; per-PR rollback |
| #55 deferrals drift in | Med | Named boundary; delta specs |
| Slice diff >400 lines | High | Sub-splits; size:exception |

## Rollback Plan

- 0004: revert migration; gigs 403 until restored.
- Slices: revert merged PR; redeploy prior SW; derived caches only.

## Dependencies

Supabase migration apply.

## Success Criteria

- [ ] Gigs online CRUD/lifecycle/performance; offline sync; update activates next load; prompt once; no Stage/Practice interruption; storage + eviction work.
- [ ] Preferences persist, apply in Stage/Practice; capo/version/annotation UI works.
- [ ] `pnpm build` + `pnpm lint` pass; manual walk (no test runner).

## Evidence

| Slice | #44 | #47 | #55 |
|---|---|---|---|
| In scope | 15 (14 gigs PR + 1 offline in PWA PR) | 15 | 12 |
| Deferred | 1 | 2 | 27 |
| Non-goal by absence | 2 | 1 | 0 |

Deferred: #44 org visibility (scen.15). #47 tooltips (6), export (17). #55 rebase, duet, contexts, agreed key, fork, orchestral, range, conflicts (scen.8–21, 24, 26–39).