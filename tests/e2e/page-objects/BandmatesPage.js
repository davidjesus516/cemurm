/**
 * BandmatesPage - Page object for the bandmates/collaborators management page
 * Handles inviting, accepting, removing bandmates, and role changes
 */

import { BasePage } from './BasePage.js';
import { selectors } from '../utils/selectors.js';
import { waitForNetworkIdle } from '../utils/test-helpers.js';

/**
 * Page object for bandmates page
 * URL pattern: /bandmates
 */
export class BandmatesPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page, '/bandmates');
  }

  /**
   * Key selector that indicates the bandmates page is loaded
   * @type {string}
   */
  get keySelector() {
    return selectors.bandmates.list;
  }

  /**
   * Invite a new bandmate
   * @param {string} email - Bandmate email
   * @param {string} [role='member'] - Role to assign (member, viewer, admin)
   * @returns {Promise<void>}
   */
  async invite(email, role = 'member') {
    // Click invite button
    const inviteBtn = this.page.locator(selectors.bandmates.inviteButton);
    await inviteBtn.waitFor({ state: 'visible', timeout: 5000 });
    await inviteBtn.click();
    
    // Wait for invite modal/form
    await this.page.waitForSelector('[data-testid="invite-modal"], [data-testid="bandmate-invite-form"]', { 
      state: 'visible', 
      timeout: 5000 
    });
    
    // Fill email
    await this.page.fill(selectors.bandmates.inviteEmail, email);
    
    // Select role
    const roleSelect = this.page.locator(selectors.bandmates.inviteRole);
    if (await roleSelect.count() > 0) {
      await roleSelect.selectOption(role);
    }
    
    // Submit invite
    await this.page.click(selectors.bandmates.inviteSubmit);
    await waitForNetworkIdle(this.page);
    
    // Wait for modal to close
    await this.page.waitForSelector('[data-testid="invite-modal"], [data-testid="bandmate-invite-form"]', { 
      state: 'hidden', 
      timeout: 5000 
    });
  }

  /**
   * Accept a bandmate invitation (via token/link)
   * @param {string} token - Invitation token
   * @returns {Promise<void>}
   */
  async acceptInvite(token) {
    // Navigate to accept invitation URL
    await this.page.goto(`/bandmates/accept/${token}`);
    await this.waitForLoad();
    
    // Click accept button if present
    const acceptBtn = this.page.locator('[data-testid="accept-invite"], [data-testid="invite-accept"]');
    if (await acceptBtn.count() > 0) {
      await acceptBtn.click();
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Remove a bandmate
   * @param {string} userId - Bandmate user ID
   * @returns {Promise<void>}
   */
  async removeBandmate(userId) {
    // Find the bandmate row
    const memberRow = this.page.locator(selectors.bandmates.memberRow).filter({ has: this.page.locator(`[data-user-id="${userId}"]`) });
    
    if (await memberRow.count() === 0) {
      // Try finding by email if we don't have data-user-id
      throw new Error(`Bandmate with ID ${userId} not found in list`);
    }
    
    // Click remove button
    await memberRow.locator(selectors.bandmates.removeButton).click();
    
    // Confirm removal in modal
    await this.page.click('[data-testid="modal-confirm"], [data-testid="confirm-remove"]');
    await waitForNetworkIdle(this.page);
    
    // Wait for row to disappear
    await memberRow.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Remove a bandmate by email
   * @param {string} email - Bandmate email
   * @returns {Promise<void>}
   */
  async removeBandmateByEmail(email) {
    const memberRow = this.page.locator(selectors.bandmates.memberRow).filter({ hasText: email });
    
    if (await memberRow.count() === 0) {
      throw new Error(`Bandmate with email ${email} not found in list`);
    }
    
    await memberRow.locator(selectors.bandmates.removeButton).click();
    await this.page.click('[data-testid="modal-confirm"], [data-testid="confirm-remove"]');
    await waitForNetworkIdle(this.page);
    await memberRow.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Change a bandmate's role
   * @param {string} userId - Bandmate user ID
   * @param {string} role - New role (member, viewer, admin)
   * @returns {Promise<void>}
   */
  async changeRole(userId, role) {
    const memberRow = this.page.locator(selectors.bandmates.memberRow).filter({ has: this.page.locator(`[data-user-id="${userId}"]`) });
    
    if (await memberRow.count() === 0) {
      throw new Error(`Bandmate with ID ${userId} not found in list`);
    }
    
    // Click role selector
    const roleSelect = memberRow.locator(selectors.bandmates.memberRole);
    await roleSelect.waitFor({ state: 'visible', timeout: 5000 });
    await roleSelect.selectOption(role);
    await waitForNetworkIdle(this.page);
  }

  /**
   * Change a bandmate's role by email
   * @param {string} email - Bandmate email
   * @param {string} role - New role (member, viewer, admin)
   * @returns {Promise<void>}
   */
  async changeRoleByEmail(email, role) {
    const memberRow = this.page.locator(selectors.bandmates.memberRow).filter({ hasText: email });
    
    if (await memberRow.count() === 0) {
      throw new Error(`Bandmate with email ${email} not found in list`);
    }
    
    const roleSelect = memberRow.locator(selectors.bandmates.memberRole);
    await roleSelect.waitFor({ state: 'visible', timeout: 5000 });
    await roleSelect.selectOption(role);
    await waitForNetworkIdle(this.page);
  }

  /**
   * Assert a bandmate is visible in the list with expected role
   * @param {string} email - Bandmate email
   * @param {string} [role] - Expected role (optional)
   * @returns {Promise<void>}
   */
  async expectBandmateVisible(email, role) {
    const memberRow = this.page.locator(selectors.bandmates.memberRow).filter({ hasText: email });
    await memberRow.waitFor({ state: 'visible', timeout: 10000 });
    
    if (role) {
      const roleEl = memberRow.locator(selectors.bandmates.memberRole);
      if (await roleEl.count() > 0) {
        const actualRole = await roleEl.inputValue().catch(() => roleEl.textContent());
        if (actualRole !== role) {
          throw new Error(`Expected role "${role}" for ${email}, got "${actualRole}"`);
        }
      }
    }
  }

  /**
   * Assert a bandmate is NOT visible in the list
   * @param {string} email - Bandmate email
   * @returns {Promise<void>}
   */
  async expectBandmateNotVisible(email) {
    const memberRow = this.page.locator(selectors.bandmates.memberRow).filter({ hasText: email });
    await memberRow.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Get all visible bandmates
   * @returns {Promise<Array<{email: string, role: string, userId: string}>>}
   */
  async getBandmates() {
    const rows = await this.page.locator(selectors.bandmates.memberRow).all();
    const bandmates = [];
    
    for (const row of rows) {
      const email = (await row.locator('[data-testid="bandmate-email"]').textContent())?.trim() 
        || (await row.textContent())?.trim() 
        || '';
      
      const roleEl = row.locator(selectors.bandmates.memberRole);
      let role = '';
      if (await roleEl.count() > 0) {
        role = (await roleEl.inputValue().catch(() => roleEl.textContent()))?.trim() || '';
      }
      
      const userId = (await row.getAttribute('data-user-id')) || '';
      
      if (email) {
        bandmates.push({ email, role, userId });
      }
    }
    
    return bandmates;
  }

  /**
   * Get count of visible bandmates
   * @returns {Promise<number>}
   */
  async getBandmateCount() {
    return this.page.locator(selectors.bandmates.memberRow).count();
  }

  /**
   * Search/filter bandmates
   * @param {string} query - Search query
   * @returns {Promise<void>}
   */
  async search(query) {
    const searchInput = this.page.locator('[data-testid="bandmates-search"], [data-testid="search-bandmates"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill(query);
      await searchInput.press('Enter');
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Filter bandmates by role
   * @param {string} role - Role to filter by
   * @returns {Promise<void>}
   */
  async filterByRole(role) {
    const filterSelect = this.page.locator('[data-testid="bandmates-filter-role"], [data-testid="role-filter"]');
    if (await filterSelect.count() > 0) {
      await filterSelect.selectOption(role);
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Get pending invitations
   * @returns {Promise<Array<{email: string, role: string, invitedAt: string}>>}
   */
  async getPendingInvitations() {
    const pendingRows = this.page.locator('[data-testid="pending-invitation"], [data-testid="invitation-row"]');
    const invitations = [];
    
    for (const row of await pendingRows.all()) {
      const email = (await row.locator('[data-testid="invitation-email"]').textContent())?.trim() || '';
      const role = (await row.locator('[data-testid="invitation-role"]').textContent())?.trim() || '';
      const invitedAt = (await row.locator('[data-testid="invitation-date"]').textContent())?.trim() || '';
      
      if (email) {
        invitations.push({ email, role, invitedAt });
      }
    }
    
    return invitations;
  }

  /**
   * Resend invitation
   * @param {string} email - Invitation email
   * @returns {Promise<void>}
   */
  async resendInvitation(email) {
    const invitationRow = this.page.locator('[data-testid="pending-invitation"], [data-testid="invitation-row"]').filter({ hasText: email });
    
    if (await invitationRow.count() > 0) {
      const resendBtn = invitationRow.locator('[data-testid="resend-invitation"], [data-testid="invite-resend"]');
      if (await resendBtn.count() > 0) {
        await resendBtn.click();
        await waitForNetworkIdle(this.page);
      }
    }
  }

  /**
   * Cancel invitation
   * @param {string} email - Invitation email
   * @returns {Promise<void>}
   */
  async cancelInvitation(email) {
    const invitationRow = this.page.locator('[data-testid="pending-invitation"], [data-testid="invitation-row"]').filter({ hasText: email });
    
    if (await invitationRow.count() > 0) {
      const cancelBtn = invitationRow.locator('[data-testid="cancel-invitation"], [data-testid="invite-cancel"]');
      if (await cancelBtn.count() > 0) {
        await cancelBtn.click();
        await this.page.click('[data-testid="modal-confirm"], [data-testid="confirm-cancel"]');
        await waitForNetworkIdle(this.page);
        await invitationRow.waitFor({ state: 'hidden', timeout: 5000 });
      }
    }
  }

  /**
   * Navigate to a bandmate's profile
   * @param {string} email - Bandmate email
   * @returns {Promise<void>}
   */
  async openBandmateProfile(email) {
    const memberRow = this.page.locator(selectors.bandmates.memberRow).filter({ hasText: email });
    
    if (await memberRow.count() > 0) {
      const profileLink = memberRow.locator('[data-testid="bandmate-profile"], a[href*="/profile/"]');
      if (await profileLink.count() > 0) {
        await profileLink.click();
        await this.waitForLoad();
      }
    }
  }
}

