import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Los tests piden `/corpus/<fichero>.musicxml` (ruta de `publicDir` en el navegador).
// En Node `fetch` exige una URL absoluta, así que se interceptan solo esas rutas y
// se sirven desde `spike/musicxml-layout/corpus/`. Todo lo demás va al fetch real.
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const realFetch = globalThis.fetch.bind(globalThis)

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url
  if (url.startsWith('/corpus/')) {
    try {
      const body = readFileSync(join(root, url.replace(/^\//, '')))
      return Promise.resolve(new Response(body, { status: 200 }))
    } catch {
      return Promise.resolve(new Response('not found', { status: 404 }))
    }
  }
  return realFetch(input as RequestInfo, init)
}) as typeof fetch
