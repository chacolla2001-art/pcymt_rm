'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    // Drop audit_logs table
    await queryInterface.dropTable('audit_logs');
  },

  async down (queryInterface, Sequelize) {
    // Recreate audit_logs table if needed to rollback
    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      model: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      operation: {
        type: Sequelize.ENUM('CREATE', 'UPDATE', 'DELETE'),
        allowNull: false,
      },
      record_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      before: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      after: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      changed_by: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      },
    });
  }
};
