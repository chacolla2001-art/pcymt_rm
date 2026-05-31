const Joi = require('joi');

/**
 * Location validation schemas
 * Accepts both camelCase (frontend) and snake_case (database) field names
 */
const locationSchemas = {
  create: Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
      'any.required': 'Name is required',
    }),
    latitude: Joi.alternatives().try(
      Joi.number().min(-90).max(90),
      Joi.string().pattern(/^-?\d+\.?\d*$/)
    ).required().messages({
      'any.required': 'Latitude is required',
    }),
    longitude: Joi.alternatives().try(
      Joi.number().min(-180).max(180),
      Joi.string().pattern(/^-?\d+\.?\d*$/)
    ).required().messages({
      'any.required': 'Longitude is required',
    }),
    anchor_code: Joi.string().max(500).allow('', null).optional(),
    anchorCode: Joi.string().max(500).allow('', null).optional(),
    virtual_asset_id: Joi.string().uuid().allow('', null).optional(),
    virtualAssetId: Joi.string().uuid().allow('', null).optional(),
    animalModelId: Joi.string().uuid().allow('', null).optional(),
    section: Joi.string().max(50).allow('', null).optional(),
    show_in_map: Joi.boolean().default(true),
    showInMap: Joi.boolean().optional(),
    scale: Joi.number().positive().optional(),
    rotation_y: Joi.number().min(-360).max(360).optional(),
    rotationY: Joi.number().min(-360).max(360).optional(),
    spatial_data: Joi.object().allow(null).optional(),
    spatialData: Joi.object().allow(null).optional(),
    is_active: Joi.boolean().default(true),
    active: Joi.boolean().optional(),
  }).unknown(true),

  update: Joi.object({
    id: Joi.string().uuid().optional(),
    name: Joi.string().min(2).max(100).optional(),
    latitude: Joi.alternatives().try(
      Joi.number().min(-90).max(90),
      Joi.string().pattern(/^-?\d+\.?\d*$/)
    ).optional(),
    longitude: Joi.alternatives().try(
      Joi.number().min(-180).max(180),
      Joi.string().pattern(/^-?\d+\.?\d*$/)
    ).optional(),
    anchor_code: Joi.string().max(500).allow('', null).optional(),
    anchorCode: Joi.string().max(500).allow('', null).optional(),
    virtual_asset_id: Joi.string().uuid().allow('', null).optional(),
    virtualAssetId: Joi.string().uuid().allow('', null).optional(),
    animalModelId: Joi.string().uuid().allow('', null).optional(),
    section: Joi.string().max(50).allow('', null).optional(),
    show_in_map: Joi.boolean().optional(),
    showInMap: Joi.boolean().optional(),
    scale: Joi.number().positive().optional(),
    rotation_y: Joi.number().min(-360).max(360).optional(),
    rotationY: Joi.number().min(-360).max(360).optional(),
    spatial_data: Joi.object().allow(null).optional(),
    spatialData: Joi.object().allow(null).optional(),
    is_active: Joi.boolean().optional(),
    active: Joi.boolean().optional(),
    created_at: Joi.date().optional(),
    createdAt: Joi.date().optional(),
    updated_at: Joi.date().optional(),
    updatedAt: Joi.date().optional(),
  }).unknown(true),
};

module.exports = locationSchemas;
