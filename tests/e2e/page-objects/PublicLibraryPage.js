/**
 * PublicLibraryPage - Page object for the public song library
 * Handles browsing, searching, filtering, and importing songs from the community library
 */

import { BasePage } from './BasePage.js';
import { selectors } from '../utils/selectors.js';
import { waitForNetworkIdle } from '../utils/test-helpers.js';

/**
 * Page object for public library page
 * URL pattern: /library
 */
export class PublicLibraryPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page, '/library');
  }

  /**
   * Key selector that indicates the library page is loaded
   * @type {string}
   */
  get keySelector() {
    return selectors.library.grid;
  }

  /**
   * Search the library for songs
   * @param {string} query - Search query
   * @returns {Promise<void>}
   */
  async search(query) {
    await this.page.fill(selectors.library.searchInput, query);
    await this.page.press(selectors.library.searchInput, 'Enter');
    await waitForNetworkIdle(this.page);
  }

  /**
   * Filter library by genre
   * @param {string} genre - Genre to filter by
   * @returns {Promise<void>}
   */
  async filterByGenre(genre) {
    const filterSelect = this.page.locator(selectors.library.filterGenre);
    if (await filterSelect.count() > 0) {
      await filterSelect.selectOption(genre);
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Filter library by key
   * @param {string} key - Key to filter by
   * @returns {Promise<void>}
   */
  async filterByKey(key) {
    const filterSelect = this.page.locator(selectors.library.filterKey);
    if (await filterSelect.count() > 0) {
      await filterSelect.selectOption(key);
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Filter library by difficulty
   * @param {string} difficulty - Difficulty level to filter by
   * @returns {Promise<void>}
   */
  async filterByDifficulty(difficulty) {
    const filterSelect = this.page.locator(selectors.library.filterDifficulty);
    if (await filterSelect.count() > 0) {
      await filterSelect.selectOption(difficulty);
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Filter library by license
   * @param {string} license - License type to filter by
   * @returns {Promise<void>}
   */
  async filterByLicense(license) {
    const filterSelect = this.page.locator(selectors.library.filterLicense);
    if (await filterSelect.count() > 0) {
      await filterSelect.selectOption(license);
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Clear all active filters
   * @returns {Promise<void>}
   */
  async clearFilters() {
    const clearBtn = this.page.locator('[data-testid="library-clear-filters"], [data-testid="clear-all-filters"]');
    if (await clearBtn.count() > 0) {
      await clearBtn.click();
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Assert a song is visible in the library
   * @param {string} title - Song title
   * @param {string} [artist] - Optional artist name
   * @returns {Promise<void>}
   */
  async expectSongInLibrary(title, artist) {
    const songCard = this.page.locator(selectors.library.songCard).filter({ hasText: title });
    await songCard.waitFor({ state: 'visible', timeout: 10000 });
    
    if (artist) {
      await expect(songCard.locator('[data-testid="library-song-artist"]')).toContainText(artist, { timeout: 5000 });
    }
  }

  /**
   * Assert a song is NOT visible in the library
   * @param {string} title - Song title
   * @returns {Promise<void>}
   */
  async expectSongNotInLibrary(title) {
    const songCard = this.page.locator(selectors.library.songCard).filter({ hasText: title });
    await songCard.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Import a song from the library to user's repertoire
   * @param {string} songId - Song ID to import
   * @returns {Promise<void>}
   */
  async importSong(songId) {
    // Find the song card and click import button
    const songCard = this.page.locator(selectors.library.songCard).filter({ has: this.page.locator(`[data-song-id="${songId}"]`) });
    
    if (await songCard.count() === 0) {
      // Try navigating directly to song detail if it has one
      await this.page.goto(`/library/songs/${songId}`);
      await this.waitForLoad();
      
      // Click import from detail page
      const importBtn = this.page.locator(selectors.library.importButton);
      await importBtn.waitFor({ state: 'visible', timeout: 5000 });
      await importBtn.click();
    } else {
      await songCard.locator(selectors.library.importButton).click();
    }
    
    // Wait for import confirmation/modal
    await this.waitForLoad();
    await waitForNetworkIdle(this.page);
  }

  /**
   * Assert import was successful
   * @returns {Promise<void>}
   */
  async expectImportSuccess() {
    // Look for success toast or confirmation message
    const successMsg = this.page.locator(selectors.common.successMessage);
    await successMsg.waitFor({ state: 'visible', timeout: 10000 });
    
    const text = await successMsg.textContent();
    if (!text?.toLowerCase().includes('import')) {
      throw new Error(`Expected import success message, got: ${text}`);
    }
  }

  /**
   * Get all visible song titles in the library
   * @returns {Promise<string[]>}
   */
  async getVisibleSongTitles() {
    const titles = await this.page.locator('[data-testid="library-song-title"]').allTextContents();
    return titles.filter(t => t.trim().length > 0);
  }

  /**
   * Get count of visible songs in the library
   * @returns {Promise<number>}
   */
  async getSongCount() {
    return this.page.locator(selectors.library.songCard).count();
  }

  /**
   * Click on a song to view its detail page
   * @param {string} songId - Song ID
   * @returns {Promise<void>}
   */
  async openSongDetail(songId) {
    const songCard = this.page.locator(selectors.library.songCard).filter({ has: this.page.locator(`[data-song-id="${songId}"]`) });
    
    if (await songCard.count() > 0) {
      await songCard.locator('[data-testid="library-song-view"], [data-testid="song-card-link"]').click();
    } else {
      await this.page.goto(`/library/songs/${songId}`);
    }
    
    await this.waitForLoad();
  }

  /**
   * Get song data from a card by ID
   * @param {string} songId - Song ID
   * @returns {Promise<{title: string, artist: string, key: string, genre: string}|null>}
   */
  async getSongData(songId) {
    const songCard = this.page.locator(selectors.library.songCard).filter({ has: this.page.locator(`[data-song-id="${songId}"]`) });
    
    if (await songCard.count() === 0) {
      return null;
    }
    
    const title = (await songCard.locator('[data-testid="library-song-title"]').textContent())?.trim() || '';
    const artist = (await songCard.locator('[data-testid="library-song-artist"]').textContent())?.trim() || '';
    const key = (await songCard.locator('[data-testid="library-song-key"]').textContent())?.trim() || '';
    const genre = (await songCard.locator('[data-testid="library-song-genre"]').textContent())?.trim() || '';
    
    return { title, artist, key, genre };
  }

  /**
   * Navigate to next page of results (pagination)
   * @returns {Promise<void>}
   */
  async nextPage() {
    const nextBtn = this.page.locator('[data-testid="pagination-next"], [data-testid="library-pagination-next"]');
    if (await nextBtn.count() > 0 && await nextBtn.isEnabled()) {
      await nextBtn.click();
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Navigate to previous page of results (pagination)
   * @returns {Promise<void>}
   */
  async previousPage() {
    const prevBtn = this.page.locator('[data-testid="pagination-prev"], [data-testid="library-pagination-prev"]');
    if (await prevBtn.count() > 0 && await prevBtn.isEnabled()) {
      await prevBtn.click();
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Get current page number
   * @returns {Promise<number>}
   */
  async getCurrentPage() {
    const pageIndicator = this.page.locator('[data-testid="pagination-current"], [data-testid="library-page-current"]');
    if (await pageIndicator.count() > 0) {
      const text = await pageIndicator.textContent();
      return parseInt(text?.match(/\d+/)?.[0] ?? '1', 10);
    }
    return 1;
  }

  /**
   * Contribute a song to the public library (submit for review)
   * @param {string} songId - Song ID to contribute
   * @returns {Promise<void>}
   */
  async contributeSong(songId) {
    // Navigate to my songs first to find the song
    await this.page.goto('/songs');
    await this.waitForLoad();
    
    // Find song and click contribute
    const { SongsPage } = await import('./SongsPage.js');
    const songsPage = new SongsPage(this.page);
    await songsPage.openSongDetail(songId);
    
    // On song detail, click contribute to library
    const contributeBtn = this.page.locator('[data-testid="contribute-to-library"], [data-testid="song-contribute"]');
    if (await contributeBtn.count() > 0) {
      await contributeBtn.click();
      
      // Confirm contribution in modal
      await this.page.waitForSelector('[data-testid="contribute-modal"], [data-testid="modal"]', { state: 'visible', timeout: 5000 });
      await this.page.click(selectors.common.modalConfirm);
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Assert contribution appears in user's contributions
   * @returns {Promise<void>}
   */
  async expectContributionVisible() {
    // Navigate to profile to check contributions
    await this.page.goto('/profile');
    await this.waitForLoad();
    
    const contributionsSection = this.page.locator('[data-testid="profile-contributions"], [data-testid="user-contributions"]');
    await contributionsSection.waitFor({ state: 'visible', timeout: 10000 });
  }
}

// Import expect for assertions
import { expect } from '@playwright/test';