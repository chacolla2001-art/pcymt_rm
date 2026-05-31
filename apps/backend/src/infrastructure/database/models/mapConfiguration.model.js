const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

/**
 * MapConfiguration model definition
 * Stores map layer configurations (rotation, zoom, stickers, etc.)
 * Separate configs for mobile and web platforms
 */
const MapConfiguration = sequelize.define('MapConfiguration', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: [1, 100],
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  platform: {
    type: DataTypes.ENUM('mobile', 'web'),
    allowNull: false,
    defaultValue: 'mobile',
  },
  config_data: {
    type: DataTypes.JSONB,
    allowNull: false,
    comment: 'JSON with map config: rotation, zoom, center, stickers, poi_visible, etc.',
  },
  is_public: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'map_configurations',
  timestamps: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['platform'] },
    { fields: ['is_public'] },
  ],
});

module.exports = MapConfiguration;
