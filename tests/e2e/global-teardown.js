import { execSync } from 'node:child_process';

export default async function globalTeardown() {
  console.log('[global-teardown] Stopping Supabase stack...');

  try {
    // --no-backup preserves volumes for faster subsequent runs
    execSync('supabase stop --no-backup', { stdio: 'inherit' });
    console.log('[global-teardown] Supabase stopped successfully.');
  } catch (error) {
    console.error('[global-teardown] Failed to stop Supabase:', error);
    // Don't throw — teardown should not fail the build
  }
}