# CEMURM — Music Theory Domain Model

## 1. Purpose

This document defines how CEMURM models music theory concepts that matter to working musicians: scales, modes, chord degrees, key context, and vocal range. It exists so that the product serves advanced musicians without building a general-purpose music theory engine.

The governing principles:

1. **The musician declares, the system suggests.** CEMURM never guesses the key or the harmonic function of a chord. Tonic and scale come from the musician or from the imported file (MusicXML/ABC key signatures); the system may suggest but never imposes.
2. **Scale is data, not logic.** Scales and modes are interval tables in a catalog. Adding a new scale never touches the resolution engine.
3. **Degree quality derives from the scale, always.** No hardcoded "I = major" assumption. The same degree can be minor, major, or dominant depending on the scale context.
4. **The concrete chart is canonical; degrees are a derived view.** The stored chart content is the concrete ChordPro text (G — C — D). When a key context is declared, the degree progression (I — IV — V) is computed from that concrete content. The degree representation is never the source of truth; it is a projection parameterized by key context. Transposition re-renders the concrete chart in the target key context (semitone shift is the degenerate case), and the degree view follows.

> **Storage decision (2026-08):** Degree-canonical storage is deliberately NOT the model. Canonical degree storage would force key detection at import time (violating principle 1) and would rewrite the suite's concrete-chord content contract. The chosen path is concrete-canonical (C) with an **open door** to a future Nashville Number System (NNS) source format: because the theory core (scale catalog + degree resolver + section key contexts) is identical in both, an NNS source format can be added later as an opt-in format plugin per arrangement without rework. See §10.

## 2. Core Concepts

### 2.1 Scale

A scale is a named interval pattern relative to a tonic. Semitone offsets define the pitch collection.

```
Scale = { id, name, aliases[], intervals: [0, ...semitone offsets] }
```

Examples (intervals relative to tonic):

| Scale | Intervals |
|-------|-----------|
| Major (Ionian) | 0 2 4 5 7 9 11 |
| Natural minor (Aeolian) | 0 2 3 5 7 8 10 |
| Harmonic minor | 0 2 3 5 7 8 11 |
| Melodic minor | 0 2 3 5 7 9 11 |
| Dorian | 0 2 3 5 7 9 10 |
| Phrygian | 0 1 3 5 7 8 10 |
| Phrygian dominant (española / Hijaz) | 0 1 4 5 7 8 10 |
| Minor pentatonic | 0 3 5 7 10 |
| Major pentatonic | 0 2 4 7 9 |
| Chromatic | 0 1 2 3 4 5 6 7 8 9 10 11 |

The catalog is a data table. Semitone-based scales are in scope; microtonal scales (quarter tones) are an explicit non-goal (see §9).

### 2.2 Mode (rotation)

A mode is a rotation of a parent scale — the same pitch collection with a different tonic. Any parent scale produces N modes where N = its cardinality.

```
Mode = { parentScaleId, rotation, name?, aliases[] }
```

- Greek modes = the 7 rotations of the major scale (Ionian 0, Dorian 1, Phrygian 2, ... Locrian 6).
- Harmonic minor rotation 5 = **Phrygian dominant** (aliases: Spanish, Hijaz) — the classic "foreign/exotic" sound.
- Melodic minor rotation 4 = **Lydian dominant** (overtone); rotation 6 = **altered scale** (jazz).

The engine derives any mode from its parent + rotation at runtime. Named modes are aliases over (parent, rotation) pairs — a lookup table, not separate logic.

### 2.3 Key context

A key context is the pair (tonic, scale) that anchors a section of a song.

```
KeyContext = { tonic: Note, scale: ScaleId }
```

Examples: `E Phrygian`, `C# harmonic minor`, `Bb major`.

### 2.4 Chord

The stored chart content is **concrete** — the ChordPro text as written. The semantic model below is the *resolution layer* used to derive the degree view when a key context exists; it is not the storage format.

```
Chord = { concreteName: string, quality: Quality, bass?: Note, extensions?: string }
```

