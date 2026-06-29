const JwtUtil = require('../../../src/shared/utils/jwt.util');
const EncryptionUtil = require('../../../src/shared/utils/encryption.util');
const PaginationUtil = require('../../../src/shared/utils/pagination.util');

describe('Utilities Unit Tests', () => {
  describe('JwtUtil', () => {
    let jwtUtil;

    beforeEach(() => {
      process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes-min-64-characters-long';
      jwtUtil = new JwtUtil();
    });

    it('should sign and verify token correctly', () => {
      const payload = { id: '123', email: 'test@example.com' };
      const token = jwtUtil.sign(payload);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      const decoded = jwtUtil.verify(token);
      expect(decoded.id).toBe(payload.id);
      expect(decoded.email).toBe(payload.email);
    });

    it('should throw error on invalid token', () => {
      expect(() => {
        jwtUtil.verify('invalid-token');
      }).toThrow();
    });

    it('should decode token without verification', () => {
      const payload = { id: '123', email: 'test@example.com' };
      const token = jwtUtil.sign(payload);

      const decoded = jwtUtil.decode(token);
      expect(decoded.id).toBe(payload.id);
      expect(decoded.email).toBe(payload.email);
    });
  });

  describe('EncryptionUtil', () => {
    let encryptionUtil;

    beforeEach(() => {
      encryptionUtil = new EncryptionUtil();
    });

    it('should hash password correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await encryptionUtil.hash(password);

      expect(hash).toBeTruthy();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should verify password correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await encryptionUtil.hash(password);

      const isValid = await encryptionUtil.compare(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await encryptionUtil.compare('WrongPassword', hash);
      expect(isInvalid).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await encryptionUtil.hash(password);
      const hash2 = await encryptionUtil.hash(password);

      expect(hash1).not.toBe(hash2);

      // Both should verify successfully
      expect(await encryptionUtil.compare(password, hash1)).toBe(true);
      expect(await encryptionUtil.compare(password, hash2)).toBe(true);
    });
  });

  describe('PaginationUtil', () => {
    it('should calculate offset correctly', () => {
      // Use parse method which returns offset
      const result1 = PaginationUtil.parse({ page: 1, limit: 10 });
      const result2 = PaginationUtil.parse({ page: 2, limit: 10 });
      const result3 = PaginationUtil.parse({ page: 3, limit: 20 });
      
      expect(result1.offset).toBe(0);
      expect(result2.offset).toBe(10);
      expect(result3.offset).toBe(40);
    });

    it('should format pagination response', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const result = PaginationUtil.buildResult(data, 100, 1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(100);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(10);
    });

    it('should handle empty results', () => {
      const result = PaginationUtil.buildResult([], 0, 1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });
});
