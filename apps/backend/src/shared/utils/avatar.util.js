const { ValidationError } = require('../errors');
const {
  normalizeAvatarUrl,
  isAllowedAvatarUrl,
  AVATAR_API_PREFIX,
} = require('../constants/predefinedAvatars');

const PROFILE_PICTURE_FOLDER = 'profile-pictures';
const PROFILE_PICTURE_EXTENSION = '.webp';
const MAX_PROFILE_PICTURE_BYTES = 5 * 1024 * 1024;
const USER_ID_IN_PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_IMAGE_MIMES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const EXTERNAL_AVATAR_HOSTS = /^(https?:\/\/)(lh[0-9]+\.googleusercontent\.com|.*\.googleusercontent\.com)/i;

function isExternalAvatarUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

function isGoogleAvatarUrl(url) {
  return isExternalAvatarUrl(url) && EXTERNAL_AVATAR_HOSTS.test(url);
}

/** Canonical object key: profile-pictures/{userId}.webp */
function buildProfilePictureObjectPath(userId) {
  return `${PROFILE_PICTURE_FOLDER}/${userId}${PROFILE_PICTURE_EXTENSION}`;
}

/** Canonical API path served via GET /api/files/profile-pictures/:filename */
function buildProfilePictureApiUrl(userId) {
  return `/api/files/${buildProfilePictureObjectPath(userId)}`;
}

function isUserScopedProfilePicturePath(normalizedPath) {
  const prefix = `/api/files/${PROFILE_PICTURE_FOLDER}/`;
  if (!normalizedPath.startsWith(prefix)) return false;

  const fileName = normalizedPath.slice(prefix.length).split('?')[0];
  const userId = fileName.replace(/\.(webp|jpe?g|png|gif)$/i, '');
  return USER_ID_IN_PATH_RE.test(userId);
}

function isLegacyProfilePicturePath(normalizedPath) {
  const prefix = `/api/files/${PROFILE_PICTURE_FOLDER}/`;
  if (!normalizedPath.startsWith(prefix)) return false;
  return !isUserScopedProfilePicturePath(normalizedPath);
}

function isCustomProfilePictureUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const normalized = normalizeAvatarUrl(url);
  return normalized.startsWith(`/api/files/${PROFILE_PICTURE_FOLDER}/`);
}

/**
 * Validates avatar_url before persisting via PUT (staff) or internal updates.
 * Allows: null/empty, Google/external HTTPS, predefined model-icons, custom profile-pictures.
 */
function assertValidStoredAvatarUrl(url) {
  if (url === null || url === undefined || url === '') return null;

  if (typeof url !== 'string') {
    throw new ValidationError('Invalid avatar URL', [
      { field: 'avatar_url', message: 'Invalid avatar URL' },
    ]);
  }

  if (isGoogleAvatarUrl(url)) {
    return url;
  }

  if (isExternalAvatarUrl(url)) {
    throw new ValidationError('Only Google profile pictures are allowed as external avatars', [
      { field: 'avatar_url', message: 'External avatar host not allowed' },
    ]);
  }

  const normalized = normalizeAvatarUrl(url);

  if (isAllowedAvatarUrl(normalized) || isCustomProfilePictureUrl(normalized)) {
    return normalized;
  }

  throw new ValidationError('Avatar URL must be a predefined icon or uploaded profile picture', [
    { field: 'avatar_url', message: 'Invalid avatar URL' },
  ]);
}

/** API-facing avatar field (canonical path, no query params). */
function formatAvatarForResponse(url) {
  if (!url) return null;
  if (isExternalAvatarUrl(url)) return url;
  return normalizeAvatarUrl(url) || null;
}

/** Maps DB user row/instance to public API shape with normalized avatar_url. */
function mapUserAvatarFields(user) {
  if (!user) return user;
  const plain = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  return {
    ...plain,
    avatar_url: formatAvatarForResponse(plain.avatar_url),
  };
}

/** Relative path under upload dir from /api/files/... URL */
function avatarUrlToStoragePath(url) {
  if (!url || typeof url !== 'string') return null;
  if (isExternalAvatarUrl(url)) return null;

  const normalized = normalizeAvatarUrl(url);
  if (!normalized.startsWith('/api/files/')) return null;

  return normalized.replace(/^\/api\/files\//, '');
}

module.exports = {
  PROFILE_PICTURE_FOLDER,
  PROFILE_PICTURE_EXTENSION,
  MAX_PROFILE_PICTURE_BYTES,
  ALLOWED_IMAGE_MIMES,
  AVATAR_API_PREFIX,
  buildProfilePictureApiUrl,
  buildProfilePictureObjectPath,
  isUserScopedProfilePicturePath,
  isLegacyProfilePicturePath,
  isExternalAvatarUrl,
  isGoogleAvatarUrl,
  isCustomProfilePictureUrl,
  assertValidStoredAvatarUrl,
  formatAvatarForResponse,
  mapUserAvatarFields,
  avatarUrlToStoragePath,
  normalizeAvatarUrl,
};
