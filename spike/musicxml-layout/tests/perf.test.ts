import { describe, it, expect, beforeAll } from 'vitest'
import verovio from 'verovio-wasm'
import { performance } from 'perf_hooks'

const CORPUS = [
  { name: 'bach-bwv846', path: '/corpus/bach-bwv846.musicxml' },
  { name: 'mozart-k545-m1', path: '/corpus/mozart-k545-m1.musicxml' },
  { name: 'beethoven-op27n2', path: '/corpus/beethoven-op27n2.musicxml' },
  { name: 'satb-choral', path: '/corpus/satb-choral.musicxml' },
  { name: 'bigband-arrangement', path: '/corpus/bigband-arrangement.musicxml' }
]

const ITERATIONS = 100

describe('S3 Performance Benchmarks', () => {
  let vrv: any
  let corpusXML: Map<string, string>

  beforeAll(async () => {
    vrv = await verovio()
    vrv.setDefaultOptions({ adjustPageHeight: true, pageWidth: 1200, scale: 50 })
    
    corpusXML = new Map()
    for (const score of CORPUS) {
      corpusXML.set(score.name, await (await fetch(score.path)).text())
    }
  })

  const measure = async (fn: () => any, iterations: number) => {
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
      const stats = await measure(() => vrv.renderToSVG(xml, { page: 1 }), ITERATIONS)
      results[score.name] = stats
      expect(stats.p99).toBeLessThan(500) // ms
    }
    
    console.table(results)
  })

  it('reflow (resize 320→1920) < 300ms p99', async () => {
    const results: Record<string, any> = {}
    
    for (const score of CORPUS) {
      const xml = corpusXML.get(score.name)!
      
      // Simular reflow: cambiar opciones de página y re-renderizar
      const stats = await measure(() => {
        vrv.setOptions({ pageWidth: 320, scale: 20 })
        vrv.renderToSVG(xml, { page: 1 })
        vrv.setOptions({ pageWidth: 1920, scale: 80 })
        vrv.renderToSVG(xml, { page: 1 })
      }, ITERATIONS)
      
      results[score.name] = stats
      expect(stats.p99).toBeLessThan(300)
    }
    
    console.table(results)
  })

  it('transposition ±6 semitones < 200ms p99', async () => {
    const results: Record<string, any> = {}
    
    for (const score of CORPUS) {
      const xml = corpusXML.get(score.name)!
      
      const stats = await measure(() => {
        // Transponer +6 semitonos
        const transposedUp = vrv.transpose(xml, 6)
        vrv.renderToSVG(transposedUp, { page: 1 })
        // Transponer -6 semitonos
        const transposedDown = vrv.transpose(xml, -6)
        vrv.renderToSVG(transposedDown, { page: 1 })
      }, ITERATIONS)
      
      results[score.name] = stats
      expect(stats.p99).toBeLessThan(200)
    }
    
    console.table(results)
  })
})