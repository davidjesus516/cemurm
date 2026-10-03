/**
 * OfflinePage - Page object for the offline fallback page
 * Handles offline message display, queued changes, and sync triggering
 */

import { BasePage } from './BasePage.js';
import { selectors } from '../utils/selectors.js';
import { OfflineIndicator } from './components/OfflineIndicator.js';

/**
 * Page object for the offline page
 * URL pattern: /offline
 */
export class OfflinePage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page, '/offline');
  }

  /**
   * Key selector that indicates the offline page is loaded
   * @type {string}
   */
  get keySelector() {
    return selectors.offline.offlinePage;
  }

  /**
   * OfflineIndicator component (may be present in header)
   * @type {OfflineIndicator}
   */
  get offlineIndicator() {
    if (!this._offlineIndicator) {
      this._offlineIndicator = new OfflineIndicator(this.page);
    }
    return this._offlineIndicator;
  }

  /**
   * Assert the offline message is displayed
   * @returns {Promise<void>}
   */
  async expectOfflineMessage() {
    const offlinePage = this.page.locator(selectors.offline.offlinePage);
    await offlinePage.waitFor({ state: 'visible', timeout: 10000 });
    
    // Look for offline message text
    const messageLocators = [
      this.page.locator('[data-testid="offline-message"]'),
      this.page.locator('[data-testid="offline-title"]'),
      this.page.locator(selectors.offline.offlinePage).locator('h1, h2, .offline-message').first(),
      this.page.locator(selectors.offline.offlinePage).getByText(/offline|sin conexión|desconectado/i).first(),
    ];

    let found = false;
    for (const locator of messageLocators) {
      if (await locator.count() > 0) {
        await expect(locator).toBeVisible({ timeout: 5000 });
        found = true;
        break;
      }
    }

    if (!found) {
      // Fallback: just verify the offline page container is visible
      await expect(offlinePage).toBeVisible({ timeout: 5000 });
    }
  }

  /**
   * Assert the number of queued changes is displayed
   * @param {number} count - Expected number of queued changes
   * @returns {Promise<void>}
   */
  async expectQueuedChanges(count) {
    const queueLocators = [
      this.page.locator(selectors.offline.queueDepth),
      this.page.locator('[data-testid="queued-changes-count"]'),
      this.page.locator('[data-testid="pending-count"]'),
      this.page.locator(selectors.offline.offlinePage).getByText(/queue|pendiente|changes|cambios/i).first(),
    ];

    let found = false;
    for (const locator of queueLocators) {
      if (await locator.count() > 0) {
        const text = await locator.textContent();
        if (text) {
          const match = text.match(/(\d+)/);
          if (match) {
            const actualCount = parseInt(match[1], 10);
            if (actualCount === count) {
              found = true;
              break;
            }
          }
        }
        // If it's an element with data attribute
        const dataCount = await locator.getAttribute('data-count');
        if (dataCount !== null) {
          if (parseInt(dataCount, 10) === count) {
            found = true;
            break;
          }
        }
      }
    }

    if (!found && count === 0) {
      // For zero count, the element might not exist
      const queueDepth = await this.offlineIndicator.getQueueDepth();
      if (queueDepth === 0) {
        return;
      }
    }

    if (!found) {
      throw new Error(`Expected ${count} queued changes, but could not find queue depth indicator`);
    }
  }

  /**
   * Trigger manual sync
   * @returns {Promise<void>}
   */
  async triggerSync() {
    const syncButton = this.page.locator(selectors.offline.syncButton);
    await syncButton.waitFor({ state: 'visible', timeout: 5000 });
    await syncButton.click();
    
    // Wait for sync to start
    await this.page.waitForTimeout(500);
  }

  /**
   * Assert sync has completed successfully
   * @param {number} [timeout=30000] - Maximum wait time in ms
   * @returns {Promise<void>}
   */
  async expectSyncComplete(timeout = 30000) {
    // Wait for the offline indicator to show synced status
    await this.offlineIndicator.waitForSyncComplete(timeout);
    
    // Also verify we're no longer on the offline page (should redirect)
    try {
      await this.page.waitForURL((url) => !url.pathname.startsWith('/offline'), { timeout: timeout / 2 });
    } catch {
      // Might stay on offline page but show success message
      const successLocators = [
        this.page.locator('[data-testid="sync-success"]'),
        this.page.locator(selectors.common.successMessage),
        this.page.locator(selectors.offline.offlinePage).getByText(/sync complete|sincronización completa|back online|volver.*online/i).first(),
      ];
      
      let found = false;
      for (const locator of successLocators) {
        if (await locator.count() > 0) {
          await expect(locator).toBeVisible({ timeout: 5000 });
          found = true;
          break;
        }
      }
      
      if (!found) {
        // At minimum, the offline badge should be gone
        await this.offlineIndicator.expectOnline();
      }
    }
  }

  /**
   * Simulate going online (network reconnection)
   * @returns {Promise<void>}
   */
  async goOnline() {
    // Use Playwright's network emulation to go online
    await this.page.context().setOffline(false);
    
    // Dispatch online event
    await this.page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
      navigator.serviceWorker?.controller?.postMessage?.({ type: 'ONLINE' });
    });
    
    // Wait for the app to react
    await this.page.waitForTimeout(1000);
  }

  /**
   * Simulate going offline
   * @returns {Promise<void>}
   */
  async goOffline() {
    await this.page.context().setOffline(true);
    
    // Dispatch offline event
    await this.page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });
    
    await this.page.waitForTimeout(1000);
  }

  /**
   * Get the cached content displayed on the offline page
   * @returns {Promise<string>}
   */
  async getCachedContent() {
    const cachedContent = this.page.locator(selectors.offline.cachedContent);
    if (await cachedContent.count() > 0) {
      await cachedContent.waitFor({ state: 'visible', timeout: 5000 });
      return (await cachedContent.textContent()) || '';
    }
    return '';
  }

  /**
   * Check if a specific cached item is visible
   * @param {string} text - Text to search for in cached content
   * @returns {Promise<boolean>}
   */
  async hasCachedItem(text) {
    const cachedContent = await this.getCachedContent();
    return cachedContent.includes(text);
  }

  /**
   * Get the offline page title
   * @returns {Promise<string>}
   */
  async getTitle() {
    const titleLocators = [
      this.page.locator('[data-testid="offline-title"]'),
      this.page.locator(selectors.offline.offlinePage).locator('h1').first(),
    ];

    for (const locator of titleLocators) {
      if (await locator.count() > 0) {
        return (await locator.textContent()) || '';
      }
    }
    return '';
  }

  /**
   * Check if retry/refresh button is present
   * @returns {Promise<boolean>}
   */
  async hasRetryButton() {
    const retryBtn = this.page.locator('[data-testid="offline-retry"], [data-testid="refresh-button"], button:has-text("Retry"), button:has-text("Reintentar")');
    return retryBtn.isVisible({ timeout: 3000 }).catch(() => false);
  }

  /**
   * Click retry button to attempt reconnection
   * @returns {Promise<void>}
   */
  async clickRetry() {
    const retryBtn = this.page.locator('[data-testid="offline-retry"], [data-testid="refresh-button"], button:has-text("Retry"), button:has-text("Reintentar")');
    await retryBtn.waitFor({ state: 'visible', timeout: 5000 });
    await retryBtn.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Navigate back to the app (if online)
   * @returns {Promise<void>}
   */
  async navigateToApp() {
    // Look for a link/button to go back to the app
    const appLink = this.page.locator('[data-testid="go-to-app"], [data-testid="nav-home"], a[href="/"], button:has-text("Go to App"), button:has-text("Ir a la app")');
    
    if (await appLink.count() > 0) {
      await appLink.click();
      await this.waitForLoad();
    } else {
      // Direct navigation
      await this.page.goto('/');
      await this.waitForLoad();
    }
  }

  /**
   * Get full offline page state
   * @returns {Promise<{message: string, queuedChanges: number, cachedContent: string, hasRetry: boolean}>}
   */
  async getState() {
    const message = await this.getTitle();
    const queuedChanges = await this.offlineIndicator.getQueueDepth();
    const cachedContent = await this.getCachedContent();
    const hasRetry = await this.hasRetryButton();
    
    return { message, queuedChanges, cachedContent, hasRetry };
  }
}

// Import expect for assertions
import { expect } from '@playwright/test';