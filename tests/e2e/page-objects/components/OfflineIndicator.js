/**
 * OfflineIndicator - Component page object for the online/offline status indicator
 * Displays connection state, sync status, and queue depth
 */

import { selectors } from '../../utils/selectors.js';

/**
 * Component page object for OfflineIndicator
 * Encapsulates interactions with the connection status indicator
 */
export class OfflineIndicator {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {Object} [options]
   * @param {string} [options.selector] - Custom selector for the indicator root
   */
  constructor(page, options = {}) {
    this.page = page;
    this.selector = options.selector || selectors.offline.indicator;
  }

  /**
   * Get the root locator for the offline indicator
   * @returns {import('@playwright/test').Locator}
   */
  get root() {
    return this.page.locator(this.selector);
  }

  /**
   * Check if the indicator is visible
   * @returns {Promise<boolean>}
   */
  async isVisible() {
    return this.root.isVisible({ timeout: 5000 });
  }

  /**
   * Assert that the indicator shows online state
   * @returns {Promise<void>}
   */
  async expectOnline() {
    await this.root.waitFor({ state: 'visible', timeout: 10000 });
    
    // Check for online badge
    const onlineBadge = this.root.locator(selectors.offline.onlineBadge);
    await onlineBadge.waitFor({ state: 'visible', timeout: 5000 });
    
    // Verify offline badge is NOT visible (or hidden)
    const offlineBadge = this.root.locator(selectors.offline.offlineBadge);
    await expect(offlineBadge).not.toBeVisible({ timeout: 3000 });
    
    // Optional: check for "Online" text
    const text = await this.root.textContent();
    if (!text?.match(/online|conectado|connected/i)) {
      // Some implementations use icon-only, so we just verify online badge exists
      await onlineBadge.waitFor({ state: 'visible', timeout: 3000 });
    }
  }

  /**
   * Assert that the indicator shows offline state
   * @returns {Promise<void>}
   */
  async expectOffline() {
    await this.root.waitFor({ state: 'visible', timeout: 10000 });
    
    // Check for offline badge
    const offlineBadge = this.root.locator(selectors.offline.offlineBadge);
    await offlineBadge.waitFor({ state: 'visible', timeout: 5000 });
    
    // Verify online badge is NOT visible
    const onlineBadge = this.root.locator(selectors.offline.onlineBadge);
    await expect(onlineBadge).not.toBeVisible({ timeout: 3000 });
    
    // Optional: check for "Offline" text
    const text = await this.root.textContent();
    if (!text?.match(/offline|desconectado|disconnected/i)) {
      await offlineBadge.waitFor({ state: 'visible', timeout: 3000 });
    }
  }

  /**
   * Get the current sync status
   * @returns {Promise<'idle'|'pending'|'syncing'|'synced'|'error'|'unknown'>}
   */
  async getSyncStatus() {
    const syncStatusEl = this.root.locator(selectors.offline.syncStatus);
    
    if (await syncStatusEl.count() === 0) {
      // Try alternative: check data attribute on root
      const dataStatus = await this.root.getAttribute('data-sync-status');
      if (dataStatus) return dataStatus;
      return 'unknown';
    }
    
    await syncStatusEl.waitFor({ state: 'visible', timeout: 5000 });
    
    // Get status from data attribute or text content
    const dataStatus = await syncStatusEl.getAttribute('data-sync-status');
    if (dataStatus) return dataStatus;
    
    const text = await syncStatusEl.textContent();
    if (text) {
      const lower = text.toLowerCase();
      if (lower.includes('syncing') || lower.includes('sincroniz')) return 'syncing';
      if (lower.includes('pending') || lower.includes('pendient')) return 'pending';
      if (lower.includes('synced') || lower.includes('sincronizad')) return 'synced';
      if (lower.includes('error') || lower.includes('fallo') || lower.includes('failed')) return 'error';
      if (lower.includes('idle') || lower.includes('espera')) return 'idle';
    }
    
    return 'unknown';
  }

