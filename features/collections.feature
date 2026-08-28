Feature: Collections (Thematic Song Sets)
  As a musician or leader
  I want to curate themed collections of songs
  So that I can group repertoire by occasion, style, or season and reuse it

  ──────────────────────────────────────────────
  CREATING COLLECTIONS
  ──────────────────────────────────────────────

  Scenario: Create an empty thematic collection
    Given I am logged in
    When I create a collection called "Wedding Set"
    Then the collection is created and appears in my Library
    And the collection starts empty with a "Add songs" prompt

  Scenario: Add songs to a collection from the repertoire
    Given I have a collection "Jazz Standards"
    When I add "Autumn Leaves" and "Take Five" to the collection
    Then both songs appear in the collection in the order added
    And the collection count shows "2 songs"

  Scenario: Reorder songs within a collection
    Given my collection "Jazz Standards" has [A, B, C]
    When I move "C" to the first position
    Then the collection order becomes [C, A, B]

  Scenario: Remove a song from a collection
    Given my collection includes "Song A"
    When I remove "Song A" from the collection
    Then the collection no longer includes "Song A"
    And the song itself is not deleted from the repertoire

  Scenario: Duplicate a collection
    Given I have a collection "Christmas Carols"
    When I duplicate it as "Christmas Carols 2025"
    Then the new collection has the same songs as the original
    And changes to the duplicate do not affect the original

  Scenario: Delete a collection
    Given I no longer need my collection "Old Set"
    When I delete the collection
    Then the collection is removed
    And the songs inside remain intact in the repertoire

  ──────────────────────────────────────────────
  COLLECTIONS IN SETLISTS & EVENTS
  ──────────────────────────────────────────────

  Scenario: Add an entire collection to a setlist at once
    Given I have a setlist "Friday Gig"
    And a collection "Opening Acoustic Set" with [A, B, C]
    When I add the collection to the setlist
    Then the setlist appends A, B, and C in collection order
    And each song is added as an independent setlist item

  Scenario: Use a collection as a service block source
    Given the service has a "Worship" block needing songs
    When I fill the block from the collection "Worship Selection"
    Then the block's setlist is populated from the collection
    And I can still reorder the block independently afterward

  ──────────────────────────────────────────────
  FORKING & SHARING COLLECTIONS
  ──────────────────────────────────────────────

  Scenario: View a collection shared by a bandmate
    Given Julian shared his collection "Road Trip" with me
    When I open the shared collection
    Then I can browse the songs it contains
    And I cannot edit Julian's original collection

  Scenario: Fork a shared collection to my own library
    Given Julian shared "Road Trip" with me
    When I fork the collection to my library
    Then a new personal copy "Road Trip" is created under my account
    And my copy records its lineage back to Julian's original
    And further edits to Julian's copy do not affect mine

  Scenario: A fork keeps song references, not duplicates
    Given I fork "Road Trip" and it contains "Song A"
    When the owner of the version of "Song A" updates its chart
    Then my fork still references the same updated arrangement
    And no duplicate song record is created

  Scenario: Collection owner controls sharing permissions
    Given I created "Private Set"
    When I set its visibility to "shared with band"
    Then my bandmates can view it but not modify it
    And I retain the only edit rights unless I grant them

  ──────────────────────────────────────────────
  COLLECTION CONSISTENCY
  ──────────────────────────────────────────────

  Scenario: Removing a song from the repertoire flags it in collections
    Given "Song A" appears in three collections
    When "Song A" is retired from the repertoire
    Then the collections still render "Song A" in past setlists
    And the collection picker shows "Song A" as retired and unplayable

  Scenario: Personal preferences project inside a collection
    Given I open the collection "Road Trip"
    When I view a song in my personal default key
    Then it renders through my personal transpose offset
    And the canonical arrangement on disk stays unchanged
