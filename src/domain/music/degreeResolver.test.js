import { describe, it, expect, vi, beforeEach } from 'vitest'

// The scale catalog is the only I/O this module does. Stub it so the degree
// maths is testable without a database.
const CATALOG = {
  major: { id: 'major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  'natural minor': { id: 'natural minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  Phrygian: { id: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
  Dorian: { id: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  Lydian: { id: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
  Mixolydian: { id: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
  'harmonic minor': { id: 'harmonic minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
  'whole tone': { id: 'whole tone', intervals: [0, 2, 4, 6, 8, 10] },
}

vi.mock('../../data/repositories/scaleCatalog.js', () => ({
  findScaleByName: async (name) => CATALOG[name] || null,
}))

const { resolveDegree, resolveDegreeInfo, parseKeyContext } = await import('./degreeResolver.js')

// Degrees are written on C so the expected qualities are the textbook ones.
// These were computed from the scale degrees 1/3/5 and checked by hand
// against major and natural minor; the modal rows were checked the same way
// after the hand-check disagreed with the arithmetic twice.
const EXPECTED = {
  major: ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished'],
  'natural minor': ['minor', 'diminished', 'major', 'minor', 'minor', 'major', 'major'],
  Phrygian: ['minor', 'major', 'major', 'minor', 'diminished', 'major', 'minor'],
  Dorian: ['minor', 'minor', 'major', 'major', 'minor', 'diminished', 'major'],
  Lydian: ['major', 'major', 'minor', 'diminished', 'major', 'minor', 'minor'],
  Mixolydian: ['major', 'minor', 'diminished', 'major', 'minor', 'minor', 'major'],
  'harmonic minor': ['minor', 'diminished', 'augmented', 'minor', 'major', 'major', 'diminished'],
}

const DEGREE_NOTES = {
  major: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  'natural minor': ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'],
  Phrygian: ['C', 'Db', 'Eb', 'F', 'G', 'Ab', 'Bb'],
  Dorian: ['C', 'D', 'Eb', 'F', 'G', 'A', 'Bb'],
  Lydian: ['C', 'D', 'E', 'F#', 'G', 'A', 'B'],
  Mixolydian: ['C', 'D', 'E', 'F', 'G', 'A', 'Bb'],
  'harmonic minor': ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'B'],
}

describe('degreeResolver', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('qualityForDegree, through the public API', () => {
    // This is the whole finding. Before the fix qualityForDegree read the next
    // two scale STEPS instead of scale DEGREES 3 and 5, so consecutive steps of
    // a heptatonic scale never spanned a perfect fifth and every one of these
    // 49 pairs came back 'power' — measured 0 correct out of 49.
    for (const [scale, qualities] of Object.entries(EXPECTED)) {
      it(`derives every degree of ${scale} from the scale`, async () => {
        const notes = DEGREE_NOTES[scale]
        for (let i = 0; i < 7; i++) {
          const info = await resolveDegreeInfo(`C ${scale}`, notes[i])
          expect(info, `${scale} degree ${i + 1} (${notes[i]})`).toBeTruthy()
          expect(info.quality, `${scale} degree ${i + 1} (${notes[i]})`).toBe(qualities[i])
        }
      })
    }

    it('never returns power for a heptatonic scale', async () => {
      for (const [scale, notes] of Object.entries(DEGREE_NOTES)) {
        for (const note of notes) {
          const info = await resolveDegreeInfo(`C ${scale}`, note)
          expect(info.quality, `${scale} ${note}`).not.toBe('power')
        }
      }
    })
  })

  describe('music-theory.feature scenarios', () => {
    it('derives the tonic quality from the scale (E Phrygian, Em)', async () => {
      // feature: "the tonic degree renders as a minor chord (i, not I)"
      expect(await resolveDegree('E Phrygian', 'Em')).toBe('i')
    })

    it("lets the musician's explicit chord win over the derived one (E7 in E Phrygian)", async () => {
      // feature: "the tonic chord renders as I7 (explicit chord E7 overrides the
      // scale-derived minor i)" — the suffix was never parsed before, so E7 and a
      // bare E were indistinguishable and this could not pass.
      expect(await resolveDegree('E Phrygian', 'E7')).toBe('I7')
    })

    it('resolves the other two chords of that chart from the scale', async () => {
      // E Phrygian: F is the 2nd degree, major triad -> II. D is the 7th degree,
      // and the Phrygian 7th is a minor triad -> vii. A first draft of this
      // expected VII; the scale says vii.
      expect(await resolveDegree('E Phrygian', 'F')).toBe('II')
      expect(await resolveDegree('E Phrygian', 'D')).toBe('vii')
    })

    it('leaves a stored chord alone — the numeral follows the chart, not the reverse', async () => {
      // "no later recomputation replaces the stored chord": the same root spelled
      // two ways keeps the scale-derived quality when neither spells one out.
      const bare = await resolveDegree('E Phrygian', 'E')
      const seventh = await resolveDegree('E Phrygian', 'E7')
      expect(bare).toBe('i')
      expect(seventh).toBe('I7')
      expect(bare).not.toBe(seventh)
    })
  })

  describe('the explicit chord outranks the scale', () => {
    const cases = [
      ['C major', 'C', 'I'],
      ['C major', 'Cm', 'i'],
      ['C major', 'C7', 'I7'],
      ['C major', 'Cmaj7', 'Imaj7'],
      ['C major', 'Cm7', 'i7'],
      ['C major', 'Cdim', 'i°'],
      ['C major', 'Cdim7', 'i°7'],
      ['C major', 'Caug', 'I+'],
      ['C major', 'Csus4', 'I'],
      ['C major', 'C5', 'I'],
    ]
    for (const [key, chord, expected] of cases) {
      it(`${chord} in ${key} renders ${expected}, not the scale's answer`, async () => {
        expect(await resolveDegree(key, chord)).toBe(expected)
      })
    }
  })

  describe('graceful degradation', () => {
    it('returns null for an unknown scale rather than guessing', async () => {
      expect(await resolveDegree('C whole tone chromatic', 'C')).toBe(null)
      expect(await resolveDegree('C Locrian', 'C')).toBe(null)
    })

    it('returns null for a chord outside the scale', async () => {
      expect(await resolveDegree('C major', 'F#')).toBe(null)
    })

    it('keeps power for a non-heptatonic scale — documented, not a defect', async () => {
      // degreeForDegree returns 'power' for len < 7 by design. That early return
      // is out of scope for this change and is pinned here so it stays put.
      const info = await resolveDegreeInfo('C whole tone', 'C')
      expect(info.quality).toBe('power')
      expect(info.numeral).toBe('I')
    })

    it('parses key contexts unchanged', () => {
      expect(parseKeyContext('C major')).toEqual({ tonic: 'C', scaleName: 'major' })
      expect(parseKeyContext('E Phrygian')).toEqual({ tonic: 'E', scaleName: 'Phrygian' })
      expect(parseKeyContext('Ab')).toEqual({ tonic: 'Ab', scaleName: 'Major' })
      expect(parseKeyContext('')).toBe(null)
    })
  })
})
