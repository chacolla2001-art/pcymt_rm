const Joi = require('joi');

/**
 * Interaction validation schemas
 */
const interactionSchemas = {
  create: Joi.object({
    user_id: Joi.string().uuid().required().messages({
      'any.required': 'User ID is required',
    }),
    virtual_asset_id: Joi.string().uuid().allow('', null).optional(),
    location_id: Joi.string().uuid().allow('', null).optional(),
    interaction_type: Joi.string()
      .valid('view', 'click', 'scan', 'share', 'favorite', 'zoom', 'rotate')
      .required()
      .messages({
        'any.only':
          'Interaction type must be one of: view, click, scan, share, favorite, zoom, rotate',
        'any.required': 'Interaction type is required',
      }),
    metadata: Joi.object().optional(),
  }),

  update: Joi.object({
    interaction_type: Joi.string()
      .valid('view', 'click', 'scan', 'share', 'favorite', 'zoom', 'rotate')
      .optional(),
    metadata: Joi.object().optional(),
  }),
};

module.exports = interactionSchemas;
