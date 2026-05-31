import { User, UserRole } from './user.model';

describe('User Model', () => {

  describe('constructor', () => {
    it('should create a User with default values', () => {
      const user = new User();
      expect(user.id).toBe('');
      expect(user.username).toBe('');
      expect(user.email).toBe('');
      expect(user.role).toBe(UserRole.USER);
      expect(user.is_active).toBeTrue();
      expect(user.avatar_url).toBe('');
      expect(user.created_at).toBeInstanceOf(Date);
      expect(user.updated_at).toBeInstanceOf(Date);
    });

    it('should create a User with provided data', () => {
      const user = new User({
        id: '123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        is_active: false,
        avatar_url: 'http://example.com/avatar.jpg'
      });
      expect(user.id).toBe('123');
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(user.role).toBe('admin');
      expect(user.is_active).toBeFalse();
      expect(user.avatar_url).toBe('http://example.com/avatar.jpg');
    });

    it('should parse date strings into Date objects', () => {
      const user = new User({
        email_verified_at: new Date('2026-01-15T10:00:00Z'),
        last_login_at: new Date('2026-01-20T12:00:00Z'),
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-10T00:00:00Z')
      });
      expect(user.email_verified_at).toBeInstanceOf(Date);
      expect(user.last_login_at).toBeInstanceOf(Date);
      expect(user.created_at).toBeInstanceOf(Date);
    });

    it('should handle undefined dates', () => {
      const user = new User({ email_verified_at: undefined, last_login_at: undefined });
      expect(user.email_verified_at).toBeUndefined();
      expect(user.last_login_at).toBeUndefined();
    });
  });

  describe('fullDisplayName', () => {
    it('should return username', () => {
      const user = new User({ username: 'johndoe' });
      expect(user.fullDisplayName).toBe('johndoe');
    });

    it('should return empty string when username is empty', () => {
      const user = new User();
      expect(user.fullDisplayName).toBe('');
    });
  });

  describe('isAdmin()', () => {
    it('should return true for admin role', () => {
      const user = new User({ role: 'admin' });
      expect(user.isAdmin()).toBeTrue();
    });

    it('should return true for ADMIN role (case-insensitive)', () => {
      const user = new User({ role: 'Admin' });
      expect(user.isAdmin()).toBeTrue();
    });

    it('should return false for non-admin role', () => {
      const user = new User({ role: 'user' });
      expect(user.isAdmin()).toBeFalse();
    });
  });

  describe('hasRole()', () => {
    it('should match role case-insensitively', () => {
      const user = new User({ role: 'Admin' });
      expect(user.hasRole('admin')).toBeTrue();
      expect(user.hasRole('ADMIN')).toBeTrue();
      expect(user.hasRole(UserRole.ADMIN)).toBeTrue();
    });

    it('should return false for non-matching role', () => {
      const user = new User({ role: 'user' });
      expect(user.hasRole('admin')).toBeFalse();
    });
  });

  describe('getInitials()', () => {
    it('should return first 2 characters of username uppercased', () => {
      const user = new User({ username: 'johndoe' });
      expect(user.getInitials()).toBe('JO');
    });

    it('should handle single-char username', () => {
      const user = new User({ username: 'a' });
      expect(user.getInitials()).toBe('A');
    });

    it('should return empty for empty username', () => {
      const user = new User({ username: '' });
      expect(user.getInitials()).toBe('');
    });
  });

  describe('canOperate()', () => {
    it('should return true when user is active', () => {
      const user = new User({ is_active: true });
      expect(user.canOperate()).toBeTrue();
    });

    it('should return false when user is inactive', () => {
      const user = new User({ is_active: false });
      expect(user.canOperate()).toBeFalse();
    });
  });

  describe('UserRole enum', () => {
    it('should define ADMIN, USER, MODERATOR', () => {
      expect(UserRole.ADMIN).toBe('admin');
      expect(UserRole.USER).toBe('user');
      expect(UserRole.MODERATOR).toBe('moderator');
    });
  });
});
