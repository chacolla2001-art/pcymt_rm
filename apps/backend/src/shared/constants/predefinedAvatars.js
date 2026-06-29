/** Avatares predefinidos servidos desde /api/files/model-icons/ (Supabase: uploads/model-icons/) */
const { ValidationError } = require('../errors');
const PREDEFINED_AVATARS = [
  { id: 'bear', label: 'Oso Andino', file: 'bear.png' },
  { id: 'cattle', label: 'Toro', file: 'cattle.png' },
  { id: 'chicken', label: 'Gallina', file: 'chicken.png' },
  { id: 'cow', label: 'Vaca', file: 'cow.png' },
  { id: 'dog', label: 'Perro Criollo', file: 'dog.png' },
  { id: 'horse', label: 'Caballo', file: 'horse.png' },
  { id: 'leopard', label: 'Jaguar', file: 'leopard.png' },
  { id: 'lizard', label: 'Lagarto', file: 'lizard.png' },
  { id: 'pig', label: 'Chancho', file: 'pig.png' },
  { id: 'tiger', label: 'Puma', file: 'tiger.png' },
  { id: 'viper', label: 'Víbora', file: 'viper.png' },
  { id: 'mermaid', label: 'Sirena', file: 'reptile.png' },
];

const AVATAR_API_PREFIX = '/api/files/model-icons/';
const DEFAULT_AVATAR_ID = 'bear';
const DEFAULT_AVATAR_OBJECT_PATH = 'model-icons/bear.png';

function getAvatarUrlById(avatarId) {
  const found = PREDEFINED_AVATARS.find((a) => a.id === avatarId);
  if (!found) return null;
  return `${AVATAR_API_PREFIX}${found.file}`;
}

/** Normaliza rutas legacy de avatar a model-icons */
function normalizeAvatarUrl(url) {
  if (!url || typeof url !== 'string') return url;

  let normalized = url.replace(/^\/uploads\//, '/api/files/');
  normalized = normalized.replace('/api/files/avatars/', AVATAR_API_PREFIX);

  const bareIcon = normalized.match(/^\/api\/files\/([a-z]+)\.png$/i);
  if (bareIcon) {
    const file = `${bareIcon[1]}.png`;
    if (PREDEFINED_AVATARS.some((a) => a.file === file)) {
      normalized = `${AVATAR_API_PREFIX}${file}`;
    }
  }

  return normalized;
}

/** Obtiene el id predefinido a partir de una URL almacenada */
function resolveAvatarIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;

  const normalized = normalizeAvatarUrl(url);
  const fileName = normalized.split('/').pop()?.split('?')[0]?.toLowerCase();

  if (!fileName) return null;

  const found = PREDEFINED_AVATARS.find((a) => a.file.toLowerCase() === fileName);
  return found?.id ?? null;
}

function isAllowedAvatarUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const normalized = normalizeAvatarUrl(url);
  return PREDEFINED_AVATARS.some(
    (a) => normalized === `${AVATAR_API_PREFIX}${a.file}`
      || normalized.endsWith(`/${a.file}`),
  );
}

function getPublicAvatarList() {
  return PREDEFINED_AVATARS.map((a) => ({
    id: a.id,
    label: a.label,
    url: `${AVATAR_API_PREFIX}${a.file}`,
  }));
}

/** Resuelve avatar_id → URL canónica o lanza ValidationError. */
function resolveAvatarUrlOrThrow(avatarId) {
  const url = getAvatarUrlById(avatarId);
  if (!url) {
    throw new ValidationError('Invalid avatar selection', [
      { field: 'avatar_id', message: 'Invalid avatar selection' },
    ]);
  }
  return url;
}

function getDefaultAvatarUrl() {
  return getAvatarUrlById(DEFAULT_AVATAR_ID);
}

function getDefaultAvatarObjectPath() {
  return DEFAULT_AVATAR_OBJECT_PATH;
}

module.exports = {
  PREDEFINED_AVATARS,
  AVATAR_API_PREFIX,
  DEFAULT_AVATAR_ID,
  DEFAULT_AVATAR_OBJECT_PATH,
  getDefaultAvatarUrl,
  getDefaultAvatarObjectPath,
  getAvatarUrlById,
  normalizeAvatarUrl,
  resolveAvatarIdFromUrl,
  isAllowedAvatarUrl,
  getPublicAvatarList,
  resolveAvatarUrlOrThrow,
};
