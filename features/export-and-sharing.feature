Feature: Export and Sharing
  As a performer or organizer
  I want to export setlists and share repertoire content in multiple formats
  So that I can use them for gigs, rehearsals, and audience communication

  ──────────────────────────────────────────────
  SETLIST EXPORT FORMATS
  ──────────────────────────────────────────────

  Scenario: Export a setlist as a printable PDF
    Given I have a setlist "Friday Gig" with 8 songs
    When I tap "Export" and choose PDF
    Then the app generates a PDF containing
      | Song order | Title | Key | Chords | Lyrics (abbreviated) | Notes |
    And the PDF is formatted for A5 print size
    And a header shows the setlist name, date, and org name

  Scenario: Export a setlist as ChordPro
    Given I have a setlist "Sunday Worship" with 5 songs
    When I export as ChordPro format
    Then each song is exported in ChordPro syntax
    And the file preserves original chords and lyrics
    And the file is named "Sunday-Worship-setlist.chordpro"

  Scenario: Export a setlist as MusicXML
    Given I have a setlist with songs that have MusicXML files attached
    When I export the setlist as MusicXML
    Then the MusicXML contains the sheet music for each song
    And the song order matches the setlist order
    And the file is named "setlist-name.musicxml"

  Scenario: Export a setlist as ABC notation
    Given I have a setlist with songs that have ABC notation
    When I export as ABC format
    Then each song is exported in ABC format
    And the file is named "setlist-name.abc"

  Scenario: Export a setlist as plain text summary
    Given I have a setlist "Acoustic Night" with 4 songs
    When I export as plain text
    Then the output shows the setlist outline only
    | # | Title | Duration | Notes |
    And no lyrics or chord sheets are included

  Scenario: Export setlist with custom branding
    Given I set my org branding with logo and color theme
    When I export a setlist as PDF
    Then the PDF includes the org logo in the header
    And the color theme matches the org branding

  ──────────────────────────────────────────────
  SHARING OPTIONS
  ──────────────────────────────────────────────

  Scenario: Share a setlist link with bandmates
    Given I have a setlist "Rehearsal Set" shared with my band
    When I tap "Share" and choose "Copy Link"
    Then a link is copied to my clipboard
    And the link grants view-and-edit access to bandmates
    And the link contains a token that expires in 7 days

  Scenario: Share a setlist link with read-only access
    Given I am the owner of setlist "Sunday Jam"
    When I share the link with "view-only" permission
    Then my bandmate receives a read-only link
    And the bandmate can see the setlist but not edit it

  Scenario: Share individual songs via link
    Given I have a song "Amazing Grace" in my repertoire
    When I tap "Share Song" and select "Copy Link"
    Then the link opens the song detail page when tapped
    And the viewer can see the chord chart and lyrics
    And the viewer cannot edit the song

  Scenario: Share setlist via QR code for audience access
    Given I have a setlist "Public Concert" marked as "shareable with audience"
    When I generate a QR code for the setlist
    Then the QR code encodes a public link
    And when an audience member scans it
    They see the setlist in a simplified audience view
    Without song keys, chord details, or internal notes

  Scenario: Share setlist as an embedded web preview
    Given I have a setlist "Community Worship"
    When I generate an embed link
    Then I receive an HTML embed snippet
    And when pasted into a church website
    The setlist renders as a styled, read-only widget
    With song titles and durations visible

  Scenario: Share a proximity code for offline bandmate addition
    Given I want to add a bandmate who is nearby but offline
    When I tap "Share contact code"
    Then a proximity code is generated and displayed as a QR code
    And the code contains my user ID and a one-time token
    And the bandmate can scan or manually enter the code while offline

  ──────────────────────────────────────────────
  INTEGRATED SHARING TARGETS
  ──────────────────────────────────────────────

  Scenario: Share setlist to WhatsApp
    Given I have a setlist "Gig Tonight"
    When I tap "Share" and select WhatsApp
    Then a share sheet opens with the setlist summary
    And the message includes a deep link to the setlist
    And the recipient can tap the link to view the setlist in-app

  Scenario: Share setlist to Telegram
    Given I have a setlist "Rehearsal Tomorrow"
    When I tap "Share" and select Telegram
    Then a share sheet opens with the setlist summary
    And the message includes a deep link to the setlist

  Scenario: Share setlist via email
    Given I have a setlist "Weekly Rehearsal"
    When I tap "Share" and select Email
    Then a compose email screen opens
    With the setlist summary in the body
    And the PDF attachment selected by default
    And the subject line reads "Rehearsal Setlist — Weekly Rehearsal"

  Scenario: Share a song's chord chart via image
    Given I open the song detail for "Wonderwall"
    When I tap "Share Chord Chart"
    Then a PNG image of the chord chart is generated
    And the share sheet opens with the image attached

  ──────────────────────────────────────────────
  AUDIENCE VIEW
  ──────────────────────────────────────────────

  Scenario: Audience views shared setlist on their device
    Given I am an audience member who scanned a QR code
    When I tap the deep link
    Then the app opens the audience view of the setlist
    And I see song titles and performance times in order
    And I do not see chord charts, rehearsal notes, or editor controls

  Scenario: Audience receives push notification for setlist update
    Given I shared a setlist with the audience
    When the setlist is modified by the organizer
    Then audience members who have the app receive a push notification
    And the notification reads "Setlist 'Friday Gig' has been updated"

  Scenario: Audience view works offline
    Given I (as audience) tapped the link while online
    And the setlist was cached locally
    When I open the app while offline
    Then the cached setlist is visible in audience view
    And no editing controls are shown

  ──────────────────────────────────────────────
  EXPORT MANAGEMENT
  ──────────────────────────────────────────────

  Scenario: View export history
    Given I have exported 3 PDF setlists and 2 ChordPro files
    When I open "Export History"
    Then I see a chronological list of all exports
    And each entry shows the format, date, and file size

  Scenario: Regenerate a previously exported PDF
    Given I exported "Friday Gig" as PDF last week
    When I regenerate the export
    Then a new PDF is created with today's date
    And it reflects any setlist changes made since the last export

  Scenario: Delete an exported file from local storage
    Given I have a cached PDF export in my local storage
    When I tap "Delete export" on the export entry
    Then the PDF is removed from local storage
    And the export history entry is marked as no longer available offline

  Scenario: Export batch — all setlists for an upcoming event
    Given I have 5 setlists for "Weekend Festival 2025"
    When I select "Export All for Event"
    Then a ZIP archive is generated containing all 5 setlists
    And each setlist is in PDF format
    And the archive is named "Weekend-Festival-2025-setlists.zip"
