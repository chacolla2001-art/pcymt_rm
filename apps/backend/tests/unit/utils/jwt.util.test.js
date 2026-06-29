const JwtUtil = require('../../../src/shared/utils/jwt.util');
const jwt = require('jsonwebtoken');

// Mock environment
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.JWT_EXPIRATION = '1h';

describe('JwtUtil', () => {
  let jwtUtil;

  beforeAll(() => {
    jwtUtil = new JwtUtil();
  });

  const testPayload = {
    id: '123',
    email: 'test@example.com',
    role: 'user',
  };

  describe('sign', () => {
    test('should generate a valid JWT token', () => {
      const token = jwtUtil.sign(testPayload);
      
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    test('should include payload in token', () => {
      const token = jwtUtil.sign(testPayload);
      const decoded = jwt.decode(token);
      
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);
    });

    test('should set expiration time', () => {
      const token = jwtUtil.sign(testPayload);
      const decoded = jwt.decode(token);
      
      expect(decoded.exp).toBeTruthy();
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe('verify', () => {
    test('should verify valid token', () => {
      const token = jwtUtil.sign(testPayload);
      const decoded = jwtUtil.verify(token);
      
      expect(decoded).toBeTruthy();
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.email).toBe(testPayload.email);
    });

    test('should throw error for invalid token', () => {
      expect(() => {
        jwtUtil.verify('invalid.token.here');
      }).toThrow();
    });

    test('should throw error for expired token', () => {
      // Create token that expires immediately
      const expiredToken = jwt.sign(testPayload, process.env.JWT_SECRET, {
        expiresIn: '0s',
      });

      // Wait a bit to ensure expiration
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(() => {
            jwtUtil.verify(expiredToken);
          }).toThrow();
          resolve();
        }, 100);
      });
    });

    test('should throw error for tampered token', () => {
      const token = jwtUtil.sign(testPayload);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';
      
      expect(() => {
        jwtUtil.verify(tamperedToken);
      }).toThrow();
    });
  });
});
