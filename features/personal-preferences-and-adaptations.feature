Feature: Personal Preferences and Adaptations
  As a performer
  I want my personal key, capo, version, and annotation preferences to follow me across songs
  So that the shared arrangement stays canonical while each member plays in their own comfortable key

  ──────────────────────────────────────────────
  PERSONAL KEY & CAPO PREFERENCES
  ──────────────────────────────────────────────

  Scenario: Singer sets a personal transpose offset
    Given "Juan" has set a personal transpose offset of +2 semitones
    And the arrangement "Canción X" has a base key of C
    When Juan opens "Canción X" in his library
    Then the chords render in D (base key transposed by his offset)
    And the base arrangement metadata remains in key C

  Scenario: Personal offset applies to every song in the library
    Given "Juan" has a global transpose offset of +2 semitones
    When Juan opens any song with base key C
    Then the chords render a whole step higher
    And Juan sees no change to the stored arrangement content

  Scenario: Capo preference shown on guitar charts
    Given "Pedro" has a capo preference of fret 2
    When Pedro opens a song rendered in key C
    Then the app shows "Capo 2 · sounds D" and displays the C shapes to play relative to the capo
    And the sounding key for the rest of the band is D (two semitones above concert C)

  Scenario: Per-song override beats the global preference
    Given "Juan" has a global transpose offset of +2 semitones
    And Juan set an override of -1 semitone for "Canción X" only
    When Juan opens "Canción X"
    Then the chords render in B (base key C with the per-song override)
    And Juan's other songs still use the global +2 offset

  ──────────────────────────────────────────────
  PERSONAL VERSION PREFERENCE
  ──────────────────────────────────────────────

  Scenario: Performer prefers a specific version by default
    Given "Canción Y" has two versions: "Original (artist)" and "Pedro's arrangement"
    And Pedro set his default version to "Pedro's arrangement"
    When Pedro searches for "Canción Y"
    Then the result opens "Pedro's arrangement" by default
    And the version picker still offers "Original (artist)"

  Scenario: Version preference is personal, not shared
    Given Juan prefers "Original (artist)" and Pedro prefers "Pedro's arrangement"
    When both open "Canción Y" in their own libraries
    Then Juan sees the original version
    And Pedro sees his arrangement
    And the system repertoire still lists both versions as available

  Scenario: Choosing a version on a setlist item
    Given I am editing the setlist "Sunday Jam"
    When I add "Canción Y" and select version "Pedro's arrangement"
    Then the setlist item records the chosen version
    And bandmates see the version label "Pedro's arrangement" on that item
    And each performer's personal transpose still applies on their device

  ──────────────────────────────────────────────
  BASE KEY DRIFT & REBASE PROPOSALS
  ──────────────────────────────────────────────

  Scenario: System detects a song whose base key is never used
    Given "Canción Z" has a base key of C
    And 6 of the last 10 performances of "Canción Z" used personal offset +2 (rendered in D)
    When I open the song's analytics
    Then the app flags "This song is usually performed in D"
    And offers the option "Set D as the new base key"

  Scenario: Rebase preserves rendered keys for everyone
    Given "Canción Z" has a base key of C
    And Juan's personal offset is +2 (his view renders in D)
    And a setlist item agrees "Canción Z" in G
    When the owner confirms "Set D as the new base key"
    Then the base key of "Canción Z" becomes D
    And Juan's rendered key stays D (his offset is recomputed from +2 to 0)
    And the setlist item with agreed key G still renders in G
    And the change is recorded with lineage (owner, date, prior base key C)

  Scenario: Rebase is a proposal, not an automatic change
    Given the app suggests rebasing "Canción Z" to D
    When a non-owner tries to confirm the rebase
    Then the action is rejected with "Only the version owner can rebase"
    And the base key remains C until the owner decides

  ──────────────────────────────────────────────
  DUET & MULTI-VOCAL PROJECTIONS
  ──────────────────────────────────────────────

  Scenario: Setlist item with two vocal parts over one chart
    Given the setlist item for "Canción Z" has two vocal parts: "Melody (Juan)" and "Harmony (Pedro)"
    And the item agrees the chord chart in G
    When Juan opens the item in performance mode
    Then Juan sees the melody part as his primary line with the shared chords
    And he can toggle to view the harmony part
    When Juan transposes his view +2
    Then both vocal parts and the chord chart shift together to A

  Scenario: Harmony line stays anchored to chord changes
    Given the "Harmony (Pedro)" part has a note change at the chorus chord change
    When the setlist item is transposed to a new key
    Then the harmony part transposes by the same semitone shift
    And the chord-anchored markers stay aligned with the same chord positions

  Scenario: Each duet singer sees their own part by default
    Given the setlist item for "Canción Z" has parts "Melody (Juan)" and "Harmony (Pedro)"
    When Pedro opens the item in performance mode
    Then Pedro sees the harmony part as his primary line
    And the shared chord chart renders in his personal projection
    And the melody part is available as secondary view

  ──────────────────────────────────────────────
  CONTEXTUAL PREFERENCE OVERRIDES
  ──────────────────────────────────────────────

  Scenario: Event context overrides the personal default
    Given the event "Festival Nacional" is set to "perform in original keys"
    And Juan's global offset is +2
    When Juan opens a song from the Festival Nacional setlist
    Then the song renders in its original key (event context beats personal default)
    And Juan can still override manually for that specific item

  Scenario: Band context applies to all members
    Given the band "Sunday Band" is set to "play half step down from original"
    When Juan and Pedro open the same song from the band setlist
    Then both render with the band context applied (base key minus one semitone)
    And neither singer's personal default is applied to that song

  Scenario: Precedence — explicit item key beats context beats global default
    Given Juan has a global offset of +2
    And the band context "Sunday Band" applies minus one semitone
    And the setlist item "Canción Z" has an explicit agreed key G
    When Juan opens "Canción Z" on the setlist
    Then the item renders from the explicit agreed key G
    But when Juan opens "Canción W" from the same setlist without an explicit key
    Then the band context minus one semitone is applied to "Canción W"

  Scenario: Changing context does not rewrite explicit keys
    Given the band "Sunday Band" context is "play half step down"
    And the item "Canción Z" has an explicit agreed key G
    When the band leader changes the context to "perform in original keys"
    Then items without explicit keys render at their base key
    And "Canción Z" still renders in G (explicit key preserved)

  ──────────────────────────────────────────────
  AGREED KEY VS PERSONAL PROJECTION
  ──────────────────────────────────────────────

  Scenario: Setlist fixes the agreed key for the band
    Given the setlist "Sunday Jam" contains "Canción Z" with agreed key G
    When Juan (offset +2) opens the setlist in performance mode
    Then the setlist metadata keeps the agreed key G
    And Juan's device renders the chords in A (his personal projection)
    And Pedro (offset -3) renders the same item in E (his personal projection)

  Scenario: Toggle between agreed key and personal key
    Given Juan opens "Canción Z" on the setlist with agreed key G
    And Juan's projection renders it in A
    When Juan toggles "Show agreed key"
    Then the chords render in G for everyone on the same screen

  Scenario: Key conflict warning when adding a member's favorite
    Given the setlist "Sunday Jam" has agreed key A for "Canción Z"
    And Juan's preferred range fits keys F through G
    When Juan's projection for "Canción Z" in key A is out of his preferred range
    Then the app shows "This is +2 semitones above your preferred range"
    And offers options: "Play in A anyway", "Propose new agreed key", "Keep personal view"

  Scenario: Propose a new agreed key from personal preference
    Given Juan's preferred range fits keys F through G
    And "Canción Z" is agreed in A (above his preferred range)
    When Juan taps "Propose new agreed key"
    And Juan selects F as the proposed key
    Then the setlist shows a pending proposal "Canción Z in F (proposed by Juan)"
    And the agreed key changes only when the band leader confirms

  ──────────────────────────────────────────────
  PERSONAL ANNOTATIONS
  ──────────────────────────────────────────────

  Scenario: Performer annotates their own copy
    Given Juan opens "Canción Z" in the shared arrangement
    When Juan adds a personal annotation "bass enters on verse 2" at measure 8
    Then the annotation is stored on Juan's profile only
    And Pedro does not see the annotation

  Scenario: Personal chord substitution
    Given Pedro plays "Canción W" and dislikes the B minor in the chorus
    When Pedro sets a personal substitution "Bm -> Dmaj7" for that chord
    Then Pedro's view renders Dmaj7 where the chart says Bm
    And the shared chart keeps B minor
    And the substitution moves correctly when Pedro transposes the song

  Scenario: Promote a personal annotation to a shared fork
    Given Pedro has a personal chord substitution on "Canción W"
    When Pedro taps "Create version from my changes"
    Then a new version "Canción W (Pedro's changes)" is created
    And the new version records "Original (artist)" as its lineage source
    And Pedro becomes the owner of the new version

  Scenario: Annotations are preserved across transpose
    Given Juan annotated measure 8 of "Canción Z" in key C
    When Juan transposes his view to key D
    Then the annotation stays anchored to measure 8
    And the annotation content is unchanged

  ──────────────────────────────────────────────
  ORCHESTRAL / TRANSPOSING INSTRUMENTS
  ──────────────────────────────────────────────

  Scenario: Transposing instrument renders its own concert-pitch part
    Given the orchestral arrangement "Obertura X" is stored in concert pitch C
    And trumpet player "Lucia" plays a B-flat trumpet
    When Lucia opens the trumpet part
    Then the part renders transposed a whole step up (D) for her instrument
    And the score remains in concert pitch C for the conductor and piano

  Scenario: Instrument preference follows the player
    Given Lucia's profile lists "Trumpet in B-flat" as her instrument
    When Lucia opens any orchestral part in her library
    Then transposing parts render for B-flat trumpet automatically
    And non-transposing instruments (flute, piano) render in concert pitch

  ──────────────────────────────────────────────
  PRACTICE CONTEXT
  ──────────────────────────────────────────────

  Scenario: Practice key differs from stage key
    Given Juan finds it easier to practice "Canción Z" in D but plays it on stage in G
    When Juan opens the song in practice mode
    Then his practice view renders in D (his practice preference)
    And the setlist stage key G is unchanged for everyone else

  Scenario: Personal tempo preference for practice
    Given Juan prefers to practice "Canción Z" at 70 BPM (song base is 100 BPM)
    When Juan opens the song in practice mode
    Then the metronome and auto-scroll use 70 BPM
    And the shared song metadata keeps 100 BPM as the base tempo

  ──────────────────────────────────────────────
  OBSERVED VOCAL RANGE (AUTOMATIC DETECTION)
  ──────────────────────────────────────────────

  Scenario: System learns a singer's observed range from transpose history
    Given Juan has performed 20 songs over the last 6 months
    And Juan marked 15 of those performances as "ok in this key"
    And those songs were rendered across a span of keys F# to B
    When the system builds Juan's range profile
    Then it infers an observed range of F# to B
    And the profile shows "Learned from 15 marked performances"

  Scenario: Range detection never overrides an explicit preference
    Given Juan has an explicit manual preference "range A to D"
    And his performance history suggests a wider range F# to B
    When the system builds Juan's range profile
    Then the manual preference wins for conflict warnings
    And the observed range is kept as a separate profile from the manual preference

  Scenario: Setlist key suggestion uses observed ranges
    Given a director is building a setlist with singers Juan, Pedro, and Lucia
    And Juan's observed range is E to B, Pedro's is D to A, and Lucia's is C to F
    When the director adds "Canción Z" whose base key is C
    Then the app warns "C fits only Lucia's range"
    And suggests "Try F — fits Juan, Pedro, and Lucia"
    And shows a per-singer fit breakdown (fit / high / low)

  Scenario: Key conflict warning uses the observed range
    Given Juan's observed range is F# to B
    And Juan has no explicit manual range preference
    And the setlist item "Canción Z" agrees on key C
    When Juan opens the item
    Then the app warns "C is 1 semitone above your observed range"
    And offers options: "Play anyway", "Propose new agreed key", "Ignore for this song"

  ──────────────────────────────────────────────
  RANGE HISTORY OVER TIME
  ──────────────────────────────────────────────

  Scenario: Range profile changes are tracked over time
    Given Juan's range profile in 2024 was A to E
    And his 2025 profile is G to D (observed range shifted down)
    When Juan opens his range history view
    Then the view shows the shift from A–E to G–D over time
    And each range period is associated with the performances that produced it

  Scenario: Old setlists stay faithful to their era
    Given Juan's 2024 setlist "Spring Set" used keys in his 2024 range
    When Juan opens "Spring Set" today (2025 range is lower)
    Then the setlist keeps the 2024 keys unchanged
    And the app shows "These keys fit your 2024 range (A–E)" as context
    And Juan can choose to project the whole setlist into his current range (per-device view only — agreed keys unchanged)

  Scenario: System suggests rechecking songs near the range boundary
    Given Juan's range shifted down from A–E to G–D
    When Juan opens a song whose 2024 key was E (top of his old range, above current)
    Then the app flags "This song may feel high now — your range moved down"
    And offers "Open in current recommended key (D)"

  ──────────────────────────────────────────────
  CONFLICT DECISIONS
  ──────────────────────────────────────────────

  Scenario: Leader resolves conflicting version preferences
    Given Juan prefers version "Original (artist)" for "Canción Y"
    And Pedro prefers version "Pedro's arrangement" for the same setlist item
    When the band leader confirms version "Pedro's arrangement"
    Then the setlist item records "Pedro's arrangement" as the chosen version
    And the decision is logged with the leader as decider
    And Juan and Pedro both see the confirmed version on the item

  Scenario: Leader resolves conflicting agreed-key proposals
    Given Juan proposed key F for "Canción Z"
    And Pedro proposed key A for the same setlist item
    When the band leader confirms key G as a compromise
    Then the setlist item records agreed key G
    And the activity feed shows "Key agreed: G (leader decision)"
    And each performer's projection still applies on their own device

  Scenario: Conflict decision is reversible
    Given the leader chose version "Pedro's arrangement" for "Canción Y"
    When the leader later switches the item to "Original (artist)"
    Then the setlist item records "Original (artist)" as the chosen version
    And the change is logged in the activity feed
    And both performers see the updated version immediately
