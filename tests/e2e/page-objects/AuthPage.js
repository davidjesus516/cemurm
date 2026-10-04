/**
 * AuthPage - Page object for authentication flows (login, register, password reset, logout)
 */

import { BasePage } from './BasePage.js';
import { selectors } from '../utils/selectors.js';

/**
 * Page object for authentication surface
 * Extends BasePage with auth-specific actions and assertions
 */
export class AuthPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page, '/auth');
  }

  /**
   * Key selector that indicates the login page is loaded
   * @type {string}
   */
  get keySelector() {
    return selectors.auth.loginEmail;
  }

  /**
   * Login with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<void>}
   */
  async login(email, password) {
    await this.page.fill(selectors.auth.loginEmail, email);
    await this.page.fill(selectors.auth.loginPassword, password);
    await this.page.click(selectors.auth.loginButton);
    
    // Wait for redirect to home (app shell)
    await this.waitForUrl('**/');
    await this.waitForLoad();
  }

  /**
   * Register a new account
   * @param {string} email
   * @param {string} password
   * @param {string} name - Display name
   * @returns {Promise<void>}
   */
  async register(email, password, name) {
    // Navigate to register page if not already there
    if (!this.getCurrentUrl().includes('/register')) {
      await this.page.click(selectors.auth.registerButton);
      await this.waitForUrl('**/register');
    }

    await this.page.fill(selectors.auth.registerEmail, email);
    await this.page.fill(selectors.auth.registerPassword, password);
    await this.page.fill(selectors.auth.registerConfirmPassword, password);
    
    // Fill name if field exists
    const nameInput = this.page.locator('[data-testid="register-name"]');
    if (await nameInput.count() > 0) {
      await nameInput.fill(name);
    }

    await this.page.click(selectors.auth.registerSubmit);
    
    // Wait for email confirmation flow or redirect
    await this.waitForLoad();
  }

  /**
   * Request password reset
   * @param {string} email
   * @returns {Promise<void>}
   */
  async requestPasswordReset(email) {
    // Navigate to forgot password page if needed
    if (!this.getCurrentUrl().includes('/forgot-password')) {
      await this.page.click('[data-testid="forgot-password-link"]');
      await this.waitForUrl('**/forgot-password');
    }

    await this.page.fill(selectors.auth.passwordResetEmail, email);
    await this.page.click(selectors.auth.passwordResetSubmit);
    
    // Wait for confirmation message
    await this.waitForLoad();
  }

  /**
   * Submit date of birth (for age verification)
   * @param {string} dob - Date of birth in YYYY-MM-DD format
   * @returns {Promise<void>}
   */
  async submitDateOfBirth(dob) {
    await this.page.fill(selectors.auth.dateOfBirthInput, dob);
    await this.page.click(selectors.auth.dateOfBirthSubmit);
    await this.waitForLoad();
  }

  /**
   * Logout from the application
   * @returns {Promise<void>}
   */
  async logout() {
    // Open user menu and click logout
    await this.page.click(selectors.nav.userMenu);
    await this.page.click(selectors.auth.logoutButton);
    
    // Wait for redirect to login
    await this.waitForUrl('**/auth');
    await this.waitForLoad();
  }

  /**
   * Assert that user is logged in (redirected to home, session established)
   * @returns {Promise<void>}
   */
  async expectLoggedIn() {
    // Should be on home page, not login
    await this.waitForUrl('**/');
    await this.page.waitForSelector(selectors.nav.appBar, { state: 'visible', timeout: 10000 });
    
    // Verify user menu is present (indicates authenticated state)
    await this.page.waitForSelector(selectors.nav.userMenu, { state: 'visible', timeout: 5000 });
  }

  /**
   * Assert that a login error is displayed
   * @param {string} [expectedMessage] - Optional expected error message
   * @returns {Promise<void>}
   */
  async expectLoginError(expectedMessage) {
    const errorLocator = this.page.locator(selectors.auth.loginError);
    await errorLocator.waitFor({ state: 'visible', timeout: 5000 });
    
    if (expectedMessage) {
      await errorLocator.waitFor({ 
        state: 'visible', 
        timeout: 5000 
      });
      const text = await errorLocator.textContent();
      if (!text?.includes(expectedMessage)) {
        throw new Error(`Expected login error "${expectedMessage}", got "${text}"`);
      }
    }
  }

  /**
   * Assert that we are on the login page
   * @returns {Promise<void>}
   */
  async expectOnLoginPage() {
    await this.waitForUrl('**/auth');
    await this.page.waitForSelector(selectors.auth.loginEmail, { state: 'visible', timeout: 5000 });
  }

  /**
   * Assert that we are on the register page
   * @returns {Promise<void>}
   */
  async expectOnRegisterPage() {
    await this.waitForUrl('**/register');
    await this.page.waitForSelector(selectors.auth.registerEmail, { state: 'visible', timeout: 5000 });
  }

  /**
   * Assert that we are on the forgot password page
   * @returns {Promise<void>}
   */
  async expectOnForgotPasswordPage() {
    await this.waitForUrl('**/forgot-password');
    await this.page.waitForSelector(selectors.auth.passwordResetEmail, { state: 'visible', timeout: 5000 });
  }

  /**
   * Check if login form is visible
   * @returns {Promise<boolean>}
   */
  async isLoginFormVisible() {
    return this.page.locator(selectors.auth.loginEmail).isVisible();
  }

  /**
   * Clear login form
   * @returns {Promise<void>}
   */
  async clearLoginForm() {
    await this.page.fill(selectors.auth.loginEmail, '');
    await this.page.fill(selectors.auth.loginPassword, '');
  }
}