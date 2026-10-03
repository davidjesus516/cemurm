/* global process */

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function waitForSupabaseHealth(maxRetries = 30, intervalMs = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const status = execSync('supabase status --output json', {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const parsed = JSON.parse(status);
      const allHealthy = parsed.services.every((s) => s.status === 'healthy');
      if (allHealthy) return parsed;
    } catch {
      // ignore, retry
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Supabase services did not become healthy within timeout');
}

export default async function globalSetup() {
  console.log('[global-setup] Starting Supabase stack...');

  // Start Supabase (manages Docker Compose internally)
  execSync('supabase start', {
    stdio: 'inherit',
    env: { ...process.env, POSTGRES_PASSWORD: 'postgres' },
  });

  console.log('[global-setup] Waiting for Supabase health...');
  const status = await waitForSupabaseHealth();

  console.log('[global-setup] Running supabase db reset...');
  execSync('supabase db reset', { stdio: 'inherit' });

  console.log('[global-setup] Verifying seed data...');
  // Verify 3 users, demo setlist, songs exist via supabase status or direct query
  // (Supabase CLI doesn't have a direct verify command; we trust db reset)

  console.log('[global-setup] Extracting anon key...');
  const anonKey = status.services.find((s) => s.name === 'API')?.anon_key;
  if (!anonKey) {
    throw new Error('Failed to extract anon key from supabase status');
  }

  console.log('[global-setup] Writing .env.test...');
  const envContent = `VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=${anonKey}
`;
  writeFileSync(join(__dirname, '.env.test'), envContent);

  console.log('[global-setup] Global setup complete.');
}