'use strict';

/**
 * Migration: rename `username` column to `name` in the users table.
 * Also replaces the unique username index with a plain name index.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('users');

    // Only rename if `username` still exists and `name` doesn't
    if (tableInfo.username && !tableInfo.name) {
      await queryInterface.renameColumn('users', 'username', 'name');
    }

    // Drop old username index if it exists
    const indexes = await queryInterface.showIndex('users');
    const usernameIdx = indexes.find(
      (idx) => idx.fields.some((f) => (f.attribute || f) === 'username'),
    );
    if (usernameIdx) {
      await queryInterface.removeIndex('users', usernameIdx.name);
    }

    // Add plain (non-unique) index on name if not already present
    const nameIdx = indexes.find(
      (idx) => idx.fields.some((f) => (f.attribute || f) === 'name'),
    );
    if (!nameIdx) {
      await queryInterface.addIndex('users', ['name']);
    }

    // Remove NOT NULL constraint on name (allow null for Google-only users)
    if (tableInfo.username || tableInfo.name) {
      await queryInterface.changeColumn('users', 'name', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('users');

    if (tableInfo.name && !tableInfo.username) {
      await queryInterface.renameColumn('users', 'name', 'username');
    }

    // Restore old varchar(50) with NOT NULL
    await queryInterface.changeColumn('users', 'username', {
      type: Sequelize.STRING(50),
      allowNull: false,
    });
  },
};