- `concreteName`: the chord as entered (G, Bm, E7, G/B) — canonical content.
- `quality`: derived from the scale by default (see §3.2), overridable by the musician; the override lives on the chord's concrete entry.
- `bass`: inversion/slash chord support (G/B, D/F#) — a concrete pitch within the concrete name.
- `extensions`: free-form (7, maj7, sus4, add9) — preserved as written.

The degree view is **computed**: resolve (key context, concrete chord) → degree (I, IV, V, ...). The stored representation remains "G-C-D"; "I-IV-V in G major" is the derived projection shown when the musician toggles the degree view.

### 2.5 Song structure (sectional)

A song is a sequence of sections. **Each section carries its own key context** — this is what makes modulation (key change mid-song) first-class.

```
Section = {
  id, label: "Verse 1" | "Chorus" | "Bridge" | ...,
  keyContext: KeyContext,        // tonic + scale (declared or inherited from song level)
  meter?: TimeSignature,         // 4/4, 3/4, 6/8, ...
  tempoBpm?: number,             // optional mid-song tempo change
  chords: Chord[],               // concrete chords, positioned relative to lyrics
  melody?: Note[]                // optional — enables vocal range analysis
}
```

Modulation = a section whose keyContext differs from the previous one. Transposition re-renders each section's concrete chords in its own target key context.

**Song-level key.** The song-level key (used by agreed key, key distribution, version diffs, call sheets) is **derived from the home/first section's key context**. Sections keep their own contexts; the song-level key is the home section's.

## 3. Resolution Engine

Pure, deterministic, table-driven. No analysis, no guessing.

### 3.1 Degree resolution

```
resolveDegree(keyContext, concreteChord) -> RomanNumeral | null
```

The concrete chord's root is mapped to a degree via the scale's interval table. A chord outside the scale's pitch collection resolves to `null` unless the musician declares its degree explicitly (borrowed/chromatic chords) — the system suggests, never guesses. Used for the degree view and for transposition of the concrete chart.

### 3.2 Quality derivation

The default quality of a diatonic triad/7th on each degree is derived from the scale's interval pattern — NOT from a major/minor assumption. Examples:

- Ionian I → major; ii → minor; V → major (dominant).
- Phrygian i → minor; Phrygian dominant i → **dominant 7** (the musician overrides quality when the harmony calls for it).
- Harmonic minor V → major (dominant) — the raised 7th of the parent.

Rule: quality defaults derive from the scale; the concrete chord as entered by the musician always wins (it IS the canonical content).

### 3.3 Transposition

Transposition = re-render the concrete chart in a target key context: every chord shifts by the same semitone offset, then is re-spelled according to the target key context. Section-aware: each section re-renders against its own context. The degree view follows the concrete re-render. (Semitone shifting with correct key-context spelling is the whole mechanism — there is no separate "degree re-resolution" step because the concrete chart is canonical.)

### 3.4 Enharmonic spelling

A resolved note has a preferred spelling based on the key context (F# vs Gb, Bb vs A#). The key context carries a spelling convention so the rendered chart shows the correct accidental spelling for the key signature. Applies to both chord names and rendered melody.

## 4. Views

The same stored chart renders through different views — all computed, none stored:

| View | What it shows |
|------|---------------|
| Concrete | G — C — D (resolved names) |
| Degree (roman numerals) | I — IV — V |
| Scale-aware degree | i — ♭VII — ♭VI (quality + alterations from scale) |
| Key signature | Correct accidentals per section context |

The degree view is the "advanced musician" toggle: portable across keys, matches how working musicians talk about progressions.

## 5. Vocal Range Analysis

If a section (or song) has melody notes, CEMURM can compute:

```
melodyRange = { lowest: Note, highest: Note, spanSemitones: int }
```

Compare against a singer's stored range (`profile.vocalRange`), and **suggest a transposition target**: "This key sits too high for this singer — try A instead of B." The musician decides; the system only suggests.

Data needed:
- Melody notes: imported (MusicXML/ABC) or annotated per section.
- Singer range: profile preference, per person (extends the existing Work → Arrangement → Personal Preference → Setlist Item model).

## 6. Progression Catalog

Common progressions as data, same philosophy as the scale catalog:

```
Progression = { id, name, degrees: [RomanNumeral] }
```

Examples: `ii-V-I`, `I-V-vi-IV`, 12-bar blues skeleton, **Andalusian cadence** (`i-♭VII-♭VI-V` — the flamenco sound, tied to Phrygian dominant).

Uses:
- Search: "songs built on the Andalusian cadence".
- Recommendation: suggest songs by progression pattern.
- Transposition assist: recognize a declared progression and propose the next key.

Catalog is data; recognition is exact-match on declared degrees (no automatic analysis — see §9).

## 7. Chord-Scale Theory (improvisation hints)

Connect the mode catalog with chord function: for a given chord (degree + quality) in a key context, which scale/mode sounds right over it.

```
ChordScale = { chordPattern: (degree, quality), scale: ScaleId }
```

Examples:

| Chord | Recommended scale |
|-------|-------------------|
| V7alt | Altered scale (melodic minor rotation 6) |
| m7b5 (ii in minor) | Locrian ♮2 (melodic minor rotation 6) |
| i (Phrygian dominant) | Phrygian dominant |
| IV in major | Lydian (Ionian rotation 3) |

Power for improvisers, zero logic — a lookup table over the existing catalog. Deferred, but the data model must not preclude it.

## 8. How the Original Requirements Map

| Requirement (user) | Model response |
|--------------------|----------------|
| Advanced notation in scores | Fidelity rendering layer: MusicXML (OSMD) / ABC (abcjs) / PDF. No theory engine involved. Already in scope (`music-notation.feature`). |
| Exotic scales (major, minor, pentatonic, chromatic, foreign) | Scale catalog as interval data. Chromatic = 12-note table. "Foreign" scales (Phrygian dominant, etc.) = catalog entries or mode rotations. |
| Greek modes | Mode = (parent, rotation). All 7 major modes + modes of harmonic/melodic minor derived at runtime. |
| Chord degree relationships (I, IV, V) | Degree view derived from the concrete chart + key context. Concrete ChordPro stays canonical; degree numerals are a computed render. |
| Modulation (key change mid-song) | Sectional structure: each section carries its own key context. |
| Enharmonic spelling | Spelling convention in key context. |
| Inversions / slash chords | `bass` field on chord. |
| Mid-song meter/tempo changes | Meter + tempo on section. |
| Vocal range → key suggestion | Melody notes + singer range → transposition suggestion. |
| Common progressions | Progression catalog as data. |
| Improvisation / chord-scale | Chord-scale lookup over the catalog. |

## 9. Non-Goals (explicit)

1. **Microtonality** — quarter-tone scales (maqam variants with ¾-tones, some ragas) cannot be rendered by standard notation tooling. Documented out of scope; the catalog is semitone-based.
2. **Automatic harmonic analysis** — the system never derives the key or chord function from raw chords. Musician-declared or import-derived only. (A future "suggestion" mode is allowed, never authoritative.)
3. **General music theory engine / tutoring** — CEMURM is a repertoire manager, not a theory curriculum.

## 10. Open Decisions

- [ ] Where the degree→quality override UI lives (per-chord inline vs. edit dialog).
- [ ] Whether melody annotation is MVP or post-MVP (vocal range feature depends on it).
- [ ] Progression catalog search syntax (exact degree match vs. transposed match).
- [ ] Chord-scale view: shipped as a data-only lookup or exposed as a first-class view.
- [ ] Scale catalog bootstrapping: curated seed list vs. import from an external theory dataset.

## 11. Future: Nashville Number System (NNS) Source Format — the Open Door

**Decision (2026-08):** concrete-canonical (C) now, with the door open for NNS later.

NNS (number charts — `1-4-5`, `b3`, `4sus`) is a real, widely used notation in which the chord chart IS stored as degrees against a key. It is the natural "degree-canonical" (B) evolution — but only as an **opt-in source format per arrangement**, never as the global storage contract:

| Aspect | Concrete-canonical (now) | NNS source format (future) |
|--------|--------------------------|----------------------------|
| Canonical content | ChordPro text (G - C - D) | Number chart (1 - 4 - 5) + key |
| Import without key | Allowed (draft state) | Not allowed — key required to store numbers |
| Conversion | — | ChordPro ↔ NNS with musician confirmation for non-diatonic chords |
| Substitutions | Concrete-keyed (Bm → Dmaj7) | Degree-keyed by nature (i → bIII) — resolves MT-002 cleanly |
| Transposition | Re-render concrete in target key | Re-resolve degrees — trivial |
| Who sees what | Everyone sees concrete | Owner edits NNS; others see rendered concrete |

The enabling condition: the theory core (scale catalog, degree resolver, section key contexts) is **identical** in both models. Adding NNS later is a format plugin + an opt-in flag + a conversion flow — no rework of the core, no rewrite of the suite's concrete-content contract. The decision to keep the door open costs nothing today; the decision to walk through it should be driven by real demand from advanced arrangers.
