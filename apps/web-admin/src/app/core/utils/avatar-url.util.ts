/** Shared avatar URL normalization (web admin + API paths). */
export const DEFAULT_AVATAR_API_PATH = '/api/files/model-icons/bear.png';

const LEGACY_BARE_ICONS =
  /^\/api\/files\/(bear|cattle|chicken|cow|dog|horse|leopard|lizard|pig|tiger|viper|reptile|mermaid)\.png$/i;

const AVATAR_FILE_BY_ID: Record<string, string> = {
  mermaid: 'reptile.png',
};

export function normalizeAvatarPath(path: string): string {
  let normalized = path.trim();

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }

  normalized = normalized.replace(/^\/uploads\//, '/api/files/');
  normalized = normalized.replace('/api/files/avatars/', '/api/files/model-icons/');
  normalized = normalized.replace(LEGACY_BARE_ICONS, '/api/files/model-icons/$1.png');

  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  return normalized;
}

export function resolvePredefinedIdFromUrl(
  avatars: Array<{ id: string; url: string }>,
  rawPath?: string | null,
): string | null {
  const raw = (rawPath ?? '').trim();
  if (!raw) return null;

  const normalized = normalizeAvatarPath(raw);
  const fileName = normalized.split('/').pop()?.split('?')[0]?.toLowerCase() ?? '';

  for (const avatar of avatars) {
    const expectedFile = (AVATAR_FILE_BY_ID[avatar.id] ?? `${avatar.id}.png`).toLowerCase();
    const catalogFile = avatar.url.split('/').pop()?.split('?')[0]?.toLowerCase() ?? '';

    if (
      fileName === expectedFile
      || fileName === catalogFile
      || normalized.includes(`/model-icons/${expectedFile}`)
    ) {
      return avatar.id;
    }
  }

  return null;
}

export function isCustomProfilePicturePath(path: string): boolean {
  return normalizeAvatarPath(path).startsWith('/api/files/profile-pictures/');
}

const USER_AVATAR_RE =
  /^\/api\/files\/profile-pictures\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i;

export function isUserScopedProfilePicturePath(path: string): boolean {
  return USER_AVATAR_RE.test(normalizeAvatarPath(path));
}

/** Path to use when avatar_url is empty or missing in DB */
export function resolveStoredAvatarPath(rawPath?: string | null): string {
  const raw = (rawPath ?? '').trim();
  if (!raw) return DEFAULT_AVATAR_API_PATH;
  return normalizeAvatarPath(raw);
}
