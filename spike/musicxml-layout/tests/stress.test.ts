import { describe, it, expect, beforeAll } from 'vitest'
import verovio from 'verovio-wasm'
import { performance } from 'perf_hooks'

// El original concatenaba los cinco MusicXML en un solo documento y pedía 50
// páginas de ese pegado; con la API real de Verovio no existe "cargar N
// documentos a la vez", así que las 50 páginas se alcanzan ciclando el corpus,
// que mantiene el objetivo (50 páginas renderizadas con ventana de 5 en memoria).
const CORPUS = [
  { name: 'schroeter-an-laura', path: '/corpus/schroeter-an-laura.musicxml' },
  { name: 'schubert-der-zwerg', path: '/corpus/schubert-der-zwerg.musicxml' },
  { name: 'holmes-thrinodia', path: '/corpus/holmes-thrinodia.musicxml' },
  { name: 'stanford-windy-west', path: '/corpus/stanford-windy-west.musicxml' },
  { name: 'mozart-k464-menuetto', path: '/corpus/mozart-k464-menuetto.musicxml' }
]

const TARGET_PAGES = 50
const KEEP_IN_MEMORY = 5

describe('S3 Stress Test — 50 pages continuous', () => {
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

  // Devuelve las páginas del corpus en orden, repitiendo el ciclo hasta N.
  function* pageSequence(total: number) {
    let painted = 0
    while (painted < total) {
      for (const score of CORPUS) {
        if (painted >= total) return
        const xml = corpusXML.get(score.name)!
        if (!vrv.loadData(xml)) throw new Error(`loadData falló en ${score.name}`)
        const pageCount = vrv.getPageCount()
        for (let page = 1; page <= pageCount && painted < total; page++) {
          painted++
          yield { score: score.name, page }
        }
      }
    }
  }

  // En el navegador el test medía `performance.memory.usedJSHeapSize`, que es el heap
  // JS; en Node el análogo es `heapUsed`. El RSS del proceso incluye el runtime de
  // Node (123 MB en reposo aquí) y no es comparable con el umbral, pero se registra.
  it('should handle 50 pages without OOM (< 150 MB)', () => {
    let peakMemory = 0
    let peakRss = 0
    const renderedPages: string[] = []
    let painted = 0

    for (const { score, page } of pageSequence(TARGET_PAGES)) {
      // Solo mantener ±5 páginas en memoria (scroll virtualizado)
      if (renderedPages.length > KEEP_IN_MEMORY) {
        renderedPages.shift()
      }

      renderedPages.push(vrv.renderToSVG(page))
      painted++

      const mem = process.memoryUsage()
      peakMemory = Math.max(peakMemory, mem.heapUsed)
      peakRss = Math.max(peakRss, mem.rss)
      if (!score) throw new Error('sin partitura')
    }

    expect(painted).toBe(TARGET_PAGES)
    const peakMB = peakMemory / (1024 * 1024)
    console.log(`Peak heapUsed: ${peakMB.toFixed(1)} MB | peak RSS: ${(peakRss / (1024 * 1024)).toFixed(1)} MB`)

    expect(peakMB).toBeLessThan(150)
  })

  it('should maintain 60fps during scroll simulation', () => {
    const frameTimes: number[] = []

    // Simular scroll rápido: recorrer las 50 páginas en los dos sentidos
    for (let pass = 0; pass < 2; pass++) {
      const sequence = [...pageSequence(TARGET_PAGES)]
      if (pass === 1) sequence.reverse()

      for (const { score, page } of sequence) {
        // El toolkit solo tiene cargada la última partitura del ciclo, así que
        // para pintar una página concreta se recarga su partitura.
        const xml = corpusXML.get(score)!
        vrv.loadData(xml)
        const start = performance.now()
        vrv.renderToSVG(page)
        frameTimes.push(performance.now() - start)
      }
    }

    const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
    const maxFrameTime = Math.max(...frameTimes)

    console.log(`Avg frame time: ${avgFrameTime.toFixed(2)}ms, Max: ${maxFrameTime.toFixed(2)}ms`)

    // 60fps = 16.67ms/frame
    expect(avgFrameTime).toBeLessThan(16.67)
    expect(maxFrameTime).toBeLessThan(33.33) // 30fps mínimo
  })

  it('no crashes or OOM after full stress run', () => {
    let painted = 0

    for (const { score, page } of pageSequence(TARGET_PAGES)) {
      const svg = vrv.renderToSVG(page)
      expect(svg).toContain('<svg')
      painted++
      if (!score) throw new Error('sin partitura')
    }

    expect(painted).toBe(TARGET_PAGES)
  })
})
