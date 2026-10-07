export function createMockScaleCatalog() {
  return [
    { name: 'Major', aliases: ['major', 'maj', 'ionian'] },
    { name: 'Natural Minor', aliases: ['minor', 'min', 'aeolian'] },
    { name: 'Harmonic Minor', aliases: ['harmonic minor'] },
    { name: 'Dorian', aliases: ['dorian'] },
    { name: 'Phrygian', aliases: ['phrygian'] },
    { name: 'Lydian', aliases: ['lydian'] },
    { name: 'Mixolydian', aliases: ['mixolydian'] },
    { name: 'Locrian', aliases: ['locrian'] }
  ]
}

export function mockSupabase() {
  return {
    from: () => ({ select: () => ({ eq: () => ({ data: [], error: null }) }) }),
    rpc: () => ({ data: null, error: null })
  }
}