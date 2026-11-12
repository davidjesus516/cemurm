import { describe, expect, it } from 'vitest'

import {
  deleteExportFile,
  listExports,
  loadExportFile,
  recordExport,
  replaceExportFile,
} from './exportHistory.js'

// The repository's contract when there is no IndexedDB (node, a browser in
// private mode, storage denied): the download already happened, so remembering
// it must degrade to "forgotten", never to "the export failed".
//
// The happy path — a row that survives a reload — is only observable in a
// browser and is covered by the page, not here. This file pins the failure
// mode, which is the half a unit test can honestly own.
describe('export history without IndexedDB', () => {
  it('records the export and returns the entry it would have stored', async () => {
    const entry = await recordExport('u1', {
      setlistId: 's1',
      setlistName: 'Friday Gig',
      format: 'chordpro',
      file: { filename: 'Friday-Gig-setlist.chordpro', text: 'abc', mimeType: 'text/plain' },
    })

    expect(entry.setlistName).toBe('Friday Gig')
    expect(entry.format).toBe('chordpro')
    expect(entry.bytes).toBe(3)
    expect(entry.availableOffline).toBe(true)
  })

  it('reports an empty history instead of throwing', async () => {
    await expect(listExports('nobody')).resolves.toEqual([])
  })

  it('reports a missing cached file instead of throwing', async () => {
    await expect(loadExportFile('u1', 'missing')).resolves.toBeNull()
  })

  it('regenerating an entry returns the refreshed record', async () => {
    const entry = await replaceExportFile('u1', 'e1', {
      setlistId: 's1',
      setlistName: 'Friday Gig',
      format: 'chordpro',
      file: { filename: 'Friday-Gig-setlist.chordpro', text: 'abcdef', mimeType: 'text/plain' },
    })

    expect(entry.id).toBe('e1')
    expect(entry.bytes).toBe(6)
  })

  it('deleting a file resolves to the history it could read', async () => {
    await expect(deleteExportFile('u1', 'missing')).resolves.toEqual([])
  })
})
