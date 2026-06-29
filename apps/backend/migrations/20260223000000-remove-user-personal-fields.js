"use strict";

/**
 * Migration: Remove personal fields from users table
 * Drops: document_number, first_name, last_name
 */
module.exports = {
  up: async (queryInterface) => {
    // Remove the unique index on document_number first
    await queryInterface.removeIndex('users', 'users_document_number_unique').catch(() => {});

    await queryInterface.removeColumn('users', 'document_number');
    await queryInterface.removeColumn('users', 'first_name');
    await queryInterface.removeColumn('users', 'last_name');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'first_name', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'last_name', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'document_number', {
      type: Sequelize.STRING(30),
      allowNull: true,
      unique: true,
    });
    await queryInterface.addIndex('users', ['document_number'], {
      unique: true,
      name: 'users_document_number_unique',
      where: { document_number: { [Sequelize.Op.ne]: null } },
    });
  },
};
