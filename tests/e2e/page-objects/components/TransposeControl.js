/**
 * TransposeControl - Component page object for the transpose control
 * Handles semitone offset adjustments for songs and setlists
 */

import { selectors } from '../../utils/selectors.js';

/**
 * Component page object for TransposeControl
 * Works for both song-level and setlist-level transpose controls
 */
export class TransposeControl {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {Object} [options]
   * @param {string} [options.selector] - Custom selector for the transpose control
   */
  constructor(page, options = {}) {
    this.page = page;
    this.selector = options.selector || selectors.setlistDetail.transposeAll || selectors.songDetail.transposeControl;
  }

  /**
   * Get the root locator for the transpose control
   * @returns {import('@playwright/test').Locator}
   */
  get root() {
    return this.page.locator(this.selector);
  }

  /**
   * Get the current transpose value (semitone offset)
   * @returns {Promise<number>}
   */
  async getTransposeValue() {
    const root = this.root;
    await root.waitFor({ state: 'visible', timeout: 5000 });
    
    // Try multiple possible locations for the value display
    const valueSelectors = [
      '[data-testid="transpose-value"]',
      '[data-transpose-value]',
      'input[type="number"]',
      '.transpose-value',
      '[data-value]'
    ];
    
    for (const selector of valueSelectors) {
      const element = root.locator(selector).first();
      if (await element.count() > 0) {
        const value = await element.inputValue().catch(() => element.textContent());
        if (value !== null) {
          return parseInt(value.toString(), 10) || 0;
        }
      }
    }
    
    // Fallback: check for data attribute on root
    const dataValue = await root.getAttribute('data-transpose');
    if (dataValue !== null) {
      return parseInt(dataValue, 10) || 0;
    }
    
    return 0;
  }

  /**
   * Set transpose value by semitones
   * @param {number} steps - Semitone offset (positive or negative)
   * @returns {Promise<void>}
   */
  async setTranspose(steps) {
    const root = this.root;
    await root.waitFor({ state: 'visible', timeout: 5000 });
    
    // Try direct input first
    const input = root.locator('input[type="number"], [data-testid="transpose-input"]').first();
    if (await input.count() > 0) {
      await input.fill(steps.toString());
      await input.press('Enter');
      await this.waitForUpdate();
      return;
    }
    
    // Otherwise use increment/decrement buttons
    const incrementBtn = root.locator('[data-testid="transpose-up"], button:has-text("+"), [aria-label*="increase" i]').first();
    const decrementBtn = root.locator('[data-testid="transpose-down"], button:has-text("-"), [aria-label*="decrease" i]').first();
    
    const currentValue = await this.getTransposeValue();
    const diff = steps - currentValue;
    
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        await incrementBtn.click();
        await this.waitForUpdate();
      }
    } else if (diff < 0) {
      for (let i = 0; i < Math.abs(diff); i++) {
        await decrementBtn.click();
        await this.waitForUpdate();
      }
    }
  }

  /**
   * Reset transpose to 0 (original key)
   * @returns {Promise<void>}
   */
  async resetTranspose() {
    await this.setTranspose(0);
  }

  /**
   * Increment transpose by 1 semitone
   * @returns {Promise<void>}
   */
  async increment() {
    const currentValue = await this.getTransposeValue();
    await this.setTranspose(currentValue + 1);
  }

  /**
   * Decrement transpose by 1 semitone
   * @returns {Promise<void>}
   */
  async decrement() {
    const currentValue = await this.getTransposeValue();
    await this.setTranspose(currentValue - 1);
  }

  /**
   * Expect a specific transpose value
   * @param {number} value - Expected semitone offset
   * @returns {Promise<void>}
   */
  async expectTransposeValue(value) {
    const actualValue = await this.getTransposeValue();
    if (actualValue !== value) {
      throw new Error(`Expected transpose value ${value}, got ${actualValue}`);
    }
  }

  /**
   * Expect transpose has been applied to a specific key
   * @param {string} targetKey - Expected key after transpose (e.g., "G", "D#", "F")
   * @returns {Promise<void>}
   */
  async expectTransposeApplied(targetKey) {
    // Get the key display element
    const keyDisplay = this.page.locator('[data-testid="current-key"], [data-testid="display-key"], .current-key').first();
    
    if (await keyDisplay.count() > 0) {
      const displayedKey = await keyDisplay.textContent();
      if (!displayedKey?.includes(targetKey)) {
        throw new Error(`Expected transposed key "${targetKey}", display shows: "${displayedKey}"`);
      }
    } else {
      // Fallback: verify via transpose value and original key
      const originalKey = await this.getOriginalKey();
      const transposeValue = await this.getTransposeValue();
      const expectedKey = this.calculateTransposedKey(originalKey, transposeValue);
      
      if (expectedKey !== targetKey) {
        throw new Error(`Transpose calculation mismatch: original ${originalKey} + ${transposeValue} = ${expectedKey}, expected ${targetKey}`);
      }
    }
  }

  /**
   * Get the original key (before transpose)
   * @returns {Promise<string>}
   */
  async getOriginalKey() {
    const originalKeyEl = this.page.locator('[data-testid="original-key"], [data-original-key]').first();
    if (await originalKeyEl.count() > 0) {
      return (await originalKeyEl.textContent()) || 'C';
    }
    // Default to C if not found
    return 'C';
  }

  /**
   * Calculate transposed key from original key and semitone offset
   * @param {string} originalKey - Original key (e.g., "C", "G", "F#")
   * @param {number} semitones - Semitone offset
   * @returns {string} Transposed key
   */
  calculateTransposedKey(originalKey, semitones) {
    const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatKeys = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    
    // Find original key index (handle both sharp and flat notation)
    let index = keys.indexOf(originalKey);
    if (index === -1) {
      index = flatKeys.indexOf(originalKey);
    }
    
    if (index === -1) {
      // Unknown key, return original
      return originalKey;
    }
    
    // Calculate new index with wrapping
    const newIndex = ((index + semitones) % 12 + 12) % 12;
    
    // Prefer sharp notation for consistency
    return keys[newIndex];
  }

  /**
   * Wait for transpose change to propagate
   * @returns {Promise<void>}
   */
  async waitForUpdate() {
    await this.page.waitForLoadState('networkidle', { timeout: 5000 });
    await this.page.waitForTimeout(100);
  }

  /**
   * Check if transpose control is visible
   * @returns {Promise<boolean>}
   */
  async isVisible() {
    return this.root.isVisible();
  }

  /**
   * Get the transpose indicator text (e.g., "+2", "-1", "Original")
   * @returns {Promise<string>}
   */
  async getIndicatorText() {
    const indicator = this.root.locator('[data-testid="transpose-indicator"], .transpose-indicator').first();
    if (await indicator.count() > 0) {
      return (await indicator.textContent()) || '';
    }
    return '';
  }

  /**
   * Expect the indicator shows a specific state
   * @param {string} expectedText - Expected indicator text
   * @returns {Promise<void>}
   */
  async expectIndicator(expectedText) {
    const actualText = await this.getIndicatorText();
    if (!actualText.includes(expectedText)) {
      throw new Error(`Expected transpose indicator "${expectedText}", got "${actualText}"`);
    }
  }
}