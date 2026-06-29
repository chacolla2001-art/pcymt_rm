const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

/**
 * Session model definition
 * Tracks user login/logout sessions for analytics and security
 */
const Session = sequelize.define('Session', {
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
  platform: {
    type: DataTypes.ENUM('web', 'mobile', 'desktop'),
    defaultValue: 'web',
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  logged_in_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  logged_out_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  session_duration_seconds: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'sessions',
  timestamps: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['platform'] },
    { fields: ['logged_in_at'] },
    { fields: ['logged_out_at'] },
    { fields: ['user_id', 'logged_in_at'] },
  ],
});

module.exports = Session;
