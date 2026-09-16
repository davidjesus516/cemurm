# Personal Preferences Specification

## Purpose

Persisted personal adaptations (issue #55, org-free slice): global transpose offset with per-song override, capo display, personal default version with setlist picker, personal annotations and chord substitution, practice key/tempo, annotations preserved across transpose. Coverage: `features/personal-preferences-and-adaptations.feature` — scenarios "Singer sets a personal transpose offset" through "Choosing a version on a setlist item", "Performer annotates their own copy", "Personal chord substitution", "Annotations are preserved across transpose", "Practice key differs from stage key", "Personal tempo preference for practice" in scope; the rest deferred to Hito 3/4/6 (rebase, duet, contexts, agreed key, fork, orchestral, range, conflicts, range history).

## Requirements

### Requirement: Persisted transpose preference

The system MUST persist a global transpose offset, apply it when rendering any song (base metadata unchanged), and persist per-song overrides that beat the global offset for that song only.

#### Scenario: Singer sets a personal transpose offset

- GIVEN Juan's offset is +2 and "Canción X" has base key C
- WHEN Juan opens "Canción X" in his library
- THEN the chords render in D and the base arrangement metadata stays in C

#### Scenario: Personal offset applies to every song

- GIVEN Juan has a global transpose offset of +2
- WHEN he opens any song with base key C
- THEN the chords render a whole step higher with no change to the stored arrangement content

#### Scenario: Per-song override beats the global preference

- GIVEN Juan's global offset is +2 and he set a −1 override on "Canción X"
- WHEN Juan opens "Canción X"
- THEN the chords render in B, and his other songs still use the global +2 offset

### Requirement: Capo display

When a capo preference is set, the app MUST show "Capo <n> · sounds <key>" with the chord shapes to play relative to the capo, and the sounding key MUST match the capo shift.

#### Scenario: Capo preference shown on guitar charts

- GIVEN Pedro has a capo preference of fret 2
- WHEN Pedro opens a song rendered in key C
- THEN the app shows "Capo 2 · sounds D", displays the C shapes relative to the capo, and the sounding key for the band is D

### Requirement: Version preference and picker

The system MUST persist a default version per user, open it by default while the picker still offers other versions, keep the preference personal (the repertoire still lists all versions), and record the chosen version on a setlist item with the label visible to bandmates.

#### Scenario: Performer prefers a specific version by default

- GIVEN "Canción Y" has versions "Original (artist)" and "Pedro's arrangement"; Pedro's default is the latter
- WHEN Pedro searches for "Canción Y"
- THEN the result opens "Pedro's arrangement" by default and the picker still offers "Original (artist)"

#### Scenario: Version preference is personal, not shared

- GIVEN Juan prefers "Original (artist)" and Pedro prefers "Pedro's arrangement"
- WHEN both open "Canción Y" in their own libraries
- THEN Juan sees the original, Pedro sees his arrangement, and the repertoire lists both versions

#### Scenario: Choosing a version on a setlist item

- GIVEN I am editing the setlist "Sunday Jam"
- WHEN I add "Canción Y" and select "Pedro's arrangement"
- THEN the item records the chosen version, bandmates see its label, and each performer's personal transpose still applies on their device

### Requirement: Personal annotations and chord substitution

Annotations MUST be stored on the author's profile only (invisible to others), and a personal chord substitution MUST render only on the author's view, keeping the shared chart unchanged and moving correctly under transpose.

#### Scenario: Performer annotates their own copy

- GIVEN Juan opens "Canción Z" in the shared arrangement
- WHEN Juan adds "bass enters on verse 2" at measure 8
- THEN the annotation is stored on Juan's profile only and Pedro does not see it

#### Scenario: Personal chord substitution

- GIVEN Pedro dislikes the B minor in "Canción W"'s chorus
- WHEN Pedro sets the substitution "Bm → Dmaj7" for that chord
- THEN Pedro's view renders Dmaj7, the shared chart keeps B minor, and the substitution moves correctly when Pedro transposes

### Requirement: Annotations preserved across transpose

Annotations MUST stay anchored to their measure and keep their content when the view is transposed.

#### Scenario: Annotations are preserved across transpose

- GIVEN Juan annotated measure 8 of "Canción Z" in key C
- WHEN Juan transposes his view to key D
- THEN the annotation stays anchored to measure 8 and its content is unchanged

### Requirement: Practice key and tempo preferences

Practice mode MUST render the song's practice-key preference (stage key unchanged for everyone else) and MUST use the preferred practice tempo for metronome and auto-scroll (shared base tempo unchanged).

#### Scenario: Practice key differs from stage key

- GIVEN Juan practices "Canción Z" in D but plays it on stage in G
- WHEN Juan opens the song in practice mode
- THEN his practice view renders in D and the setlist stage key G is unchanged for everyone else

#### Scenario: Personal tempo preference for practice

- GIVEN Juan prefers to practice "Canción Z" at 70 BPM (song base is 100 BPM)
- WHEN Juan opens the song in practice mode
- THEN the metronome and auto-scroll use 70 BPM and the shared song metadata keeps 100 BPM