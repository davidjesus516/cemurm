// Test helpers for Playwright E2E tests

/**
 * Wait for an element to be visible and enabled
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @param {Object} [options]
 * @param {number} [options.timeout]
 * @param {'attached'|'detached'|'visible'|'hidden'} [options.state]
 * @returns {Promise<import('@playwright/test').Locator>}
 */
export async function waitForElement(page, selector, options = {}) {
  const locator = page.locator(selector);
  await locator.waitFor({ state: options.state ?? 'visible', timeout: options.timeout ?? 5000 });
  return locator;
}

/**
 * Wait for an element and click it
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @param {Object} [options]
 * @param {number} [options.timeout]
 * @param {boolean} [options.force]
 * @returns {Promise<void>}
 */
export async function clickElement(page, selector, options = {}) {
  const locator = await waitForElement(page, selector, { timeout: options.timeout });
  await locator.click({ force: options.force });
}

/**
 * Fill an input field after waiting for it
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @param {string} value
 * @param {Object} [options]
 * @param {number} [options.timeout]
 * @returns {Promise<void>}
 */
export async function fillInput(page, selector, value, options = {}) {
  const locator = await waitForElement(page, selector, { timeout: options.timeout });
  await locator.fill(value);
}

/**
 * Wait for network to be idle
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 * @returns {Promise<void>}
 */
export async function waitForNetworkIdle(page, timeout = 5000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Take a screenshot with a descriptive name
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 * @param {Object} [options]
 * @param {boolean} [options.fullPage]
 * @returns {Promise<void>}
 */
export async function takeScreenshot(page, name, options = {}) {
  await page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: options.fullPage ?? true });
}

/**
 * Check if an element exists (without waiting)
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @returns {Promise<boolean>}
 */
export async function elementExists(page, selector) {
  const count = await page.locator(selector).count();
  return count > 0;
}

/**
 * Get text content of an element
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @returns {Promise<string|null>}
 */
export async function getTextContent(page, selector) {
  const locator = page.locator(selector);
  return locator.textContent();
}

/**
 * Wait for URL to match a pattern
 * @param {import('@playwright/test').Page} page
 * @param {string|RegExp} pattern
 * @param {Object} [options]
 * @param {number} [options.timeout]
 * @returns {Promise<void>}
 */
export async function waitForUrl(page, pattern, options = {}) {
  await page.waitForURL(pattern, { timeout: options.timeout ?? 5000 });
}

/**
 * Clear all cookies and storage
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
export async function clearAllStorage(page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}