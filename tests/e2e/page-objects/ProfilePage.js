/**
 * ProfilePage - Page object for user profile management
 * Handles profile editing, password changes, session management, and viewing other users' profiles
 */

import { BasePage } from './BasePage.js';
import { selectors } from '../utils/selectors.js';
import { waitForNetworkIdle } from '../utils/test-helpers.js';

/**
 * Page object for profile page
 * URL pattern: /profile or /profile/:userId
 */
export class ProfilePage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} [userId] - Optional user ID for viewing another user's profile
   */
  constructor(page, userId = '') {
    const url = userId ? `/profile/${userId}` : '/profile';
    super(page, url);
    this.userId = userId;
  }

  /**
   * Key selector that indicates the profile page is loaded
   * @type {string}
   */
  get keySelector() {
    return selectors.profile.displayName;
  }

  /**
   * Edit the current user's profile
   * @param {Object} data - Profile data
   * @param {string} [data.displayName] - Display name
   * @param {string} [data.bio] - Bio/description
   * @param {string} [data.instrument] - Primary instrument
   * @param {string} [data.avatarUrl] - Avatar image URL
   * @returns {Promise<void>}
   */
  async editProfile(data) {
    // Click edit profile button
    const editBtn = this.page.locator(selectors.profile.settingsButton);
    if (await editBtn.count() > 0) {
      await editBtn.click();
    } else {
      // Try direct edit link/button
      const directEdit = this.page.locator('[data-testid="edit-profile"], [data-testid="profile-edit"]');
      if (await directEdit.count() > 0) {
        await directEdit.click();
      }
    }

    // Wait for edit form/modal
    await this.page.waitForSelector('[data-testid="profile-edit-form"], [data-testid="profile-form"]', { 
      state: 'visible', 
      timeout: 5000 
    });

    // Fill form fields
    if (data.displayName) {
      await this.page.fill('[data-testid="profile-display-name-input"], [data-testid="display-name-input"]', data.displayName);
    }
    if (data.bio) {
      await this.page.fill('[data-testid="profile-bio-input"], [data-testid="bio-input"]', data.bio);
    }
    if (data.instrument) {
      const instrumentSelect = this.page.locator('[data-testid="profile-instrument-input"], [data-testid="instrument-select"]');
      if (await instrumentSelect.count() > 0) {
        await instrumentSelect.selectOption(data.instrument);
      }
    }
    if (data.avatarUrl) {
      const avatarInput = this.page.locator('[data-testid="profile-avatar-input"], [data-testid="avatar-upload"]');
      if (await avatarInput.count() > 0) {
        await avatarInput.setInputFiles(data.avatarUrl); // For file upload
        // Or if it's a URL input:
        // await avatarInput.fill(data.avatarUrl);
      }
    }

    // Save changes
    await this.page.click('[data-testid="profile-save"], [data-testid="profile-form-submit"], [data-testid="modal-confirm"]');
    await waitForNetworkIdle(this.page);
    await this.waitForLoad();
  }

  /**
   * Change the current user's password
   * @param {string} oldPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<void>}
   */
  async changePassword(oldPassword, newPassword) {
    // Navigate to password change section or open modal
    const changePasswordBtn = this.page.locator('[data-testid="change-password"], [data-testid="profile-change-password"]');
    if (await changePasswordBtn.count() > 0) {
      await changePasswordBtn.click();
    } else {
      // Try settings navigation
      await this.page.click(selectors.profile.settingsButton);
      await this.page.waitForSelector('[data-testid="password-change-form"]', { state: 'visible', timeout: 5000 });
    }

    // Fill password change form
    await this.page.fill('[data-testid="current-password"], [data-testid="old-password"]', oldPassword);
    await this.page.fill('[data-testid="new-password"], [data-testid="password-new"]', newPassword);
    await this.page.fill('[data-testid="confirm-new-password"], [data-testid="password-confirm"]', newPassword);

    // Submit
    await this.page.click('[data-testid="password-save"], [data-testid="password-change-submit"], [data-testid="modal-confirm"]');
    await waitForNetworkIdle(this.page);
    await this.waitForLoad();
  }

  /**
   * Manage active sessions (view and revoke)
   * @returns {Promise<Array<{id: string, device: string, lastActive: string, current: boolean}>>}
   */
  async manageSessions() {
    // Navigate to sessions section
    const sessionsBtn = this.page.locator('[data-testid="manage-sessions"], [data-testid="profile-sessions"]');
    if (await sessionsBtn.count() > 0) {
      await sessionsBtn.click();
      await this.page.waitForSelector('[data-testid="sessions-list"]', { state: 'visible', timeout: 5000 });
    }

    // Get all sessions
    const sessionRows = await this.page.locator('[data-testid="session-row"]').all();
    const sessions = [];

    for (const row of sessionRows) {
      const id = (await row.getAttribute('data-session-id')) || '';
      const device = (await row.locator('[data-testid="session-device"]').textContent())?.trim() || '';
      const lastActive = (await row.locator('[data-testid="session-last-active"]').textContent())?.trim() || '';
      const isCurrent = (await row.locator('[data-testid="session-current"]').count()) > 0;
      
      sessions.push({ id, device, lastActive, current: isCurrent });
    }

    return sessions;
  }

  /**
   * Revoke a specific session
   * @param {string} sessionId - Session ID to revoke
   * @returns {Promise<void>}
   */
  async revokeSession(sessionId) {
    const sessionRow = this.page.locator('[data-testid="session-row"]').filter({ has: this.page.locator(`[data-session-id="${sessionId}"]`) });
    
    if (await sessionRow.count() > 0) {
      const revokeBtn = sessionRow.locator('[data-testid="revoke-session"], [data-testid="session-revoke"]');
      await revokeBtn.click();
      
      // Confirm revocation
      await this.page.click('[data-testid="modal-confirm"], [data-testid="confirm-revoke"]');
      await waitForNetworkIdle(this.page);
      
      // Wait for session to disappear
      await sessionRow.waitFor({ state: 'hidden', timeout: 5000 });
    }
  }

  /**
   * Revoke all other sessions (keep current)
   * @returns {Promise<void>}
   */
  async revokeAllOtherSessions() {
    const revokeAllBtn = this.page.locator('[data-testid="revoke-all-sessions"], [data-testid="revoke-other-sessions"]');
    if (await revokeAllBtn.count() > 0) {
      await revokeAllBtn.click();
      await this.page.click('[data-testid="modal-confirm"], [data-testid="confirm-revoke-all"]');
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Assert profile data matches expected values
   * @param {Object} expected - Expected profile data
   * @param {string} [expected.displayName] - Expected display name
   * @param {string} [expected.username] - Expected username
   * @param {string} [expected.instrument] - Expected instrument
   * @param {string} [expected.bio] - Expected bio
   * @param {number} [expected.songCount] - Expected song count
   * @param {number} [expected.setlistCount] - Expected setlist count
   * @param {number} [expected.followerCount] - Expected follower count
   * @param {number} [expected.followingCount] - Expected following count
   * @returns {Promise<void>}
   */
  async expectProfileData(expected) {
    if (expected.displayName) {
      await expect(this.page.locator(selectors.profile.displayName)).toHaveText(expected.displayName, { timeout: 5000 });
    }
    
    if (expected.username) {
      await expect(this.page.locator(selectors.profile.username)).toHaveText(expected.username, { timeout: 5000 });
    }
    
    if (expected.instrument) {
      await expect(this.page.locator(selectors.profile.instrument)).toHaveText(expected.instrument, { timeout: 5000 });
    }
    
    if (expected.bio) {
      const bioEl = this.page.locator('[data-testid="profile-bio"], [data-testid="bio"]');
      if (await bioEl.count() > 0) {
        await expect(bioEl).toHaveText(expected.bio, { timeout: 5000 });
      }
    }

    // Check stats if provided
    if (expected.songCount !== undefined) {
      const songCount = this.page.locator('[data-testid="profile-song-count"], [data-testid="stat-songs"]');
      if (await songCount.count() > 0) {
        const text = await songCount.textContent();
        const count = parseInt(text?.match(/\d+/)?.[0] ?? '0', 10);
        if (count !== expected.songCount) {
          throw new Error(`Expected song count ${expected.songCount}, got ${count}`);
        }
      }
    }

    if (expected.setlistCount !== undefined) {
      const setlistCount = this.page.locator('[data-testid="profile-setlist-count"], [data-testid="stat-setlists"]');
      if (await setlistCount.count() > 0) {
        const text = await setlistCount.textContent();
        const count = parseInt(text?.match(/\d+/)?.[0] ?? '0', 10);
        if (count !== expected.setlistCount) {
          throw new Error(`Expected setlist count ${expected.setlistCount}, got ${count}`);
        }
      }
    }

    if (expected.followerCount !== undefined) {
      const followerCount = this.page.locator('[data-testid="profile-followers"], [data-testid="stat-followers"]');
      if (await followerCount.count() > 0) {
        const text = await followerCount.textContent();
        const count = parseInt(text?.match(/\d+/)?.[0] ?? '0', 10);
        if (count !== expected.followerCount) {
          throw new Error(`Expected follower count ${expected.followerCount}, got ${count}`);
        }
      }
    }

    if (expected.followingCount !== undefined) {
      const followingCount = this.page.locator('[data-testid="profile-following"], [data-testid="stat-following"]');
      if (await followingCount.count() > 0) {
        const text = await followingCount.textContent();
        const count = parseInt(text?.match(/\d+/)?.[0] ?? '0', 10);
        if (count !== expected.followingCount) {
          throw new Error(`Expected following count ${expected.followingCount}, got ${count}`);
        }
      }
    }
  }

  /**
   * Follow another user
   * @returns {Promise<void>}
   */
  async followUser() {
    const followBtn = this.page.locator('[data-testid="follow-user"], [data-testid="profile-follow"]');
    if (await followBtn.count() > 0) {
      await followBtn.click();
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Unfollow a user
   * @returns {Promise<void>}
   */
  async unfollowUser() {
    const unfollowBtn = this.page.locator('[data-testid="unfollow-user"], [data-testid="profile-unfollow"]');
    if (await unfollowBtn.count() > 0) {
      await unfollowBtn.click();
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Assert user is followed
   * @returns {Promise<void>}
   */
  async expectFollowed() {
    const unfollowBtn = this.page.locator('[data-testid="unfollow-user"], [data-testid="profile-unfollow"]');
    
    // If unfollow button is visible, user is followed
    const isFollowed = await unfollowBtn.count() > 0 && await unfollowBtn.isVisible();
    if (!isFollowed) {
      throw new Error('Expected user to be followed');
    }
  }

  /**
   * Assert user is not followed
   * @returns {Promise<void>}
   */
  async expectNotFollowed() {
    const unfollowBtn = this.page.locator('[data-testid="unfollow-user"], [data-testid="profile-unfollow"]');
    
    // If unfollow button is visible, user is followed
    const isFollowed = await unfollowBtn.count() > 0 && await unfollowBtn.isVisible();
    if (isFollowed) {
      throw new Error('Expected user to not be followed');
    }
  }

  /**
   * Get reputation score breakdown
   * @returns {Promise<{total: number, contributions: number, follows: number, ratings: number}|null>}
   */
  async getReputation() {
    const reputationEl = this.page.locator('[data-testid="profile-reputation"], [data-testid="reputation-score"]');
    if (await reputationEl.count() === 0) {
      return null;
    }

    const totalText = await reputationEl.textContent();
    const total = parseInt(totalText?.match(/\d+/)?.[0] ?? '0', 10);

    // Try to get breakdown
    const breakdown = this.page.locator('[data-testid="reputation-breakdown"]');
    let contributions = 0, follows = 0, ratings = 0;
    
    if (await breakdown.count() > 0) {
      const contribText = (await breakdown.locator('[data-testid="rep-contributions"]').textContent()) || '';
      const followsText = (await breakdown.locator('[data-testid="rep-follows"]').textContent()) || '';
      const ratingsText = (await breakdown.locator('[data-testid="rep-ratings"]').textContent()) || '';
      
      contributions = parseInt(contribText.match(/\d+/)?.[0] ?? '0', 10);
      follows = parseInt(followsText.match(/\d+/)?.[0] ?? '0', 10);
      ratings = parseInt(ratingsText.match(/\d+/)?.[0] ?? '0', 10);
    }

    return { total, contributions, follows, ratings };
  }

  /**
   * Assert reputation score matches expected
   * @param {number} expectedScore - Expected total reputation score
   * @returns {Promise<void>}
   */
  async expectReputation(expectedScore) {
    const reputation = await this.getReputation();
    if (!reputation) {
      throw new Error('Reputation not found on profile');
    }
    
    if (reputation.total !== expectedScore) {
      throw new Error(`Expected reputation ${expectedScore}, got ${reputation.total}`);
    }
  }

  /**
   * View user's repertoire (songs)
   * @returns {Promise<string[]>} Song titles
   */
  async getRepertoire() {
    const repertoireSection = this.page.locator(selectors.profile.repertoire);
    if (await repertoireSection.count() === 0) {
      return [];
    }

    const songTitles = await repertoireSection.locator('[data-testid="song-title"], [data-testid="repertoire-song"]').allTextContents();
    return songTitles.map(t => t.trim()).filter(t => t.length > 0);
  }

  /**
   * View followed artists
   * @returns {Promise<string[]>} Artist names
   */
  async getFollowedArtists() {
    const followedSection = this.page.locator(selectors.profile.followedArtists);
    if (await followedSection.count() === 0) {
      return [];
    }

    const artistNames = await followedSection.locator('[data-testid="followed-artist"], [data-testid="artist-name"]').allTextContents();
    return artistNames.map(t => t.trim()).filter(t => t.length > 0);
  }

  /**
   * Navigate to settings page
   * @returns {Promise<void>}
   */
  async openSettings() {
    await this.page.click(selectors.profile.settingsButton);
    await this.waitForUrl('**/settings');
    await this.waitForLoad();
  }

  /**
   * Check if this is the current user's profile
   * @returns {Promise<boolean>}
   */
  async isOwnProfile() {
    // Own profile has edit button, other profiles have follow button
    const editBtn = this.page.locator('[data-testid="edit-profile"], [data-testid="profile-edit"]');
    return (await editBtn.count()) > 0;
  }

  /**
   * Get display name from profile
   * @returns {Promise<string>}
   */
  async getDisplayName() {
    const el = this.page.locator(selectors.profile.displayName);
    return (await el.textContent())?.trim() || '';
  }

  /**
   * Get username from profile
   * @returns {Promise<string>}
   */
  async getUsername() {
    const el = this.page.locator(selectors.profile.username);
    return (await el.textContent())?.trim() || '';
  }
}

// Import expect for assertions
import { expect } from '@playwright/test';