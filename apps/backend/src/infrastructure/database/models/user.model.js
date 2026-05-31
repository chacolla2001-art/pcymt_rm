const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

/**
 * User model definition
 * Represents users who can interact with animal models in AR
 */
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      isEmail: true,
      len: [5, 100],
    },
  },
  google_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  role: {
    type: DataTypes.STRING(20),
    defaultValue: 'user',
    validate: {
      isIn: [['admin', 'user', 'moderator']],
    },
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  avatar_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  email_verified_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  last_login_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  must_change_password: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  deleted_at: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  },
}, {
  tableName: 'users',
  timestamps: false,
  // Soft-delete: Sequelize sets deleted_at instead of issuing DELETE
  paranoid: true,
  deletedAt: 'deleted_at',
  indexes: [
    { fields: ['email'] },
    { fields: ['name'] },
    { fields: ['google_id'], unique: true, where: { google_id: { [sequelize.Sequelize.Op.ne]: null } } },
    { fields: ['role'] },
    { fields: ['is_active'] },
    { fields: ['created_at'] },
    { fields: ['last_login_at'] },
    { fields: ['deleted_at'], name: 'users_deleted_at_idx' },
  ],
});

module.exports = User;
