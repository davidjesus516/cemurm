import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth.jsx'
import * as profiles from '../lib/profiles.js'
import * as bandmates from '../lib/bandmates.js'

/**
 * Bandmate state (useSongs pattern): links split into active / incoming
 * pending / outgoing pending / declined-outgoing lists, plus username search
 * results and the caller's own profile (for the "You cannot add yourself"
 * guard). Mutations call the lib then update local state — optimistic
 * pendingSync rows from the offline queue self-heal on refresh.
 */
export function useBandmates() {
  const { user } = useAuth()
  const [links, setLinks] = useState([])
  const [results, setResults] = useState([])
  const [ownProfile, setOwnProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [data, me] = await Promise.all([
        bandmates.listBandmates(user.id),
        profiles.getProfile(user.id).catch(() => null),
      ])
      setLinks(data)
      setOwnProfile(me)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const { active, incomingPending, outgoingPending, declinedOutgoing } = useMemo(() => {
    const bucket = (status, direction) =>
      links.filter((link) => link.status === status && link.direction === direction)
    return {
      active: bucket('active'),
      incomingPending: bucket('pending', 'incoming'),
      outgoingPending: bucket('pending', 'outgoing'),
      declinedOutgoing: bucket('declined', 'outgoing'),
    }
  }, [links])

  const isBandmate = useCallback(
    (profileId) => active.some((link) => link.userId === profileId),
    [active],
  )

  async function search(query) {
    if (!query.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      setResults(await profiles.searchProfiles(query, { excludeUserId: user.id }))
    } finally {
      setSearching(false)
    }
  }

  async function resolveById(userId) {
    return profiles.resolveById(userId)
  }

  // Replace the conflicting pair row locally (dedupe on direction + userId).
  function replaceLink(next) {
    setLinks((prev) => [
      ...prev.filter((link) => !(link.direction === next.direction && link.userId === next.userId)),
      next,
    ])
  }

  async function invite(profile) {
    const link = await bandmates.inviteBandmate(user.id, profile.id)
    // Optimistic offline rows carry no profile — carry the searched one so
    // the sent-invites list renders immediately.
    replaceLink({ ...link, profile: link.profile ?? { username: profile.username, displayName: profile.displayName } })
    return link
  }

  async function accept(link) {
    replaceLink(await bandmates.acceptInvite(user.id, link.userId))
  }

  async function decline(link) {
    await bandmates.declineInvite(user.id, link.userId)
    setLinks((prev) => prev.filter((l) => !(l.direction === 'incoming' && l.userId === link.userId)))
  }

  async function remove(link) {
    await bandmates.removeBandmate(user.id, link.userId)
    setLinks((prev) => prev.filter((l) => !(l.direction === link.direction && l.userId === link.userId)))
  }

  return {
    bandmates: links,
    active,
    incomingPending,
    outgoingPending,
    declinedOutgoing,
    results,
    ownProfile,
    loading,
    searching,
    refresh,
    search,
    resolveById,
    invite,
    accept,
    decline,
    remove,
    isBandmate,
  }
}