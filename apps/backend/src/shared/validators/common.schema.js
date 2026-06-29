const Joi = require('joi');

/**
 * Common validation schemas for IDs and pagination
 */
const commonSchemas = {
  id: Joi.object({
    id: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid ID format',
      'any.required': 'ID is required',
    }),
  }),

  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),

  search: Joi.object({
    q: Joi.string().min(1).max(100).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),
};

module.exports = commonSchemas;
