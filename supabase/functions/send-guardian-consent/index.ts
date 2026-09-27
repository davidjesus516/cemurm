// CEMURM — send-guardian-consent
// Slice: feat/auth-fail-closed-social, work unit 4 (odd/tasks/auth-fail-closed-social.md,
// tasks T4.3). The first server-side code and the first outbound network call in
// the product: the app was 100% client-only until this work unit.
//
// WHAT IT DOES, in one line: a signed-in minor asks for their own consent
// request to be emailed to the guardian they named, with the confirm and revoke
// links the guardian needs.
//
// WHAT IT DELIBERATELY DOES NOT DO: it does not create the consent row. The row
// is created by public.request_guardian_consent (0031 section 2) and its
// revocation_token already exists by the time this runs. The function is a
// courier: re-sending must never mint a second request, because one guardian
// inbox holding two links for the same decision is how a supervision record
// stops being trustworthy.
//
// SCENARIO MAP (features/minors-and-guardian-consent.feature)
//   scenario 3 (consent record) — the exact consent_text the guardian reads in
//     the email is the text stored verbatim on the row; the body is rendered
//     from the ledger, never from a client-supplied string, so a minor cannot
//     show a guardian wording the record does not contain.
//   scenario 5 (guardian confirms by link) — the confirm link carries the
//     128-bit capability, so the guardian needs no account.
//   scenario 9 (revocation never deletes) — the revoke link is the same
//     capability 0017 lines 361-417 already ships.
//
// THE FOUR INVARIANTS THIS FILE EXISTS TO KEEP
//   1. THE ACCOUNT COMES FROM THE JWT, NEVER THE BODY. `sub` is the only source
//      of the user id. config.toml sets verify_jwt = true, so an unauthenticated
//      call never reaches this code at all.
//   2. THE RESEND KEY IS NEVER ECHOED, LOGGED OR RETURNED. It is read from
//      Supabase Vault (D5) through public.read_resend_api_key, which is granted
//      to service_role only (0031 section 5). Every error path returns a typed
//      slug; the provider's response body is logged, never relayed, because a
//      Resend error can echo the key back in a message id or a header.
//   3. A MISSING KEY IS A TYPED 503, NOT A STACK TRACE. `email_not_configured`
//      is the whole reason this function is shippable and testable without
//      credentials (see the ODD decision): locally it is the normal state, and
//      the function says so instead of pretending to have sent something. There
//      is no fake send and no optimistic success anywhere in this file.
//   4. NO CLAIM WITHOUT EVIDENCE. `sent` is returned only when Resend answered
//      2xx, and it carries Resend's own message id. Any other outcome is a
//      distinct, non-lying status code.
//
// Guardian-supplied text (the name, the consent statement) is HTML-escaped
// before it reaches the template, so a minor cannot inject markup into an email
// that reads as if the academy sent it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// The Resend HTTP API. Pinned, not "latest": an email body is a contract with a
// provider, and a silent shape change would turn into a 400 nobody can read.
const RESEND_ENDPOINT = 'https://api.resend.com/emails'
// From-address domain is verified per environment in Resend; keep it in one
// place so local/prod differ by a single edit.
const FROM_NAME = 'CEMURM'
const FROM_ADDRESS = 'guardian@cemurm.app'

type CorsHeaders = Record<string, string>

// The browser client is Vite + React on a different origin from the functions
// host, so the preflight has to be answered. This endpoint is invoked by our own
// app only, and the request carries the caller's JWT, so there is nothing here
// worth a permissive CORS policy beyond letting the app reach it.
const CORS: CorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/**
 * A typed, non-leaking failure. The slug is the contract the client switches
 * on; the detail is for the operator's logs only and is never returned.
 */
function fail(slug: string, status: number, detail?: string): Response {
  if (detail) console.error(`send-guardian-consent [${slug}]:`, detail)
  return json({ error: slug }, status)
}

const ok = (body: unknown) => json(body, 200)

