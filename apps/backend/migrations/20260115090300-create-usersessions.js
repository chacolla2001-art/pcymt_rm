"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('sessions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      platform: {
        type: Sequelize.ENUM('web', 'mobile', 'desktop'),
        defaultValue: 'web',
        allowNull: false,
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      logged_in_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      },
      logged_out_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      session_duration_seconds: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
    });

    // Create indexes
    await queryInterface.addIndex('sessions', ['user_id'], {
      name: 'sessions_user_id_idx',
    });
    await queryInterface.addIndex('sessions', ['platform'], {
      name: 'sessions_platform_idx',
    });
    await queryInterface.addIndex('sessions', ['logged_in_at'], {
      name: 'sessions_logged_in_at_idx',
    });
    await queryInterface.addIndex('sessions', ['logged_out_at'], {
      name: 'sessions_logged_out_at_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('sessions');
  },
};
