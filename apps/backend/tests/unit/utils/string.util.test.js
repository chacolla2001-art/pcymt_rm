const StringUtil = require('../../../src/shared/utils/string.util');

describe('StringUtil', () => {
  describe('generateRandomPassword', () => {
    test('should generate a password with default length (16 chars hex)', () => {
      const password = StringUtil.generateRandomPassword();
      expect(password).toBeTruthy();
      expect(typeof password).toBe('string');
      expect(password.length).toBe(16); // 8 bytes = 16 hex chars
    });

    test('should generate password with custom length', () => {
      const password = StringUtil.generateRandomPassword(16);
      expect(password.length).toBe(32); // 16 bytes = 32 hex chars
    });

    test('should generate different passwords each time', () => {
      const pass1 = StringUtil.generateRandomPassword();
      const pass2 = StringUtil.generateRandomPassword();
      expect(pass1).not.toBe(pass2);
    });
  });

  describe('generateUUID', () => {
    test('should generate a valid UUID v4', () => {
      const uuid = StringUtil.generateUUID();
      expect(uuid).toBeTruthy();
      expect(typeof uuid).toBe('string');
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('should generate unique UUIDs', () => {
      const uuid1 = StringUtil.generateUUID();
      const uuid2 = StringUtil.generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('capitalize', () => {
    test('should capitalize first letter', () => {
      expect(StringUtil.capitalize('hello')).toBe('Hello');
    });

    test('should lowercase remaining letters', () => {
      expect(StringUtil.capitalize('hELLO')).toBe('Hello');
    });

    test('should handle empty string', () => {
      expect(StringUtil.capitalize('')).toBe('');
    });

    test('should handle null/undefined', () => {
      expect(StringUtil.capitalize(null)).toBe('');
      expect(StringUtil.capitalize(undefined)).toBe('');
    });

    test('should handle single character', () => {
      expect(StringUtil.capitalize('a')).toBe('A');
    });
  });

  describe('slugify', () => {
    test('should convert to lowercase', () => {
      expect(StringUtil.slugify('Hello World')).toBe('hello-world');
    });

    test('should replace spaces with hyphens', () => {
      expect(StringUtil.slugify('multiple   spaces   here')).toBe('multiple-spaces-here');
    });

    test('should remove special characters', () => {
      expect(StringUtil.slugify('Hello, World! @#$%')).toBe('hello-world');
    });

    test('should remove leading and trailing hyphens', () => {
      expect(StringUtil.slugify('  hello world  ')).toBe('hello-world');
    });

    test('should replace underscores with hyphens', () => {
      expect(StringUtil.slugify('hello_world_test')).toBe('hello-world-test');
    });

    test('should handle empty string', () => {
      expect(StringUtil.slugify('')).toBe('');
    });

    test('should handle only special characters', () => {
      expect(StringUtil.slugify('!@#$%^&*()')).toBe('');
    });
  });
});
