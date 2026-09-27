Feature: Offline Edit Conflict Policy
  As a band member
  I want same-field offline edits to resolve by an explicit rule when I reconnect
  So that no edit is silently lost and everyone knows which version won

  ──────────────────────────────────────────────
  SAME-FIELD CONFLICTS
  ──────────────────────────────────────────────

  Scenario: Same-field chord edits resolve by the later write
    Given Julian and I both edit the chorus chords of version "Sunday Gig v2" of "Song A" while offline
    And we set different chords: I write G, Julian writes F
    When we both reconnect
    Then the write with the later timestamp becomes the current chorus chords
    And the earlier write is recorded as superseded
  Scenario: The losing editor is notified and their edit stays in history
    Given my chorus chord edit lost the conflict on "Song A"
    When the conflict resolution completes
    Then I receive a notification: "Your chorus chord edit was superseded by Julian's later edit"
    And my edit remains visible in the version history
  Scenario: A same-field conflict on a shared setlist item follows the same rule
    Given Julian and I both change the agreed key of "Song B" in the shared setlist "Sunday Jam" offline
    When we reconnect
    Then the later write sets the agreed key
    And the setlist activity feed records the resolution
  Scenario: A conflicting write never overwrites silently
    Given a same-field conflict is detected on the chorus chords of "Song A"
    When the offline queue replays
    Then neither write is applied until the resolution completes
    And the version keeps showing the pre-conflict chords in the meantime

  ──────────────────────────────────────────────
  MERGE AND TIE-BREAK
  ──────────────────────────────────────────────

  Scenario: Different-field edits from the same offline window still merge
    Given I changed the chorus chords of "Song A" offline and fixed a lyric line in its bridge
    And Julian changed the same chorus chords offline
    When we reconnect
    Then only the chorus chords resolve by the later write
    And my bridge lyric fix is preserved in the merged version
  Scenario: Identical edits resolve deterministically
    Given Julian and I both changed the chorus chords of "Song A" to the exact same value offline
    When we reconnect
    Then the change is applied once with no conflict warning
    And the history records both entries with the note "Identical edits — deterministic result"
  Scenario: Equal timestamps use the recorded tie-break rule
    Given two conflicting writes on "Song A" carry the same timestamp
    When the resolution runs
    Then the app applies the recorded tie-break rule
    And the applied rule is stored with the resolution so every device reaches the same result

  ──────────────────────────────────────────────
  CONFLICT SURFACING
  ──────────────────────────────────────────────

  Scenario: The offline queue flags a conflicted entry before replay
    Given my offline queue holds a chorus chord edit for "Song A"
    And the server version changed the same field before my replay
    When I reconnect
    Then my queued entry is marked as a conflict and stays pending
    And it is not replayed until the resolution completes
  Scenario: Conflict resolution appears in the version history
    Given a conflict on "Song A" was resolved
    When I open the version history
    Then my entry and Julian's entry are listed side by side
    And the resolution entry notes the rule and the winning write
  Scenario: The loser can review their superseded edit
    Given I lost a conflict on "Song A"
    When I open the conflict notification
    Then I can compare my superseded edit with the winning write
    And my edit is available as a draft so I can re-apply it deliberately

  ──────────────────────────────────────────────
  SETLIST ITEM REPLAY
  ──────────────────────────────────────────────

  Scenario: A queued setlist add replays when nothing overtook it
    Given I added "Amazing Grace" to the shared setlist "Sunday Jam" while offline
    And nobody changed that setlist before my replay
    When I reconnect
    Then my add is applied
    And I receive no conflict notice

  Scenario: A queued setlist remove replays when the song is still there
    Given I removed "Scarborough Fair" from the shared setlist "Sunday Jam" while offline
    And the song is still on the setlist when I reconnect
    When the offline queue replays
    Then my remove is applied
    And I receive no conflict notice

  Scenario: A setlist add the server genuinely superseded reports a real conflict
    Given Julian removed "Amazing Grace" from the shared setlist "Sunday Jam" after I queued my own add
    When I reconnect
    Then my add is not applied
    And the notice says the song was removed before my sync
    And the notice is a supersession, not a replay failure

  Scenario: A queued operation that lost its timestamp is never reported as superseded
    Given I added "Amazing Grace" to the shared setlist "Sunday Jam" while offline
    And my queue entry lost the timestamp of when I made the change
    When I reconnect
    Then my add is not applied
    And the notice says the change lost its timestamp and was not applied
    And the notice does not claim another musician changed the setlist first

  Scenario: A queued operation missing its song is never reported as superseded
    Given a queued setlist change can no longer be read back to the song it referred to
    When the offline queue replays
    Then it is not applied
    And the notice says the change could not be read and was not applied
    And the notice asks me to make the change again
    And the notice does not claim another musician changed the setlist first

  Scenario: The two unidentifiable cases are told apart from each other
    Given I have one queued change that lost its timestamp and another that lost its song
    When the offline queue replays and I open the notices
    Then the two notices say different things
    And neither blames a musician for a change that was never compared