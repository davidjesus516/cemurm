// Setlist share panel (features/export-and-sharing.feature:55-132).
//
// Tier 2 surface: the panel borrows the Collaboration card's vocabulary
// (raised surface, hairline border, no material) instead of introducing a
// dialog. Two kinds of link live here and they are not the same thing:
//
//   * the plain deep link (Copy link, WhatsApp, Telegram, email) opens the
//     setlist for someone RLS already admits — nothing is granted;
//   * a share link (0047) carries a token, a permission and a 7-day expiry,
//     and redeeming it is what adds the recipient as a collaborator.
//
// Only the owner sees the second block: the RPC refuses anyone else, and the
// RLS read returns no rows for them, so rendering the controls would offer an
// action that cannot work.
//
// Still absent, and for the same reason as before: QR codes, embed snippets,
// proximity codes (they need an offline-verifiable one-time token this schema
// does not hold) and the chord-chart PNG (no canvas renderer).

/* eslint-disable react/prop-types */

import { useCallback, useEffect, useState } from 'react'

import {
  createShareLink,
  listShareLinks,
  revokeShareLink,
} from '../../../data/repositories/setlistShares.js'
import { setlistDeepLink, shareTargets } from '../../../domain/setlist/share.js'
import {
  shareLinkDaysLeft,
  shareLinkState,
  shareLinkUrl,
} from '../../../domain/setlist/shareLinks.js'

/**
 * @param {{
 *   setlist: { id: string, name?: string, isOwner?: boolean },
 *   songs: import('../../../domain/setlist/exporters/shared.js').ExportSong[],
 *   isOwner?: boolean,
 *   onNotice?: (message: string) => void,
 *   onError?: (message: string) => void,
 * }} props
 */
export default function ShareSetlistMenu({ setlist, songs, isOwner, onNotice, onError }) {
  const [busy, setBusy] = useState(false)
  const [permission, setPermission] = useState('view')
  const [links, setLinks] = useState([])
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const link = setlistDeepLink(setlist.id, origin)
  const targets = shareTargets(setlist, songs, origin)

  const loadLinks = useCallback(async () => {
    if (!isOwner) return
    try {
      setLinks(await listShareLinks(setlist.id))
    } catch (err) {
      onError?.(err.message)
    }
  }, [isOwner, setlist.id, onError])

  useEffect(() => {
    loadLinks()
  }, [loadLinks])

  async function copyText(text, done) {
    if (!navigator.clipboard?.writeText) {
      throw new Error('Clipboard is not available in this browser.')
    }
    await navigator.clipboard.writeText(text)
    onNotice?.(done)
  }

  async function copyLink() {
    setBusy(true)
    try {
      await copyText(link, 'Link copied to the clipboard')
    } catch (err) {
      onError?.(err.message)
    } finally {
      setBusy(false)
    }
  }

  function openTarget(target) {
    window.open(target.href, '_blank', 'noopener,noreferrer')
  }

  async function createLink() {
    setBusy(true)
    try {
      const created = await createShareLink(setlist.id, permission)
      const url = shareLinkUrl(created.token, origin)
      await loadLinks()
      // The scenario's first assertion is that the link lands on the
      // clipboard; a browser that refuses leaves the URL visible in the list
      // below instead of failing silently.
      try {
        await copyText(url, `Share link copied — expires in 7 days`)
      } catch {
        onNotice?.('Share link created — copy it from the list below.')
      }
    } catch (err) {
      onError?.(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function copyExisting(shareLink) {
    try {
      await copyText(shareLinkUrl(shareLink.token, origin), 'Share link copied')
    } catch (err) {
      onError?.(err.message)
    }
  }

  async function revoke(shareLink) {
    setBusy(true)
    try {
      await revokeShareLink(shareLink.id)
      await loadLinks()
      onNotice?.('Share link revoked — it no longer opens the setlist')
    } catch (err) {
      onError?.(err.message)
    } finally {
      setBusy(false)
    }
  }

  function stateLabel(shareLink) {
    const state = shareLinkState(shareLink)
    if (state === 'revoked') return 'Revoked'
    if (state === 'expired') return 'Expired'
    const days = shareLinkDaysLeft(shareLink)
    return days === 1 ? 'Expires today' : `Expires in ${days} days`
  }

  return (
    <div className="mt-3 rounded-lg border border-cem-elevated bg-cem-surface p-4 shadow-xs">
      <h2 className="text-sm font-semibold text-cem-text">Share setlist</h2>
      <p className="mt-1 text-xs text-cem-secondary">
        Sending the link only helps bandmates who already have access. Anyone else is
        stopped by access control.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copyLink}
          disabled={busy}
          className="rounded-md bg-cem-amber px-3 py-1 text-xs font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
        >
          Copy link
        </button>
        {targets.map((target) => (
          <button
            key={target.value}
            type="button"
            onClick={() => openTarget(target)}
            disabled={busy}
            className="rounded-md border border-cem-elevated px-3 py-1 text-xs font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
          >
            {target.label}
          </button>
        ))}
      </div>

      <p className="mt-3 border-t border-cem-elevated pt-2 font-mono text-xs break-all text-cem-secondary">
        {link}
      </p>

      {isOwner && (
        <div className="mt-3 border-t border-cem-elevated pt-3">
          <h3 className="text-xs font-medium text-cem-secondary">Invite with a link</h3>
          <p className="mt-1 text-xs text-cem-secondary">
            Redeeming the link adds the recipient as a collaborator. Every link expires after 7
            days.
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label htmlFor="share-link-permission" className="text-xs text-cem-secondary">
              Permission
            </label>
            <select
              id="share-link-permission"
              value={permission}
              onChange={(e) => setPermission(e.target.value)}
              disabled={busy}
              className="rounded-md border border-cem-elevated bg-cem-surface px-2 py-1 text-xs text-cem-text focus:border-cem-amber focus:outline-hidden disabled:opacity-60"
            >
              <option value="view">View only</option>
              <option value="edit">Can edit</option>
            </select>
            <button
              type="button"
              onClick={createLink}
              disabled={busy}
              className="rounded-md border border-cem-amber px-3 py-1 text-xs font-medium text-cem-amber hover:bg-cem-amber/10 disabled:opacity-60"
            >
              Create link
            </button>
          </div>

          {links.length === 0 ? (
            <p className="mt-2 text-xs text-cem-secondary">No share links yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-cem-elevated">
              {links.map((shareLink) => (
                <li key={shareLink.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <div>
                    <span className="text-xs font-medium text-cem-text">
                      {shareLink.permission === 'edit' ? 'Can edit' : 'View only'}
                    </span>
                    <span className="ml-2 text-xs text-cem-secondary">{stateLabel(shareLink)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyExisting(shareLink)}
                      disabled={busy || shareLinkState(shareLink) !== 'active'}
                      className="text-xs font-medium text-cem-amber hover:underline disabled:opacity-60"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => revoke(shareLink)}
                      disabled={busy}
                      className="text-xs font-medium text-cem-secondary-elevated hover:underline disabled:opacity-60"
                    >
                      Revoke
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
