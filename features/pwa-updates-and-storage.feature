Feature: PWA Updates and Storage
  As a musician performing with CEMURM
  I want app updates that install safely and cached storage I can manage
  So that a new version never interrupts a live performance or loses my offline work

  ──────────────────────────────────────────────
  UPDATE DETECTION & INSTALL
  ──────────────────────────────────────────────

  Scenario: A new app version is detected, installed in the background, and activates on the next load
    Given Juan has version 1.4 of the app installed
    And Juan opens the app with an internet connection
    When the app checks for updates and finds version 1.5 available
    Then the new assets are downloaded in the background
    And the current version 1.4 keeps working during the download
    And no reload, blanking, or interrupted view occurs while the update installs
    When Juan next opens the app after the download completes
    Then the app loads version 1.5

  Scenario: An update never applies mid-session
    Given a new app version is fully downloaded and waiting to activate
    When Juan is using the app in a normal session
    Then the running session continues uninterrupted on the current version
    And the new version activates only on the next app load
    And no modal, reload, or prompt interrupts the session before it ends

  ──────────────────────────────────────────────
  UPDATE PROMPT
  ──────────────────────────────────────────────

  Scenario: The update prompt appears once, and "Later" defers to the next app start
    Given a new app version is downloaded and ready to activate
    When Juan opens the app
    Then one prompt appears offering "Update now" or "Later"
    And the prompt is not shown again during the rest of the session
    When Juan chooses "Later"
    Then the current version keeps working uninterrupted
    And the new version activates at the next natural app start

  ──────────────────────────────────────────────
  NO INTERRUPTION OF LIVE USE
  ──────────────────────────────────────────────

  Scenario: An update is deferred while a live performance is active
    Given Juan is performing "Friday Gig" in Live Performance Mode
    And a new app version is downloaded and ready to activate
    When the update becomes ready during the performance
    Then no reload or update prompt interrupts the stage view
    And the performance continues on the current version until it ends
    And the new version activates after the performance ends or at the next app start
    And crash recovery keeps its contract in live-performance-mode — this feature only guarantees the update never triggers the reload

  Scenario: An update is deferred while a practice session is active
    Given Juan is in a practice session in practice mode
    And a new app version is downloaded and ready to activate
    When the update becomes ready during the session
    Then the practice session continues uninterrupted on the current version
    And the session completes and is saved with its recorded duration
    And the new version activates after the session ends or at the next app start

  ──────────────────────────────────────────────
  NEW-FEATURE TOOLTIPS AFTER UPDATE
  ──────────────────────────────────────────────

  Scenario: New features introduced by an update get tooltips on first use
    Given Juan's app is updated from version 1.4 to a version that introduces a new feature
    When Juan opens the app and uses the new feature for the first time
    Then a feature highlight tooltip appears pointing to the new feature
    And the tooltip explains the key interactions of the new feature
    And no tooltip is shown for features Juan already used before the update
    And the tooltip mechanics stay owned by user-onboarding — this feature only guarantees new features are announced after an update

  ──────────────────────────────────────────────
  OFFLINE WRITES SAFETY
  ──────────────────────────────────────────────

  Scenario: Offline write queues survive an app update
    Given Juan has offline writes with a "pending sync" flag
    And the pending writes include a practice session, a gig record, a report, and a setlist edit
    When the app is updated to a new version on the next load
    Then every pending write is still present in the local queue after the update
    And the "pending sync" flags are preserved
    When Juan reconnects to the internet
    Then the writes sync to the server and the "pending sync" flags are cleared
    And the sync mechanics stay owned by offline-access — this feature only guarantees the queue survives the update

  Scenario: Applying an update never discards the local write queue
    Given Juan has queued offline writes awaiting sync
    When the new version activates on the next app load
    Then no queued write is deleted or discarded by the update
    And the queue keeps the order in which the writes were created
    And the synced data matches what Juan authored offline

  ──────────────────────────────────────────────
  OFFLINE & FAILURE HANDLING
  ──────────────────────────────────────────────

  Scenario: An update check with no connectivity is silent
    Given Juan is offline
    When the app attempts its routine update check
    Then no error dialog, toast, or notification is shown
    And the current version keeps working normally
    And the check is retried at the next natural opportunity without user action

  Scenario: A failed update download leaves the current version working
    Given Juan's device loses connectivity while a new version is downloading
    When the download fails partway
    Then the app continues running on the current version
    And cached content remains fully available offline
    And the download is retried at the next opportunity without user action

  Scenario: A failed update activation never breaks the running app
    Given a downloaded new version fails to activate on the next load
    When Juan opens the app
    Then the app falls back to the current working version
    And no crash, blank screen, or unrecoverable state is shown
    And the update is retried on a later natural app start
    And Juan's data and offline writes are untouched by the failed activation

  ──────────────────────────────────────────────
  STORAGE USAGE VISIBILITY
  ──────────────────────────────────────────────

  Scenario: The storage screen shows usage broken down by category
    Given Juan has cached songs, cached PDF scans, cached exports, and cached setlist and gig content
    When Juan opens the storage screen
    Then the screen shows the total storage used by cached content
    And the total is broken down by category:
      | Category | Example content |
      | Songs | cached ChordPro charts |
      | PDF scans | cached scanned charts |
      | Exports | cached PDF setlist exports |
      | Setlists and gigs | cached setlist and gig content for offline use |
    And the breakdown is visible while Juan is offline

  Scenario: Clearing a cache category never deletes the user's data
    Given the storage screen shows cached content in multiple categories
    When Juan clears the "PDF scans" cache
    Then the cached scans are removed and their storage is freed
    And cached content in the other categories is unaffected
    And clearing a cache never deletes the underlying songs, setlists, sessions, or gig records

  ──────────────────────────────────────────────
  QUOTA PRESSURE HANDLING
  ──────────────────────────────────────────────

  Scenario: Near-quota storage triggers a warning and a one-tap cleanup
    Given cached content is close to the storage quota
    When Juan opens the app
    Then Juan sees a warning that storage is nearly full
    And the warning offers a one-tap cache cleanup
    When Juan taps the cleanup action
    Then the app clears the oldest bulk derived caches
    And the warning clears once the freed space is sufficient

  Scenario: Eviction removes bulk derived caches and never user-authored data
    Given storage pressure requires automatic eviction
    When the app evicts cached content
    Then the oldest PDF scans and cached exports are evicted first
    And further pressure evicts the remaining bulk derived caches by age
    And no user-authored data is ever evicted under any storage pressure
    And user-authored data includes songs, setlists, practice sessions, gig records, and pending-sync writes

  Scenario: Low storage degrades gracefully without breaking live use
    Given storage is critically low and the cache has been reduced to essential content
    When Juan performs in Live Performance Mode
    Then the app shell and the live performance still function normally
    And the active setlist and its songs remain available
    And no user-authored data is evicted or removed in the degraded state

  ──────────────────────────────────────────────
  INDIVIDUAL FILE DELETION
  ──────────────────────────────────────────────

  Scenario: A single cached export remains deletable from local storage
    Given Juan has a cached PDF export in local storage
    When Juan deletes that export
    Then the PDF is removed from local storage
    And the export history entry is marked as no longer available offline
    And per-file export deletion stays owned by export-and-sharing — this feature only asserts the touchpoint keeps working

  ──────────────────────────────────────────────
  NON-GOALS
  ──────────────────────────────────────────────

  Scenario: No native update channel, partial updates, extra telemetry, worker internals, or user-data eviction
    Given the runtime feature set is reviewed
    When I look for additional update and storage machinery
    Then no native app-store or manual download update channel exists — updates flow only through the service worker
    And no delta or chunked partial updates are applied — updates always install the complete new app build
    And no telemetry is collected beyond what analytics-and-insights owns
    And no service-worker internals (registration, cache names, install logs) are shown to the user
    And no user-authored data is ever evicted automatically under any storage pressure