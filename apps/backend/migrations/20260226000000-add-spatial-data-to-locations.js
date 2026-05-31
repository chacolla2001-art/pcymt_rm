'use strict';

/**
 * Migration: Add spatial_data JSONB column to locations table
 * 
 * Stores the Virtual Point Space Map data for AR persistence:
 * - Feature points (visual landmarks)
 * - Surface geometry (plane equations, boundaries)
 * - Anchor pose relative to surfaces
 * - Depth map snapshots
 * - Environment metadata (lighting, compass heading)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('locations', 'spatial_data', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Virtual Point Space Map data for AR surface persistence',
    });

    // Index for querying locations that have spatial data
    await queryInterface.addIndex('locations', ['spatial_data'], {
      name: 'idx_locations_spatial_data',
      where: { spatial_data: { [Sequelize.Op.ne]: null } },
      using: 'gin',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('locations', 'idx_locations_spatial_data');
    await queryInterface.removeColumn('locations', 'spatial_data');
  },
};
