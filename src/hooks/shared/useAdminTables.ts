// Real rows for the gerencial tables page.
//
// Five table variants showcase the template's primitives; they no longer show
// fake employees. Setlists feed the basic table, songs feed the hover,
// striped, checkbox and TanStack tables. Reads are owner-scoped, matching the
// rest of the member repositories.
import { useEffect, useState } from 'react'
import { useAuth } from '@/app/providers/useAuth.jsx'
import { listSongs } from '@/data/repositories/songs.js'
import { listSetlists } from '@/data/repositories/setlists.js'
import type { PerformerRow } from '@/components/tables/table-data'

export interface AdminTablesData {
  loading: boolean
  songs: PerformerRow[]
  setlists: PerformerRow[]
  dataTableRows: Record<string, unknown>[]
}

interface SongRow {
  id: string
  title?: string
  artist?: string
  key?: string
  bpm?: number | null
  status?: string
}

interface SetlistRow {
  id: string
  name?: string
  visibility?: string
  itemIds?: unknown[]
  createdAt?: string | null
}

interface AuthUser {
  id: string
}

interface AuthContextValue {
  user: AuthUser | null
}

const SONG_STATUS: Record<string, { label: string; className: string }> = {
  ready: { label: 'Ready', className: 'bg-success/10! text-success!' },
  draft: { label: 'Draft', className: 'bg-cem-amber/10! text-cem-amber!' },
  retired: {
    label: 'Retired',
    className: 'bg-cem-hover! text-cem-secondary-elevated!',
  },
}

const SONG_STATUS_COLOR: Record<string, string> = {
  ready: 'chart-3',
  draft: 'chart-1',
  retired: 'neutral',
}

const VISIBILITY: Record<string, { label: string; className: string }> = {
  private: {
    label: 'Private',
    className: 'bg-cem-hover! text-cem-secondary-elevated!',
  },
  shared: { label: 'Shared', className: 'bg-chart-2/10! text-chart-2!' },
  public: { label: 'Public', className: 'bg-success/10! text-success!' },
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function songRow(song: SongRow): PerformerRow {
  const status = SONG_STATUS[song.status ?? ''] ?? {
    label: song.status || 'Unknown',
    className: 'bg-cem-hover! text-cem-secondary-elevated!',
  }
  const tempo = song.bpm ? `${song.bpm} BPM` : 'No BPM'

  return {
    key: song.id,
    title: song.title?.trim() || 'Untitled song',
    subtitle: song.artist?.trim() || 'Unknown artist',
    meta: `${song.key?.trim() || '—'} · ${tempo}`,
    badge: status.label,
    badgeClass: status.className,
    href: `/songs/${song.id}`,
  }
}

function setlistRow(setlist: SetlistRow): PerformerRow {
  const visibility = VISIBILITY[setlist.visibility ?? ''] ?? {
    label: setlist.visibility || 'Unknown',
    className: 'bg-cem-hover! text-cem-secondary-elevated!',
  }
  const count = setlist.itemIds?.length ?? 0

  return {
    key: setlist.id,
    title: setlist.name?.trim() || 'Untitled setlist',
    subtitle: `${count} ${count === 1 ? 'song' : 'songs'}`,
    meta: `Created ${formatDate(setlist.createdAt)}`,
    badge: visibility.label,
    badgeClass: visibility.className,
    href: `/setlists/${setlist.id}`,
  }
}

export function useAdminTables(): AdminTablesData {
  // useAuth.jsx is plain JS; its `createContext(null)` narrows the value to
  // null in TS. The cast restores the provider's actual shape.
  const { user } = useAuth() as unknown as AuthContextValue
  const userId = user?.id ?? null
  const [songs, setSongs] = useState<SongRow[]>([])
  const [setlists, setSetlists] = useState<SetlistRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setSongs([])
      setSetlists([])
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    Promise.all([
      listSongs(userId).catch(() => []),
      listSetlists(userId).catch(() => []),
    ]).then(([songRows, setlistRows]) => {
      if (cancelled) return
      setSongs((songRows as unknown as SongRow[]) ?? [])
      setSetlists((setlistRows as unknown as SetlistRow[]) ?? [])
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [userId])

  return {
    loading,
    songs: songs.map(songRow),
    setlists: setlists.map(setlistRow),
    dataTableRows: songs.map((song) => ({
      name: song.title?.trim() || 'Untitled song',
      artist: song.artist?.trim() || '—',
      key: song.key?.trim() || '—',
      bpm: song.bpm ?? null,
      status: SONG_STATUS[song.status ?? '']?.label ?? song.status ?? 'Unknown',
      statuscolor: SONG_STATUS_COLOR[song.status ?? ''] ?? 'neutral',
      href: `/songs/${song.id}`,
    })),
  }
}
