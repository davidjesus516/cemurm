/**
 * SongsPage - Page object for the songs list/repertoire page
 */

import { BasePage } from './BasePage.js';
import { selectors } from '../utils/selectors.js';

/**
 * Page object for songs list page
 */
export class SongsPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page, '/songs');
  }

  /**
   * Key selector that indicates the songs page is loaded
   * @type {string}
   */
  get keySelector() {
    return selectors.songs.list;
  }

  /**
   * Create a new song via the UI
   * @param {Object} data - Song data
   * @param {string} data.chordpro - ChordPro content
   * @param {string} [data.title] - Optional title (extracted from chordpro if not provided)
   * @param {string} [data.artist] - Optional artist
   * @returns {Promise<string>} Created song ID
   */
  async createSong(data) {
    // Click create button
    await this.page.click(selectors.songs.createButton);
    
    // Wait for modal or navigation to editor
    await this.page.waitForSelector('[data-testid="song-editor"], [data-testid="chordpro-editor"]', { 
      state: 'visible', 
      timeout: 10000 
    });

    // Fill the ChordPro editor
    const editor = this.page.locator('[data-testid="chordpro-editor"], [data-testid="song-editor"]');
    await editor.fill(data.chordpro);

    // Save the song
    await this.page.click('[data-testid="song-save"], [data-testid="editor-save"]');
    
    // Wait for redirect back to list or detail page
    await this.waitForLoad();

    // Extract song ID from URL if on detail page, otherwise from list
    const url = this.getCurrentUrl();
    const match = url.match(/\/songs\/([a-f0-9-]+)/);
    if (match) {
      return match[1];
    }

    // If back on list, find the newly created song
    if (data.title) {
      const songRow = this.page.locator(selectors.songs.songRow).filter({ hasText: data.title });
      await songRow.waitFor({ state: 'visible', timeout: 5000 });
      // Try to get ID from data attribute
      const id = await songRow.getAttribute('data-song-id');
      return id;
    }

    return null;
  }

  /**
   * Edit an existing song
   * @param {string} id - Song ID
   * @param {Object} data - Updated song data
   * @param {string} data.chordpro - Updated ChordPro content
   * @returns {Promise<void>}
   */
  async editSong(id, data) {
    // Open song detail first
    await this.openSongDetail(id);
    
    // Click edit button on detail page
    await this.page.click('[data-testid="song-edit-button"], [data-testid="edit-song"]');
    
    // Wait for editor
    await this.page.waitForSelector('[data-testid="chordpro-editor"], [data-testid="song-editor"]', { 
      state: 'visible', 
      timeout: 5000 
    });

    // Fill updated content
    const editor = this.page.locator('[data-testid="chordpro-editor"], [data-testid="song-editor"]');
    await editor.fill(data.chordpro);

    // Save
    await this.page.click('[data-testid="song-save"], [data-testid="editor-save"]');
    await this.waitForLoad();
  }

  /**
   * Delete a song
   * @param {string} id - Song ID
   * @returns {Promise<void>}
   */
  async deleteSong(id) {
    // Find the song row
    const songRow = this.page.locator(selectors.songs.songRow).filter({ has: this.page.locator(`[data-song-id="${id}"]`) });
    
    if (await songRow.count() === 0) {
      // Try finding by title if we don't have data-song-id
      // Open song detail to get title first
      const detailPage = await this.openSongDetail(id);
      const title = await detailPage.getTitle();
      
      const rowByTitle = this.page.locator(selectors.songs.songRow).filter({ hasText: title });
      if (await rowByTitle.count() > 0) {
        await rowByTitle.locator(selectors.songs.deleteButton).click();
      } else {
        throw new Error(`Song with ID ${id} not found in list`);
      }
    } else {
      await songRow.locator(selectors.songs.deleteButton).click();
    }

    // Confirm deletion in modal
    await this.page.click('[data-testid="modal-confirm"], [data-testid="confirm-delete"]');
    await this.waitForLoad();
  }

  /**
   * Search for songs
   * @param {string} query - Search query
   * @returns {Promise<void>}
   */
  async search(query) {
    await this.page.fill(selectors.songs.searchInput, query);
    await this.page.press(selectors.songs.searchInput, 'Enter');
    await this.waitForNetworkIdle(this.page);
  }

  /**
   * Filter songs by genre
   * @param {string} genre - Genre to filter by
   * @returns {Promise<void>}
   */
  async filterByGenre(genre) {
    await this.page.selectOption(selectors.songs.filterGenre, genre);
    await this.waitForNetworkIdle(this.page);
  }

  /**
   * Filter songs by key
   * @param {string} key - Key to filter by
   * @returns {Promise<void>}
   */
  async filterByKey(key) {
    await this.page.selectOption(selectors.songs.filterKey, key);
    await this.waitForNetworkIdle(this.page);
  }

  /**
   * Assert a song is visible in the list
   * @param {string} title - Song title
   * @returns {Promise<void>}
   */
  async expectSongVisible(title) {
    const songRow = this.page.locator(selectors.songs.songRow).filter({ hasText: title });
    await songRow.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Assert a song is NOT visible in the list
   * @param {string} title - Song title
   * @returns {Promise<void>}
   */
  async expectSongNotVisible(title) {
    const songRow = this.page.locator(selectors.songs.songRow).filter({ hasText: title });
    await songRow.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Open song detail page
   * @param {string} id - Song ID
   * @returns {Promise<SongDetailPage>} SongDetailPage instance
   */
  async openSongDetail(id) {
    // Click view button for the song
    const songRow = this.page.locator(selectors.songs.songRow).filter({ has: this.page.locator(`[data-song-id="${id}"]`) });
    
    if (await songRow.count() > 0) {
      await songRow.locator(selectors.songs.viewButton).click();
    } else {
      // Navigate directly
      await this.page.goto(`/songs/${id}`);
    }
    
    await this.waitForLoad();
    
    // Import dynamically to avoid circular dependency
    const { SongDetailPage } = await import('./SongDetailPage.js');
    return new SongDetailPage(this.page);
  }

  /**
   * Get all visible song titles
   * @returns {Promise<string[]>}
   */
  async getVisibleSongTitles() {
    const titles = await this.page.locator(selectors.songs.songTitle).allTextContents();
    return titles.filter(t => t.trim().length > 0);
  }

  /**
   * Get count of visible songs
   * @returns {Promise<number>}
   */
  async getSongCount() {
    return this.page.locator(selectors.songs.songRow).count();
  }
}