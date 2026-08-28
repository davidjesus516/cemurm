Feature: PDF Scan Charts
  As a musician with paper or scanned charts
  I want to store a song as a PDF scan
  So that I can carry legacy or handwritten charts alongside my ChordPro files

  ──────────────────────────────────────────────
  ADDING A PDF CHART
  ──────────────────────────────────────────────

  Scenario: Add a song whose chart is a PDF scan
    Given I have a scanned chord chart as a PDF
    When I create a song "Legacy Chart" and upload the PDF as its chart
    Then the song's format is "pdf"
    And the scan is stored and can be opened from the song detail

  Scenario: A PDF chart is viewable, not editable as text
    Given my song "Legacy Chart" uses a PDF chart
    When I open the song
    Then the PDF renders in an in-app viewer
    And I cannot edit chord positions as text because it is an image

  Scenario: Replace a PDF scan with a new scan
    Given "Legacy Chart" has a PDF chart
    When I upload a corrected scan of the same chart
    Then the new scan replaces the old one
    And the previous version is preserved in the song's version history

  ──────────────────────────────────────────────
  THE PDF CHART IN FLOWS
  ──────────────────────────────────────────────

  Scenario: A PDF chart renders in performance mode
    Given a setlist includes "Legacy Chart" which uses a PDF chart
    When I open Performance Mode
    Then the PDF scan displays full-screen
    And I can zoom and pan the scan during the performance

  Scenario: A PDF chart is included in offline the setlist
    Given a setlist containing a PDF-chart song is cached
    When I go offline before the gig
    Then the PDF scan is available offline in Performance Mode
    And it renders without network access

  Scenario: Readiness is tracked for a PDF chart
    Given "Legacy Chart" has a PDF scan but no ChordPro data
    When I check its readiness
    Then the song can be "ready" if the scan is present and legible
    And transposition inline is not available because it is an image

  ──────────────────────────────────────────────
  LIMITS & EDGE CASES
  ──────────────────────────────────────────────

  Scenario: A PDF chart cannot be transposed inline
    Given "Legacy Chart" uses a PDF scan
    When I try to transpose it in Performance Mode
    Then the app notes that PDF scans need a new scan to change key
    And no automated transposition is attempted on the image

  Scenario: Oversized PDF scan is rejected
    Given I try to upload a very large PDF scan
    When the app checks the file size
    Then the upload is rejected with a size-limit message
    And the existing chart is left unchanged

  Scenario: PDF renderer unavailable degrades to a download
    Given the in-app PDF viewer is not available in my browser
    When I open "Legacy Chart"
    Then the app offers to open the PDF in a new tab or download it
    And the chart remains usable
