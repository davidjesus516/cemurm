// Wait utilities for Playwright E2E tests

/**
 * Wait for a condition to be true, polling at intervals
 * @param {Function} condition - Function returning boolean or Promise<boolean>
 * @param {Object} [options]
 * @param {number} [options.timeout]
 * @param {number} [options.interval]
 * @param {string} [options.message]
 * @returns {Promise<void>}
 */
export async function waitForCondition(condition, options = {}) {
  const { timeout = 5000, interval = 100, message = 'Condition not met' } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(r => setTimeout(r, interval));
  }

  throw new Error(`${message} (timeout: ${timeout}ms)`);
}

/**
 * Wait for an element to have specific text
 * @param {import('@playwright/test').Locator} locator
 * @param {string|RegExp} expectedText
 * @param {Object} [options]
 * @param {number} [options.timeout]
 * @returns {Promise<void>}
 */
export async function waitForText(locator, expectedText, options = {}) {
  const { timeout = 5000 } = options;
  await locator.waitFor({ state: 'visible', timeout });
  await waitForCondition(
    async () => {
      const text = await locator.textContent();
      if (!text) return false;
      return typeof expectedText === 'string' ? text.includes(expectedText) : expectedText.test(text);
    },
    { timeout, message: `Element text did not match: expected ${expectedText}` }
  );
}

/**
 * Wait for an element to have a specific attribute value
 * @param {import('@playwright/test').Locator} locator
 * @param {string} attribute
 * @param {string} expectedValue
 * @param {Object} [options]
 * @param {number} [options.timeout]
 * @returns {Promise<void>}
 */
export async function waitForAttribute(locator, attribute, expectedValue, options = {}) {
  const { timeout = 5000 } = options;
  await locator.waitFor({ state: 'attached', timeout });
  await waitForCondition(
    async () => {
      const value = await locator.getAttribute(attribute);
      return value === expectedValue;
    },
    { timeout, message: `Attribute ${attribute} did not equal ${expectedValue}` }
  );
}

/**
 * Wait for an element to be enabled/disabled
 * @param {import('@playwright/test').Locator} locator
 * @param {boolean} [enabled]
 * @param {Object} [options]
 * @param {number} [options.timeout]
 * @returns {Promise<void>}
 */
export async function waitForEnabled(locator, enabled = true, options = {}) {
  const { timeout = 5000 } = options;
  await waitForCondition(
    async () => (await locator.isEnabled()) === enabled,
    { timeout, message: `Element did not become ${enabled ? 'enabled' : 'disabled'}` }
  );
}

/**
 * Wait for a specific number of elements matching a selector
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @param {number} expectedCount
 * @param {Object} [options]
 * @param {number} [options.timeout]
 * @returns {Promise<void>}
 */
export async function waitForCount(page, selector, expectedCount, options = {}) {
  const { timeout = 5000 } = options;
  await waitForCondition(
    async () => (await page.locator(selector).count()) === expectedCount,
    { timeout, message: `Expected ${expectedCount} elements matching ${selector}` }
  );
}

/**
 * Wait for URL to contain a specific path
 * @param {import('@playwright/test').Page} page
 * @param {string} path
 * @param {Object} [options]
 * @param {number} [options.timeout]
 * @returns {Promise<void>}
 */
export async function waitForPath(page, path, options = {}) {
  const { timeout = 5000 } = options;
  await waitForCondition(
    async () => page.url().includes(path),
    { timeout, message: `URL did not contain path: ${path}` }
  );
}

/**
 * Wait for network requests to complete
 * @param {import('@playwright/test').Page} page
 * @param {string|RegExp} urlPattern
 * @param {number} expectedCount
 * @param {Object} [options]
 * @param {number} [options.timeout]
 * @returns {Promise<void>}
 */
export async function waitForRequests(page, urlPattern, expectedCount, options = {}) {
  const { timeout = 10000 } = options;
  let requestCount = 0;

  page.on('requestfinished', request => {
    const url = request.url();
    const matches = typeof urlPattern === 'string' ? url.includes(urlPattern) : urlPattern.test(url);
    if (matches) requestCount++;
  });

  await waitForCondition(
    () => requestCount >= expectedCount,
    { timeout, message: `Expected ${expectedCount} requests matching ${urlPattern}` }
  );
}

/**
 * Wait for an element to disappear
 * @param {import('@playwright/test').Locator} locator
 * @param {Object} [options]
 * @param {number} [options.timeout]
 * @returns {Promise<void>}
 */
export async function waitForHidden(locator, options = {}) {
  const { timeout = 5000 } = options;
  await locator.waitFor({ state: 'hidden', timeout });
}

/**
 * Wait for page to be fully loaded (including all resources)
 * @param {import('@playwright/test').Page} page
 * @param {Object} [options]
 * @param {number} [options.timeout]
 * @returns {Promise<void>}
 */
export async function waitForPageLoad(page, options = {}) {
  const { timeout = 30000 } = options;
  await page.waitForLoadState('load', { timeout });
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Wait for a toast/notification to appear and disappear
 * @param {import('@playwright/test').Page} page
 * @param {string} message
 * @param {Object} [options]
 * @param {number} [options.timeout]
 * @param {number} [options.duration]
 * @returns {Promise<void>}
 */
export async function waitForToast(page, message, options = {}) {
  const { timeout = 5000, duration = 3000 } = options;
  const toast = page.locator('[data-testid="toast"]').filter({ hasText: message });
  await toast.waitFor({ state: 'visible', timeout });
  await toast.waitFor({ state: 'hidden', timeout: duration + 1000 });
}

/**
 * Retry an action until it succeeds or timeout
 * @template T
 * @param {Function} action - Function returning Promise<T>
 * @param {Object} [options]
 * @param {number} [options.retries]
 * @param {number} [options.delay]
 * @param {Function} [options.onRetry]
 * @returns {Promise<T>}
 */
export async function retry(action, options = {}) {
  const { retries = 3, delay = 500, onRetry } = options;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        onRetry?.(lastError, attempt + 1);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}