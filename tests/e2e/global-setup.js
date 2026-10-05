/* global process */

import { execSync } from 'node:child_process';

async function waitForSupabaseHealth(maxRetries = 180, intervalMs = 2000) {
  // Use HTTP health checks instead of `supabase status` Docker health,
  // which is unreliable in CI (services like api/db/auth don't report
  // 'healthy' even when running). Endpoints verified locally:
  // - /auth/v1/health (GoTrue) -> 200
  // - /rest/v1/ (PostgREST) -> 200
  const apiBase = 'http://127.0.0.1:54321';

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
  console.log('[global-setup] Starting Supabase stack...');

  // Start Supabase (manages Docker Compose internally)
  // POSTGRES_PASSWORD can be overridden via env var for CI/security; default is Supabase local dev default
  const postgresPassword = process.env.POSTGRES_PASSWORD || 'postgres';
  execSync('supabase start', {
    stdio: 'inherit',
    env: { ...process.env, POSTGRES_PASSWORD: postgresPassword },
  });

  console.log('[global-setup] Waiting for Supabase health...');
  await waitForSupabaseHealth();

  console.log('[global-setup] Running supabase db reset...');
  execSync('supabase db reset', { stdio: 'inherit' });

  // The fixtures authenticate as ordinary users against the anon key, so a
  // missing key fails later as a confusing 401 from GoTrue. Fail here instead.
  // `playwright.config.js` loads .env.local before this runs, and dotenv does
  // not override variables the CI workflow already set.
  const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter(
    (name) => !process.env[name]
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(' and ')}. ` +
        'Create .env.local at the repository root with both values ' +
        '(see docs/local-dev.md), or let the CI workflow supply them.'
    );
  }

  console.log('[global-setup] Global setup complete.');
}