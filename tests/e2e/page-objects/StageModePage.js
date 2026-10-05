/**
 * StageModePage - Page object for the live performance Stage Mode
 * Handles fullscreen, song navigation, auto-scroll, and performance controls
 */

import { BasePage } from './BasePage.js';
import { selectors } from '../utils/selectors.js';
import { OfflineIndicator } from './components/OfflineIndicator.js';

/**
 * Page object for Stage Mode (live performance view)
 * URL pattern: /stage/:setlistId
 */
export class StageModePage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page, '/stage/:setlistId');
  }

  /**
   * Key selector that indicates Stage Mode is loaded
   * @type {string}
   */
  get keySelector() {
    return selectors.stage.container;
  }

  /**
   * OfflineIndicator component for monitoring connection status
   * @type {OfflineIndicator}
   */
  get offlineIndicator() {
    if (!this._offlineIndicator) {
      this._offlineIndicator = new OfflineIndicator(this.page);
    }
    return this._offlineIndicator;
  }

  /**
   * Enter fullscreen mode for performance
   * @returns {Promise<void>}
   */
  async enterFullscreen() {
    const fullscreenBtn = this.page.locator(selectors.stage.fullscreenToggle);
    await fullscreenBtn.waitFor({ state: 'visible', timeout: 5000 });
    
    // Check if already in fullscreen
    const isFullscreen = await this.page.evaluate(() => document.fullscreenElement !== null);
    if (!isFullscreen) {
      await fullscreenBtn.click();
      await this.page.waitForTimeout(500);
      
      // Verify fullscreen was entered
      const nowFullscreen = await this.page.evaluate(() => document.fullscreenElement !== null);
      if (!nowFullscreen) {
        throw new Error('Failed to enter fullscreen mode');
      }
    }
  }

  /**
   * Exit fullscreen mode
   * @returns {Promise<void>}
   */
  async exitFullscreen() {
    const isFullscreen = await this.page.evaluate(() => document.fullscreenElement !== null);
    if (isFullscreen) {
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(500);
      
      const stillFullscreen = await this.page.evaluate(() => document.fullscreenElement !== null);
      if (stillFullscreen) {
        // Try clicking the fullscreen toggle as fallback
        const fullscreenBtn = this.page.locator(selectors.stage.fullscreenToggle);
        if (await fullscreenBtn.isVisible({ timeout: 2000 })) {
          await fullscreenBtn.click();
        }
      }
    }
  }

  /**
   * Navigate to the next song in the setlist
   * Supports both keyboard (ArrowRight/Space) and button click
   * @param {'keyboard'|'button'} [method='keyboard'] - Navigation method
   * @returns {Promise<void>}
   */
  async nextSong(method = 'keyboard') {
    if (method === 'keyboard') {
      await this.page.keyboard.press('ArrowRight');
    } else {
      const nextBtn = this.page.locator(selectors.stage.nextSongButton);
      await nextBtn.waitFor({ state: 'visible', timeout: 5000 });
      await nextBtn.click();
    }
    
    // Wait for song transition
    await this.waitForNetworkIdle(this.page);
    await this.page.waitForTimeout(300);
  }

  /**
   * Navigate to the previous song in the setlist
   * Supports both keyboard (ArrowLeft) and button click
   * @param {'keyboard'|'button'} [method='keyboard'] - Navigation method
   * @returns {Promise<void>}
   */
  async previousSong(method = 'keyboard') {
    if (method === 'keyboard') {
      await this.page.keyboard.press('ArrowLeft');
    } else {
      const prevBtn = this.page.locator(selectors.stage.prevSongButton);
      await prevBtn.waitFor({ state: 'visible', timeout: 5000 });
      await prevBtn.click();
    }
    
    // Wait for song transition
    await this.waitForNetworkIdle(this.page);
    await this.page.waitForTimeout(300);
  }

  /**
   * Toggle annotations visibility
   * @returns {Promise<void>}
   */
  async toggleAnnotations() {
    // Look for annotation toggle in stage mode
    const annotationBtn = this.page.locator('[data-testid="stage-toggle-annotations"], [data-testid="toggle-annotations"]');
    
    if (await annotationBtn.count() > 0) {
      await annotationBtn.click();
      await this.page.waitForTimeout(300);
    } else {
      // Fallback: keyboard shortcut (often 'A' key)
      await this.page.keyboard.press('KeyA');
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Set auto-scroll speed
   * @param {number} speed - Speed value (0 = off, 1-10 = speed levels)
   * @returns {Promise<void>}
   */
  async setAutoScroll(speed) {
    const autoScrollToggle = this.page.locator(selectors.stage.autoScrollToggle);
    await autoScrollToggle.waitFor({ state: 'visible', timeout: 5000 });

    if (speed === 0) {
      // Turn off auto-scroll if it's on
      const isChecked = await autoScrollToggle.isChecked().catch(() => false);
      if (isChecked) {
        await autoScrollToggle.click();
      }
    } else {
      // Turn on and set speed
      const isChecked = await autoScrollToggle.isChecked().catch(() => false);
      if (!isChecked) {
        await autoScrollToggle.click();
      }
      
      // Look for speed control (slider or input)
      const speedControl = this.page.locator('[data-testid="autoscroll-speed"], [data-testid="stage-autoscroll-speed"], input[type="range"]');
      if (await speedControl.count() > 0) {
        await speedControl.fill(speed.toString());
      }
    }
    
    await this.waitForNetworkIdle(this.page);
  }

  /**
   * Assert the currently displayed song matches expected title
   * @param {string} title - Expected song title
   * @returns {Promise<void>}
   */
  async expectCurrentSong(title) {
    // The current song title is typically displayed in the chord display area or a dedicated element
    const titleLocators = [
      this.page.locator('[data-testid="stage-current-song-title"]'),
      this.page.locator(selectors.stage.chordDisplay).locator('[data-testid="song-title"]').first(),
      this.page.locator('[data-testid="song-title"]').first(),
      this.page.locator(selectors.stage.chordDisplay).locator('h1, h2, .song-title').first(),
    ];

    let found = false;
    for (const locator of titleLocators) {
      if (await locator.count() > 0) {
        await expect(locator).toHaveText(new RegExp(title, 'i'), { timeout: 10000 });
        found = true;
        break;
      }
    }

    if (!found) {
      // Last resort: check if title appears anywhere in the chord display
      const chordDisplay = this.page.locator(selectors.stage.chordDisplay);
      await expect(chordDisplay).toContainText(title, { timeout: 10000 });
    }
  }

  /**
   * Assert song progress (current song X of Y)
   * @param {number} current - Current song number (1-based)
   * @param {number} total - Total songs in setlist
   * @returns {Promise<void>}
   */
  async expectSongProgress(current, total) {
    const progressLocator = this.page.locator(selectors.stage.songProgress);
    await progressLocator.waitFor({ state: 'visible', timeout: 5000 });
    
    const progressText = await progressLocator.textContent();
    const expectedPattern = new RegExp(`${current}\\s*/\\s*${total}|${current}\\s+of\\s+${total}|Song\\s+${current}\\s+of\\s+${total}`, 'i');
    
    if (!progressText?.match(expectedPattern)) {
      throw new Error(`Expected song progress "${current}/${total}", got "${progressText}"`);
    }
  }

  /**
   * Assert setlist progress (overall progress through setlist)
   * @param {number} percentage - Expected progress percentage (0-100)
   * @param {number} [tolerance=5] - Allowed tolerance
   * @returns {Promise<void>}
   */
  async expectSetlistProgress(percentage, tolerance = 5) {
    const progressLocator = this.page.locator(selectors.stage.setlistProgress);
    await progressLocator.waitFor({ state: 'visible', timeout: 5000 });
    
    // Could be a progress bar value or text
    const value = await progressLocator.getAttribute('value') 
      || await progressLocator.getAttribute('aria-valuenow')
      || await progressLocator.textContent();
    
    if (value !== null) {
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        const diff = Math.abs(numericValue - percentage);
        if (diff > tolerance) {
          throw new Error(`Expected setlist progress ~${percentage}%, got ${numericValue}%`);
        }
        return;
      }
    }
    
    // If we can't get numeric value, check text contains percentage
    const progressText = await progressLocator.textContent();
    if (!progressText?.includes(`${percentage}%`)) {
      throw new Error(`Expected setlist progress to contain "${percentage}%", got "${progressText}"`);
    }
  }

  /**
   * Get the current song title displayed
   * @returns {Promise<string>}
   */
  async getCurrentSongTitle() {
    const titleLocators = [
      this.page.locator('[data-testid="stage-current-song-title"]'),
      this.page.locator(selectors.stage.chordDisplay).locator('[data-testid="song-title"]').first(),
      this.page.locator('[data-testid="song-title"]').first(),
    ];

    for (const locator of titleLocators) {
      if (await locator.count() > 0) {
        return (await locator.textContent()) || '';
      }
    }
    return '';
  }

  /**
   * Get the current chord/lyrics content
   * @returns {Promise<string>}
   */
  async getChordLyricsContent() {
    const chordDisplay = this.page.locator(selectors.stage.chordDisplay);
    await chordDisplay.waitFor({ state: 'visible', timeout: 5000 });
    return (await chordDisplay.textContent()) || '';
  }

  /**
   * Get the lyrics content
   * @returns {Promise<string>}
   */
  async getLyricsContent() {
    const lyricsDisplay = this.page.locator(selectors.stage.lyricsDisplay);
    if (await lyricsDisplay.count() > 0) {
      await lyricsDisplay.waitFor({ state: 'visible', timeout: 5000 });
      return (await lyricsDisplay.textContent()) || '';
    }
    return '';
  }

  /**
   * Toggle metronome on/off
   * @param {boolean} [enable] - Explicit enable/disable, or toggle if undefined
   * @returns {Promise<void>}
   */
  async toggleMetronome(enable) {
    const metronomeToggle = this.page.locator(selectors.stage.metronomeToggle);
    await metronomeToggle.waitFor({ state: 'visible', timeout: 5000 });
    
    const isChecked = await metronomeToggle.isChecked().catch(() => false);
    const shouldEnable = enable ?? !isChecked;
    
    if (shouldEnable !== isChecked) {
      await metronomeToggle.click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Set metronome tempo
   * @param {number} bpm - Beats per minute
   * @returns {Promise<void>}
   */
  async setMetronomeTempo(bpm) {
    const tempoInput = this.page.locator(selectors.stage.metronomeTempo);
    await tempoInput.waitFor({ state: 'visible', timeout: 5000 });
    await tempoInput.fill(bpm.toString());
    await tempoInput.press('Enter');
    await this.waitForNetworkIdle(this.page);
  }

  /**
   * Check if in fullscreen mode
   * @returns {Promise<boolean>}
   */
  async isFullscreen() {
    return this.page.evaluate(() => document.fullscreenElement !== null);
  }

  /**
   * Check if auto-scroll is enabled
   * @returns {Promise<boolean>}
   */
  async isAutoScrollEnabled() {
    const autoScrollToggle = this.page.locator(selectors.stage.autoScrollToggle);
    return autoScrollToggle.isChecked().catch(() => false);
  }

  /**
   * Check if metronome is enabled
   * @returns {Promise<boolean>}
   */
  async isMetronomeEnabled() {
    const metronomeToggle = this.page.locator(selectors.stage.metronomeToggle);
    return metronomeToggle.isChecked().catch(() => false);
  }

  /**
   * Simulate keyboard navigation (space/enter for next, backspace for previous)
   * @param {'next'|'prev'} direction - Navigation direction
   * @returns {Promise<void>}
   */
  async keyboardNavigate(direction) {
    if (direction === 'next') {
      await this.page.keyboard.press('Space');
    } else {
      await this.page.keyboard.press('Backspace');
    }
    await this.waitForNetworkIdle(this.page);
    await this.page.waitForTimeout(300);
  }

  /**
   * Exit stage mode (navigate back to setlist detail)
   * @returns {Promise<void>}
   */
  async exitStageMode() {
    await this.exitFullscreen();
    await this.page.keyboard.press('Escape');
    await this.waitForUrl('**/setlists/**', { timeout: 10000 });
    await this.waitForLoad();
  }
}

// Import expect for assertions
import { expect } from '@playwright/test';