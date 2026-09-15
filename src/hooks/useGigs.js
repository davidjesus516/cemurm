import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth.jsx'
import * as gigs from '../lib/gigs.js'

export function useGigs() {
  const { user } = useAuth()
  const [gigsList, setGigsList] = useState([])
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [g, v] = await Promise.all([gigs.listGigs(user.id), gigs.listVenues(user.id)])
      setGigsList(g)
      setVenues(v)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function createGig(payload) {
    const created = await gigs.createGig(user.id, payload)
    setGigsList((prev) => [...prev, created])
    return created
  }

  async function updateGig(id, payload) {
    const updated = await gigs.updateGig(user.id, id, payload)
    setGigsList((prev) => prev.map((g) => (g.id === id ? updated : g)))
    return updated
  }

  async function confirmGig(id) {
    return updateGig(id, { status: 'confirmed' })
  }

  async function cancelGig(id) {
    return updateGig(id, { status: 'cancelled' })
  }

  async function reopenGig(id) {
    return updateGig(id, { status: 'planned' })
  }

  async function deleteGig(id) {
    await gigs.deleteGig(user.id, id)
    setGigsList((prev) => prev.filter((g) => g.id !== id))
  }

  async function getGig(id) {
    return gigs.getGig(user.id, id)
  }

  async function createVenue(payload) {
    const created = await gigs.createVenue(user.id, payload)
    setVenues((prev) =>
      prev.some((v) => v.id === created.id) ? prev : [...prev, created])
    return created
  }

  async function refreshVenues() {
    setVenues(await gigs.listVenues(user.id))
  }

  return {
    gigs: gigsList,
    venues,
    loading,
    refresh,
    getGig,
    createGig,
    updateGig,
    confirmGig,
    cancelGig,
    reopenGig,
    deleteGig,
    createVenue,
    refreshVenues,
  }
}