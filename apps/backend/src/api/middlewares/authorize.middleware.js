const { ROLES } = require('../../shared/constants');
const { ForbiddenError } = require('../../shared/errors');

/**
 * Role-based authorization middleware
 * @param {...string} allowedRoles - Roles allowed to access the route
 * @returns {Function} Express middleware
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ForbiddenError('Access denied'));
    }

    // JWT payload uses 'role' (set in auth.service.js #buildUserPayload)
    const userRole = req.user.role || req.user.user_role;

    if (!allowedRoles.includes(userRole)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
};

/**
 * Admin only middleware
 */
const adminOnly = authorize(ROLES.ADMIN);

/**
 * Any authenticated user middleware (just checks if user exists)
 */
const authenticated = (req, res, next) => {
  if (!req.user) {
    return next(new ForbiddenError('Authentication required'));
  }
  next();
};

module.exports = {
  authorize,
  adminOnly,
  authenticated,
};
