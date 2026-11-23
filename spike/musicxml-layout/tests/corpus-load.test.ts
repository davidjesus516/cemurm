import { describe, it, expect, beforeAll } from 'vitest'
import verovio from 'verovio-wasm'

// Corpus de 5 extractos reales de dominio público (ver corpus/README.md)
const CORPUS = [
  { name: 'schroeter-an-laura', path: '/corpus/schroeter-an-laura.musicxml', complexity: 'simple' },
  { name: 'schubert-der-zwerg', path: '/corpus/schubert-der-zwerg.musicxml', complexity: 'two-parts' },
  { name: 'holmes-thrinodia', path: '/corpus/holmes-thrinodia.musicxml', complexity: '3-staves-pedal' },
  { name: 'stanford-windy-west', path: '/corpus/stanford-windy-west.musicxml', complexity: '4-voices-lyrics' },
  { name: 'mozart-k464-menuetto', path: '/corpus/mozart-k464-menuetto.musicxml', complexity: '4-parts-instrumental' }
]

// API real de Verovio 4.4.0: setOptions/loadData/getPageCount()/renderToSVG(page).
describe('S3 Corpus Load Test', () => {
  let vrv: any

  beforeAll(async () => {
    vrv = await verovio()
    vrv.setOptions({
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
      const xml = await (await fetch(score.path)).text()
      const loaded = vrv.loadData(xml)
      expect(loaded).toBe(1) // Verovio devuelve 1, no `true`

      const svg = vrv.renderToSVG(1)
      expect(svg).toContain('<svg')
      expect(svg.length).toBeGreaterThan(1000)

      results.push({ name: score.name, status: 'ok', svgSize: svg.length })
    }

    console.table(results)
  })

  it('should render first page for each score', async () => {
    for (const score of CORPUS) {
      const xml = await (await fetch(score.path)).text()
      expect(vrv.loadData(xml)).toBe(1)

      const pageCount = vrv.getPageCount()
      expect(pageCount).toBeGreaterThan(0)

      const svg = vrv.renderToSVG(1)
      expect(svg).toContain('<svg')
    }
  })
})
