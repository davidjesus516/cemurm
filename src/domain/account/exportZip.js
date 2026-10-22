// ZIP assembly for the account export bundle (decision D7).
//
// The bundle is exactly two entries: the portable JSON document and the
// readable Markdown summary. `zipSync` is synchronous and browser-independent,
// so this whole module is testable in the node Vitest environment.

import { strToU8, zipSync } from 'fflate'

import {
  buildExportDocument,
  buildExportSummary,
  exportFileName,
} from './exportBundle.js'

/**
 * Assemble the downloadable bundle.
 * @param {Record<string, unknown>} [envelope] Envelope from export_account_data().
 * @returns {{ name: string, bytes: Uint8Array }}
 */
export function buildExportZip(envelope = {}) {
  const jsonName = exportFileName(envelope)
  const document = buildExportDocument(envelope)
  const summary = buildExportSummary(envelope)

  return {
    name: jsonName.replace(/\.json$/, '.zip'),
    bytes: zipSync({
      [jsonName]: strToU8(`${JSON.stringify(document, null, 2)}\n`),
      'summary.md': strToU8(summary),
    }),
  }
}
