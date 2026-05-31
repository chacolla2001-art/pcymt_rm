/**
 * Vercel serverless entry — Express app without listen().
 */
require('pg');
require('pg-hstore');

const { createApp } = require('../src/app');
const { connectDB } = require('../src/infrastructure/database');

let app;
let initPromise;

async function bootstrap() {
  if (!initPromise) {
    initPromise = (async () => {
      await connectDB();
      app = createApp();
    })();
  }
  await initPromise;
  return app;
}

module.exports = async (req, res) => {
  const expressApp = await bootstrap();
  return expressApp(req, res);
};
