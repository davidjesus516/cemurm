// Settings > Delete my account permanently (feature:37-45). Erasure is
// requested via security-definer RPCs with a 30-day cancellable grace period.
// The export card remains available throughout the grace period.

import { useEffect, useRef, useState } from 'react'
import {
  cancelAccountErasure,
  getAccountErasureStatus,
  requestAccountErasure,
} from '../../../data/repositories/accountErasure.js'
import { erasureStatus, formatScheduledFor } from '../../../domain/account/erasure.js'

const FALLBACK_ERROR = 'Could not update account deletion request — please try again.'

export default function DeleteAccountCard() {
  const [status, setStatus] = useState('loading') // loading | idle | confirming | requesting | cancelling | scheduled | cancelled
  const [request, setRequest] = useState(null)
  const [error, setError] = useState('')
  const busy = useRef(false)

  useEffect(() => {
    let cancelled = false
    getAccountErasureStatus()
      .then((row) => {
        if (cancelled) return
        if (erasureStatus(row) === 'scheduled') {
          setRequest(row)
          setStatus('scheduled')
        } else {
          setStatus('idle')
        }
      })
      .catch((e) => {
        if (cancelled) return
        setStatus('idle')
        setError(e instanceof Error && e.message ? e.message : FALLBACK_ERROR)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleRequest() {
    if (busy.current) return
    busy.current = true
    setStatus('requesting')
    setError('')
    try {
      const row = await requestAccountErasure()
      setRequest(row)
      setStatus('scheduled')
    } catch (e) {
      setStatus('confirming')
      setError(e instanceof Error && e.message ? e.message : FALLBACK_ERROR)
    } finally {
      busy.current = false
    }
  }

  async function handleCancel() {
    if (busy.current) return
    busy.current = true
    setStatus('cancelling')
    setError('')
    try {
      await cancelAccountErasure()
      setRequest(null)
      setStatus('cancelled')
    } catch (e) {
      setStatus('scheduled')
      setError(e instanceof Error && e.message ? e.message : FALLBACK_ERROR)
    } finally {
      busy.current = false
    }
  }

  if (status === 'loading') {
    return (
      <div>
        <p className="mt-1 text-sm text-cem-secondary">Checking deletion status…</p>
      </div>
    )
  }

  if (status === 'cancelled') {
    return (
      <div>
        <p className="mt-1 text-sm text-cem-secondary">
          Account deletion cancelled. Everything has been retained.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus('idle')
            setError('')
          }}
          className="mt-3 rounded border border-cem-elevated bg-cem-surface px-3 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated"
        >
          Back to settings
        </button>
        {error && (
          <p className="mt-2 text-xs text-cem-amber" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  if (status === 'scheduled' || status === 'cancelling') {
    const scheduledFor = request?.scheduled_for
    return (
      <div>
        <p className="mt-1 text-sm text-cem-text">
          Deletion is scheduled for{' '}
          <span className="font-medium">{formatScheduledFor(scheduledFor)}</span>. During the
          grace period you can still export your data.
        </p>
        <p className="mt-1 text-xs text-cem-secondary">
          Cancelling during the grace period retains everything and no deletion runs.
        </p>
        <button
          type="button"
          onClick={handleCancel}
          disabled={status === 'cancelling'}
          className="mt-3 rounded border border-cem-elevated bg-cem-surface px-3 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
        >
          {status === 'cancelling' ? 'Cancelling…' : 'Cancel deletion'}
        </button>
        {error && (
          <p className="mt-2 text-xs text-cem-amber" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  if (status === 'confirming' || status === 'requesting') {
    return (
      <div>
        <div className="mt-1 rounded-md bg-cem-amber/10 px-3 py-2">
          <p className="text-sm font-medium text-cem-amber">
            Deletion is permanent.
          </p>
          <p className="mt-1 text-xs text-cem-text">
            After confirmation, all your personal data will be scheduled for deletion after 30
            days. You can still take an export during the grace period.
          </p>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleRequest}
            disabled={status === 'requesting'}
            className="rounded bg-cem-amber px-3 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
          >
            {status === 'requesting' ? 'Scheduling…' : 'Confirm permanent deletion'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStatus('idle')
              setError('')
            }}
            disabled={status === 'requesting'}
            className="rounded border border-cem-elevated px-3 py-2 text-sm font-medium text-cem-text hover:bg-cem-elevated disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
        {error && (
          <p className="mt-2 text-xs text-cem-amber" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  // idle — no request is pending on this account
  return (
    <div>
      <p className="mt-1 text-sm text-cem-secondary">
        Permanently delete your account. This action is irreversible after the 30-day grace
        period.
      </p>
      <button
        type="button"
        onClick={() => {
          if (busy.current) return
          setStatus('confirming')
          setError('')
        }}
        disabled={busy.current}
        className="mt-3 rounded border border-cem-elevated px-3 py-2 text-sm font-medium text-cem-amber hover:bg-cem-elevated disabled:opacity-60"
      >
        Delete my account permanently
      </button>
      {error && (
        <p className="mt-2 text-xs text-cem-amber" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
