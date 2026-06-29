const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Encryption utility for password hashing
 */
class EncryptionUtil {
  /**
   * Hash a plain text password
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  async hash(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Compare a plain text password with a hash
   * @param {string} plainPassword - Plain text password
   * @param {string} hashedPassword - Hashed password to compare against
   * @returns {Promise<boolean>} True if passwords match
   */
  async compare(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}

module.exports = EncryptionUtil;
