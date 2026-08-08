Feature: Music Theory Model (Advanced Scales, Modes, and Degrees)
  As an advanced musician
  I want to declare scales, modes, and degree-based chord charts for my songs
  So that the app speaks the same harmonic language I use — any scale, any mode, any key

  ──────────────────────────────────────────────
  SCALE & MODE DECLARATION
  ──────────────────────────────────────────────

  Scenario: Declare a song in an exotic scale
    Given I create a new song "Canción Árabe"
    When I declare the song's key as "E Phrygian dominant"
    Then the song records key context tonic E and scale "Phrygian dominant"
    And the app shows the scale alias "española / Hijaz" as context

  Scenario: All seven Greek modes are recognized as scale context
    Given I declare "Canción A" in "C Ionian"
    And I declare "Canción B" in "D Dorian"
    And I declare "Canción C" in "E Phrygian"
    And I declare "Canción D" in "F Lydian"
    And I declare "Canción E" in "G Mixolydian"
    And I declare "Canción F" in "A Aeolian"
    And I declare "Canción G" in "B Locrian"
    When I open each song's key context
    Then each song records tonic and scale without assuming major/minor
    And the app never translates a mode into a relative major key

  Scenario: Modes of harmonic minor are first-class scale contexts
    Given I declare "Canción Klezmer" in "G Phrygian dominant"
    When I open the song's key context
    Then the scale is stored as "Phrygian dominant" (harmonic minor rotation 5)
    And the app does not flatten it to "G minor"

  Scenario: Melodic minor modes are first-class scale contexts
    Given I declare "Canción Jazz" in "F Lydian dominant"
    When I open the song's key context
    Then the scale is stored as "Lydian dominant" (melodic minor rotation 4)
    And a second section can be declared in "C altered" (melodic minor rotation 6)

  Scenario: The scale catalog is extensible data, not logic
    Given the app offers a curated scale catalog with major, natural minor, harmonic minor, melodic minor, pentatonic major/minor, chromatic, and the Greek modes
    When an administrator adds a new scale "Hungarian minor" via the catalog
    Then the new scale becomes available as a key context without any code change
    And existing songs are unaffected

  Scenario: Chromatic scale is a valid key context
    Given I declare "Canción Cromática" in "C chromatic"
    When I open the song
    Then the key context is accepted and rendered as declared
    And no mode rotation is derived for a chromatic context

  ──────────────────────────────────────────────
  DEGREE-BASED CHARTS (ROMAN NUMERALS)
  ──────────────────────────────────────────────

  Scenario: A chart is stored by degree, rendered as concrete chords
    Given the song "Canción X" has key context "G major"
    And its chord chart is entered as the progression I - IV - V
    When I open the song in default view
    Then the chords render as G - C - D
    And the stored chart content is the degree progression, not the concrete chords

  Scenario: Toggle between concrete and degree view
    Given "Canción X" renders as G - C - D in G major
    When I toggle "Show roman numerals"
    Then the chords display as I - IV - V
    And transposing the view to A re-renders the degree view as I - IV - V with concrete A - D - E

  Scenario: Degree quality derives from the scale
    Given the song "Canción Modal" has key context "E Phrygian"
    And its chart is entered as the progression i - ♭II - ♭VII
    When I open the degree view
    Then the tonic degree renders as a minor chord (i, not I)
    And the concrete chords resolve from the Phrygian scale intervals

  Scenario: Musician override wins over derived quality
    Given "Canción Árabe" is in "E Phrygian dominant"
    And the default quality for its tonic degree would be minor
    When I override the tonic chord quality to dominant 7th (E7)
    Then the stored chord records the explicit quality
    And the rendered chart shows E7
    And no later recomputation replaces my override

  Scenario: Inversions and slash chords keep their bass note
    Given "Canción X" in G major has a chord entered as "G/B" on the third beat
    When I open the song
    Then the chord renders as G/B with bass note B
    And transposing to A renders the same chord as A/C#
    And the bass note transposes with the chord

  ──────────────────────────────────────────────
  MODULATION & SECTIONAL KEY CONTEXT
  ──────────────────────────────────────────────

  Scenario: A song can modulate between sections
    Given "Canción Modulación" has a Verse in C major and a Chorus in G major
    When I view the song structure
    Then each section keeps its own key context
    And the degree view of the Chorus resolves against G major, not C major

  Scenario: Transposition re-resolves every section against its own context
    Given "Canción Modulación" has Verse in C major and Chorus in G major
    When I transpose the whole song up a whole step
    Then the Verse re-resolves in D major and the Chorus in A major
    And the relative relationship between sections is preserved

  Scenario: Mid-song meter and tempo changes belong to the section
    Given "Canción Cambio" has a Bridge in 3/4 at 90 BPM inside a 4/4 song at 120 BPM
    When I open the Bridge section
    Then the section context shows meter 3/4 and tempo 90 BPM
    And the other sections keep 4/4 at 120 BPM

  ──────────────────────────────────────────────
  ENHARMONIC SPELLING
  ──────────────────────────────────────────────

  Scenario: Rendered chords use the key's preferred spelling
    Given "Canción Bemol" is declared in "Gb major"
    When I open the song in concrete view
    Then the tonic renders as Gb, not F#
    And every resolved chord uses flats consistent with the Gb key signature

  Scenario: Transposing preserves the target key's spelling
    Given "Canción X" in C major with the chord E
    When I transpose to F# major
    Then the chord renders as A# in the F# spelling
    And the app does not mix sharp and flat spellings in the same section

  ──────────────────────────────────────────────
  VOCAL RANGE & KEY SUGGESTION (DEGREE-AWARE)
  ──────────────────────────────────────────────

  Scenario: Key suggestion uses the melody range, not the chord chart
    Given "Canción X" in G major has a melody spanning D4 to B4
    And singer "Juan" has a manual range of C3 to E4
    When the app analyzes the song for Juan
    Then it suggests a transposition that moves the melody into Juan's range
    And the suggestion labels the target by degree relationship (e.g., "down a fourth")
    And the musician decides; nothing is transposed automatically

  Scenario: Degree-aware suggestion works for any scale
    Given "Canción Modal" in "E Phrygian" has a melody spanning E4 to E5
    And singer "Pedro" has a range of B3 to B4
    When the app analyzes the song for Pedro
    Then it suggests transposing the tonic E down to B (same Phrygian scale)
    And the modal identity of the song is preserved in the suggestion

  ──────────────────────────────────────────────
  PROGRESSION CATALOG
  ──────────────────────────────────────────────

  Scenario: Common progressions are searchable by degree pattern
    Given the progression catalog contains "ii-V-I" and the Andalusian cadence (i - ♭VII - ♭VI - V)
    And "Canción Jazz" is declared with the progression ii - V - I
    When I search for the progression "ii-V-I"
    Then "Canción Jazz" appears as a result
    And the result shows its degree pattern, not a guessed key

  Scenario: Progression search matches across keys
    Given "Canción A" is in G major with progression ii - V - I (Am - D - G)
    And "Canción B" is in Bb major with progression ii - V - I (Cm - F - Bb)
    When I search for the progression "ii-V-I"
    Then both songs appear, regardless of their different keys

  Scenario: The Andalusian cadence is recognized as declared, never guessed
    Given "Canción Flamenco" is declared in "E Phrygian" with the progression i - ♭VII - ♭VI - V
    When I open the progression view
    Then the app labels the pattern "Andalusian cadence" from the catalog
    And the app never auto-detects a progression from raw chord names

  ──────────────────────────────────────────────
  NON-GOALS (DECLARED, NOT ANALYZED)
  ──────────────────────────────────────────────

  Scenario: The system never guesses a song's key
    Given I upload a ChordPro chart with no key declaration
    When I open the song
    Then the app shows the chart with "Key not declared"
    And it offers "Declare key" but does not infer the key from the chords

  Scenario: Microtonal scales are out of scope
    Given I attempt to declare a scale with quarter-tone intervals
    When the catalog rejects it
    Then the app explains "Microtonal scales are not supported"
    And the song remains in the last valid key context

  Scenario: Harmonic function is never auto-assigned
    Given "Canción X" has a declared key context and chord chart
    When I open the analysis view
    Then no function labels (tonic/subdominant/dominant) are assigned automatically
    And any function label shown must have been explicitly declared by a musician
