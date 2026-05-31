const User = require('./user.model');
const VirtualAsset = require('./virtualAsset.model');
const Location = require('./anchorPoint.model');
const Interaction = require('./userInteraction.model');
const Session = require('./userSession.model');
const MapConfiguration = require('./mapConfiguration.model');

// Define associations with normalized foreign key names (snake_case)
User.hasMany(Interaction, { foreignKey: 'user_id', as: 'interactions' });
Interaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Session, { foreignKey: 'user_id', as: 'sessions' });
Session.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

VirtualAsset.hasMany(Location, { foreignKey: 'virtual_asset_id', as: 'locations' });
Location.belongsTo(VirtualAsset, { foreignKey: 'virtual_asset_id', as: 'virtualAsset' });

VirtualAsset.hasMany(Interaction, { foreignKey: 'virtual_asset_id', as: 'interactions' });
Interaction.belongsTo(VirtualAsset, { foreignKey: 'virtual_asset_id', as: 'virtualAsset' });

Location.hasMany(Interaction, { foreignKey: 'location_id', as: 'interactions' });
Interaction.belongsTo(Location, { foreignKey: 'location_id', as: 'location' });

User.hasMany(MapConfiguration, { foreignKey: 'user_id', as: 'mapConfigurations' });
MapConfiguration.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = {
  User,
  VirtualAsset,
  Location,
  Interaction,
  Session,
  MapConfiguration,
};