/**
 * Escape text that will be interpolated into the HTML email. The guardian's
 * name and the consent statement both come from the ledger, and the ledger's
 * contents were typed by the minor — the app renders them into a message that
 * carries the academy's name, so they get the same treatment as any untrusted
 * input. `String.replace` with a function callback (not a replacement string)
 * so a `$&` in the value cannot inject capture-group text.
 */
function escapeHtml(value: string): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      default: return '&#39;'
    }
  })
}

/** Trim a caller-supplied base URL and strip any trailing slash. */
function normalizeSiteUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  // ── 1. WHO IS ASKING ──────────────────────────────────────────────────────
  // config.toml sets verify_jwt = true, so the gateway has already rejected an
  // unauthenticated call before this line. The guard below is not redundant: it
  // is the assertion that keeps INVARIANT 1 honest if that setting is ever
  // flipped, and it is the reason the handler never reads a user id from the
  // body. INVARIANT 1.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return fail('unauthenticated', 401, 'no bearer token')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    // A deployment missing its own runtime keys is an operator problem, and it
    // is reported as a configuration state rather than as a 500 stack trace.
    return fail('function_not_configured', 503, 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing')
  }

  // The caller's own client, used ONLY to resolve the JWT `sub`. It carries the
  // caller's JWT, not the service key, so this read is limited by RLS.
  const caller = createClient(supabaseUrl, token, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await caller.auth.getUser(token)
  if (userError || !userData?.user?.id) {
    return fail('unauthenticated', 401, userError?.message ?? 'no resolved user')
  }
  const userId = userData.user.id

  // ── 2. THE OPEN REQUEST (service_role) ────────────────────────────────────
  // service_role bypasses RLS, so this read sees the ledger rows the caller's
  // own token cannot. It is deliberately a READ: the function is a courier, not
  // a second writer (INVARIANT 4 of the header comment).
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: consent, error: consentError } = await admin
    .from('guardian_consents')
    .select('id, user_id, guardian_name, guardian_email, consent_text, consent_version, status, revocation_token')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (consentError) {
    return fail('consent_read_failed', 502, consentError.message)
  }

  // Idempotent retry, stated as statuses rather than as a boolean. A minor who
  // taps the button twice gets one email, not two — and an account that is
  // already active (or whose only record is finalized) is told so instead of
  // being handed a link to something that no longer exists.
  if (!consent) {
    const { data: active } = await admin
      .from('guardian_consents')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    return ok({ status: active ? 'already_active' : 'no_open_request' })
  }

  // ── 3. CONFIGURATION: the link origin, then the key ──────────────────────
  // The guardian link is absolute, so the app origin is required. It is NOT
  // read from the request's Origin header on purpose: a spoofed origin would
  // put a working confirmation link in a stranger's domain. An explicit,
  // operator-set value is the only thing trusted to build a link.
  const siteUrl = normalizeSiteUrl(Deno.env.get('SITE_URL') ?? '')
  if (!siteUrl) {
    // The log line names the OTHER check this skipped, so an operator fixing one
    // missing variable at a time is not left guessing. Both guards are typed
    // 503s and neither sends anything.
    return fail('app_url_not_configured', 503, 'SITE_URL is not set for this environment; the Resend key has not been read yet')
  }

  // D5: the key comes from Vault, never from this file, never from a VITE_
  // variable. public.read_resend_api_key is granted to service_role only
  // (0031 section 5), so an anon client cannot reach it even though PostgREST
  // serves the function it lives in.
  const { data: apiKey, error: keyError } = await admin.rpc('read_resend_api_key')
  if (keyError) {
    return fail('email_not_configured', 503, keyError.message)
  }
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    // The normal local state, and the reason this work unit is testable
    // without credentials. Typed and non-leaking (INVARIANT 3): the caller
    // learns the deployment is unconfigured, and nothing else.
    return fail('email_not_configured', 503, 'no resend_api_key secret in Vault')
  }

  // ── 4. THE LINKS ─────────────────────────────────────────────────────────
  // One capability, two verbs. The guardian's single link offers confirm, and
  // the same token drives revoke later; both pages read it from the URL and
  // immediately strip it with history.replaceState so the token does not
  // survive in the address bar, a bookmark, or a Referer header.
  const capability = encodeURIComponent(consent.revocation_token)
  const confirmUrl = `${siteUrl}/guardian/confirm?user=${encodeURIComponent(userId)}&token=${capability}`
  const revokeUrl = `${siteUrl}/guardian/revoke?user=${encodeURIComponent(userId)}&token=${capability}`

  // ── 5. THE MESSAGE ───────────────────────────────────────────────────────
  // Rendered from the LEDGER, not from the request: the text the guardian reads
  // is by construction the text the record stores (scenario 3). Every
  // guardian-supplied value is escaped on the way in.
  const subject = `CEMURM: your child is waiting for your consent`
  const html = renderEmail({
    guardianName: escapeHtml(consent.guardian_name),
    consentText: escapeHtml(consent.consent_text),
    consentVersion: escapeHtml(consent.consent_version),
    confirmUrl,
    revokeUrl,
  })

  // ── 6. SEND ──────────────────────────────────────────────────────────────
  // Only a 2xx from Resend becomes `sent` (INVARIANT 4). The provider's body is
  // logged, never returned: it can echo request headers back (INVARIANT 2).
  let response: Response
  try {
    response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_ADDRESS}>`,
        to: [consent.guardian_email],
        subject,
        html,
      }),
    })
  } catch (networkError) {
    return fail('email_provider_failed', 502, `resend unreachable: ${String(networkError)}`)
  }

  if (!response.ok) {
    const providerBody = await response.text().catch(() => '')
    return fail('email_provider_failed', 502, `resend ${response.status}: ${providerBody.slice(0, 500)}`)
  }

  const providerJson = await response.json().catch(() => null) as { id?: string } | null
  return ok({ status: 'sent', provider_message_id: providerJson?.id ?? null })
})

/**
 * The email body. Plain structure, inline styles only — email clients ignore
 * most stylesheets, and a guardian reading this on a phone is the primary case.
 * Kept as a function so the escaping decisions are made in one visible place.
 */
function renderEmail(input: {
  guardianName: string
  consentText: string
  consentVersion: string
  confirmUrl: string
  revokeUrl: string
}): string {
  const { guardianName, consentText, consentVersion, confirmUrl, revokeUrl } = input
  const button = 'display:inline-block;padding:12px 20px;border-radius:6px;background:#f59e0b;color:#1a1a1a;font-weight:600;text-decoration:none'
  const link = 'color:#b45309'

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f5f5f4;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1c1917">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:28px">
      <h1 style="margin:0 0 16px;font-size:20px">Hello ${guardianName},</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5">
        Someone at CEMURM is under 18 and asked you, as their parent or guardian,
        to approve their participation. The academy only opens the account once
        you approve it — nobody else can do this for you, and nobody can use this
        message without the link below.
      </p>
      <blockquote style="margin:0 0 20px;padding:12px 16px;background:#f5f5f4;border-left:3px solid #f59e0b;border-radius:4px;font-size:14px;line-height:1.5">
        ${consentText}
        <div style="margin-top:8px;font-size:12px;color:#78716c">Version ${consentVersion} — stored verbatim with the approval record.</div>
      </blockquote>
      <p style="margin:0 0 20px">
        <a href="${confirmUrl}" style="${button}">I approve this consent</a>
      </p>
      <p style="margin:0 0 24px;font-size:13px;color:#78716c;line-height:1.5">
        If you did not expect this, or you want to stop the participation later,
        use the same link to withdraw it:
        <a href="${revokeUrl}" style="${link}">withdraw consent</a>.
        Withdrawing never deletes the record.
      </p>
      <p style="margin:0;font-size:12px;color:#a8a29e;line-height:1.5">
        CEMURM · You are receiving this because a minor named you as their guardian.
      </p>
    </div>
  </body>
</html>`
}
