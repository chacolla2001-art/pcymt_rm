const Joi = require('joi');

/**
 * Virtual Asset validation schemas
 */
const virtualAssetSchemas = {
  create: Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Name must be at least 2 characters',
      'any.required': 'Name is required',
    }),
    scientific_name: Joi.string().max(150).allow('', null).optional(),
    description: Joi.string().max(1000).optional(),
    category: Joi.string().max(50).allow('', null).optional(),
    habitat: Joi.string().max(200).allow('', null).optional(),
    model_url: Joi.string().uri().max(500).optional(),
    icon_url: Joi.string().uri().max(500).optional(),
    thumbnail_url: Joi.string().uri().max(500).optional(),
    display_order: Joi.number().integer().min(0).optional(),
    is_active: Joi.boolean().default(true),
  }),

  update: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    scientific_name: Joi.string().max(150).allow('', null).optional(),
    description: Joi.string().max(1000).optional(),
    category: Joi.string().max(50).allow('', null).optional(),
    habitat: Joi.string().max(200).allow('', null).optional(),
    model_url: Joi.string().uri().max(500).optional(),
    icon_url: Joi.string().uri().max(500).optional(),
    thumbnail_url: Joi.string().uri().max(500).optional(),
    display_order: Joi.number().integer().min(0).optional(),
    is_active: Joi.boolean().optional(),
  }),
};

module.exports = virtualAssetSchemas;
