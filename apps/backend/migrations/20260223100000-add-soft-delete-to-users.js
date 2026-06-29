"use strict";

/**
 * Migration: Add soft-delete (deleted_at) to users table
 *
 * Enables logical deletion (baja lógica) so records are never physically removed.
 * Sequelize paranoid mode uses this column: when deleted_at IS NOT NULL the row
 * is considered deleted and excluded from all standard queries.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });

    // Index to speed up the IS NULL filter that paranoid mode adds to every query
    await queryInterface.addIndex('users', ['deleted_at'], {
      name: 'users_deleted_at_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('users', 'users_deleted_at_idx').catch(() => {});
    await queryInterface.removeColumn('users', 'deleted_at');
  },
};
