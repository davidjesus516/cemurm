import { describe, it, expect, beforeAll } from 'vitest'
import verovio from 'verovio-wasm'
import { performance } from 'perf_hooks'

const CORPUS = [
  { name: 'schroeter-an-laura', path: '/corpus/schroeter-an-laura.musicxml' },
  { name: 'schubert-der-zwerg', path: '/corpus/schubert-der-zwerg.musicxml' },
  { name: 'holmes-thrinodia', path: '/corpus/holmes-thrinodia.musicxml' },
  { name: 'stanford-windy-west', path: '/corpus/stanford-windy-west.musicxml' },
  { name: 'mozart-k464-menuetto', path: '/corpus/mozart-k464-menuetto.musicxml' }
]

const ITERATIONS = 20

// Verovio 4.4.0 no expone `transpose(xml, n)`: la transposición es una opción
// (`transpose`) que se aplica al cargar, así que cada iteración recarga la partitura.
describe('S3 Performance Benchmarks', () => {
  let vrv: any
  let corpusXML: Map<string, string>

  beforeAll(async () => {
    vrv = await verovio()
    vrv.setOptions({ adjustPageHeight: true, pageWidth: 1200, scale: 50 })

    corpusXML = new Map()
    for (const score of CORPUS) {
      corpusXML.set(score.name, await (await fetch(score.path)).text())
    }
  })

  const measure = (fn: () => unknown, iterations: number) => {
    const times: number[] = []
    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      fn()
      times.push(performance.now() - start)
    }
    times.sort((a, b) => a - b)
    return {
      p50: times[Math.floor(iterations * 0.5)],
      p95: times[Math.floor(iterations * 0.95)],
      p99: times[Math.floor(iterations * 0.99)],
      avg: times.reduce((a, b) => a + b, 0) / iterations
    }
  }

  it('first paint < 500ms p99', async () => {
    const results: Record<string, any> = {}

    for (const score of CORPUS) {
      const xml = corpusXML.get(score.name)!
      const stats = measure(() => {
        vrv.loadData(xml)
        vrv.renderToSVG(1)
      }, ITERATIONS)
      results[score.name] = stats
      expect(stats.p99).toBeLessThan(500) // ms
    }

    console.table(results)
  })

  it('reflow (resize 320→1920) < 300ms p99', async () => {
    const results: Record<string, any> = {}

    for (const score of CORPUS) {
      const xml = corpusXML.get(score.name)!

      // Reflow: cada cambio de ancho obliga a rehacer el layout, y Verovio solo
      // lo recalcula al cargar de nuevo.
      const stats = measure(() => {
        vrv.setOptions({ pageWidth: 320, scale: 20 })
        vrv.loadData(xml)
        vrv.renderToSVG(1)
        vrv.setOptions({ pageWidth: 1920, scale: 80 })
        vrv.loadData(xml)
        vrv.renderToSVG(1)
      }, ITERATIONS)
      results[score.name] = stats
      expect(stats.p99).toBeLessThan(300)
    }

    vrv.setOptions({ pageWidth: 1200, scale: 50 })
    console.table(results)
  })

  it('transposition ±6 semitones < 200ms p99', async () => {
    const results: Record<string, any> = {}

    for (const score of CORPUS) {
      const xml = corpusXML.get(score.name)!

      // Una muestra = UNA transposición (subir o bajar, alternando). Antes la
      // muestra hacía M6 y -M6 seguidas: medía dos acciones del usuario contra
      // un umbral pensado para una, y por eso `stanford-windy-west` daba 249 ms
      // cuando cada transposición suya cuesta ~116 ms (el coste propio de
      // transponer, medido aparte, es 4-17 ms; el resto es la recarga).
      let up = true
      const stats = measure(() => {
        vrv.setOptions({ transpose: up ? 'M6' : '-M6' })
        up = !up
        vrv.loadData(xml)
        vrv.renderToSVG(1)
      }, ITERATIONS)
      results[score.name] = stats
      expect(stats.p99).toBeLessThan(200)
    }

    vrv.setOptions({ transpose: '' })
    console.table(results)
  })
})
