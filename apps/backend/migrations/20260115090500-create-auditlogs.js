"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
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

    // Create indexes for efficient audit log queries
    await queryInterface.addIndex('audit_logs', ['model'], {
      name: 'audit_logs_model_idx',
    });
    await queryInterface.addIndex('audit_logs', ['record_id'], {
      name: 'audit_logs_record_id_idx',
    });
    await queryInterface.addIndex('audit_logs', ['operation'], {
      name: 'audit_logs_operation_idx',
    });
    await queryInterface.addIndex('audit_logs', ['created_at'], {
      name: 'audit_logs_created_at_idx',
    });
    await queryInterface.addIndex('audit_logs', ['model', 'record_id'], {
      name: 'audit_logs_model_record_id_idx',
    });
    await queryInterface.addIndex('audit_logs', ['model', 'operation', 'created_at'], {
      name: 'audit_logs_model_operation_created_at_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('audit_logs');
  },
};
