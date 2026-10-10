// Single source of truth for the Supabase endpoints the E2E harness talks to.
//
// Values come from VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, which
// `playwright.config.js` loads from `.env.local`. In CI they arrive through the
// workflow's `env:` block, which `dotenv.config` does not override.
//
// Hardcoding `http://127.0.0.1:54321` at each call site would split the harness
// in two: the browser client derives its storage key from the URL configured in
// `src/data/supabase.js`, so any other host would store the injected session
// under one stack's key while the API calls went to another.

/* global process */

const DEFAULT_SUPABASE_URL = 'http://127.0.0.1:54321';

/**
 * Base URL of the Supabase API (kong), without a trailing slash.
 * @returns {string}
 */
export function supabaseApiUrl() {
  return (process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, '');
}

/**
 * Anon key required by GoTrue and PostgREST.
 * @returns {string}
 */
export function supabaseAnonKey() {
  return process.env.VITE_SUPABASE_ANON_KEY || '';
}

/**
 * PostgREST endpoint for a table.
 * @param {string} table
 * @returns {string}
 */
export function restUrl(table) {
  return `${supabaseApiUrl()}/rest/v1/${table}`;
}

/**
 * Storage key that supabase-js derives for the application's client.
 *
 * `src/data/supabase.js` calls `createClient(url, key, ...)` without a
 * `storageKey`, so supabase-js derives one from the API hostname
 * (`sb-${hostname.split('.')[0]}-auth-token`, supabase-js dist/index.cjs:647).
 * For the local stack that is `sb-127-auth-token`.
 *
 * @returns {string}
 */
export function supabaseStorageKey() {
  return `sb-${new URL(supabaseApiUrl()).hostname.split('.')[0]}-auth-token`;
}