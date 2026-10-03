/**
 * GigsPage - Page object for the gigs list/calendar page
 * Handles gig creation, editing, deletion, filtering, and navigation
 */

import { BasePage } from './BasePage.js';
import { selectors } from '../utils/selectors.js';
import { waitForNetworkIdle } from '../utils/test-helpers.js';

/**
 * Page object for gigs list page
 * URL pattern: /gigs
 */
export class GigsPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page, '/gigs');
  }

  /**
   * Key selector that indicates the gigs page is loaded
   * @type {string}
   */
  get keySelector() {
    return selectors.gigs.list;
  }

  /**
   * Create a new gig via the UI
   * @param {Object} data - Gig data
   * @param {string} data.name - Gig name
   * @param {string} data.date - Gig date (ISO format or date string)
   * @param {string} [data.venue] - Optional venue name
   * @param {string} [data.setlistId] - Optional setlist ID to assign
   * @param {string} [data.notes] - Optional notes
   * @returns {Promise<string>} Created gig ID
   */
  async createGig(data) {
    // Click create button
    await this.page.click(selectors.gigs.createButton);
    
    // Wait for modal or navigation to gig editor
    await this.page.waitForSelector('[data-testid="gig-editor"], [data-testid="gig-form"]', { 
      state: 'visible', 
      timeout: 10000 
    });

    // Fill the form fields
    if (data.name) {
      await this.page.fill('[data-testid="gig-name-input"], [data-testid="gig-name"]', data.name);
    }
    if (data.date) {
      await this.page.fill('[data-testid="gig-date-input"], [data-testid="gig-date"]', data.date);
    }
    if (data.venue) {
      await this.page.fill('[data-testid="gig-venue-input"], [data-testid="gig-venue"]', data.venue);
    }
    if (data.setlistId) {
      const setlistSelect = this.page.locator('[data-testid="gig-setlist-select"], [data-testid="setlist-select"]');
      if (await setlistSelect.count() > 0) {
        await setlistSelect.selectOption(data.setlistId);
      }
    }
    if (data.notes) {
      await this.page.fill('[data-testid="gig-notes-input"], [data-testid="gig-notes"]', data.notes);
    }

    // Save the gig
    await this.page.click('[data-testid="gig-save"], [data-testid="gig-form-submit"], [data-testid="modal-confirm"]');
    
    // Wait for redirect back to list or detail page
    await this.waitForLoad();

    // Extract gig ID from URL if on detail page, otherwise from list
    const url = this.getCurrentUrl();
    const match = url.match(/\/gigs\/([a-f0-9-]+)/);
    if (match) {
      return match[1];
    }

    // If back on list, find the newly created gig
    if (data.name) {
      const gigCard = this.page.locator(selectors.gigs.gigCard).filter({ hasText: data.name });
      await gigCard.waitFor({ state: 'visible', timeout: 5000 });
      // Try to get ID from data attribute
      const id = await gigCard.getAttribute('data-gig-id');
      return id;
    }

    return null;
  }

  /**
   * Edit an existing gig
   * @param {string} id - Gig ID
   * @param {Object} data - Updated gig data
   * @param {string} [data.name] - Updated name
   * @param {string} [data.date] - Updated date
   * @param {string} [data.venue] - Updated venue
   * @param {string} [data.setlistId] - Updated setlist ID
   * @param {string} [data.notes] - Updated notes
   * @returns {Promise<void>}
   */
  async editGig(id, data) {
    // Find the gig card and click edit
    const gigCard = this.page.locator(selectors.gigs.gigCard).filter({ has: this.page.locator(`[data-gig-id="${id}"]`) });
    
    if (await gigCard.count() > 0) {
      await gigCard.locator(selectors.gigs.editButton).click();
    } else {
      // Try navigating to detail page first
      await this.openGigDetail(id);
      await this.page.click('[data-testid="gig-edit-button"], [data-testid="edit-gig"]');
    }
    
    // Wait for editor/form
    await this.page.waitForSelector('[data-testid="gig-editor"], [data-testid="gig-form"]', { 
      state: 'visible', 
      timeout: 5000 
    });

    // Fill updated fields
    if (data.name) {
      await this.page.fill('[data-testid="gig-name-input"], [data-testid="gig-name"]', data.name);
    }
    if (data.date) {
      await this.page.fill('[data-testid="gig-date-input"], [data-testid="gig-date"]', data.date);
    }
    if (data.venue) {
      await this.page.fill('[data-testid="gig-venue-input"], [data-testid="gig-venue"]', data.venue);
    }
    if (data.setlistId) {
      const setlistSelect = this.page.locator('[data-testid="gig-setlist-select"], [data-testid="setlist-select"]');
      if (await setlistSelect.count() > 0) {
        await setlistSelect.selectOption(data.setlistId);
      }
    }
    if (data.notes) {
      await this.page.fill('[data-testid="gig-notes-input"], [data-testid="gig-notes"]', data.notes);
    }

    // Save
    await this.page.click('[data-testid="gig-save"], [data-testid="gig-form-submit"], [data-testid="modal-confirm"]');
    await this.waitForLoad();
  }

  /**
   * Delete a gig
   * @param {string} id - Gig ID
   * @returns {Promise<void>}
   */
  async deleteGig(id) {
    // Find the gig card
    const gigCard = this.page.locator(selectors.gigs.gigCard).filter({ has: this.page.locator(`[data-gig-id="${id}"]`) });
    
    if (await gigCard.count() === 0) {
      // Try finding by name if we don't have data-gig-id
      // Open gig detail to get name first
      const detailPage = await this.openGigDetail(id);
      const name = await detailPage.getName();
      
      const cardByName = this.page.locator(selectors.gigs.gigCard).filter({ hasText: name });
      if (await cardByName.count() > 0) {
        await cardByName.locator(selectors.gigs.deleteButton).click();
      } else {
        throw new Error(`Gig with ID ${id} not found in list`);
      }
    } else {
      await gigCard.locator(selectors.gigs.deleteButton).click();
    }

    // Confirm deletion in modal
    await this.page.click('[data-testid="modal-confirm"], [data-testid="confirm-delete"]');
    await this.waitForLoad();
  }

  /**
   * Filter gigs by date range
   * @param {Object} range - Date range
   * @param {string} [range.from] - Start date (ISO format)
   * @param {string} [range.to] - End date (ISO format)
   * @returns {Promise<void>}
   */
  async filterByDate(range) {
    if (range.from) {
      const fromInput = this.page.locator('[data-testid="gigs-filter-from"], [data-testid="date-from"]');
      if (await fromInput.count() > 0) {
        await fromInput.fill(range.from);
      }
    }
    if (range.to) {
      const toInput = this.page.locator('[data-testid="gigs-filter-to"], [data-testid="date-to"]');
      if (await toInput.count() > 0) {
        await toInput.fill(range.to);
      }
    }
    // Trigger filter (Enter key or apply button)
    const applyBtn = this.page.locator('[data-testid="gigs-filter-apply"], [data-testid="filter-apply"]');
    if (await applyBtn.count() > 0) {
      await applyBtn.click();
    } else {
      // Press Enter on one of the inputs
      const firstInput = this.page.locator('[data-testid="gigs-filter-from"], [data-testid="date-from"]').first();
      if (await firstInput.count() > 0) {
        await firstInput.press('Enter');
      }
    }
    await waitForNetworkIdle(this.page);
  }

  /**
   * Filter gigs by venue
   * @param {string} venue - Venue name to filter by
   * @returns {Promise<void>}
   */
  async filterByVenue(venue) {
    const venueInput = this.page.locator('[data-testid="gigs-filter-venue"], [data-testid="venue-filter"]');
    if (await venueInput.count() > 0) {
      await venueInput.fill(venue);
      await venueInput.press('Enter');
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Switch between list and calendar view
   * @param {'list'|'calendar'} view - View mode
   * @returns {Promise<void>}
   */
  async switchView(view) {
    const viewButton = this.page.locator(`[data-testid="gigs-view-${view}"]`);
    if (await viewButton.count() > 0) {
      await viewButton.click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Assert a gig is visible in the list
   * @param {string} name - Gig name
   * @param {string} [date] - Optional date to verify
   * @returns {Promise<void>}
   */
  async expectGigVisible(name, date) {
    const gigCard = this.page.locator(selectors.gigs.gigCard).filter({ hasText: name });
    await gigCard.waitFor({ state: 'visible', timeout: 10000 });
    
    if (date) {
      await expect(gigCard.locator(selectors.gigs.gigDate)).toContainText(date, { timeout: 5000 });
    }
  }

  /**
   * Assert a gig is NOT visible in the list
   * @param {string} name - Gig name
   * @returns {Promise<void>}
   */
  async expectGigNotVisible(name) {
    const gigCard = this.page.locator(selectors.gigs.gigCard).filter({ hasText: name });
    await gigCard.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Open gig detail page
   * @param {string} id - Gig ID
   * @returns {Promise<GigDetailPage>} GigDetailPage instance
   */
  async openGigDetail(id) {
    // Click view button for the gig
    const gigCard = this.page.locator(selectors.gigs.gigCard).filter({ has: this.page.locator(`[data-gig-id="${id}"]`) });
    
    if (await gigCard.count() > 0) {
      await gigCard.locator(selectors.gigs.viewButton).click();
    } else {
      // Navigate directly
      await this.page.goto(`/gigs/${id}`);
    }
    
    await this.waitForLoad();
    
    // Import dynamically to avoid circular dependency
    const { GigDetailPage } = await import('./GigDetailPage.js');
    return new GigDetailPage(this.page);
  }

  /**
   * Get all visible gig names
   * @returns {Promise<string[]>}
   */
  async getVisibleGigNames() {
    const names = await this.page.locator(selectors.gigs.gigName).allTextContents();
    return names.filter(n => n.trim().length > 0);
  }

  /**
   * Get count of visible gigs
   * @returns {Promise<number>}
   */
  async getGigCount() {
    return this.page.locator(selectors.gigs.gigCard).count();
  }

  /**
   * Get gig data from a card by ID
   * @param {string} id - Gig ID
   * @returns {Promise<{name: string, date: string, venue: string}|null>}
   */
  async getGigData(id) {
    const gigCard = this.page.locator(selectors.gigs.gigCard).filter({ has: this.page.locator(`[data-gig-id="${id}"]`) });
    
    if (await gigCard.count() === 0) {
      return null;
    }
    
    const name = (await gigCard.locator(selectors.gigs.gigName).textContent()) || '';
    const date = (await gigCard.locator(selectors.gigs.gigDate).textContent()) || '';
    const venue = (await gigCard.locator(selectors.gigs.gigVenue).textContent()) || '';
    
    return { name: name.trim(), date: date.trim(), venue: venue.trim() };
  }
}

// Import expect for assertions
import { expect } from '@playwright/test';