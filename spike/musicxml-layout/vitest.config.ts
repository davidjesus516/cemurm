import { defineConfig } from 'vitest/config'

// Los tests de S3 piden `/corpus/<fichero>.musicxml` como si corrieran en el navegador.
// En Node ese fetch relativo es inválido, así que `tests/setup.ts` lo resuelve contra el
// directorio `corpus/` del disco.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
})
