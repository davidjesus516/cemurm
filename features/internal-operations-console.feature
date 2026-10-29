Feature: Internal Operations Console
  As a system administrator or a community moderator
  I want a console of my own at /dashboard
  So that I can operate the platform without the member-facing navigation

  # ──────────────────────────────────────────────
  # WHY THIS EXISTS
  # ──────────────────────────────────────────────
  # Every surface below is staff work, not member work. Today it is either
  # scattered across the member app (/moderation is the only one that is a
  # page) or has no surface at all despite the backend already supporting it
  # (promote_song / demote_song are system_admin-only RPCs from 0016 with no
  # caller in src/). The console is the one place they live.
  #
  # THE ACCESS MODEL IS NOT INVENTED HERE. Roles come from public.user_roles
  # (0001:44 — 'system_admin' | 'community_moderator'), read through
  # private.session_has_system_role(...) and, on the client, through
  # moderation.js's isModerator / isSystemAdmin. The same pair gates the
  # existing /moderation page, so this file tightens nothing and relaxes
  # nothing.
  #
  # TWO TIERS, on purpose. A community moderator and a system administrator do
  # NOT get the same console — 0020 already establishes that escalated cases
  # are system_admin-only, and BDD community-moderation says "Org admins do not
  # get community moderation powers". Scenarios marked [system_admin] must be
  # absent, not merely disabled, for a moderator.
  #
  # SCENARIOS MARKED [needs backend] REQUIRE A MIGRATION. They are written here
  # because they are the product requirement, and they are marked because
  # shipping the UI without the policy would produce a page that reads nothing.
  # Each is traced to the schema comment that already anticipated it.

  ──────────────────────────────────────────────
  ACCESS
  ──────────────────────────────────────────────

  Scenario: A system administrator reaches the console
    Given I am signed in and public.user_roles has my id with role "system_admin"
    When I navigate to "/dashboard"
    Then I see the operations console
    And the console carries its own navigation, not the member navigation bar
    And I can reach the member app destinations from the console

  Scenario: A community moderator reaches a narrower console
    Given I am signed in and public.user_roles has my id with role "community_moderator"
    When I navigate to "/dashboard"
    Then I see the operations console
    But the sections gated to system administrators are absent from my navigation
    And navigating directly to a system-administrator section URL does not render it

  Scenario: An ordinary member cannot reach the console
    Given I am signed in with no row in public.user_roles
    When I navigate to "/dashboard"
    Then I do not see the operations console
    And I am returned to the member app

  Scenario: A signed-out visitor cannot reach the console
    Given I am not signed in
    When I navigate to "/dashboard"
    Then I am redirected to sign in

  Scenario: A member whose access is locked stays locked
    Given I am signed in with no row in public.user_roles
    And my guardian consent is not active
    When I navigate to "/dashboard"
    Then I am held at the guardian consent lock, exactly as for any other member route

  ──────────────────────────────────────────────
  SHELL AND SIDEBAR
  ──────────────────────────────────────────────

  Scenario: The console has its own shell
    Given I am in the operations console
    Then the member navigation bar is not rendered
    And the console's sidebar is the only primary navigation on screen
    And the sidebar's width is stable while member pages load into the content area

  Scenario: Collapse the sidebar to an icon rail
    Given I am in the console with the sidebar expanded
    When I toggle the sidebar
    Then it narrows to an icon rail
    And each icon keeps an accessible name
    And label text is hidden, not reflowed into the rail

  Scenario: The collapsed state survives a reload
    Given I have collapsed the sidebar
    When I reload the console
    Then the sidebar is still collapsed

  Scenario: The keyboard toggles the sidebar
    Given I am in the console
    When I press the toggle shortcut
    Then the sidebar toggles
    And the shortcut is not captured while I am typing in a text field

  Scenario: The sidebar becomes a drawer on a narrow viewport
    Given the viewport is narrower than the console's mobile breakpoint
    When I open the console
    Then the sidebar is not permanently on screen
    And I can open it as a drawer over the content
    And choosing a destination closes the drawer

  Scenario: The active section is marked
    Given I am in the console
    When I open a section
    Then its navigation entry is marked with the accent
    And exactly one entry is marked at a time
    And an entry is not marked while a deeper, unrelated route is open

  Scenario: Focus is not lost when the drawer closes
    Given I opened the sidebar as a drawer
    When I close it with Escape
    Then focus returns to the control that opened it
    And the next Tab does not land behind the closed drawer

  Scenario: The console respects reduced motion
    Given my system requests reduced motion
    When I open and close the sidebar
    Then the rail changes width without travel
    And no content animates on both axes at once

  ──────────────────────────────────────────────
  MODERATION
  ──────────────────────────────────────────────

  Scenario: A moderator works the queue from the console
    Given I am a community moderator with open cases
    When I open the Moderation section
    Then I see the same queue the member-facing page shows
    And I can decide an open case here

  Scenario: An escalated case is system-administrator only
    Given a case has been escalated
    When I open the Moderation section as a community moderator
    Then the escalated case is not decidable by me
    And as a system administrator I can decide it here

  Scenario: Moderation decisions remain online-only
    Given I am offline
    When I open the Moderation section
    Then decisions are unavailable
    And the console says so rather than failing silently

  ──────────────────────────────────────────────
  REPERTOIRE PROMOTION
  ──────────────────────────────────────────────

  Scenario: Promote an organization song to the system repertoire
    Given I am a system administrator
    And an organization song is eligible for promotion
    When I promote it from the console
    Then the song belongs to the system repertoire
    And the change is attributed to me

  Scenario: Demote a song back to its source organization
    Given I am a system administrator
    And a song was promoted from an organization
    When I demote it from the console
    Then the song returns to its source organization

  Scenario: An organization owner cannot promote
    Given I am an org_owner but not a system administrator
    When I open the Repertoire section
    Then I cannot promote or demote a song

  ──────────────────────────────────────────────
  FEEDBACK TRIAGE
  ──────────────────────────────────────────────
  # [needs backend] 0033_feedback.sql ships SUBMIT-ONLY and says so out loud:
  # "there is no client triage surface ... the owner reads them via
  # service_role/SQL console or a future triage surface." Its only read policy
  # is feedback_select_self, and its `status` column (new | triaged | closed)
  # has no writer. These scenarios are that surface, so they carry the policy
  # and the write that makes the column real.

  Scenario: A system administrator reads submitted feedback
    Given feedback rows exist from other members
    When I open the Feedback section as a system administrator
    Then I see those rows, newest first
    And each shows its kind and when it was submitted

  Scenario: A moderator cannot read submitted feedback
    Given I am a community moderator
    When I open the console
    Then the Feedback section is absent
    And reading the feedback table directly returns only my own rows

  Scenario: Triage a feedback row
    Given I am a system administrator viewing submitted feedback
    When I mark a row "triaged"
    Then the row's status is stored as "triaged"
    And the change is attributed to me, with a timestamp

  Scenario: Close a feedback row
    Given I am a system administrator viewing a triaged row
    When I close it
    Then the row's status is stored as "closed"
    And it is still readable, not deleted

  Scenario: Diagnostics are shown only when the reporter consented
    Given a feedback row submitted without diagnostics consent
    When I open it
    Then no device information or captured errors are shown
    And a row submitted with consent shows them

  ──────────────────────────────────────────────
  MEMBER DIRECTORY
  ──────────────────────────────────────────────
  # [needs backend] profiles.js exposes only searchProfiles / resolveById /
  # getProfile — all self- or lookup-scoped. There is no admin-wide listing.

  Scenario: A system administrator searches members
    Given I am a system administrator
    When I search the Member directory for a display name
    Then matching members are listed
    And each result shows their system role, if any

  Scenario: The directory does not expose private fields
    Given I am viewing the Member directory
    Then I do not see any member's date of birth
    And I do not see guardian contact details
    And I do not see authentication identifiers beyond the display identity

  Scenario: A moderator cannot browse the directory
    Given I am a community moderator
    When I open the console
    Then the Member directory section is absent

  ──────────────────────────────────────────────
  SYSTEM HEALTH
  ──────────────────────────────────────────────

  Scenario: A system administrator reviews storage use
    Given I am a system administrator
    When I open the System section
    Then I see chart storage consumption
    And I see how many rows the storage bucket holds

  Scenario: The console reports its own data failures
    Given a console query fails
    When the section renders
    Then the failure is stated on that section
    And the rest of the console still renders
