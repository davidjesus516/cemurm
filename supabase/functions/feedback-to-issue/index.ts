// supabase/functions/feedback-to-issue/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    body += `- Diagnostics consented: ${feedback.diagnostics ? 'yes' : 'no'}\n\n`
    if (feedback.diagnostics) {
      body += `### Diagnostics\n\`\`\`json\n${JSON.stringify(feedback.diagnostics, null, 2)}\n\`\`\`\n\n`
    }
    body += `---\nPromoted from in-app feedback triage.`

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
      const errText = await issueRes.text()
      return new Response(JSON.stringify({ error: 'GitHub API error', details: errText }), {
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
      return new Response(JSON.stringify({ error: 'Failed to update feedback', details: updateError }), {
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
    const message = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
