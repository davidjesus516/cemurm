/* eslint-disable react/prop-types */
import { useState } from 'react'
import { useBandmates } from '../hooks/useBandmates.js'

const inputClass =
  'w-full max-w-sm rounded-md border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-none focus:ring-1 focus:ring-cem-amber'
const primaryBtn =
  'rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60'
const ghostBtn =
  'rounded-md border border-cem-elevated px-3 py-1.5 text-xs font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60'
const dangerBtn =
  'rounded-md border border-cem-elevated px-3 py-1.5 text-xs font-medium text-cem-rose hover:bg-cem-elevated'

export default function Bandmates() {
  const {
    active,
    incomingPending,
    outgoingPending,
    declinedOutgoing,
    results,
    ownProfile,
    loading,
    searching,
    search,
    resolveById,
    invite,
    accept,
    decline,
    remove,
    isBandmate,
  } = useBandmates()
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState(false)
  const [byId, setById] = useState('')
  const [byIdProfile, setByIdProfile] = useState(null)
  const [byIdDone, setByIdDone] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const selfMatch =
    Boolean(ownProfile?.username)
    && query.trim().toLowerCase() === ownProfile.username.toLowerCase()

  async function handleSearch(e) {
    e.preventDefault()
    setError('')
    setSearched(true)
    setByIdDone(false)
    await search(query).catch((err) => setError(err.message))
  }

  async function handleById(e) {
    e.preventDefault()
    setError('')
    setByIdDone(true)
    setByIdProfile(null)
    if (!byId.trim()) return
    const profile = await resolveById(byId.trim()).catch((err) => {
      setError(err.message)
      return null
    })
    setByIdProfile(profile)
  }

  async function handleInvite(profile) {
    setError('')
    if (isBandmate(profile.id)) return
    setBusy(true)
    try {
      await invite(profile)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function run(action, link) {
    setError('')
    try {
      await action(link)
    } catch (err) {
      setError(err.message)
    }
  }

  function NameLink({ link }) {
    const profile = link.profile
    return (
      <span className="text-sm text-cem-text">
        {profile?.displayName || 'Bandmate'}
        {profile?.username ? ` @${profile.username}` : ''}
        {link.pendingSync && <span className="ml-2 text-xs text-cem-secondary">pending sync…</span>}
      </span>
    )
  }

  // Shared wrapper for the four link-list sections (pending invites, sent
  // invites, declined, active) — same heading/empty-state/list chrome.
  function ListSection({ title, emptyText, items, render }) {
    return (
      <>
        <h2 className="mt-8 text-lg font-semibold text-cem-text">{title}</h2>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-cem-secondary">{emptyText}</p>
        ) : (
          <ul className="mt-2 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm">
            {items.map(render)}
          </ul>
        )}
      </>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-cem-text">Bandmates</h1>

      {error && (
        <p className="mt-3 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose">{error}</p>
      )}

      <form onSubmit={handleSearch} className="mt-4 flex items-start gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username"
          className={inputClass}
        />
        <button type="submit" disabled={searching || !query.trim()} className={primaryBtn}>
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {searched && query.trim() && !searching && selfMatch && (
        <p className="mt-3 text-sm text-cem-rose">You cannot add yourself.</p>
      )}
      {searched && query.trim() && !searching && !selfMatch && results.length === 0 && (
        <p className="mt-3 text-sm text-cem-secondary">No user found with that username.</p>
      )}
      {results.length > 0 && (
        <ul className="mt-3 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm">
          {results.map((profile) => (
            <li key={profile.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-sm text-cem-text">
                {profile.displayName}{' '}
                <span className="text-xs text-cem-secondary">@{profile.username}</span>
              </span>
              <button
                type="button"
                onClick={() => handleInvite(profile)}
                disabled={busy || isBandmate(profile.id)}
                className={primaryBtn}
              >
                {isBandmate(profile.id) ? 'Already in band' : 'Add to Band'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleById} className="mt-6 flex items-start gap-2">
        <input
          type="text"
          value={byId}
          onChange={(e) => setById(e.target.value)}
          placeholder="Or add by unique user ID"
          className={inputClass}
        />
        <button type="submit" disabled={!byId.trim()} className={ghostBtn}>
          Add by ID
        </button>
      </form>
      {byIdDone && !byIdProfile && (
        <p className="mt-3 text-sm text-cem-secondary">No user found with that username.</p>
      )}
      {byIdProfile && (
        <ul className="mt-3 rounded-lg border border-cem-elevated bg-cem-surface shadow-sm">
          <li className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-sm text-cem-text">
              {byIdProfile.displayName}{' '}
              <span className="text-xs text-cem-secondary">@{byIdProfile.username}</span>
            </span>
            <button
              type="button"
              onClick={() => handleInvite(byIdProfile)}
              disabled={busy || isBandmate(byIdProfile.id)}
              className={primaryBtn}
            >
              {isBandmate(byIdProfile.id) ? 'Already in band' : 'Add to Band'}
            </button>
          </li>
        </ul>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-cem-secondary">Loading bandmates…</p>
      ) : (
        <>
          <ListSection
            title="Pending invites"
            emptyText="No pending invites."
            items={incomingPending}
            render={(link) => (
              <li key={`in-${link.userId}`} className="flex items-center justify-between gap-4 px-4 py-3">
                <NameLink link={link} />
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => run(accept, link)} className={primaryBtn}>
                    Accept
                  </button>
                  <button type="button" onClick={() => run(decline, link)} className={ghostBtn}>
                    Decline
                  </button>
                </div>
              </li>
            )}
          />

          <ListSection
            title="Sent invites"
            emptyText="No sent invites."
            items={outgoingPending}
            render={(link) => (
              <li key={`out-${link.userId}`} className="flex items-center justify-between gap-4 px-4 py-3">
                <NameLink link={link} />
                <button type="button" onClick={() => run(remove, link)} className={dangerBtn}>
                  Cancel
                </button>
              </li>
            )}
          />

          {declinedOutgoing.length > 0 && (
            <ListSection
              title="Declined invites"
              emptyText=""
              items={declinedOutgoing}
              render={(link) => (
                <li key={`dec-${link.userId}`} className="flex items-center justify-between gap-4 px-4 py-3">
                  <NameLink link={link} />
                  <button type="button" onClick={() => run(remove, link)} className={dangerBtn}>
                    Remove
                  </button>
                </li>
              )}
            />
          )}

          <ListSection
            title="Active bandmates"
            emptyText="No active bandmates yet. Search above to invite someone."
            items={active}
            render={(link) => (
              <li key={`act-${link.userId}`} className="flex items-center justify-between gap-4 px-4 py-3">
                <NameLink link={link} />
                <button type="button" onClick={() => run(remove, link)} className={dangerBtn}>
                  Remove
                </button>
              </li>
            )}
          />
        </>
      )}
    </div>
  )
}