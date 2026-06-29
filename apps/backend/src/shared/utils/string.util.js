const crypto = require('crypto');

/**
 * String utility functions
 */
class StringUtil {
  /**
   * Generate a random password
   * @param {number} length - Length of password in bytes (will be hex encoded)
   * @returns {string} Random password
   */
  static generateRandomPassword(length = 8) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a UUID v4
   * @returns {string} UUID string
   */
  static generateUUID() {
    return crypto.randomUUID();
  }

  /**
   * Capitalize first letter of a string
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  static capitalize(str) {
    if (!str) {
      return '';
    }
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Slugify a string
   * @param {string} str - String to slugify
   * @returns {string} Slugified string
   */
  static slugify(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

module.exports = StringUtil;
