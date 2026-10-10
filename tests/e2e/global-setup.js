/* global process */

import { execSync } from 'node:child_process';

const IS_CI = process.env.CI === 'true';

async function waitForSupabaseHealthHttp(apiBase, maxRetries = 30, intervalMs = 2000) {
  // Use HTTP health checks instead of `supabase status` Docker health,
  // which is unreliable in CI (services like api/db/auth don't report
  // 'healthy' even when running). Endpoints verified locally:
  // - /auth/v1/health (GoTrue) -> 200
  // - /rest/v1/ (PostgREST) -> 200
  for (let i = 0; i < maxRetries; i++) {
    try {
      const auth = execSync(`curl -sf ${apiBase}/auth/v1/health`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
      const rest = execSync(`curl -sf ${apiBase}/rest/v1/`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
      if (auth && rest) return;
    } catch {
      // ignore, retry
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Supabase HTTP health endpoints (auth, rest) did not become healthy within timeout');
}

export default async function globalSetup() {
  const url = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

  if (IS_CI) {
    // In CI, the setup job already started Supabase and ran db reset.
    // Just verify the stack is reachable via the provided URL.
    console.log('[global-setup] CI mode: verifying shared Supabase stack...');
    await waitForSupabaseHealthHttp(url);
    console.log('[global-setup] Supabase stack verified.');
    return;
  }

  // Local development: start/ensure Supabase stack and reset DB
  console.log('[global-setup] Local mode: starting Supabase stack...');

  const postgresPassword = process.env.POSTGRES_PASSWORD || 'postgres';
  execSync('supabase start', {
    stdio: 'inherit',
    env: { ...process.env, POSTGRES_PASSWORD: postgresPassword },
  });

  console.log('[global-setup] Waiting for Supabase health...');
  await waitForSupabaseHealthHttp(url);

  console.log('[global-setup] Running supabase db reset...');
  execSync('supabase db reset', { stdio: 'inherit' });

  // Make them available to child processes (tests, etc.)
  process.env.VITE_SUPABASE_URL = url;
  process.env.VITE_SUPABASE_ANON_KEY = anonKey;

  console.log('[global-setup] Global setup complete.');
}