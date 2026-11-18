// Redeem route for a setlist share link (0047,
// features/export-and-sharing.feature:55-67).
//
// The page does one thing: exchange the URL token for a collaborator grant and
// send the reader to the setlist. It sits INSIDE RequireAuth — the grant needs
// a user to attach to, so a signed-out visitor is sent to /auth first and the
// token is not carried through that redirect. That gap is recorded in
// odd/tasks/hito6-n3-product-slice.md rather than pretended away.
//
// The server's message is shown verbatim: "This share link is invalid or has
// expired." is one literal for unknown, revoked and expired on purpose, so
// this page must not try to be more specific than the server was.

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { redeemShareLink } from '../../../data/repositories/setlistShares.js'

export default function AcceptSetlistShare() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setError('')
    redeemShareLink(token)
      .then((result) => {
        if (!alive) return
        navigate(`/setlists/${result.setlistId}`, { replace: true })
      })
      .catch((err) => {
        if (!alive) return
        setError(err.message || 'This share link is invalid or has expired.')
      })
    return () => {
      alive = false
    }
  }, [token, navigate])

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-cem-text">Opening shared setlist…</h1>

      {error ? (
        <>
          <p className="mt-3 rounded-md border border-cem-elevated bg-cem-elevated px-3 py-2 text-sm text-cem-text">
            {error}
          </p>
          <Link
            to="/setlists"
            className="mt-4 inline-block text-sm font-medium text-cem-amber hover:underline"
          >
            ← Back to setlists
          </Link>
        </>
      ) : (
        <p className="mt-2 text-sm text-cem-secondary">
          Checking the link and adding you to the setlist.
        </p>
      )}
    </div>
  )
}
