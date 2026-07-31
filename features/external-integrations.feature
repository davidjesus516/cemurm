Feature: External Metadata Integration
  As a user
  I want to enrich my songs with metadata from external sources
  So that I don't have to enter data manually

  Scenario: Auto-complete song metadata from MusicBrainz
    Given I start adding a song titled "Smells Like Teen Spirit"
    When I trigger a MusicBrainz lookup
    Then the title, artist, year, and genre are pre-filled
    And I can accept or reject the suggested metadata

  Scenario: Fetch lyrics from LRCLIB
    Given I have a song without lyrics
    When I fetch lyrics via LRCLIB
    Then the lyrics are attached to the song
    And the source is credited as LRCLIB
