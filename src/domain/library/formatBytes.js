// One spelling of "how big is this file".
//
// Extracted because the storage screen and the export history both report file
// sizes, and two copies of the same rounding rule drift the moment one of them
// grows a unit or a decimal. `PdfChartViewer` keeps its own variant on purpose:
// it returns an empty string for zero, because it renders inside a sentence
// that already has a separator, so that is a different contract, not a copy.

/**
 * @param {number | null | undefined} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  const n = Number(bytes)
  // Negative and non-finite sizes are not small files, they are bad data.
  // Reporting "0 B" is the only honest reading.
  if (!Number.isFinite(n) || n <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`
}
