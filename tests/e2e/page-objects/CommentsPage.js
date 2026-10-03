/**
 * CommentsPage - Page object for the comments/thread system
 * Handles adding, editing, deleting, replying to, and resolving comments
 * Can be used as embedded component or standalone page
 */

import { BasePage } from './BasePage.js';
import { selectors } from '../utils/selectors.js';
import { waitForNetworkIdle } from '../utils/test-helpers.js';

/**
 * Page object for comments thread
 * URL pattern: /comments/:entityType/:entityId (standalone) or embedded in detail pages
 */
export class CommentsPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {Object} [options]
   * @param {string} [options.entityType] - Entity type (song, setlist, gig, etc.)
   * @param {string} [options.entityId] - Entity ID
   * @param {string} [options.containerSelector] - Custom selector for comments container
   */
  constructor(page, options = {}) {
    const { entityType, entityId, containerSelector } = options;
    const url = entityType && entityId 
      ? `/comments/${entityType}/${entityId}` 
      : '/comments/:entityType/:entityId';
    
    super(page, url);
    this.entityType = entityType;
    this.entityId = entityId;
    this.containerSelector = containerSelector || selectors.comments.thread;
  }

  /**
   * Key selector that indicates the comments thread is loaded
   * @type {string}
   */
  get keySelector() {
    return this.containerSelector;
  }

  /**
   * Add a new comment
   * @param {string} text - Comment text
   * @returns {Promise<void>}
   */
  async addComment(text) {
    // Find the comment input (could be at bottom of thread or in a form)
    const commentInput = this.page.locator('[data-testid="comment-input"], [data-testid="new-comment"], textarea[placeholder*="comment" i], textarea[placeholder*="comentario" i]');
    await commentInput.waitFor({ state: 'visible', timeout: 5000 });
    await commentInput.fill(text);
    
    // Submit
    const submitBtn = this.page.locator('[data-testid="comment-submit"], [data-testid="add-comment"], button:has-text("Comment"), button:has-text("Comentar")');
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
    await submitBtn.click();
    
    await waitForNetworkIdle(this.page);
    
    // Wait for comment to appear in thread
    await this.page.locator(selectors.comments.comment).filter({ hasText: text }).first().waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Edit an existing comment
   * @param {string} id - Comment ID (or index/text to identify)
   * @param {string} text - New comment text
   * @returns {Promise<void>}
   */
  async editComment(id, text) {
    let commentEl;
    
    // Try to find by data attribute first
    commentEl = this.page.locator(`[data-comment-id="${id}"]`);
    
    if (await commentEl.count() === 0) {
      // Try finding by text content (first occurrence)
      commentEl = this.page.locator(selectors.comments.comment).filter({ hasText: id }).first();
    }
    
    if (await commentEl.count() === 0) {
      throw new Error(`Comment with identifier "${id}" not found`);
    }
    
    // Click edit button
    const editBtn = commentEl.locator('[data-testid="comment-edit"], [data-testid="edit-comment"]');
    await editBtn.waitFor({ state: 'visible', timeout: 5000 });
    await editBtn.click();
    
    // Wait for edit mode / input
    const editInput = commentEl.locator('[data-testid="comment-edit-input"], [data-testid="edit-comment-input"], textarea');
    await editInput.waitFor({ state: 'visible', timeout: 5000 });
    await editInput.fill(text);
    
    // Save
    const saveBtn = commentEl.locator('[data-testid="comment-save"], [data-testid="save-comment"]');
    await saveBtn.waitFor({ state: 'visible', timeout: 5000 });
    await saveBtn.click();
    
    await waitForNetworkIdle(this.page);
  }

  /**
   * Delete a comment
   * @param {string} id - Comment ID (or text to identify)
   * @returns {Promise<void>}
   */
  async deleteComment(id) {
    let commentEl;
    
    // Try to find by data attribute first
    commentEl = this.page.locator(`[data-comment-id="${id}"]`);
    
    if (await commentEl.count() === 0) {
      // Try finding by text content
      commentEl = this.page.locator(selectors.comments.comment).filter({ hasText: id }).first();
    }
    
    if (await commentEl.count() === 0) {
      throw new Error(`Comment with identifier "${id}" not found`);
    }
    
    // Click delete button
    const deleteBtn = commentEl.locator('[data-testid="comment-delete"], [data-testid="delete-comment"]');
    await deleteBtn.waitFor({ state: 'visible', timeout: 5000 });
    await deleteBtn.click();
    
    // Confirm deletion in modal
    await this.page.click('[data-testid="modal-confirm"], [data-testid="confirm-delete"]');
    await waitForNetworkIdle(this.page);
    
    // Wait for comment to disappear
    await commentEl.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Reply to a comment
   * @param {string} id - Parent comment ID (or text to identify)
   * @param {string} text - Reply text
   * @returns {Promise<void>}
   */
  async replyToComment(id, text) {
    let parentComment;
    
    // Try to find by data attribute first
    parentComment = this.page.locator(`[data-comment-id="${id}"]`);
    
    if (await parentComment.count() === 0) {
      // Try finding by text content
      parentComment = this.page.locator(selectors.comments.comment).filter({ hasText: id }).first();
    }
    
    if (await parentComment.count() === 0) {
      throw new Error(`Parent comment with identifier "${id}" not found`);
    }
    
    // Click reply button
    const replyBtn = parentComment.locator(selectors.comments.replyButton);
    await replyBtn.waitFor({ state: 'visible', timeout: 5000 });
    await replyBtn.click();
    
    // Wait for reply input
    const replyInput = this.page.locator(selectors.comments.replyInput);
    await replyInput.waitFor({ state: 'visible', timeout: 5000 });
    await replyInput.fill(text);
    
    // Submit reply
    const replySubmit = this.page.locator(selectors.comments.replySubmit);
    await replySubmit.waitFor({ state: 'visible', timeout: 5000 });
    await replySubmit.click();
    
    await waitForNetworkIdle(this.page);
    
    // Wait for reply to appear
    await this.page.locator(selectors.comments.comment).filter({ hasText: text }).first().waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Resolve a comment (mark as resolved)
   * @param {string} id - Comment ID (or text to identify)
   * @returns {Promise<void>}
   */
  async resolveComment(id) {
    let commentEl;
    
    commentEl = this.page.locator(`[data-comment-id="${id}"]`);
    
    if (await commentEl.count() === 0) {
      commentEl = this.page.locator(selectors.comments.comment).filter({ hasText: id }).first();
    }
    
    if (await commentEl.count() === 0) {
      throw new Error(`Comment with identifier "${id}" not found`);
    }
    
    const resolveBtn = commentEl.locator(selectors.comments.resolveButton);
    if (await resolveBtn.count() > 0) {
      await resolveBtn.waitFor({ state: 'visible', timeout: 5000 });
      await resolveBtn.click();
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Unresolve a comment
   * @param {string} id - Comment ID (or text to identify)
   * @returns {Promise<void>}
   */
  async unresolveComment(id) {
    let commentEl;
    
    commentEl = this.page.locator(`[data-comment-id="${id}"]`);
    
    if (await commentEl.count() === 0) {
      commentEl = this.page.locator(selectors.comments.comment).filter({ hasText: id }).first();
    }
    
    if (await commentEl.count() === 0) {
      throw new Error(`Comment with identifier "${id}" not found`);
    }
    
    const unresolveBtn = commentEl.locator(selectors.comments.unresolveButton);
    if (await unresolveBtn.count() > 0) {
      await unresolveBtn.waitFor({ state: 'visible', timeout: 5000 });
      await unresolveBtn.click();
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Assert a comment is visible in the thread
   * @param {string} text - Comment text to find
   * @param {string} [author] - Optional author name/email
   * @returns {Promise<void>}
   */
  async expectCommentVisible(text, author) {
    const commentLocator = this.page.locator(selectors.comments.comment).filter({ hasText: text });
    await commentLocator.first().waitFor({ state: 'visible', timeout: 10000 });
    
    if (author) {
      await expect(commentLocator.first()).toContainText(author, { timeout: 5000 });
    }
  }

  /**
   * Assert a comment is NOT visible
   * @param {string} text - Comment text
   * @returns {Promise<void>}
   */
  async expectCommentNotVisible(text) {
    const commentLocator = this.page.locator(selectors.comments.comment).filter({ hasText: text });
    await commentLocator.first().waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Get all comments in the thread
   * @returns {Promise<Array<{id: string, text: string, author: string, timestamp: string, replies: Array<{text: string, author: string}>}>>}
   */
  async getComments() {
    const commentElements = await this.page.locator(selectors.comments.comment).all();
    const comments = [];
    
    for (const el of commentElements) {
      const id = (await el.getAttribute('data-comment-id')) || '';
      const text = (await el.locator('[data-testid="comment-text"], [data-testid="comment-content"]').textContent())?.trim() 
        || (await el.textContent())?.trim() 
        || '';
      const author = (await el.locator('[data-testid="comment-author"], [data-testid="comment-user"]').textContent())?.trim() || '';
      const timestamp = (await el.locator('[data-testid="comment-timestamp"], [data-testid="comment-time"]').textContent())?.trim() || '';
      
      // Get replies
      const replies = [];
      const replyElements = await el.locator('[data-testid="comment-reply"], [data-testid="reply"]').all();
      for (const replyEl of replyElements) {
        const replyText = (await replyEl.locator('[data-testid="comment-text"], [data-testid="reply-text"]').textContent())?.trim() || '';
        const replyAuthor = (await replyEl.locator('[data-testid="comment-author"], [data-testid="reply-author"]').textContent())?.trim() || '';
        if (replyText) {
          replies.push({ text: replyText, author: replyAuthor });
        }
      }
      
      if (text) {
        comments.push({ id, text, author, timestamp, replies });
      }
    }
    
    return comments;
  }

  /**
   * Get comment count
   * @returns {Promise<number>}
   */
  async getCommentCount() {
    return this.page.locator(selectors.comments.comment).count();
  }

  /**
   * Mention a user in a comment
   * @param {string} username - Username to mention (without @)
   * @returns {Promise<void>}
   */
  async mentionUser(username) {
    const mentionBtn = this.page.locator(selectors.comments.mentionButton);
    if (await mentionBtn.count() > 0) {
      await mentionBtn.click();
      
      // Wait for mention dropdown
      await this.page.waitForSelector('[data-testid="mention-dropdown"], [data-testid="mention-list"]', { 
        state: 'visible', 
        timeout: 5000 
      });
      
      // Select user
      const userOption = this.page.locator(`[data-testid="mention-option-${username}"], [data-username="${username}"]`);
      if (await userOption.count() > 0) {
        await userOption.click();
      } else {
        // Type @username manually
        const commentInput = this.page.locator('[data-testid="comment-input"], [data-testid="new-comment"], textarea');
        await commentInput.fill(`@${username} `);
      }
    }
  }

  /**
   * Check if a comment is resolved
   * @param {string} id - Comment ID (or text to identify)
   * @returns {Promise<boolean>}
   */
  async isCommentResolved(id) {
    let commentEl;
    
    commentEl = this.page.locator(`[data-comment-id="${id}"]`);
    
    if (await commentEl.count() === 0) {
      commentEl = this.page.locator(selectors.comments.comment).filter({ hasText: id }).first();
    }
    
    if (await commentEl.count() === 0) {
      return false;
    }
    
    // Check for resolved indicator
    const resolvedIndicator = commentEl.locator('[data-testid="comment-resolved"], [data-testid="resolved-badge"], .resolved');
    if (await resolvedIndicator.count() > 0) {
      return await resolvedIndicator.isVisible({ timeout: 2000 });
    }
    
    // Check for unresolve button (means it's currently resolved)
    const unresolveBtn = commentEl.locator(selectors.comments.unresolveButton);
    return (await unresolveBtn.count() > 0) && await unresolveBtn.isVisible({ timeout: 2000 });
  }

  /**
   * Expand a comment thread (show replies)
   * @param {string} id - Comment ID (or text to identify)
   * @returns {Promise<void>}
   */
  async expandReplies(id) {
    let commentEl;
    
    commentEl = this.page.locator(`[data-comment-id="${id}"]`);
    
    if (await commentEl.count() === 0) {
      commentEl = this.page.locator(selectors.comments.comment).filter({ hasText: id }).first();
    }
    
    if (await commentEl.count() === 0) {
      throw new Error(`Comment with identifier "${id}" not found`);
    }
    
    const expandBtn = commentEl.locator('[data-testid="expand-replies"], [data-testid="show-replies"], button:has-text("replies"), button:has-text("respuestas")');
    if (await expandBtn.count() > 0) {
      await expandBtn.click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Collapse a comment thread (hide replies)
   * @param {string} id - Comment ID (or text to identify)
   * @returns {Promise<void>}
   */
  async collapseReplies(id) {
    let commentEl;
    
    commentEl = this.page.locator(`[data-comment-id="${id}"]`);
    
    if (await commentEl.count() === 0) {
      commentEl = this.page.locator(selectors.comments.comment).filter({ hasText: id }).first();
    }
    
    if (await commentEl.count() === 0) {
      throw new Error(`Comment with identifier "${id}" not found`);
    }
    
    const collapseBtn = commentEl.locator('[data-testid="collapse-replies"], [data-testid="hide-replies"], button:has-text("hide"), button:has-text("ocultar")');
    if (await collapseBtn.count() > 0) {
      await collapseBtn.click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Sort comments (newest/oldest first)
   * @param {'newest'|'oldest'} order - Sort order
   * @returns {Promise<void>}
   */
  async sortComments(order) {
    const sortSelect = this.page.locator('[data-testid="comments-sort"], [data-testid="sort-comments"]');
    if (await sortSelect.count() > 0) {
      await sortSelect.selectOption(order);
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Load more comments (pagination)
   * @returns {Promise<void>}
   */
  async loadMore() {
    const loadMoreBtn = this.page.locator('[data-testid="load-more-comments"], [data-testid="load-more"], button:has-text("Load more"), button:has-text("Cargar más")');
    if (await loadMoreBtn.count() > 0) {
      await loadMoreBtn.click();
      await waitForNetworkIdle(this.page);
    }
  }

  /**
   * Get the comment thread state
   * @returns {Promise<{comments: Array, totalCount: number, hasMore: boolean}>}
   */
  async getState() {
    const comments = await this.getComments();
    const totalCount = await this.getCommentCount();
    const hasMore = await this.page.locator('[data-testid="load-more-comments"], [data-testid="load-more"]').isVisible({ timeout: 2000 }).catch(() => false);
    
    return { comments, totalCount, hasMore };
  }
}

// Import expect for assertions
import { expect } from '@playwright/test';