/**
 * TheoryPage - Page object for music theory reference views
 * Handles scale lookup, chord lookup, interactive fretboard, interval trainer, and theory verification
 */

import { BasePage } from './BasePage.js';
import { selectors } from '../utils/selectors.js';
import { waitForNetworkIdle } from '../utils/test-helpers.js';

/**
 * Page object for music theory page
 * URL pattern: /theory
 */
export class TheoryPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page, '/theory');
  }

  /**
   * Key selector that indicates the theory page is loaded
   * @type {string}
   */
  get keySelector() {
    return selectors.theory.reference;
  }

  /**
   * Select a theory topic to view
   * @param {'scales'|'chords'|'intervals'|'circle-of-fifths'|'fretboard'|'trainer'} topic - Theory topic
   * @returns {Promise<void>}
   */
  async selectTopic(topic) {
    const topicButton = this.page.locator(`[data-testid="theory-topic-${topic}"], [data-testid="topic-${topic}"]`);
    if (await topicButton.count() > 0) {
      await topicButton.click();
      await waitForNetworkIdle(this.page);
      await this.page.waitForTimeout(300); // Allow for animation/transition
    } else {
      // Try navigation tabs
      const tab = this.page.locator(`[role="tab"]:has-text("${topic}"), [data-testid="tab-${topic}"]`);
      if (await tab.count() > 0) {
        await tab.click();
        await waitForNetworkIdle(this.page);
      }
    }
  }

  /**
   * Play audio for a note (if audio player exists)
   * @param {string} note - Note to play (e.g., 'C4', 'A#3')
   * @returns {Promise<void>}
   */
  async playAudio(note) {
    // Find the note element and click play
    const noteElement = this.page.locator(`[data-testid="note-${note}"], [data-note="${note}"]`);
    if (await noteElement.count() > 0) {
      const playBtn = noteElement.locator('[data-testid="play-note"], [data-testid="audio-play"]');
      if (await playBtn.count() > 0) {
        await playBtn.click();
        await this.page.waitForTimeout(500); // Allow audio to start
      }
    }
  }

  /**
   * Verify transpose calculation matches music theory
   * @param {string} sourceKey - Source key (e.g., 'C', 'G', 'F#')
   * @param {string} targetKey - Target key (e.g., 'D', 'A', 'Gb')
   * @param {string[]} chords - Array of chord symbols to transpose
   * @returns {Promise<string[]>} Transposed chords
   */
  async verifyTranspose(sourceKey, targetKey, chords) {
    // Navigate to transpose tool if available
    await this.selectTopic('transpose');
    
    // Set source key
    const sourceKeySelect = this.page.locator('[data-testid="transpose-source-key"], [data-testid="source-key"]');
    if (await sourceKeySelect.count() > 0) {
      await sourceKeySelect.selectOption(sourceKey);
    }
    
    // Set target key
    const targetKeySelect = this.page.locator('[data-testid="transpose-target-key"], [data-testid="target-key"]');
    if (await targetKeySelect.count() > 0) {
      await targetKeySelect.selectOption(targetKey);
    }
    
    // Input chords
    const chordInput = this.page.locator('[data-testid="transpose-chord-input"], [data-testid="chords-input"]');
    if (await chordInput.count() > 0) {
      await chordInput.fill(chords.join(' '));
    }
    
    // Trigger transpose
    const transposeBtn = this.page.locator('[data-testid="transpose-calculate"], [data-testid="calculate-transpose"]');
    if (await transposeBtn.count() > 0) {
      await transposeBtn.click();
      await waitForNetworkIdle(this.page);
    }
    
    // Get result
    const resultEl = this.page.locator('[data-testid="transpose-result"], [data-testid="transposed-chords"]');
    if (await resultEl.count() > 0) {
      const resultText = await resultEl.textContent();
      return resultText?.trim().split(/\s+/) || [];
    }
    
    return [];
  }

  /**
   * Verify degree quality matches music theory
   * @param {string} key - Key (e.g., 'C', 'G', 'F#')
   * @param {number} degree - Scale degree (1-7)
   * @param {'major'|'minor'|'diminished'|'augmented'} expectedQuality - Expected chord quality
   * @returns {Promise<boolean>} True if matches
   */
  async verifyDegreeQuality(key, degree, expectedQuality) {
    await this.selectTopic('chords');
    
    // Look for degree quality reference
    const degreeEl = this.page.locator(`[data-testid="degree-${degree}"], [data-degree="${degree}"]`);
    if (await degreeEl.count() > 0) {
      const qualityText = await degreeEl.locator('[data-testid="chord-quality"], [data-testid="degree-quality"]').textContent();
      const actualQuality = qualityText?.toLowerCase().trim();
      return actualQuality === expectedQuality;
    }
    
    // Alternative: use chord lookup
    const chordLookup = this.page.locator(selectors.theory.chordLookup);
    if (await chordLookup.count() > 0) {
      await chordLookup.click();
      
      // Navigate to key and degree
      const keySelect = this.page.locator('[data-testid="chord-lookup-key"]');
      if (await keySelect.count() > 0) {
        await keySelect.selectOption(key);
      }
      
      const degreeSelect = this.page.locator('[data-testid="chord-lookup-degree"]');
      if (await degreeSelect.count() > 0) {
        await degreeSelect.selectOption(degree.toString());
      }
      
      const qualityEl = this.page.locator('[data-testid="chord-quality-result"]');
      if (await qualityEl.count() > 0) {
        const actualQuality = (await qualityEl.textContent())?.toLowerCase().trim();
        return actualQuality === expectedQuality;
      }
    }
    
    return false;
  }

  /**
   * Verify key spelling matches music theory
   * @param {string} key - Key (e.g., 'C', 'G', 'F#', 'Bb', 'D#m')
   * @param {string[]} expectedNotes - Expected notes in the key
   * @returns {Promise<boolean>} True if matches
   */
  async verifyKeySpelling(key, expectedNotes) {
    await this.selectTopic('scales');
    
    // Look for scale/key reference
    const keySelect = this.page.locator('[data-testid="scale-key"], [data-testid="key-selector"]');
    if (await keySelect.count() > 0) {
      await keySelect.selectOption(key);
      await waitForNetworkIdle(this.page);
    }
    
    // Get displayed notes
    const notesContainer = this.page.locator('[data-testid="scale-notes"], [data-testid="key-notes"], [data-testid="notes-display"]');
    if (await notesContainer.count() > 0) {
      const notesText = await notesContainer.textContent();
      const displayedNotes = notesText
        ?.split(/[\s,]+/)
        .map(n => n.trim().replace(/[♯#]/, '#').replace(/[♭b]/, 'b'))
        .filter(n => n.length > 0) || [];
      
      // Normalize for comparison
      const normalizedExpected = expectedNotes.map(n => n.replace(/[♯#]/, '#').replace(/[♭b]/, 'b'));
      const normalizedDisplayed = displayedNotes.map(n => n.replace(/[♯#]/, '#').replace(/[♭b]/, 'b'));
      
      return JSON.stringify(normalizedDisplayed.sort()) === JSON.stringify(normalizedExpected.sort());
    }
    
    return false;
  }

  /**
   * Get all notes displayed for a key
   * @param {string} key - Key to check
   * @returns {Promise<string[]>}
   */
  async getKeyNotes(key) {
    await this.selectTopic('scales');
    
    const keySelect = this.page.locator('[data-testid="scale-key"], [data-testid="key-selector"]');
    if (await keySelect.count() > 0) {
      await keySelect.selectOption(key);
      await waitForNetworkIdle(this.page);
    }
    
    const notesContainer = this.page.locator('[data-testid="scale-notes"], [data-testid="key-notes"], [data-testid="notes-display"]');
    if (await notesContainer.count() > 0) {
      const notesText = await notesContainer.textContent();
      return notesText
        ?.split(/[\s,]+/)
        .map(n => n.trim().replace(/[♯#]/, '#').replace(/[♭b]/, 'b'))
        .filter(n => n.length > 0) || [];
    }
    
    return [];
  }

  /**
   * Take an interactive quiz for a topic
   * @param {'intervals'|'chords'|'scales'|'notes'} topic - Quiz topic
   * @returns {Promise<void>}
   */
  async takeQuiz(topic) {
    // Navigate to quiz/trainer section
    const quizBtn = this.page.locator(`[data-testid="quiz-${topic}"], [data-testid="start-quiz-${topic}"]`);
    if (await quizBtn.count() > 0) {
      await quizBtn.click();
      await this.page.waitForSelector('[data-testid="quiz-question"], [data-testid="trainer-question"]', { 
        state: 'visible', 
        timeout: 5000 
      });
    }
  }

  /**
   * Answer current quiz question
   * @param {string} answer - Answer to select
   * @returns {Promise<void>}
   */
  async answerQuiz(answer) {
    const answerOption = this.page.locator(`[data-testid="quiz-answer-${answer}"], [data-answer="${answer}"]`);
    if (await answerOption.count() > 0) {
      await answerOption.click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Get current quiz score
   * @returns {Promise<{correct: number, total: number, percentage: number}>}
   */
  async getQuizScore() {
    const scoreEl = this.page.locator('[data-testid="quiz-score"], [data-testid="trainer-score"]');
    if (await scoreEl.count() > 0) {
      const text = await scoreEl.textContent();
      const match = text?.match(/(\d+)\s*\/\s*(\d+)/);
      if (match) {
        const correct = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        return { correct, total, percentage: Math.round((correct / total) * 100) };
      }
      
      // Try percentage only
      const pctMatch = text?.match(/(\d+)%/);
      if (pctMatch) {
        const percentage = parseInt(pctMatch[1], 10);
        return { correct: 0, total: 0, percentage };
      }
    }
    
    return { correct: 0, total: 0, percentage: 0 };
  }

  /**
   * Assert quiz score matches expected
   * @param {number} expectedPercentage - Expected score percentage
   * @returns {Promise<void>}
   */
  async expectQuizScore(expectedPercentage) {
    const score = await this.getQuizScore();
    if (score.percentage !== expectedPercentage) {
      throw new Error(`Expected quiz score ${expectedPercentage}%, got ${score.percentage}%`);
    }
  }

  /**
   * Complete the current quiz
   * @returns {Promise<{correct: number, total: number, percentage: number}>}
   */
  async completeQuiz() {
    let score = { correct: 0, total: 0, percentage: 0 };
    
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Check if quiz is complete
      const completeEl = this.page.locator('[data-testid="quiz-complete"], [data-testid="quiz-results"]');
      if (await completeEl.count() > 0 && await completeEl.isVisible()) {
        score = await this.getQuizScore();
        break;
      }
      
      // Get current question (this is a simplified version - real implementation
      // would need to actually parse the question and determine correct answer)
      const questionEl = this.page.locator('[data-testid="quiz-question"], [data-testid="trainer-question"]');
      if (await questionEl.count() === 0) {
        break;
      }
      
      // For testing purposes, just click first answer option
      const firstAnswer = this.page.locator('[data-testid="quiz-answer"]:first-child, [data-answer]:first-child');
      if (await firstAnswer.count() > 0) {
        await firstAnswer.click();
        await this.page.waitForTimeout(500);
      } else {
        break;
      }
    }
    
    return score;
  }

  /**
   * Get scale information for a key
   * @param {string} key - Key (e.g., 'C', 'G', 'Am')
   * @returns {Promise<{notes: string[], pattern: string, type: string}|null>}
   */
  async getScaleInfo(key) {
    await this.selectTopic('scales');
    
    const keySelect = this.page.locator('[data-testid="scale-key"], [data-testid="key-selector"]');
    if (await keySelect.count() > 0) {
      await keySelect.selectOption(key);
      await waitForNetworkIdle(this.page);
    }
    
    const scaleInfo = this.page.locator('[data-testid="scale-info"], [data-testid="scale-details"]');
    if (await scaleInfo.count() > 0) {
      const notes = await this.getKeyNotes(key);
      const pattern = (await scaleInfo.locator('[data-testid="scale-pattern"]').textContent())?.trim() || '';
      const type = (await scaleInfo.locator('[data-testid="scale-type"]').textContent())?.trim() || '';
      
      return { notes, pattern, type };
    }
    
    return null;
  }

  /**
   * Get chord information
   * @param {string} chordSymbol - Chord symbol (e.g., 'Cmaj7', 'Dm7', 'G7')
   * @returns {Promise<{notes: string[], intervals: string[], quality: string}|null>}
   */
  async getChordInfo(chordSymbol) {
    await this.selectTopic('chords');
    
    const chordLookup = this.page.locator(selectors.theory.chordLookup);
    if (await chordLookup.count() > 0) {
      await chordLookup.click();
    }
    
    const chordInput = this.page.locator('[data-testid="chord-input"], [data-testid="chord-symbol-input"]');
    if (await chordInput.count() > 0) {
      await chordInput.fill(chordSymbol);
      await chordInput.press('Enter');
      await waitForNetworkIdle(this.page);
    }
    
    const chordInfo = this.page.locator('[data-testid="chord-info"], [data-testid="chord-details"]');
    if (await chordInfo.count() > 0) {
      const notesText = await chordInfo.locator('[data-testid="chord-notes"]').textContent();
      const intervalsText = await chordInfo.locator('[data-testid="chord-intervals"]').textContent();
      const quality = (await chordInfo.locator('[data-testid="chord-quality"]').textContent())?.trim() || '';
      
      const notes = notesText?.split(/[\s,]+/).map(n => n.trim()).filter(n => n.length > 0) || [];
      const intervals = intervalsText?.split(/[\s,]+/).map(n => n.trim()).filter(n => n.length > 0) || [];
      
      return { notes, intervals, quality };
    }
    
    return null;
  }

  /**
   * Interact with the fretboard
   * @param {Object} options - Fretboard interaction options
   * @param {number} options.fret - Fret number (0-24)
   * @param {number} options.string - String number (1-6, 1=high E)
   * @returns {Promise<string>} Note at that position
   */
  async getFretboardNote(options) {
    await this.selectTopic('fretboard');
    
    const fretboard = this.page.locator(selectors.theory.fretboard);
    if (await fretboard.count() > 0) {
      // Click on the fret/string position
      const stringEl = fretboard.locator(`[data-string="${options.string}"][data-fret="${options.fret}"]`);
      if (await stringEl.count() > 0) {
        await stringEl.click();
        await this.page.waitForTimeout(200);
        
        // Get the displayed note
        const noteDisplay = this.page.locator('[data-testid="fretboard-note"], [data-testid="selected-note"]');
        if (await noteDisplay.count() > 0) {
          return (await noteDisplay.textContent())?.trim() || '';
        }
      }
    }
    
    return '';
  }

  /**
   * Highlight notes of a scale on the fretboard
   * @param {string} key - Key (e.g., 'C', 'Am')
   * @param {string} [scaleType='major'] - Scale type
   * @returns {Promise<void>}
   */
  async highlightScale(key, scaleType = 'major') {
    await this.selectTopic('fretboard');
    
    const scaleSelect = this.page.locator('[data-testid="fretboard-scale"], [data-testid="scale-highlight"]');
    if (await scaleSelect.count() > 0) {
      await scaleSelect.selectOption(`${key} ${scaleType}`);
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Highlight notes of a chord on the fretboard
   * @param {string} chordSymbol - Chord symbol (e.g., 'Cmaj7', 'Dm7')
   * @returns {Promise<void>}
   */
  async highlightChord(chordSymbol) {
    await this.selectTopic('fretboard');
    
    const chordInput = this.page.locator('[data-testid="fretboard-chord-input"], [data-testid="chord-highlight-input"]');
    if (await chordInput.count() > 0) {
      await chordInput.fill(chordSymbol);
      await chordInput.press('Enter');
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Verify interval between two notes
   * @param {string} note1 - First note (e.g., 'C4')
   * @param {string} note2 - Second note (e.g., 'E4')
   * @returns {Promise<{interval: string, semitones: number, quality: string}|null>}
   */
  async verifyInterval(note1, note2) {
    await this.selectTopic('intervals');
    
    const intervalTrainer = this.page.locator(selectors.theory.intervalTrainer);
    if (await intervalTrainer.count() > 0) {
      // Look for interval calculator
      const calcBtn = this.page.locator('[data-testid="interval-calculator"], [data-testid="calculate-interval"]');
      if (await calcBtn.count() > 0) {
        await this.page.fill('[data-testid="interval-note1"]', note1);
        await this.page.fill('[data-testid="interval-note2"]', note2);
        await calcBtn.click();
        await waitForNetworkIdle(this.page);
        
        const result = this.page.locator('[data-testid="interval-result"]');
        if (await result.count() > 0) {
          const interval = (await result.locator('[data-testid="interval-name"]').textContent())?.trim() || '';
          const semitonesText = (await result.locator('[data-testid="interval-semitones"]').textContent())?.trim() || '';
          const quality = (await result.locator('[data-testid="interval-quality"]').textContent())?.trim() || '';
          
          const semitones = parseInt(semitonesText.match(/\d+/)?.[0] ?? '0', 10);
          
          return { interval, semitones, quality };
        }
      }
    }
    
    return null;
  }

  /**
   * Check if a specific theory component is available
   * @param {'scales'|'chords'|'intervals'|'circle-of-fifths'|'fretboard'|'trainer'} component - Component name
   * @returns {Promise<boolean>}
   */
  async hasComponent(component) {
    const componentEl = this.page.locator(`[data-testid="theory-${component}"], [data-testid="${component}-component"]`);
    return (await componentEl.count()) > 0;
  }

  /**
   * Get circle of fifths data
   * @returns {Promise<Array<{key: string, position: number, sharps: number, flats: number}>>}
   */
  async getCircleOfFifths() {
    await this.selectTopic('circle-of-fifths');
    
    const circleEl = this.page.locator('[data-testid="circle-of-fifths"], [data-testid="circle-fifths"]');
    if (await circleEl.count() === 0) {
      return [];
    }
    
    const keys = await circleEl.locator('[data-testid="circle-key"]').all();
    const result = [];
    
    for (const keyEl of keys) {
      const key = (await keyEl.getAttribute('data-key')) || '';
      const position = parseInt((await keyEl.getAttribute('data-position')) || '0', 10);
      const sharps = parseInt((await keyEl.getAttribute('data-sharps')) || '0', 10);
      const flats = parseInt((await keyEl.getAttribute('data-flats')) || '0', 10);
      
      if (key) {
        result.push({ key, position, sharps, flats });
      }
    }
    
    return result;
  }
}