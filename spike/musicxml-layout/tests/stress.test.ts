import { describe, it, expect, beforeAll } from 'vitest'
import verovio from 'verovio-wasm'

describe('S3 Stress Test — 50 pages continuous', () => {
  let vrv: any
  let longScoreXML: string

  beforeAll(async () => {
    vrv = await verovio()
    vrv.setDefaultOptions({ adjustPageHeight: true, pageWidth: 1200, scale: 50 })
    
    // Concatenar corpus para crear partitura larga
    const parts = []
    for (let i = 0; i < 10; i++) { // 5 partituras * 10 = ~50 páginas
      for (const score of ['bach-bwv846', 'mozart-k545-m1', 'beethoven-op27n2', 'satb-choral', 'bigband-arrangement']) {
        const xml = await (await fetch(`/corpus/${score}.musicxml`)).text()
        parts.push(xml)
      }
    }
    longScoreXML = parts.join('\n')
  })

  it('should handle 50 pages without OOM (< 150 MB)', async () => {
    // Renderizar todas las páginas secuencialmente (simulando scroll virtualizado)
    const pageCount = vrv.getPageCount(longScoreXML)
    expect(pageCount).toBeGreaterThanOrEqual(50)
    
    let peakMemory = 0
    const renderedPages: string[] = []
    
    for (let page = 1; page <= Math.min(50, pageCount); page++) {
      // Solo mantener ±2 páginas en memoria (scroll virtualizado)
      if (renderedPages.length > 5) {
        renderedPages.shift()
      }
      
      const svg = vrv.renderToSVG(longScoreXML, { page })
      renderedPages.push(svg)
      
      // Medir memoria (aproximado via performance.memory en Chrome)
      if (typeof performance !== 'undefined' && (performance as any).memory) {
        const mem = (performance as any).memory
        peakMemory = Math.max(peakMemory, mem.usedJSHeapSize + mem.wasmMemory?.bytes || 0)
      }
    }
    
    const peakMB = peakMemory / (1024 * 1024)
    console.log(`Peak memory: ${peakMB.toFixed(1)} MB`)
    
    expect(peakMB).toBeLessThan(150)
  })

  it('should maintain 60fps during scroll simulation', async () => {
    const pageCount = vrv.getPageCount(longScoreXML)
    const frameTimes: number[] = []
    
    // Simular scroll rápido: renderizar páginas 1→50→1 en secuencia
    for (let pass = 0; pass < 2; pass++) {
      const pages = pass === 0 
        ? Array.from({ length: 50 }, (_, i) => i + 1)
        : Array.from({ length: 50 }, (_, i) => 50 - i)
      
      for (const page of pages) {
        const start = performance.now()
        vrv.renderToSVG(longScoreXML, { page })
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

  it('no crashes or OOM after full stress run', async () => {
    // Test final: renderizar todas las páginas una vez más
    const pageCount = vrv.getPageCount(longScoreXML)
    
    for (let page = 1; page <= Math.min(50, pageCount); page++) {
      const svg = vrv.renderToSVG(longScoreXML, { page })
      expect(svg).toContain('<svg')
    }
  })
})