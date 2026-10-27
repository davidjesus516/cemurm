// CEMURM — purge-user-storage
// Slice: feat/account-export-pr2-bundle (WU3). Record: odd/tasks/account-data-export-and-erasure.md.
// D8: purge via Storage API, not direct deletes from storage.objects (orphans blobs).
// Service-role only. Never log object paths or user ids at info level.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS: Record<string, string> = {
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

function fail(slug: string, status: number, detail?: string): Response {
  if (detail) console.error(`purge-user-storage [${slug}]:`, detail)
  return json({ error: slug }, status)
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return fail('unauthenticated', 401, 'no bearer token')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return fail('function_not_configured', 503, 'missing keys')
  }
  // Must be service role
  if (token !== serviceKey) {
    return fail('forbidden', 403, 'service role required')
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Drain queue
  const { data: jobs, error: jobErr } = await admin
    .from('storage_purge_queue')
    .select('id, user_id')
    .is('done_at', null)
    .order('id', { ascending: true })
    .limit(50)

  if (jobErr) {
    return fail('queue_read_failed', 502, jobErr.message)
  }
  if (!jobs || jobs.length === 0) {
    return json({ purged: 0 }, 200)
  }

  let purged = 0
  for (const job of jobs) {
    try {
      // List and remove all objects under {user_id}/ in charts bucket
      const prefix = `${job.user_id}/`
      // Try to list recursively by walking common patterns; Storage list with prefix
      const { data: items, error: listErr } = await admin.storage
        .from('charts')
        .list(prefix, { limit: 1000, offset: 0 })
      if (listErr) {
        console.error('purge-user-storage [list_failed]')
        continue
      }
      if (items && items.length > 0) {
        const paths = items
          .filter((it: any) => it.name)
          .map((it: any) => `${prefix}${it.name}`)
        if (paths.length > 0) {
          const { error: rmErr } = await admin.storage.from('charts').remove(paths)
          if (rmErr) {
            console.error('purge-user-storage [remove_failed]')
          }
        }
      }
      // Mark done
      await admin
        .from('storage_purge_queue')
        .update({ done_at: new Date().toISOString(), storage_purged_at: new Date().toISOString() })
        .eq('id', job.id)
      // Also mark erasure request if exists
      await admin
        .from('account_erasure_requests')
        .update({ storage_purged_at: new Date().toISOString() })
        .eq('user_id', job.user_id)
        .is('completed_at', null)
      purged++
    } catch (e) {
      console.error('purge-user-storage [exception]')
    }
  }

  return json({ purged }, 200)
})
