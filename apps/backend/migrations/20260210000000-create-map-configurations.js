'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('map_configurations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
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
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      platform: {
        type: Sequelize.ENUM('mobile', 'web'),
        allowNull: false,
        defaultValue: 'mobile',
      },
      config_data: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'JSON with map config: rotation, zoom, center, stickers, poi_visible, etc.',
      },
      is_public: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('map_configurations', ['user_id']);
    await queryInterface.addIndex('map_configurations', ['platform']);
    await queryInterface.addIndex('map_configurations', ['is_public']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('map_configurations');
  },
};
