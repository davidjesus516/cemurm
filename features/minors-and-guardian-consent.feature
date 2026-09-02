Feature: Minor Accounts and Guardian Consent
  As an academy running CEMURM for students under 18
  I want minor accounts to require guardian consent and stay visibility-restricted
  So that underage musicians take part within the org without public exposure

  ──────────────────────────────────────────────
  ACCOUNT CREATION AND AGE GATE
  ──────────────────────────────────────────────

  Scenario: Signup asks the age and routes under-18 declarations
    Given I am creating an account for a student
    When the signup asks for age
    Then declaring "under 18" starts the guardian consent flow
    And declaring "18 or older" continues with the normal signup
  Scenario: A minor account activates only after consent
    Given the student declared "under 18" at signup
    When the guardian has not yet given consent
    Then the account stays inactive with "Guardian consent required"
    And no feature is usable until consent is recorded
  Scenario: The consent record stores the decision
    Given a guardian consented for "Mateo" through the consent flow
    When the consent is recorded
    Then the record stores the guardian's identity, the date, and the consent text they saw
    And the record's status is "active"

  ──────────────────────────────────────────────
  VISIBILITY BOUNDARIES
  ──────────────────────────────────────────────

  Scenario: A minor cannot contribute to the public community without the guardian
    Given Mateo's account is active under guardian consent
    When Mateo tries to publish a song to the public library
    Then the contribution is blocked with "Guardian approval required for public sharing"
    And when the guardian approves, the contribution publishes with the approval recorded
  Scenario: Instructor access is scoped to the org
    Given Mateo is a student at "Academia Centro"
    When his instructor opens Mateo's profile
    Then the instructor sees only Mateo's participation inside the academy
    And never his personal annotations, practice detail, or community activity
  Scenario: Minor data stays out of public surfaces
    Given Mateo's account is under guardian consent
    When someone browses the public community
    Then minors never appear in public profiles or suggested lists
    And no minor content surfaces without a guardian-approved contribution

  ──────────────────────────────────────────────
  CONSENT LIFECYCLE
  ──────────────────────────────────────────────

  Scenario: A guardian can review and revoke consent
    Given an "active" consent record exists for Mateo
    When his guardian opens the consent record
    Then the guardian sees what the consent covers and when it was given
    And can revoke it at any time
  Scenario: Revoking consent restricts the account immediately
    Given the guardian revoked consent for Mateo
    When the account is next used
    Then all public and out-of-org activity stops immediately
    And the org is notified that the student's participation scope changed
  Scenario: Turning 18 ends the minor status
    Given Mateo is 17 and under guardian consent
    When he turns 18
    Then his minor status ends and the consent record is archived
    And the account converts to a standard account without further consent
  Scenario: Revoking consent never deletes data by itself
    Given consent was revoked for Mateo's account
    When the account continues to be used
    Then no data is deleted by the revocation
    And removal happens only through the explicit deletion request