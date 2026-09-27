// Characterization tests — locks current behaviour before the PR 1b boundary refactor.
// Specified by: features/personal-preferences-and-adaptations.feature
// PR 1b will split this module. These tests must pass with ZERO edits.

import { describe, it, expect } from 'vitest'

import { noteForLine, buildSubstitutionMap, applySubstitution } from './annotations.js'

// ── fixtures ────────────────────────────────────────────────────────────────
// The note row is the real personal_annotations seed row
// (supabase/seed.sql:118 — anchor {"section":"Chorus","index":1}).
const SEED_NOTE = {
  kind: 'note',
  anchor: { section: 'Chorus', index: 1 },
  value: 'Ring out the open A; watch the F#m voicing',
}

// The "Personal chord substitution" scenario: Bm -> Dmaj7 on Canción W.
const SUBS = [
  { kind: 'chord_substitution', anchor: { chord: 'Bm' }, value: 'Dmaj7' },
  { kind: 'note', anchor: { section: 'Chorus', index: 2 }, value: 'breath here' },
]

// ── noteForLine ──────────────────────────────────────────────────────────────

describe('noteForLine', () => {
  it('resolves the seeded note by {section, index}', () => {
    expect(noteForLine([SEED_NOTE], 'Chorus', 1)).toBe('Ring out the open A; watch the F#m voicing')
  })

  it('resolves a non-ASCII section name (the feature file uses "Canción X")', () => {
    const ann = [{ kind: 'note', anchor: { section: 'Canción X', index: 8 }, value: 'bass enters on verse 2' }]
    expect(noteForLine(ann, 'Canción X', 8)).toBe('bass enters on verse 2')
  })

  it('returns null for absent, null, undefined and empty annotation lists', () => {
    expect(noteForLine([], 'Chorus', 1)).toBe(null)
    expect(noteForLine(null, 'Chorus', 1)).toBe(null)
    expect(noteForLine(undefined, 'Chorus', 1)).toBe(null)
  })

  it('returns null when the section or the line index does not match', () => {
    expect(noteForLine(SUBS, 'Chorus', 3)).toBe(null)
    expect(noteForLine(SUBS, 'Verse 1', 2)).toBe(null)
    expect(noteForLine(SUBS, 'Chorus', 1)).toBe(null)
  })

  it('matches line index 0 (a falsy index is not treated as absent)', () => {
    const ann = [{ kind: 'note', anchor: { section: 'Verse 1', index: 0 }, value: 'pickup' }]
    expect(noteForLine(ann, 'Verse 1', 0)).toBe('pickup')
  })

  it('compares the line index strictly — a string "1" never matches 1', () => {
    expect(noteForLine([SEED_NOTE], 'Chorus', '1')).toBe(null)
  })

  it('returns the FIRST match when two notes share an anchor', () => {
    const ann = [
      { kind: 'note', anchor: { section: 'C', index: 1 }, value: 'first' },
      { kind: 'note', anchor: { section: 'C', index: 1 }, value: 'second' },
    ]
    expect(noteForLine(ann, 'C', 1)).toBe('first')
  })

  it('ignores non-note kinds and unanchored rows', () => {
    expect(noteForLine([{ kind: 'chord_substitution', anchor: { section: 'C', index: 1 }, value: 'x' }], 'C', 1)).toBe(null)
    expect(noteForLine([{ kind: 'note', value: 'x' }], 'C', 1)).toBe(null)
  })

  it('ignores a bare-string anchor (the legacy substitution shape)', () => {
    expect(noteForLine([{ kind: 'note', anchor: 'Chorus', value: 'x' }], 'Chorus', 1)).toBe(null)
  })

  it('returns "" for an empty-string value — not null', () => {
    // FINDING: `match?.value ?? null` only normalises null/undefined, so an
    // empty note is indistinguishable from "" while "no note" is null.
    expect(noteForLine([{ kind: 'note', anchor: { section: 'C', index: 1 }, value: '' }], 'C', 1)).toBe('')
  })

  it('normalises a null or missing value to null', () => {
    expect(noteForLine([{ kind: 'note', anchor: { section: 'C', index: 1 }, value: null }], 'C', 1)).toBe(null)
    expect(noteForLine([{ kind: 'note', anchor: { section: 'C', index: 1 } }], 'C', 1)).toBe(null)
  })

  it('passes a non-string value straight through despite the string|null contract', () => {
    expect(noteForLine([{ kind: 'note', anchor: { section: 'C', index: 1 }, value: 0 }], 'C', 1)).toBe(0)
  })

  it('does not mutate the input', () => {
    const ann = [{ kind: 'note', anchor: { section: 'C', index: 1 }, value: 'v' }]
    const before = JSON.stringify(ann)
    noteForLine(ann, 'C', 1)
    expect(JSON.stringify(ann)).toBe(before)
  })
})

