// Test isolation fixtures for Playwright E2E tests
// Clears cookies, Service Worker caches, and IndexedDB between tests

import { test as base } from '@playwright/test';

/**
 * Extended test with isolation fixture
 * @type {import('@playwright/test').TestType<{isolateTest: import('@playwright/test').Page}>}
 */
export const test = base.extend({
  isolateTest: async ({ page, context }, use) => {
    // Pre-test isolation: clear all storage
    await clearAllStorage(context, page);
    
    // Use the page for the test
    await use(page);
    
    // Post-test isolation: clear all storage again
    await clearAllStorage(context, page);
  },
});

/**
 * Clear all browser storage: cookies, localStorage, sessionStorage, IndexedDB, Service Worker caches
 * @param {import('@playwright/test').BrowserContext} context
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
export async function clearAllStorage(context, page) {
  // Clear cookies
  await context.clearCookies();
  
  // Clear localStorage, sessionStorage, and IndexedDB via page evaluation
  await page.evaluate(async () => {
    // Clear localStorage
    localStorage.clear();
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Clear IndexedDB
    await clearIndexedDB();
    
    // Unregister Service Workers and clear caches
    await clearServiceWorkers();
  });
}

/**
 * Clear all IndexedDB databases
 * @returns {Promise<void>}
 */
async function clearIndexedDB() {
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) {
      resolve();
      return;
    }
    
    // Get all database names
    const request = indexedDB.databases?.();
    
    if (request) {
      request.then((databases) => {
        const deletePromises = databases
          .filter(db => db.name)
          .map(db => deleteDatabase(db.name));
        
        Promise.all(deletePromises).then(() => resolve()).catch(() => resolve());
      }).catch(() => resolve());
    } else {
      // Fallback for older browsers
      resolve();
    }
  });
}

/**
 * Delete a specific IndexedDB database
 * @param {string} name
 * @returns {Promise<void>}
 */
function deleteDatabase(name) {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve(); // Don't fail if already deleted
    request.onblocked = () => resolve();
  });
}

/**
 * Unregister all Service Workers and clear Cache Storage
 * @returns {Promise<void>}
 */
async function clearServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;
  
  try {
    // Unregister all service workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map(reg => reg.unregister())
    );
    
    // Clear all Cache Storage
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(name => caches.delete(name))
      );
    }
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Isolate a single test by clearing storage before and after
 * Can be used as a test wrapper or in beforeEach/afterEach
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').BrowserContext} context
 * @param {Function} testFn
 * @returns {Promise<void>}
 */
export async function isolateTest(page, context, testFn) {
  // Pre-test cleanup
  await clearAllStorage(context, page);
  
  try {
    await testFn(page);
  } finally {
    // Post-test cleanup
    await clearAllStorage(context, page);
  }
}

/**
 * Create an isolated context for a test (new browser context with clean storage)
 * @param {import('@playwright/test').Browser} browser
 * @returns {Promise<import('@playwright/test').BrowserContext>}
 */
export async function createIsolatedContext(browser) {
  const context = await browser.newContext({
    // Disable service workers for complete isolation
    serviceWorkers: 'block',
  });
  
  // Also clear any residual storage
  const page = await context.newPage();
  await clearAllStorage(context, page);
  await page.close();
  
  return context;
}

/**
 * Wait for Service Worker to be ready (if needed for testing)
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 * @returns {Promise<void>}
 */
export async function waitForServiceWorker(page, timeout = 10000) {
  await page.waitForFunction(
    () => 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null,
    { timeout }
  );
}

/**
 * Check if Service Worker is registered
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
export async function isServiceWorkerRegistered(page) {
  return page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const registrations = await navigator.serviceWorker.getRegistrations();
    return registrations.length > 0;
  });
}

/**
 * Get all Cache Storage keys
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
export async function getCacheKeys(page) {
  return page.evaluate(async () => {
    if (!('caches' in window)) return [];
    return caches.keys();
  });
}

/**
 * Clear only Service Worker caches (keep cookies and localStorage)
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
export async function clearServiceWorkerCaches(page) {
  await page.evaluate(async () => {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
  });
}

/**
 * Clear only IndexedDB (keep cookies, localStorage, SW caches)
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
export async function clearIndexedDBOnly(page) {
  await page.evaluate(async () => {
    await clearIndexedDB();
  });
}