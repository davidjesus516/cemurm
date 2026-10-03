import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.test for test runtime (written by global-setup)
dotenv.config({ path: '.env.test' });

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
      grep: /@chromium-only/,
      grepInvert: /@chromium-only/,
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