const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

const AppSetting = sequelize.define(
  'AppSetting',
  {
    key: {
      type: DataTypes.STRING(100),
      primaryKey: true,
    },
    value: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'app_settings',
    timestamps: false,
  },
);

module.exports = AppSetting;
