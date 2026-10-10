/**
 * ChordRenderer - Component page object for the chord sheet rendering component
 * Handles chord display, transpose interactions, and chord verification
 */

import { selectors } from '../../utils/selectors.js';

/**
 * Component page object for ChordRenderer
 * Encapsulates interactions with the rendered chord sheet
 */
export class ChordRenderer {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  /**
   * Get all chord elements in the rendered chord sheet
   * @returns {Promise<import('@playwright/test').Locator[]>}
   */
  async getChordElements() {
    const chordSheet = this.page.locator(selectors.songDetail.chordSheet);
    await chordSheet.waitFor({ state: 'visible', timeout: 5000 });
    return chordSheet.locator('[data-chord], .chord, [data-testid="chord"]').all();
  }

  /**
   * Click on a specific chord to show transpose tooltip
   * @param {string} chord - Chord symbol to click (e.g., "G", "Dm", "Cmaj7")
   * @returns {Promise<void>}
   */
  async clickChord(chord) {
    const chordElement = this.page.locator(`[data-chord="${chord}"], .chord:has-text("${chord}"), [data-testid="chord"]:has-text("${chord}")`).first();
    await chordElement.waitFor({ state: 'visible', timeout: 5000 });
    await chordElement.click();
  }

  /**
   * Get the currently displayed transpose value from the transpose control
   * @returns {Promise<number>} Current transpose in semitones
   */
  async getTransposeValue() {
    const transposeControl = this.page.locator(selectors.songDetail.transposeControl);
    const valueText = await transposeControl.locator('[data-testid="transpose-value"], [data-transpose-value]').textContent();
    return parseInt(valueText || '0', 10);
  }

  /**
   * Expect a specific transpose value to be displayed
   * @param {number} value - Expected transpose in semitones
   * @returns {Promise<void>}
   */
  async expectTransposeValue(value) {
    const actualValue = await this.getTransposeValue();
    if (actualValue !== value) {
      throw new Error(`Expected transpose value ${value}, got ${actualValue}`);
    }
  }

  /**
   * Get all rendered chord symbols as an array
   * @returns {Promise<string[]>}
   */
  async getRenderedChords() {
    const chordElements = await this.getChordElements();
    const chords = [];
    
    for (const element of chordElements) {
      const text = await element.textContent();
      if (text && text.trim()) {
        // Clean up the chord text (remove extra whitespace, newlines)
        chords.push(text.trim().replace(/\s+/g, ' '));
      }
    }
    
    return chords;
  }

  /**
   * Expect chords to be visible in the chord sheet
   * @returns {Promise<void>}
   */
  async expectChordsVisible() {
    const chordSheet = this.page.locator(selectors.songDetail.chordSheet);
    await chordSheet.waitFor({ state: 'visible', timeout: 10000 });
    
    const chordCount = await this.getChordElements();
    if (chordCount.length === 0) {
      // Some songs might not have chords, check for lyrics-only
      const lyricsOnly = await this.page.locator('[data-testid="lyrics-only"], .lyrics-only').count();
      if (lyricsOnly === 0) {
        throw new Error('No chords found in chord sheet');
      }
    }
  }

  /**
   * Set transpose using the transpose control
   * @param {number} steps - Semitone offset
   * @returns {Promise<void>}
   */
  async setTranspose(steps) {
    const transposeControl = this.page.locator(selectors.songDetail.transposeControl);
    
    // Find the transpose input or buttons
    const transposeInput = transposeControl.locator('[data-testid="transpose-input"], input[type="number"]');
    // StageMode.jsx labels these buttons "Transpose up" / "Transpose down"
    // (aria-label, lines 456 and 464). Matching the glyph did not work: the
    // down button renders U+2212 MINUS SIGN while `has-text("-")` is ASCII
    // U+002D, so the two never matched.
    const incrementBtn = transposeControl.locator('[data-testid="transpose-up"], button[aria-label="Transpose up"]');
    const decrementBtn = transposeControl.locator('[data-testid="transpose-down"], button[aria-label="Transpose down"]');
    
    if (await transposeInput.count() > 0) {
      // Direct input
      await transposeInput.fill(steps.toString());
      await transposeInput.press('Enter');
    } else if (steps > 0) {
      // Click increment button multiple times
      for (let i = 0; i < steps; i++) {
        await incrementBtn.click();
        await this.waitForChordUpdate();
      }
    } else if (steps < 0) {
      // Click decrement button multiple times
      for (let i = 0; i < Math.abs(steps); i++) {
        await decrementBtn.click();
        await this.waitForChordUpdate();
      }
    }
    
    await this.waitForChordUpdate();
  }

  /**
   * Reset transpose to 0
   * @returns {Promise<void>}
   */
  async resetTranspose() {
    await this.setTranspose(0);
  }

  /**
   * Wait for chords to update after transpose change
   * @returns {Promise<void>}
   */
  async waitForChordUpdate() {
    await this.page.waitForLoadState('networkidle', { timeout: 5000 });
    await this.page.waitForTimeout(100); // Small delay for DOM update
  }

  /**
   * Verify that transpose has been applied correctly by checking a known chord
   * @param {string} originalChord - Original chord symbol
   * @param {string} expectedChord - Expected chord after transpose
   * @returns {Promise<void>}
   */
  async verifyTransposeApplied(originalChord, expectedChord) {
    // Click the original chord location (where it was before transpose)
    // The rendered chord should now show the transposed version
    await this.clickChord(expectedChord);
    
    // Verify tooltip or displayed value shows the transposed chord
    const tooltip = this.page.locator('[data-testid="chord-tooltip"], .chord-tooltip, .transpose-tooltip');
    await tooltip.waitFor({ state: 'visible', timeout: 3000 });
    
    const tooltipText = await tooltip.textContent();
    if (!tooltipText?.includes(expectedChord)) {
      throw new Error(`Transpose not applied correctly. Expected ${expectedChord}, tooltip shows: ${tooltipText}`);
    }
  }

  /**
   * Get the capo position if displayed
   * @returns {Promise<number>}
   */
  async getCapoPosition() {
    const capoSelector = this.page.locator(selectors.songDetail.capoSelector);
    const value = await capoSelector.locator('[data-testid="capo-value"], select').inputValue();
    return parseInt(value || '0', 10);
  }

  /**
   * Set capo position
   * @param {number} fret - Capo fret number
   * @returns {Promise<void>}
   */
  async setCapoPosition(fret) {
    const capoSelector = this.page.locator(selectors.songDetail.capoSelector);
    await capoSelector.locator('select, [data-testid="capo-input"]').selectOption(fret.toString());
    await this.waitForChordUpdate();
  }

  /**
   * Check if chord diagrams are displayed
   * @returns {Promise<boolean>}
   */
  async hasChordDiagrams() {
    return this.page.locator('[data-testid="chord-diagram"], .chord-diagram').count() > 0;
  }

  /**
   * Get chord diagram for a specific chord
   * @param {string} chord - Chord symbol
   * @returns {Promise<import('@playwright/test').Locator|null>}
   */
  async getChordDiagram(chord) {
    const diagram = this.page.locator(`[data-testid="chord-diagram-${chord}"], .chord-diagram[data-chord="${chord}"]`);
    if (await diagram.count() > 0) {
      return diagram.first();
    }
    return null;
  }
}