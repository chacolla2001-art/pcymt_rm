'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if column already exists to avoid duplicate column error
    const tableDescription = await queryInterface.describeTable('users');
    if (!tableDescription.google_id) {
      await queryInterface.addColumn('users', 'google_id', {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true,
      });
    }

    // Add index for faster lookups (only if it doesn't exist)
    try {
      await queryInterface.addIndex('users', ['google_id'], {
        name: 'users_google_id_idx',
        unique: true,
        where: {
          google_id: {
            [Sequelize.Op.ne]: null,
          },
        },
      });
    } catch (err) {
      // Index already exists — skip silently
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('already exists') && !msg.includes('ya existe')) throw err;
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('users', 'users_google_id_idx');
    } catch (_) { /* ignore if not found */ }
    try {
      await queryInterface.removeColumn('users', 'google_id');
    } catch (_) { /* ignore if not found */ }
  },
};
