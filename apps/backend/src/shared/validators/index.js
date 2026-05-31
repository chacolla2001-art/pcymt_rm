const userSchemas = require('./user.schema');
const virtualAssetSchemas = require('./virtualAsset.schema');
const locationSchemas = require('./anchorPoint.schema');
const interactionSchemas = require('./userInteraction.schema');
const commonSchemas = require('./common.schema');
const mapConfigurationSchemas = require('./mapConfiguration.schema');

module.exports = {
  userSchemas,
  virtualAssetSchemas,
  locationSchemas,
  interactionSchemas,
  mapConfigurationSchemas,
  // Legacy aliases for backward compatibility
  animalModelSchemas: virtualAssetSchemas,
  anchorPointSchemas: locationSchemas,
  userInteractionSchemas: interactionSchemas,
  commonSchemas,
};
