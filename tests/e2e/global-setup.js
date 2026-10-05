/* global process */

import { execSync } from 'node:child_process';

async function waitForSupabaseHealth(maxRetries = 300, intervalMs = 2000) {
  // Only these services are required for E2E tests to run.
  // studio, edge-runtime, vector, inbucket, storage-api, logflare, analytics
  // often lack Docker health checks and would block indefinitely.
  const required = new Set(['api', 'db', 'auth']);

  for (let i = 0; i < maxRetries; i++) {
    try {
      const status = execSync('supabase status --output json', {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const parsed = JSON.parse(status);
      const requiredHealthy = parsed.services
        .filter((s) => required.has(s.name))
        .every((s) => s.status === 'healthy');
      if (requiredHealthy) return parsed;
    } catch {
      // ignore, retry
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Required Supabase services (api, db, auth) did not become healthy within timeout');
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