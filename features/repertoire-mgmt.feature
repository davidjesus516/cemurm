Feature: Repertoire Management
  As a musician
  I want to manage my song library
  So that I can organize, search, and reuse my repertoire

  Scenario: Add a new song to repertoire
    Given I am logged in
    And I have a repertoire with fewer than 500 songs
    When I add a song with title "Bohemian Rhapsody"
    And I attach the chord chart file
    Then the song appears in my repertoire
    And the song metadata includes the attached file

  Scenario: Search songs by title
    Given I have songs titled "Imagine", "Hotel California", and "Imagine Dragons"
    When I search for "Imagine"
    Then I see both "Imagine" and "Imagine Dragons" in the results

  Scenario: Edit song metadata
    Given I have a song "Yesterday" in my repertoire
    When I update the key to "G major" and BPM to 72
    Then the song reflects the updated key and BPM

  Scenario: Remove a song from repertoire
    Given I have a song "Deleted Track" in my repertoire
    When I delete that song
    Then it no longer appears in my repertoire
    And the attached file is soft-deleted (not permanently removed)
