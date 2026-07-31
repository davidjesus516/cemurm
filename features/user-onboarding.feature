Feature: User Onboarding
  As a new user of CEMURM
  I want a guided first-time experience
  So that I can start using the app productively within minutes

  ──────────────────────────────────────────────
  FIRST-TIME WELCOME FLOW
  ──────────────────────────────────────────────

  Scenario: First-time user sees welcome walkthrough
    Given I have just installed CEMURM
    And I have no prior sessions
    When I open the app
    Then I see a welcome screen with 3 slides
    And the slides explain:
      | Slide | Topic |
      | 1 | "Manage your repertoire" |
      | 2 | "Build setlists for gigs" |
      | 3 | "Collaborate with your band" |
    And I can swipe forward through the slides
    And a "Get Started" button appears on the last slide

  Scenario: New user creates account during onboarding
    Given I am on the welcome walkthrough
    When I tap "Get Started"
    Then I am prompted to create an account
    And I can sign up with email or continue with Google

  Scenario: Returning user skips walkthrough
    Given I have previously completed onboarding
    When I open the app
    Then the welcome walkthrough does not appear
    And I am taken directly to the dashboard

  Scenario: User can skip walkthrough and start manually
    Given I am on slide 1 of the welcome walkthrough
    When I tap "Skip"
    Then I am taken to the sign-up page
    And the walkthrough is marked as completed

  ──────────────────────────────────────────────
  ORGANIZATION SETUP
  ──────────────────────────────────────────────

  Scenario: New org admin creates an organization
    Given I have just completed account creation as an admin
    When I am prompted to set up my organization
    And I enter the organization name "Mi Academia Musical"
    And I select the org type "Academy"
    And I add the primary branch "Sede Centro" with location "Madrid"
    Then the organization is created
    And I am the owner/admin
    And I am taken to the org dashboard

  Scenario: Org invite code is generated for the admin
    Given I just created "Mi Academia Musical"
    When the system generates an invite code
    Then the code "ACAD-MAD-001" is created
    And I can share it with my first team member
    And the code has a configurable expiration (default: 7 days)

  Scenario: New user joins via organization invite code
    Given I have an invite code "ACAD-MAD-001"
    When I enter the code during registration
    Then my account is linked to "Mi Academia Musical"
    And I am assigned the role "org_member"
    And I join the "Sede Centro" branch by default
    And I see the org dashboard on first login

  Scenario: Org admin invites additional branches
    Given I own "Mi Academia Musical" with 1 branch in Madrid
    When I navigate to Organization Settings
    And I tap "Add Branch"
    Then I can create "Sede Lima" with the city and a contact admin
    And "Sede Lima" appears in the org structure panel

  Scenario: New user chooses their primary instrument
    Given I am completing the onboarding setup
    When I reach the "My Profile" step
    And I select "guitar" as my primary instrument
    And I set my skill level to "intermediate"
    Then my profile is saved
    And the app recommends songs and setlists matching my instrument and level

  ──────────────────────────────────────────────
  TUTORIAL HINTS AND GUIDED TOURS
  ──────────────────────────────────────────────

  Scenario: Contextual tooltip is shown on first visit to setlists
    Given I am logged in for the first time
    When I navigate to the Setlists tab
    Then a tooltip appears pointing to the "Create Setlist" button
    And the tooltip reads "Tap here to build your first setlist"
    When I tap the button or dismiss the tooltip
    And the tooltip is not shown again

  Scenario: Guided tour of the dashboard on first login
    Given I have just completed org setup
    When I arrive at the dashboard
    Then the dashboard shows a 4-step guided tour
    | Step | Element | Instruction |
    | 1 | Repertoire badge | "Your song library is here" |
    | 2 | Setlist card | "Create your first setlist" |
    | 3 | Bandmates tab | "Invite your collaborators" |
    | 4 | Performance mode | "Prepare for your next gig" |
    And each step highlights the element with a pulsing ring
    When I complete all 4 steps or tap "Skip Tour"
    Then the guided tour is marked as complete

  Scenario: Help button re-opens the tour at any time
    Given I have completed onboarding
    When I tap the help icon on the dashboard
    Then a "Take a Tour" option appears
    When I tap it
    Then the guided tour restarts from step 1

  Scenario: Tooltip is shown for new features after update
    Given I am logged in with onboarding already completed
    When the app is updated to a version that introduces "Live Performance Mode"
    And I open Performance Mode for the first time
    Then a feature highlight tooltip appears for the new screen
    And it explains the key interactions

  ──────────────────────────────────────────────
  ONBOARDING COMPLETION
  ──────────────────────────────────────────────

  Scenario: Onboarding progress is tracked
    Given I have completed account creation
    And I have joined an organization
    And I have set my instrument
    And I have completed the dashboard tour
    Then my onboarding progress shows "100% complete"
    And the onboarding checklist is ticked off

  Scenario: Onboarding completion unlocks next steps
    Given I have completed 100% of onboarding
    When I tap "You're all set!" on the completion screen
    Then I am taken to my personalized dashboard
    And a celebration animation plays
    And I can start adding songs to my repertoire immediately

  Scenario: Returning user has incomplete onboarding flagged
    Given I registered 3 days ago but never completed onboarding
    When I open the app
    Then a banner appears at the top: "Complete your setup — it only takes 2 minutes"
    And tapping the banner resumes onboarding from the last incomplete step
