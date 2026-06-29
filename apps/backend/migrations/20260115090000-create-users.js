"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      username: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      role: {
        type: Sequelize.STRING(20),
        defaultValue: 'user',
        allowNull: false,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      first_name: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      last_name: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      document_number: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      avatar_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      email_verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      },
    });

    // Create indexes
    await queryInterface.addIndex('users', ['email'], {
      name: 'users_email_idx',
    });
    await queryInterface.addIndex('users', ['username'], {
      name: 'users_username_idx',
    });
    await queryInterface.addIndex('users', ['role'], {
      name: 'users_role_idx',
    });
    await queryInterface.addIndex('users', ['is_active'], {
      name: 'users_is_active_idx',
    });
    await queryInterface.addIndex('users', ['document_number'], {
      name: 'users_document_number_idx',
      where: { document_number: { [Sequelize.Op.ne]: null } },
    });
    await queryInterface.addIndex('users', ['created_at'], {
      name: 'users_created_at_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('users');
  },
};
