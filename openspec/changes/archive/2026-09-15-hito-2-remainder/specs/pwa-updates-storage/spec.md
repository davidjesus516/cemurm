# PWA Updates and Storage Specification

## Purpose

Safe app updates and manageable cached storage (issue #47): background install with next-load activation, once-per-session prompt, no Stage/Practice interruption, offline/failure resilience, offline-write queue survival across updates, four-category storage screen, quota cleanup, eviction of derived caches only. Coverage: `features/pwa-updates-and-storage.feature` — every scenario except "New features introduced by an update get tooltips" and "A single cached export remains deletable" (deferred to onboarding and export-and-sharing) and the NON-GOALS scenario.

## Requirements

### Requirement: Background update with next-load activation

The service worker MUST download new assets in the background (current version keeps working, no reload/blanking) and MUST activate the new version only on the next app load — never mid-session, with no modal, reload, or prompt interrupting the running session.

#### Scenario: A new app version activates on the next load

- GIVEN the app is on version 1.4 with connectivity
- WHEN the app checks and finds version 1.5
- THEN assets download in the background, 1.4 keeps working, and no reload or blanking occurs
- AND the next app load runs version 1.5

#### Scenario: An update never applies mid-session

- GIVEN a new version is downloaded and waiting to activate
- WHEN Juan uses the app in a normal session
- THEN the session continues uninterrupted; the new version activates only on the next load

### Requirement: Once-per-session update prompt

After a new version is ready, the app MUST show one prompt offering "Update now" or "Later"; "Later" MUST suppress further prompts for the session and keep the current version working until the next natural app start.

#### Scenario: The prompt appears once, and "Later" defers

- GIVEN a new version is downloaded and ready
- WHEN Juan opens the app
- THEN one prompt offers "Update now"/"Later" and is not shown again that session
- WHEN Juan chooses "Later"
- THEN the current version keeps working and the new version activates at the next natural start

### Requirement: Live-use deferral

The update pipeline MUST NOT reload, prompt, or interrupt Stage (Live Performance Mode) or Practice; the new version MUST activate only after the session ends or at the next app start. Crash recovery keeps its own live-performance contract.

#### Scenario: An update is deferred while a live performance is active

- GIVEN Juan is performing "Friday Gig" in Live Performance Mode and a new version is ready
- WHEN the update becomes ready during the performance
- THEN no reload or prompt interrupts the stage view; the new version activates after the performance or at the next app start

#### Scenario: An update is deferred while a practice session is active

- GIVEN Juan is in a practice session and a new version is ready
- WHEN the update becomes ready during the session
- THEN the practice session continues uninterrupted and completes with its recorded duration; the new version activates after the session or next start

### Requirement: Offline write queue survival

Pending offline writes (practice sessions, gig records, setlist edits — including the queue's gig operations) MUST survive an app update with "pending sync" flags and creation order preserved, and MUST sync on reconnect. Applying an update MUST never discard or reorder queued writes.

#### Scenario: Offline write queues survive an app update

- GIVEN pending offline writes (practice session, gig record, setlist edit)
- WHEN the app is updated on the next load
- THEN every pending write and its flag are still present
- WHEN Juan reconnects
- THEN the writes sync and the flags clear

#### Scenario: Applying an update never discards the local write queue

- GIVEN queued offline writes awaiting sync
- WHEN the new version activates on the next load
- THEN no queued write is deleted, creation order is kept, and synced data matches what Juan authored offline

### Requirement: Offline and failure resilience

The routine update check MUST be silent offline and retried at the next natural opportunity; a failed download or failed activation MUST leave the current version and cached content fully working, with retry on a later natural start, and MUST NOT touch user data or offline writes.

#### Scenario: An update check with no connectivity is silent

- GIVEN Juan is offline
- WHEN the app attempts its routine update check
- THEN no error dialog, toast, or notification is shown and the current version keeps working
- AND the check is retried at the next natural opportunity without user action

#### Scenario: A failed update download leaves the current version working

- GIVEN connectivity drops while a new version is downloading
- WHEN the download fails partway
- THEN the app continues on the current version, cached content stays available offline, and the download retries later

#### Scenario: A failed update activation never breaks the running app

- GIVEN a downloaded new version fails to activate
- WHEN Juan opens the app
- THEN the app falls back to the current working version with no crash or blank state, retries on a later natural start, and data and offline writes are untouched

### Requirement: Storage usage visibility

The storage screen MUST show total cached usage broken into four categories (Songs; PDF scans; Exports; Setlists and gigs), visible offline. Clearing one category MUST free only that cache and MUST NOT delete underlying songs, setlists, sessions, or gig records.

#### Scenario: The storage screen shows usage broken down by category

- GIVEN cached songs, PDF scans, exports, and setlist/gig content
- WHEN Juan opens the storage screen
- THEN it shows the total used, broken into the four categories, and the breakdown is visible offline

#### Scenario: Clearing a cache category never deletes the user's data

- GIVEN cached content in multiple categories
- WHEN Juan clears the "PDF scans" cache
- THEN the cached scans are removed and their storage freed, other categories are unaffected, and no underlying user data is deleted

### Requirement: Quota pressure and eviction

Near-quota storage MUST trigger a warning offering one-tap cleanup of the oldest bulk derived caches, clearing once freed space suffices. Automatic eviction MUST remove oldest PDF scans/exports first, then remaining bulk derived caches by age, and MUST NEVER evict user-authored data (songs, setlists, practice sessions, gig records, pending-sync writes). Under critically low storage, the app shell and Live Performance MUST keep functioning with the active setlist available.

#### Scenario: Near-quota storage triggers a warning and a one-tap cleanup

- GIVEN cached content is close to the storage quota
- WHEN Juan opens the app
- THEN he sees a near-full warning offering one-tap cleanup
- WHEN he taps cleanup
- THEN the oldest bulk derived caches clear and the warning clears once freed space is sufficient

#### Scenario: Eviction removes bulk derived caches and never user-authored data

- GIVEN storage pressure requires automatic eviction
- WHEN the app evicts cached content
- THEN oldest PDF scans/exports go first, then remaining bulk derived caches by age, and no user-authored data is ever evicted

#### Scenario: Low storage degrades gracefully without breaking live use

- GIVEN storage is critically low and the cache is reduced to essential content
- WHEN Juan performs in Live Performance Mode
- THEN the app shell and live performance work, the active setlist and its songs remain available, and no user-authored data is removed