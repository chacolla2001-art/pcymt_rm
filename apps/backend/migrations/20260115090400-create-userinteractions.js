"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('interactions', {
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
      location_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'locations',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      interaction_type: {
        type: Sequelize.ENUM('view', 'click', 'scan', 'share', 'favorite', 'zoom', 'rotate'),
        allowNull: false,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false,
      },
    });

    // Create indexes
    await queryInterface.addIndex('interactions', ['user_id'], {
      name: 'interactions_user_id_idx',
    });
    await queryInterface.addIndex('interactions', ['virtual_asset_id'], {
      name: 'interactions_virtual_asset_id_idx',
    });
    await queryInterface.addIndex('interactions', ['location_id'], {
      name: 'interactions_location_id_idx',
    });
    await queryInterface.addIndex('interactions', ['interaction_type'], {
      name: 'interactions_interaction_type_idx',
    });
    await queryInterface.addIndex('interactions', ['created_at'], {
      name: 'interactions_created_at_idx',
    });
    await queryInterface.addIndex('interactions', ['user_id', 'interaction_type'], {
      name: 'interactions_user_id_interaction_type_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('interactions');
  },
};
