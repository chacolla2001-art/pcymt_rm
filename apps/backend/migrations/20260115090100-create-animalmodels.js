"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('virtual_assets', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      scientific_name: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      model_url: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      icon_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      thumbnail_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      category: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      habitat: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
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
    await queryInterface.addIndex('virtual_assets', ['name'], {
      name: 'virtual_assets_name_idx',
    });
    await queryInterface.addIndex('virtual_assets', ['category'], {
      name: 'virtual_assets_category_idx',
    });
    await queryInterface.addIndex('virtual_assets', ['is_active'], {
      name: 'virtual_assets_is_active_idx',
    });
    await queryInterface.addIndex('virtual_assets', ['display_order'], {
      name: 'virtual_assets_display_order_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('virtual_assets');
  },
};
