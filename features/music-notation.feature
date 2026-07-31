Feature: Music Notation File Support
  As a musician
  I want to import and view different music notation formats
  So that I can use the files I already have

  Scenario: Import a ChordPro file
    Given I upload a file in ChordPro format
    When the parser processes the file
    Then the song's chords and lyrics are rendered correctly

  Scenario: Preview MusicXML with Playback
    Given I upload a MusicXML file
    When I open the preview
    Then the sheet music renders using OpenSheetMusicDisplay
    And the playback follows the notation

  Scenario: View ABC notation
    Given I upload a file in ABC format
    When I view the song detail
    Then the ABC notation is rendered and playable via abcjs
