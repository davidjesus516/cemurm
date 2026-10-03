/**
 * BasePage - Abstract base class for all page objects
 * Provides common navigation, waiting, and interaction utilities
 */

import { waitForNetworkIdle } from '../utils/test-helpers.js';

/**
 * @abstract
 * Base class for page objects with common functionality
 */
export class BasePage {
  /**
   * @param {import('@playwright/test').Page} page - Playwright page instance
   * @param {string} url - Relative URL path for this page
   */
  constructor(page, url = '') {
    this.page = page;
    this.url = url;
  }

  /**
   * Navigate to the page with optional route parameters
   * @param {Object} [params] - Route parameters to substitute in URL
   * @returns {Promise<void>}
   */
  async goto(params = {}) {
    let targetUrl = this.url;
    
    // Replace route parameters like :id, :setlistId, etc.
    for (const [key, value] of Object.entries(params)) {
      targetUrl = targetUrl.replace(`:${key}`, value);
    }
    
    await this.page.goto(targetUrl);
    await this.waitForLoad();
  }

  /**
   * Wait for page to be fully loaded (network idle + key selector if defined)
   * @returns {Promise<void>}
   */
  async waitForLoad() {
    await waitForNetworkIdle(this.page);
    
    // Subclasses can override keySelector to wait for a specific element
    if (this.keySelector) {
      await this.page.locator(this.keySelector).waitFor({ state: 'visible', timeout: 10000 });
    }
  }

  /**
   * Get locator by data-testid attribute
   * @param {string} id - Test ID
   * @returns {import('@playwright/test').Locator}
   */
  getByTestId(id) {
    return this.page.getByTestId(id);
  }

  /**
   * Get locator by role
   * @param {import('@playwright/test').AriaRole} role - ARIA role
   * @param {Object} [options] - Role options
   * @returns {import('@playwright/test').Locator}
   */
  getByRole(role, options = {}) {
    return this.page.getByRole(role, options);
  }

  /**
   * Get locator by text content
   * @param {string|RegExp} text - Text to match
   * @param {Object} [options] - Text options
   * @returns {import('@playwright/test').Locator}
   */
  getByText(text, options = {}) {
    return this.page.getByText(text, options);
  }

  /**
   * Get locator by label
   * @param {string|RegExp} text - Label text
   * @param {Object} [options] - Label options
   * @returns {import('@playwright/test').Locator}
   */
  getByLabel(text, options = {}) {
    return this.page.getByLabel(text, options);
  }

  /**
   * Get locator by placeholder
   * @param {string|RegExp} text - Placeholder text
   * @param {Object} [options] - Placeholder options
   * @returns {import('@playwright/test').Locator}
   */
  getByPlaceholder(text, options = {}) {
    return this.page.getByPlaceholder(text, options);
  }

  /**
   * Take a screenshot for debugging
   * @param {string} name - Screenshot name
   * @param {Object} [options] - Screenshot options
   * @returns {Promise<void>}
   */
  async screenshot(name, options = {}) {
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}.png`, 
      fullPage: options.fullPage ?? true 
    });
  }

  /**
   * Take a screenshot and save HTML for debugging
   * @param {string} name - Debug snapshot name
   * @returns {Promise<void>}
   */
  async takeDebugSnapshot(name) {
    await this.screenshot(name);
    const html = await this.page.content();
    const fs = await import('node:fs/promises');
    await fs.writeFile(`test-results/debug/${name}.html`, html);
  }

  /**
   * Wait for URL to match a pattern
   * @param {string|RegExp} pattern - URL pattern
   * @param {Object} [options] - Wait options
   * @returns {Promise<void>}
   */
  async waitForUrl(pattern, options = {}) {
    await this.page.waitForURL(pattern, { timeout: options.timeout ?? 10000 });
  }

  /**
   * Reload the page and wait for load
   * @returns {Promise<void>}
   */
  async reload() {
    await this.page.reload();
    await this.waitForLoad();
  }

  /**
   * Go back in history
   * @returns {Promise<void>}
   */
  async goBack() {
    await this.page.goBack();
    await this.waitForLoad();
  }

  /**
   * Get current URL
   * @returns {string}
   */
  getCurrentUrl() {
    return this.page.url();
  }

  /**
   * Key selector to wait for on page load - override in subclasses
   * @type {string|undefined}
   */
  get keySelector() {
    return undefined;
  }
}