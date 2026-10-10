/**
 * GigDetailPage - Page object for the gig detail page
 * Handles setlist assignment, notes, bandmate invitations, and check-in
 */

import { BasePage } from './BasePage.js';
import { selectors } from '../utils/selectors.js';
import { waitForNetworkIdle } from '../utils/test-helpers.js';

/**
 * Page object for gig detail page
 * URL pattern: /gigs/:id
 */
export class GigDetailPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page, '/gigs/:id');
  }

  /**
   * Key selector that indicates the gig detail page is loaded
   * @type {string}
   */
  get keySelector() {
    return selectors.gigDetail.name;
  }

  /**
   * Get the gig name
   * @returns {Promise<string>}
   */
  async getName() {
    const nameEl = this.page.locator(selectors.gigDetail.name);
    await nameEl.waitFor({ state: 'visible', timeout: 5000 });
    return (await nameEl.textContent())?.trim() || '';
  }

  /**
   * Get the gig venue
   * @returns {Promise<string>}
   */
  async getVenue() {
    const venueEl = this.page.locator(selectors.gigDetail.venue);
    if (await venueEl.count() > 0) {
      return (await venueEl.textContent())?.trim() || '';
    }
    return '';
  }

  /**
   * Get the gig date
   * @returns {Promise<string>}
   */
  async getDate() {
    const dateEl = this.page.locator(selectors.gigDetail.date);
    if (await dateEl.count() > 0) {
      return (await dateEl.textContent())?.trim() || '';
    }
    return '';
  }

  /**
   * Assign a setlist to this gig
   * @param {string} setlistId - Setlist ID to assign
   * @returns {Promise<void>}
   */
  async assignSetlist(setlistId) {
    const setlistSelect = this.page.locator(selectors.gigDetail.setlist);
    await setlistSelect.waitFor({ state: 'visible', timeout: 5000 });
    await setlistSelect.selectOption(setlistId);
    await waitForNetworkIdle(this.page);
  }

  /**
   * Get the currently assigned setlist name
   * @returns {Promise<string>}
   */
  async getAssignedSetlist() {
    const setlistEl = this.page.locator(selectors.gigDetail.setlist);
    if (await setlistEl.count() > 0) {
      // Could be a select element or a display element
      const tagName = await setlistEl.evaluate(el => el.tagName.toLowerCase());
      if (tagName === 'select') {
        return (await setlistEl.locator('option:checked').textContent())?.trim() || '';
      }
      return (await setlistEl.textContent())?.trim() || '';
    }
    return '';
  }

  /**
   * Assert a specific setlist is linked to this gig
   * @param {string} name - Expected setlist name
   * @returns {Promise<void>}
   */
  async expectSetlistLinked(name) {
    const setlistEl = this.page.locator(selectors.gigDetail.setlist);
    await setlistEl.waitFor({ state: 'visible', timeout: 5000 });
    await expect(setlistEl).toContainText(name, { timeout: 5000 });
  }

  /**
   * Add or update gig notes
   * @param {string} text - Notes text
   * @returns {Promise<void>}
   */
  async addNote(text) {
    const notesEl = this.page.locator(selectors.gigDetail.notes);
    await notesEl.waitFor({ state: 'visible', timeout: 5000 });
    
    // Check if it's an input/textarea or a display element
    const tagName = await notesEl.evaluate(el => el.tagName.toLowerCase());
    if (tagName === 'textarea' || tagName === 'input') {
      await notesEl.fill(text);
    } else {
      // Click to edit if it's a display element
      await notesEl.click();
      await this.page.waitForSelector('[data-testid="gig-notes-input"], [data-testid="gig-notes-editor"]', { 
        state: 'visible', 
        timeout: 5000 
      });
      const editor = this.page.locator('[data-testid="gig-notes-input"], [data-testid="gig-notes-editor"]');
      await editor.fill(text);
      // Save if there's a save button
      const saveBtn = this.page.locator('[data-testid="gig-notes-save"], [data-testid="save-notes"]');
      if (await saveBtn.count() > 0) {
        await saveBtn.click();
      }
    }
    await waitForNetworkIdle(this.page);
  }

  /**
   * Get the current notes
   * @returns {Promise<string>}
   */
  async getNotes() {
    const notesEl = this.page.locator(selectors.gigDetail.notes);
    if (await notesEl.count() > 0) {
      return (await notesEl.textContent())?.trim() || '';
    }
    return '';
  }

  /**
   * Invite a bandmate to this gig
   * @param {string} email - Bandmate email
   * @returns {Promise<void>}
   */
  async inviteBandmate(email) {
    const inviteButton = this.page.locator('[data-testid="gig-invite-bandmate"], [data-testid="invite-bandmate-button"]');
    if (await inviteButton.count() > 0) {
      await inviteButton.click();
      
      // Wait for invite modal
      await this.page.waitForSelector('[data-testid="invite-modal"], [data-testid="bandmate-invite-form"]', { 
        state: 'visible', 
        timeout: 5000 
      });
      
      // Fill email
      await this.page.fill(selectors.bandmates.inviteEmail, email);
      
      // Select role if available
      const roleSelect = this.page.locator(selectors.bandmates.inviteRole);
      if (await roleSelect.count() > 0) {
        await roleSelect.selectOption('member'); // default role
      }
      
      // Submit invite
      await this.page.click(selectors.bandmates.inviteSubmit);
      await waitForNetworkIdle(this.page);
    } else {
      // Maybe invite is inline on the page
      await this.page.fill(selectors.bandmates.inviteEmail, email);
      await this.page.click(selectors.bandmates.inviteSubmit);
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Get list of invited/assigned bandmates
   * @returns {Promise<string[]>}
   */
  async getBandmates() {
    const bandmateElements = this.page.locator('[data-testid="gig-bandmate"], [data-testid="bandmate-row"], [data-testid="gig-detail-bandmates"] .bandmate');
    const emails = [];
    
    for (const el of await bandmateElements.all()) {
      const text = (await el.textContent())?.trim() || '';
      if (text) emails.push(text);
    }
    
    return emails;
  }

  /**
   * Assert specific bandmates are assigned to this gig
   * @param {string[]} emails - Expected bandmate emails
   * @returns {Promise<void>}
   */
  async expectBandmates(emails) {
    const bandmates = await this.getBandmates();
    for (const email of emails) {
      if (!bandmates.some(b => b.includes(email))) {
        throw new Error(`Expected bandmate ${email} not found. Current bandmates: ${bandmates.join(', ')}`);
      }
    }
  }

  /**
   * Remove a bandmate from this gig
   * @param {string} email - Bandmate email to remove
   * @returns {Promise<void>}
   */
  async removeBandmate(email) {
    const bandmateRow = this.page.locator('[data-testid="gig-bandmate"], [data-testid="bandmate-row"]').filter({ hasText: email });
    
    if (await bandmateRow.count() > 0) {
      const removeBtn = bandmateRow.locator(selectors.bandmates.removeButton);
      if (await removeBtn.count() > 0) {
        await removeBtn.click();
        // Confirm removal
        await this.page.click('[data-testid="modal-confirm"], [data-testid="confirm-remove"]');
        await waitForNetworkIdle(this.page);
      }
    }
  }

  /**
   * Check in to the gig (launch stage mode)
   * @returns {Promise<void>}
   */
  async checkIn() {
    const checkInBtn = this.page.locator(selectors.gigDetail.checkInButton);
    await checkInBtn.waitFor({ state: 'visible', timeout: 5000 });
    await checkInBtn.click();
    
    // Wait for navigation to stage mode
    await this.page.waitForURL('**/stage/**', { timeout: 10000 });
    await this.waitForLoad();
  }

  /**
   * Launch the setlist for this gig (opens stage mode)
   * @returns {Promise<void>}
   */
  async launchSetlist() {
    const launchBtn = this.page.locator(selectors.gigDetail.launchSetlistButton);
    await launchBtn.waitFor({ state: 'visible', timeout: 5000 });
    await launchBtn.click();
    
    // Wait for navigation to stage mode
    await this.page.waitForURL('**/stage/**', { timeout: 10000 });
    await this.waitForLoad();
  }

  /**
   * Share the gig (get share link or open share dialog)
   * @returns {Promise<string|null>} Share URL if available
   */
  async share() {
    const shareBtn = this.page.locator(selectors.gigDetail.shareButton);
    if (await shareBtn.count() > 0) {
      await shareBtn.click();
      await this.page.waitForSelector('[data-testid="share-dialog"], [data-testid="share-modal"]', { 
        state: 'visible', 
        timeout: 5000 
      });
      
      // Try to get the share URL
      const shareUrlInput = this.page.locator('[data-testid="share-url"], [data-testid="share-link"]');
      if (await shareUrlInput.count() > 0) {
        const url = await shareUrlInput.inputValue();
        // Close dialog
        await this.page.click('[data-testid="modal-close"], [data-testid="share-dialog-close"]');
        return url;
      }
    }
    return null;
  }

  /**
   * Get gig attachments
   * @returns {Promise<string[]>}
   */
  async getAttachments() {
    const attachmentsEl = this.page.locator(selectors.gigDetail.attachments);
    if (await attachmentsEl.count() === 0) {
      return [];
    }
    
    const links = await attachmentsEl.locator('a').all();
    const urls = [];
    for (const link of links) {
      const href = await link.getAttribute('href');
      if (href) urls.push(href);
    }
    return urls;
  }

  /**
   * Edit gig details (navigate to edit mode)
   * @returns {Promise<void>}
   */
  async edit() {
    const editBtn = this.page.locator('[data-testid="gig-edit-button"], [data-testid="edit-gig"]');
    await editBtn.waitFor({ state: 'visible', timeout: 5000 });
    await editBtn.click();
    await this.waitForLoad();
  }

  /**
   * Delete this gig from detail page
   * @returns {Promise<void>}
   */
  async delete() {
    const deleteBtn = this.page.locator('[data-testid="gig-delete-button"], [data-testid="delete-gig"]');
    await deleteBtn.waitFor({ state: 'visible', timeout: 5000 });
    await deleteBtn.click();
    
    // Confirm deletion in modal
    await this.page.click('[data-testid="modal-confirm"], [data-testid="confirm-delete"]');
    await this.waitForUrl('**/gigs', { timeout: 10000 });
    await this.waitForLoad();
  }

  /**
   * Go back to gigs list
   * @returns {Promise<void>}
   */
  async backToList() {
    await this.page.goto('/gigs');
    await this.waitForLoad();
  }

  /**
   * Get full gig state
   * @returns {Promise<{name: string, venue: string, date: string, setlist: string, notes: string, bandmates: string[]}>}
   */
  async getState() {
    const name = await this.getName();
    const venue = await this.getVenue();
    const date = await this.getDate();
    const setlist = await this.getAssignedSetlist();
    const notes = await this.getNotes();
    const bandmates = await this.getBandmates();
    
    return { name, venue, date, setlist, notes, bandmates };
  }
}

// Import expect for assertions
import { expect } from '@playwright/test';