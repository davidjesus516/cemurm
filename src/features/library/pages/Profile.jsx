// Public contributor profile (Hito 4 S4.2.3) — read-only view of a
// musician's published contributions, filtered client-side from the live
// catalog view. Private repertoire is never exposed here; collections are
// explicitly out of scope (honest note below). Attribution reaches this page
// from the catalog's contributor links.
// Scenario coverage: features/public-library-community.feature
// (View a contributor's public profile).

/* eslint-disable react/prop-types */

import { Link, useParams } from 'react-router-dom'
import { usePublicLibrary } from '../hooks/usePublicLibrary.js'
import { useFollows } from '../hooks/useFollows.js'

const LICENSE_STYLES = {
  'public-domain': 'bg-cem-amber/10 text-cem-amber',
  'CC-BY-4.0': 'bg-cem-elevated text-cem-secondary-elevated',
  proprietary: 'bg-cem-elevated text-cem-secondary-elevated',
}

function LicenseBadge({ license }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${LICENSE_STYLES[license] || LICENSE_STYLES['CC-BY-4.0']}`}
    >
      {license}
    </span>
  )
}

export default function Profile() {
  const { userId } = useParams()
  const { entries, loading, error } = usePublicLibrary()
  const {
    isFollowing,
    followers,
    following,
    error: followsError,
    pending,
    follow,
    unfollow,
    canFollow,
  } = useFollows(userId)

  const mine = entries.filter((entry) => entry.contributor_id === userId)
  const contributorName = mine[0]?.contributor_name || 'Contributor'

  return (
    <div>
      <Link to="/library" className="text-sm text-cem-secondary hover:text-cem-amber" data-testid="profile-back-link">
        ← Back to library
      </Link>

      <div className="mt-3">
        <h1 className="text-2xl font-bold text-cem-text" data-testid="profile-username">{contributorName}</h1>
        <p className="mt-1 text-sm text-cem-secondary">
          Public profile — published songs this musician contributed to the library.
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="text-sm text-cem-secondary">
          <span className="font-medium text-cem-text" data-testid="profile-followers">{followers}</span>{' '}
          {followers === 1 ? 'follower' : 'followers'} ·{' '}
          <span className="font-medium text-cem-text" data-testid="profile-following">{following}</span> following
        </p>
        {canFollow && (
          <button
            type="button"
            onClick={isFollowing ? unfollow : follow}
            disabled={pending}
            className={
              isFollowing
                ? 'rounded-md bg-cem-elevated px-4 py-2 text-sm font-medium text-cem-text hover:bg-cem-hover disabled:opacity-60'
                : 'rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60'
            }
            data-testid={isFollowing ? 'profile-unfollow' : 'profile-follow'}
          >
            {isFollowing ? 'Unfollow' : 'Follow'}
          </button>
        )}
      </div>

      {followsError && (
        <p className="mt-3 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose" data-testid="error-message">
          {followsError}
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-md bg-cem-rose/10 px-3 py-2 text-sm text-cem-rose" data-testid="error-message">{error}</p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-cem-secondary">Loading profile…</p>
      ) : mine.length === 0 ? (
        <p className="mt-6 text-sm text-cem-secondary">
          This musician hasn&apos;t published any songs yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-cem-elevated rounded-lg border border-cem-elevated bg-cem-surface shadow-sm" data-testid="profile-repertoire">
          {mine.map((entry) => (
            <li key={entry.id} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-cem-text" data-testid="profile-song-title">{entry.title}</span>
                <LicenseBadge license={entry.license} />
              </div>
              <p className="mt-0.5 text-xs text-cem-secondary">
                {[entry.artist, entry.genre].filter(Boolean).join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-cem-secondary">
        Curated collections aren&apos;t available yet — only published songs are shown.
      </p>
    </div>
  )
}