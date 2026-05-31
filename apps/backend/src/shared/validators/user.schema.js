const Joi = require('joi');
const { ROLE_VALUES } = require('../constants');

/**
 * Password validation pattern
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#\-.])[A-Za-z\d@$!%*?&_#\-.]{8,}$/;
const PASSWORD_MESSAGE = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&_#-.)';

/**
 * Reusable password schema
 */
const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(PASSWORD_PATTERN)
  .messages({
    'string.min': 'Password must be at least 8 characters',
    'string.max': 'Password cannot exceed 128 characters',
    'string.pattern.base': PASSWORD_MESSAGE,
  });

/**
 * User validation schemas
 */
const userSchemas = {
  create: Joi.object({
    name: Joi.string().min(1).max(100).optional().allow('').messages({
      'string.max': 'Name cannot exceed 100 characters',
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email',
      'any.required': 'Email is required',
    }),
    password_hash: passwordSchema.optional().messages({
      'string.min': 'Password must be at least 8 characters',
    }),
    role: Joi.string().valid(...ROLE_VALUES, 'moderator').default('user'),
    avatar_url: Joi.string().uri().max(500).optional().allow(''),
    google_id: Joi.string().optional().allow(''),
    is_active: Joi.boolean().default(true),
  }),

  update: Joi.object({
    avatar_url: Joi.string().uri().max(500).optional(),
    role: Joi.string().valid(...ROLE_VALUES, 'moderator').optional(),
    is_active: Joi.boolean().optional(),
    password_hash: passwordSchema.optional(),
  }),

  login: Joi.object({
    email: Joi.string().required().messages({
      'any.required': 'Email is required',
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required',
    }),
    platform: Joi.string().valid('web', 'mobile', 'desktop').default('web'),
  }),

  changePassword: Joi.object({
    email: Joi.string().email().required(),
    currentPassword: Joi.string().required(),
    newPassword: passwordSchema.required().messages({
      'string.min': 'New password must be at least 8 characters',
      'string.pattern.base': PASSWORD_MESSAGE,
      'any.required': 'New password is required',
    }),
  }),

  deleteOwnAccount: Joi.object({
    currentPassword: Joi.string().trim().optional().allow(''),
  }),

  adminSetPassword: Joi.object({
    newPassword: passwordSchema.required().messages({
      'string.min': 'New password must be at least 8 characters',
      'string.pattern.base': PASSWORD_MESSAGE,
      'any.required': 'New password is required',
    }),
  }),

  recoverPassword: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email',
      'any.required': 'Email is required',
    }),
  }),
};

module.exports = userSchemas;
