const { userSchemas } = require('../../../src/shared/validators');

describe('User Validators', () => {
  describe('create schema', () => {
    test('should validate correct user data', () => {
      const validUser = {
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'SecurePass123!',
        role: 'user',
      };

      const { error } = userSchemas.create.validate(validUser);
      expect(error).toBeUndefined();
    });

    test('should reject missing required fields', () => {
      const invalidUser = {
        username: 'testuser',
        // missing email
      };

      const { error } = userSchemas.create.validate(invalidUser);
      expect(error).toBeDefined();
    });

    test('should reject invalid email format', () => {
      const invalidUser = {
        username: 'testuser',
        email: 'not-an-email',
        password_hash: 'SecurePass123!',
      };

      const { error } = userSchemas.create.validate(invalidUser);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('email');
    });

    test('should reject short password', () => {
      const invalidUser = {
        username: 'testuser',
        email: 'test@example.com',
        password_hash: '123',
      };

      const { error } = userSchemas.create.validate(invalidUser);
      expect(error).toBeDefined();
    });

    test('should reject invalid role', () => {
      const invalidUser = {
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'SecurePass123!',
        role: 'invalid_role',
      };

      const { error } = userSchemas.create.validate(invalidUser);
      expect(error).toBeDefined();
    });
  });

  describe('update schema', () => {
    test('should validate partial updates', () => {
      const validUpdate = {
        avatar_url: 'http://test.com/avatar.png',
      };

      const { error } = userSchemas.update.validate(validUpdate);
      expect(error).toBeUndefined();
    });

    test('should not require all fields', () => {
      const validUpdate = {
        is_active: false,
      };

      const { error } = userSchemas.update.validate(validUpdate);
      expect(error).toBeUndefined();
    });

    test('should validate role update', () => {
      const validUpdate = {
        role: 'admin',
      };

      const { error } = userSchemas.update.validate(validUpdate);
      expect(error).toBeUndefined();
    });
  });

  describe('login schema', () => {
    test('should validate correct login credentials', () => {
      const validLogin = {
        email: 'test@example.com',
        password: 'TestPass123!',
      };

      const { error } = userSchemas.login.validate(validLogin);
      expect(error).toBeUndefined();
    });

    test('should reject missing password', () => {
      const invalidLogin = {
        email: 'test@example.com',
      };

      const { error } = userSchemas.login.validate(invalidLogin);
      expect(error).toBeDefined();
    });

    test('should reject missing email', () => {
      const invalidLogin = {
        password: 'password123',
      };

      const { error } = userSchemas.login.validate(invalidLogin);
      expect(error).toBeDefined();
    });
  });
});
