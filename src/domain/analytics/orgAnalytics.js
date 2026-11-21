// @ts-check
// Pure org-analytics aggregations for S3 (T7). The member/song arrays come from
// getOrgMembers / getMyOrganizations + useSongs, all RLS-scoped. This module
// never claims org-wide coverage it cannot prove: the UI labels the counts as
// the current user's visible scope. Metrics with no backing column (last
// engagement, active-this-month, event attendance) are deliberately absent —
// the page renders an explicit "Not tracked yet" state for them.

/**
 * Members per branch, including configured branches with zero members and an
 * "Unassigned" bucket for members with no branch. Sorted by count desc, then
 * by name so the render order is stable.
 * @template {{ branchId: string | null }} M
 * @param {M[]} members
 * @param {{ id: string, name: string }[]} branches
 * @returns {{ branchId: string | null, name: string, count: number }[]}
 */
export function membersByBranch(members, branches) {
  /** @type {Map<string | null, number>} */
  const counts = new Map()
  for (const member of members || []) {
    const key = member?.branchId ?? null
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  /** @type {{ branchId: string | null, name: string, count: number }[]} */
  const rows = (branches || []).map((branch) => ({
    branchId: branch.id,
    name: branch.name,
    count: counts.get(branch.id) || 0,
  }))
  if (counts.has(null)) {
    rows.push({ branchId: null, name: 'Unassigned', count: /** @type {number} */ (counts.get(null)) })
  }
  return rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/**
 * Tenure facts derivable from `joined_at` alone. "Active/inactive this month"
 * needs an engagement timestamp that does not exist in the schema, so it is
 * NOT returned here — the page says so rather than inventing a number.
 * @template {{ joinedAt: string }} M
 * @param {M[]} members
 * @param {string | Date} [now]
 * @returns {{ total: number, joinedThisMonth: number, averageTenureDays: number }}
 */
export function memberTenure(members, now = new Date()) {
  const list = members || []
  if (list.length === 0) return { total: 0, joinedThisMonth: 0, averageTenureDays: 0 }

  const end = new Date(now).getTime()
  const monthPrefix = new Date(end).toISOString().slice(0, 7)
  let totalDays = 0
  let counted = 0
  let joinedThisMonth = 0

  for (const member of list) {
    const joined = new Date(member?.joinedAt).getTime()
    if (!Number.isFinite(joined)) continue
    totalDays += Math.max(0, Math.floor((end - joined) / (24 * 60 * 60 * 1000)))
    counted += 1
    if (new Date(joined).toISOString().slice(0, 7) === monthPrefix) joinedThisMonth += 1
  }

  return {
    total: list.length,
    joinedThisMonth,
    averageTenureDays: counted ? Math.round(totalDays / counted) : 0,
  }
}

/**
 * Song counts by branch plus the org-specific / system split. A song with an
 * `orgId` is org-specific; a song without one is system-level. Branches with
 * no songs are kept so the chart does not hide a coverage gap.
 * @template {{ branchId: string | null, orgId: string | null }} S
 * @param {S[]} songs
 * @param {{ id: string, name: string }[]} branches
 * @returns {{ byBranch: { branchId: string | null, name: string, count: number }[], orgSpecific: number, systemSongs: number, total: number }}
 */
export function repertoireByBranch(songs, branches) {
  const list = songs || []
  const counts = new Map()
  for (const song of list) {
    const key = song?.branchId ?? null
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  /** @type {{ branchId: string | null, name: string, count: number }[]} */
  const byBranch = (branches || []).map((branch) => ({
    branchId: branch.id,
    name: branch.name,
    count: counts.get(branch.id) || 0,
  }))
  if (counts.has(null)) {
    byBranch.push({ branchId: null, name: 'Unassigned', count: /** @type {number} */ (counts.get(null)) })
  }
  byBranch.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  return {
    byBranch,
    orgSpecific: list.filter((s) => !!s?.orgId).length,
    systemSongs: list.filter((s) => !s?.orgId).length,
    total: list.length,
  }
}
