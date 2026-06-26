const {
  normalizeAvatarUrl,
  assertValidStoredAvatarUrl,
  formatAvatarForResponse,
  isCustomProfilePictureUrl,
  isUserScopedProfilePicturePath,
  isGoogleAvatarUrl,
  avatarUrlToStoragePath,
  buildProfilePictureApiUrl,
  buildProfilePictureObjectPath,
  PROFILE_PICTURE_FOLDER,
} = require('../../../src/shared/utils/avatar.util');

describe('avatar.util', () => {
  describe('normalizeAvatarUrl (via predefinedAvatars)', () => {
    it('normalizes legacy /uploads/ paths', () => {
      expect(normalizeAvatarUrl('/uploads/bear.png')).toBe('/api/files/model-icons/bear.png');
    });

    it('keeps profile-pictures paths', () => {
      const url = '/api/files/profile-pictures/photo-123.png';
      expect(normalizeAvatarUrl(url)).toBe(url);
    });
  });

  describe('assertValidStoredAvatarUrl', () => {
    it('accepts predefined avatar paths', () => {
      expect(assertValidStoredAvatarUrl('/api/files/model-icons/bear.png'))
        .toBe('/api/files/model-icons/bear.png');
    });

    it('accepts custom profile picture paths', () => {
      const userId = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
      const url = buildProfilePictureApiUrl(userId);
      expect(assertValidStoredAvatarUrl(url)).toBe(url);
    });

    it('accepts legacy profile picture paths', () => {
      const url = '/api/files/profile-pictures/user-1.jpg';
      expect(assertValidStoredAvatarUrl(url)).toBe(url);
    });

    it('accepts Google avatar URLs', () => {
      const url = 'https://lh3.googleusercontent.com/a/abc';
      expect(assertValidStoredAvatarUrl(url)).toBe(url);
    });

    it('rejects arbitrary external URLs', () => {
      expect(() => assertValidStoredAvatarUrl('https://evil.example/avatar.png')).toThrow();
    });

    it('rejects unknown internal paths', () => {
      expect(() => assertValidStoredAvatarUrl('/api/files/random/file.png')).toThrow();
    });
  });

  describe('formatAvatarForResponse', () => {
    it('normalizes stored predefined paths', () => {
      expect(formatAvatarForResponse('/uploads/bear.png')).toBe('/api/files/model-icons/bear.png');
    });
  });

  describe('buildProfilePictureApiUrl', () => {
    it('builds canonical user-scoped path', () => {
      const userId = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
      expect(buildProfilePictureApiUrl(userId)).toBe(
        `/api/files/profile-pictures/${userId}.webp`,
      );
      expect(buildProfilePictureObjectPath(userId)).toBe(
        `profile-pictures/${userId}.webp`,
      );
    });
  });

  describe('isUserScopedProfilePicturePath', () => {
    it('detects UUID-based filenames', () => {
      const userId = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
      expect(isUserScopedProfilePicturePath(buildProfilePictureApiUrl(userId))).toBe(true);
      expect(isUserScopedProfilePicturePath('/api/files/profile-pictures/legacy.jpg')).toBe(false);
    });
  });

  describe('avatarUrlToStoragePath', () => {
    it('extracts storage path for custom uploads', () => {
      const userId = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
      expect(avatarUrlToStoragePath(buildProfilePictureApiUrl(userId)))
        .toBe(`profile-pictures/${userId}.webp`);
      expect(avatarUrlToStoragePath('/api/files/profile-pictures/x.png'))
        .toBe('profile-pictures/x.png');
    });

    it('returns null for external URLs', () => {
      expect(avatarUrlToStoragePath('https://lh3.googleusercontent.com/x')).toBeNull();
    });
  });

  describe('isCustomProfilePictureUrl', () => {
    it('detects profile picture folder', () => {
      expect(isCustomProfilePictureUrl('/api/files/profile-pictures/a.jpg')).toBe(true);
      expect(isCustomProfilePictureUrl('/api/files/model-icons/bear.png')).toBe(false);
    });
  });

  describe('isGoogleAvatarUrl', () => {
    it('detects googleusercontent hosts', () => {
      expect(isGoogleAvatarUrl('https://lh3.googleusercontent.com/a/x')).toBe(true);
    });
  });

  describe('PROFILE_PICTURE_FOLDER', () => {
    it('uses dedicated folder name', () => {
      expect(PROFILE_PICTURE_FOLDER).toBe('profile-pictures');
    });
  });
});