  /**
   * Expect a specific sync status
   * @param {'idle'|'pending'|'syncing'|'synced'|'error'} expectedStatus
   * @returns {Promise<void>}
   */
  async expectSyncStatus(expectedStatus) {
    const actualStatus = await this.getSyncStatus();
    if (actualStatus !== expectedStatus) {
      throw new Error(`Expected sync status "${expectedStatus}", got "${actualStatus}"`);
    }
  }

  /**
   * Get the queue depth (number of pending changes)
   * @returns {Promise<number>}
   */
  async getQueueDepth() {
    const queueDepthEl = this.root.locator(selectors.offline.queueDepth);
    
    if (await queueDepthEl.count() === 0) {
      // Try alternative: check data attribute on root
      const dataDepth = await this.root.getAttribute('data-queue-depth');
      if (dataDepth !== null) return parseInt(dataDepth, 10) || 0;
      return 0;
    }
    
    await queueDepthEl.waitFor({ state: 'visible', timeout: 5000 });
    
    // Get depth from data attribute, text content, or input value
    const dataDepth = await queueDepthEl.getAttribute('data-queue-depth');
    if (dataDepth !== null) return parseInt(dataDepth, 10) || 0;
    
    const inputValue = await queueDepthEl.inputValue().catch(() => null);
    if (inputValue !== null) return parseInt(inputValue, 10) || 0;
    
    const text = await queueDepthEl.textContent();
    if (text) {
      const match = text.match(/(\d+)/);
      if (match) return parseInt(match[1], 10);
    }
    
    return 0;
  }

  /**
   * Expect a specific queue depth
   * @param {number} expectedDepth
   * @returns {Promise<void>}
   */
  async expectQueueDepth(expectedDepth) {
    const actualDepth = await this.getQueueDepth();
    if (actualDepth !== expectedDepth) {
      throw new Error(`Expected queue depth ${expectedDepth}, got ${actualDepth}`);
    }
  }

  /**
   * Click the indicator (may open sync details panel)
   * @returns {Promise<void>}
   */
  async click() {
    await this.root.waitFor({ state: 'visible', timeout: 5000 });
    await this.root.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Check if sync is in progress
   * @returns {Promise<boolean>}
   */
  async isSyncing() {
    const status = await this.getSyncStatus();
    return status === 'syncing';
  }

  /**
   * Check if there are pending changes
   * @returns {Promise<boolean>}
   */
  async hasPendingChanges() {
    const depth = await this.getQueueDepth();
    return depth > 0;
  }

  /**
   * Get the full indicator state as an object
   * @returns {Promise<{online: boolean, syncStatus: string, queueDepth: number}>}
   */
  async getState() {
    const isOnline = await this.isOnline();
    const syncStatus = await this.getSyncStatus();
    const queueDepth = await this.getQueueDepth();
    
    return { online: isOnline, syncStatus, queueDepth };
  }

  /**
   * Check if currently online
   * @returns {Promise<boolean>}
   */
  async isOnline() {
    try {
      await this.expectOnline();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for sync to complete (status becomes 'synced' or 'idle')
   * @param {number} [timeout=30000] - Maximum wait time in ms
   * @returns {Promise<void>}
   */
  async waitForSyncComplete(timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const status = await this.getSyncStatus();
      if (status === 'synced' || status === 'idle') {
        return;
      }
      await this.page.waitForTimeout(1000);
    }
    
    const finalStatus = await this.getSyncStatus();
    throw new Error(`Sync did not complete within ${timeout}ms. Final status: ${finalStatus}`);
  }

  /**
   * Wait for queue to be empty
   * @param {number} [timeout=30000] - Maximum wait time in ms
   * @returns {Promise<void>}
   */
  async waitForQueueEmpty(timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const depth = await this.getQueueDepth();
      if (depth === 0) {
        return;
      }
      await this.page.waitForTimeout(1000);
    }
    
    const finalDepth = await this.getQueueDepth();
    throw new Error(`Queue did not empty within ${timeout}ms. Final depth: ${finalDepth}`);
  }
}

// Import expect for assertions
import { expect } from '@playwright/test';