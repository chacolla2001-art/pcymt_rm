const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

/**
 * Location model definition
 * Represents physical locations where AR virtual assets are displayed
 */
const Location = sequelize.define('Location', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: [1, 100],
    },
  },
  anchor_code: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false,
    validate: {
      min: -90,
      max: 90,
    },
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false,
    validate: {
      min: -180,
      max: 180,
    },
  },
  section: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  show_in_map: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  scale: {
    type: DataTypes.FLOAT,
    defaultValue: 1.0,
    validate: {
      min: 0.01,
    },
  },
  rotation_y: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
    validate: {
      min: -360,
      max: 360,
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
  spatial_data: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: null,
    comment: 'Virtual Point Space Map data for AR surface persistence',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
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
  tableName: 'locations',
  timestamps: false,
  indexes: [
    { fields: ['name'] },
    { fields: ['virtual_asset_id'] },
    { fields: ['is_active'] },
    { fields: ['latitude', 'longitude'] },
    { fields: ['section'] },
    { fields: ['show_in_map'] },
  ],
});

module.exports = Location;