// ── buildSubstitutionMap ─────────────────────────────────────────────────────

describe('buildSubstitutionMap', () => {
  it('maps a chord_substitution anchor to its value', () => {
    expect(buildSubstitutionMap([SUBS[0]])).toEqual({ Bm: 'Dmaj7' })
  })

  it('never lets a note anchor into the map', () => {
    expect(buildSubstitutionMap([SEED_NOTE])).toEqual({})
    const map = buildSubstitutionMap(SUBS)
    expect(Object.prototype.hasOwnProperty.call(map, 'Chorus')).toBe(false)
  })

  it('returns {} for absent, null, undefined and empty lists', () => {
    expect(buildSubstitutionMap([])).toEqual({})
    expect(buildSubstitutionMap(null)).toEqual({})
    expect(buildSubstitutionMap(undefined)).toEqual({})
  })

  it('tolerates a bare-string anchor (legacy shape) as the chord token', () => {
    expect(buildSubstitutionMap([{ kind: 'chord_substitution', anchor: 'Bm', value: 'Dmaj7' }])).toEqual({ Bm: 'Dmaj7' })
  })

  it('ignores extra anchor fields and takes only anchor.chord', () => {
    const map = buildSubstitutionMap([{ kind: 'chord_substitution', anchor: { chord: 'Bm', section: 'Chorus', index: 2 }, value: 'Dmaj7' }])
    expect(map).toEqual({ Bm: 'Dmaj7' })
    expect(Object.keys(map)).toEqual(['Bm'])
  })

  it('keeps the LAST substitution when an anchor repeats', () => {
    const map = buildSubstitutionMap([
      { kind: 'chord_substitution', anchor: { chord: 'Bm' }, value: 'First' },
      { kind: 'chord_substitution', anchor: { chord: 'Bm' }, value: 'Second' },
    ])
    expect(map).toEqual({ Bm: 'Second' })
  })

  it('drops a falsy chord anchor', () => {
    expect(buildSubstitutionMap([{ kind: 'chord_substitution', anchor: { chord: '' }, value: 'X' }])).toEqual({})
    expect(buildSubstitutionMap([{ kind: 'chord_substitution', value: 'X' }])).toEqual({})
  })

  it('creates the key even when the value is undefined, so the key counts as present', () => {
    // FINDING: the early-return guard in applySubstitution is Object.keys()
    // .length, so a value-less substitution defeats the guard and then misses
    // on every lookup.
    const map = buildSubstitutionMap([{ kind: 'chord_substitution', anchor: { chord: 'Bm' } }])
    expect(Object.keys(map)).toEqual(['Bm'])
    expect(map.Bm).toBeUndefined()
    expect(applySubstitution('Bm', 0, map, 'C')).toBe('Bm')
  })

  it('does not let a "__proto__" anchor create an own key', () => {
    // FINDING: assigning a string to __proto__ is a silent no-op, so a hostile
    // annotation is dropped rather than polluting Object.prototype.
    const map = buildSubstitutionMap([{ kind: 'chord_substitution', anchor: { chord: '__proto__' }, value: 'X' }])
    expect(Object.keys(map)).toEqual([])
    expect(Object.prototype.hasOwnProperty.call(map, '__proto__')).toBe(false)
  })

  it('iterates a string input as characters, silently yielding {}', () => {
    expect(buildSubstitutionMap('ab')).toEqual({})
  })

  it('throws a TypeError on a non-iterable object', () => {
    expect(() => buildSubstitutionMap({})).toThrow(TypeError)
  })

  it('does not mutate the input', () => {
    const ann = [{ kind: 'chord_substitution', anchor: { chord: 'Bm' }, value: 'Dmaj7' }]
    const before = JSON.stringify(ann)
    buildSubstitutionMap(ann)
    expect(JSON.stringify(ann)).toBe(before)
  })
})

// ── applySubstitution ────────────────────────────────────────────────────────

