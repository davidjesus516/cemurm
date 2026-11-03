// supabase/functions/feedback-to-issue/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// GitHub rejects an issue body over 65,536 characters with a 422, and a data
// URL screenshot is capped at 1.5M characters on the client (FeedbackForm's
// SCREENSHOT_MAX_CHARS). Serializing diagnostics verbatim therefore failed with
// a 502 for exactly the bug reports triage exists to promote. The screenshot
// stays client-side context; everything else is bounded before it ships.
const GITHUB_BODY_MAX = 65_536
const DIAGNOSTICS_MAX_CHARS = 4_000

function serializeDiagnostics(diagnostics: unknown): string | null {
  if (!diagnostics || typeof diagnostics !== 'object') return null
  const { screenshot: _screenshot, ...rest } = diagnostics as Record<string, unknown>
  const serialized = JSON.stringify(rest, null, 2) ?? ''
  return serialized.length > DIAGNOSTICS_MAX_CHARS
    ? `${serialized.slice(0, DIAGNOSTICS_MAX_CHARS)}\n… truncated`
    : serialized
}

function boundedBody(body: string): string {
  return body.length > GITHUB_BODY_MAX
    ? `${body.slice(0, GITHUB_BODY_MAX - 40)}\n\n… truncated by feedback-to-issue`
    : body
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Client to validate user
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Service role client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Check if system_admin. private.is_system_admin is not exposed through
    // PostgREST, so the role is read directly with the service-role client.
    const { data: adminRoles, error: adminError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'system_admin')
      .limit(1)

    if (adminError) {
      return new Response(JSON.stringify({ error: 'Failed to verify system_admin role' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!adminRoles || adminRoles.length === 0) {
      return new Response(JSON.stringify({ error: 'Forbidden: system_admin required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { feedback_id } = await req.json()
    if (!feedback_id) {
      return new Response(JSON.stringify({ error: 'feedback_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch feedback
    const { data: feedback, error: feedbackError } = await supabaseAdmin
      .from('feedback')
      .select('*')
      .eq('id', feedback_id)
      .single()

    if (feedbackError || !feedback) {
      return new Response(JSON.stringify({ error: 'Feedback not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Idempotent
    if (feedback.github_issue_number && feedback.github_issue_url) {
      return new Response(
        JSON.stringify({
          ok: true,
          already_promoted: true,
          github_issue_number: feedback.github_issue_number,
          github_issue_url: feedback.github_issue_url,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const githubToken = Deno.env.get('GITHUB_TOKEN')
    const githubOwner = Deno.env.get('GITHUB_REPO_OWNER') || 'davidjesus516'
    const githubRepo = Deno.env.get('GITHUB_REPO_NAME') || 'cemurm'

    if (!githubToken) {
      return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const kindLabel = feedback.kind === 'bug_report' ? 'Bug report' : 'General feedback'
    const title = `[${kindLabel}] ${feedback.message.slice(0, 80)}${feedback.message.length > 80 ? '...' : ''}`
    const diagnosticsJson = serializeDiagnostics(feedback.diagnostics)

    let body = `### Type\n${kindLabel}\n\n`
    body += `### Message\n${feedback.message}\n\n`
    if (feedback.screen) {
      body += `### Screen\n${feedback.screen}\n\n`
    }
    body += `### Context\n`
    body += `- Feedback ID: ${feedback.id}\n`
    body += `- User ID: ${feedback.user_id}\n`
    body += `- Created: ${feedback.created_at}\n`
    body += `- Origin: CEMURM In-App Feedback\n`
    body += `- Diagnostics consented: ${diagnosticsJson ? 'yes' : 'no'}\n\n`
    if (diagnosticsJson) {
      body += `### Diagnostics\n\`\`\`json\n${diagnosticsJson}\n\`\`\`\n\n`
    }
    body += `---\nPromoted from in-app feedback triage.`
    body = boundedBody(body)

    // Claim the row BEFORE calling GitHub. Without this, two clicks (or a retry
    // after a timeout) both pass the idempotency check above and open two
    // issues. The claim is promoted_at: whoever sets it first owns the promote,
    // and the loser gets the same already-promoted answer.
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from('feedback')
      .update({
        promoted_at: new Date().toISOString(),
        promoted_by: user.id,
        updated_by: user.id,
      })
      .eq('id', feedback_id)
      .is('github_issue_number', null)
      .is('promoted_at', null)
      .select('id')

    if (claimError) {
      console.error('feedback-to-issue: claim failed for feedback', feedback_id, claimError)
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!claimed || claimed.length === 0) {
      return new Response(JSON.stringify({ error: 'Promotion already in progress' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const releaseClaim = async () => {
      const { error: releaseError } = await supabaseAdmin
        .from('feedback')
        .update({ promoted_at: null, promoted_by: null })
        .eq('id', feedback_id)
      if (releaseError) {
        console.error('feedback-to-issue: could not release the claim for feedback', feedback_id, releaseError)
      }
    }

    const issueRes = await fetch(`https://api.github.com/repos/${githubOwner}/${githubRepo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'cemurm-feedback-triage',
      },
      body: JSON.stringify({
        title,
        body,
        labels: [feedback.kind === 'bug_report' ? 'bug' : 'feedback', 'from-app'],
      }),
    })

    if (!issueRes.ok) {
      // The upstream body can echo request content and internal detail; it goes
      // to the server log, never to the browser.
      console.error('feedback-to-issue: GitHub rejected the issue', issueRes.status, await issueRes.text())
      await releaseClaim()
      return new Response(JSON.stringify({ error: 'GitHub API error' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const issue = await issueRes.json()

    // Update feedback
    const { error: updateError } = await supabaseAdmin
      .from('feedback')
      .update({
        github_issue_number: issue.number,
        github_issue_url: issue.html_url,
        github_repo: `${githubOwner}/${githubRepo}`,
        promoted_at: new Date().toISOString(),
        promoted_by: user.id,
        status: 'triaged',
        updated_by: user.id,
      })
      .eq('id', feedback_id)

    if (updateError) {
      console.error('feedback-to-issue: issue created but the link was not stored', issue.number, feedback_id, updateError)
      return new Response(JSON.stringify({ error: 'Issue created but the feedback link could not be saved' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        ok: true,
        github_issue_number: issue.number,
        github_issue_url: issue.html_url,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error('feedback-to-issue failed:', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
