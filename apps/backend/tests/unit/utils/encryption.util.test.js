const EncryptionUtil = require('../../../src/shared/utils/encryption.util');

describe('EncryptionUtil', () => {
  let encryptionUtil;
  const testPassword = 'SecurePassword123!';

  beforeAll(() => {
    encryptionUtil = new EncryptionUtil();
  });

  describe('hash', () => {
    test('should hash password successfully', async () => {
      const hash = await encryptionUtil.hash(testPassword);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(testPassword);
      expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt format
    });

    test('should generate different hashes for same password', async () => {
      const hash1 = await encryptionUtil.hash(testPassword);
      const hash2 = await encryptionUtil.hash(testPassword);
      
      expect(hash1).not.toBe(hash2); // Due to different salts
    });

    test('should handle empty password', async () => {
      const hash = await encryptionUtil.hash('');
      expect(hash).toBeTruthy();
    });
  });

  describe('compare', () => {
    let hashedPassword;

    beforeAll(async () => {
      hashedPassword = await encryptionUtil.hash(testPassword);
    });

    test('should return true for correct password', async () => {
      const isMatch = await encryptionUtil.compare(testPassword, hashedPassword);
      expect(isMatch).toBe(true);
    });

    test('should return false for incorrect password', async () => {
      const isMatch = await encryptionUtil.compare('WrongPassword', hashedPassword);
      expect(isMatch).toBe(false);
    });

    test('should be case sensitive', async () => {
      const isMatch = await encryptionUtil.compare(
        testPassword.toUpperCase(),
        hashedPassword
      );
      expect(isMatch).toBe(false);
    });

    test('should handle empty string comparison', async () => {
      const isMatch = await encryptionUtil.compare('', hashedPassword);
      expect(isMatch).toBe(false);
    });
  });
});
