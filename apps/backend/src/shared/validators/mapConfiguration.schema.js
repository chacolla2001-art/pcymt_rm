const Joi = require('joi');

/**
 * MapConfiguration validation schemas
 */
const mapConfigurationSchemas = {
  create: Joi.object({
    name: Joi.string().min(1).max(100).required().messages({
      'any.required': 'Name is required',
    }),
    description: Joi.string().max(500).allow('', null).optional(),
    platform: Joi.string().valid('mobile', 'web').required().messages({
      'any.required': 'Platform is required',
      'any.only': 'Platform must be mobile or web',
    }),
    config_data: Joi.object().required().messages({
      'any.required': 'Config data is required',
    }),
    configData: Joi.object().optional(),
    is_public: Joi.boolean().default(false),
    isPublic: Joi.boolean().optional(),
  }).unknown(true),

  update: Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    description: Joi.string().max(500).allow('', null).optional(),
    config_data: Joi.object().optional(),
    configData: Joi.object().optional(),
    is_public: Joi.boolean().optional(),
    isPublic: Joi.boolean().optional(),
  }).unknown(true),
};

module.exports = mapConfigurationSchemas;
