const BaseRepository = require('./base.repository');
const UserRepository = require('./user.repository');
const VirtualAssetRepository = require('./virtualAsset.repository');
const LocationRepository = require('./anchorPoint.repository');
const InteractionRepository = require('./userInteraction.repository');
const SessionRepository = require('./userSession.repository');
const MapConfigurationRepository = require('./mapConfiguration.repository');

module.exports = {
  BaseRepository,
  UserRepository,
  VirtualAssetRepository,
  LocationRepository,
  InteractionRepository,
  SessionRepository,
  MapConfigurationRepository,
};
