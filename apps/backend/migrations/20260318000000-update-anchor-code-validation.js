'use strict';

/**
 * Migration: Update anchor_code validation limit
 *
 * Context: ARCore Cloud Anchor IDs can exceed 50 characters.
 * Increased validation in:
 * - Joi schema (anchorPoint.schema.js): anchor_code max(50) → max(500)
 *
 * Database: No schema change needed. anchor_code is already TEXT type,
 * which supports unlimited length. This migration documents the API
 * validation change.
 *
 * Changelog:
 * - 2026-03-18: Increased anchorPoint.schema.js validation to 500 chars
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // No database schema changes required.
    // anchor_code column is TEXT type, which supports any length.
    // This migration documents the API validation layer update.
    console.log('✓ anchor_code validation updated to support up to 500 characters');
  },

  down: async (queryInterface, Sequelize) => {
    // No-op: Validation limit is not database-enforced
    console.log('✓ Downgrade: No database changes to revert');
  },
};
