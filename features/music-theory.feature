Feature: Music Theory Model (Advanced Scales, Modes, and Degrees)
  As an advanced musician
  I want to declare scales, modes, and see degree-based chord views for my songs
  So that the app speaks the same harmonic language I use — any scale, any mode, any key
  While the concrete chord chart stays the canonical stored content

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
    When the system director (org-level administrator, per organizational repertoire model) adds a new scale "Hungarian minor" via the catalog
    Then the new scale becomes available as a key context without any code change
    And existing songs are unaffected

  Scenario: Chromatic scale is a valid key context
    Given I declare "Canción Cromática" in "C chromatic"
    When I open the song
    Then the key context is accepted and rendered as declared
    And no mode rotation is derived for a chromatic context

  ──────────────────────────────────────────────
  DEGREE VIEW (DERIVED FROM CONCRETE CHARTS)
  ──────────────────────────────────────────────

  Scenario: The concrete chart is canonical; degrees are a derived view
    Given the song "Canción X" has key context "G major"
    And its chord chart is stored as concrete ChordPro content "G - C - D"
    When I open the song in default view
    Then the chords render as G - C - D
    And the stored chart content is the concrete ChordPro text (unchanged by the theory model)
    And the degree progression I - IV - V is a derived view, not the stored content

  Scenario: Toggle between concrete and degree view
    Given "Canción X" renders as G - C - D in G major
    When I toggle "Show roman numerals"
    Then the chords display as I - IV - V
    And transposing the view to A re-renders the degree view as I - IV - V with concrete A - D - E
    And the stored chart content remains the original concrete G - C - D

  Scenario: Degree quality derives from the scale
    Given the song "Canción Modal" has key context "E Phrygian"
    And its chart is stored as concrete ChordPro content "Em - F - D"
    When I open the degree view
    Then the tonic degree renders as a minor chord (i, not I)
    And the concrete chords resolve from the Phrygian scale intervals

  Scenario: Musician override wins over derived quality
    Given "Canción Árabe" is in "E Phrygian dominant"
    And its chart is stored as concrete ChordPro content "E7 - F - D"
    When I open the degree view
    Then the tonic chord renders as I7 (explicit chord E7, quality overrides the scale-derived minor)
    And the concrete chart keeps E7 as entered
    And no later recomputation replaces the stored chord

  Scenario: Personal chord substitutions stay concrete-keyed and survive transpose
    Given Pedro plays "Canción W" and dislikes the B minor in the chorus
    When Pedro sets a personal substitution "Bm -> Dmaj7" for that chord
    Then Pedro's view renders Dmaj7 where the chart says Bm
    And the shared concrete chart keeps B minor
    And the substitution moves correctly when Pedro transposes the song
    And the degree view (when enabled) re-derives degrees from the concrete chart plus substitution

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

  Scenario: Stage-mode transpose re-renders in the target key context
    Given "Canción Bemol" is in Gb major with the chord progression Gb - Db - Eb
    When I open it in performance mode and set transpose to +2 semitones
    Then the chords re-render in the target key context (A major) using its spelling
    And no chord renders with a spelling from the wrong key context (no mixed sharps/flats)

  Scenario: Capo shapes stay relative while the degree view uses concert key
    Given "Canción Capo" is in C major and Pedro has a capo preference of fret 2
    When Pedro opens the song with the degree view enabled
    Then the degree view resolves against concert C (the sounding key)
    And the app shows "Capo 2 · sounds D" with the C shapes relative to the capo
    And the degree numerals stay anchored to concert C, not to the capo shapes

  Scenario: Mid-song meter and tempo changes belong to the section
    Given "Canción Cambio" has a Bridge in 3/4 at 90 BPM inside a 4/4 song at 120 BPM
    When I open the Bridge section
    Then the section context shows meter 3/4 and tempo 90 BPM
    And the other sections keep 4/4 at 120 BPM

  Scenario: Song-level key is derived from the home section
    Given "Canción Modulación" has a Verse in C major and a Chorus in G major
    When I view the song's metadata
    Then the song-level key is C major (the home/first section context)
    And the agreed key, key distribution, and version diffs use the song-level key C major
    And each section still renders with its own key context (Chorus in G major)

  Scenario: Transposing a modulating song shifts every section relative to its own context
    Given "Canción Modulación" has Verse in C major and Chorus in G major
    When I transpose the whole song up a whole step in performance mode
    Then the Verse re-resolves in D major and the Chorus in A major
    And the relative relationship between sections is preserved
    And the song-level key becomes D major (home section)

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

  Scenario: Two key-suggestion modes coexist (setlist range-fit vs song melody analysis)
    Given the setlist-level suggestion in personal preferences fits singers by observed range without melody data
    And the song-level melody analysis in this feature uses melody notes when available
    When the director sees a setlist warning "C fits only Lucia's range"
    Then that warning comes from the setlist range-fit mode
    And if "Canción X" has melody notes, the song-level analysis can suggest a degree-aware target ("down a fourth")
    And the two modes are explicitly cross-referenced, never merged into one guessing engine

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

  Scenario: Chord-name search and progression search use different, declared contracts
    Given chord-name search in search-and-discovery matches rendered concrete chords ("G major")
    When I search for the chord "G major"
    Then songs whose rendered chords include G major appear, tagged with the matching chord
    And songs with "Key not declared" are excluded from chord-name search results
    When I search for the progression "ii-V-I"
    Then only songs with declared degree patterns match (never auto-detected from raw names)

  ──────────────────────────────────────────────
  NON-GOALS (DECLARED, NOT ANALYZED)
  ──────────────────────────────────────────────

  Scenario: The system never guesses a song's key
    Given I upload a ChordPro chart with no key declaration
    When I open the song
    Then the app shows the chart with "Key not declared" (the same missing-key state song-lifecycle gates as "missing base key")
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
