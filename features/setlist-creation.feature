Feature: Setlist Creation
  As a performer
  I want to create and arrange setlists
  So that I can plan the order of songs for a gig

  Scenario: Create a setlist from repertoire
    Given I have 10 songs in my repertoire
    When I create a new setlist called "Friday Gig"
    And I add "Song A", "Song B", and "Song C" in that order
    Then the setlist contains those 3 songs in the specified order

  Scenario: Reorder songs in setlist
    Given I have a setlist with songs in order [A, B, C]
    When I move "Song C" to position 1
    Then the setlist order is [C, A, B]

  Scenario: Duplicate a setlist
    Given I have a setlist "Acoustic Set" with 5 songs
    When I duplicate it as "Acoustic Set - Copy"
    Then the new setlist has the same 5 songs in the same order
    And the original setlist is unchanged

  Scenario: Calculate estimated setlist duration
    Given I have a setlist with songs of durations 3:30, 4:00, and 5:15
    When I view the setlist summary
    Then the total estimated duration shows 12 minutes and 45 seconds
