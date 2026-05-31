/**
 * User roles constants
 */
const ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  USER: 'user',
};

/** Roles that have access to the web panel */
const WEB_ALLOWED_ROLES = [ROLES.ADMIN, ROLES.MODERATOR];

const ROLE_VALUES = Object.values(ROLES);

module.exports = {
  ROLES,
  ROLE_VALUES,
  WEB_ALLOWED_ROLES,
};
