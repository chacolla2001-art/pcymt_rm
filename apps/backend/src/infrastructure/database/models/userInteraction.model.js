const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

/**
 * Interaction model definition
 * Tracks user interactions with AR virtual assets
 */
const Interaction = sequelize.define('Interaction', {
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
  virtual_asset_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'virtual_assets',
      key: 'id',
    },
  },
  location_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'locations',
      key: 'id',
    },
  },
  interaction_type: {
    type: DataTypes.ENUM('view', 'click', 'scan', 'share', 'favorite', 'zoom', 'rotate'),
    allowNull: false,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'interactions',
  timestamps: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['virtual_asset_id'] },
    { fields: ['location_id'] },
    { fields: ['interaction_type'] },
    { fields: ['created_at'] },
    { fields: ['user_id', 'interaction_type'] },
    { fields: ['user_id', 'created_at'] },
  ],
});

module.exports = Interaction;
