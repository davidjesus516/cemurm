// Authentication fixtures for Playwright E2E tests
/* global process */

import { demoUser, isolationUser, outsiderUser } from './users.js';

/**
 * Login via the Supabase Auth API (programmatic login)
 * Returns the session object with access_token and refresh_token
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {import('./users.js').TestUser} user
 * @returns {Promise<{accessToken: string, refreshToken: string, expiresIn: number, user: any}>}
 */
export async function loginViaApi(request, user) {
  const response = await request.post('http://127.0.0.1:54321/auth/v1/token?grant_type=password', {
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.VITE_SUPABASE_ANON_KEY || '',
    },
    data: {
      email: user.email,
      password: user.password,
    },
  });

  if (!response.ok()) {
    const error = await response.json();
    throw new Error(`Login failed for ${user.email}: ${error.msg || error.message || response.statusText}`);
  }

  const session = await response.json();
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
    user: session.user,
  };
}

/**
 * Inject a session into the browser context via localStorage
 * This simulates an authenticated user without going through the login UI
 * @param {import('@playwright/test').Page} page
 * @param {import('./users.js').TestUser} user
 * @param {{accessToken: string, refreshToken: string, expiresIn: number}} [session]
 * @returns {Promise<void>}
 */
export async function injectSession(page, user, session) {
  // If no session provided, login via API first
  if (!session) {
    session = await loginViaApi(page.request, user);
  }

  // Navigate to the app first to set up localStorage context
  await page.goto('/');

  // Inject the session into localStorage (Supabase client stores session here)
  await page.evaluate(
    ([accessToken, refreshToken, expiresIn, userData]) => {
      const sessionData = {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
        token_type: 'bearer',
        user: userData,
      };
      localStorage.setItem('supabase.auth.token', JSON.stringify(sessionData));
    },
    [session.accessToken, session.refreshToken, session.expiresIn, session.user]
  );

  // Reload to apply the session
  await page.reload();
  await page.waitForLoadState('networkidle');
}

/**
 * Login via UI (fills login form and submits)
 * @param {import('@playwright/test').Page} page
 * @param {import('./users.js').TestUser} user
 * @returns {Promise<void>}
 */
export async function loginViaUi(page, user) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.fill('[data-testid="login-email"]', user.email);
  await page.fill('[data-testid="login-password"]', user.password);
  await page.click('[data-testid="login-submit"]');

  // Wait for redirect to home/dashboard
  await page.waitForURL('**/', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

/**
 * Logout via UI
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
export async function logoutViaUi(page) {
  // Open user menu and click logout
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('**/login', { timeout: 5000 });
}

/**
 * Clear all auth state (cookies, localStorage, sessionStorage)
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
export async function clearAuthState(page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Get the current session from localStorage
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<any|null>}
 */
export async function getCurrentSession(page) {
  return page.evaluate(() => {
    const stored = localStorage.getItem('supabase.auth.token');
    return stored ? JSON.parse(stored) : null;
  });
}

/**
 * Check if user is currently authenticated
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated(page) {
  const session = await getCurrentSession(page);
  return !!session?.access_token;
}

/**
 * Predefined login functions for each seeded user
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
export const loginAsDemo = (page) => injectSession(page, demoUser);
export const loginAsIsolation = (page) => injectSession(page, isolationUser);
export const loginAsOutsider = (page) => injectSession(page, outsiderUser);

export const loginAsDemoViaApi = (request) => loginViaApi(request, demoUser);
export const loginAsIsolationViaApi = (request) => loginViaApi(request, isolationUser);
export const loginAsOutsiderViaApi = (request) => loginViaApi(request, outsiderUser);