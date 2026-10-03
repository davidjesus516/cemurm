/**
 * SongDetailPage - Page object for individual song detail/view/edit page
 */

import { BasePage } from './BasePage.js';
import { selectors } from '../utils/selectors.js';
import { ChordRenderer } from './components/ChordRenderer.js';

/**
 * Page object for song detail page
 */
export class SongDetailPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page, '/songs/:id');
  }

  /**
   * Key selector that indicates the song detail page is loaded
   * @type {string}
   */
  get keySelector() {
    return selectors.songDetail.title;
  }

  /**
   * ChordRenderer component object for chord sheet interactions
   * @type {ChordRenderer}
   */
  get chordRenderer() {
    if (!this._chordRenderer) {
      this._chordRenderer = new ChordRenderer(this.page);
    }
    return this._chordRenderer;
  }

  /**
   * Assert song metadata matches expected values
   * @param {Object} metadata - Expected metadata
   * @param {string} [metadata.title] - Song title
   * @param {string} [metadata.artist] - Artist name
   * @param {string} [metadata.key] - Musical key
   * @param {number} [metadata.tempo] - Tempo in BPM
   * @param {string[]} [metadata.tags] - Tags
   * @returns {Promise<void>}
   */
  async expectMetadata(metadata) {
    if (metadata.title) {
      await expect(this.page.locator(selectors.songDetail.title)).toHaveText(metadata.title);
    }
    if (metadata.artist) {
      await expect(this.page.locator(selectors.songDetail.artist)).toHaveText(metadata.artist);
    }
    if (metadata.key) {
      await expect(this.page.locator(selectors.songDetail.key)).toHaveText(metadata.key);
    }
    // Tempo might be in a different element
    if (metadata.tempo) {
      const tempoEl = this.page.locator('[data-testid="song-tempo"], [data-testid="tempo-display"]');
      await expect(tempoEl).toContainText(metadata.tempo.toString());
    }
  }

  /**
   * Edit song metadata
   * @param {Object} data - Metadata to update
   * @returns {Promise<void>}
   */
  async editMetadata(data) {
    // Click edit button
    await this.page.click('[data-testid="song-edit-button"], [data-testid="edit-song-metadata"]');
    
    // Wait for edit form
    await this.page.waitForSelector('[data-testid="song-edit-form"]', { state: 'visible', timeout: 5000 });

    if (data.title) {
      await this.page.fill('[data-testid="edit-title"]', data.title);
    }
    if (data.artist) {
      await this.page.fill('[data-testid="edit-artist"]', data.artist);
    }
    if (data.key) {
      await this.page.selectOption('[data-testid="edit-key"]', data.key);
    }
    if (data.tempo) {
      await this.page.fill('[data-testid="edit-tempo"]', data.tempo.toString());
    }
    if (data.tags) {
      // Handle tags input (could be multi-select or comma-separated)
      const tagsInput = this.page.locator('[data-testid="edit-tags"]');
      if (await tagsInput.count() > 0) {
        await tagsInput.fill(data.tags.join(', '));
      }
    }

    // Save
    await this.page.click('[data-testid="edit-save"], [data-testid="song-save"]');
    await this.waitForLoad();
  }

  /**
   * Transpose the song by semitones
   * @param {number} steps - Number of semitones (positive or negative)
   * @returns {Promise<void>}
   */
  async transpose(steps) {
    return this.chordRenderer.setTranspose(steps);
  }

  /**
   * Toggle annotations visibility
   * @returns {Promise<void>}
   */
  async toggleAnnotations() {
    await this.page.click(selectors.songDetail.annotationButton);
    await this.waitForNetworkIdle(this.page);
  }

  /**
   * Assert chords are rendered correctly
   * @param {string[]} [expectedChords] - Optional array of expected chord symbols
   * @returns {Promise<void>}
   */
  async expectChordsRendered(expectedChords) {
    await this.chordRenderer.expectChordsVisible();
    
    if (expectedChords) {
      const renderedChords = await this.chordRenderer.getRenderedChords();
      for (const chord of expectedChords) {
        if (!renderedChords.includes(chord)) {
          throw new Error(`Expected chord "${chord}" not found in rendered chords: ${renderedChords.join(', ')}`);
        }
      }
    }
  }

  /**
   * Get the song title
   * @returns {Promise<string>}
   */
  async getTitle() {
    return this.page.locator(selectors.songDetail.title).textContent() || '';
  }

  /**
   * Get the song artist
   * @returns {Promise<string>}
   */
  async getArtist() {
    return this.page.locator(selectors.songDetail.artist).textContent() || '';
  }

  /**
   * Get the current key
   * @returns {Promise<string>}
   */
  async getKey() {
    return this.page.locator(selectors.songDetail.key).textContent() || '';
  }

  /**
   * Click export button
   * @returns {Promise<void>}
   */
  async export() {
    await this.page.click(selectors.songDetail.exportButton);
  }

  /**
   * Click print button
   * @returns {Promise<void>}
   */
  async print() {
    await this.page.click(selectors.songDetail.printButton);
  }

  /**
   * Check if in edit mode
   * @returns {Promise<boolean>}
   */
  async isInEditMode() {
    return this.page.locator('[data-testid="song-editor"], [data-testid="chordpro-editor"]').isVisible();
  }
}

// Import expect for assertions
import { expect } from '@playwright/test';