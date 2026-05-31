const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

/**
 * VirtualAsset model definition
 * Represents 3D virtual assets (animals, plants, objects) that can be displayed in AR
 */
const VirtualAsset = sequelize.define('VirtualAsset', {
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
  scientific_name: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  model_url: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: {
      notEmpty: true,
      isValidPath(value) {
        // Accept relative paths starting with / or full URLs
        if (!value.startsWith('/') && !value.startsWith('http://') && !value.startsWith('https://')) {
          throw new Error('model_url must be a valid path or URL');
        }
      },
    },
  },
  icon_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isValidPath(value) {
        if (value && !value.startsWith('/') && !value.startsWith('http://') && !value.startsWith('https://')) {
          throw new Error('icon_url must be a valid path or URL');
        }
      },
    },
  },
  thumbnail_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isValidPath(value) {
        if (value && !value.startsWith('/') && !value.startsWith('http://') && !value.startsWith('https://')) {
          throw new Error('thumbnail_url must be a valid path or URL');
        }
      },
    },
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  habitat: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  display_order: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
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
  tableName: 'virtual_assets',
  timestamps: false,
  indexes: [
    { fields: ['name'] },
    { fields: ['category'] },
    { fields: ['is_active'] },
    { fields: ['display_order'] },
    { fields: ['created_at'] },
  ],
});

module.exports = VirtualAsset;