describe('applySubstitution', () => {
  it('substitutes at the base key (0 semitones)', () => {
    expect(applySubstitution('Bm', 0, { Bm: 'Dmaj7' }, 'C')).toBe('Dmaj7')
  })

  it('moves the substitution with the transposed token (the D7 scenario)', () => {
    // A chart chord rendered at +2 is looked up by REVERSE-transposing it back
    // to the concrete-key anchor, then the target is transposed forward.
    expect(applySubstitution('C#m', 2, { Bm: 'Dmaj7' }, 'C')).toBe('Emaj7')
    expect(applySubstitution('Am', -2, { Bm: 'Dmaj7' }, 'C')).toBe('Cmaj7')
  })

  it('leaves an unmatched chord exactly as rendered', () => {
    expect(applySubstitution('C', 0, { Bm: 'Dmaj7' }, 'C')).toBe('C')
    expect(applySubstitution('Am', 0, { Bm: 'Dmaj7' }, 'C')).toBe('Am')
  })

  it('misses when the anchor is spelled in the transposed key rather than the base key', () => {
    // FINDING: the map key must be the CONCRETE-key token. A user-entered
    // substitution that happens to be written in the rendered spelling never
    // applies, and the chord is not transposed either — it is returned verbatim.
    expect(applySubstitution('Am', 2, { Am: 'G/B' }, 'C')).toBe('Am')
    expect(applySubstitution('Am', 2, { Gm: 'G/B' }, 'C')).toBe('A/B')
  })

  it('round-trips a flat key enharmonically (the module demo case)', () => {
    expect(applySubstitution('B', 1, { Bb: 'C' }, 'Bb')).toBe('Db')
  })

  it('misses a flat-spelled anchor when the base key prefers sharps', () => {
    // FINDING: the reverse lookup respells with the base key's preference, so
    // 'Bb' becomes 'A#' in key C and a {Bb: …} anchor can never match there.
    expect(applySubstitution('Bb', 0, { Bb: 'C' }, 'C')).toBe('Bb')
    expect(applySubstitution('Bb', 0, { Bb: 'C' }, 'Bb')).toBe('C')
  })

  it('does not transpose a slash-chord substitution target', () => {
    // FINDING: transposeChord leaves the slash bass alone, so the target's root
    // moves while its bass note stays put.
    expect(applySubstitution('Am', 2, { Gm: 'G/B' }, 'C')).toBe('A/B')
  })

  it('short-circuits on a falsy token, substitutions object or empty map', () => {
    const map = { Bm: 'Dmaj7' }
    expect(applySubstitution('Bm', 0, {}, 'C')).toBe('Bm')
    expect(applySubstitution('Bm', 0, null, 'C')).toBe('Bm')
    expect(applySubstitution('Bm', 0, undefined, 'C')).toBe('Bm')
    expect(applySubstitution('', 0, map, 'C')).toBe('')
    expect(applySubstitution(null, 0, map, 'C')).toBe(null)
    expect(applySubstitution(undefined, 0, map, 'C')).toBe(undefined)
    expect(applySubstitution(0, 0, map, 'C')).toBe(0)
  })

  it('treats a falsy substitution target as a miss', () => {
    expect(applySubstitution('Bm', 0, { Bm: undefined }, 'C')).toBe('Bm')
    expect(applySubstitution('Bm', 0, { Bm: '' }, 'C')).toBe('Bm')
    expect(applySubstitution('Bm', 0, { Bm: null }, 'C')).toBe('Bm')
  })

  it('returns the token when substitutions is a non-object with no own keys', () => {
    expect(applySubstitution('Bm', 0, 5, 'C')).toBe('Bm')
  })

  it('ignores the base key entirely when there is no match', () => {
    // FINDING: baseKey is not validated at all — a nonsense key only changes the
    // respelling of the lookup, never the outcome of a hit.
    expect(applySubstitution('Bm', 0, { Bm: 'Dmaj7' }, 'Canción X')).toBe('Dmaj7')
    expect(applySubstitution('Bm', 0, { Bm: 'Dmaj7' }, '')).toBe('Dmaj7')
    expect(applySubstitution('Bm', 0, { Bm: 'Dmaj7' }, null)).toBe('Dmaj7')
  })

  it('still respells at 0 semitones in a flat key', () => {
    // FINDING: preferFlat is applied even when semitones is 0, so a match can
    // change spelling without changing pitch.
    expect(applySubstitution('B', 0, { B: 'C' }, 'Bb')).toBe('C')
  })

  it('no longer misses on a fractional semitone count — the reverse lookup is clean', () => {
    // The assertion this replaces was named "misses on a fractional semitone
    // count (the reverse lookup yields 'undefined')" and asserted the token
    // comes back UNCHANGED. The unchanged result was a miss, not a pass: the
    // reverse lookup computed 'undefined', found no mapping for it, and gave
    // up quietly. So a substitution the user had set never applied.
    //
    // The reverse transpose now returns the token itself for a non-integer
    // amount, which the map does contain, so the substitution is found. This
    // is a behaviour change and it is the correct one — the amount being
    // fractional does not make the anchor unrecognisable.
    expect(applySubstitution('Bm', 2.5, { Bm: 'Dmaj7' }, 'C')).toBe('Dmaj7')
    // An anchor genuinely absent from the map still passes through untouched.
    expect(applySubstitution('Em', 2, { Bm: 'Dmaj7' }, 'C')).toBe('Em')
  })

  it('never mutates the substitutions map', () => {
    const map = { Bm: 'Dmaj7' }
    applySubstitution('C#m', 2, map, 'C')
    expect(map).toEqual({ Bm: 'Dmaj7' })
  })
})
