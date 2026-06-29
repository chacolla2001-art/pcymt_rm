const ProfilePictureService = require('../../../src/domain/services/profilePicture.service');
const {
  buildProfilePictureApiUrl,
  buildProfilePictureObjectPath,
  isUserScopedProfilePicturePath,
} = require('../../../src/shared/utils/avatar.util');

const USER_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

describe('ProfilePictureService', () => {
  let hybridStorage;
  let fileUploadService;
  let service;

  beforeEach(() => {
    hybridStorage = {
      persistBuffer: jest.fn().mockResolvedValue(buildProfilePictureApiUrl(USER_ID)),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    fileUploadService = {
      verifyBufferContent: jest.fn().mockResolvedValue(true),
    };
    service = new ProfilePictureService(hybridStorage, fileUploadService);
  });

  describe('getCanonicalUrl', () => {
    it('returns user-scoped webp path', () => {
      expect(service.getCanonicalUrl(USER_ID)).toBe(
        `/api/files/profile-pictures/${USER_ID}.webp`,
      );
    });

    it('rejects invalid user ids', () => {
      expect(() => service.getCanonicalUrl('not-a-uuid')).toThrow('Invalid user id');
    });
  });

  describe('uploadForUser', () => {
    it('processes and persists buffer via hybrid storage', async () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const buffer = Buffer.concat([pngHeader, Buffer.alloc(64)]);

      const url = await service.uploadForUser(USER_ID, {
        buffer,
        mimetype: 'image/png',
        size: buffer.length,
      });

      expect(url).toBe(buildProfilePictureApiUrl(USER_ID));
      expect(hybridStorage.persistBuffer).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          filename: `${USER_ID}.webp`,
          folder: 'profile-pictures',
          contentType: 'image/webp',
          objectPath: buildProfilePictureObjectPath(USER_ID),
        }),
      );
    });

    it('rejects invalid magic bytes', async () => {
      fileUploadService.verifyBufferContent.mockResolvedValue(false);

      await expect(
        service.uploadForUser(USER_ID, {
          buffer: Buffer.from('not-an-image'),
          mimetype: 'image/png',
        }),
      ).rejects.toThrow('Invalid image file content');
    });
  });

  describe('deleteIfCustom', () => {
    it('deletes user-scoped profile pictures', async () => {
      const url = buildProfilePictureApiUrl(USER_ID);
      await service.deleteIfCustom(url);

      expect(hybridStorage.deleteObject).toHaveBeenCalledWith(
        buildProfilePictureObjectPath(USER_ID),
      );
    });

    it('ignores predefined avatars', async () => {
      await service.deleteIfCustom('/api/files/model-icons/bear.png');
      expect(hybridStorage.deleteObject).not.toHaveBeenCalled();
    });

    it('ignores Google avatars', async () => {
      await service.deleteIfCustom('https://lh3.googleusercontent.com/a/abc');
      expect(hybridStorage.deleteObject).not.toHaveBeenCalled();
    });
  });
});

describe('user-scoped profile picture paths', () => {
  it('detects canonical user paths', () => {
    const path = buildProfilePictureApiUrl(USER_ID);
    expect(isUserScopedProfilePicturePath(path)).toBe(true);
  });

  it('does not treat legacy random names as user-scoped', () => {
    expect(isUserScopedProfilePicturePath('/api/files/profile-pictures/photo-123.png')).toBe(false);
  });
});
