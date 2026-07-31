Feature: Offline Access
  As a musician playing a gig without internet
  I want to access my repertoire and setlists offline
  So that I can perform without connectivity

  Scenario: Load repertoire offline
    Given I have previously opened the app online
    And cached songs are available
    When I lose internet connection
    Then I can still browse my repertoire
    And open any cached song detail

  Scenario: Setlist modifications while offline
    Given I am offline
    And I have a setlist "Friday Gig"
    When I add a new song to the setlist
    Then the setlist is saved locally with a "pending sync" flag
    When I reconnect to the internet
    Then the setlist syncs to the server and the flag is cleared

  Scenario: Proximity code generated while offline
    Given I am logged in but offline
    When I navigate to the bandmates management screen
    Then I can still generate a proximity code
    And the code is valid for offline sharing
