// Reading a guardian capability out of the URL, and getting rid of it again.
//
// /guardian/confirm and /guardian/revoke are the only two routes in the app that
// carry a SECRET in the query string: the 128-bit revocation_token that 0017
// made the login-less capability (0031's confirm reuses it). Everything in this
// module exists so that secret lives for as short a time as possible.
//
// THE ORDER MATTERS and is the reason this is a module and not three lines in
// each page:
//   1. read the parameters out of window.location.search, synchronously, ONCE;
//   2. immediately replaceState the URL to the bare path, which drops the token
//      from the address bar, from the back/forward history entries the user can
//      reach, and from anything a later copy-paste would carry;
//   3. only then do any async work.
//
// Reading `window.location.search` inside a useEffect instead would leave the
// token sitting in the address bar for the whole of the first render, and React
// 18 StrictMode double-invokes effects in development, so a "read once on
// mount" effect is not reliably once. Module scope plus a replaceState in the
// same synchronous block is deterministic.
//
// WHAT THIS MODULE DOES NOT DO, deliberately:
//   · it does not auto-confirm. The confirm page requires a real click, because
//     the capability is ONE-SHOT: anything that fetches the URL on the
//     guardian's behalf — a link scanner in a mail client, a chat preview, a
//     `rel=prefetch` — would otherwise spend it and leave the guardian looking
//     at a dead link with no explanation.
//   · it does not log, store or re-emit the token. It is read into local state
//     and handed straight to the RPC call.
//   · it does not validate the token's shape beyond presence. Guessing is the
//     server's job, and it answers every guess identically.

/** Strip a query string from history without reloading or navigating. */
function scrubQueryString() {
  if (typeof window === 'undefined') return
  if (!window.history?.replaceState) return
  const { pathname } = window.location
  window.history.replaceState(window.history.state, '', pathname)
}

/**
 * Read a guardian link's parameters and scrub the URL in the same synchronous
 * block. Call this at MODULE scope in the page module, once — not in an effect
 * and not in a component body (both re-run and both leave a window in which the
 * token is still in the address bar).
 *
 * `email` is the WITNESS that 0017's revoke requires alongside the token: the
 * token is the secret, the email proves which guardian the link was addressed
 * to. It is absent from the confirm link, which needs no witness.
 *
 * Returns { userId, token, guardianEmail } with nulls where a parameter is
 * missing. A missing piece is a broken link, not a failed attempt: the page
 * renders an explanation and offers nothing to retry, because retrying a
 * half-link cannot succeed.
 */
export function readGuardianLink() {
  const params = new URLSearchParams(
    typeof window === 'undefined' ? '' : window.location.search,
  )
  const link = {
    userId: params.get('user') || null,
    token: params.get('token') || null,
    guardianEmail: params.get('email') || null,
  }
  // Unconditional and immediate — including when the link turned out to be
  // incomplete, because a token that arrived at all is still a token.
  scrubQueryString()
  return link
}

/** True when the link carries everything the page needs to act. */
export function isCompleteLink(link, { needsEmail = false } = {}) {
  if (!link?.userId || !link?.token) return false
  if (needsEmail && !link?.guardianEmail) return false
  return true
}
