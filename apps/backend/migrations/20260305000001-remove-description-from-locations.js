'use strict';

/**
 * Migration: Remove description column from locations table
 * The description field has been dropped from the locations schema.
 * Descriptions for animals live in virtual_assets.description instead.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('locations', 'description');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('locations', 'description', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },
};
