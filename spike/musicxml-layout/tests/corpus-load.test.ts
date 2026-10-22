import { describe, it, expect, beforeAll } from 'vitest'
import verovio from 'verovio-wasm'

// Corpus de 5 partituras (MusicXML paths)
const CORPUS = [
  { name: 'bach-bwv846', path: '/corpus/bach-bwv846.musicxml', complexity: 'simple' },
  { name: 'mozart-k545-m1', path: '/corpus/mozart-k545-m1.musicxml', complexity: '2-voices' },
  { name: 'beethoven-op27n2', path: '/corpus/beethoven-op27n2.musicxml', complexity: '3-staves-pedal' },
  { name: 'satb-choral', path: '/corpus/satb-choral.musicxml', complexity: '4-voices-lyrics' },
  { name: 'bigband-arrangement', path: '/corpus/bigband-arrangement.musicxml', complexity: 'transposition' }
]

describe('S3 Corpus Load Test', () => {
  let vrv: any

  beforeAll(async () => {
    vrv = await verovio()
    // Configurar opciones por defecto
    vrv.setDefaultOptions({
      adjustPageHeight: true,
      pageWidth: 1200,
      pageHeight: 1600,
      scale: 50,
      font: 'Bravura'
    })
  })

  it('should load all 5 corpus scores without crashes', async () => {
    const results = []
    
    for (const score of CORPUS) {
      try {
        const xml = await (await fetch(score.path)).text()
        const svg = vrv.renderToSVG(xml, {})
        expect(svg).toContain('<svg')
        expect(svg.length).toBeGreaterThan(1000)
        results.push({ name: score.name, status: 'ok', svgSize: svg.length })
      } catch (e) {
        results.push({ name: score.name, status: 'error', error: String(e) })
        throw new Error(`Failed to load ${score.name}: ${e}`)
      }
    }
    
    console.table(results)
  })

  it('should render first page for each score', async () => {
    for (const score of CORPUS) {
      const xml = await (await fetch(score.path)).text()
      const pageCount = vrv.getPageCount(xml)
      expect(pageCount).toBeGreaterThan(0)
      
      const svg = vrv.renderToSVG(xml, { page: 1 })
      expect(svg).toContain('<svg')
    }
  })
})