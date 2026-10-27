/**
 * The imported template authored its links as if it lived at the site root
 * ("/", "/apps/notes", "/pages/tables"). CEMURM mounts it under "/dashboard", and
 * react-router treats a leading slash as absolute, so every internal template
 * link escaped the admin subtree. This helper keeps the template's own data
 * untouched and prefixes the internal paths at render time.
 */
export const ADMIN_BASE = '/dashboard'

export function toAdminPath(url?: string): string {
  if (!url) return '#'
  if (url === '#') return url
  if (/^(https?:|mailto:|tel:)/.test(url)) return url
  if (url === ADMIN_BASE || url.startsWith(`${ADMIN_BASE}/`)) return url
  if (url === '/') return ADMIN_BASE
  return url.startsWith('/') ? `${ADMIN_BASE}${url}` : `${ADMIN_BASE}/${url}`
}
