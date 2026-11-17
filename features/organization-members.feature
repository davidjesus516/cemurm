Feature: Organization Members Administration
  As an org admin or org owner
  I want to add, change roles of, and remove members of my organization
  So that I can manage who participates in my academy or orchestra

  ──────────────────────────────────────────────
  ADD MEMBER
  ──────────────────────────────────────────────

  Scenario: Org owner adds a new member to the organization
    Given organization "Academia Musical" exists with org_owner "Lucía"
    And user "Pedro" exists with email "pedro@academia.app"
    When org_owner "Lucía" adds user "Pedro" to "Academia Musical" as "instructor"
    Then user "Pedro" is an active member of "Academia Musical" with role "instructor"
    And an audit record exists for action "add_org_member" by actor "Lucía"

  Scenario: Org admin adds a new member to the organization
    Given organization "Academia Musical" exists with org_admin "Carlos"
    And user "Sofía" exists with email "sofia@academia.app"
    When org_admin "Carlos" adds user "Sofía" to "Academia Musical" as "branch_admin"
    Then user "Sofía" is an active member of "Academia Musical" with role "branch_admin"

  Scenario: Non-admin member cannot add another member
    Given organization "Academia Musical" exists with member "Lucía" (role "member")
    And user "Pedro" exists
    When member "Lucía" tries to add user "Pedro" to "Academia Musical"
    Then the action is rejected with "not authorized"
    And user "Pedro" is NOT a member of "Academia Musical"

  Scenario: Member cannot be added to an org they don't belong to by an outsider
    Given organization "Academia Musical" exists
    And user "Pedro" exists
    When outsider "María" (not a member of any org) tries to add user "Pedro" to "Academia Musical"
    Then the action is rejected with "not authorized"

  Scenario: Adding a non-existent user fails
    Given org_owner "Lucía" belongs to "Academia Musical"
    When org_owner "Lucía" tries to add non-existent user "ghost@example.com"
    Then the action is rejected with "user not found"

  ──────────────────────────────────────────────
  CHANGE ROLE
  ──────────────────────────────────────────────

  Scenario: Org owner changes a member's role
    Given org_owner "Lucía" belongs to "Academia Musical"
    And member "Pedro" is "instructor" at "Academia Musical"
    When org_owner "Lucía" changes member "Pedro" to role "org_admin" at "Academia Musical"
    Then member "Pedro" has role "org_admin" at "Academia Musical"
    And an audit record exists for action "change_member_role" by actor "Lucía"

  Scenario: Org admin cannot change org_owner role
    Given org_owner "Lucía" belongs to "Academia Musical"
    And org_admin "Carlos" belongs to "Academia Musical"
    When org_admin "Carlos" tries to change org_owner "Lucía" to role "member"
    Then the action is rejected with "cannot modify org_owner"

  Scenario: Changing role of non-member fails
    Given org_owner "Lucía" belongs to "Academia Musical"
    And user "Pedro" is NOT a member of "Academia Musical"
    When org_owner "Lucía" tries to change user "Pedro" to role "instructor" at "Academia Musical"
    Then the action is rejected with "membership not found"

  ──────────────────────────────────────────────
  REMOVE MEMBER
  ──────────────────────────────────────────────

  Scenario: Org owner removes a member (soft delete)
    Given org_owner "Lucía" belongs to "Academia Musical"
    And member "Pedro" is "instructor" at "Academia Musical"
    When org_owner "Lucía" removes member "Pedro" from "Academia Musical"
    Then member "Pedro" has status "removed" at "Academia Musical"
    And member "Pedro" is NOT an active member
    And an audit record exists for action "remove_org_member" by actor "Lucía"

  Scenario: Removed member cannot participate but data is preserved
    Given member "Pedro" was removed (status former) from "Academia Musical" (status "removed")
    When user "Pedro" tries to access org-scoped resources of "Academia Musical"
    Then access is denied
    And Pedro's enrollment records, progress, and contributions still exist

  Scenario: Org owner cannot be removed by org admin
    Given org_owner "Lucía" belongs to "Academia Musical"
    And org_admin "Carlos" belongs to "Academia Musical"
    When org_admin "Carlos" tries to remove org_owner "Lucía" from "Academia Musical"
    Then the action is rejected with "cannot remove org_owner"

  ──────────────────────────────────────────────
  MEMBER LIST VISIBILITY
  ──────────────────────────────────────────────

  Scenario: Org members can see the org roster
    Given org_member "Lucía" belongs to "Academia Musical"
    And member "Pedro" is "instructor" at "Academia Musical"
    And member "Sofía" is "branch_admin" at "Academia Musical"
    When org_member "Lucía" lists members of "Academia Musical"
    Then the roster includes "Pedro" (instructor) and "Sofía" (branch_admin)
    And does NOT include members of other organizations

  Scenario: Self-leave is handled by the existing leave RPC (not F1)
    Given member "Pedro" belongs to "Academia Musical"
    When member "Pedro" leaves "Academia Musical" via the leave RPC
    Then member "Pedro" has status "removed" at "Academia Musical"
    And the removal was performed by Pedro himself (self-leave)
