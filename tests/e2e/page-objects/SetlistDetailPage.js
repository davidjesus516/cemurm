/**
 * SetlistDetailPage - Page object for individual setlist detail/builder page
 */

import { BasePage } from './BasePage.js';
import { selectors } from '../utils/selectors.js';
import { TransposeControl } from './components/TransposeControl.js';

/**
 * Page object for setlist detail page
 */
export class SetlistDetailPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page, '/setlists/:id');
  }

  /**
   * Key selector that indicates the setlist detail page is loaded
   * @type {string}
   */
  get keySelector() {
    return selectors.setlistDetail.title;
  }

  /**
   * TransposeControl component object for setlist-level transpose
   * @type {TransposeControl}
   */
  get transposeControl() {
    if (!this._transposeControl) {
      this._transposeControl = new TransposeControl(this.page);
    }
    return this._transposeControl;
  }

  /**
   * Reorder songs via drag-and-drop
   * @param {number} fromIndex - Source index (0-based)
   * @param {number} toIndex - Target index (0-based)
   * @returns {Promise<void>}
   */
  async reorderSongs(fromIndex, toIndex) {
    const songItems = this.page.locator(selectors.setlistDetail.songItem);
    const sourceItem = songItems.nth(fromIndex);
    const targetItem = songItems.nth(toIndex);
    
    await sourceItem.waitFor({ state: 'visible', timeout: 5000 });
    await targetItem.waitFor({ state: 'visible', timeout: 5000 });
    
    // Get drag handle
    const dragHandle = sourceItem.locator(selectors.setlistDetail.reorderHandle);
    await dragHandle.waitFor({ state: 'visible', timeout: 5000 });
    
    // Perform drag and drop
    await dragHandle.dragTo(targetItem);
    
    // Wait for reorder to persist
    await this.waitForNetworkIdle(this.page);
    await this.page.waitForTimeout(500);
  }

  /**
   * Add a song to the setlist
   * @param {string} songId - Song ID to add
   * @param {number} [position] - Optional position (0-based, defaults to end)
   * @returns {Promise<void>}
   */
  async addSong(songId, position) {
    // Click add song button
    await this.page.click(selectors.setlistDetail.addSongButton);
    
    // Wait for song picker modal
    await this.page.waitForSelector('[data-testid="song-picker"], [data-testid="add-song-modal"]', { 
      state: 'visible', 
      timeout: 10000 
    });
    
    // Search/select the song
    const songOption = this.page.locator(`[data-song-id="${songId}"]`).first();
    await songOption.waitFor({ state: 'visible', timeout: 5000 });
    await songOption.click();
    
    // If position specified, drag to position
    if (position !== undefined) {
      // The song is added at the end, so we need to reorder
      const songCount = await this.getSongCount();
      await this.reorderSongs(songCount - 1, position);
    }
    
    // Confirm/close modal
    await this.page.click('[data-testid="add-song-confirm"], [data-testid="modal-confirm"]');
    await this.waitForNetworkIdle(this.page);
  }

  /**
   * Remove a song from the setlist
   * @param {string} songId - Song ID to remove
   * @returns {Promise<void>}
   */
  async removeSong(songId) {
    const songItem = this.page.locator(selectors.setlistDetail.songItem).filter({ has: this.page.locator(`[data-song-id="${songId}"]`) });
    
    if (await songItem.count() === 0) {
      throw new Error(`Song ${songId} not found in setlist`);
    }
    
    await songItem.locator(selectors.setlistDetail.removeSongButton).click();
    
    // Confirm removal if modal appears
    const confirmBtn = this.page.locator('[data-testid="modal-confirm"], [data-testid="confirm-remove"]');
    if (await confirmBtn.isVisible({ timeout: 2000 })) {
      await confirmBtn.click();
    }
    
    await this.waitForNetworkIdle(this.page);
  }

  /**
   * Transpose the entire setlist
   * @param {number} steps - Semitone offset
   * @returns {Promise<void>}
   */
  async transposeSetlist(steps) {
    return this.transposeControl.setTranspose(steps);
  }

  /**
   * Export setlist as PDF
   * @returns {Promise<void>}
   */
  async exportPDF() {
    await this.page.click(selectors.setlistDetail.exportPdf);
    
    // Wait for download or print dialog
    await this.page.waitForTimeout(1000);
  }

  /**
   * Print setlist layout
   * @returns {Promise<void>}
   */
  async printLayout() {
    await this.page.click(selectors.setlistDetail.printLayout);
    await this.page.waitForTimeout(1000);
  }

  /**
   * Enter Stage Mode from this setlist
   * @returns {Promise<import('./StageModePage.js').StageModePage>} StageModePage instance
   */
  async enterStageMode() {
    await this.page.click('[data-testid="enter-stage"], [data-testid="stage-mode-button"]');
    
    // Wait for navigation to stage mode
    await this.page.waitForURL('**/stage/**', { timeout: 15000 });
    await this.waitForLoad();
    
    // Import dynamically
    const { StageModePage } = await import('./StageModePage.js');
    return new StageModePage(this.page);
  }

  /**
   * Assert the song order matches expected titles
   * @param {string[]} titles - Expected song titles in order
   * @returns {Promise<void>}
   */
  async expectSongOrder(titles) {
    const songItems = this.page.locator(selectors.setlistDetail.songItem);
    const count = await songItems.count();
    
    if (count !== titles.length) {
      throw new Error(`Expected ${titles.length} songs, found ${count}`);
    }
    
    for (let i = 0; i < titles.length; i++) {
      const item = songItems.nth(i);
      const title = await item.locator('[data-testid="setlist-song-title"], [data-testid="song-title"]').textContent();
      if (!title?.includes(titles[i])) {
        throw new Error(`Song at position ${i}: expected "${titles[i]}", got "${title}"`);
      }
    }
  }

  /**
   * Get the setlist title
   * @returns {Promise<string>}
   */
  async getTitle() {
    return this.page.locator(selectors.setlistDetail.title).textContent() || '';
  }

  /**
   * Get count of songs in setlist
   * @returns {Promise<number>}
   */
  async getSongCount() {
    return this.page.locator(selectors.setlistDetail.songItem).count();
  }

  /**
   * Get all song titles in order
   * @returns {Promise<string[]>}
   */
  async getSongTitles() {
    const songItems = this.page.locator(selectors.setlistDetail.songItem);
    const count = await songItems.count();
    const titles = [];
    
    for (let i = 0; i < count; i++) {
      const title = await songItems.nth(i).locator('[data-testid="setlist-song-title"], [data-testid="song-title"]').textContent();
      if (title) titles.push(title.trim());
    }
    
    return titles;
  }

  /**
   * Invite a collaborator to the setlist
   * @param {string} email - Collaborator email
   * @param {'view'|'edit'} role - Permission role
   * @returns {Promise<void>}
   */
  async inviteCollaborator(email, role = 'view') {
    await this.page.click(selectors.setlists.shareButton);
    
    // Wait for share modal
    await this.page.waitForSelector('[data-testid="share-modal"]', { state: 'visible', timeout: 5000 });
    
    // Fill invite form
    await this.page.fill('[data-testid="invite-email"]', email);
    await this.page.selectOption('[data-testid="invite-role"]', role);
    await this.page.click('[data-testid="invite-submit"]');
    
    // Wait for confirmation
    await this.waitForNetworkIdle(this.page);
  }

  /**
   * Assert a collaborator is visible with expected status
   * @param {string} email - Collaborator email
   * @param {'pending'|'accepted'} status - Expected status
   * @returns {Promise<void>}
   */
  async expectCollaborator(email, status) {
    const collaboratorRow = this.page.locator(`[data-testid="collaborator-row"]:has-text("${email}")`);
    await collaboratorRow.waitFor({ state: 'visible', timeout: 5000 });
    
    const statusBadge = collaboratorRow.locator('[data-testid="collaborator-status"]');
    await expect(statusBadge).toHaveText(status);
  }
}

// Import expect
import { expect } from '@playwright/test';