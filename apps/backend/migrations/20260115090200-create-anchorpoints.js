"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('locations', {
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
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      anchor_code: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      latitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: false,
      },
      longitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: false,
      },
      section: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      show_in_map: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      scale: {
        type: Sequelize.FLOAT,
        defaultValue: 1.0,
        allowNull: false,
      },
      rotation_y: {
        type: Sequelize.FLOAT,
        defaultValue: 0.0,
        allowNull: false,
      },
      virtual_asset_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'virtual_assets',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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
    await queryInterface.addIndex('locations', ['name'], {
      name: 'locations_name_idx',
    });
    await queryInterface.addIndex('locations', ['virtual_asset_id'], {
      name: 'locations_virtual_asset_id_idx',
    });
    await queryInterface.addIndex('locations', ['is_active'], {
      name: 'locations_is_active_idx',
    });
    await queryInterface.addIndex('locations', ['latitude', 'longitude'], {
      name: 'locations_lat_lon_idx',
    });
    await queryInterface.addIndex('locations', ['section'], {
      name: 'locations_section_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('locations');
  },
};
