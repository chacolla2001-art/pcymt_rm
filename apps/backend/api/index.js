/**
 * Vercel Serverless Function Entry Point
 *
 * Creates Express immediately so CORS/OPTIONS respond without waiting for PostgreSQL.
 * DB connection starts in the background and is awaited only for routes that need it.
 */
require('pg');

const { createApp } = require('../src/app');
const { startDBConnection } = require('../src/infrastructure/database');

const app = createApp();
startDBConnection();

module.exports = async (req, res) => app(req, res);
