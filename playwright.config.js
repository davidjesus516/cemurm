import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the developer's local env for test runs. `dotenv.config` does not
// override variables that are already set, so the CI workflow's `env:`
// block (which carries VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) wins.
dotenv.config({ path: '.env.local' });

function resolvePath(relativePath) {
  return join(__dirname, relativePath);
}

const baseConfig = {
  baseURL: 'http://localhost:5173',
  trace: 'on-first-retry',
  retries: 2,
  timeout: 30_000,
  actionTimeout: 10_000,
  navigationTimeout: 30_000,
};

/** @type {import('@playwright/test').PlaywrightTestConfig} */
export default defineConfig({
  testDir: 'tests/e2e/specs',
  outputDir: 'test-results',
  globalSetup: resolvePath('./tests/e2e/global-setup'),
  globalTeardown: resolvePath('./tests/e2e/global-teardown'),
  reporter: [
    ['html', { open: 'never' }],
    ['github'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    ...baseConfig,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...baseConfig,
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--enable-features=WebHID,WebMIDI'],
        },
      },
      // No `grep` and no `grepInvert` here: a test must match `grep` AND not
      // match `grepInvert`, so setting both to the same regex made chromium
      // select nothing. `@chromium-only` means "chromium only", which is
      // expressed by excluding it from firefox and webkit below and leaving
      // chromium unfiltered so untagged tests still run.
    },
    {
      name: 'firefox',
      use: { ...baseConfig, ...devices['Desktop Firefox'] },
      grepInvert: /@chromium-only/,
    },
    {
      name: 'webkit',
      use: { ...baseConfig, ...devices['Desktop Safari'] },
      grepInvert: /@chromium-only/,
    },
  ],
  // Stage Mode tests get 60s timeout via test.use({ timeout: 60_000 }) in spec files
});