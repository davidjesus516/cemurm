Feature: Song Lifecycle
  As a repertoire owner
  I want songs to move through clear states — draft, ready, retired, and deleted
  So that the library reflects what is actually playable and safe to reuse

  ──────────────────────────────────────────────
  CHART COMPLETENESS & READINESS
  ──────────────────────────────────────────────

  Scenario: Incomplete chart is flagged as not ready
    Given I have the song "Half Chart" whose chart contains chords but no lyrics
    When I view the song's readiness
    Then the song is in state "draft"
    And the app shows "Not ready: missing lyrics section"

  Scenario: Missing chord chart blocks the ready state
    Given I have the song "Chords Missing" whose chart has lyrics but no chord lines
    When I view the song's readiness
    Then the song is in state "draft"
    And the app shows "Not ready: no chord chart"

  Scenario: Completing the chart flips the song to ready
    Given the song "Almost Done" is in state "draft" because it lacks a chorus
    When I add the chorus section to the chart
    Then the song becomes "ready"
    And the transition is recorded with lineage (editor, date, prior state "draft")

  Scenario: Missing required metadata keeps a song from being ready
    Given the song "No Key" has a complete chart but no base key
    When I view the song's readiness
    Then the song stays in state "draft"
    And the app shows "Not ready: missing base key"

  Scenario: Readiness is tracked per version, not per song
    Given the song "Canción Y" has version "Original (artist)" with a complete chart
    And version "Pedro's arrangement" is missing its bridge
    When I view the readiness of both versions
    Then "Original (artist)" is "ready"
    And "Pedro's arrangement" is "draft"

  Scenario: Setlist picker shows readiness so planners pick playable songs
    Given the setlist picker lists "Ready Song" (ready) and "Work in Progress" (draft)
    When I add a song to the setlist
    Then "Ready Song" shows a "Ready" badge and is selectable
    And "Work in Progress" shows a "Draft" badge and warns before adding

  ──────────────────────────────────────────────
  VERSION HISTORY & ROLLBACK
  ──────────────────────────────────────────────

  Scenario: Every chart edit creates a version entry
    Given the song "Yesterday" has 1 version in its history
    When I change the chorus chords and save
    Then the version history shows a new entry
    And the entry records the editor, the timestamp, and "Changed chorus chords"

  Scenario: Rollback restores a previous version
    Given the song "Yesterday" has versions v3 (current), v2, and v1
    When I roll back to v1
    Then the chart content is restored to v1
    And the rollback itself is recorded as v4 in the history

  Scenario: Rollback does not erase the discarded version
    Given I rolled "Yesterday" back from v3 to v1
    When I open the version history
    Then v2 and v3 are still listed as previous states
    And I can roll forward to v3 again if needed

  Scenario: Version history is an immutable audit trail
    Given the song "Yesterday" has 5 version entries
    When a member tries to delete a past version entry
    Then the action is rejected with "Version history cannot be edited"
    And the 5 entries remain unchanged

  Scenario: Diff shows what changed between versions
    Given "Yesterday" v3 changed the key from G to A and the BPM from 72 to 80
    When I compare v3 with v2
    Then the diff shows "Key: G → A" and "BPM: 72 → 80"
    And unchanged sections are not listed

  ──────────────────────────────────────────────
  RETIRE, ARCHIVE & REACTIVATE
  ──────────────────────────────────────────────

  Scenario: Retiring a song removes it from the setlist picker
    Given the song "Old Hit" is in my repertoire
    When I retire "Old Hit"
    Then it no longer appears in the setlist picker
    And it remains visible when I filter by "Retired"
    And the transition is recorded with lineage (owner, date, prior state "ready")

  Scenario: Retired songs keep rendering in past setlists
    Given "Old Hit" was in the setlist "Summer 2024"
    When I open "Summer 2024" after retiring "Old Hit"
    Then the setlist still renders "Old Hit" with its chart
    And the item shows a "Retired" tag

  Scenario: Retiring a song that is in an upcoming setlist warns the owner
    Given "Old Hit" is in the upcoming setlist "Saturday Service"
    When I retire "Old Hit"
    Then the app warns "This song is in 1 upcoming setlist"
    And asks "Retire anyway or replace it first?"
    And I can cancel the retirement

  Scenario: Reactivating returns the song with its readiness intact
    Given "Old Hit" is retired and was "ready" before retiring
    When I reactivate "Old Hit"
    Then the song returns to state "ready"
    And it appears in the setlist picker again

  Scenario: Retire is reversible, delete is the hard removal
    Given the song "Unused Track" is currently "ready"
    And I want to remove it from my library for good
    When I choose "Delete" instead of "Retire"
    Then the song no longer appears in my library or the setlist picker
    And the attached file is soft-deleted (not permanently removed)
    And a restore action brings it back with its prior state "ready"
    And a past setlist that included "Unused Track" still renders it in read-only historical mode with a "Removed" tag

  ──────────────────────────────────────────────
  DUPLICATE DETECTION & MERGE
  ──────────────────────────────────────────────

  Scenario: System flags potential duplicates
    Given my repertoire contains "Imagine" (by John Lennon)
    And "Imagine (John Lennon)" added by a different member
    When the library runs duplicate detection
    Then both songs are flagged as "possible duplicates"
    And the app groups them for review

  Scenario: Merge combines metadata and linked versions
    Given "Imagine" and "Imagine (John Lennon)" are flagged as duplicates
    When I merge them keeping "Imagine" as the canonical song
    Then "Imagine" keeps all versions from both songs
    And the merged record notes the merged source "Imagine (John Lennon)"
    And "Imagine (John Lennon)" disappears from the library

  Scenario: Merge preserves setlist references
    Given the setlist "Solo Set" contains "Imagine (John Lennon)"
    When I merge it into "Imagine"
    Then "Solo Set" now references "Imagine"
    And the item keeps its position, agreed key, and personal projections
    And past setlists render the merged song without breaking

  Scenario: Merge is reversible
    Given I merged "Imagine (John Lennon)" into "Imagine"
    When I unmerge them
    Then both songs are restored with their own versions and metadata
    And setlist references return to their original targets

  Scenario: Merge audit trail stays visible
    Given I merged "Imagine (John Lennon)" into "Imagine"
    When I open the canonical song's history
    Then the history records the merge with date, decider, and source song

  ──────────────────────────────────────────────
  READINESS ACROSS THE SUITE
  ──────────────────────────────────────────────

  Scenario: Readiness state feeds the rehearsal agenda
    Given the rehearsal agenda includes "Ready Song" (ready) and "Work in Progress" (draft)
    When the agenda is generated
    Then "Ready Song" is marked "Ready to play"
    And "Work in Progress" is flagged "Needs chart work before rehearsal"
