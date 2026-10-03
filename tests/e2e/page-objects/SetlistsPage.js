/**
 * SetlistsPage - Page object for the setlists list page
 */

import { BasePage } from './BasePage.js';
import { selectors } from '../utils/selectors.js';

/**
 * Page object for setlists list page
 */
export class SetlistsPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page, '/setlists');
  }

  /**
   * Key selector that indicates the setlists page is loaded
   * @type {string}
   */
  get keySelector() {
    return selectors.setlists.list;
  }

  /**
   * Create a new setlist via the UI
   * @param {Object} data - Setlist data
   * @param {string} data.name - Setlist name
   * @param {string} [data.description] - Optional description
   * @param {string[]} [data.songs] - Optional song IDs to add
   * @returns {Promise<string>} Created setlist ID
   */
  async createSetlist(data) {
    // Click create button
    await this.page.click(selectors.setlists.createButton);
    
    // Wait for modal or navigation to create form
    await this.page.waitForSelector('[data-testid="setlist-create-form"], [data-testid="setlist-form"]', { 
      state: 'visible', 
      timeout: 10000 
    });

    // Fill the form
    await this.page.fill('[data-testid="setlist-name-input"]', data.name);
    
    if (data.description) {
      await this.page.fill('[data-testid="setlist-description-input"]', data.description);
    }

    // Save the setlist
    await this.page.click('[data-testid="setlist-save"], [data-testid="create-setlist-submit"]');
    
    // Wait for redirect to detail page or list
    await this.waitForLoad();

    // Extract setlist ID from URL if on detail page
    const url = this.getCurrentUrl();
    const match = url.match(/\/setlists\/([a-f0-9-]+)/);
    if (match) {
      return match[1];
    }

    // If back on list, find the newly created setlist
    if (data.name) {
      const setlistRow = this.page.locator(selectors.setlists.setlistRow).filter({ hasText: data.name });
      await setlistRow.waitFor({ state: 'visible', timeout: 5000 });
      const id = await setlistRow.getAttribute('data-setlist-id');
      return id;
    }

    return null;
  }

  /**
   * Edit an existing setlist
   * @param {string} id - Setlist ID
   * @param {Object} data - Updated setlist data
   * @returns {Promise<void>}
   */
  async editSetlist(id, data) {
    // Open setlist detail first
    await this.openSetlistDetail(id);
    
    // Click edit button on detail page
    await this.page.click('[data-testid="setlist-edit-button"], [data-testid="edit-setlist"]');
    
    // Wait for edit form
    await this.page.waitForSelector('[data-testid="setlist-edit-form"]', { state: 'visible', timeout: 5000 });

    if (data.name) {
      await this.page.fill('[data-testid="setlist-name-input"]', data.name);
    }
    if (data.description) {
      await this.page.fill('[data-testid="setlist-description-input"]', data.description);
    }

    // Save
    await this.page.click('[data-testid="setlist-save"], [data-testid="edit-setlist-submit"]');
    await this.waitForLoad();
  }

  /**
   * Delete a setlist
   * @param {string} id - Setlist ID
   * @returns {Promise<void>}
   */
  async deleteSetlist(id) {
    // Find the setlist row
    const setlistRow = this.page.locator(selectors.setlists.setlistRow).filter({ has: this.page.locator(`[data-setlist-id="${id}"]`) });
    
    if (await setlistRow.count() > 0) {
      await setlistRow.locator(selectors.setlists.deleteButton).click();
    } else {
      // Navigate to detail and delete from there
      await this.openSetlistDetail(id);
      await this.page.click('[data-testid="setlist-delete-button"]');
    }

    // Confirm deletion in modal
    await this.page.click('[data-testid="modal-confirm"], [data-testid="confirm-delete"]');
    await this.waitForLoad();
  }

  /**
   * Duplicate a setlist
   * @param {string} id - Setlist ID to duplicate
   * @returns {Promise<string>} New setlist ID
   */
  async duplicateSetlist(id) {
    const setlistRow = this.page.locator(selectors.setlists.setlistRow).filter({ has: this.page.locator(`[data-setlist-id="${id}"]`) });
    
    if (await setlistRow.count() > 0) {
      await setlistRow.locator(selectors.setlists.duplicateButton).click();
    } else {
      await this.openSetlistDetail(id);
      await this.page.click('[data-testid="setlist-duplicate-button"]');
    }

    // Wait for duplicate to be created
    await this.waitForLoad();
    
    // Extract new ID from URL or list
    const url = this.getCurrentUrl();
    const match = url.match(/\/setlists\/([a-f0-9-]+)/);
    if (match) {
      return match[1];
    }
    
    return null;
  }

  /**
   * Assert a setlist is visible in the list
   * @param {string} name - Setlist name
   * @returns {Promise<void>}
   */
  async expectSetlistVisible(name) {
    const setlistRow = this.page.locator(selectors.setlists.setlistRow).filter({ hasText: name });
    await setlistRow.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Assert a setlist is NOT visible in the list
   * @param {string} name - Setlist name
   * @returns {Promise<void>}
   */
  async expectSetlistNotVisible(name) {
    const setlistRow = this.page.locator(selectors.setlists.setlistRow).filter({ hasText: name });
    await setlistRow.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Open setlist detail page
   * @param {string} id - Setlist ID
   * @returns {Promise<SetlistDetailPage>} SetlistDetailPage instance
   */
  async openSetlistDetail(id) {
    // Click view button for the setlist
    const setlistRow = this.page.locator(selectors.setlists.setlistRow).filter({ has: this.page.locator(`[data-setlist-id="${id}"]`) });
    
    if (await setlistRow.count() > 0) {
      await setlistRow.locator(selectors.setlists.viewButton).click();
    } else {
      // Navigate directly
      await this.page.goto(`/setlists/${id}`);
    }
    
    await this.waitForLoad();
    
    // Import dynamically to avoid circular dependency
    const { SetlistDetailPage } = await import('./SetlistDetailPage.js');
    return new SetlistDetailPage(this.page);
  }

  /**
   * Get all visible setlist names
   * @returns {Promise<string[]>}
   */
  async getVisibleSetlistNames() {
    const names = await this.page.locator(selectors.setlists.setlistName).allTextContents();
    return names.filter(n => n.trim().length > 0);
  }

  /**
   * Get count of visible setlists
   * @returns {Promise<number>}
   */
  async getSetlistCount() {
    return this.page.locator(selectors.setlists.setlistRow).count();
  }

  /**
   * Share a setlist (open share modal)
   * @param {string} id - Setlist ID
   * @returns {Promise<void>}
   */
  async shareSetlist(id) {
    const setlistRow = this.page.locator(selectors.setlists.setlistRow).filter({ has: this.page.locator(`[data-setlist-id="${id}"]`) });
    
    if (await setlistRow.count() > 0) {
      await setlistRow.locator(selectors.setlists.shareButton).click();
    } else {
      await this.openSetlistDetail(id);
      await this.page.click(selectors.setlists.shareButton);
    }
    
    // Wait for share modal
    await this.page.waitForSelector('[data-testid="share-modal"]', { state: 'visible', timeout: 5000 });
  }
}