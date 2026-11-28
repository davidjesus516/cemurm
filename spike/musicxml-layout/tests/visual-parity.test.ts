import { describe, it, expect, beforeAll } from 'vitest'
import verovio from 'verovio-wasm'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// S3.4 — Paridad visual real: el SVG de nuestro build WASM se rasteriza y se
// compara píxel a píxel contra el SVG del Verovio nativo de la misma versión
// (4.4.0) con las mismas opciones. No hay valores simulados: si un píxel no
// coincide, cuenta.
//
// Por qué el diff usa el SVG nativo y no el PDF: ambos lados se rasterizan con
// el MISMO motor (rsvg-convert), así que la única variable es Verovio. Pasar la
// referencia por PDF añade un segundo rasterizador (poppler) y el diff se llena
// de contornos de 1 px que no son diferencias de grabado — medido: 3,38 % en
// schroeter frente a 0 % con el mismo rasterizador. Los PDF de `ref-pdfs/`
// siguen ahí como referencia legible para una persona.
//
// Dependencias de sistema: `rsvg-convert` (SVG→PNG). Si falta, la prueba falla
// con un mensaje explícito; no se salta en silencio.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CORPUS = [
  { name: 'schroeter-an-laura', staves: 2 },
  { name: 'schubert-der-zwerg', staves: 2 },
  { name: 'holmes-thrinodia', staves: 3 },
  { name: 'stanford-windy-west', staves: 8 },
  { name: 'mozart-k464-menuetto', staves: 4 }
]

const THRESHOLD = 0.02 // 2 % de píxeles distintos, el criterio del spike
const DIFF_DIR = '/tmp/visual-diffs'
const RASTER_WIDTH = 600

const run = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

const svgSize = (svg: string) => {
  const w = /width="([\d.]+)px"/.exec(svg)
  const h = /height="([\d.]+)px"/.exec(svg)
  if (!w || !h) throw new Error('el SVG no declara tamaño en px')
  return { width: Math.round(Number(w[1])), height: Math.round(Number(h[1])) }
}

/** Recorta al área común: un desajuste de tamaño no debe romper el diff. */
const crop = (png: PNG, width: number, height: number): PNG => {
  if (png.width === width && png.height === height) return png
  const out = new PNG({ width, height })
  PNG.bitblt(png, out, 0, 0, width, height, 0, 0)
  return out
}

describe('S3 Visual Parity vs native Verovio', () => {
  let vrv: any
  const xml = new Map<string, string>()

  beforeAll(async () => {
    try {
      run('sh', ['-c', 'command -v rsvg-convert'])
    } catch {
      throw new Error('falta rsvg-convert: esta prueba necesita librsvg2-bin')
    }

    for (const score of CORPUS) {
      for (const ext of ['svg', 'pdf']) {
        const ref = join(ROOT, 'ref-pdfs', `${score.name}.${ext}`)
        if (!existsSync(ref)) {
          throw new Error(`falta ${ref}: regenéralo con ./make_ref_pdfs.sh`)
        }
      }
    }

    vrv = await verovio()
    vrv.setOptions({ adjustPageHeight: true, pageWidth: 1200, scale: 50 })
    for (const score of CORPUS) {
      xml.set(
        score.name,
        readFileSync(join(ROOT, 'corpus', `${score.name}.musicxml`), 'utf8')
      )
    }
    mkdirSync(DIFF_DIR, { recursive: true })
  })

  it('each score renders with ≤ 2% pixel diff vs the native build', () => {
    const results: Record<string, unknown> = {}

    for (const score of CORPUS) {
      vrv.loadData(xml.get(score.name)!)
      const svg = vrv.renderToSVG(1)
      const { width, height } = svgSize(svg)

      // Render propio: SVG → PNG a su tamaño intrínseco.
      const svgPath = join(DIFF_DIR, `${score.name}.svg`)
      const oursPath = join(DIFF_DIR, `${score.name}-ours.png`)
      writeFileSync(svgPath, svg)
      run('rsvg-convert', ['-w', String(width), '-h', String(height), '-o', oursPath, svgPath])

      // Referencia: página 1 del Verovio nativo, rasterizada al mismo tamaño y
      // con el mismo motor que la nuestra.
      const refSvgPath = join(ROOT, 'ref-pdfs', `${score.name}.svg`)
      const refPath = join(DIFF_DIR, `${score.name}-ref.png`)
      run('rsvg-convert', ['-w', String(width), '-h', String(height), '-o', refPath, refSvgPath])

      const ours = PNG.sync.read(readFileSync(oursPath))
      const ref = PNG.sync.read(readFileSync(refPath))
      const w = Math.min(ours.width, ref.width)
      const h = Math.min(ours.height, ref.height)
      const a = crop(ours, w, h)
      const b = crop(ref, w, h)

      const diffBuffer = new PNG({ width: w, height: h })
      const diffPixels = pixelmatch(a.data, b.data, diffBuffer.data, w, h, { threshold: 0.1 })
      writeFileSync(join(DIFF_DIR, `${score.name}-diff.png`), PNG.sync.write(diffBuffer))

      const diffPercent = diffPixels / (w * h)
      results[score.name] = {
        'px': `${w}x${h}`,
        'diff px': diffPixels,
        'diff %': +(diffPercent * 100).toFixed(3),
        pass: diffPercent <= THRESHOLD
      }
      expect(diffPercent, `${score.name}: ${(diffPercent * 100).toFixed(3)} % de píxeles distintos`).toBeLessThanOrEqual(THRESHOLD)
    }

    console.table(results)
  })

  it('each page keeps the musical features the corpus declares', () => {
    // Las comprobaciones son sobre clases que Verovio sí emite en el SVG
    // (`syl`, `pedal`, `beam`, `staff`), no sobre texto inventado: antes se
    // buscaba la cadena "lyric", que Verovio nunca escribe.
    const expected: Record<string, { cls: string; min: number }[]> = {
      'schroeter-an-laura': [{ cls: 'staff', min: 2 }],
      'schubert-der-zwerg': [{ cls: 'staff', min: 2 }, { cls: 'beam', min: 1 }],
      'holmes-thrinodia': [{ cls: 'staff', min: 3 }, { cls: 'pedal', min: 1 }],
      'stanford-windy-west': [{ cls: 'staff', min: 8 }, { cls: 'syl', min: 1 }, { cls: 'verse', min: 1 }],
      'mozart-k464-menuetto': [{ cls: 'staff', min: 4 }]
    }

    const counts: Record<string, string> = {}
    for (const score of CORPUS) {
      vrv.loadData(xml.get(score.name)!)
      const svg = vrv.renderToSVG(1)
      const row: string[] = []
      for (const { cls, min } of expected[score.name]) {
        const count = (svg.match(new RegExp(`class="${cls}[ "]`, 'g')) ?? []).length
        row.push(`${cls}=${count}`)
        expect(count, `${score.name}: esperaba ≥${min} ${cls} en la página 1`).toBeGreaterThanOrEqual(min)
      }
      // El número de pentagramas declarado por la obra tiene que verse en el SVG.
      expect(row.length).toBeGreaterThan(0)
      counts[score.name] = row.join(' ')
    }
    console.table(counts)
  })
})
